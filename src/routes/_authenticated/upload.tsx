import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { takePendingCapture } from "@/lib/camera-capture-store";

import { Upload, Video, X, Loader2, Hash, MapPin, Camera } from "lucide-react";
import { toast } from "sonner";
import { Route as AuthRoute } from "../_authenticated/route";

export const Route = createFileRoute("/_authenticated/upload")({
  head: () => ({ meta: [{ title: "Upload — ZingChatX" }] }),
  component: UploadPage,
});

function UploadPage() {
  const { user } = AuthRoute.useRouteContext();
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [hashtags, setHashtags] = useState("");
  const [location, setLocation] = useState("");
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const f = takePendingCapture();
    if (f) pickFile(f);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  function pickFile(f: File | undefined | null) {
    if (!f) return;
    if (!f.type.startsWith("video/")) return toast.error("Please pick a video file");
    if (f.size > 100 * 1024 * 1024) return toast.error("Max 100 MB");
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(f);
    setPreviewUrl(URL.createObjectURL(f));
  }

  async function generateThumbnail(): Promise<Blob | null> {
    const v = videoRef.current;
    if (!v) return null;
    return new Promise((resolve) => {
      const cap = () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = v.videoWidth || 720;
          canvas.height = v.videoHeight || 1280;
          const ctx = canvas.getContext("2d");
          if (!ctx) return resolve(null);
          ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
          canvas.toBlob((b) => resolve(b), "image/jpeg", 0.85);
        } catch {
          resolve(null);
        }
      };
      if (v.readyState >= 2) cap();
      else v.addEventListener("loadeddata", cap, { once: true });
      v.currentTime = Math.min(1, (v.duration || 2) / 2);
    });
  }

  async function handlePost() {
    if (!file || !user) return;
    setBusy(true);
    setProgress(5);
    try {
      const ext = file.name.split(".").pop() || "mp4";
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("videos")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) throw upErr;
      setProgress(60);

      const videoUrl = supabase.storage.from("videos").getPublicUrl(path).data.publicUrl;

      const thumbBlob = await generateThumbnail();
      let thumbnailUrl: string | null = null;
      if (thumbBlob) {
        const thumbPath = `${user.id}/${crypto.randomUUID()}.jpg`;
        const { error: tErr } = await supabase.storage
          .from("thumbnails")
          .upload(thumbPath, thumbBlob, { contentType: "image/jpeg" });
        if (!tErr) thumbnailUrl = supabase.storage.from("thumbnails").getPublicUrl(thumbPath).data.publicUrl;
      }
      setProgress(85);

      const tagList = Array.from(
        new Set(
          (hashtags.match(/#?[A-Za-z0-9_]+/g) ?? []).map((t) => t.replace(/^#/, "").toLowerCase()).filter(Boolean),
        ),
      );

      const { error: insErr } = await supabase.from("videos").insert({
        user_id: user.id,
        video_url: videoUrl,
        thumbnail_url: thumbnailUrl,
        caption: caption.trim() || null,
        hashtags: tagList,
        location: location.trim() || null,
      });
      if (insErr) throw insErr;
      setProgress(100);
      toast.success("Posted!");
      navigate({ to: "/feed" });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-[480px] px-5 pt-6">
      <h1 className="font-display text-2xl font-bold">New post</h1>
      <p className="mt-1 text-sm text-muted-foreground">Share a vertical short video.</p>

      {!file ? (
        <div className="mt-6 space-y-3">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex w-full flex-col items-center justify-center gap-3 rounded-3xl border-2 border-dashed border-border bg-surface px-6 py-12 text-center transition hover:border-primary hover:bg-surface-elevated"
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl gradient-zing shadow-zing">
              <Video className="h-7 w-7 text-zing-foreground" />
            </div>
            <div>
              <p className="font-display font-semibold">Pick from gallery</p>
              <p className="mt-1 text-xs text-muted-foreground">MP4 / MOV / WebM · up to 100MB</p>
            </div>
          </button>
          <button
            onClick={() => cameraInputRef.current?.click()}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-border bg-surface-elevated px-6 py-4 text-sm font-semibold"
          >
            <Camera className="h-5 w-5" /> Record with camera
          </button>
          <input ref={fileInputRef} type="file" accept="video/*" className="hidden" onChange={(e) => pickFile(e.target.files?.[0])} />
          <input ref={cameraInputRef} type="file" accept="video/*" capture="environment" className="hidden" onChange={(e) => pickFile(e.target.files?.[0])} />
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          <div className="relative aspect-[9/16] overflow-hidden rounded-3xl bg-black">
            <video ref={videoRef} src={previewUrl ?? ""} className="h-full w-full object-cover" controls playsInline />
            <button
              onClick={() => { setFile(null); if (previewUrl) URL.revokeObjectURL(previewUrl); setPreviewUrl(null); }}
              className="absolute right-3 top-3 rounded-full bg-black/60 p-2 backdrop-blur"
              disabled={busy}
            >
              <X className="h-4 w-4 text-white" />
            </button>
          </div>

          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Write a caption…"
            rows={3}
            maxLength={500}
            className="w-full resize-none rounded-2xl border border-border bg-input px-4 py-3 text-sm focus:border-primary focus:outline-none"
          />

          <label className="flex items-center gap-3 rounded-2xl border border-border bg-input px-4 py-3">
            <Hash className="h-4 w-4 text-muted-foreground" />
            <input
              value={hashtags}
              onChange={(e) => setHashtags(e.target.value)}
              placeholder="hashtags (space separated)"
              className="flex-1 bg-transparent text-sm focus:outline-none"
            />
          </label>

          <label className="flex items-center gap-3 rounded-2xl border border-border bg-input px-4 py-3">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="add location (optional)"
              className="flex-1 bg-transparent text-sm focus:outline-none"
            />
          </label>

          {busy && (
            <div>
              <div className="h-2 overflow-hidden rounded-full bg-secondary">
                <div className="h-full gradient-zing transition-all" style={{ width: progress + "%" }} />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">Uploading… {progress}%</p>
            </div>
          )}

          <button
            onClick={handlePost}
            disabled={busy}
            className="flex w-full items-center justify-center gap-2 rounded-full gradient-zing px-6 py-3.5 text-sm font-semibold text-zing-foreground shadow-zing disabled:opacity-50 active:scale-[0.98] transition"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {busy ? "Posting…" : "Post to ZingChatX"}
          </button>
        </div>
      )}
    </div>
  );
}
