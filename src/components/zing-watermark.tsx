import { useEffect, useState } from "react";
import { ZING_LOGO_URL } from "./zing-logo";

type Corner = "br" | "bl" | "tl" | "tr";

const ORDER: Corner[] = ["br", "bl", "tr", "tl"];

const CORNER_CLASS: Record<Corner, string> = {
  br: "bottom-24 right-3",
  bl: "bottom-24 left-3",
  tr: "top-20 right-3",
  tl: "top-20 left-3",
};

/**
 * Official ZingChatX watermark. Always-on, non-removable.
 * Cycles between the four corners every ~10s and fades during the move
 * to discourage screen recording / cropping.
 */
export function ZingWatermark({ username }: { username?: string | null }) {
  const [idx, setIdx] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    let moveTimer: number;
    let fadeTimer: number;
    const schedule = () => {
      const delay = 8000 + Math.random() * 4000;
      moveTimer = window.setTimeout(() => {
        setVisible(false);
        fadeTimer = window.setTimeout(() => {
          setIdx((i) => (i + 1) % ORDER.length);
          setVisible(true);
          schedule();
        }, 600);
      }, delay);
    };
    schedule();
    return () => {
      window.clearTimeout(moveTimer);
      window.clearTimeout(fadeTimer);
    };
  }, []);

  const corner = ORDER[idx];

  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute z-[5] flex select-none items-center gap-1.5 rounded-full bg-black/40 px-2.5 py-1 backdrop-blur-sm transition-all duration-700 ease-out animate-watermark-float ${CORNER_CLASS[corner]}`}
      style={{
        opacity: visible ? 0.45 : 0,
        transform: visible ? "scale(1)" : "scale(0.92)",
        willChange: "opacity, transform",
      }}
    >
      <img
        src={ZING_LOGO_URL}
        alt=""
        width={18}
        height={18}
        className="h-[18px] w-[18px] rounded-md object-cover"
        draggable={false}
      />
      <span className="font-display text-[11px] font-semibold tracking-tight text-white drop-shadow">
        ZingChatX
      </span>
      {username && (
        <span className="text-[10px] font-medium text-white/85">· @{username}</span>
      )}
    </div>
  );
}
