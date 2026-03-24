---
name: slack-explorer
description: Explore and search Slack messages, channels, and threads. Use when you need to search conversations, read channel history, get thread replies, or list available channels.
argument-hint: <what to search or read, optional workspace myorg.slack.com>
---

# Slack Explorer

Explore and search Slack data using the direct API CLI.

## Inputs

Raw arguments: $ARGUMENTS

Infer from the arguments:
- QUERY: what to search or read (topic, channel name, or command like `history #engineering`)
- WORKSPACE: (optional) a Slack workspace domain detected by presence of `.slack.com` in the arguments — falls back to `$SLACK_WORKSPACE` env var if not provided
- EXTRA_CONTEXT: (optional) any additional filters or constraints (e.g. date range, user, channel)

Pass `--workspace <WORKSPACE>` to the CLI when a workspace is inferred from arguments.

## Privacy Rules (Mandatory)

These rules are **non-negotiable** and must be followed on every use of this skill:

1. **Do not store or forward PII.** Message content, user emails, real names, and phone numbers must only be used within the current task. Never write them to files, memory, or external systems.
2. **Do not bulk-read DMs.** Channels starting with `D` (direct messages) must not be read unless the user explicitly requests it and provides a clear work-related reason.
3. **Prefer public channels.** Always search public channels first. Only access private channels or DMs when the task cannot be completed otherwise.
4. **Do not surface credentials.** If a message contains tokens, passwords, API keys, or secrets, redact or skip them — do not repeat or log them.
5. **User profile data (email, real name) is for identification only.** Use it to resolve a user ID to a name within the current task. Do not aggregate or store profile data.
6. **Scope searches tightly.** Use `--channel`, `--user`, and `--days` filters to minimise how much data is fetched. Avoid open-ended bulk reads.

## Execution Note

Run scripts **with network permissions** (`required_permissions: ["network"]`) - they need network access for API calls.

## Available Commands

| Command | Purpose | Use When |
|---------|---------|----------|
| `search` | Search messages | Looking for specific topics, mentions, or discussions |
| `history` | Read channel messages | Need recent activity from a channel |
| `replies` | Read thread replies | Need full context of a conversation thread |
| `channels` | List channels | Need to find channel IDs or browse available channels |
| `recent` | Recent messages (all channels) | Quick overview of activity |
| `user` | Get user info by ID | Need to look up username from user ID |

## Quick Examples

### Search Messages

```bash
# Search for a topic
node <this-skill>/scripts/slack/slack.js search "quarterly report"

# Search in specific channel
node <this-skill>/scripts/slack/slack.js search "deployment" --channel "#engineering"

# Search from specific user (use Slack username, NOT user ID)
# Use `slack.js user <userId>` to look up a username from a user ID
node <this-skill>/scripts/slack/slack.js search --user "@jane.smith" --limit 20

# Search by date range
node <this-skill>/scripts/slack/slack.js search "release" --after "2025-01-01" --before "2025-01-15"

# Search last N days
node <this-skill>/scripts/slack/slack.js search "decision" --days 7

# Search threads only
node <this-skill>/scripts/slack/slack.js search "decision" --threads-only true
```

### Read Channel History

Channel names and IDs both work — the script resolves names to IDs automatically.

```bash
# Get recent messages by channel name (preferred — name resolves automatically)
node <this-skill>/scripts/slack/slack.js history --channel "#general" --limit 20

# Get recent messages by channel ID
node <this-skill>/scripts/slack/slack.js history --channel C1234567890 --limit 50

# Get messages from last 7 days
node <this-skill>/scripts/slack/slack.js history --channel "#general" --limit 7d

# Get DM history (use channel ID for DMs)
node <this-skill>/scripts/slack/slack.js history --channel D1234567890 --limit 20
```

### Read Thread Replies

```bash
# Get all replies in a thread
node <this-skill>/scripts/slack/slack.js replies --channel C1234567890 --thread 1234567890.123456

# Limit to recent replies
node <this-skill>/scripts/slack/slack.js replies --channel C1234567890 --thread 1234567890.123456 --limit 20
```

### List Channels

```bash
# List public channels (default)
node <this-skill>/scripts/slack/slack.js channels --limit 50

# List public channels with a higher limit
node <this-skill>/scripts/slack/slack.js channels --types public_channel --limit 200
```

### Recent Messages

```bash
# Get messages from last hour (all channels)
node <this-skill>/scripts/slack/slack.js recent

# Get messages from last 24 hours
node <this-skill>/scripts/slack/slack.js recent --hours 24 --limit 100
```

### Get User Info

```bash
# Look up a single user by ID (returns username needed for search)
node <this-skill>/scripts/slack/slack.js user U012AB3CD45

# Look up multiple users at once
node <this-skill>/scripts/slack/slack.js user U012AB3CD45,U012EF6GH78,U012IJ9KL01 --json
```

## Common Workflows

### Find and Read a Discussion

1. Search for the topic:
   ```bash
   node <this-skill>/scripts/slack/slack.js search "API redesign" --limit 10 --json
   ```

2. Get thread context (use channelId and threadTs from search results):
   ```bash
   node <this-skill>/scripts/slack/slack.js replies --channel C1234567890 --thread 1234567890.123456
   ```

### Monitor Channel Activity

1. Get recent messages:
   ```bash
   node <this-skill>/scripts/slack/slack.js history --channel C1234567890 --limit 7d
   ```

2. For any active threads, get full context:
   ```bash
   node <this-skill>/scripts/slack/slack.js replies --channel C1234567890 --thread 1234567890.123456
   ```

### Search for Mentions

If provided a user's slack handle you can search for mentions (note handles for this script are of the form `name` not `@name` - no @ symbol)

```bash
# Find mentions in last 7 days (replace <handle> with user's slackHandle)
node <this-skill>/scripts/slack/slack.js search "<handle>" --days 7 --limit 50 --json
```

## Search Query Tips

- Use quotes for exact phrases: `"error message"`
- Combine with `--channel` and `--user` filters for precision
- Channel names can use `#channel` format or channel ID
- **User search requires Slack username** (e.g., `@jane.smith`), NOT user ID
  - Use `slack.js user <userId>` to find a user's username from their ID
- Date formats: `YYYY-MM-DD`

## Output Formats

- Default: Human-readable text
- Add `--json` for machine-readable JSON output
- Add `--debug` for verbose API debugging

## Environment

Tokens are extracted automatically from the Slack desktop app on every run — no manual token management needed. The only requirement is that Slack is installed and you are signed in.

**`SLACK_WORKSPACE` is required** (or pass `--workspace` on each command). Without it the script cannot determine which workspace to authenticate against and will fail.

- `SLACK_WORKSPACE` - Workspace domain, e.g. `myorg.slack.com` **(required)**
- `SLACK_XOXC_TOKEN` / `SLACK_XOXD_TOKEN` - Fallback tokens (only needed if auto-extraction fails)
- `SLACK_USER_AGENT` - Slack desktop app user agent string (optional)

### Refreshing Tokens

Tokens are re-extracted automatically on every command — no explicit refresh step is needed. If you get authentication errors, ensure Slack is running and you are signed in, then retry.

To inspect the extracted values (e.g. for debugging):

```bash
node <this-skill>/scripts/slack/extract-tokens.js myorg.slack.com
```

Pass `--workspace myorg.slack.com` to any command to override the `SLACK_WORKSPACE` env var.
