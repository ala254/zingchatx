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
  recorder.stop();
  src.pause();
  return done;
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
