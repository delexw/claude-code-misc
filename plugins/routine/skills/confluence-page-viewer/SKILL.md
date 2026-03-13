---
name: confluence-page-viewer
description: Read Confluence page content using the confluence CLI. Use when given a Confluence page URL to fetch and display page information.
agent: general-purpose
argument-hint: <Confluence page URL> <OUT_DIR>
allowed-tools: Read, Bash, Write, Edit
context: fork
model: sonnet
---

# Confluence Page Viewer

Fetch and display Confluence page content using `confluence-cli`.

## Arguments
- `$ARGUMENTS[0]` — Confluence page URL
- `$ARGUMENTS[1]` — (optional) Output directory for persisting the page content. Defaults to `.implement-assets/confluence`

Set `OUT_DIR` to `$ARGUMENTS[1]` if provided, otherwise `.implement-assets/confluence`. Use `OUT_DIR` for all output paths below.

## System Requirements
- `confluence-cli` installed and available in PATH (https://github.com/pchuri/confluence-cli)

## Execution

1. **Pre-flight check**: Run `which confluence-cli` to verify the CLI is available. If not found, follow error handling in [references/rules.md](references/rules.md). Do NOT continue until the CLI is available.
2. Validate `$ARGUMENTS[0]` against [references/rules.md](references/rules.md)
3. Run `confluence-cli read $ARGUMENTS[0]` via Bash
4. Format the output per [references/output-format.md](references/output-format.md)
5. **Save output**: Run `mkdir -p OUT_DIR` via Bash, then save the full formatted output to `OUT_DIR/output.md` using the Write tool.