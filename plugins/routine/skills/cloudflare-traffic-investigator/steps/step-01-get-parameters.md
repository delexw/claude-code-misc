# Step 1: Get Investigation Parameters

## Verify Installation & Configuration

Check if the `cloudflare-mcp-cli` CLI is installed:

```bash
which cloudflare-mcp-cli
```

If not found, install it automatically: `npm install -g cloudflare-mcp-cli`.

Verify the token is configured and connected:

```bash
cloudflare-mcp-cli config verify-token
```

If verification fails, ask the user to configure a token via `cloudflare-mcp-cli config set-token <token>`.

Do NOT continue until both installation and token verification pass.

## Detect local time

Before collecting any parameters, detect and record the current local time and timezone via system clock:

```bash
date +"%Y-%m-%d %H:%M %Z"
```

Record this as the **pinned timezone** for the entire investigation. All times in subsequent steps and the final report must use this timezone.

Use `AskUserQuestion` to collect required information if not already provided.

## Time range

If `$ARGUMENTS[2]` (time range) was provided, use it directly — **do not ask the user again**.

Otherwise, ask: "What time range should I investigate? (Please include your timezone)"

Accept formats like: "NZ 4am-5am", "today 9:00-10:00 AEDT", "yesterday 14:00-15:00 UTC", "2025-06-01 04:00-05:00 NZST"

Always present results in the pinned timezone (detected via system clock above). Convert to UTC for Cloudflare queries.

## Zone ID

Use `$ARGUMENTS[0]` (domain) and `$ARGUMENTS[1]` (zone ID) passed when invoking the skill. If not provided, ask the user for the domain and zone ID.
