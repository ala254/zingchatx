import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Search, TrendingUp, Hash } from "lucide-react";

export const Route = createFileRoute("/_authenticated/explore")({
  head: () => ({ meta: [{ title: "Explore — ZingChatX" }] }),
  component: ExplorePage,
});

type ExploreVideo = {
  id: string;
  thumbnail_url: string | null;
  video_url: string;
  caption: string | null;
  hashtags: string[] | null;
  username: string | null;
};

function ExplorePage() {
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);

  const { data: videos = [] } = useQuery({
    queryKey: ["explore-videos", debounced],
    queryFn: async (): Promise<ExploreVideo[]> => {
      let query = supabase
        .from("videos")
        .select("id, thumbnail_url, video_url, caption, hashtags, profiles!videos_user_id_profiles_fkey(username)")
        .order("created_at", { ascending: false })
        .limit(60);
      if (debounced) {
        const tag = debounced.replace(/^#/, "").toLowerCase();
        query = query.or(`caption.ilike.%${debounced}%,hashtags.cs.{${tag}}`);
      }
      const { data } = await query;
      return (data ?? []).map((v) => ({
        id: v.id,
        thumbnail_url: v.thumbnail_url,
        video_url: v.video_url,
        caption: v.caption,
        hashtags: v.hashtags,
        username: (Array.isArray(v.profiles) ? v.profiles[0]?.username : v.profiles?.username) ?? null,
      }));
    },
  });

  const { data: users = [] } = useQuery({
    queryKey: ["explore-users", debounced],
    queryFn: async () => {
      if (!debounced) return [];
      const { data } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url")
        .or(`username.ilike.%${debounced}%,display_name.ilike.%${debounced}%`)
        .limit(10);
      return data ?? [];
    },
    enabled: !!debounced,
  });

  const trendingHashtags = useMemo(() => {
    const counts = new Map<string, number>();
    videos.forEach((v) => v.hashtags?.forEach((h) => counts.set(h, (counts.get(h) ?? 0) + 1)));
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  }, [videos]);

  return (
    <div className="mx-auto max-w-[480px] px-4 pt-4">
      <h1 className="font-display text-2xl font-bold">Explore</h1>

      <label className="mt-4 flex items-center gap-2 rounded-full border border-border bg-surface px-4 py-2.5">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search videos, hashtags, users"
          className="flex-1 bg-transparent text-sm focus:outline-none"
        />
      </label>

      {users.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Users</h2>
          <div className="space-y-1">
            {users.map((u) => (
              <Link
                key={u.id}
                to="/u/$username"
                params={{ username: u.username }}
                className="flex items-center gap-3 rounded-2xl px-3 py-2 hover:bg-surface"
              >
                <div className="h-10 w-10 overflow-hidden rounded-full bg-secondary">
                  {u.avatar_url ? <img src={u.avatar_url} alt="" className="h-full w-full object-cover" /> : (
                    <div className="flex h-full w-full items-center justify-center text-sm font-bold">{u.username[0].toUpperCase()}</div>
                  )}
                </div>
                <div>
                  <p className="text-sm font-semibold">@{u.username}</p>
                  {u.display_name && <p className="text-xs text-muted-foreground">{u.display_name}</p>}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {trendingHashtags.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <TrendingUp className="h-3.5 w-3.5" /> Trending
          </h2>
          <div className="flex flex-wrap gap-2">
            {trendingHashtags.map(([tag, count]) => (
              <button
                key={tag}
                onClick={() => setQ("#" + tag)}
                className="flex items-center gap-1 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-medium text-foreground hover:border-primary"
              >
                <Hash className="h-3 w-3 text-cyan-glow" />
                {tag}
                <span className="text-muted-foreground">· {count}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="mt-6 pb-8">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Videos</h2>
        {videos.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Nothing to show yet.</p>
        ) : (
          <div className="grid grid-cols-3 gap-1">
            {videos.map((v) => (
              <Link
                key={v.id}
                to="/feed"
                className="relative aspect-[9/16] overflow-hidden rounded-lg bg-surface"
              >
                {v.thumbnail_url ? (
                  <img src={v.thumbnail_url} alt="" className="h-full w-full object-cover" loading="lazy" />
                ) : (
                  <video src={v.video_url} className="h-full w-full object-cover" muted preload="metadata" />
                )}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-1.5">
                  <p className="truncate text-[10px] font-medium text-white">@{v.username}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
