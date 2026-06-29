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

  let raf = 0;
  const draw = () => {
    ctx.drawImage(src, 0, 0, w, h);
    // watermark — bottom right
    const pad = Math.round(w * 0.025);
    const fontSize = Math.max(18, Math.round(w * 0.035));
    ctx.font = `600 ${fontSize}px "Space Grotesk", system-ui, sans-serif`;
    ctx.textBaseline = "bottom";
    ctx.textAlign = "right";
    ctx.shadowColor = "rgba(0,0,0,0.6)";
    ctx.shadowBlur = 8;
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.fillText("ZingChatX", w - pad, h - pad);
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.font = `500 ${Math.round(fontSize * 0.65)}px Inter, system-ui, sans-serif`;
    ctx.fillText(watermarkText, w - pad, h - pad - fontSize - 4);
    ctx.shadowBlur = 0;
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
