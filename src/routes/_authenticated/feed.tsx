import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchFeed } from "@/lib/videos";
import { VideoCard } from "@/components/video-card";
import { CommentsSheet } from "@/components/comments-sheet";
import { ShareSheet, type PlayerSettings } from "@/components/share-sheet";
import { Sparkles, Loader2 } from "lucide-react";
import { Route as AuthRoute } from "../_authenticated/route";
import type { FeedVideo } from "@/lib/videos";
import { LiveRing } from "@/components/live-ring";

export const Route = createFileRoute("/_authenticated/feed")({
  head: () => ({
    meta: [
      { title: "ZingChatX — For You" },
      { name: "description", content: "Endless short videos." },
    ],
  }),
  component: FeedPage,
});

const DEFAULT_SETTINGS: PlayerSettings = {
  autoScroll: false,
  clearDisplay: false,
  dataSaver: false,
  playbackSpeed: 1,
};

function FeedPage() {
  const { user } = AuthRoute.useRouteContext();
  const userId = user?.id ?? null;

  const { data: videos = [], isLoading } = useQuery({
    queryKey: ["feed", userId],
    queryFn: () => fetchFeed(userId),
    staleTime: 30_000,
  });

  const [activeIndex, setActiveIndex] = useState(0);
  const [commentsFor, setCommentsFor] = useState<string | null>(null);
  const [shareFor, setShareFor] = useState<FeedVideo | null>(null);
  const [settings, setSettings] = useState<PlayerSettings>(DEFAULT_SETTINGS);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) {
          const idx = Number((visible.target as HTMLElement).dataset.index);
          if (!Number.isNaN(idx)) setActiveIndex(idx);
        }
      },
      { root: el, threshold: [0.5, 0.75] },
    );
    el.querySelectorAll("[data-index]").forEach((c) => observer.observe(c));
    return () => observer.disconnect();
  }, [videos.length]);

  function scrollToIndex(i: number) {
    const el = containerRef.current;
    if (!el) return;
    const target = el.querySelector(`[data-index="${i}"]`) as HTMLElement | null;
    target?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <>
      <div className="fixed top-0 left-1/2 z-30 flex w-full max-w-[480px] -translate-x-1/2 flex-col gap-1 pt-3" style={{ paddingTop: "calc(env(safe-area-inset-top, 0) + 0.5rem)" }}>
        <div className="mx-auto flex items-center gap-2 rounded-full bg-black/40 px-4 py-1.5 backdrop-blur-md">
          <Sparkles className="h-3.5 w-3.5 text-cyan-glow" />
          <span className="font-display text-sm font-semibold text-white">For You</span>
        </div>
        <div className="pointer-events-auto"><LiveRing /></div>
      </div>


      <div
        ref={containerRef}
        className="h-[100dvh] w-full snap-y-mandatory overflow-y-scroll scrollbar-none"
      >
        {isLoading ? (
          <div className="flex h-[100dvh] items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : videos.length === 0 ? (
          <EmptyFeed />
        ) : (
          videos.map((v, i) => (
            <div key={v.id} data-index={i}>
              <VideoCard
                video={v}
                active={i === activeIndex}
                currentUserId={userId}
                settings={settings}
                onOpenComments={setCommentsFor}
                onOpenShare={setShareFor}
                onEnded={() => scrollToIndex(i + 1)}
              />
            </div>
          ))
        )}
      </div>

      <CommentsSheet videoId={commentsFor} currentUserId={userId} onClose={() => setCommentsFor(null)} />
      <ShareSheet
        video={shareFor}
        currentUserId={userId}
        settings={settings}
        onSettingsChange={setSettings}
        onClose={() => setShareFor(null)}
      />
    </>
  );
}

function EmptyFeed() {
  return (
    <div className="flex h-[100dvh] flex-col items-center justify-center px-8 text-center">
      <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-3xl gradient-zing shadow-zing animate-pulse-glow">
        <Sparkles className="h-10 w-10 text-zing-foreground" />
      </div>
      <h2 className="font-display text-2xl font-bold">No videos yet</h2>
      <p className="mt-2 max-w-xs text-sm text-muted-foreground">
        Be the first to share something. Tap the upload button to post your first ZingChatX.
      </p>
    </div>
  );
}
