import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type ShareDestination =
  | "native"
  | "copy_link"
  | "whatsapp"
  | "telegram"
  | "facebook"
  | "instagram"
  | "story"
  | "download"
  | "repost";

export function videoDeepLink(videoId: string): string {
  if (typeof window === "undefined") return `/v/${videoId}`;
  return `${window.location.origin}/v/${videoId}`;
}

export function buildShareText(opts: {
  username?: string | null;
  caption?: string | null;
  url: string;
}): string {
  const lines: string[] = [];
  if (opts.caption) lines.push(opts.caption);
  if (opts.username) lines.push(`@${opts.username} on ZingChatX`);
  lines.push(`Watch on ZingChatX → ${opts.url}`);
  return lines.join("\n\n");
}

export async function recordShare(videoId: string, destination: ShareDestination): Promise<void> {
  try {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    await supabase.from("shares").insert({
      user_id: u.user.id,
      video_id: videoId,
      destination,
    });
  } catch (err) {
    console.warn("recordShare failed", err);
  }
}

export function openIntent(destination: ShareDestination, text: string, url: string): void {
  let target: string | null = null;
  const encText = encodeURIComponent(text);
  const encUrl = encodeURIComponent(url);
  switch (destination) {
    case "whatsapp":
      target = `https://wa.me/?text=${encText}`;
      break;
    case "telegram":
      target = `https://t.me/share/url?url=${encUrl}&text=${encText}`;
      break;
    case "facebook":
      target = `https://www.facebook.com/sharer/sharer.php?u=${encUrl}&quote=${encText}`;
      break;
    case "instagram":
      // Instagram has no public web share URL; copy and prompt
      navigator.clipboard.writeText(text).catch(() => {});
      toast.success("Copied — paste into Instagram");
      return;
    default:
      return;
  }
  window.open(target, "_blank", "noopener,noreferrer");
}

/**
 * Re-encode an MP4 with a baked-in ZingChatX watermark using canvas + MediaRecorder.
 * Returns a Blob the caller can download.
 */
export async function renderWatermarkedVideo(
  videoUrl: string,
  watermarkText: string,
): Promise<Blob> {
  const src = document.createElement("video");
  src.crossOrigin = "anonymous";
  src.src = videoUrl;
  src.muted = true;
  src.playsInline = true;
  await new Promise<void>((resolve, reject) => {
    src.onloadedmetadata = () => resolve();
    src.onerror = () => reject(new Error("Could not load source video"));
  });

  const w = src.videoWidth || 720;
  const h = src.videoHeight || 1280;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");

  const stream = (canvas as HTMLCanvasElement & { captureStream(fps?: number): MediaStream }).captureStream(30);
  // try to copy original audio track
  type AudioCapable = HTMLVideoElement & { captureStream?: () => MediaStream };
  const audioCapable = src as AudioCapable;
  try {
    const srcStream = audioCapable.captureStream?.();
    srcStream?.getAudioTracks().forEach((t) => stream.addTrack(t));
  } catch {
    /* ignore audio capture failure */
  }

  const mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
    ? "video/webm;codecs=vp9,opus"
    : "video/webm";
  const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 4_000_000 });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);

  const done = new Promise<Blob>((resolve) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: mime }));
  });

  // Burned-in watermark rotates through four corners every ~10s, matching
  // the on-screen overlay. Fades during transitions so it cannot be cropped.
  const corners: Array<"br" | "bl" | "tr" | "tl"> = ["br", "bl", "tr", "tl"];
  const CYCLE_MS = 10_000;
  const FADE_MS = 600;
  const startedAt = performance.now();

  let raf = 0;
  const draw = () => {
    ctx.drawImage(src, 0, 0, w, h);

    const elapsed = performance.now() - startedAt;
    const stage = Math.floor(elapsed / CYCLE_MS) % corners.length;
    const intoStage = elapsed % CYCLE_MS;
    const fade =
      intoStage > CYCLE_MS - FADE_MS
        ? 1 - (intoStage - (CYCLE_MS - FADE_MS)) / FADE_MS
        : intoStage < FADE_MS
          ? intoStage / FADE_MS
          : 1;
    const corner = corners[stage];

    const pad = Math.round(w * 0.03);
    const fontSize = Math.max(18, Math.round(w * 0.035));
    const subSize = Math.round(fontSize * 0.65);
    const lineGap = 4;

    // Measure for pill background
    ctx.font = `600 ${fontSize}px "Space Grotesk", system-ui, sans-serif`;
    const mainText = "✦ ZingChatX";
    const subText = watermarkText;
    const mainW = ctx.measureText(mainText).width;
    ctx.font = `500 ${subSize}px Inter, system-ui, sans-serif`;
    const subW = ctx.measureText(subText).width;
    const boxW = Math.max(mainW, subW) + pad;
    const boxH = fontSize + subSize + lineGap + pad * 0.7;

    const x = corner === "br" || corner === "tr" ? w - pad - boxW : pad;
    const y = corner === "br" || corner === "bl" ? h - pad - boxH : pad;

    ctx.globalAlpha = 0.42 * fade;

    // Pill background
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    const r = boxH / 2;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + boxW - r, y);
    ctx.quadraticCurveTo(x + boxW, y, x + boxW, y + r);
    ctx.lineTo(x + boxW, y + boxH - r);
    ctx.quadraticCurveTo(x + boxW, y + boxH, x + boxW - r, y + boxH);
    ctx.lineTo(x + r, y + boxH);
    ctx.quadraticCurveTo(x, y + boxH, x, y + boxH - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
    ctx.fill();

    ctx.textBaseline = "top";
    ctx.textAlign = "left";
    ctx.shadowColor = "rgba(0,0,0,0.55)";
    ctx.shadowBlur = 6;

    ctx.font = `600 ${fontSize}px "Space Grotesk", system-ui, sans-serif`;
    ctx.fillStyle = "rgba(255,255,255,0.95)";
    ctx.fillText(mainText, x + pad / 2, y + pad * 0.35);

    ctx.font = `500 ${subSize}px Inter, system-ui, sans-serif`;
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.fillText(subText, x + pad / 2, y + pad * 0.35 + fontSize + lineGap);

    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
    raf = requestAnimationFrame(draw);
  };

  recorder.start(250);
  src.currentTime = 0;
  await src.play();
  draw();

  await new Promise<void>((resolve) => {
    src.onended = () => resolve();
  });
  cancelAnimationFrame(raf);
  src.pause();

  // ---- 2-second branded outro (solid black, fades in/out) -----------------
  await renderOutro(ctx, w, h, watermarkText);

  recorder.stop();
  return done;
}

/** Draws a 2s branded end card onto the canvas; resolves when complete. */
async function renderOutro(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  watermarkText: string,
): Promise<void> {
  const DURATION = 2000;
  const FADE = 500;
  const start = performance.now();

  return new Promise<void>((resolve) => {
    let raf = 0;
    const tick = () => {
      const t = performance.now() - start;
      if (t >= DURATION) {
        cancelAnimationFrame(raf);
        resolve();
        return;
      }
      const fade =
        t < FADE
          ? t / FADE
          : t > DURATION - FADE
            ? (DURATION - t) / FADE
            : 1;

      // Solid black canvas
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, w, h);

      ctx.globalAlpha = fade;

      // Subtle radial glow behind logo for premium feel
      const cx = w / 2;
      const cy = h / 2 - h * 0.06;
      const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.min(w, h) * 0.55);
      glow.addColorStop(0, "rgba(236, 72, 153, 0.28)");
      glow.addColorStop(0.55, "rgba(34, 211, 238, 0.10)");
      glow.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, w, h);

      // ----- Logo mark: gradient rounded square with sparkle ------------
      const logoSize = Math.round(Math.min(w, h) * 0.18);
      const logoX = cx - logoSize / 2;
      const logoY = cy - logoSize / 2;
      const logoR = logoSize * 0.26;

      const lg = ctx.createLinearGradient(logoX, logoY, logoX + logoSize, logoY + logoSize);
      lg.addColorStop(0, "#ec4899"); // electric magenta
      lg.addColorStop(1, "#22d3ee"); // cyan glow
      ctx.fillStyle = lg;
      roundedRect(ctx, logoX, logoY, logoSize, logoSize, logoR);
      ctx.fill();

      // Sparkle glyph in white
      drawSparkle(ctx, cx, cy, logoSize * 0.36);

      // ----- "ZingChatX" wordmark --------------------------------------
      const titleSize = Math.max(28, Math.round(Math.min(w, h) * 0.07));
      ctx.font = `700 ${titleSize}px "Space Grotesk", system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillStyle = "#ffffff";
      ctx.fillText("ZingChatX", cx, logoY + logoSize + titleSize * 0.45);

      // ----- "Watch more on ZingChatX" tagline -------------------------
      const tagSize = Math.max(16, Math.round(titleSize * 0.42));
      ctx.font = `500 ${tagSize}px Inter, system-ui, sans-serif`;
      ctx.fillStyle = "rgba(255,255,255,0.72)";
      ctx.fillText(
        "Watch more on ZingChatX",
        cx,
        logoY + logoSize + titleSize * 1.7,
      );

      // ----- Creator handle bottom-right -------------------------------
      const handleSize = Math.max(14, Math.round(Math.min(w, h) * 0.028));
      ctx.font = `600 ${handleSize}px Inter, system-ui, sans-serif`;
      ctx.textAlign = "right";
      ctx.textBaseline = "bottom";
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      const pad = Math.round(Math.min(w, h) * 0.04);
      ctx.fillText(watermarkText, w - pad, h - pad);

      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  });
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

/** 4-point sparkle glyph centered at (cx, cy). */
function drawSparkle(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number) {
  ctx.save();
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  // Vertical diamond
  ctx.moveTo(cx, cy - size);
  ctx.quadraticCurveTo(cx + size * 0.18, cy, cx, cy + size);
  ctx.quadraticCurveTo(cx - size * 0.18, cy, cx, cy - size);
  // Horizontal diamond
  ctx.moveTo(cx - size, cy);
  ctx.quadraticCurveTo(cx, cy - size * 0.18, cx + size, cy);
  ctx.quadraticCurveTo(cx, cy + size * 0.18, cx - size, cy);
  ctx.fill();
  // Small accent dots
  ctx.globalAlpha *= 0.85;
  const d = size * 0.18;
  ctx.beginPath();
  ctx.arc(cx + size * 0.85, cy - size * 0.85, d, 0, Math.PI * 2);
  ctx.arc(cx - size * 0.85, cy + size * 0.85, d * 0.7, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
