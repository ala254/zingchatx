import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Compass, PlusSquare, Bell, User } from "lucide-react";
import type { ReactNode } from "react";

const tabs = [
  { to: "/feed", label: "Home", icon: Home },
  { to: "/explore", label: "Explore", icon: Compass },
  { to: "/upload", label: "Upload", icon: PlusSquare, primary: true },
  { to: "/notifications", label: "Inbox", icon: Bell },
  { to: "/profile", label: "Me", icon: User },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const hideNav = pathname.startsWith("/feed"); // feed nav is overlaid; keep small floating bar

  return (
    <div className="relative min-h-screen bg-background text-foreground">
      <main className="pb-[88px] sm:pb-[96px]">{children}</main>
      <nav
        className={`fixed bottom-0 left-1/2 z-40 -translate-x-1/2 ${
          hideNav ? "bg-background/40 backdrop-blur-xl" : "bg-surface/95 backdrop-blur-xl"
        } w-full max-w-[480px] border-t border-border/70`}
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0)" }}
      >
        <div className="flex h-16 items-center justify-around px-2">
          {tabs.map((t) => {
            const active = pathname.startsWith(t.to);
            const Icon = t.icon;
            if (t.primary) {
              return (
                <Link
                  key={t.to}
                  to={t.to}
                  className="relative -mt-6 flex h-12 w-14 items-center justify-center rounded-2xl gradient-zing shadow-zing transition active:scale-95"
                  aria-label={t.label}
                >
                  <Icon className="h-6 w-6 text-zing-foreground" />
                </Link>
              );
            }
            return (
              <Link
                key={t.to}
                to={t.to}
                className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition ${
                  active ? "text-foreground" : "text-muted-foreground"
                }`}
              >
                <Icon className={`h-5 w-5 ${active ? "scale-110" : ""} transition`} />
                {t.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
