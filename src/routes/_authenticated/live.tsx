import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Radio, Users, Loader2, Video } from "lucide-react";
import { fetchLiveStreams } from "@/lib/live";
import { UserAvatar } from "@/components/user-avatar";

export const Route = createFileRoute("/_authenticated/live")({
  head: () => ({
    meta: [
      { title: "Live — ZingChatX" },
      { name: "description", content: "Watch creators live on ZingChatX." },
    ],
  }),
  component: LiveIndex,
});

function LiveIndex() {
  const { data: streams = [], isLoading } = useQuery({
    queryKey: ["live", "all"],
    queryFn: fetchLiveStreams,
    refetchInterval: 15_000,
  });

  return (
    <div className="mx-auto max-w-[480px] px-4 pt-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold flex items-center gap-2">
            <Radio className="h-6 w-6 text-red-500 animate-pulse" /> Live now
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{streams.length} creator{streams.length === 1 ? "" : "s"} streaming</p>
        </div>
        <Link
          to="/live/host"
          className="flex items-center gap-1.5 rounded-full gradient-zing px-4 py-2 text-xs font-semibold text-zing-foreground shadow-zing"
        >
          <Video className="h-3.5 w-3.5" /> Go Live
        </Link>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : streams.length === 0 ? (
        <div className="mt-16 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-surface-elevated">
            <Radio className="h-8 w-8 text-muted-foreground" />
          </div>
          <p className="font-display font-semibold">No one is live right now</p>
          <p className="mt-1 text-sm text-muted-foreground">Be the first to go live.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {streams.map((s) => (
            <Link
              key={s.id}
              to="/live/$streamId"
              params={{ streamId: s.id }}
              className="group relative aspect-[9/13] overflow-hidden rounded-2xl bg-surface-elevated"
            >
              {s.thumbnail_url ? (
                <img src={s.thumbnail_url} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="h-full w-full bg-gradient-to-br from-primary/40 to-cyan-500/30" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20" />
              <span className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-bold text-white">
                <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" /> LIVE
              </span>
              <span className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur">
                <Users className="h-3 w-3" /> {s.viewer_count}
              </span>
              <div className="absolute bottom-2 left-2 right-2">
                <div className="flex items-center gap-2">
                  <UserAvatar
                    username={s.host?.username}
                    avatarUrl={s.host?.avatar_url}
                    verified={s.host?.verified}
                    size="sm"
                    linkTo={false}
                  />
                  <div className="min-w-0">
                    <p className="line-clamp-1 text-xs font-semibold text-white">@{s.host?.username}</p>
                    {s.title ? <p className="line-clamp-1 text-[10px] text-white/70">{s.title}</p> : null}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
