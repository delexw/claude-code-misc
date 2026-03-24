---
name: setup-slack-explorer
description: Guide the user through setting up Slack credentials for the slack-explorer skill.
---

# Setup: Read Slack

You are helping the user set up the **slack-explorer** skill which requires Slack session tokens. These tokens are extracted automatically from the Slack desktop app.

## Prerequisites

- Node.js 18+ and npm installed
- The Slack desktop app installed and signed in on the user's Mac
- The user must be signed into the target workspace in the Slack desktop app

## Required Environment Variables

Set the following environment variables in your shell (e.g. `~/.zshrc` or `~/.zshenv`):

- `SLACK_XOXC_TOKEN` - Client token (starts with `xoxc`)
- `SLACK_XOXD_TOKEN` - Session cookie (starts with `xoxd`)
- `SLACK_USER_AGENT` - Slack desktop app user agent string

## Setup Steps

Walk the user through these steps:

1. Confirm the user has the Slack desktop app installed and is signed in
2. Run the automatic token extraction script:
   ```bash
   node <this-skill>/scripts/slack/extract-tokens.js
   ```
3. This script will print:
   - The decrypted session cookie (`xoxd`)
   - A fresh client token (`xoxc`)
   - The correct user agent string
4. Export these values in your shell environment or add them to your shell config
5. If the user needs tokens for a different workspace (default is the first signed-in workspace):
   ```bash
   node <this-skill>/scripts/slack/extract-tokens.js your-workspace.slack.com
   ```

## Verification

Ask the user to run a simple channel list to confirm credentials work:

```bash
node utility-skills/slack-explorer/scripts/slack/slack.js channels --types public_channel --limit 5
```

If the command returns channels, setup is complete.

## Troubleshooting

- **Authentication errors**: The `xoxc` token rotates periodically. Re-run the extract command to refresh all three values.
- **"Could not find Slack data"**: The Slack desktop app is not installed or the user is not signed in. Have them sign in to Slack desktop first.
- **Wrong workspace**: Pass the workspace hostname as an argument to the extract script.
- **Token expired**: The `xoxd` cookie is long-lived but changes when the user signs out/in to Slack. Re-extract after re-signing in.
