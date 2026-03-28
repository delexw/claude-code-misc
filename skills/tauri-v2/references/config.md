# Tauri v2 Configuration Reference

Full reference for `src-tauri/tauri.conf.json`. Also supports `tauri.conf.json5` and `Tauri.toml`.

## Root Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `productName` | string | No | App display name (no `/\:*?"<>\|` chars) |
| `version` | string | No | Semver version. Falls back to Cargo.toml |
| `identifier` | string | **Yes** | Reverse domain (e.g. `com.example.app`). Must be unique |
| `mainBinaryName` | string | No | Override binary filename |
| `app` | object | No | App behavior config |
| `build` | object | No | Build pipeline config |
| `bundle` | object | No | Bundler/packaging config |
| `plugins` | object | No | Plugin-specific config |

## build

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `devUrl` | string (URI) | null | Dev server URL (e.g. `http://localhost:5173`) |
| `frontendDist` | string | null | Path to built frontend (e.g. `../dist`) |
| `beforeDevCommand` | string/object | null | Command to run before `tauri dev` |
| `beforeBuildCommand` | string/object | null | Command to run before `tauri build` |
| `beforeBundleCommand` | string/object | null | Command before bundling |
| `features` | string[] | null | Cargo feature flags |
| `additionalWatchFolders` | string[] | [] | Extra paths to watch in dev |

`beforeDevCommand` as object:
```json
{
  "script": "npm run dev",
  "cwd": "../frontend",
  "wait": false
}
```

## app

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `windows` | WindowConfig[] | [] | Windows to create at startup |
| `security` | object | {} | Security settings |
| `trayIcon` | object | null | System tray icon config |
| `withGlobalTauri` | boolean | false | Inject `window.__TAURI__` |
| `macOSPrivateApi` | boolean | false | Enable macOS private APIs |

### app.windows[] (WindowConfig)

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `label` | string | "main" | Window identifier |
| `title` | string | "Tauri App" | Title bar text |
| `width` | number | 800 | Width in logical pixels |
| `height` | number | 600 | Height in logical pixels |
| `minWidth` | number | null | Minimum width |
| `minHeight` | number | null | Minimum height |
| `maxWidth` | number | null | Maximum width |
| `maxHeight` | number | null | Maximum height |
| `resizable` | boolean | true | Allow resizing |
| `fullscreen` | boolean | false | Start fullscreen |
| `focus` | boolean | true | Focus on launch |
| `visible` | boolean | true | Show on creation |
| `transparent` | boolean | false | Transparent background |
| `decorations` | boolean | true | Show title bar/borders |
| `alwaysOnTop` | boolean | false | Always on top |
| `titleBarStyle` | string | "Visible" | macOS: "Visible", "Transparent", "Overlay" |
| `create` | boolean | true | Create at startup |

### app.security

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `capabilities` | array | [] | Inline capabilities (prefer separate files) |
| `pattern` | object | `{"use":"brownfield"}` | IPC pattern |
| `freezePrototype` | boolean | false | Prevent JS prototype pollution |
| `dangerousDisableAssetCspModification` | boolean | false | Skip CSP for assets |

## bundle

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `active` | boolean | false | Enable bundling |
| `targets` | string | "all" | Target formats (comma-separated) |
| `icon` | string[] | [] | Icon file paths |
| `resources` | array/object | null | Extra files to bundle |
| `externalBin` | string[] | null | Sidecar binaries |
| `fileAssociations` | array | null | File type associations |
| `copyright` | string | null | Copyright text |
| `category` | string | null | App category |
| `createUpdaterArtifacts` | boolean | false | Generate update artifacts |

### bundle.windows

| Property | Type | Description |
|----------|------|-------------|
| `certificateThumbprint` | string | Code signing cert thumbprint |
| `digestAlgorithm` | string | Signing digest algorithm |
| `nsis` | object | NSIS installer config |
| `wix` | object | WiX installer config |
| `allowDowngrades` | boolean | Allow downgrading (default: true) |

### bundle.macOS

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `minimumSystemVersion` | string | "10.13" | Min macOS version |
| `hardenedRuntime` | boolean | true | Enable hardened runtime |
| `dmg` | object | {} | DMG settings |

### bundle.linux

| Property | Type | Description |
|----------|------|-------------|
| `appimage` | object | AppImage settings |
| `deb` | object | Debian package settings |
| `rpm` | object | RPM package settings |

### bundle.android

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `minSdkVersion` | number | 24 | Min Android API level |
| `versionCode` | number | auto | Android version code |

### bundle.iOS

| Property | Type | Default |
|----------|------|---------|
| `minimumSystemVersion` | string | "14.0" |

## Platform-Specific Overrides

Create files alongside `tauri.conf.json`:
- `tauri.linux.conf.json`
- `tauri.windows.conf.json`
- `tauri.macos.conf.json`
- `tauri.android.conf.json`
- `tauri.ios.conf.json`

These merge with the base config, allowing platform-specific overrides without conditional logic.

## Example: Complete Configuration

```json
{
  "productName": "My App",
  "version": "1.0.0",
  "identifier": "com.mycompany.myapp",
  "build": {
    "devUrl": "http://localhost:5173",
    "frontendDist": "../dist",
    "beforeDevCommand": "npm run dev",
    "beforeBuildCommand": "npm run build"
  },
  "app": {
    "windows": [
      {
        "label": "main",
        "title": "My App",
        "width": 1200,
        "height": 800,
        "minWidth": 800,
        "minHeight": 600,
        "resizable": true
      }
    ],
    "security": {
      "capabilities": []
    }
  },
  "bundle": {
    "active": true,
    "targets": "all",
    "icon": [
      "icons/32x32.png",
      "icons/128x128.png",
      "icons/128x128@2x.png",
      "icons/icon.icns",
      "icons/icon.ico"
    ],
    "createUpdaterArtifacts": false
  },
  "plugins": {}
}
```
