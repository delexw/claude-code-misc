---
name: jira-ticket-viewer
description: View Jira ticket details using the jira CLI (jira-cli). Use when given a Jira issue key to fetch and display ticket information.
model: sonnet
argument-hint: <Jira issue key and optional output directory>
allowed-tools: Read, Bash, Write, Edit
context: fork
---

# Jira Ticket Viewer

Fetch and display Jira ticket details using the `jira` CLI tool.

## Inputs

Raw arguments: $ARGUMENTS

Infer from the arguments:
- TICKET_KEY: the Jira issue key
- OUT_DIR: output directory, or `.implement-assets/jira` if not provided

## System Requirements
- `jira` CLI installed and configured (https://github.com/ankitpokhrel/jira-cli)
- Environment variable `JIRA_API_TOKEN` set with a valid Jira API token. **Important:** When checking this variable, verify at least 2 times before concluding it is not set. Environment variables can appear unset due to shell context differences. **Never expose the value** — use existence checks only (e.g. `test -n "$JIRA_API_TOKEN"`).

## Execution

1. **Pre-flight check**: Run `jira me` to verify the CLI is installed **and** authenticated — if it fails, follow error handling in [references/rules.md](references/rules.md). Do NOT continue until `jira me` succeeds.
2. Validate TICKET_KEY against [references/rules.md](references/rules.md)
3. **Fetch raw JSON** (single API call): Run `mkdir -p OUT_DIR && jira issue view TICKET_KEY --raw > OUT_DIR/raw.json` via Bash
4. **Parse ticket**: Run `node ${CLAUDE_SKILL_DIR}/scripts/parse-ticket.js < OUT_DIR/raw.json > OUT_DIR/dossier.json` via Bash to get the parsed JSON output
5. **Interpret comments**: If the parsed JSON contains a non-empty `comments` array, analyze them following [references/comment-rules.md](references/comment-rules.md). Replace the `comments` array in the JSON with a `commentSummary` object, then save the updated JSON back to OUT_DIR/dossier.json using the Write tool.
6. **Attachments**: If the parsed JSON contains a non-empty `attachments` array, download them:
   - Run `node ${CLAUDE_SKILL_DIR}/scripts/download-attachment.js --out OUT_DIR < OUT_DIR/raw.json` via Bash
   - Include downloaded attachment file paths in the output
7. Return the parsed JSON output (see [references/output-format.md](references/output-format.md) for schema reference), including attachment download paths if any