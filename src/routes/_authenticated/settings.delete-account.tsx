import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { ArrowLeft, AlertTriangle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { deleteMyAccount } from "@/lib/account.functions";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/settings/delete-account")({
  head: () => ({ meta: [{ title: "Delete account — ZingChatX" }] }),
  component: DeleteAccountPage,
});

function DeleteAccountPage() {
  const navigate = useNavigate();
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const del = useServerFn(deleteMyAccount);
  const queryClient = useQueryClient();

  async function handleDelete() {
    if (confirm !== "DELETE") return toast.error('Type DELETE to confirm');
    setBusy(true);
    try {
      await del({});
      await queryClient.cancelQueries();
      queryClient.clear();
      await supabase.auth.signOut();
      toast.success("Account deleted");
      navigate({ to: "/auth", replace: true });
    } catch (e) {
      setBusy(false);
      toast.error(e instanceof Error ? e.message : "Delete failed");
    }
  }

  return (
    <div className="mx-auto max-w-[480px] px-4 pt-4 pb-8">
      <div className="flex items-center gap-2">
        <Link to="/settings" className="rounded-full p-2 hover:bg-surface"><ArrowLeft className="h-5 w-5" /></Link>
        <h1 className="font-display text-xl font-bold">Delete account</h1>
      </div>

      <div className="mt-6 rounded-2xl border border-destructive/40 bg-destructive/10 p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-destructive" />
          <div>
            <p className="text-sm font-semibold text-destructive">This action is permanent</p>
            <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
              <li>• All videos, likes, comments, and follows will be removed</li>
              <li>• Your profile and username will be released</li>
              <li>• Uploaded media will be deleted from storage</li>
              <li>• This cannot be undone</li>
            </ul>
          </div>
        </div>
      </div>

      <label className="mt-6 block">
        <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">Type DELETE to confirm</span>
        <input
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="DELETE"
          className="w-full rounded-xl border border-border bg-input px-4 py-3 text-sm focus:border-destructive focus:outline-none"
        />
      </label>

      <button
        onClick={handleDelete}
        disabled={busy || confirm !== "DELETE"}
        className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-destructive px-6 py-3 text-sm font-semibold text-destructive-foreground disabled:opacity-50"
      >
        {busy && <Loader2 className="h-4 w-4 animate-spin" />}
        Permanently delete my account
      </button>
    </div>
  );
}
