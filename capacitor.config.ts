import type { CapacitorConfig } from "@capacitor/cli";

/**
 * ZingChatX — Capacitor configuration
 *
 * The web app is a TanStack Start (SSR) project, so it cannot be shipped as a
 * pure static bundle inside the APK. Instead we ship a thin native shell that
 * loads the deployed ZingChatX web app. Replace `server.url` with your custom
 * domain once the app is published.
 */
const config: CapacitorConfig = {
  appId: "com.zingchatx.app",
  appName: "ZingChatX",
  // TanStack Start is an SSR app — it does NOT produce a static `dist/`
  // bundle that can be shipped inside the APK. Capacitor still requires a
  // `webDir` at `cap sync` time, so we point it at a tiny shell folder that
  // ships a single loading `index.html`. At runtime the WebView is redirected
  // to the deployed SSR site via `server.url`, so the shell is never shown.
  webDir: "capacitor-shell",
  server: {
    url: "https://zingchatx-your-next-viral-moment.vercel.app",
    cleartext: false,
    androidScheme: "https",
    allowNavigation: [
      "*.lovable.app",
      "*.lovableproject.com",
      "*.supabase.co",
      "*.supabase.in",
      "fonts.googleapis.com",
      "fonts.gstatic.com",
    ],
  },
  android: {
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
    // Enable hardware-accelerated video / smooth compositing.
    backgroundColor: "#000000",
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: false,
      launchFadeOutDuration: 500,
      backgroundColor: "#000000",
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      // Edge-to-edge; app draws behind status bar
      overlaysWebView: true,
      style: "DARK",
      backgroundColor: "#00000000",
    },
    App: {
      // Custom URL scheme for deep links: zingchatx://video/<id>
      // Also supports https://*.zingchatx.app via Android App Links.
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
  },
};

export default config;
