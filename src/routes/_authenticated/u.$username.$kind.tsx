import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, BadgeCheck, UserPlus, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { UserAvatar } from "@/components/user-avatar";
import { Route as AuthRoute } from "../_authenticated/route";

type Kind = "followers" | "following";

export const Route = createFileRoute("/_authenticated/u/$username/$kind")({
  head: ({ params }) => ({ meta: [{ title: `@${params.username} · ${params.kind} — ZingChatX` }] }),
  beforeLoad: ({ params }) => {
    if (params.kind !== "followers" && params.kind !== "following") throw notFound();
  },
  component: FollowListPage,
});

function FollowListPage() {
  const { username, kind } = Route.useParams() as { username: string; kind: Kind };
  const { user } = AuthRoute.useRouteContext();
  const meId = user!.id;
  const queryClient = useQueryClient();

  const { data: profile } = useQuery({
    queryKey: ["user", username],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, username, verified").eq("username", username).maybeSingle();
      if (error) throw error;
      if (!data) throw notFound();
      return data;
    },
  });

  const { data: list = [] } = useQuery({
    queryKey: ["follow-list", profile?.id, kind, meId],
    enabled: !!profile,
    queryFn: async () => {
      const col = kind === "followers" ? "follower_id" : "following_id";
      const fk = kind === "followers" ? "follows_follower_profiles_fkey" : "follows_following_profiles_fkey";
      const filterCol = kind === "followers" ? "following_id" : "follower_id";
      const { data } = await supabase
        .from("follows")
        .select(`${col}, profiles!${fk}(id, username, display_name, avatar_url, verified)`)
        .eq(filterCol, profile!.id)
        .order("created_at", { ascending: false })
        .limit(500);
      const users = (data ?? [])
        .map((r) => (Array.isArray(r.profiles) ? r.profiles[0] : r.profiles))
        .filter((p): p is { id: string; username: string; display_name: string | null; avatar_url: string | null; verified: boolean } => !!p);
      const ids = users.map((u) => u.id);
      const followsMe = ids.length
        ? await supabase.from("follows").select("following_id").eq("follower_id", meId).in("following_id", ids)
        : { data: [] as { following_id: string }[] };
      const myFollowing = new Set((followsMe.data ?? []).map((f) => f.following_id));
      return users.map((u) => ({ ...u, isFollowing: myFollowing.has(u.id) }));
    },
  });

  useEffect(() => {
    if (!profile) return;
    const ch = supabase
      .channel(`follow-list-${profile.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "follows" },
        () => queryClient.invalidateQueries({ queryKey: ["follow-list", profile.id, kind, meId] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [profile, kind, meId, queryClient]);

  async function toggle(targetId: string, isFollowing: boolean) {
    if (targetId === meId) return toast.error("You can't follow yourself");
    if (isFollowing) {
      const { error } = await supabase.from("follows").delete().eq("follower_id", meId).eq("following_id", targetId);
      if (error) toast.error(error.message);
    } else {
      const { error } = await supabase.from("follows").insert({ follower_id: meId, following_id: targetId });
      if (error && !/duplicate/i.test(error.message)) toast.error(error.message);
    }
    queryClient.invalidateQueries({ queryKey: ["follow-list", profile?.id, kind, meId] });
  }

  return (
    <div className="mx-auto max-w-[480px] px-4 pt-4 pb-8">
      <div className="flex items-center gap-2">
        <Link to="/u/$username" params={{ username }} className="rounded-full p-2 hover:bg-surface"><ArrowLeft className="h-5 w-5" /></Link>
        <h1 className="flex items-center gap-1 font-display text-lg font-bold">
          @{username}
          {profile?.verified && <BadgeCheck className="h-4 w-4 text-primary" strokeWidth={2.5} />}
        </h1>
      </div>

      <div className="mt-3 flex border-b border-border">
        <TabLink username={username} kind="followers" active={kind === "followers"}>Followers</TabLink>
        <TabLink username={username} kind="following" active={kind === "following"}>Following</TabLink>
      </div>

      <div className="mt-3 space-y-1">
        {list.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted-foreground">
            {kind === "followers" ? "No followers yet." : "Not following anyone yet."}
          </p>
        ) : (
          list.map((u) => (
            <div key={u.id} className="flex items-center gap-3 rounded-2xl px-2 py-2 hover:bg-surface">
              <Link to="/u/$username" params={{ username: u.username }} className="flex flex-1 items-center gap-3 min-w-0">
                <UserAvatar username={u.username} avatarUrl={u.avatar_url} verified={u.verified} size="md" linkTo={false} />
                <div className="min-w-0">
                  <p className="flex items-center gap-1 truncate text-sm font-semibold">
                    @{u.username}
                    {u.verified && <BadgeCheck className="h-3.5 w-3.5 text-primary" strokeWidth={2.5} />}
                  </p>
                  {u.display_name && <p className="truncate text-xs text-muted-foreground">{u.display_name}</p>}
                </div>
              </Link>
              {u.id !== meId && (
                <button
                  onClick={() => toggle(u.id, u.isFollowing)}
                  className={`flex items-center gap-1 rounded-full px-4 py-1.5 text-xs font-semibold active:scale-95 ${
                    u.isFollowing
                      ? "border border-border bg-surface text-foreground"
                      : "gradient-zing text-zing-foreground shadow-zing"
                  }`}
                >
                  {u.isFollowing ? <><UserCheck className="h-3.5 w-3.5" /> Following</> : <><UserPlus className="h-3.5 w-3.5" /> Follow</>}
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function TabLink({ username, kind, active, children }: { username: string; kind: Kind; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      to="/u/$username/$kind"
      params={{ username, kind }}
      className={`flex-1 border-b-2 py-2 text-center text-sm font-semibold ${active ? "border-primary text-foreground" : "border-transparent text-muted-foreground"}`}
    >
      {children}
    </Link>
  );
}
