# Tauri v2 Mobile Development Reference

## Prerequisites

### Android

1. **Install Android Studio** from https://developer.android.com/studio

2. **Set JAVA_HOME:**
   - macOS: `export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"`
   - Linux: `export JAVA_HOME=/opt/android-studio/jbr`
   - Windows: `[System.Environment]::SetEnvironmentVariable("JAVA_HOME", "C:\Program Files\Android\Android Studio\jbr", "User")`

3. **Install SDK components** via Android Studio SDK Manager:
   - Android SDK Platform (latest)
   - Android SDK Platform-Tools
   - NDK (Side by side)
   - Android SDK Build-Tools
   - Android SDK Command-line Tools

4. **Set environment variables:**
   ```bash
   export ANDROID_HOME="$HOME/Android/Sdk"        # Linux
   export ANDROID_HOME="$HOME/Library/Android/sdk" # macOS
   export NDK_HOME="$ANDROID_HOME/ndk/<version>"
   ```

5. **Add Rust targets:**
   ```bash
   rustup target add aarch64-linux-android armv7-linux-androideabi i686-linux-android x86_64-linux-android
   ```

### iOS (macOS only)

1. **Install Xcode** from the Mac App Store (full version, not just CLI tools)

2. **Add Rust targets:**
   ```bash
   rustup target add aarch64-apple-ios x86_64-apple-ios aarch64-apple-ios-sim
   ```

3. **Install Cocoapods:**
   ```bash
   brew install cocoapods
   ```

## Development

### Initialize mobile support

```bash
npx tauri android init
npx tauri ios init
```

This creates `src-tauri/gen/android/` and `src-tauri/gen/apple/` directories with native project files.

### Run on device/emulator

```bash
npx tauri android dev
npx tauri ios dev
```

For iOS physical devices, the dev server needs to be accessible on the network. Tauri handles this via `TAURI_DEV_HOST`.

### Build for release

```bash
npx tauri android build
npx tauri ios build
```

## Mobile-Specific Configuration

### Android (`tauri.conf.json` → `bundle.android`)

```json
{
  "bundle": {
    "android": {
      "minSdkVersion": 24,
      "versionCode": 1
    }
  }
}
```

### iOS (`tauri.conf.json` → `bundle.iOS`)

```json
{
  "bundle": {
    "iOS": {
      "minimumSystemVersion": "14.0"
    }
  }
}
```

## Mobile Entry Point

Tauri v2 uses a conditional attribute for mobile:

```rust
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

This attribute generates the necessary JNI/Swift entry points for Android/iOS.

## Mobile Plugins

Some plugins are mobile-only:
- `barcode-scanner` — Scan barcodes and QR codes
- `biometric` — Fingerprint/face authentication
- `haptics` — Haptic feedback
- `nfc` — Near Field Communication
- `geolocation` — Device location (also works on desktop)

## Troubleshooting

**Android build fails with NDK error** — Ensure `NDK_HOME` points to the correct NDK version directory inside `$ANDROID_HOME/ndk/`.

**iOS: "No signing certificate"** — Open `src-tauri/gen/apple/` in Xcode, go to Signing & Capabilities, and select your development team.

**Dev server not reachable on mobile** — The mobile device must be on the same network. For iOS, `tauri ios dev` sets `TAURI_DEV_HOST` automatically. For Android emulator, `10.0.2.2` maps to the host's localhost.

**Slow mobile builds** — Cross-compilation for mobile targets is slower than native desktop builds. Use `--target` to build for only the target you're testing on.
