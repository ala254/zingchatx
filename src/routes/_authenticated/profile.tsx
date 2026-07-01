import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Settings, LogOut, Grid3x3, Heart, Bookmark, Edit3, BadgeCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { Route as AuthRoute } from "../_authenticated/route";
import { useNavigate } from "@tanstack/react-router";
import { signStorageUrls } from "@/lib/videos";
import { UserAvatar } from "@/components/user-avatar";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({ meta: [{ title: "Profile — ZingChatX" }] }),
  component: MyProfilePage,
});

function MyProfilePage() {
  const { user } = AuthRoute.useRouteContext();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"videos" | "likes" | "saved">("videos");

  // Realtime: refresh profile + counts when my profile or my follows change.
  useEffect(() => {
    const ch = supabase
      .channel(`me-${user!.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles", filter: `id=eq.${user!.id}` },
        () => queryClient.invalidateQueries({ queryKey: ["profile", user!.id] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "follows", filter: `following_id=eq.${user!.id}` },
        () => queryClient.invalidateQueries({ queryKey: ["profile-counts", user!.id] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "follows", filter: `follower_id=eq.${user!.id}` },
        () => queryClient.invalidateQueries({ queryKey: ["profile-counts", user!.id] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, queryClient]);

  const { data: profile } = useQuery({
    queryKey: ["profile", user!.id],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", user!.id).single();
      return data;
    },
  });

  const { data: counts } = useQuery({
    queryKey: ["profile-counts", user!.id],
    queryFn: async () => {
      const [followers, following, videos, likes] = await Promise.all([
        supabase.from("follows").select("*", { count: "exact", head: true }).eq("following_id", user!.id),
        supabase.from("follows").select("*", { count: "exact", head: true }).eq("follower_id", user!.id),
        supabase.from("videos").select("*", { count: "exact", head: true }).eq("user_id", user!.id),
        supabase.from("likes").select("video_id, videos!inner(user_id)").eq("videos.user_id", user!.id),
      ]);
      return {
        followers: followers.count ?? 0,
        following: following.count ?? 0,
        videos: videos.count ?? 0,
        likes: likes.data?.length ?? 0,
      };
    },
  });

  const { data: videos = [] } = useQuery({
    queryKey: ["my-videos", user!.id, tab],
    queryFn: async () => {
      let rows: { id: string; thumbnail_url: string | null; video_url: string }[] = [];
      if (tab === "videos") {
        const { data } = await supabase
          .from("videos").select("id, thumbnail_url, video_url").eq("user_id", user!.id).order("created_at", { ascending: false });
        rows = data ?? [];
      } else if (tab === "likes") {
        const { data } = await supabase
          .from("likes").select("video_id, videos!inner(id, thumbnail_url, video_url)").eq("user_id", user!.id);
        rows = (data ?? []).map((r) => r.videos as { id: string; thumbnail_url: string | null; video_url: string });
      } else {
        const { data } = await supabase
          .from("saves").select("video_id, videos!inner(id, thumbnail_url, video_url)").eq("user_id", user!.id);
        rows = (data ?? []).map((r) => r.videos as { id: string; thumbnail_url: string | null; video_url: string });
      }
      const [thumbs, vids] = await Promise.all([
        signStorageUrls("thumbnails", rows.map((r) => r.thumbnail_url)),
        signStorageUrls("videos", rows.map((r) => r.video_url)),
      ]);
      return rows.map((r, i) => ({ ...r, thumbnail_url: thumbs[i] ?? r.thumbnail_url, video_url: vids[i] ?? r.video_url }));
    },
  });

  async function handleSignOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="mx-auto max-w-[480px] px-4 pt-4">
      <div className="flex items-start justify-between">
        <h1 className="font-display text-xl font-bold">@{profile?.username ?? "…"}</h1>
        <div className="flex gap-1">
          <Link to="/settings" className="rounded-full p-2 hover:bg-surface" aria-label="Settings"><Settings className="h-5 w-5" /></Link>
          <button onClick={handleSignOut} className="rounded-full p-2 hover:bg-surface" aria-label="Sign out"><LogOut className="h-5 w-5" /></button>
        </div>
      </div>

      <div className="mt-5 flex flex-col items-center">
        <div className="h-24 w-24 overflow-hidden rounded-full border-2 border-border bg-surface">
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center font-display text-3xl font-bold text-gradient-zing">
              {profile?.username?.[0]?.toUpperCase() ?? "?"}
            </div>
          )}
        </div>
        <p className="mt-3 font-display text-lg font-semibold">{profile?.display_name ?? profile?.username}</p>
        {profile?.bio && <p className="mt-1 max-w-xs text-center text-sm text-muted-foreground">{profile.bio}</p>}

        <div className="mt-5 flex gap-8">
          <Stat label="Following" value={counts?.following ?? 0} />
          <Stat label="Followers" value={counts?.followers ?? 0} />
          <Stat label="Likes" value={counts?.likes ?? 0} />
        </div>

        <Link
          to="/settings/edit-profile"
          className="mt-5 flex items-center gap-2 rounded-full border border-border bg-surface px-5 py-2 text-sm font-semibold hover:border-primary"
        >
          <Edit3 className="h-4 w-4" /> Edit profile
        </Link>
      </div>

      <div className="mt-6 flex border-b border-border">
        <TabBtn icon={Grid3x3} active={tab === "videos"} onClick={() => setTab("videos")} />
        <TabBtn icon={Heart} active={tab === "likes"} onClick={() => setTab("likes")} />
        <TabBtn icon={Bookmark} active={tab === "saved"} onClick={() => setTab("saved")} />
      </div>

      <div className="mt-1 grid grid-cols-3 gap-0.5 pb-8">
        {videos.length === 0 ? (
          <p className="col-span-3 py-12 text-center text-sm text-muted-foreground">Nothing here yet.</p>
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

function TabBtn({ icon: Icon, active, onClick }: { icon: typeof Grid3x3; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-1 items-center justify-center border-b-2 py-3 transition ${active ? "border-primary text-foreground" : "border-transparent text-muted-foreground"}`}
    >
      <Icon className="h-5 w-5" />
    </button>
  );
}
