import { Sparkles } from "lucide-react";

/** Always-on, non-removable watermark overlay shown during playback. */
export function ZingWatermark({ username }: { username?: string | null }) {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute bottom-24 right-3 z-[5] flex select-none items-center gap-1.5 rounded-full bg-black/25 px-2.5 py-1 backdrop-blur-sm"
      style={{ mixBlendMode: "screen" }}
    >
      <Sparkles className="h-3 w-3 text-cyan-glow drop-shadow" />
      <span className="font-display text-[11px] font-semibold tracking-tight text-white/85 drop-shadow">
        ZingChatX
      </span>
      {username && (
        <span className="text-[10px] font-medium text-white/65">· @{username}</span>
      )}
    </div>
  );
}
