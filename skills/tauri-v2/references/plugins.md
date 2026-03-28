# Tauri v2 Plugins Reference

## Installation Pattern

All official plugins follow the same pattern:

```bash
# Install the JS package
npm install @tauri-apps/plugin-<name>

# The Cargo dependency is typically added automatically.
# If not, add to src-tauri/Cargo.toml:
# tauri-plugin-<name> = "2"
```

Register in `src-tauri/src/lib.rs`:
```rust
tauri::Builder::default()
    .plugin(tauri_plugin_<name>::init())
```

Add permissions to your capability file in `src-tauri/capabilities/`:
```json
{
  "permissions": ["<name>:default"]
}
```

## Official Plugins

### File System (`fs`)
Read/write files with scoped access control.
```typescript
import { readTextFile, writeTextFile, readDir } from '@tauri-apps/plugin-fs';

const content = await readTextFile('/path/to/file');
await writeTextFile('/path/to/file', 'new content');
const entries = await readDir('/path/to/dir');
```
Permissions: `fs:default`, `fs:allow-read-file`, `fs:allow-write-file`, `fs:allow-read-dir`, `fs:allow-mkdir`, `fs:allow-remove`, `fs:scope-*`

### Dialog (`dialog`)
Native open/save file dialogs.
```typescript
import { open, save, message, ask, confirm } from '@tauri-apps/plugin-dialog';

const selected = await open({ multiple: true, filters: [{ name: 'Images', extensions: ['png', 'jpg'] }] });
const savePath = await save({ defaultPath: 'output.txt' });
await message('Hello!', { title: 'My App', kind: 'info' });
```

### Shell (`shell`)
Spawn child processes and open URLs/files with default apps.
```typescript
import { open } from '@tauri-apps/plugin-shell';
await open('https://tauri.app'); // Opens in default browser
```

### HTTP Client (`http`)
Make HTTP requests from the frontend.
```typescript
import { fetch } from '@tauri-apps/plugin-http';
const response = await fetch('https://api.example.com/data', { method: 'GET' });
```

### Notification (`notification`)
Send native OS notifications.
```typescript
import { sendNotification, requestPermission } from '@tauri-apps/plugin-notification';
await requestPermission();
sendNotification({ title: 'Hello', body: 'World' });
```

### Clipboard (`clipboard-manager`)
Read/write system clipboard.
```typescript
import { writeText, readText } from '@tauri-apps/plugin-clipboard-manager';
await writeText('Copied!');
const text = await readText();
```

### Store (`store`)
Persistent key-value storage.
```typescript
import { Store } from '@tauri-apps/plugin-store';
const store = await Store.load('settings.json');
await store.set('theme', 'dark');
const theme = await store.get('theme');
await store.save(); // Persist to disk
```

### Global Shortcut (`global-shortcut`)
Register system-wide keyboard shortcuts.
```typescript
import { register } from '@tauri-apps/plugin-global-shortcut';
await register('CommandOrControl+Shift+C', (event) => {
  console.log('Shortcut triggered!', event);
});
```

### Updater (`updater`)
In-app auto-updates.
```typescript
import { check } from '@tauri-apps/plugin-updater';
const update = await check();
if (update) {
  await update.downloadAndInstall();
}
```
Requires `"createUpdaterArtifacts": true` in `bundle` config and an update endpoint.

### Window State (`window-state`)
Persist and restore window size/position across sessions.
```rust
// Just register the plugin — it works automatically
.plugin(tauri_plugin_window_state::Builder::new().build())
```

### Autostart (`autostart`)
Launch app at system startup.
```typescript
import { enable, disable, isEnabled } from '@tauri-apps/plugin-autostart';
await enable();
```

### Log (`log`)
Structured logging from both Rust and JS.
```typescript
import { info, error, warn, debug } from '@tauri-apps/plugin-log';
info('Application started');
error('Something went wrong');
```

### SQL (`sql`)
SQLite, MySQL, or PostgreSQL database access.
```typescript
import Database from '@tauri-apps/plugin-sql';
const db = await Database.load('sqlite:my.db');
await db.execute('CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, name TEXT)');
const rows = await db.select('SELECT * FROM users');
```

### Stronghold (`stronghold`)
Encrypted storage for secrets and keys.

### Localhost (`localhost`)
Serve frontend from a localhost server instead of custom protocol.

### Barcode Scanner (`barcode-scanner`)
Mobile only — scan barcodes and QR codes.

### Biometric (`biometric`)
Mobile only — fingerprint/face authentication.

### Deep Link (`deep-link`)
Handle custom URL schemes (e.g., `myapp://path`).

### Geolocation (`geolocation`)
Access device location.

### Haptics (`haptics`)
Mobile only — haptic feedback.

### NFC (`nfc`)
Mobile only — Near Field Communication.

### Opener (`opener`)
Open files/URLs with default system applications.

### Process (`process`)
Get current process info, exit, or restart.

### OS Info (`os`)
Get OS type, version, arch, locale.

### Single Instance (`single-instance`)
Ensure only one instance of the app runs at a time.

## Community Plugins

60+ community plugins available at https://github.com/tauri-apps/awesome-tauri including:
- Python backend, Deno runtime
- Serial port, thermal printer
- Discord RPC, in-app purchases
- Device info, network tools
