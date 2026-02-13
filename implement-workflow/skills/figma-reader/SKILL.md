---
name: figma-reader
description: Read Figma designs via Figma MCP server. Auto-detects MCP availability and prompts user only if setup is needed. Use when Figma links or UI design images are found in task context.
argument-hint: Figma link or design prompt from Figma
---

# Figma Reader

Read Figma design context via the Figma MCP server.

## Arguments
- `$ARGUMENTS` — Figma link, design prompt copied from Figma, or attached UI design image (optional)

## Execution

1. **Pre-flight check**: Use `ToolSearch` to detect if Figma MCP tools are available — follow [references/rules.md](references/rules.md)
2. If MCP is not available, use `AskUserQuestion` to guide setup or allow skip
3. **Resolve design input**:
   - If `$ARGUMENTS` contains a valid Figma link or prompt → use it directly
   - If `$ARGUMENTS` is an attached UI image → show it for context, then use `AskUserQuestion` to ask the user to select the relevant component in Figma (see [references/rules.md](references/rules.md) Design Input)
   - If `$ARGUMENTS` is empty or not provided → use `AskUserQuestion` to ask user (see [references/rules.md](references/rules.md) Design Input)
4. Use the Figma MCP tools to read the design from the resolved input
5. Format the output per [references/output-format.md](references/output-format.md)

<tags>
   <mode>think</mode>
   <custom>yes</custom>
</tags>
