---
name: confluence-page-viewer
description: Read Confluence page content using the confluence CLI. Use when given a Confluence page URL to fetch and display page information.
agent: general-purpose
argument-hint: <Confluence page URL and optional output directory>
allowed-tools: Read, Bash, Write, Edit
context: fork
model: sonnet
---

# Confluence Page Viewer

Fetch and display Confluence page content using `confluence-cli`.

## Inputs

Raw arguments: $ARGUMENTS

Infer from the arguments:
- PAGE_URL: the Confluence page URL
- OUT_DIR: output directory, or `.implement-assets/confluence` if not provided

## System Requirements
- `confluence-cli` installed and available in PATH (https://github.com/pchuri/confluence-cli)

## Execution

1. **Pre-flight check**: Run `which confluence-cli` to verify the CLI is available. If not found, follow error handling in [references/rules.md](references/rules.md). Do NOT continue until the CLI is available.
2. Validate PAGE_URL against [references/rules.md](references/rules.md)
3. **Resolve short links**: If PAGE_URL matches `/wiki/x/ENCODED`, decode it to a numeric page ID (see [references/rules.md](references/rules.md) for decoding steps), then use that ID instead.
4. Run `confluence-cli read PAGE_URL_OR_ID` via Bash
5. Format the output per [references/output-format.md](references/output-format.md)
6. **Save output**: Run `mkdir -p OUT_DIR` via Bash, then save the full formatted output to `OUT_DIR/scroll.md` using the Write tool.