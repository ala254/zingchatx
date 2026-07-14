import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, LogOut, Smartphone, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/settings/security")({
  head: () => ({ meta: [{ title: "Security — ZingChatX" }] }),
  component: SecurityPage,
});

function SecurityPage() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [session, setSession] = useState<{ email: string; lastSignIn: string | null } | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setSession({ email: data.user.email ?? "", lastSignIn: data.user.last_sign_in_at ?? null });
    });
  }, []);

  async function signOutAll() {
    if (!confirm("Sign out from all devices? You'll need to log in again everywhere.")) return;
    setBusy(true);
    const { error } = await supabase.auth.signOut({ scope: "global" });
    setBusy(false);
    if (error) return toast.error(error.message);
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="mx-auto max-w-[480px] px-4 pt-4 pb-8">
      <div className="flex items-center gap-2">
        <Link to="/settings" className="rounded-full p-2 hover:bg-surface"><ArrowLeft className="h-5 w-5" /></Link>
        <h1 className="font-display text-xl font-bold">Security</h1>
      </div>

      <h2 className="mt-6 mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Current session</h2>
      <div className="overflow-hidden rounded-2xl border border-border bg-surface">
        <div className="flex items-center gap-3 px-4 py-3.5">
          <Smartphone className="h-5 w-5 text-primary" />
          <div className="flex-1 min-w-0">
            <p className="truncate text-sm font-medium">{session?.email ?? "—"}</p>
            <p className="text-xs text-muted-foreground">
              This device{session?.lastSignIn ? ` · signed in ${new Date(session.lastSignIn).toLocaleString()}` : ""}
            </p>
          </div>
          <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary">Active</span>
        </div>
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        For your safety, individual session listings aren't shown. Use "Sign out all devices" to invalidate every session.
      </p>

      <button
        onClick={signOutAll}
        disabled={busy}
        className="mt-6 flex w-full items-center justify-center gap-2 rounded-full border border-destructive/40 bg-destructive/10 px-6 py-3 text-sm font-semibold text-destructive disabled:opacity-50"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
        Sign out from all devices
      </button>
    </div>
  );
}
