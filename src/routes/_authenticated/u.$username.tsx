import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, UserPlus, UserCheck } from "lucide-react";
import { Route as AuthRoute } from "../_authenticated/route";
import { toast } from "sonner";

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

  const { data: profile, isLoading } = useQuery({
    queryKey: ["user", username],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").eq("username", username).maybeSingle();
      if (error) throw error;
      if (!data) throw notFound();
      return data;
    },
  });

  const { data: stats, refetch: refetchStats } = useQuery({
    queryKey: ["user-stats", profile?.id, meId],
    enabled: !!profile,
    queryFn: async () => {
      const [followers, following, isFollowing] = await Promise.all([
        supabase.from("follows").select("*", { count: "exact", head: true }).eq("following_id", profile!.id),
        supabase.from("follows").select("*", { count: "exact", head: true }).eq("follower_id", profile!.id),
        supabase.from("follows").select("follower_id").eq("follower_id", meId).eq("following_id", profile!.id).maybeSingle(),
      ]);
      return {
        followers: followers.count ?? 0,
        following: following.count ?? 0,
        isFollowing: !!isFollowing.data,
      };
    },
  });

  const { data: videos = [] } = useQuery({
    queryKey: ["user-videos", profile?.id],
    enabled: !!profile,
    queryFn: async () => {
      const { data } = await supabase
        .from("videos").select("id, thumbnail_url, video_url").eq("user_id", profile!.id).order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  async function toggleFollow() {
    if (!profile) return;
    if (profile.id === meId) return;
    if (stats?.isFollowing) {
      await supabase.from("follows").delete().eq("follower_id", meId).eq("following_id", profile.id);
    } else {
      const { error } = await supabase.from("follows").insert({ follower_id: meId, following_id: profile.id });
      if (error) return toast.error(error.message);
    }
    refetchStats();
  }

  if (isLoading || !profile) {
    return <div className="flex h-[60vh] items-center justify-center text-muted-foreground">Loading…</div>;
  }

  const isMe = profile.id === meId;

  return (
    <div className="mx-auto max-w-[480px] px-4 pt-4">
      <div className="flex items-center gap-2">
        <Link to="/explore" className="rounded-full p-2 hover:bg-surface"><ArrowLeft className="h-5 w-5" /></Link>
        <h1 className="font-display text-lg font-bold">@{profile.username}</h1>
      </div>

      <div className="mt-4 flex flex-col items-center">
        <div className="h-24 w-24 overflow-hidden rounded-full border-2 border-border bg-surface">
          {profile.avatar_url ? (
            <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center font-display text-3xl font-bold text-gradient-zing">
              {profile.username[0].toUpperCase()}
            </div>
          )}
        </div>
        <p className="mt-3 font-display text-lg font-semibold">{profile.display_name ?? profile.username}</p>
        {profile.bio && <p className="mt-1 max-w-xs text-center text-sm text-muted-foreground">{profile.bio}</p>}

        <div className="mt-4 flex gap-8">
          <Stat label="Following" value={stats?.following ?? 0} />
          <Stat label="Followers" value={stats?.followers ?? 0} />
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
