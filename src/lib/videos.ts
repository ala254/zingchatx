import { supabase } from "@/integrations/supabase/client";

export type FeedVideo = {
  id: string;
  user_id: string;
  video_url: string;
  thumbnail_url: string | null;
  caption: string | null;
  hashtags: string[] | null;
  location: string | null;
  created_at: string;
  profile: { username: string; display_name: string | null; avatar_url: string | null } | null;
  likes_count: number;
  comments_count: number;
  shares_count: number;
  liked_by_me: boolean;
  saved_by_me: boolean;
};

// Storage buckets are private — we sign URLs at read time.
const SIGN_TTL = 60 * 60 * 24 * 7; // 7 days

function extractPath(value: string | null | undefined, bucket: string): string | null {
  if (!value) return null;
  const m = value.match(new RegExp(`/object/(?:public|sign)/${bucket}/([^?]+)`));
  if (m) return decodeURIComponent(m[1]);
  if (/^https?:\/\//i.test(value)) return null;
  return value; // already a storage path
}

export async function signStorageUrls(
  bucket: string,
  values: (string | null | undefined)[],
): Promise<(string | null)[]> {
  const paths = values.map((v) => extractPath(v, bucket));
  const unique = Array.from(new Set(paths.filter((p): p is string => !!p)));
  if (unique.length === 0) return values.map(() => null);
  const { data, error } = await supabase.storage.from(bucket).createSignedUrls(unique, SIGN_TTL);
  if (error) {
    console.error("createSignedUrls failed", bucket, error);
    return values.map(() => null);
  }
  const map = new Map<string, string>();
  (data ?? []).forEach((d) => {
    if (d.path && d.signedUrl) map.set(d.path, d.signedUrl);
  });
  return paths.map((p) => (p ? map.get(p) ?? null : null));
}

export async function signOne(bucket: string, value: string | null | undefined): Promise<string | null> {
  const [u] = await signStorageUrls(bucket, [value]);
  return u;
}

export async function fetchFeed(currentUserId: string | null): Promise<FeedVideo[]> {
  const { data, error } = await supabase
    .from("videos")
    .select(
      "id, user_id, video_url, thumbnail_url, caption, hashtags, location, created_at, profiles!videos_user_id_profiles_fkey(username, display_name, avatar_url)",
    )
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  const rows = data ?? [];
  const ids = rows.map((v) => v.id);
  if (ids.length === 0) return [];

  const [likes, comments, shares, myLikes, mySaves, videoUrls, thumbUrls] = await Promise.all([
    supabase.from("likes").select("video_id").in("video_id", ids),
    supabase.from("comments").select("video_id").in("video_id", ids),
    supabase.from("shares").select("video_id").in("video_id", ids),
    currentUserId
      ? supabase.from("likes").select("video_id").in("video_id", ids).eq("user_id", currentUserId)
      : Promise.resolve({ data: [] as { video_id: string }[], error: null }),
    currentUserId
      ? supabase.from("saves").select("video_id").in("video_id", ids).eq("user_id", currentUserId)
      : Promise.resolve({ data: [] as { video_id: string }[], error: null }),
    signStorageUrls("videos", rows.map((v) => v.video_url)),
    signStorageUrls("thumbnails", rows.map((v) => v.thumbnail_url)),
  ]);

  const likeCount = new Map<string, number>();
  (likes.data ?? []).forEach((l) => likeCount.set(l.video_id, (likeCount.get(l.video_id) ?? 0) + 1));
  const commentCount = new Map<string, number>();
  (comments.data ?? []).forEach((c) => commentCount.set(c.video_id, (commentCount.get(c.video_id) ?? 0) + 1));
  const shareCount = new Map<string, number>();
  (shares.data ?? []).forEach((s) => shareCount.set(s.video_id, (shareCount.get(s.video_id) ?? 0) + 1));
  const likedSet = new Set((myLikes.data ?? []).map((l) => l.video_id));
  const savedSet = new Set((mySaves.data ?? []).map((s) => s.video_id));

  return rows.map((v, i) => ({
    id: v.id,
    user_id: v.user_id,
    video_url: videoUrls[i] ?? v.video_url,
    thumbnail_url: thumbUrls[i] ?? v.thumbnail_url,
    caption: v.caption,
    hashtags: v.hashtags,
    location: v.location,
    created_at: v.created_at,
    profile: Array.isArray(v.profiles) ? v.profiles[0] ?? null : v.profiles,
    likes_count: likeCount.get(v.id) ?? 0,
    comments_count: commentCount.get(v.id) ?? 0,
    shares_count: shareCount.get(v.id) ?? 0,
    liked_by_me: likedSet.has(v.id),
    saved_by_me: savedSet.has(v.id),
  }));
}

export function publicUrl(bucket: string, path: string): string {
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}
