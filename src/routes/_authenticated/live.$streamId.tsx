import { createFileRoute, useNavigate, useParams, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Heart, Send, Gift, X, Users, Share2, Flag, MoreVertical, Ban, Loader2 } from "lucide-react";
import { getAgoraToken } from "@/lib/agora.functions";
import {
  fetchStream,
  joinLive,
  leaveLive,
  sendHearts,
  postComment,
  reportUser,
  type LiveStream,
} from "@/lib/live";
import { supabase } from "@/integrations/supabase/client";
import { Route as AuthRoute } from "../_authenticated/route";
import { LiveComments } from "@/components/live-comments";
import { LiveHeartsOverlay } from "@/components/live-hearts-overlay";
import { LiveGiftDrawer } from "@/components/live-gift-drawer";
import { LiveSummary } from "@/components/live-end-dialog";
import { UserAvatar } from "@/components/user-avatar";

export const Route = createFileRoute("/_authenticated/live/$streamId")({
  head: () => ({ meta: [{ title: "Live — ZingChatX" }] }),
  component: ViewerPage,
});

function ViewerPage() {
  const { streamId } = useParams({ from: "/_authenticated/live/$streamId" });
  const { user } = AuthRoute.useRouteContext();
  const navigate = useNavigate();
  const mintToken = useServerFn(getAgoraToken);

  const [stream, setStream] = useState<LiveStream | null>(null);
  const [loading, setLoading] = useState(true);
  const [hearts, setHearts] = useState(0);
  const [comment, setComment] = useState("");
  const [giftOpen, setGiftOpen] = useState(false);
  const [following, setFollowing] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [gifted, setGifted] = useState<{ id: string; glyph: string; qty: number } | null>(null);

  const remoteRef = useRef<HTMLDivElement>(null);
  const clientRef = useRef<any>(null);
  const heartQueue = useRef(0);
  const heartTimer = useRef<number | null>(null);

  // fetch + subscribe to stream row
  useEffect(() => {
    let mounted = true;
    (async () => {
      const s = await fetchStream(streamId);
      if (!mounted) return;
      setStream(s);
      setLoading(false);
      if (!s) return;
      if (s.status !== "live") return;
      await joinLive(streamId);
      // check follow
      if (user && s.host_id !== user.id) {
        const { data } = await supabase
          .from("follows")
          .select("follower_id")
          .eq("follower_id", user.id)
          .eq("following_id", s.host_id)
          .maybeSingle();
        if (mounted) setFollowing(!!data);
      }
      // join Agora
      try {
        const uid = Math.floor(Math.random() * 1e9);
        const tk = await mintToken({ data: { channel: s.agora_channel, uid, role: "audience" } });
        const AgoraRTC = (await import("agora-rtc-sdk-ng")).default;
        AgoraRTC.setLogLevel(3);
        const client = AgoraRTC.createClient({ mode: "live", codec: "vp8" });
        clientRef.current = client;
        client.on("user-published", async (remoteUser: any, mediaType: "audio" | "video") => {
          await client.subscribe(remoteUser, mediaType);
          if (mediaType === "video" && remoteRef.current) {
            remoteUser.videoTrack?.play(remoteRef.current);
          } else if (mediaType === "audio") {
            remoteUser.audioTrack?.play();
          }
        });
        await client.join(tk.appId, tk.channel, tk.token, tk.uid);
      } catch (e) {
        console.error(e);
      }
    })();

    const ch = supabase
      .channel(`viewer-${streamId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "live_streams", filter: `id=eq.${streamId}` },
        (payload) => setStream((s) => (s ? { ...s, ...(payload.new as Partial<LiveStream>) } : s)),
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "live_hearts", filter: `stream_id=eq.${streamId}` },
        (payload) => {
          const n = Math.min((payload.new as { count: number }).count, 10);
          for (let i = 0; i < n; i++) setTimeout(() => setHearts((h) => h + 1), i * 80);
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "gift_sends", filter: `stream_id=eq.${streamId}` },
        async (payload) => {
          const row = payload.new as { gift_id: string; quantity: number };
          const { data: g } = await supabase.from("gifts_catalog").select("glyph").eq("id", row.gift_id).maybeSingle();
          setGifted({ id: row.gift_id + Date.now(), glyph: g?.glyph ?? "🎁", qty: row.quantity });
          setTimeout(() => setGifted(null), 2500);
        },
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(ch);
      if (clientRef.current) clientRef.current.leave().catch(() => {});
      leaveLive(streamId).catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streamId]);

  function tapHeart() {
    setHearts((h) => h + 1);
    heartQueue.current += 1;
    if (heartTimer.current) return;
    heartTimer.current = window.setTimeout(() => {
      const n = heartQueue.current;
      heartQueue.current = 0;
      heartTimer.current = null;
      if (n > 0) sendHearts(streamId, n).catch(() => {});
    }, 800);
  }

  async function submitComment() {
    const c = comment.trim();
    if (!c) return;
    setComment("");
    try {
      await postComment(streamId, c);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  async function toggleFollow() {
    if (!user || !stream) return;
    if (following) {
      await supabase.from("follows").delete().eq("follower_id", user.id).eq("following_id", stream.host_id);
      setFollowing(false);
    } else {
      await supabase.from("follows").insert({ follower_id: user.id, following_id: stream.host_id });
      setFollowing(true);
    }
  }

  async function handleShare() {
    const url = `${window.location.origin}/live/${streamId}`;
    try {
      if (navigator.share) await navigator.share({ url, title: `Live: @${stream?.host?.username}` });
      else {
        await navigator.clipboard.writeText(url);
        toast.success("Link copied");
      }
    } catch {}
  }

  if (loading) {
    return <div className="flex h-[100dvh] items-center justify-center bg-black"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }
  if (!stream) {
    return <div className="flex h-[100dvh] flex-col items-center justify-center bg-black text-white"><p>Stream not found</p><Link to="/live" className="mt-4 text-primary">Back</Link></div>;
  }
  if (stream.status === "ended") {
    return <LiveSummary stream={stream} onClose={() => navigate({ to: "/live" })} />;
  }

  const isSelf = user?.id === stream.host_id;

  return (
    <div className="fixed inset-0 z-30 bg-black">
      <div ref={remoteRef} className="absolute inset-0 h-full w-full [&_video]:h-full [&_video]:w-full [&_video]:object-cover" />

      <LiveHeartsOverlay trigger={hearts} />

      {/* Big gift animation */}
      {gifted ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="animate-scale-in text-8xl drop-shadow-lg">{gifted.glyph}</div>
        </div>
      ) : null}

      {/* Top */}
      <div className="absolute inset-x-0 top-0 flex items-start justify-between p-4" style={{ paddingTop: "calc(env(safe-area-inset-top, 0) + 0.75rem)" }}>
        <div className="flex items-center gap-2 rounded-full bg-black/50 p-1.5 pr-3 backdrop-blur">
          <UserAvatar username={stream.host?.username} avatarUrl={stream.host?.avatar_url} verified={stream.host?.verified} size="sm" linkTo={false} />
          <div className="text-white">
            <p className="text-xs font-semibold leading-tight">@{stream.host?.username}</p>
            <p className="text-[9px] text-white/70 leading-tight">{stream.title ?? "Live now"}</p>
          </div>
          {!isSelf && !following ? (
            <button onClick={toggleFollow} className="ml-1 rounded-full bg-primary px-2.5 py-0.5 text-[10px] font-bold text-primary-foreground">
              Follow
            </button>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 rounded-full bg-black/50 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur">
            <Users className="h-3 w-3" /> {stream.viewer_count}
          </span>
          <button onClick={() => navigate({ to: "/live" })} className="rounded-full bg-black/50 p-1.5 backdrop-blur">
            <X className="h-4 w-4 text-white" />
          </button>
        </div>
      </div>

      {/* Comments */}
      <div className="absolute inset-x-0 bottom-16 px-3">
        <LiveComments streamId={streamId} isStaff={false} />
      </div>

      {/* Bottom bar */}
      <div
        className="absolute inset-x-0 bottom-0 flex items-center gap-2 bg-gradient-to-t from-black/70 to-transparent p-3"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0) + 0.75rem)" }}
      >
        <input
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submitComment()}
          placeholder="Say something…"
          maxLength={200}
          className="flex-1 rounded-full bg-white/10 px-4 py-2.5 text-sm text-white placeholder:text-white/50 backdrop-blur focus:outline-none focus:ring-2 focus:ring-primary"
        />
        <button onClick={submitComment} className="rounded-full bg-primary p-2.5" aria-label="Send">
          <Send className="h-4 w-4 text-primary-foreground" />
        </button>
        {!isSelf ? (
          <>
            <button onClick={() => setGiftOpen(true)} className="rounded-full bg-amber-500 p-2.5" aria-label="Gift">
              <Gift className="h-4 w-4 text-white" />
            </button>
            <button onClick={tapHeart} className="rounded-full bg-pink-500 p-2.5 active:scale-90 transition" aria-label="Heart">
              <Heart className="h-4 w-4 text-white" fill="currentColor" strokeWidth={0} />
            </button>
          </>
        ) : null}
        <button onClick={handleShare} className="rounded-full bg-black/60 p-2.5 backdrop-blur" aria-label="Share">
          <Share2 className="h-4 w-4 text-white" />
        </button>
        {!isSelf ? (
          <button onClick={() => setMoreOpen(true)} className="rounded-full bg-black/60 p-2.5 backdrop-blur">
            <MoreVertical className="h-4 w-4 text-white" />
          </button>
        ) : null}
      </div>

      {user ? (
        <LiveGiftDrawer open={giftOpen} streamId={streamId} userId={user.id} onClose={() => setGiftOpen(false)} />
      ) : null}

      {moreOpen ? (
        <div className="fixed inset-0 z-50 flex items-end bg-black/60 backdrop-blur-sm" onClick={() => setMoreOpen(false)}>
          <div className="w-full rounded-t-3xl bg-surface p-4 pb-8" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={async () => {
                if (!stream || !user) return;
                await reportUser(streamId, stream.host_id, "inappropriate").catch(() => {});
                toast.success("Reported. Thank you.");
                setMoreOpen(false);
              }}
              className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm hover:bg-surface-elevated"
            >
              <Flag className="h-4 w-4 text-red-400" /> Report stream
            </button>
            <button
              onClick={async () => {
                if (!stream || !user) return;
                await supabase.from("follows").delete().eq("follower_id", user.id).eq("following_id", stream.host_id);
                setFollowing(false);
                setMoreOpen(false);
                toast.success("Unfollowed");
              }}
              className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm hover:bg-surface-elevated"
            >
              <Ban className="h-4 w-4 text-muted-foreground" /> Unfollow creator
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
