import { useEffect, useState } from "react";
import {
  Download,
  Link as LinkIcon,
  MessageCircle,
  Send,
  Facebook,
  Instagram,
  Repeat2,
  Flag,
  EyeOff,
  Star,
  ChevronsDown,
  Gauge,
  Sun,
  WifiOff,
  PlusCircle,
  Share2,
  Loader2,
} from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  buildShareText,
  downloadBlob,
  openIntent,
  recordShare,
  renderWatermarkedVideo,
  videoDeepLink,
  type ShareDestination,
} from "@/lib/share";
import type { FeedVideo } from "@/lib/videos";

export type PlayerSettings = {
  autoScroll: boolean;
  clearDisplay: boolean;
  dataSaver: boolean;
  playbackSpeed: number;
};

interface Props {
  video: FeedVideo | null;
  currentUserId: string | null;
  settings: PlayerSettings;
  onSettingsChange: (s: PlayerSettings) => void;
  onClose: () => void;
}

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];
const REPORT_REASONS = [
  "Spam or misleading",
  "Hate speech",
  "Violence or harm",
  "Sexual content",
  "Harassment or bullying",
  "Other",
];

export function ShareSheet({ video, currentUserId, settings, onClose, onSettingsChange }: Props) {
  const [busy, setBusy] = useState<string | null>(null);
  const [speedOpen, setSpeedOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [shareCount, setShareCount] = useState(0);

  useEffect(() => {
    if (!video) return;
    setSpeedOpen(false);
    setReportOpen(false);
    let cancelled = false;
    supabase
      .from("shares")
      .select("id", { count: "exact", head: true })
      .eq("video_id", video.id)
      .then(({ count }) => {
        if (!cancelled) setShareCount(count ?? 0);
      });
    const ch = supabase
      .channel(`shares:${video.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "shares", filter: `video_id=eq.${video.id}` },
        () => setShareCount((c) => c + 1),
      )
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(ch);
    };
  }, [video]);

  if (!video) return null;
  const url = videoDeepLink(video.id);
  const text = buildShareText({
    username: video.profile?.username,
    caption: video.caption,
    url,
  });

  function requireAuth(): boolean {
    if (!currentUserId) {
      toast.error("Sign in to continue");
      return false;
    }
    return true;
  }

  async function doShare(dest: ShareDestination, action: () => Promise<void> | void) {
    setBusy(dest);
    try {
      await action();
      await recordShare(video!.id, dest);
    } catch (err) {
      console.error("share action failed", dest, err);
    } finally {
      setBusy(null);
    }
  }

  async function nativeShare() {
    type ShareCapable = Navigator & { share?: (data: ShareData) => Promise<void> };
    const nav = navigator as ShareCapable;
    if (nav.share) {
      try {
        await nav.share({ title: "ZingChatX", text, url });
      } catch {
        return; // user cancel — don't count
      }
    } else {
      await navigator.clipboard.writeText(`${text}\n${url}`);
      toast.success("Link copied");
    }
  }

  async function copyLink() {
    await navigator.clipboard.writeText(url);
    toast.success("Link copied");
  }

  async function saveVideo() {
    if (!requireAuth()) return;
    toast.message("Preparing watermarked video…", { description: "This may take a few seconds." });
    const blob = await renderWatermarkedVideo(
      video!.video_url,
      `@${video!.profile?.username ?? "creator"}`,
    );
    downloadBlob(blob, `zingchatx-${video!.id}.webm`);
    toast.success("Saved to your device");
  }

  async function repost() {
    if (!requireAuth()) return;
    const { error } = await supabase
      .from("reposts")
      .insert({ user_id: currentUserId!, video_id: video!.id });
    if (error && !error.message.includes("duplicate")) throw error;
    toast.success("Reposted to your profile");
  }

  async function addToFavorites() {
    if (!requireAuth()) return;
    const { error } = await supabase
      .from("favorites")
      .insert({ user_id: currentUserId!, video_id: video!.id });
    if (error && !error.message.includes("duplicate")) throw error;
    toast.success("Added to favorites");
  }

  async function notInterested() {
    if (!requireAuth()) return;
    const { error } = await supabase
      .from("not_interested")
      .insert({ user_id: currentUserId!, video_id: video!.id });
    if (error && !error.message.includes("duplicate")) throw error;
    toast.success("We'll show fewer like this");
    onClose();
  }

  async function submitReport(reason: string) {
    if (!requireAuth()) return;
    setBusy("report");
    try {
      await supabase.from("reports").insert({
        user_id: currentUserId!,
        video_id: video!.id,
        reason,
      });
      toast.success("Report submitted — thank you");
      setReportOpen(false);
      onClose();
    } finally {
      setBusy(null);
    }
  }

  function setSetting<K extends keyof PlayerSettings>(key: K, value: PlayerSettings[K]) {
    onSettingsChange({ ...settings, [key]: value });
  }

  const shareActions: Array<{
    key: ShareDestination | "story";
    label: string;
    icon: typeof Share2;
    color: string;
    onClick: () => Promise<void> | void;
  }> = [
    {
      key: "native",
      label: "Share to…",
      icon: Share2,
      color: "from-zinc-400 to-zinc-600",
      onClick: () => doShare("native", nativeShare),
    },
    {
      key: "whatsapp",
      label: "WhatsApp",
      icon: MessageCircle,
      color: "from-emerald-400 to-green-600",
      onClick: () => doShare("whatsapp", () => openIntent("whatsapp", text, url)),
    },
    {
      key: "telegram",
      label: "Telegram",
      icon: Send,
      color: "from-sky-400 to-blue-600",
      onClick: () => doShare("telegram", () => openIntent("telegram", text, url)),
    },
    {
      key: "facebook",
      label: "Facebook",
      icon: Facebook,
      color: "from-blue-500 to-blue-700",
      onClick: () => doShare("facebook", () => openIntent("facebook", text, url)),
    },
    {
      key: "instagram",
      label: "Instagram",
      icon: Instagram,
      color: "from-pink-500 via-fuchsia-500 to-amber-400",
      onClick: () => doShare("instagram", () => openIntent("instagram", text, url)),
    },
    {
      key: "copy_link",
      label: "Copy link",
      icon: LinkIcon,
      color: "from-slate-400 to-slate-600",
      onClick: () => doShare("copy_link", copyLink),
    },
    {
      key: "story",
      label: "Add to Story",
      icon: PlusCircle,
      color: "from-fuchsia-500 to-purple-600",
      onClick: () => doShare("story", addToFavorites), // story queue: reuse favorites for now
    },
  ];

  const utilities = [
    {
      label: "Save Video",
      icon: Download,
      onClick: () => doShare("download", saveVideo),
      busyKey: "download",
    },
    { label: "Repost", icon: Repeat2, onClick: () => doShare("repost", repost), busyKey: "repost" },
    { label: "Add to Favorites", icon: Star, onClick: addToFavorites, busyKey: "fav" },
    { label: "Not Interested", icon: EyeOff, onClick: notInterested, busyKey: "ni" },
    { label: "Report", icon: Flag, onClick: () => setReportOpen(true), busyKey: "report" },
  ];

  return (
    <Sheet open={!!video} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="bottom"
        className="max-h-[90dvh] overflow-y-auto rounded-t-3xl border-border/60 bg-popover/80 p-0 backdrop-blur-2xl"
      >
        <SheetHeader className="px-5 pt-4 pb-2 text-left">
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-muted-foreground/40" />
          <SheetTitle className="flex items-center justify-between text-base">
            <span className="font-display">Share</span>
            <span className="text-xs font-normal text-muted-foreground">
              {shareCount.toLocaleString()} share{shareCount === 1 ? "" : "s"}
            </span>
          </SheetTitle>
        </SheetHeader>

        {/* Share destinations row */}
        <div className="scrollbar-none flex gap-4 overflow-x-auto px-5 py-3">
          {shareActions.map((a) => (
            <button
              key={a.key}
              onClick={a.onClick}
              disabled={busy === a.key}
              className="flex w-16 shrink-0 flex-col items-center gap-1.5 transition active:scale-90 disabled:opacity-50"
            >
              <div
                className={`flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${a.color} shadow-lg`}
              >
                {busy === a.key ? (
                  <Loader2 className="h-6 w-6 animate-spin text-white" />
                ) : (
                  <a.icon className="h-6 w-6 text-white" />
                )}
              </div>
              <span className="text-[11px] font-medium text-foreground/90">{a.label}</span>
            </button>
          ))}
        </div>

        {/* Utilities row */}
        <div className="scrollbar-none flex gap-3 overflow-x-auto border-t border-border/60 px-5 py-4">
          {utilities.map((u) => (
            <button
              key={u.label}
              onClick={u.onClick}
              disabled={busy === u.busyKey}
              className="flex w-20 shrink-0 flex-col items-center gap-1.5 rounded-xl py-1 transition active:scale-95 disabled:opacity-50"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary">
                {busy === u.busyKey ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <u.icon className="h-5 w-5 text-foreground" />
                )}
              </div>
              <span className="text-center text-[11px] leading-tight text-foreground/90">
                {u.label}
              </span>
            </button>
          ))}
        </div>

        {/* Player controls */}
        <div className="border-t border-border/60 px-5 py-2">
          <ToggleRow
            icon={ChevronsDown}
            label="Auto Scroll"
            description="Play the next video automatically"
            value={settings.autoScroll}
            onChange={(v) => setSetting("autoScroll", v)}
          />
          <button
            onClick={() => setSpeedOpen((o) => !o)}
            className="flex w-full items-center justify-between py-3"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary">
                <Gauge className="h-5 w-5" />
              </div>
              <div className="text-left">
                <div className="text-sm font-medium">Playback Speed</div>
                <div className="text-xs text-muted-foreground">Current: {settings.playbackSpeed}×</div>
              </div>
            </div>
            <span className="text-sm font-semibold text-primary">{settings.playbackSpeed}×</span>
          </button>
          {speedOpen && (
            <div className="-mt-1 flex flex-wrap gap-2 pb-3 pl-13">
              {SPEEDS.map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    setSetting("playbackSpeed", s);
                    setSpeedOpen(false);
                  }}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                    settings.playbackSpeed === s
                      ? "gradient-zing text-zing-foreground shadow-zing"
                      : "bg-secondary text-foreground hover:bg-muted"
                  }`}
                >
                  {s}×
                </button>
              ))}
            </div>
          )}
          <ToggleRow
            icon={Sun}
            label="Clear Display"
            description="Hide all overlays for an immersive view"
            value={settings.clearDisplay}
            onChange={(v) => setSetting("clearDisplay", v)}
          />
          <ToggleRow
            icon={WifiOff}
            label="Data Saver"
            description="Lower video quality and pause auto-preload"
            value={settings.dataSaver}
            onChange={(v) => setSetting("dataSaver", v)}
          />
        </div>

        {/* Report sheet */}
        {reportOpen && (
          <div className="animate-in fade-in slide-in-from-bottom-4 border-t border-border/60 px-5 py-4">
            <div className="mb-3 text-sm font-semibold">Why are you reporting?</div>
            <div className="flex flex-col gap-1.5">
              {REPORT_REASONS.map((r) => (
                <button
                  key={r}
                  disabled={busy === "report"}
                  onClick={() => submitReport(r)}
                  className="flex items-center justify-between rounded-xl bg-secondary px-4 py-3 text-left text-sm transition hover:bg-muted disabled:opacity-50"
                >
                  <span>{r}</span>
                  <Flag className="h-4 w-4 text-muted-foreground" />
                </button>
              ))}
              <button
                onClick={() => setReportOpen(false)}
                className="mt-2 rounded-xl py-2.5 text-sm text-muted-foreground"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <button
          onClick={onClose}
          className="sticky bottom-0 z-10 w-full border-t border-border/60 bg-popover/95 py-4 text-sm font-semibold backdrop-blur"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0) + 1rem)" }}
        >
          Cancel
        </button>
      </SheetContent>
    </Sheet>
  );
}

function ToggleRow({
  icon: Icon,
  label,
  description,
  value,
  onChange,
}: {
  icon: typeof Share2;
  label: string;
  description: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!value)}
      className="flex w-full items-center justify-between gap-3 py-3"
    >
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary">
          <Icon className="h-5 w-5" />
        </div>
        <div className="text-left">
          <div className="text-sm font-medium">{label}</div>
          <div className="text-xs text-muted-foreground">{description}</div>
        </div>
      </div>
      <span
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition ${
          value ? "gradient-zing" : "bg-muted"
        }`}
      >
        <span
          className={`absolute h-5 w-5 rounded-full bg-white shadow transition ${
            value ? "translate-x-5" : "translate-x-0.5"
          }`}
        />
      </span>
    </button>
  );
}
