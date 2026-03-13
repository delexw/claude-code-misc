---
name: figma-reader
description: Read Figma designs via Figma MCP server. Auto-detects MCP availability and prompts user only if setup is needed. Use when Figma links or UI design images are found in task context.
agent: general-purpose
model: sonnet
argument-hint: <Figma link or design prompt> <OUT_DIR>
allowed-tools: Read, Bash, Write, Edit, mcp__figma__*
context: fork
---

# Figma Reader

Read Figma design context via the Figma MCP server.

## Arguments
- DESIGN_INPUT = $ARGUMENTS[0] — Figma link, design prompt copied from Figma, or attached UI design image (optional)
- OUT_DIR = $ARGUMENTS[1] — Output directory for persisting the design context. Defaults to `.implement-assets/figma`

If OUT_DIR is empty, default to `.implement-assets/figma`. Use OUT_DIR for all output paths below.

## Execution

1. **Pre-flight check**: Use `ToolSearch` to detect if Figma MCP tools are available — follow [references/rules.md](references/rules.md)
2. If MCP is not available, use `AskUserQuestion` to guide setup or allow skip
3. **Resolve design input**:
   - If DESIGN_INPUT contains a valid Figma link or prompt → use it directly
   - If DESIGN_INPUT is an attached UI image → show it for context, then use `AskUserQuestion` to ask the user to select the relevant component in Figma (see [references/rules.md](references/rules.md) Design Input)
   - If DESIGN_INPUT is empty or not provided → use `AskUserQuestion` to ask user (see [references/rules.md](references/rules.md) Design Input)
4. **Read design**: Use the Figma MCP tools to read the design from the Figma link resolved in step 3
   - Format the output per [references/output-format.md](references/output-format.md)
   - **Save output**: Run `mkdir -p OUT_DIR` via Bash, then save the full formatted output to `OUT_DIR/output.md` using the Write tool