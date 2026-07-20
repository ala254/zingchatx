import { supabase } from "@/integrations/supabase/client";

export type LiveStream = {
  id: string;
  host_id: string;
  agora_channel: string;
  title: string | null;
  thumbnail_url: string | null;
  status: "scheduled" | "live" | "ended";
  started_at: string;
  ended_at: string | null;
  viewer_count: number;
  viewer_peak: number;
  likes_count: number;
  gifts_total_coins: number;
  host?: { username: string; display_name: string | null; avatar_url: string | null; verified: boolean } | null;
};

export type CoinPack = { id: string; coins: number; price_cents: number; currency: string; stripe_price_id: string | null };
export type Gift = { id: string; name: string; glyph: string; coin_cost: number; animation: string };
export type Wallet = { user_id: string; coin_balance: number; earned_coins: number };

export async function fetchLiveStreams(): Promise<LiveStream[]> {
  const { data, error } = await supabase
    .from("live_streams")
    .select("*, host:profiles!live_streams_host_id_fkey(username, display_name, avatar_url, verified)")
    .eq("status", "live")
    .order("viewer_count", { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []) as unknown as LiveStream[];
}

export async function fetchLiveByFollowed(userId: string): Promise<LiveStream[]> {
  const { data: follows } = await supabase.from("follows").select("following_id").eq("follower_id", userId);
  const ids = (follows ?? []).map((f) => f.following_id);
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from("live_streams")
    .select("*, host:profiles!live_streams_host_id_fkey(username, display_name, avatar_url, verified)")
    .eq("status", "live")
    .in("host_id", ids)
    .order("started_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as LiveStream[];
}

export async function fetchStream(id: string): Promise<LiveStream | null> {
  const { data, error } = await supabase
    .from("live_streams")
    .select("*, host:profiles!live_streams_host_id_fkey(username, display_name, avatar_url, verified)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as LiveStream) ?? null;
}

export async function createStream(input: { title: string | null }): Promise<LiveStream> {
  const { data: userRes } = await supabase.auth.getUser();
  const uid = userRes.user?.id;
  if (!uid) throw new Error("not authenticated");
  const channel = `zcx_${uid.replace(/-/g, "").slice(0, 12)}_${Date.now().toString(36)}`;
  const { data, error } = await supabase
    .from("live_streams")
    .insert({ host_id: uid, agora_channel: channel, title: input.title, status: "live" })
    .select("*")
    .single();
  if (error) throw error;
  return data as unknown as LiveStream;
}

export async function endStream(streamId: string) {
  const { error } = await supabase.rpc("end_live", { _stream_id: streamId });
  if (error) throw error;
}

export async function joinLive(streamId: string) {
  await supabase.rpc("join_live", { _stream_id: streamId });
}
export async function leaveLive(streamId: string) {
  await supabase.rpc("leave_live", { _stream_id: streamId });
}

export async function sendHearts(streamId: string, count: number) {
  await supabase.rpc("record_heart_batch", { _stream_id: streamId, _count: count });
}

export async function sendGift(streamId: string, giftId: string, quantity: number) {
  const { data, error } = await supabase.rpc("send_gift", { _stream_id: streamId, _gift_id: giftId, _quantity: quantity });
  if (error) throw error;
  return data;
}

export async function postComment(streamId: string, content: string) {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("not authenticated");
  const { error } = await supabase.from("live_comments").insert({
    stream_id: streamId,
    user_id: u.user.id,
    content: content.slice(0, 200),
  });
  if (error) throw error;
}

export async function pinComment(id: string, pin: boolean) {
  const { error } = await supabase.from("live_comments").update({ is_pinned: pin }).eq("id", id);
  if (error) throw error;
}

export async function banUser(streamId: string, userId: string, reason?: string) {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("not authenticated");
  const { error } = await supabase.from("live_bans").insert({
    stream_id: streamId,
    user_id: userId,
    banned_by: u.user.id,
    reason: reason ?? null,
  });
  if (error) throw error;
}

export async function reportUser(streamId: string, reportedUserId: string, reason: string) {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("not authenticated");
  const { error } = await supabase.from("live_reports").insert({
    stream_id: streamId,
    reporter_id: u.user.id,
    reported_user_id: reportedUserId,
    reason,
  });
  if (error) throw error;
}

export async function addModerator(streamId: string, username: string) {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("not authenticated");
  const { data: prof, error: pErr } = await supabase.from("profiles").select("id").eq("username", username).maybeSingle();
  if (pErr) throw pErr;
  if (!prof) throw new Error("User not found");
  const { error } = await supabase.from("live_moderators").insert({
    stream_id: streamId,
    user_id: prof.id,
    granted_by: u.user.id,
  });
  if (error) throw error;
}

export async function fetchCoinPacks(): Promise<CoinPack[]> {
  const { data, error } = await supabase.from("coin_packs").select("*").eq("is_active", true).order("sort_order");
  if (error) throw error;
  return (data ?? []) as CoinPack[];
}

export async function fetchGifts(): Promise<Gift[]> {
  const { data, error } = await supabase.from("gifts_catalog").select("*").eq("is_active", true).order("sort_order");
  if (error) throw error;
  return (data ?? []) as Gift[];
}

export async function fetchWallet(userId: string): Promise<Wallet> {
  const { data } = await supabase.from("wallets").select("*").eq("user_id", userId).maybeSingle();
  if (data) return data as Wallet;
  // create if missing
  await supabase.from("wallets").insert({ user_id: userId }).select().maybeSingle();
  return { user_id: userId, coin_balance: 0, earned_coins: 0 };
}

export async function fetchWalletLedger(userId: string, limit = 50) {
  const { data, error } = await supabase
    .from("wallet_ledger")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function requestWithdrawal(userId: string, coins: number) {
  // 100 coins = $1.00 for creators
  const amount_cents = Math.floor(coins);
  const { error } = await supabase
    .from("withdrawal_requests")
    .insert({ user_id: userId, coins, amount_cents });
  if (error) throw error;
}

export async function fetchLiveHistory(userId: string) {
  const { data, error } = await supabase
    .from("live_streams")
    .select("*")
    .eq("host_id", userId)
    .order("started_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return data ?? [];
}
