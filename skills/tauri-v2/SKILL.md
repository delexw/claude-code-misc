---
name: tauri-v2
description: >
  Use this skill whenever "tauri" appears in the user's message, or they reference tauri.conf.json, src-tauri,
  or @tauri-apps packages. Also use when converting a web app (React, Vue, Svelte, etc.) into a desktop application
  without Electron. Covers: creating Tauri v2 projects, Rust commands and IPC (invoke/events/channels), permissions
  and capabilities config, official Tauri plugins (fs, dialog, updater, stronghold, store, etc.), state management,
  window configuration, building/bundling for macOS/Windows/Linux/mobile, and debugging Tauri-specific errors like
  blank windows, lifetime errors in commands, or permission denied issues. Do NOT use for Electron, Flutter, Wails,
  or general Rust development unrelated to Tauri.
---

# Tauri v2 Development Skill

Tauri v2 lets you build tiny, fast apps for desktop (macOS, Windows, Linux) and mobile (iOS, Android) by combining a web frontend with a Rust backend. Apps use the system's native webview instead of bundling a browser engine, so a minimal app can be under 600KB.

**Default stack in this skill:** React + Vite + TypeScript frontend, Rust backend. Adapt if the user specifies a different framework.

## Quick Reference

- Config file: `src-tauri/tauri.conf.json`
- Rust entry: `src-tauri/src/lib.rs` (or `main.rs`)
- Capabilities: `src-tauri/capabilities/*.json`
- Permissions: `src-tauri/permissions/*.toml`
- JS API: `@tauri-apps/api`
- CLI: `@tauri-apps/cli` (npm) or `tauri-cli` (cargo)

For detailed reference on configuration, plugins, permissions, and mobile setup, see the `references/` directory. Read the relevant file when you need specifics beyond what's covered here.

## Prerequisites

Before creating a Tauri project, ensure these are installed:

**All platforms:** Rust via rustup (`curl --proto '=https' --tlsv1.2 https://sh.rustup.rs -sSf | sh`), Node.js LTS

**macOS:** Xcode or Xcode Command Line Tools (`xcode-select --install`)

**Windows:** Microsoft C++ Build Tools (select "Desktop development with C++"), WebView2 Runtime (pre-installed on Windows 10+), `rustup default stable-msvc`

**Linux (Debian/Ubuntu):**
```bash
sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev
```

**Mobile (optional):** See `references/mobile.md` for Android Studio / iOS setup.

## Creating a Project

### Scaffolding (recommended)

```bash
npm create tauri-app@latest
# Choose: TypeScript/JavaScript → pnpm/npm → React → TypeScript
cd my-app
npm install
npm run tauri dev
```

This creates a project with `src/` (React frontend) and `src-tauri/` (Rust backend).

### Adding Tauri to an existing project

```bash
npm install -D @tauri-apps/cli@latest
npx tauri init
```

Answer the prompts for app name, dev server URL (e.g. `http://localhost:5173` for Vite), and frontend dist directory (e.g. `../dist`).

## Core Concepts

### Commands — Frontend calls Rust

Commands are the primary way the frontend talks to the backend. Define a Rust function with `#[tauri::command]`, register it, and call it from JS with `invoke`.

**Rust side** (`src-tauri/src/lib.rs`):
```rust
#[tauri::command]
fn greet(name: String) -> String {
    format!("Hello, {}!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![greet])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

**JS side**:
```typescript
import { invoke } from '@tauri-apps/api/core';

const greeting = await invoke<string>('greet', { name: 'World' });
```

Key rules:
- Command names must be unique across the app
- Rust args are snake_case, JS passes them as camelCase (e.g. `invoke_message` → `{ invokeMessage: '...' }`)
- Use `#[tauri::command(rename_all = "snake_case")]` to keep snake_case on both sides
- Commands can be `async` for non-blocking work
- Return `Result<T, String>` (or custom error types) for error handling — `Err` rejects the JS promise

### Events — Rust notifies the frontend

For fire-and-forget notifications or streaming updates, use the event system:

**Rust emitting:**
```rust
use tauri::{AppHandle, Emitter};

#[tauri::command]
fn start_download(app: AppHandle, url: String) {
    app.emit("download-progress", 50).unwrap();
}
```

**JS listening:**
```typescript
import { listen } from '@tauri-apps/api/event';

const unlisten = await listen<number>('download-progress', (event) => {
    console.log(`Progress: ${event.payload}%`);
});
// Call unlisten() to stop listening
```

### Channels — High-throughput streaming

For ordered, high-throughput data (file reads, progress), use channels instead of events:

```rust
use tauri::ipc::Channel;

#[tauri::command]
async fn stream_data(on_chunk: Channel<Vec<u8>>) {
    for chunk in data_chunks {
        on_chunk.send(chunk).unwrap();
    }
}
```

```typescript
import { invoke, Channel } from '@tauri-apps/api/core';

const onChunk = new Channel<Uint8Array>();
onChunk.onmessage = (chunk) => { /* handle chunk */ };
await invoke('stream_data', { onChunk });
```

### State Management

Register state with `.manage()` and inject it into commands with `State<>`:

```rust
use std::sync::Mutex;
use tauri::State;

struct AppState {
    count: u32,
}

#[tauri::command]
fn increment(state: State<'_, Mutex<AppState>>) -> u32 {
    let mut s = state.lock().unwrap();
    s.count += 1;
    s.count
}

// In run():
tauri::Builder::default()
    .manage(Mutex::new(AppState { count: 0 }))
    .invoke_handler(tauri::generate_handler![increment])
```

Important: Tauri wraps state in `Arc` automatically — don't wrap in `Arc` yourself. Use `Mutex` for mutable state. Use `std::sync::Mutex` (not tokio's) unless you need to hold the lock across `.await` points.

**Type mismatch pitfall:** If you `.manage(Mutex::new(state))` but inject `State<'_, AppState>` (without `Mutex`), it panics at runtime, not compile time. Use a type alias to prevent this:
```rust
type AppState = Mutex<AppStateInner>;
```

## Configuration — tauri.conf.json

The config file lives at `src-tauri/tauri.conf.json`. Key sections:

```jsonc
{
  "productName": "My App",
  "version": "1.0.0",
  "identifier": "com.example.myapp",  // Required, reverse domain notation
  "build": {
    "devUrl": "http://localhost:5173",      // Dev server URL
    "frontendDist": "../dist",              // Production build output
    "beforeDevCommand": "npm run dev",      // Starts your dev server
    "beforeBuildCommand": "npm run build"   // Builds frontend for production
  },
  "app": {
    "windows": [{
      "title": "My App",
      "width": 1024,
      "height": 768
    }],
    "security": {
      "capabilities": []  // Reference capability files here
    }
  },
  "bundle": {
    "active": true,
    "targets": "all",
    "icon": ["icons/32x32.png", "icons/128x128.png", "icons/icon.icns", "icons/icon.ico"]
  }
}
```

Platform-specific overrides: `tauri.linux.conf.json`, `tauri.windows.conf.json`, `tauri.macos.conf.json` — these merge with the main config.

See `references/config.md` for the full configuration reference.

## Security — Permissions & Capabilities

Tauri v2 has a capability-based security model. By default, the frontend cannot call any commands — you must explicitly grant access.

### Capabilities

A capability grants a set of permissions to specific windows. Create JSON files in `src-tauri/capabilities/`:

```json
{
  "identifier": "main-capability",
  "description": "Permissions for the main window",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "my-app:default"
  ]
}
```

### Permissions for your own commands

Define in `src-tauri/permissions/default.toml`:

```toml
[default]
description = "Default permissions for the app"
permissions = ["allow-greet", "allow-increment"]
```

Each command you register automatically gets `allow-<command-name>` and `deny-<command-name>` identifiers.

### Plugin permissions

Plugins ship their own permissions. Add them to your capability:

```json
{
  "permissions": [
    "core:default",
    "fs:default",
    "fs:allow-read-file",
    "dialog:default",
    "shell:allow-open"
  ]
}
```

### Scoped permissions

Restrict commands to specific paths/resources:

```toml
[[permission]]
identifier = "scope-home"
description = "Access files in $HOME"

[[scope.allow]]
path = "$HOME/*"
```

See `references/permissions.md` for the full permissions reference.

## Plugins

Install official plugins via npm + cargo:

```bash
npm install @tauri-apps/plugin-fs
# The Cargo dependency is added automatically by the CLI
```

Register in Rust:
```rust
tauri::Builder::default()
    .plugin(tauri_plugin_fs::init())
```

Use in JS:
```typescript
import { readTextFile } from '@tauri-apps/plugin-fs';
const content = await readTextFile('/path/to/file');
```

Don't forget to add the plugin's permissions to your capability file.

**Common official plugins:** fs, dialog, shell, http, notification, clipboard, store, global-shortcut, updater, window-state, autostart, log, sql, stronghold.

See `references/plugins.md` for the full plugin list and usage patterns.

## Building & Distribution

### Desktop builds

```bash
npm run tauri build
```

This compiles the Rust backend, builds the frontend, and creates platform-specific installers:
- **macOS:** `.dmg`, `.app` bundle
- **Windows:** `.msi` (WiX), `.exe` (NSIS)
- **Linux:** `.deb`, `.rpm`, `.AppImage`

### Mobile builds

```bash
npx tauri android build
npx tauri ios build
```

### Code signing

Required for distribution on most platforms. See the Tauri docs for platform-specific signing guides.

### Auto-updates

Use the `@tauri-apps/plugin-updater` plugin for in-app updates. Set `"createUpdaterArtifacts": true` in `bundle` config.

## Common Patterns

### Organizing commands in modules

```rust
// src-tauri/src/commands/mod.rs
pub mod files;
pub mod users;

// src-tauri/src/commands/files.rs
#[tauri::command]
pub fn read_config() -> String { /* ... */ }

// src-tauri/src/lib.rs
mod commands;
tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![
        commands::files::read_config,
        commands::users::login,
    ])
```

### Returning large binary data efficiently

Use `tauri::ipc::Response` to avoid JSON serialization overhead:

```rust
use tauri::ipc::Response;

#[tauri::command]
fn read_file(path: String) -> Response {
    let data = std::fs::read(&path).unwrap();
    Response::new(data)
}
```

### Custom error types

```rust
#[derive(Debug, thiserror::Error)]
enum AppError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("Not found: {0}")]
    NotFound(String),
}

impl serde::Serialize for AppError {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        serializer.serialize_str(&self.to_string())
    }
}

#[tauri::command]
fn load_data(path: String) -> Result<String, AppError> {
    Ok(std::fs::read_to_string(&path)?)
}
```

### Accessing the window or app handle in commands

```rust
#[tauri::command]
async fn get_window_title(window: tauri::WebviewWindow) -> String {
    window.title().unwrap_or_default()
}

#[tauri::command]
async fn get_app_dir(app: tauri::AppHandle) -> std::path::PathBuf {
    app.path().app_data_dir().unwrap()
}
```

## Troubleshooting

**"command X not found"** — Make sure you added the command to `generate_handler![]` AND granted permission in a capability file.

**Permission denied at runtime** — Check that your capability file includes the permission for the command or plugin you're calling, and that the window label matches.

**`tauri dev` shows blank window** — Verify `devUrl` in `tauri.conf.json` matches your dev server's actual URL and port. Make sure `beforeDevCommand` starts your dev server.

**State panic at runtime** — You're injecting the wrong type. If you `.manage(Mutex::new(state))`, inject `State<'_, Mutex<MyState>>`, not `State<'_, MyState>`.

**Slow first build** — Normal. Rust compiles all dependencies on first build (can take several minutes). Subsequent builds are incremental and much faster.

**Mobile: dev server not reachable** — iOS devices need `TAURI_DEV_HOST` set. Use `tauri ios dev` which handles this automatically.
