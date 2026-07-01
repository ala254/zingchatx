import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { BadgeCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

// In-memory cache for signed avatar URLs so we don't re-sign on every render.
const cache = new Map<string, { url: string; exp: number }>();
const pending = new Map<string, Promise<string | null>>();
const TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

function extractAvatarPath(value: string | null | undefined): string | null {
  if (!value) return null;
  const m = value.match(/\/object\/(?:public|sign)\/avatars\/([^?]+)/);
  if (m) return decodeURIComponent(m[1]);
  if (/^https?:\/\//i.test(value)) return value; // external URL (e.g. Google avatar) — use directly
  return value; // already a storage path
}

async function resolveAvatar(value: string | null | undefined): Promise<string | null> {
  const path = extractAvatarPath(value);
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  const now = Date.now() / 1000;
  const hit = cache.get(path);
  if (hit && hit.exp > now + 60) return hit.url;
  const inFlight = pending.get(path);
  if (inFlight) return inFlight;
  const promise = supabase.storage
    .from("avatars")
    .createSignedUrl(path, TTL_SECONDS)
    .then(({ data }) => {
      if (data?.signedUrl) {
        cache.set(path, { url: data.signedUrl, exp: now + TTL_SECONDS });
        return data.signedUrl;
      }
      return null;
    })
    .finally(() => pending.delete(path));
  pending.set(path, promise);
  return promise;
}

export function useAvatarUrl(raw: string | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(() => {
    const p = extractAvatarPath(raw);
    if (!p) return null;
    if (/^https?:\/\//i.test(p)) return p;
    const hit = cache.get(p);
    return hit ? hit.url : null;
  });
  useEffect(() => {
    let alive = true;
    resolveAvatar(raw).then((u) => {
      if (alive) setUrl(u);
    });
    return () => {
      alive = false;
    };
  }, [raw]);
  return url;
}

type Size = "xs" | "sm" | "md" | "lg" | "xl" | "2xl";
const sizeMap: Record<Size, string> = {
  xs: "h-7 w-7 text-[10px]",
  sm: "h-9 w-9 text-xs",
  md: "h-11 w-11 text-sm",
  lg: "h-14 w-14 text-base",
  xl: "h-20 w-20 text-xl",
  "2xl": "h-24 w-24 text-3xl",
};
const badgeSize: Record<Size, string> = {
  xs: "h-3 w-3",
  sm: "h-3.5 w-3.5",
  md: "h-4 w-4",
  lg: "h-4 w-4",
  xl: "h-5 w-5",
  "2xl": "h-6 w-6",
};

export function UserAvatar({
  username,
  avatarUrl,
  verified,
  size = "md",
  linkTo = true,
  className = "",
  ring = false,
}: {
  username: string | null | undefined;
  avatarUrl: string | null | undefined;
  verified?: boolean | null;
  size?: Size;
  linkTo?: boolean;
  className?: string;
  ring?: boolean;
}) {
  const resolved = useAvatarUrl(avatarUrl);
  const initial = (username?.[0] ?? "?").toUpperCase();
  const inner = (
    <span className={`relative inline-block ${className}`}>
      <span
        className={`flex ${sizeMap[size]} items-center justify-center overflow-hidden rounded-full bg-secondary ${
          ring ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : ""
        }`}
      >
        {resolved ? (
          <img src={resolved} alt="" className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <span className="font-display font-bold text-gradient-zing">{initial}</span>
        )}
      </span>
      {verified ? (
        <BadgeCheck
          className={`absolute -bottom-0.5 -right-0.5 ${badgeSize[size]} rounded-full bg-background text-primary`}
          strokeWidth={2.5}
        />
      ) : null}
    </span>
  );
  if (linkTo && username) {
    return (
      <Link to="/u/$username" params={{ username }} onClick={(e) => e.stopPropagation()}>
        {inner}
      </Link>
    );
  }
  return inner;
}
