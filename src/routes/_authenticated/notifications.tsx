import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Heart, MessageCircle, UserPlus } from "lucide-react";
import { Route as AuthRoute } from "../_authenticated/route";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({ meta: [{ title: "Notifications — ZingChatX" }] }),
  component: NotificationsPage,
});

type Notif =
  | { kind: "like"; at: string; from: { username: string; avatar_url: string | null }; videoId: string }
  | { kind: "comment"; at: string; from: { username: string; avatar_url: string | null }; videoId: string; content: string }
  | { kind: "follow"; at: string; from: { username: string; avatar_url: string | null } };

function NotificationsPage() {
  const { user } = AuthRoute.useRouteContext();
  const meId = user!.id;

  const { data: notifs = [] } = useQuery({
    queryKey: ["notifs", meId],
    queryFn: async (): Promise<Notif[]> => {
      const [likes, comments, follows] = await Promise.all([
        supabase
          .from("likes")
          .select("created_at, video_id, videos!inner(user_id), profiles!likes_user_id_profiles_fkey(username, avatar_url)")
          .eq("videos.user_id", meId)
          .order("created_at", { ascending: false })
          .limit(50),
        supabase
          .from("comments")
          .select("created_at, video_id, content, videos!inner(user_id), profiles!comments_user_id_profiles_fkey(username, avatar_url)")
          .eq("videos.user_id", meId)
          .order("created_at", { ascending: false })
          .limit(50),
        supabase
          .from("follows")
          .select("created_at, profiles!follows_follower_profiles_fkey(username, avatar_url)")
          .eq("following_id", meId)
          .order("created_at", { ascending: false })
          .limit(50),
      ]);

      const list: Notif[] = [];
      (likes.data ?? []).forEach((l) => {
        const p = Array.isArray(l.profiles) ? l.profiles[0] : l.profiles;
        if (p) list.push({ kind: "like", at: l.created_at, from: p, videoId: l.video_id });
      });
      (comments.data ?? []).forEach((c) => {
        const p = Array.isArray(c.profiles) ? c.profiles[0] : c.profiles;
        if (p) list.push({ kind: "comment", at: c.created_at, from: p, videoId: c.video_id, content: c.content });
      });
      (follows.data ?? []).forEach((f) => {
        const p = Array.isArray(f.profiles) ? f.profiles[0] : f.profiles;
        if (p) list.push({ kind: "follow", at: f.created_at, from: p });
      });
      return list.sort((a, b) => +new Date(b.at) - +new Date(a.at)).slice(0, 80);
    },
  });

  return (
    <div className="mx-auto max-w-[480px] px-4 pt-4">
      <h1 className="font-display text-2xl font-bold">Notifications</h1>

      <div className="mt-4 space-y-1 pb-8">
        {notifs.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted-foreground">No notifications yet.</p>
        ) : (
          notifs.map((n, i) => (
            <Link
              key={i}
              to={n.kind === "follow" ? "/u/$username" : "/feed"}
              params={n.kind === "follow" ? { username: n.from.username } : undefined as never}
              className="flex items-center gap-3 rounded-2xl px-3 py-3 hover:bg-surface"
            >
              <div className="relative">
                <div className="h-11 w-11 overflow-hidden rounded-full bg-secondary">
                  {n.from.avatar_url ? (
                    <img src={n.from.avatar_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-sm font-bold">{n.from.username[0].toUpperCase()}</div>
                  )}
                </div>
                <div className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full gradient-zing">
                  {n.kind === "like" ? <Heart className="h-3 w-3 fill-white text-white" />
                    : n.kind === "comment" ? <MessageCircle className="h-3 w-3 text-white" />
                    : <UserPlus className="h-3 w-3 text-white" />}
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm">
                  <span className="font-semibold">@{n.from.username}</span>{" "}
                  <span className="text-muted-foreground">
                    {n.kind === "like" && "liked your video"}
                    {n.kind === "comment" && `commented: "${n.content.slice(0, 60)}"`}
                    {n.kind === "follow" && "started following you"}
                  </span>
                </p>
                <p className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(n.at), { addSuffix: true })}</p>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
