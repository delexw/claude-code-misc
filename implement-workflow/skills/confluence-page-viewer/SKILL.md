---
name: confluence-page-viewer
description: Read Confluence page content using the confluence CLI. Use when given a Confluence page URL to fetch and display page information.
context: fork
argument-hint: Confluence page URL (e.g. https://envato.atlassian.net/wiki/spaces/MS/pages/...)
---

# Confluence Page Viewer

Fetch and display Confluence page content using the `confluence` CLI tool.

## Arguments
- `$ARGUMENTS` — Confluence page URL

## System Requirements
- `confluence` CLI installed and configured (https://github.com/pchuri/confluence-cli)

## Execution

1. **Pre-flight check**: Run `confluence --help` to verify the CLI is installed — if it fails, follow error handling in [references/rules.md](references/rules.md). Do NOT continue until the CLI is available. Auth errors are caught when the actual command runs.
2. Validate `$ARGUMENTS` against [references/rules.md](references/rules.md)
3. Run `confluence read $ARGUMENTS` via Bash
4. Format the output per [references/output-format.md](references/output-format.md)

<tags>
   <mode>think</mode>
   <custom>yes</custom>
</tags>
