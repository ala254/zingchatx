import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Radio,
  X,
  SwitchCamera,
  Sparkles,
  Users,
  Heart,
  Coins,
  UserPlus,
  Pin,
  Ban,
  Flag,
  ShieldCheck,
} from "lucide-react";
import { getAgoraToken } from "@/lib/agora.functions";
import {
  createStream,
  endStream,
  fetchStream,
  addModerator,
  pinComment,
  banUser,
  type LiveStream,
} from "@/lib/live";
import { supabase } from "@/integrations/supabase/client";
import { Route as AuthRoute } from "../_authenticated/route";
import { LiveComments, type LiveComment } from "@/components/live-comments";
import { LiveHeartsOverlay } from "@/components/live-hearts-overlay";
import { LiveEndConfirm, LiveSummary } from "@/components/live-end-dialog";

export const Route = createFileRoute("/_authenticated/live/host")({
  head: () => ({ meta: [{ title: "Go Live — ZingChatX" }] }),
  component: HostPage,
});

type AgoraClient = {
  join: (appId: string, channel: string, token: string, uid: number) => Promise<unknown>;
  publish: (tracks: unknown[]) => Promise<void>;
  leave: () => Promise<void>;
  setClientRole: (role: "host" | "audience") => Promise<void>;
};

function HostPage() {
  const { user } = AuthRoute.useRouteContext();
  const navigate = useNavigate();
  const mintToken = useServerFn(getAgoraToken);

  const [title, setTitle] = useState("");
  const [phase, setPhase] = useState<"setup" | "live" | "ended">("setup");
  const [stream, setStream] = useState<LiveStream | null>(null);
  const [starting, setStarting] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [facing, setFacing] = useState<"user" | "environment">("user");
  const [beauty, setBeauty] = useState(true);
  const [hearts, setHearts] = useState(0);
  const [modOpen, setModOpen] = useState(false);
  const [modUsername, setModUsername] = useState("");

  const videoRef = useRef<HTMLVideoElement>(null);
  const clientRef = useRef<AgoraClient | null>(null);
  const tracksRef = useRef<{ audio?: { close: () => void }; video?: { close: () => void; play: (el: HTMLVideoElement) => void } }>({});
  const localStreamRef = useRef<MediaStream | null>(null);

  // Setup preview
  useEffect(() => {
    if (phase !== "setup") return;
    let alive = true;
    (async () => {
      try {
        const s = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: facing, width: { ideal: 720 }, height: { ideal: 1280 } },
          audio: true,
        });
        if (!alive) { s.getTracks().forEach((t) => t.stop()); return; }
        localStreamRef.current?.getTracks().forEach((t) => t.stop());
        localStreamRef.current = s;
        if (videoRef.current) videoRef.current.srcObject = s;
      } catch (e) {
        toast.error("Camera access denied");
      }
    })();
    return () => { alive = false; };
  }, [facing, phase]);

  // Realtime hearts + comments count via subscription for stream row
  useEffect(() => {
    if (!stream || phase !== "live") return;
    const ch = supabase
      .channel(`host-hearts-${stream.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "live_hearts", filter: `stream_id=eq.${stream.id}` },
        (payload) => {
          const n = (payload.new as { count: number }).count;
          for (let i = 0; i < Math.min(n, 8); i++) {
            setTimeout(() => setHearts((h) => h + 1), i * 90);
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "live_streams", filter: `id=eq.${stream.id}` },
        (payload) => setStream((s) => (s ? { ...s, ...(payload.new as Partial<LiveStream>) } : s)),
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [stream, phase]);

  async function startBroadcast() {
    if (!user) return;
    setStarting(true);
    try {
      const s = await createStream({ title: title.trim() || null });
      const uid = Math.floor(Math.random() * 1e9);
      const tokenRes = await mintToken({ data: { channel: s.agora_channel, uid, role: "host" } });

      const AgoraRTC = (await import("agora-rtc-sdk-ng")).default;
      AgoraRTC.setLogLevel(3);
      const client = AgoraRTC.createClient({ mode: "live", codec: "vp8" });
      await client.setClientRole("host");
      await client.join(tokenRes.appId, tokenRes.channel, tokenRes.token, tokenRes.uid);
      // Use existing preview stream
      const preview = localStreamRef.current;
      if (!preview) throw new Error("No camera stream");
      const audioTrack = preview.getAudioTracks()[0];
      const videoTrack = preview.getVideoTracks()[0];
      const localAudio = AgoraRTC.createCustomAudioTrack({ mediaStreamTrack: audioTrack });
      const localVideo = AgoraRTC.createCustomVideoTrack({ mediaStreamTrack: videoTrack });
      await client.publish([localAudio, localVideo]);
      clientRef.current = client as unknown as AgoraClient;
      tracksRef.current = { audio: localAudio as unknown as { close: () => void }, video: localVideo as unknown as { close: () => void; play: (el: HTMLVideoElement) => void } };
      setStream(s);
      setPhase("live");
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Failed to start live");
    } finally {
      setStarting(false);
    }
  }

  async function stopBroadcast() {
    if (!stream) return;
    try {
      tracksRef.current.audio?.close();
      tracksRef.current.video?.close();
      await clientRef.current?.leave();
      await endStream(stream.id);
      const final = await fetchStream(stream.id);
      if (final) setStream(final);
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
    } catch (e) {
      console.error(e);
    }
    setPhase("ended");
    setConfirmEnd(false);
  }

  async function handleLongPress(c: LiveComment) {
    const action = window.prompt(`Comment from @${c.profile?.username}:\n"${c.content}"\n\nType: pin | unpin | ban`);
    if (!action) return;
    try {
      if (action === "pin") await pinComment(c.id, true);
      else if (action === "unpin") await pinComment(c.id, false);
      else if (action === "ban" && stream) {
        await banUser(stream.id, c.user_id);
        toast.success("User muted for this stream");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action failed");
    }
  }

  const filterStyle = beauty ? { filter: "contrast(1.05) saturate(1.15) brightness(1.05)" } : undefined;

  return (
    <div className="fixed inset-0 z-30 bg-black">
      <video ref={videoRef} autoPlay muted playsInline className="absolute inset-0 h-full w-full object-cover" style={filterStyle} />

      {/* Top bar */}
      <div
        className="absolute inset-x-0 top-0 flex items-center justify-between p-4"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0) + 0.75rem)" }}
      >
        {phase === "live" && stream ? (
          <>
            <div className="flex items-center gap-2 rounded-full bg-black/50 px-3 py-1.5 backdrop-blur">
              <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-xs font-bold text-white">LIVE</span>
              <span className="text-xs text-white/70">·</span>
              <Users className="h-3.5 w-3.5 text-white/80" />
              <span className="text-xs font-semibold text-white">{stream.viewer_count}</span>
            </div>
            <button
              onClick={() => setConfirmEnd(true)}
              className="rounded-full bg-red-500 px-4 py-1.5 text-xs font-bold text-white shadow-lg"
            >
              End
            </button>
          </>
        ) : (
          <>
            <button onClick={() => navigate({ to: "/upload" })} className="rounded-full bg-black/50 p-2 backdrop-blur">
              <X className="h-5 w-5 text-white" />
            </button>
            <span className="rounded-full bg-black/50 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur">
              Preview
            </span>
          </>
        )}
      </div>

      {/* Right rail */}
      {phase !== "ended" ? (
        <div className="absolute right-4 top-1/2 flex -translate-y-1/2 flex-col gap-3">
          <RailBtn onClick={() => setFacing((f) => (f === "user" ? "environment" : "user"))} icon={<SwitchCamera className="h-5 w-5" />} label="Flip" />
          <RailBtn onClick={() => setBeauty((b) => !b)} icon={<Sparkles className={`h-5 w-5 ${beauty ? "text-pink-400" : ""}`} />} label="Beauty" active={beauty} />
          {phase === "live" ? (
            <RailBtn onClick={() => setModOpen(true)} icon={<ShieldCheck className="h-5 w-5" />} label="Mods" />
          ) : null}
        </div>
      ) : null}

      {/* Setup form */}
      {phase === "setup" ? (
        <div
          className="absolute inset-x-0 bottom-0 space-y-3 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-5 pb-8"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0) + 1.5rem)" }}
        >
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Give your live a title…"
            maxLength={80}
            className="w-full rounded-2xl bg-white/10 px-4 py-3 text-sm text-white placeholder:text-white/50 backdrop-blur focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <button
            disabled={starting}
            onClick={startBroadcast}
            className="flex w-full items-center justify-center gap-2 rounded-full gradient-zing px-6 py-3.5 text-sm font-bold text-zing-foreground shadow-zing disabled:opacity-60 active:scale-[0.98] transition"
          >
            <Radio className="h-4 w-4" /> {starting ? "Starting…" : "Go Live"}
          </button>
        </div>
      ) : null}

      {/* Live overlay */}
      {phase === "live" && stream ? (
        <>
          <LiveHeartsOverlay trigger={hearts} />
          <div className="absolute inset-x-0 bottom-0 p-3" style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0) + 0.75rem)" }}>
            <div className="mb-2 flex items-center gap-3 rounded-full bg-black/40 px-3 py-1.5 backdrop-blur">
              <span className="flex items-center gap-1 text-xs text-white">
                <Heart className="h-3 w-3 text-pink-400" fill="currentColor" strokeWidth={0} /> {stream.likes_count}
              </span>
              <span className="flex items-center gap-1 text-xs text-white">
                <Coins className="h-3 w-3 text-amber-400" /> {stream.gifts_total_coins}
              </span>
            </div>
            <LiveComments streamId={stream.id} isStaff onLongPress={handleLongPress} />
          </div>
        </>
      ) : null}

      {/* Moderator modal */}
      {modOpen && stream ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6 backdrop-blur-sm" onClick={() => setModOpen(false)}>
          <div className="w-full max-w-sm rounded-3xl bg-surface p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display text-lg font-bold flex items-center gap-2">
              <UserPlus className="h-4 w-4" /> Add moderator
            </h3>
            <input
              value={modUsername}
              onChange={(e) => setModUsername(e.target.value)}
              placeholder="username"
              className="mt-3 w-full rounded-2xl border border-border bg-input px-4 py-2.5 text-sm focus:outline-none focus:border-primary"
            />
            <button
              onClick={async () => {
                try {
                  await addModerator(stream.id, modUsername.replace(/^@/, "").trim());
                  toast.success("Moderator added");
                  setModOpen(false);
                  setModUsername("");
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Failed");
                }
              }}
              className="mt-3 w-full rounded-full gradient-zing px-4 py-2.5 text-sm font-semibold text-zing-foreground"
            >
              Add
            </button>
          </div>
        </div>
      ) : null}

      <LiveEndConfirm open={confirmEnd} onCancel={() => setConfirmEnd(false)} onConfirm={stopBroadcast} />
      {phase === "ended" && stream ? (
        <LiveSummary stream={stream} onClose={() => navigate({ to: "/feed" })} />
      ) : null}
    </div>
  );
}

function RailBtn({ onClick, icon, label, active }: { onClick: () => void; icon: React.ReactNode; label: string; active?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-1 rounded-2xl px-3 py-2 backdrop-blur ${active ? "bg-primary/30" : "bg-black/40"}`}
    >
      <span className="text-white">{icon}</span>
      <span className="text-[9px] font-medium text-white">{label}</span>
    </button>
  );
}
