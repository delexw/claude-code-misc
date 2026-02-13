---
name: confluence-page-viewer
description: Read Confluence page content using the confluence CLI. Use when given a Confluence page URL to fetch and display page information.
context: fork
argument-hint: Confluence page URL [OUT_DIR] (e.g. https://envato.atlassian.net/wiki/spaces/MS/pages/... ./out)
---

# Confluence Page Viewer

Fetch and display Confluence page content using the `confluence` CLI tool.

## Arguments
- `$ARGUMENTS[0]` — Confluence page URL
- `$ARGUMENTS[1]` — (optional) Output directory for persisting the page content. Defaults to `.implement-assets/confluence`

When invoked by the orchestrator (e.g. `implement`), `$ARGUMENTS[1]` is provided. When used standalone, it defaults to `.implement-assets/confluence`.

## System Requirements
- `confluence` CLI installed and configured (https://github.com/pchuri/confluence-cli)

## Execution

Let `URL` = `$ARGUMENTS[0]`, `OUT_DIR` = `$ARGUMENTS[1]` (default `.implement-assets/confluence`).

1. **Pre-flight check**: Run `confluence --help` to verify the CLI is installed — if it fails, follow error handling in [references/rules.md](references/rules.md). Do NOT continue until the CLI is available. Auth errors are caught when the actual command runs.
2. Validate `URL` against [references/rules.md](references/rules.md)
3. Run `confluence read URL` via Bash
4. Format the output per [references/output-format.md](references/output-format.md)
5. **Save output**: Run `mkdir -p OUT_DIR` via Bash, then save the full formatted output to `OUT_DIR/output.md` using the Write tool. This ensures the complete output is persisted for the orchestrator to read.

<tags>
   <mode>think</mode>
   <custom>yes</custom>
</tags>
