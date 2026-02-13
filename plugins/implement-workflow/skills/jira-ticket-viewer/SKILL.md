---
name: jira-ticket-viewer
description: View Jira ticket details using the jira CLI (jira-cli). Use when given a Jira issue key to fetch and display ticket information.
argument-hint: TICKET-KEY [OUT_DIR]
---

# Jira Ticket Viewer

Fetch and display Jira ticket details using the `jira` CLI tool.

## Arguments
- `$ARGUMENTS[0]` — Jira issue key (e.g. `PROJ-123`)
- `$ARGUMENTS[1]` — (optional) Base directory for all temp assets (raw JSON, attachments). Defaults to `/tmp`

When invoked by the orchestrator (e.g. `implement`), `$ARGUMENTS[1]` is provided. When used standalone, it defaults to `/tmp`.

## System Requirements
- `jira` CLI installed and configured (https://github.com/ankitpokhrel/jira-cli)

## Execution

Let `TICKET_KEY` = `$ARGUMENTS[0]`, `OUT_DIR` = `$ARGUMENTS[1]` (default `/tmp`).

1. **Pre-flight check**: Run `jira me` to verify the CLI is installed **and** authenticated — if it fails, follow error handling in [references/rules.md](references/rules.md). Do NOT continue until `jira me` succeeds.
2. Validate `TICKET_KEY` against [references/rules.md](references/rules.md)
3. **Fetch raw JSON** (single API call): Run `mkdir -p OUT_DIR && jira issue view TICKET_KEY --raw > OUT_DIR/raw.json` via Bash
4. **Parse ticket**: Run `node ./scripts/parse-ticket.js < OUT_DIR/raw.json` via Bash to get the parsed structured output
5. **Attachments**: If the parsed output contains an `Attachments:` section, download them:
   - Run `node ./scripts/download-attachment.js --out OUT_DIR < OUT_DIR/raw.json` via Bash
   - If `JIRA_API_TOKEN` is not set, follow error handling in [references/rules.md](references/rules.md)
   - Include downloaded attachment file paths in the output
6. Return the parsed output (see [references/output-format.md](references/output-format.md) for format reference), including attachment download paths if any

<tags>
   <mode>think</mode>
   <custom>yes</custom>
</tags>
