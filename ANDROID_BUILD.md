# ZingChatX — Native Android Build

This project is now wrapped with **Capacitor 8** so the ZingChatX web app runs
as a real Android application (no browser chrome, native splash, edge-to-edge,
hardware back button, deep links, camera/storage/share plugins).

Because the Lovable sandbox has no Android SDK, the actual `android/` folder
and signed `.apk` / `.aab` must be produced on your own machine. Everything
that needs to live inside the repo is already committed:

- `capacitor.config.ts` — app id `com.zingchatx.app`, name **ZingChatX**,
  edge-to-edge status bar, splash config, deep-link scheme.
- `src/lib/native.ts` — status bar / splash / hardware back / deep links.
- All Capacitor plugins already installed (`camera`, `filesystem`, `share`,
  `preferences`, `push-notifications`, `network`, `browser`, `app`,
  `splash-screen`, `status-bar`).

## 1. One-time local setup

```bash
# Requirements: Node 20+, JDK 21, Android Studio (Hedgehog+), Android SDK 34–35.

git clone <your repo> && cd <repo>
bun install                        # or npm install
npx cap add android                # generates the android/ folder
```

## 2. Point the shell at your deployed site

Open `capacitor.config.ts` and set `server.url` to your **published** ZingChatX
URL (custom domain if you have one). Then sync:

```bash
npx cap sync android
```

## 3. Brand assets (logo, icon, splash)

The official logo is already in the repo at
`src/assets/zingchatx-logo.png.asset.json`. Download it once, then generate
launcher icons + splash screens with `@capacitor/assets`:

```bash
mkdir -p resources
curl -L https://id-preview--92ffcfb6-01b6-4119-889d-4c6d0c7ded71.lovable.app/__l5e/assets-v1/b3496de0-7af5-44e1-996b-4e1762abd2f8/zingchatx-logo.png -o resources/icon.png
cp resources/icon.png resources/splash.png            # solid-black splash w/ logo works well
bunx @capacitor/assets generate --android --iconBackgroundColor "#000000" --splashBackgroundColor "#000000"
```

## 4. Android manifest tweaks (`android/app/src/main/AndroidManifest.xml`)

- Under `<application …>` set `android:usesCleartextTraffic="false"` and
  `android:hardwareAccelerated="true"` (Capacitor default, verify).
- Add permissions if you plan to use the plugins:

  ```xml
  <uses-permission android:name="android.permission.INTERNET"/>
  <uses-permission android:name="android.permission.CAMERA"/>
  <uses-permission android:name="android.permission.RECORD_AUDIO"/>
  <uses-permission android:name="android.permission.READ_MEDIA_VIDEO"/>
  <uses-permission android:name="android.permission.READ_MEDIA_IMAGES"/>
  <uses-permission android:name="android.permission.POST_NOTIFICATIONS"/>
  <uses-feature android:name="android.hardware.camera" android:required="false"/>
  ```

- Deep links: inside the main `<activity>` add

  ```xml
  <intent-filter android:autoVerify="true">
    <action android:name="android.intent.action.VIEW"/>
    <category android:name="android.intent.category.DEFAULT"/>
    <category android:name="android.intent.category.BROWSABLE"/>
    <data android:scheme="zingchatx"/>
    <data android:scheme="https" android:host="zingchatx.app"/>
  </intent-filter>
  ```

## 5. Edge-to-edge (Android 15+ is edge-to-edge by default)

`src/lib/native.ts` already calls `StatusBar.setOverlaysWebView({overlay:true})`
and the app CSS uses `viewport-fit=cover` + safe-area insets, so the UI is
already prepared. Set `minSdkVersion = 24` and `targetSdkVersion = 35` in
`android/variables.gradle` to support Android 10–16.

## 6. Run / debug

```bash
npx cap open android           # opens Android Studio
# or
npx cap run android            # deploys to a connected device / emulator
```

## 7. Signed release build

```bash
# Create a keystore once
keytool -genkey -v -keystore zingchatx.keystore -alias zingchatx \
  -keyalg RSA -keysize 2048 -validity 10000
```

Add to `android/app/build.gradle`:

```gradle
signingConfigs {
  release {
    storeFile file(System.getenv("ZINGCHATX_KEYSTORE"))
    storePassword System.getenv("ZINGCHATX_KEYSTORE_PW")
    keyAlias "zingchatx"
    keyPassword System.getenv("ZINGCHATX_KEY_PW")
  }
}
buildTypes {
  release {
    signingConfig signingConfigs.release
    minifyEnabled true
    shrinkResources true
  }
}
```

Then:

```bash
cd android
./gradlew assembleRelease        # APK -> app/build/outputs/apk/release/
./gradlew bundleRelease          # AAB -> app/build/outputs/bundle/release/
```

Upload the `.aab` to Google Play; keep the `.apk` for sideloading / testing.

## Notes

- **Authentication persistence** — Supabase writes its session to
  `localStorage`, which Capacitor's WebView persists across app launches, so
  users stay signed in.
- **Offline** — Supabase realtime + video streaming still need connectivity;
  `@capacitor/network` is installed if you want to surface an offline banner.
- **Video** — Android WebView uses ExoPlayer under the hood, so playback is
  hardware-accelerated with no extra code.
