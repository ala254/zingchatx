import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Pin, MoreVertical } from "lucide-react";

export type LiveComment = {
  id: string;
  stream_id: string;
  user_id: string;
  content: string;
  is_pinned: boolean;
  created_at: string;
  profile?: { username: string; display_name: string | null; avatar_url: string | null } | null;
};

export function LiveComments({
  streamId,
  isStaff,
  onLongPress,
}: {
  streamId: string;
  isStaff: boolean;
  onLongPress?: (c: LiveComment) => void;
}) {
  const [comments, setComments] = useState<LiveComment[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase
        .from("live_comments")
        .select("*, profile:profiles!live_comments_user_id_fkey(username, display_name, avatar_url)")
        .eq("stream_id", streamId)
        .order("created_at", { ascending: false })
        .limit(60);
      if (mounted && data) setComments((data as unknown as LiveComment[]).reverse());
    })();
    const channel = supabase
      .channel(`live-comments-${streamId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "live_comments", filter: `stream_id=eq.${streamId}` },
        async (payload) => {
          const row = payload.new as LiveComment;
          const { data: p } = await supabase
            .from("profiles")
            .select("username, display_name, avatar_url")
            .eq("id", row.user_id)
            .maybeSingle();
          setComments((cs) => [...cs, { ...row, profile: p }].slice(-100));
          requestAnimationFrame(() => scrollRef.current?.scrollTo({ top: 1e9, behavior: "smooth" }));
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "live_comments", filter: `stream_id=eq.${streamId}` },
        (payload) => {
          const row = payload.new as LiveComment;
          setComments((cs) => cs.map((c) => (c.id === row.id ? { ...c, ...row } : c)));
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "live_comments", filter: `stream_id=eq.${streamId}` },
        (payload) => {
          const row = payload.old as LiveComment;
          setComments((cs) => cs.filter((c) => c.id !== row.id));
        },
      )
      .subscribe();
    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [streamId]);

  const pinned = comments.find((c) => c.is_pinned);
  const rest = comments.filter((c) => !c.is_pinned).slice(-30);

  return (
    <div className="flex h-full flex-col justify-end">
      {pinned ? (
        <div className="mb-2 mr-16 flex items-start gap-2 rounded-2xl bg-primary/20 px-3 py-2 backdrop-blur">
          <Pin className="h-3.5 w-3.5 shrink-0 text-primary" />
          <div className="text-xs text-white">
            <span className="font-semibold">@{pinned.profile?.username ?? "user"}</span>{" "}
            <span className="text-white/90">{pinned.content}</span>
          </div>
        </div>
      ) : null}
      <div ref={scrollRef} className="mr-16 max-h-[46vh] space-y-1.5 overflow-y-auto scrollbar-none pr-1">
        {rest.map((c) => (
          <button
            key={c.id}
            onClick={() => (isStaff && onLongPress ? onLongPress(c) : undefined)}
            className="block w-full text-left"
          >
            <div className="inline-flex max-w-full items-start gap-2 rounded-2xl bg-black/40 px-3 py-1.5 backdrop-blur-sm">
              <span className="text-xs font-semibold text-cyan-300">@{c.profile?.username ?? "user"}</span>
              <span className="text-xs text-white">{c.content}</span>
              {isStaff ? <MoreVertical className="ml-1 h-3 w-3 shrink-0 opacity-40" /> : null}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
