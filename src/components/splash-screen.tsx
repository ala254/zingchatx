import { useEffect, useState } from "react";
import { ZING_LOGO_URL } from "@/components/zing-logo";

/**
 * Premium ZingChatX splash overlay.
 *
 * Renders a full-screen dark splash with the official logo, wordmark,
 * tagline, and an animated 3-dot loader. Fades out after ~2s.
 *
 * On native (Capacitor) the native SplashScreen plugin handles the very first
 * paint (no white flash); this web overlay then takes over seamlessly with
 * the same dark background so the transition is invisible.
 */
export function SplashScreen() {
  const [visible, setVisible] = useState(true);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const fadeTimer = setTimeout(() => setFading(true), 1800);
    const removeTimer = setTimeout(() => setVisible(false), 2400);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(removeTimer);
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      aria-hidden
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center overflow-hidden"
      style={{
        background:
          "radial-gradient(ellipse at center, #14030A 0%, #000000 70%)",
        opacity: fading ? 0 : 1,
        transition: "opacity 600ms ease-out",
        pointerEvents: fading ? "none" : "auto",
      }}
    >
      {/* Ambient brand glow */}
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(255,45,85,0.35) 0%, rgba(230,0,76,0.15) 40%, rgba(0,0,0,0) 70%)",
          filter: "blur(20px)",
          animation: "zing-splash-pulse 2.4s ease-in-out infinite",
        }}
      />

      {/* Logo */}
      <div
        className="relative"
        style={{
          animation:
            "zing-splash-logo-in 900ms cubic-bezier(0.22, 1, 0.36, 1) both",
        }}
      >
        <img
          src={ZING_LOGO_URL}
          alt="ZingChatX"
          width={240}
          height={240}
          draggable={false}
          className="rounded-[36px] object-cover"
          style={{
            width: "min(240px, 60vw)",
            height: "min(240px, 60vw)",
            boxShadow:
              "0 0 60px rgba(255,45,85,0.55), 0 0 120px rgba(230,0,76,0.35)",
          }}
        />
      </div>

      {/* Wordmark + tagline */}
      <div
        className="mt-8 flex flex-col items-center px-6 text-center"
        style={{
          animation:
            "zing-splash-text-in 900ms 250ms cubic-bezier(0.22, 1, 0.36, 1) both",
        }}
      >
        <h1
          className="font-display text-4xl font-extrabold tracking-tight text-white"
          style={{ letterSpacing: "-0.02em" }}
        >
          Zing<span style={{ color: "#FF2D55" }}>ChatX</span>
        </h1>
        <p className="mt-3 text-sm font-medium tracking-[0.25em] text-white/50 uppercase">
          Connect · Chat · Share
        </p>
      </div>

      {/* Loader dots */}
      <div
        className="absolute bottom-24 flex items-center gap-2"
        style={{
          animation: "zing-splash-text-in 900ms 500ms ease-out both",
        }}
      >
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="block h-2 w-2 rounded-full"
            style={{
              background: "#FF2D55",
              animation: `zing-splash-dot 1.15s ${i * 0.15}s infinite ease-in-out`,
            }}
          />
        ))}
      </div>

      <style>{`
        @keyframes zing-splash-logo-in {
          0% { opacity: 0; transform: scale(0.82); filter: blur(8px); }
          60% { opacity: 1; filter: blur(0); }
          100% { opacity: 1; transform: scale(1); filter: blur(0); }
        }
        @keyframes zing-splash-text-in {
          0% { opacity: 0; transform: translateY(12px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes zing-splash-pulse {
          0%, 100% { opacity: 0.55; transform: translate(-50%, -50%) scale(0.95); }
          50% { opacity: 0.9; transform: translate(-50%, -50%) scale(1.05); }
        }
        @keyframes zing-splash-dot {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.35; }
          40% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
