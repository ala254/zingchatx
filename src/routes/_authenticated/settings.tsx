import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRight, Bell, Lock, Globe, Trash2, Shield, User as UserIcon, KeyRound, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings — ZingChatX" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="mx-auto max-w-[480px] px-4 pt-4 pb-8">
      <h1 className="font-display text-2xl font-bold">Settings</h1>

      <Section title="Account">
        <Row icon={UserIcon} label="Edit profile" to="/settings/edit-profile" />
        <Row icon={KeyRound} label="Change password" to="/settings/change-password" />
      </Section>

      <Section title="Preferences">
        <Row icon={Bell} label="Notifications" to="/settings/notifications" />
        <Row icon={Globe} label="Language" to="/settings/language" />
        <Row icon={Lock} label="Privacy" to="/settings/privacy" />
        <Row icon={Shield} label="Security" to="/settings/security" />
      </Section>

      <Section title="Danger zone">
        <Row icon={LogOut} label="Sign out" onClick={handleSignOut} />
        <Row icon={Trash2} label="Delete account" destructive to="/settings/delete-account" />
      </Section>

      <p className="mt-8 text-center text-xs text-muted-foreground">ZingChatX · v0.1</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h2>
      <div className="overflow-hidden rounded-2xl border border-border bg-surface">{children}</div>
    </section>
  );
}

function Row({
  icon: Icon, label, hint, to, onClick, destructive,
}: { icon: typeof Bell; label: string; hint?: string; to?: string; onClick?: () => void; destructive?: boolean }) {
  const content = (
    <div className={`flex items-center gap-3 px-4 py-3.5 transition hover:bg-surface-elevated ${destructive ? "text-destructive" : ""}`}>
      <Icon className="h-5 w-5" />
      <span className="flex-1 text-sm font-medium">{label}</span>
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </div>
  );
  if (to) return <Link to={to}>{content}</Link>;
  return <button onClick={onClick} className="block w-full text-left">{content}</button>;
}
