import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, UserPlus, UserCheck, BadgeCheck } from "lucide-react";
import { Route as AuthRoute } from "../_authenticated/route";
import { toast } from "sonner";
import { signStorageUrls } from "@/lib/videos";
import { UserAvatar } from "@/components/user-avatar";
import { useEffect } from "react";

export const Route = createFileRoute("/_authenticated/u/$username")({
  head: ({ params }) => ({
    meta: [{ title: `@${params.username} — ZingChatX` }],
  }),
  component: UserProfilePage,
});

function UserProfilePage() {
  const { username } = Route.useParams();
  const { user } = AuthRoute.useRouteContext();
  const meId = user!.id;
  const queryClient = useQueryClient();

  const { data: profile, isLoading } = useQuery({
    queryKey: ["user", username],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").eq("username", username).maybeSingle();
      if (error) throw error;
      if (!data) throw notFound();
      return data;
    },
  });

  const { data: stats } = useQuery({
    queryKey: ["user-stats", profile?.id, meId],
    enabled: !!profile,
    queryFn: async () => {
      const [followers, following, isFollowing, likesAgg] = await Promise.all([
        supabase.from("follows").select("*", { count: "exact", head: true }).eq("following_id", profile!.id),
        supabase.from("follows").select("*", { count: "exact", head: true }).eq("follower_id", profile!.id),
        supabase.from("follows").select("follower_id").eq("follower_id", meId).eq("following_id", profile!.id).maybeSingle(),
        supabase.from("likes").select("video_id, videos!inner(user_id)", { count: "exact", head: true }).eq("videos.user_id", profile!.id),
      ]);
      return {
        followers: followers.count ?? 0,
        following: following.count ?? 0,
        likes: likesAgg.count ?? 0,
        isFollowing: !!isFollowing.data,
      };
    },
  });

  // Realtime: profile edits and follow changes for this user
  useEffect(() => {
    if (!profile) return;
    const ch = supabase
      .channel(`user-${profile.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles", filter: `id=eq.${profile.id}` },
        () => queryClient.invalidateQueries({ queryKey: ["user", username] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "follows", filter: `following_id=eq.${profile.id}` },
        () => queryClient.invalidateQueries({ queryKey: ["user-stats", profile.id, meId] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "follows", filter: `follower_id=eq.${profile.id}` },
        () => queryClient.invalidateQueries({ queryKey: ["user-stats", profile.id, meId] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [profile, username, meId, queryClient]);

  const { data: videos = [] } = useQuery({
    queryKey: ["user-videos", profile?.id],
    enabled: !!profile,
    queryFn: async () => {
      const { data } = await supabase
        .from("videos").select("id, thumbnail_url, video_url").eq("user_id", profile!.id).order("created_at", { ascending: false });
      const rows = data ?? [];
      const [thumbs, vids] = await Promise.all([
        signStorageUrls("thumbnails", rows.map((r) => r.thumbnail_url)),
        signStorageUrls("videos", rows.map((r) => r.video_url)),
      ]);
      return rows.map((r, i) => ({ ...r, thumbnail_url: thumbs[i] ?? r.thumbnail_url, video_url: vids[i] ?? r.video_url }));
    },
  });

  async function toggleFollow() {
    if (!profile) return;
    if (profile.id === meId) return toast.error("You can't follow yourself");
    const wasFollowing = !!stats?.isFollowing;
    // optimistic
    queryClient.setQueryData(["user-stats", profile.id, meId], (prev: typeof stats) =>
      prev ? { ...prev, isFollowing: !wasFollowing, followers: prev.followers + (wasFollowing ? -1 : 1) } : prev);
    if (wasFollowing) {
      const { error } = await supabase.from("follows").delete().eq("follower_id", meId).eq("following_id", profile.id);
      if (error) {
        toast.error(error.message);
        queryClient.invalidateQueries({ queryKey: ["user-stats", profile.id, meId] });
      }
    } else {
      const { error } = await supabase.from("follows").insert({ follower_id: meId, following_id: profile.id });
      if (error) {
        if (!/duplicate/i.test(error.message)) toast.error(error.message);
        queryClient.invalidateQueries({ queryKey: ["user-stats", profile.id, meId] });
      }
    }
  }

  if (isLoading || !profile) {
    return <div className="flex h-[60vh] items-center justify-center text-muted-foreground">Loading…</div>;
  }

  const isMe = profile.id === meId;

  return (
    <div className="mx-auto max-w-[480px] px-4 pt-4">
      <div className="flex items-center gap-2">
        <Link to="/explore" className="rounded-full p-2 hover:bg-surface"><ArrowLeft className="h-5 w-5" /></Link>
        <h1 className="flex items-center gap-1 font-display text-lg font-bold">
          @{profile.username}
          {profile.verified && <BadgeCheck className="h-5 w-5 text-primary" strokeWidth={2.5} />}
        </h1>
      </div>

      <div className="mt-4 flex flex-col items-center">
        <UserAvatar username={profile.username} avatarUrl={profile.avatar_url} verified={profile.verified} size="2xl" linkTo={false} />
        <p className="mt-3 font-display text-lg font-semibold">{profile.display_name ?? profile.username}</p>
        {profile.bio && <p className="mt-1 max-w-xs text-center text-sm text-muted-foreground">{profile.bio}</p>}

        <div className="mt-4 flex gap-8">
          <Link to="/u/$username/following" params={{ username: profile.username }}>
            <Stat label="Following" value={stats?.following ?? 0} />
          </Link>
          <Link to="/u/$username/followers" params={{ username: profile.username }}>
            <Stat label="Followers" value={stats?.followers ?? 0} />
          </Link>
          <Stat label="Likes" value={stats?.likes ?? 0} />
          <Stat label="Videos" value={videos.length} />
        </div>

        {!isMe && (
          <button
            onClick={toggleFollow}
            className={`mt-4 flex items-center gap-2 rounded-full px-6 py-2 text-sm font-semibold transition active:scale-95 ${
              stats?.isFollowing
                ? "border border-border bg-surface text-foreground"
                : "gradient-zing text-zing-foreground shadow-zing"
            }`}
          >
            {stats?.isFollowing ? <><UserCheck className="h-4 w-4" /> Following</> : <><UserPlus className="h-4 w-4" /> Follow</>}
          </button>
        )}
      </div>

      <div className="mt-6 grid grid-cols-3 gap-0.5 pb-8">
        {videos.length === 0 ? (
          <p className="col-span-3 py-12 text-center text-sm text-muted-foreground">No videos yet.</p>
        ) : (
          videos.map((v) => (
            <Link key={v.id} to="/feed" className="relative aspect-[9/16] overflow-hidden bg-surface">
              {v.thumbnail_url ? (
                <img src={v.thumbnail_url} alt="" className="h-full w-full object-cover" loading="lazy" />
              ) : (
                <video src={v.video_url} className="h-full w-full object-cover" muted preload="metadata" />
              )}
            </Link>
          ))
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-center">
      <p className="font-display text-lg font-bold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
