import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  X,
  Zap,
  ZapOff,
  SwitchCamera,
  Sparkles,
  Wand2,
  Timer,
  LayoutGrid,
  Music2,
  Image as ImageIcon,
  Check,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { setPendingCapture } from "@/lib/camera-capture-store";

export const Route = createFileRoute("/_authenticated/camera")({
  head: () => ({ meta: [{ title: "ZingCam — ZingChatX" }] }),
  component: CameraPage,
});

type Mode = { id: string; label: string; kind: "video" | "photo" | "text"; maxMs?: number };
const MODES: Mode[] = [
  { id: "10m", label: "10m", kind: "video", maxMs: 10 * 60 * 1000 },
  { id: "60s", label: "60s", kind: "video", maxMs: 60 * 1000 },
  { id: "15s", label: "15s", kind: "video", maxMs: 15 * 1000 },
  { id: "photo", label: "Photo", kind: "photo" },
  { id: "text", label: "Text", kind: "text" },
];

type Filter = { id: string; label: string; css: string };
const FILTERS: Filter[] = [
  { id: "none", label: "Original", css: "none" },
  { id: "glow", label: "Glow", css: "brightness(1.08) contrast(1.05) saturate(1.15)" },
  { id: "warm", label: "Warm", css: "sepia(0.25) saturate(1.2) hue-rotate(-8deg) brightness(1.05)" },
  { id: "cool", label: "Cool", css: "saturate(1.1) hue-rotate(12deg) brightness(1.02) contrast(1.05)" },
  { id: "noir", label: "Noir", css: "grayscale(1) contrast(1.2) brightness(1.05)" },
  { id: "vivid", label: "Vivid", css: "saturate(1.6) contrast(1.15)" },
  { id: "fade", label: "Fade", css: "contrast(0.92) brightness(1.08) saturate(0.85) sepia(0.1)" },
];

const TIMERS = [0, 3, 10] as const;

function CameraPage() {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const rafRef = useRef<number | null>(null);
  const startedAtRef = useRef<number>(0);
  const pinchStartRef = useRef<{ dist: number; zoom: number } | null>(null);

  const [ready, setReady] = useState(false);
  const [facing, setFacing] = useState<"user" | "environment">("user");
  const [flashOn, setFlashOn] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [beauty, setBeauty] = useState(true);
  const [filterIdx, setFilterIdx] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const [grid, setGrid] = useState(false);
  const [timer, setTimer] = useState<(typeof TIMERS)[number]>(0);
  const [countdown, setCountdown] = useState(0);
  const [modeIdx, setModeIdx] = useState(2); // 15s default
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [zoomCaps, setZoomCaps] = useState<{ min: number; max: number; step: number } | null>(null);
  const [focusPt, setFocusPt] = useState<{ x: number; y: number; t: number } | null>(null);
  const [exposure, setExposure] = useState(0); // -2 .. 2 visual EV
  const [showExposure, setShowExposure] = useState(false);
  const [textPost, setTextPost] = useState("");
  const [textBg, setTextBg] = useState(0);
  const [busy, setBusy] = useState(false);

  const mode = MODES[modeIdx];
  const filter = FILTERS[filterIdx];
  const isTextMode = mode.kind === "text";

  /* ------------------------------ stream lifecycle ------------------------------ */

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const startStream = useCallback(
    async (face: "user" | "environment") => {
      stopStream();
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: face }, width: { ideal: 1080 }, height: { ideal: 1920 } },
          audio: true,
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        const track = stream.getVideoTracks()[0];
        const caps = (track.getCapabilities?.() ?? {}) as MediaTrackCapabilities & {
          torch?: boolean;
          zoom?: { min: number; max: number; step: number };
        };
        setHasTorch(!!caps.torch);
        if (caps.zoom) setZoomCaps({ min: caps.zoom.min, max: caps.zoom.max, step: caps.zoom.step || 0.1 });
        else setZoomCaps(null);
        setZoom(1);
        setReady(true);
      } catch (e) {
        toast.error("Camera access denied");
        console.error(e);
      }
    },
    [stopStream],
  );

  useEffect(() => {
    if (!isTextMode) startStream(facing);
    else {
      stopStream();
      setReady(true);
    }
    return () => stopStream();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facing, isTextMode]);

  // Toggle torch
  useEffect(() => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track || !hasTorch) return;
    track.applyConstraints({ advanced: [{ torch: flashOn } as MediaTrackConstraintSet] }).catch(() => {});
  }, [flashOn, hasTorch]);

  // Apply zoom
  useEffect(() => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track || !zoomCaps) return;
    track.applyConstraints({ advanced: [{ zoom } as MediaTrackConstraintSet] }).catch(() => {});
  }, [zoom, zoomCaps]);

  /* --------------------------------- recording --------------------------------- */

  const stopRecording = useCallback(() => {
    recorderRef.current?.state === "recording" && recorderRef.current?.stop();
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
  }, []);

  const beginRecording = useCallback(() => {
    const stream = streamRef.current;
    if (!stream) return;
    chunksRef.current = [];
    const mime = MediaRecorder.isTypeSupported("video/mp4") ? "video/mp4" : "video/webm";
    const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 6_000_000 });
    recorderRef.current = rec;
    rec.ondataavailable = (e) => e.data.size && chunksRef.current.push(e.data);
    rec.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mime });
      const ext = mime.includes("mp4") ? "mp4" : "webm";
      const file = new File([blob], `zingcam-${Date.now()}.${ext}`, { type: mime });
      setRecording(false);
      stopStream();
      setPendingCapture(file);
      navigate({ to: "/upload" });
    };
    rec.start(100);
    setRecording(true);
    startedAtRef.current = performance.now();
    const tick = () => {
      const ms = performance.now() - startedAtRef.current;
      setElapsed(ms);
      if (mode.maxMs && ms >= mode.maxMs) {
        stopRecording();
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [mode.maxMs, navigate, stopRecording, stopStream]);

  const runCountdown = useCallback(
    (seconds: number, then: () => void) => {
      if (!seconds) return then();
      setCountdown(seconds);
      let n = seconds;
      const i = setInterval(() => {
        n -= 1;
        if (n <= 0) {
          clearInterval(i);
          setCountdown(0);
          then();
        } else setCountdown(n);
      }, 1000);
    },
    [],
  );

  /* ----------------------------------- photo ----------------------------------- */

  const capturePhoto = useCallback(async () => {
    const v = videoRef.current;
    if (!v) return;
    const w = v.videoWidth || 1080;
    const h = v.videoHeight || 1920;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    // mirror front-cam to match the preview
    if (facing === "user") {
      ctx.translate(w, 0);
      ctx.scale(-1, 1);
    }
    ctx.filter = filter.css === "none" ? "none" : filter.css;
    ctx.drawImage(v, 0, 0, w, h);
    canvas.toBlob(
      (b) => {
        if (!b) return;
        // Stub: upload as a poster/thumb-style image is out of scope; for now show toast.
        toast.success("Photo captured");
        const url = URL.createObjectURL(b);
        const a = document.createElement("a");
        a.href = url;
        a.download = `zingcam-${Date.now()}.jpg`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      },
      "image/jpeg",
      0.95,
    );
  }, [facing, filter]);

  /* ------------------------------- text mode post ------------------------------- */

  const TEXT_BGS = [
    "linear-gradient(135deg,#ff2bd6,#7a2bff,#22d3ee)",
    "linear-gradient(135deg,#22d3ee,#0ea5e9,#6366f1)",
    "linear-gradient(135deg,#f59e0b,#ef4444,#ec4899)",
    "linear-gradient(135deg,#10b981,#22d3ee,#3b82f6)",
    "linear-gradient(135deg,#111827,#374151,#111827)",
  ];

  const postText = useCallback(async () => {
    if (!textPost.trim()) return toast.error("Write something first");
    setBusy(true);
    try {
      // Render text card -> image -> wrap as a 3s mp4? Simpler: post as image-only video isn't supported.
      // For now, render to PNG and download; deeper integration is future work.
      const w = 1080,
        h = 1920;
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d")!;
      // gradient
      const grads = TEXT_BGS[textBg]
        .replace(/linear-gradient\(135deg,/, "")
        .replace(/\)$/, "")
        .split(",")
        .map((s) => s.trim());
      const g = ctx.createLinearGradient(0, 0, w, h);
      grads.forEach((c, i) => g.addColorStop(i / (grads.length - 1), c));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "white";
      ctx.font = "700 88px Space Grotesk, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const lines = wrapText(ctx, textPost.trim(), w - 160);
      const lh = 110;
      lines.forEach((ln, i) =>
        ctx.fillText(ln, w / 2, h / 2 + (i - (lines.length - 1) / 2) * lh),
      );
      canvas.toBlob((b) => {
        if (!b) return;
        const url = URL.createObjectURL(b);
        const a = document.createElement("a");
        a.href = url;
        a.download = `zingcam-text-${Date.now()}.png`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        toast.success("Text card saved");
        setBusy(false);
      }, "image/png");
    } catch (e) {
      console.error(e);
      setBusy(false);
    }
  }, [textBg, textPost]);

  /* ------------------------------- gesture handlers ------------------------------- */

  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && zoomCaps) {
      const [a, b] = [e.touches[0], e.touches[1]];
      const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      pinchStartRef.current = { dist, zoom };
    }
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchStartRef.current && zoomCaps) {
      const [a, b] = [e.touches[0], e.touches[1]];
      const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      const scale = dist / pinchStartRef.current.dist;
      const next = Math.max(
        zoomCaps.min,
        Math.min(zoomCaps.max, pinchStartRef.current.zoom * scale),
      );
      setZoom(next);
    }
  };
  const onTouchEnd = () => (pinchStartRef.current = null);

  const onPreviewTap = (e: React.MouseEvent) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * 100;
    const y = ((e.clientY - r.top) / r.height) * 100;
    setFocusPt({ x, y, t: Date.now() });
    setShowExposure(true);
    // Best-effort focus via constraints
    const track = streamRef.current?.getVideoTracks()[0];
    track
      ?.applyConstraints({
        advanced: [
          { focusMode: "single-shot" } as MediaTrackConstraintSet,
        ],
      })
      .catch(() => {});
    setTimeout(() => setFocusPt(null), 1200);
  };

  /* ----------------------------- gallery picker ----------------------------- */

  const galleryRef = useRef<HTMLInputElement>(null);
  const onPickFromGallery = (f?: File | null) => {
    if (!f) return;
    setPendingCapture(f);
    navigate({ to: "/upload" });
  };

  /* ----------------------------------- render ----------------------------------- */

  const previewFilter = `${filter.css === "none" ? "" : filter.css} ${
    beauty ? "blur(0.4px) saturate(1.08) brightness(1.04) contrast(1.02)" : ""
  } brightness(${1 + exposure * 0.18})`;

  const progressPct = mode.maxMs ? Math.min(100, (elapsed / mode.maxMs) * 100) : 0;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-black text-white select-none"
      style={{ touchAction: "none" }}
    >
      {/* Preview surface */}
      <div
        className="absolute inset-0"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onClick={isTextMode ? undefined : onPreviewTap}
      >
        {isTextMode ? (
          <div
            className="absolute inset-0 flex items-center justify-center px-8"
            style={{ background: TEXT_BGS[textBg] }}
          >
            <textarea
              value={textPost}
              onChange={(e) => setTextPost(e.target.value)}
              placeholder="Tap to type…"
              maxLength={180}
              className="w-full max-w-md resize-none bg-transparent text-center font-display text-3xl font-bold leading-tight placeholder:text-white/60 focus:outline-none"
              rows={4}
              autoFocus
            />
          </div>
        ) : (
          <video
            ref={videoRef}
            playsInline
            muted
            className="h-full w-full object-cover transition-[filter] duration-300"
            style={{
              filter: previewFilter,
              transform: facing === "user" ? "scaleX(-1)" : undefined,
            }}
          />
        )}

        {/* Grid */}
        {grid && !isTextMode && (
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute inset-0 grid grid-cols-3">
              {[0, 1].map((i) => (
                <div key={`v${i}`} className="border-r border-white/25" />
              ))}
              <div />
            </div>
            <div className="absolute inset-0 grid grid-rows-3">
              {[0, 1].map((i) => (
                <div key={`h${i}`} className="border-b border-white/25" />
              ))}
              <div />
            </div>
          </div>
        )}

        {/* Tap-to-focus reticle */}
        {focusPt && (
          <div
            className="pointer-events-none absolute h-20 w-20 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-cyan-glow animate-scale-in"
            style={{ left: `${focusPt.x}%`, top: `${focusPt.y}%`, boxShadow: "0 0 24px rgba(34,211,238,0.6)" }}
          />
        )}

        {/* Countdown overlay */}
        {countdown > 0 && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/30 backdrop-blur-sm">
            <span className="font-display text-[140px] font-bold leading-none animate-scale-in">
              {countdown}
            </span>
          </div>
        )}
      </div>

      {/* Vignette */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_80%_at_50%_50%,transparent_55%,rgba(0,0,0,0.55))]" />

      {/* Top bar */}
      <div
        className="relative z-10 flex items-center justify-between px-4 pt-3"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 12px)" }}
      >
        <button
          onClick={() => navigate({ to: "/feed" })}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-black/40 backdrop-blur-md active:scale-95"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>

        <button
          onClick={() => toast.info("Sound library coming soon")}
          className="flex items-center gap-2 rounded-full bg-black/40 px-4 py-2 text-sm font-semibold backdrop-blur-md active:scale-95"
        >
          <Music2 className="h-4 w-4" />
          Add sound
        </button>

        <div className="flex h-10 w-10 items-center justify-center" />
      </div>

      {/* Right rail */}
      {!isTextMode && (
        <div className="absolute right-3 top-20 z-10 flex flex-col items-center gap-3">
          <RailBtn
            label="Flip"
            icon={<SwitchCamera className="h-5 w-5" />}
            onClick={() => setFacing((f) => (f === "user" ? "environment" : "user"))}
          />
          <RailBtn
            label={flashOn ? "Flash" : "Flash"}
            icon={flashOn ? <Zap className="h-5 w-5" /> : <ZapOff className="h-5 w-5" />}
            active={flashOn}
            onClick={() => setFlashOn((v) => !v)}
            dim={!hasTorch && facing === "environment"}
          />
          <RailBtn
            label="Beauty"
            icon={<Sparkles className="h-5 w-5" />}
            active={beauty}
            onClick={() => setBeauty((v) => !v)}
          />
          <RailBtn
            label="Filters"
            icon={<Wand2 className="h-5 w-5" />}
            active={showFilters}
            onClick={() => setShowFilters((v) => !v)}
          />
          <RailBtn
            label={timer === 0 ? "Timer" : `${timer}s`}
            icon={<Timer className="h-5 w-5" />}
            active={timer !== 0}
            onClick={() => {
              const i = TIMERS.indexOf(timer);
              setTimer(TIMERS[(i + 1) % TIMERS.length]);
            }}
          />
          <RailBtn
            label="Grid"
            icon={<LayoutGrid className="h-5 w-5" />}
            active={grid}
            onClick={() => setGrid((v) => !v)}
          />
        </div>
      )}

      {/* Exposure slider (after tap-to-focus) */}
      {showExposure && !isTextMode && (
        <div className="absolute right-20 top-32 z-10 flex h-48 flex-col items-center">
          <input
            type="range"
            min={-2}
            max={2}
            step={0.1}
            value={exposure}
            onChange={(e) => setExposure(parseFloat(e.target.value))}
            className="h-44 w-1 accent-[var(--zing)]"
            style={{
              writingMode: "vertical-lr" as unknown as undefined,
              WebkitAppearance: "slider-vertical",
            }}
          />
          <span className="mt-1 text-[10px] text-white/80">EV {exposure.toFixed(1)}</span>
        </div>
      )}

      {/* Top progress bar while recording */}
      {recording && mode.maxMs && (
        <div className="absolute left-0 right-0 top-0 z-10 h-1 bg-white/15">
          <div className="h-full gradient-zing transition-[width] duration-100" style={{ width: `${progressPct}%` }} />
        </div>
      )}

      {/* Filter strip */}
      {showFilters && !isTextMode && (
        <div className="absolute bottom-[230px] left-0 right-0 z-10 px-4">
          <div className="scrollbar-none flex gap-3 overflow-x-auto pb-2">
            {FILTERS.map((f, i) => (
              <button
                key={f.id}
                onClick={() => setFilterIdx(i)}
                className={`flex shrink-0 flex-col items-center gap-1 transition ${
                  i === filterIdx ? "scale-105" : "opacity-80"
                }`}
              >
                <div
                  className={`h-14 w-14 overflow-hidden rounded-2xl border-2 ${
                    i === filterIdx ? "border-[var(--zing)] shadow-zing" : "border-white/20"
                  }`}
                  style={{
                    filter: f.css === "none" ? "none" : f.css,
                    background:
                      "linear-gradient(135deg,#fda4af,#fde68a,#a5f3fc,#c4b5fd)",
                  }}
                />
                <span className="text-[10px] font-medium">{f.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Text mode background swatches */}
      {isTextMode && (
        <div className="absolute bottom-[230px] left-0 right-0 z-10 px-4">
          <div className="scrollbar-none flex gap-3 overflow-x-auto pb-2">
            {TEXT_BGS.map((bg, i) => (
              <button
                key={i}
                onClick={() => setTextBg(i)}
                className={`h-12 w-12 shrink-0 rounded-2xl border-2 ${
                  i === textBg ? "border-white shadow-zing" : "border-white/30"
                }`}
                style={{ background: bg }}
                aria-label={`Background ${i + 1}`}
              />
            ))}
          </div>
        </div>
      )}

      {/* Bottom controls */}
      <div
        className="relative z-10 mt-auto px-4 pb-6"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 20px)" }}
      >
        {/* Mode picker */}
        <div className="mb-4 flex justify-center">
          <div className="scrollbar-none flex max-w-full gap-5 overflow-x-auto px-6 text-sm font-semibold">
            {MODES.map((m, i) => (
              <button
                key={m.id}
                onClick={() => !recording && setModeIdx(i)}
                className={`relative shrink-0 py-1 transition ${
                  i === modeIdx ? "text-white" : "text-white/55"
                }`}
              >
                {m.label}
                {i === modeIdx && (
                  <span className="absolute -bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-white" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Action row */}
        <div className="flex items-center justify-between gap-6">
          <button
            onClick={() => galleryRef.current?.click()}
            className="flex h-14 w-14 flex-col items-center justify-center gap-0.5 rounded-2xl bg-white/10 backdrop-blur-md active:scale-95"
            aria-label="Gallery"
          >
            <ImageIcon className="h-5 w-5" />
            <span className="text-[9px] font-medium">Upload</span>
          </button>

          {/* Record / capture / post */}
          {isTextMode ? (
            <button
              onClick={postText}
              disabled={busy}
              className="flex h-[78px] w-[78px] items-center justify-center rounded-full gradient-zing shadow-zing active:scale-95 disabled:opacity-60"
              aria-label="Post text"
            >
              {busy ? <Loader2 className="h-7 w-7 animate-spin" /> : <Check className="h-8 w-8" />}
            </button>
          ) : mode.kind === "photo" ? (
            <button
              onClick={() => runCountdown(timer, capturePhoto)}
              className="group relative flex h-[88px] w-[88px] items-center justify-center"
              aria-label="Capture photo"
            >
              <span className="absolute inset-0 rounded-full border-[5px] border-white" />
              <span className="absolute inset-2 rounded-full bg-white transition group-active:scale-90" />
            </button>
          ) : (
            <button
              onClick={() => {
                if (recording) stopRecording();
                else runCountdown(timer, beginRecording);
              }}
              className="relative flex h-[92px] w-[92px] items-center justify-center"
              aria-label={recording ? "Stop" : "Record"}
            >
              {/* Outer ring */}
              <span
                className={`absolute inset-0 rounded-full border-[5px] transition-all duration-300 ${
                  recording ? "border-[var(--zing)] scale-110" : "border-white"
                }`}
              />
              {/* Progress ring (SVG) */}
              {recording && mode.maxMs && (
                <svg className="absolute inset-0 -rotate-90" viewBox="0 0 100 100">
                  <circle
                    cx="50"
                    cy="50"
                    r="46"
                    fill="none"
                    stroke="url(#zg)"
                    strokeWidth="5"
                    strokeLinecap="round"
                    strokeDasharray={`${(progressPct / 100) * (2 * Math.PI * 46)} ${2 * Math.PI * 46}`}
                  />
                  <defs>
                    <linearGradient id="zg" x1="0" x2="1" y1="0" y2="1">
                      <stop offset="0%" stopColor="#ff2bd6" />
                      <stop offset="100%" stopColor="#22d3ee" />
                    </linearGradient>
                  </defs>
                </svg>
              )}
              {/* Inner shape */}
              <span
                className={`relative gradient-zing transition-all duration-300 ${
                  recording ? "h-7 w-7 rounded-md" : "h-[68px] w-[68px] rounded-full animate-pulse-glow"
                }`}
              />
            </button>
          )}

          {/* Right slot: elapsed or hint */}
          <div className="flex h-14 w-14 flex-col items-center justify-center text-center">
            {recording ? (
              <span className="font-display text-sm font-bold tabular-nums text-[var(--zing)]">
                {formatMs(elapsed)}
              </span>
            ) : (
              <span className="text-[10px] text-white/60 leading-tight">
                {mode.kind === "video"
                  ? `Up to ${mode.label}`
                  : mode.kind === "photo"
                  ? "Tap to snap"
                  : ""}
              </span>
            )}
          </div>
        </div>

        <input
          ref={galleryRef}
          type="file"
          accept="video/*,image/*"
          className="hidden"
          onChange={(e) => onPickFromGallery(e.target.files?.[0])}
        />
      </div>

      {!ready && !isTextMode && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-black/70">
          <Loader2 className="h-7 w-7 animate-spin" />
          <p className="text-sm text-white/80">Starting camera…</p>
        </div>
      )}
    </div>
  );
}

function RailBtn({
  label,
  icon,
  onClick,
  active,
  dim,
}: {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  active?: boolean;
  dim?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-0.5 active:scale-95 transition ${
        dim ? "opacity-40" : ""
      }`}
    >
      <span
        className={`flex h-11 w-11 items-center justify-center rounded-full backdrop-blur-md transition ${
          active ? "gradient-zing shadow-zing" : "bg-black/45"
        }`}
      >
        {icon}
      </span>
      <span className="text-[10px] font-medium drop-shadow">{label}</span>
    </button>
  );
}

function formatMs(ms: number) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const rs = s % 60;
  const ds = Math.floor((ms % 1000) / 100);
  return m > 0 ? `${m}:${String(rs).padStart(2, "0")}` : `${rs}.${ds}s`;
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else line = test;
  }
  if (line) lines.push(line);
  return lines.slice(0, 8);
}
