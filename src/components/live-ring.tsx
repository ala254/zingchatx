import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { UserAvatar } from "@/components/user-avatar";
import { fetchLiveStreams, type LiveStream } from "@/lib/live";
import { Radio } from "lucide-react";

export function LiveRing() {
  const [streams, setStreams] = useState<LiveStream[]>([]);

  useEffect(() => {
    let mounted = true;
    fetchLiveStreams().then((s) => mounted && setStreams(s.slice(0, 15))).catch(() => {});
    const ch = supabase
      .channel("live-ring")
      .on("postgres_changes", { event: "*", schema: "public", table: "live_streams" }, async () => {
        const s = await fetchLiveStreams();
        if (mounted) setStreams(s.slice(0, 15));
      })
      .subscribe();
    return () => {
      mounted = false;
      supabase.removeChannel(ch);
    };
  }, []);

  if (streams.length === 0) return null;

  return (
    <div className="flex gap-3 overflow-x-auto scrollbar-none px-4 py-3">
      {streams.map((s) => (
        <Link
          key={s.id}
          to="/live/$streamId"
          params={{ streamId: s.id }}
          className="flex w-16 shrink-0 flex-col items-center"
        >
          <div className="relative rounded-full p-[2px] gradient-zing shadow-zing">
            <div className="rounded-full bg-background p-[2px]">
              <UserAvatar
                username={s.host?.username}
                avatarUrl={s.host?.avatar_url}
                verified={s.host?.verified}
                size="md"
                linkTo={false}
              />
            </div>
            <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-red-500 px-1.5 py-[1px] text-[9px] font-bold text-white shadow">
              LIVE
            </span>
          </div>
          <span className="mt-2 line-clamp-1 max-w-full text-[10px] text-muted-foreground">
            @{s.host?.username}
          </span>
        </Link>
      ))}
      <Link to="/live" className="flex w-16 shrink-0 flex-col items-center">
        <div className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-surface-elevated">
          <Radio className="h-4 w-4 text-primary" />
        </div>
        <span className="mt-2 text-[10px] text-muted-foreground">All live</span>
      </Link>
    </div>
  );
}
