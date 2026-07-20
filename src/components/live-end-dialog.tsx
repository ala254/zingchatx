import { X, Users, Heart, Coins } from "lucide-react";
import type { LiveStream } from "@/lib/live";

export function LiveEndConfirm({ open, onCancel, onConfirm }: { open: boolean; onCancel: () => void; onConfirm: () => void }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-3xl bg-surface p-6 shadow-2xl">
        <h3 className="font-display text-xl font-bold">End live?</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Your viewers will be disconnected. You can start another live any time.
        </p>
        <div className="mt-6 flex gap-2">
          <button onClick={onCancel} className="flex-1 rounded-full border border-border bg-surface-elevated px-4 py-2.5 text-sm font-semibold">
            Keep live
          </button>
          <button onClick={onConfirm} className="flex-1 rounded-full bg-red-500 px-4 py-2.5 text-sm font-semibold text-white">
            End live
          </button>
        </div>
      </div>
    </div>
  );
}

export function LiveSummary({ stream, onClose }: { stream: LiveStream; onClose: () => void }) {
  const durationMs = stream.ended_at ? new Date(stream.ended_at).getTime() - new Date(stream.started_at).getTime() : 0;
  const min = Math.floor(durationMs / 60000);
  const sec = Math.floor((durationMs % 60000) / 1000);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6 backdrop-blur-sm">
      <div className="relative w-full max-w-sm rounded-3xl bg-surface p-6 text-center shadow-2xl">
        <button onClick={onClose} className="absolute right-3 top-3 rounded-full bg-secondary p-1.5">
          <X className="h-4 w-4" />
        </button>
        <h3 className="font-display text-2xl font-bold text-gradient-zing">Live ended</h3>
        <p className="mt-1 text-sm text-muted-foreground">Duration {min}m {sec}s</p>
        <div className="mt-6 grid grid-cols-3 gap-3">
          <Stat icon={<Users className="h-4 w-4 text-cyan-400" />} value={stream.viewer_peak} label="Peak" />
          <Stat icon={<Heart className="h-4 w-4 text-pink-400" />} value={stream.likes_count} label="Likes" />
          <Stat icon={<Coins className="h-4 w-4 text-amber-400" />} value={stream.gifts_total_coins} label="Coins" />
        </div>
      </div>
    </div>
  );
}

function Stat({ icon, value, label }: { icon: React.ReactNode; value: number; label: string }) {
  return (
    <div className="flex flex-col items-center rounded-2xl bg-surface-elevated py-3">
      {icon}
      <span className="mt-1 font-display text-lg font-bold">{value}</span>
      <span className="text-[10px] text-muted-foreground">{label}</span>
    </div>
  );
}
