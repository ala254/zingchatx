import { useEffect, useRef, useState } from "react";
import { Heart } from "lucide-react";

type Burst = { id: number; left: number; hue: number };

export function LiveHeartsOverlay({ trigger }: { trigger: number }) {
  const [bursts, setBursts] = useState<Burst[]>([]);
  const idRef = useRef(0);
  useEffect(() => {
    if (trigger === 0) return;
    const b: Burst = { id: ++idRef.current, left: 20 + Math.random() * 60, hue: 340 + Math.random() * 20 };
    setBursts((s) => [...s, b].slice(-30));
    const t = setTimeout(() => setBursts((s) => s.filter((x) => x.id !== b.id)), 2500);
    return () => clearTimeout(t);
  }, [trigger]);
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {bursts.map((b) => (
        <span
          key={b.id}
          className="absolute bottom-24 animate-heart-rise"
          style={{ left: `${b.left}%`, color: `hsl(${b.hue} 90% 60%)` }}
        >
          <Heart className="h-8 w-8 drop-shadow" fill="currentColor" strokeWidth={0} />
        </span>
      ))}
      <style>{`
        @keyframes heart-rise {
          0% { transform: translateY(0) scale(0.6); opacity: 0; }
          15% { opacity: 1; transform: translateY(-30px) scale(1); }
          80% { opacity: 1; }
          100% { transform: translateY(-360px) scale(1.2) rotate(${Math.random() > 0.5 ? 12 : -12}deg); opacity: 0; }
        }
        .animate-heart-rise { animation: heart-rise 2.4s cubic-bezier(.2,.7,.4,1) forwards; }
      `}</style>
    </div>
  );
}
