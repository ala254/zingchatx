import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { signOne } from "@/lib/videos";
import { ZingWatermark } from "@/components/zing-watermark";
import { ShareSheet, type PlayerSettings } from "@/components/share-sheet";
import { Sparkles, Loader2, Download as DownloadIcon, Share2 } from "lucide-react";

type PublicVideo = {
  id: string;
  user_id: string;
  caption: string | null;
  video_url: string;
  thumbnail_url: string | null;
  profile: { username: string; display_name: string | null; avatar_url: string | null } | null;
};

async function fetchPublicVideo(id: string): Promise<PublicVideo | null> {
  const { data, error } = await supabase
    .from("videos")
    .select(
      "id, user_id, caption, video_url, thumbnail_url, profiles!videos_user_id_profiles_fkey(username, display_name, avatar_url)",
    )
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  const [videoUrl, thumbUrl] = await Promise.all([
    signOne("videos", data.video_url),
    signOne("thumbnails", data.thumbnail_url),
  ]);
  return {
    id: data.id,
    user_id: data.user_id,
    caption: data.caption,
    video_url: videoUrl ?? data.video_url,
    thumbnail_url: thumbUrl ?? data.thumbnail_url,
    profile: Array.isArray(data.profiles) ? data.profiles[0] ?? null : data.profiles,
  };
}

export const Route = createFileRoute("/v/$videoId")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Watch on ZingChatX" },
      { name: "description", content: "A short video on ZingChatX." },
      { property: "og:type", content: "video.other" },
      { property: "og:site_name", content: "ZingChatX" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: WatchPage,
});

const DEFAULT_SETTINGS: PlayerSettings = {
  autoScroll: false,
  clearDisplay: false,
  dataSaver: false,
  playbackSpeed: 1,
};

function WatchPage() {
  const { videoId } = Route.useParams();
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [settings, setSettings] = useState<PlayerSettings>(DEFAULT_SETTINGS);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  const { data: video, isLoading } = useQuery({
    queryKey: ["public-video", videoId],
    queryFn: () => fetchPublicVideo(videoId),
  });

  useEffect(() => {
    if (videoRef.current) videoRef.current.playbackRate = settings.playbackSpeed;
  }, [settings.playbackSpeed, video]);

  // best-effort app-deep-link / store-fallback for mobile UA (no native app yet so it's a no-op redirect)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("app") !== "1") return;
    const ua = navigator.userAgent || "";
    const isAndroid = /Android/i.test(ua);
    const isiOS = /iPhone|iPad|iPod/i.test(ua);
    if (!isAndroid && !isiOS) return;
    const storeUrl = isAndroid
      ? "https://play.google.com/store/apps/details?id=com.zingchatx.app"
      : "https://apps.apple.com/app/zingchatx/id000000000";
    // Try a deep link first; fall back to the store after a short delay.
    const deep = `zingchatx://video/${videoId}`;
    window.location.href = deep;
    const t = window.setTimeout(() => {
      window.location.href = storeUrl;
    }, 1500);
    return () => window.clearTimeout(t);
  }, [videoId]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!video) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-black px-6 text-center text-white">
        <Sparkles className="h-10 w-10 text-primary" />
        <h1 className="font-display text-2xl font-bold">Video not found</h1>
        <p className="text-sm text-white/70">It may have been removed or made private.</p>
        <Link
          to="/feed"
          className="mt-2 rounded-full gradient-zing px-5 py-2.5 text-sm font-semibold text-zing-foreground shadow-zing"
        >
          Open ZingChatX
        </Link>
      </div>
    );
  }

  // Convert the FeedVideo-shaped object expected by ShareSheet
  const feedShape = {
    id: video.id,
    user_id: video.user_id,
    video_url: video.video_url,
    thumbnail_url: video.thumbnail_url,
    caption: video.caption,
    hashtags: null,
    location: null,
    created_at: "",
    profile: video.profile,
    likes_count: 0,
    comments_count: 0,
    shares_count: 0,
    liked_by_me: false,
    saved_by_me: false,
  };

  return (
    <div className="relative min-h-[100dvh] w-full bg-black">
      <div className="relative mx-auto h-[100dvh] w-full max-w-md overflow-hidden">
        <video
          ref={videoRef}
          src={video.video_url}
          poster={video.thumbnail_url ?? undefined}
          className="absolute inset-0 h-full w-full object-cover"
          controls
          playsInline
          autoPlay
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/40" />
        <ZingWatermark username={video.profile?.username} />

        {/* Top bar */}
        <div
          className="absolute left-0 right-0 top-0 z-10 flex items-center justify-between px-4 py-3"
          style={{ paddingTop: "calc(env(safe-area-inset-top, 0) + 0.5rem)" }}
        >
          <Link to="/feed" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl gradient-zing shadow-zing">
              <Sparkles className="h-4 w-4 text-zing-foreground" />
            </div>
            <span className="font-display text-sm font-semibold text-white">ZingChatX</span>
          </Link>
          <button
            onClick={() => setShareOpen(true)}
            className="rounded-full bg-white/15 p-2 backdrop-blur-md"
            aria-label="Share"
          >
            <Share2 className="h-5 w-5 text-white" />
          </button>
        </div>

        {/* Bottom info + CTA */}
        <div className="absolute bottom-6 left-0 right-0 z-10 px-4 text-white">
          <div className="text-sm font-semibold">@{video.profile?.username}</div>
          {video.caption && <p className="mt-1 text-sm leading-snug drop-shadow">{video.caption}</p>}
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => {
                if (userId) navigate({ to: "/feed" });
                else navigate({ to: "/auth", search: { mode: "signup" } });
              }}
              className="flex-1 rounded-full gradient-zing px-4 py-2.5 text-sm font-semibold text-zing-foreground shadow-zing"
            >
              {userId ? "Open in ZingChatX" : "Join ZingChatX"}
            </button>
            <button
              onClick={() => setShareOpen(true)}
              className="rounded-full bg-white/15 px-4 py-2.5 text-sm font-semibold text-white backdrop-blur"
            >
              <DownloadIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <ShareSheet
        video={shareOpen ? feedShape : null}
        currentUserId={userId}
        settings={settings}
        onSettingsChange={setSettings}
        onClose={() => setShareOpen(false)}
      />
    </div>
  );
}
