import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Check, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Route as AuthRoute } from "../_authenticated/route";
import { toast } from "sonner";

type MsgSetting = "everyone" | "followers" | "none";

export const Route = createFileRoute("/_authenticated/settings/privacy")({
  head: () => ({ meta: [{ title: "Privacy — ZingChatX" }] }),
  component: PrivacyPage,
});

function PrivacyPage() {
  const { user } = AuthRoute.useRouteContext();
  const [isPrivate, setIsPrivate] = useState(false);
  const [msg, setMsg] = useState<MsgSetting>("everyone");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from("profiles").select("is_private, allow_messages_from").eq("id", user!.id).single().then(({ data }) => {
      if (data) { setIsPrivate(!!data.is_private); setMsg((data.allow_messages_from ?? "everyone") as MsgSetting); }
      setLoading(false);
    });
  }, [user]);

  async function update(patch: Record<string, unknown>) {
    const { error } = await supabase.from("profiles").update(patch as never).eq("id", user!.id);
    if (error) toast.error(error.message);
  }

  async function togglePrivate() {
    const next = !isPrivate;
    setIsPrivate(next);
    await update({ is_private: next });
  }

  async function pickMsg(v: MsgSetting) {
    setMsg(v);
    await update({ allow_messages_from: v });
  }

  if (loading) return <Loader2 className="mx-auto mt-8 h-5 w-5 animate-spin text-muted-foreground" />;

  return (
    <div className="mx-auto max-w-[480px] px-4 pt-4 pb-8">
      <div className="flex items-center gap-2">
        <Link to="/settings" className="rounded-full p-2 hover:bg-surface"><ArrowLeft className="h-5 w-5" /></Link>
        <h1 className="font-display text-xl font-bold">Privacy</h1>
      </div>

      <h2 className="mt-6 mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Account</h2>
      <div className="overflow-hidden rounded-2xl border border-border bg-surface">
        <button onClick={togglePrivate} className="flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-surface-elevated">
          <div className="flex-1">
            <p className="text-sm font-medium">Private account</p>
            <p className="text-xs text-muted-foreground">Only approved followers can see your videos</p>
          </div>
          <span className={`relative h-6 w-11 rounded-full transition ${isPrivate ? "bg-primary" : "bg-muted"}`}>
            <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${isPrivate ? "left-5" : "left-0.5"}`} />
          </span>
        </button>
      </div>

      <h2 className="mt-6 mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Who can message you</h2>
      <div className="overflow-hidden rounded-2xl border border-border bg-surface">
        {[
          { v: "everyone", label: "Everyone" },
          { v: "followers", label: "Followers only" },
          { v: "none", label: "No one" },
        ].map((o) => (
          <button key={o.v} onClick={() => pickMsg(o.v as MsgSetting)} className="flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-surface-elevated">
            <span className="flex-1 text-sm font-medium">{o.label}</span>
            {msg === o.v && <Check className="h-5 w-5 text-primary" />}
          </button>
        ))}
      </div>
    </div>
  );
}
