import { useEffect, useRef, useState } from "react";
import { Heart, MessageCircle, Bookmark, Share2, Music2, MapPin, Play } from "lucide-react";
import type { FeedVideo } from "@/lib/videos";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";
import { ZingWatermark } from "@/components/zing-watermark";
import type { PlayerSettings } from "@/components/share-sheet";

interface Props {
  video: FeedVideo;
  active: boolean;
  currentUserId: string | null;
  settings: PlayerSettings;
  onOpenComments: (videoId: string) => void;
  onOpenShare: (video: FeedVideo) => void;
  onEnded?: () => void;
}

export function VideoCard({
  video,
  active,
  currentUserId,
  settings,
  onOpenComments,
  onOpenShare,
  onEnded,
}: Props) {
  const ref = useRef<HTMLVideoElement>(null);
  const [liked, setLiked] = useState(video.liked_by_me);
  const [saved, setSaved] = useState(video.saved_by_me);
  const [likeCount, setLikeCount] = useState(video.likes_count);
  const [shareCount, setShareCount] = useState(video.shares_count ?? 0);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hearts, setHearts] = useState<{ id: number; x: number; y: number }[]>([]);
  const lastTap = useRef(0);
  const longPressTimer = useRef<number | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (active) {
      el.currentTime = 0;
      el.play().catch(() => {});
    } else {
      el.pause();
    }
  }, [active]);

  // apply playback rate
  useEffect(() => {
    if (ref.current) ref.current.playbackRate = settings.playbackSpeed;
  }, [settings.playbackSpeed, active]);

  // live share count
  useEffect(() => {
    const ch = supabase
      .channel(`vc-shares:${video.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "shares", filter: `video_id=eq.${video.id}` },
        () => setShareCount((c) => c + 1),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [video.id]);

  async function toggleLike() {
    if (!currentUserId) return toast("Sign in to like");
    const next = !liked;
    setLiked(next);
    setLikeCount((c) => c + (next ? 1 : -1));
    if (next) {
      await supabase.from("likes").insert({ user_id: currentUserId, video_id: video.id });
    } else {
      await supabase.from("likes").delete().eq("user_id", currentUserId).eq("video_id", video.id);
    }
  }

  async function toggleSave() {
    if (!currentUserId) return toast("Sign in to save");
    const next = !saved;
    setSaved(next);
    if (next) {
      await supabase.from("saves").insert({ user_id: currentUserId, video_id: video.id });
      toast.success("Saved");
    } else {
      await supabase.from("saves").delete().eq("user_id", currentUserId).eq("video_id", video.id);
    }
  }

  function handleTap(e: React.MouseEvent<HTMLDivElement>) {
    const now = Date.now();
    if (now - lastTap.current < 280) {
      const rect = e.currentTarget.getBoundingClientRect();
      const id = now;
      setHearts((h) => [...h, { id, x: e.clientX - rect.left, y: e.clientY - rect.top }]);
      setTimeout(() => setHearts((h) => h.filter((p) => p.id !== id)), 700);
      if (!liked) toggleLike();
    } else {
      const el = ref.current;
      if (!el) return;
      if (el.paused) { el.play(); setPaused(false); } else { el.pause(); setPaused(true); }
    }
    lastTap.current = now;
  }

  function startLongPress() {
    if (longPressTimer.current) window.clearTimeout(longPressTimer.current);
    longPressTimer.current = window.setTimeout(() => {
      onOpenShare(video);
    }, 550);
  }
  function cancelLongPress() {
    if (longPressTimer.current) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }

  return (
    <section className="relative h-[100dvh] w-full snap-start overflow-hidden bg-black">
      <video
        ref={ref}
        src={video.video_url}
        poster={video.thumbnail_url ?? undefined}
        className="absolute inset-0 h-full w-full object-cover"
        loop={!settings.autoScroll}
        playsInline
        muted={false}
        preload={settings.dataSaver ? "none" : active ? "auto" : "metadata"}
        onError={(e) => {
          const err = (e.currentTarget as HTMLVideoElement).error;
          console.error("video failed", video.id, err?.code, err?.message, video.video_url);
        }}
        onTimeUpdate={(e) => {
          const t = e.currentTarget;
          if (t.duration) setProgress((t.currentTime / t.duration) * 100);
        }}
        onEnded={() => settings.autoScroll && onEnded?.()}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/30" />

      <div
        className="absolute inset-0"
        onClick={handleTap}
        onTouchStart={startLongPress}
        onTouchEnd={cancelLongPress}
        onTouchMove={cancelLongPress}
        onMouseDown={startLongPress}
        onMouseUp={cancelLongPress}
        onMouseLeave={cancelLongPress}
      >
        {paused && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="rounded-full bg-black/40 p-5 backdrop-blur-md">
              <Play className="h-10 w-10 fill-white text-white" />
            </div>
          </div>
        )}
        {hearts.map((h) => (
          <Heart
            key={h.id}
            className="pointer-events-none absolute h-24 w-24 -translate-x-1/2 -translate-y-1/2 fill-primary text-primary animate-heart-pop"
            style={{ left: h.x, top: h.y }}
          />
        ))}
      </div>

      {/* Persistent watermark — visible during playback, baked into downloads */}
      {!settings.clearDisplay && <ZingWatermark username={video.profile?.username} />}

      {!settings.clearDisplay && (
        <>
          {/* Right action rail */}
          <div className="absolute bottom-32 right-3 z-10 flex flex-col items-center gap-5">
            <Link to="/u/$username" params={{ username: video.profile?.username ?? "" }} className="relative">
              <div className="h-12 w-12 overflow-hidden rounded-full border-2 border-white bg-surface">
                {video.profile?.avatar_url ? (
                  <img src={video.profile.avatar_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-sm font-bold text-foreground">
                    {video.profile?.username?.[0]?.toUpperCase() ?? "?"}
                  </div>
                )}
              </div>
            </Link>

            <ActionBtn icon={Heart} label={formatCount(likeCount)} active={liked} onClick={toggleLike} fillWhenActive />
            <ActionBtn icon={MessageCircle} label={formatCount(video.comments_count)} onClick={() => onOpenComments(video.id)} />
            <ActionBtn icon={Bookmark} label={saved ? "Saved" : "Save"} active={saved} onClick={toggleSave} fillWhenActive />
            <ActionBtn
              icon={Share2}
              label={shareCount > 0 ? formatCount(shareCount) : "Share"}
              onClick={() => onOpenShare(video)}
              onContextMenu={(e) => { e.preventDefault(); onOpenShare(video); }}
            />
          </div>

          {/* Bottom info */}
          <div className="absolute bottom-20 left-4 right-20 z-10 text-white">
            <Link
              to="/u/$username"
              params={{ username: video.profile?.username ?? "" }}
              className="font-display text-base font-semibold drop-shadow"
            >
              @{video.profile?.username}
            </Link>
            {video.caption && <p className="mt-1.5 text-sm leading-snug drop-shadow">{video.caption}</p>}
            {video.hashtags && video.hashtags.length > 0 && (
              <p className="mt-1 text-sm text-accent drop-shadow">
                {video.hashtags.map((h) => "#" + h).join(" ")}
              </p>
            )}
            {video.location && (
              <p className="mt-1 flex items-center gap-1 text-xs text-white/80">
                <MapPin className="h-3 w-3" /> {video.location}
              </p>
            )}
            <p className="mt-2 flex items-center gap-1.5 text-xs text-white/80">
              <Music2 className="h-3 w-3" /> Original sound · @{video.profile?.username}
            </p>
          </div>

          {/* Progress bar */}
          <div className="absolute bottom-16 left-0 right-0 z-10 h-0.5 bg-white/20">
            <div className="h-full gradient-zing transition-[width] duration-100" style={{ width: progress + "%" }} />
          </div>
        </>
      )}
    </section>
  );
}

function ActionBtn({
  icon: Icon,
  label,
  onClick,
  onContextMenu,
  active,
  fillWhenActive,
}: {
  icon: typeof Heart;
  label: string;
  onClick?: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  active?: boolean;
  fillWhenActive?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      onContextMenu={onContextMenu}
      className="flex flex-col items-center gap-1 text-white transition active:scale-90"
    >
      <div className="rounded-full bg-black/30 p-2.5 backdrop-blur-sm">
        <Icon
          className={`h-6 w-6 ${active ? (fillWhenActive ? "fill-primary text-primary" : "text-primary") : "text-white"}`}
        />
      </div>
      <span className="text-[11px] font-semibold drop-shadow">{label}</span>
    </button>
  );
}

function formatCount(n: number) {
  if (n < 1000) return n.toString();
  if (n < 1_000_000) return (n / 1000).toFixed(n < 10_000 ? 1 : 0) + "K";
  return (n / 1_000_000).toFixed(1) + "M";
}
