import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Route as AuthRoute } from "../_authenticated/route";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/settings/notifications")({
  head: () => ({ meta: [{ title: "Notifications — ZingChatX" }] }),
  component: NotificationsPage,
});

function NotificationsPage() {
  const { user } = AuthRoute.useRouteContext();
  const [state, setState] = useState({ push_enabled: true, notify_likes: true, notify_comments: true, notify_follows: true });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from("profiles").select("push_enabled, notify_likes, notify_comments, notify_follows").eq("id", user!.id).single().then(({ data }) => {
      if (data) setState(data as typeof state);
      setLoading(false);
    });
  }, [user]);

  async function toggle<K extends keyof typeof state>(key: K) {
    const next = { ...state, [key]: !state[key] };
    setState(next);
    const { error } = await supabase.from("profiles").update({ [key]: next[key] }).eq("id", user!.id);
    if (error) { toast.error(error.message); setState(state); }
  }

  return (
    <div className="mx-auto max-w-[480px] px-4 pt-4 pb-8">
      <div className="flex items-center gap-2">
        <Link to="/settings" className="rounded-full p-2 hover:bg-surface"><ArrowLeft className="h-5 w-5" /></Link>
        <h1 className="font-display text-xl font-bold">Notifications</h1>
      </div>
      {loading ? <Loader2 className="mx-auto mt-8 h-5 w-5 animate-spin text-muted-foreground" /> : (
        <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-surface">
          <Toggle label="Push notifications" hint="Master switch for all notifications" value={state.push_enabled} onChange={() => toggle("push_enabled")} />
          <Toggle label="Likes" value={state.notify_likes} onChange={() => toggle("notify_likes")} />
          <Toggle label="Comments" value={state.notify_comments} onChange={() => toggle("notify_comments")} />
          <Toggle label="New followers" value={state.notify_follows} onChange={() => toggle("notify_follows")} />
        </div>
      )}
    </div>
  );
}

function Toggle({ label, hint, value, onChange }: { label: string; hint?: string; value: boolean; onChange: () => void }) {
  return (
    <button onClick={onChange} className="flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-surface-elevated">
      <div className="flex-1">
        <p className="text-sm font-medium">{label}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      <span className={`relative h-6 w-11 rounded-full transition ${value ? "bg-primary" : "bg-muted"}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${value ? "left-5" : "left-0.5"}`} />
      </span>
    </button>
  );
}
