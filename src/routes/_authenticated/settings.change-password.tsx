import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/settings/change-password")({
  head: () => ({ meta: [{ title: "Change password — ZingChatX" }] }),
  component: ChangePasswordPage,
});

function ChangePasswordPage() {
  const navigate = useNavigate();
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSave() {
    if (pw.length < 8) return toast.error("Password must be at least 8 characters");
    if (pw !== confirm) return toast.error("Passwords don't match");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Password updated");
    navigate({ to: "/settings" });
  }

  return (
    <div className="mx-auto max-w-[480px] px-4 pt-4 pb-8">
      <div className="flex items-center gap-2">
        <Link to="/settings" className="rounded-full p-2 hover:bg-surface"><ArrowLeft className="h-5 w-5" /></Link>
        <h1 className="font-display text-xl font-bold">Change password</h1>
      </div>
      <div className="mt-6 space-y-3">
        <Field label="New password">
          <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" className="w-full rounded-xl border border-border bg-input px-4 py-3 text-sm focus:border-primary focus:outline-none" />
        </Field>
        <Field label="Confirm password">
          <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" className="w-full rounded-xl border border-border bg-input px-4 py-3 text-sm focus:border-primary focus:outline-none" />
        </Field>
      </div>
      <button onClick={handleSave} disabled={busy} className="mt-6 flex w-full items-center justify-center gap-2 rounded-full gradient-zing px-6 py-3 text-sm font-semibold text-zing-foreground shadow-zing disabled:opacity-50">
        {busy && <Loader2 className="h-4 w-4 animate-spin" />}
        Update password
      </button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
