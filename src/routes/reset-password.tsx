import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [{ title: "Reset password — ZingChatX" }] }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) return toast.error("Password must be at least 8 characters");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Password updated");
    navigate({ to: "/feed" });
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <form onSubmit={handleSubmit} className="w-full max-w-sm rounded-3xl border border-border bg-surface p-8">
        <h1 className="font-display text-2xl font-semibold">Set a new password</h1>
        <input
          type="password"
          placeholder="new password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-6 w-full rounded-xl border border-border bg-input px-4 py-3 text-sm focus:border-primary focus:outline-none"
          required
          minLength={8}
        />
        <button
          type="submit"
          disabled={busy}
          className="mt-4 w-full rounded-full gradient-zing px-4 py-3 text-sm font-semibold text-zing-foreground shadow-zing disabled:opacity-50"
        >
          Update password
        </button>
      </form>
    </div>
  );
}
