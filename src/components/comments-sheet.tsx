import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { X, Send, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { UserAvatar } from "@/components/user-avatar";

type Comment = {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  profile: { username: string; avatar_url: string | null } | null;
};

export function CommentsSheet({
  videoId,
  currentUserId,
  onClose,
}: {
  videoId: string | null;
  currentUserId: string | null;
  onClose: () => void;
}) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!videoId) return;
    setLoading(true);
    supabase
      .from("comments")
      .select("id, content, created_at, user_id, profiles!comments_user_id_profiles_fkey(username, avatar_url)")
      .eq("video_id", videoId)
      .order("created_at", { ascending: false })
      .limit(100)
      .then(({ data }) => {
        setComments(
          (data ?? []).map((c) => ({
            id: c.id,
            content: c.content,
            created_at: c.created_at,
            user_id: c.user_id,
            profile: Array.isArray(c.profiles) ? c.profiles[0] ?? null : c.profiles,
          })),
        );
        setLoading(false);
      });
  }, [videoId]);

  async function handleSend() {
    if (!videoId || !currentUserId || !text.trim()) return;
    setSending(true);
    const { data, error } = await supabase
      .from("comments")
      .insert({ video_id: videoId, user_id: currentUserId, content: text.trim() })
      .select("id, content, created_at, user_id, profiles!comments_user_id_profiles_fkey(username, avatar_url)")
      .single();
    setSending(false);
    if (error) return toast.error(error.message);
    if (data) {
      setComments((prev) => [
        {
          id: data.id,
          content: data.content,
          created_at: data.created_at,
          user_id: data.user_id,
          profile: Array.isArray(data.profiles) ? data.profiles[0] ?? null : data.profiles,
        },
        ...prev,
      ]);
      setText("");
    }
  }

  if (!videoId) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative flex h-[70vh] w-full max-w-[480px] flex-col rounded-t-3xl border border-border bg-surface-elevated"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h3 className="font-display text-base font-semibold">
            {comments.length} comment{comments.length === 1 ? "" : "s"}
          </h3>
          <button onClick={onClose} className="rounded-full p-1 hover:bg-secondary">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-3 scrollbar-none">
          {loading ? (
            <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : comments.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Be the first to comment.</p>
          ) : (
            comments.map((c) => (
              <div key={c.id} className="flex gap-3 py-3">
                <div className="h-9 w-9 flex-shrink-0 overflow-hidden rounded-full bg-secondary">
                  {c.profile?.avatar_url ? (
                    <img src={c.profile.avatar_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-sm font-bold">
                      {c.profile?.username?.[0]?.toUpperCase() ?? "?"}
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold">@{c.profile?.username}</p>
                  <p className="text-sm text-muted-foreground">{c.content}</p>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="flex items-center gap-2 border-t border-border p-3" style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0) + 0.75rem)" }}>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder={currentUserId ? "Add a comment…" : "Sign in to comment"}
            disabled={!currentUserId}
            maxLength={500}
            className="flex-1 rounded-full border border-border bg-input px-4 py-2.5 text-sm focus:border-primary focus:outline-none disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={!text.trim() || sending || !currentUserId}
            className="flex h-10 w-10 items-center justify-center rounded-full gradient-zing text-zing-foreground shadow-zing disabled:opacity-40"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
