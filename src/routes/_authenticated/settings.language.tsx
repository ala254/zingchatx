import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Route as AuthRoute } from "../_authenticated/route";
import { toast } from "sonner";

const LANGS = [
  { code: "en", label: "English", native: "English" },
  { code: "ha", label: "Hausa", native: "Hausa" },
] as const;

export const Route = createFileRoute("/_authenticated/settings/language")({
  head: () => ({ meta: [{ title: "Language — ZingChatX" }] }),
  component: LanguagePage,
});

function LanguagePage() {
  const { user } = AuthRoute.useRouteContext();
  const navigate = useNavigate();
  const [current, setCurrent] = useState<string>("en");

  useEffect(() => {
    supabase.from("profiles").select("language").eq("id", user!.id).single().then(({ data }) => {
      if (data?.language) setCurrent(data.language);
    });
  }, [user]);

  async function pick(code: string) {
    setCurrent(code);
    const { error } = await supabase.from("profiles").update({ language: code }).eq("id", user!.id);
    if (error) return toast.error(error.message);
    toast.success("Language updated");
    navigate({ to: "/settings" });
  }

  return (
    <div className="mx-auto max-w-[480px] px-4 pt-4 pb-8">
      <div className="flex items-center gap-2">
        <Link to="/settings" className="rounded-full p-2 hover:bg-surface"><ArrowLeft className="h-5 w-5" /></Link>
        <h1 className="font-display text-xl font-bold">Language</h1>
      </div>
      <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-surface">
        {LANGS.map((l) => (
          <button key={l.code} onClick={() => pick(l.code)} className="flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-surface-elevated">
            <div className="flex-1">
              <p className="text-sm font-medium">{l.label}</p>
              <p className="text-xs text-muted-foreground">{l.native}</p>
            </div>
            {current === l.code && <Check className="h-5 w-5 text-primary" />}
          </button>
        ))}
      </div>
    </div>
  );
}
