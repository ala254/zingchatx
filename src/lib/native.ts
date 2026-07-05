/**
 * ZingChatX native runtime bridge.
 *
 * Wires Capacitor plugins into the web app so it behaves like a first-class
 * Android app: edge-to-edge status bar, native splash dismissal, hardware
 * back-button navigation, deep-link routing, and persisted auth.
 *
 * Safe to import from the web build — every call is guarded so nothing
 * happens outside a native container.
 */
import { Capacitor } from "@capacitor/core";
import type { Router } from "@tanstack/react-router";

export const isNative = (): boolean => {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
};

/** Initialise native chrome (status bar, splash, back button, deep links). */
export async function initNative(router: Router<never, never>): Promise<void> {
  if (!isNative()) return;

  // Dynamic imports keep plugins out of the web bundle path.
  const [{ StatusBar, Style }, { SplashScreen }, { App }] = await Promise.all([
    import("@capacitor/status-bar"),
    import("@capacitor/splash-screen"),
    import("@capacitor/app"),
  ]);

  // Edge-to-edge, transparent status bar with white icons over dark UI.
  try {
    await StatusBar.setOverlaysWebView({ overlay: true });
    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.setBackgroundColor({ color: "#00000000" });
  } catch {
    /* status bar plugin unavailable on this device */
  }

  // Hide the native splash once React has painted.
  try {
    await SplashScreen.hide({ fadeOutDuration: 350 });
  } catch {
    /* splash already hidden */
  }

  // Hardware back button → router.history.back() when possible.
  App.addListener("backButton", ({ canGoBack }) => {
    if (canGoBack && window.history.length > 1) {
      window.history.back();
    } else {
      App.exitApp();
    }
  });

  // Deep links (zingchatx://... or https://zingchatx.app/...)
  const handleUrl = (url: string) => {
    try {
      const u = new URL(url);
      const path = u.pathname + u.search + u.hash;
      if (path && path !== "/") router.navigate({ to: path });
    } catch {
      /* ignore malformed deep link */
    }
  };
  App.addListener("appUrlOpen", (event) => handleUrl(event.url));

  // Cold-start deep link
  try {
    const launch = await App.getLaunchUrl();
    if (launch?.url) handleUrl(launch.url);
  } catch {
    /* no launch url */
  }
}
