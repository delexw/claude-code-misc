# Figma Reader Rules

## Pre-flight Check

1. Use `ToolSearch` with query `"figma"` to detect if Figma MCP tools are available
2. **If tools are found** → proceed directly to Design Input step
3. **If tools are NOT found** → use `AskUserQuestion`:

**Question:** "Figma MCP server is not detected. How would you like to proceed?"

**Options:**
1. **"Help me set it up"** — Guide user to: https://developers.figma.com/docs/figma-mcp-server/local-server-installation/
2. **"Skip Figma scanning"** — Return empty design context, do NOT block the workflow

## Design Input

If `$ARGUMENTS` already contains a valid Figma link (`https://www.figma.com/...`) or prompt, use it directly — skip this step.

If `$ARGUMENTS` is an attached UI image, show it to the user for context, then use `AskUserQuestion` below to ask them to select the relevant component in Figma.

If `$ARGUMENTS` is empty or not provided, use `AskUserQuestion`:

**Question:** "Please select the relevant design or component in Figma and provide one of the following:"

**Options:**
1. **"Figma link"** — User provides the Figma file/frame URL
2. **"Example prompt from Figma"** — User provides the prompt copied from Figma's dev mode
3. **"Skip"** — Return empty design context

## Error Handling

- **MCP Not Available**: Use `AskUserQuestion` — guide user to install Figma MCP: https://developers.figma.com/docs/figma-mcp-server/local-server-installation/
- **Invalid Link**: "Figma link format not recognized. Provide a URL like `https://www.figma.com/design/...`"
- **Access Denied**: Use `AskUserQuestion` — ask user to verify Figma MCP token permissions
