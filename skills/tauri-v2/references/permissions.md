# Tauri v2 Permissions & Capabilities Reference

## Architecture

Tauri v2 enforces a trust boundary between the Rust core (full system access) and the WebView frontend (restricted access via IPC). The security model has three layers:

1. **Permissions** — Define what a command can do (allow/deny + scopes)
2. **Permission Sets** — Bundle permissions for reuse
3. **Capabilities** — Assign permissions to specific windows/webviews

## Capabilities

Capabilities connect permissions to windows. They live in `src-tauri/capabilities/` as JSON or TOML files.

### Basic capability file

`src-tauri/capabilities/main.json`:
```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "main-capability",
  "description": "Permissions for the main window",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "my-app:default",
    "fs:default",
    "fs:allow-read-file",
    "dialog:allow-open"
  ]
}
```

### Platform-specific capabilities

```json
{
  "identifier": "desktop-capability",
  "windows": ["main"],
  "platforms": ["linux", "macOS", "windows"],
  "permissions": ["global-shortcut:default"]
}
```

### Multiple windows with different permissions

```json
[
  {
    "identifier": "main-capability",
    "windows": ["main"],
    "permissions": ["core:default", "fs:default"]
  },
  {
    "identifier": "settings-capability",
    "windows": ["settings"],
    "permissions": ["core:default", "store:default"]
  }
]
```

## Permissions

### Auto-generated command permissions

Every command registered with `generate_handler!` automatically gets:
- `allow-<command-name>` — Grants access to call the command
- `deny-<command-name>` — Explicitly denies access

### Custom permissions

Define in `src-tauri/permissions/<name>.toml`:

```toml
[[permission]]
identifier = "allow-read-config"
description = "Allow reading app configuration"
commands.allow = ["read_config", "get_setting"]
```

### Scoped permissions

Restrict what resources a command can access:

```toml
[[permission]]
identifier = "scope-app-data"
description = "Access files in app data directory"

[[scope.allow]]
path = "$APPDATA/**"

[[scope.deny]]
path = "$APPDATA/secrets/**"
```

Environment variables in scopes:
- `$HOME` — User home directory
- `$APPDATA` — App data directory
- `$DESKTOP`, `$DOCUMENT`, `$DOWNLOAD` — Standard user directories
- `$RESOURCE` — App resource directory

### Permission sets

Bundle permissions together:

```toml
[[set]]
identifier = "file-read-access"
description = "Read-only access to user files"
permissions = [
    "fs:allow-read-file",
    "fs:allow-read-dir",
    "fs:scope-home",
    "dialog:allow-open"
]
```

### Default permission

`src-tauri/permissions/default.toml`:
```toml
[default]
description = "Default permissions for the app"
permissions = [
    "allow-greet",
    "allow-increment",
    "allow-read-config"
]
```

Reference this as `my-app:default` in capability files (where `my-app` is your app identifier).

## Permission Identifiers

Format: `<plugin-or-app>:<permission-name>`

- `core:default` — Default Tauri core permissions (window management, etc.)
- `fs:default` — Default file system permissions
- `fs:allow-read-file` — Specific command permission
- `my-app:default` — Your app's default permissions
- `my-app:allow-greet` — Your app's specific command permission

### Naming rules
- Lowercase ASCII only: `[a-z]`
- Colon `:` as separator
- Max 116 characters
- Must be unique

## Common Permission Patterns

### Minimal (secure by default)
Only grant what the main window actually needs:
```json
{
  "permissions": ["core:default", "my-app:default"]
}
```

### File operations
```json
{
  "permissions": [
    "core:default",
    "fs:default",
    "fs:allow-read-file",
    "fs:allow-write-file",
    "fs:allow-read-dir",
    "fs:allow-mkdir",
    "dialog:allow-open",
    "dialog:allow-save"
  ]
}
```

### Network access
```json
{
  "permissions": [
    "core:default",
    "http:default",
    "http:allow-fetch"
  ]
}
```

## Troubleshooting

**"Unhandled Promise Rejection: ... not allowed"** — The command isn't permitted. Add the `allow-<command>` permission to your capability file.

**"No capability found for window X"** — Your capability's `windows` array doesn't include the window label making the request.

**Plugin permissions not working** — Make sure you:
1. Registered the plugin in Rust (`.plugin(tauri_plugin_x::init())`)
2. Added permissions to the capability file
3. The capability's `windows` array includes the requesting window
