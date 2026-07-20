import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { Toaster } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";
import { initNative } from "@/lib/native";
import { SplashScreen } from "@/components/splash-screen";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-7xl font-bold text-gradient-zing">404</h1>
        <h2 className="mt-4 text-xl font-semibold">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          This page doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-full gradient-zing px-6 py-2.5 text-sm font-semibold text-zing-foreground shadow-zing"
          >
            Back to ZingChatX
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold">Something glitched</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          We hit a snag loading this page. Try again or head home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => { router.invalidate(); reset(); }}
            className="inline-flex items-center justify-center rounded-full gradient-zing px-5 py-2 text-sm font-semibold text-zing-foreground shadow-zing"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-full border border-border bg-surface px-5 py-2 text-sm font-medium text-foreground"
          >
            Home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "theme-color", content: "#0D0D0D" },
      { title: "ZingChatX — Short videos, big moments" },
      { name: "description", content: "ZingChatX is a vertical short-video network. Scroll, like, follow, and upload from anywhere." },
      { property: "og:title", content: "ZingChatX" },
      { property: "og:description", content: "Short videos, big moments." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap",
      },
      { rel: "icon", type: "image/png", href: "/__l5e/assets-v1/b3496de0-7af5-44e1-996b-4e1762abd2f8/zingchatx-logo.png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      router.invalidate();
      if (event !== "SIGNED_OUT") queryClient.invalidateQueries();
    });
    // Initialise Capacitor bridge (no-op on web).
    void initNative(router);
    return () => sub.subscription.unsubscribe();
  }, [queryClient, router]);

  // Live-notification in-app toast for followers when a creator goes live.
  useEffect(() => {
    let cancel = () => {};
    (async () => {
      const mod = await import("@/integrations/supabase/client");
      const sb = mod.supabase;
      const { data: u } = await sb.auth.getUser();
      if (!u.user) return;
      const uid = u.user.id;
      const { toast } = await import("sonner");
      const channel = sb
        .channel(`live-notif-${uid}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "live_notifications", filter: `follower_id=eq.${uid}` },
          async (payload) => {
            const row = payload.new as { host_id: string; stream_id: string };
            const { data: prof } = await sb.from("profiles").select("username").eq("id", row.host_id).maybeSingle();
            toast(`@${prof?.username ?? "someone"} is live now`, {
              action: { label: "Watch", onClick: () => router.navigate({ to: "/live/$streamId", params: { streamId: row.stream_id } }) },
            });
          },
        )
        .subscribe();
      cancel = () => { sb.removeChannel(channel); };
    })();
    return () => cancel();
  }, [router]);

  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
      <Toaster theme="dark" position="top-center" />
      <SplashScreen />
    </QueryClientProvider>
  );
}
