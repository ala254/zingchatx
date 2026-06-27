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
  liked_by_me: boolean;
  saved_by_me: boolean;
};

export async function fetchFeed(currentUserId: string | null): Promise<FeedVideo[]> {
  const { data, error } = await supabase
    .from("videos")
    .select("id, user_id, video_url, thumbnail_url, caption, hashtags, location, created_at, profiles!videos_user_id_fkey(username, display_name, avatar_url)")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  const ids = (data ?? []).map((v) => v.id);
  if (ids.length === 0) return [];

  const [likes, comments, myLikes, mySaves] = await Promise.all([
    supabase.from("likes").select("video_id").in("video_id", ids),
    supabase.from("comments").select("video_id").in("video_id", ids),
    currentUserId
      ? supabase.from("likes").select("video_id").in("video_id", ids).eq("user_id", currentUserId)
      : Promise.resolve({ data: [] as { video_id: string }[], error: null }),
    currentUserId
      ? supabase.from("saves").select("video_id").in("video_id", ids).eq("user_id", currentUserId)
      : Promise.resolve({ data: [] as { video_id: string }[], error: null }),
  ]);

  const likeCount = new Map<string, number>();
  (likes.data ?? []).forEach((l) => likeCount.set(l.video_id, (likeCount.get(l.video_id) ?? 0) + 1));
  const commentCount = new Map<string, number>();
  (comments.data ?? []).forEach((c) => commentCount.set(c.video_id, (commentCount.get(c.video_id) ?? 0) + 1));
  const likedSet = new Set((myLikes.data ?? []).map((l) => l.video_id));
  const savedSet = new Set((mySaves.data ?? []).map((s) => s.video_id));

  return (data ?? []).map((v) => ({
    id: v.id,
    user_id: v.user_id,
    video_url: v.video_url,
    thumbnail_url: v.thumbnail_url,
    caption: v.caption,
    hashtags: v.hashtags,
    location: v.location,
    created_at: v.created_at,
    profile: Array.isArray(v.profiles) ? v.profiles[0] ?? null : v.profiles,
    likes_count: likeCount.get(v.id) ?? 0,
    comments_count: commentCount.get(v.id) ?? 0,
    liked_by_me: likedSet.has(v.id),
    saved_by_me: savedSet.has(v.id),
  }));
}

export function publicUrl(bucket: string, path: string): string {
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}
