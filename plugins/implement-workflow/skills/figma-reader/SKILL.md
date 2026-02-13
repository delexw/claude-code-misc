---
name: figma-reader
description: Read Figma designs via Figma MCP server. Auto-detects MCP availability and prompts user only if setup is needed. Use when Figma links or UI design images are found in task context.
context: fork
argument-hint: Figma link or design prompt [OUT_DIR] (e.g. "https://www.figma.com/design/..." ./out)
---

# Figma Reader

Read Figma design context via the Figma MCP server.

## Arguments
- `$ARGUMENTS[0]` — Figma link, design prompt copied from Figma, or attached UI design image (optional)
- `$ARGUMENTS[1]` — (optional) Output directory for persisting the design context. Defaults to `.implement-assets/figma`

When invoked by the orchestrator (e.g. `implement`), `$ARGUMENTS[1]` is provided. When used standalone, it defaults to `.implement-assets/figma`.

## Execution

Let `INPUT` = `$ARGUMENTS[0]`, `OUT_DIR` = `$ARGUMENTS[1]` (default `.implement-assets/figma`).

1. **Pre-flight check**: Use `ToolSearch` to detect if Figma MCP tools are available — follow [references/rules.md](references/rules.md)
2. If MCP is not available, use `AskUserQuestion` to guide setup or allow skip
3. **Resolve design input**:
   - If `INPUT` contains a valid Figma link or prompt → use it directly
   - If `INPUT` is an attached UI image → show it for context, then use `AskUserQuestion` to ask the user to select the relevant component in Figma (see [references/rules.md](references/rules.md) Design Input)
   - If `INPUT` is empty or not provided → use `AskUserQuestion` to ask user (see [references/rules.md](references/rules.md) Design Input)
4. Use the Figma MCP tools to read the design from the resolved input
5. Format the output per [references/output-format.md](references/output-format.md)
6. **Save output**: Run `mkdir -p OUT_DIR` via Bash, then save the full formatted output to `OUT_DIR/output.md` using the Write tool. This ensures the complete output is persisted for the orchestrator to read.

<tags>
   <mode>think</mode>
   <custom>yes</custom>
</tags>
