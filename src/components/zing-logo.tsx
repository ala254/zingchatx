import logo from "@/assets/zingchatx-logo.png.asset.json";

/** Official ZingChatX logo mark — use everywhere instead of placeholder icons. */
export function ZingLogo({
  className = "",
  size = 40,
  showWordmark = false,
}: {
  className?: string;
  size?: number;
  showWordmark?: boolean;
}) {
  if (showWordmark) {
    return (
      <span className={`inline-flex items-center gap-2 ${className}`}>
        <img
          src={logo.url}
          alt="ZingChatX"
          width={size}
          height={size}
          className="rounded-xl object-cover"
          style={{ width: size, height: size }}
          draggable={false}
        />
        <span className="font-display text-xl font-bold tracking-tight text-white">
          Zing<span style={{ color: "#FF2D55" }}>ChatX</span>
        </span>
      </span>
    );
  }
  return (
    <img
      src={logo.url}
      alt="ZingChatX"
      width={size}
      height={size}
      className={`rounded-xl object-cover ${className}`}
      style={{ width: size, height: size }}
      draggable={false}
    />
  );
}

export const ZING_LOGO_URL = logo.url;
