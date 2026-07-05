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
  webDir: "dist",
  bundledWebRuntime: false,
  server: {
    // Point the native shell at the deployed ZingChatX site. When you publish
    // in Lovable this can be swapped for your custom domain.
    url: "https://id-preview--92ffcfb6-01b6-4119-889d-4c6d0c7ded71.lovable.app",
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
      launchShowDuration: 1200,
      launchAutoHide: true,
      launchFadeOutDuration: 400,
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
