# Figma Reader Rules

## Codebase Check

Before running the skill, determine if the current codebase is a frontend project.

1. Look for frontend indicators: `package.json` with frontend dependencies (React, Vue, Angular, Svelte, etc.), frontend config files (`next.config.*`, `vite.config.*`, `tailwind.config.*`, `tsconfig.json` with JSX), or `src/` directories with `.tsx`/`.jsx`/`.vue`/`.svelte` files
2. **If frontend project** → proceed to Pre-flight Check
3. **If NOT a frontend project** → skip the entire skill, return: `Skipped — current codebase is not a frontend project.`

## Pre-flight Check

1. Use `ToolSearch` with query `"figma"` to detect if Figma MCP tools are available
2. **If tools are found** → proceed directly to Design Input step
3. **If tools are NOT found** → use `AskUserQuestion`:

**Question:** "Figma MCP server is not detected. How would you like to proceed?"

**Options:**
1. **"Help me set it up"** — Guide user to: https://developers.figma.com/docs/figma-mcp-server/local-server-installation/
2. **"Skip Figma scanning"** — Return empty design context, do NOT block the workflow

## Design Input

If `$ARGUMENTS` already contains a valid Figma link (`https://www.figma.com/design/...`) or prompt, use it directly — skip this step.

If `$ARGUMENTS` is an attached UI image, show it to the user for context, then use `AskUserQuestion` below to ask them to select the relevant component in Figma.

If `$ARGUMENTS` is empty or not provided, use `AskUserQuestion`:

**Question:** "Please select the relevant design or component in Figma and provide one of the following:"

**Options:**
1. **"Figma link"** — User provides the Figma file/frame URL
2. **"Example prompt from Figma"** — User provides the prompt copied from Figma's dev mode
3. **"Skip"** — Return empty design context

## Implement-Design Handoff

After saving the design output, check if the `implement-design` skill is available and hand off implementation.

1. Check the available skills list (from the system-reminder) for `implement-design`
2. **If `implement-design` is available** → invoke `Skill("implement-design")` with the Figma link
3. **If `implement-design` is NOT available** → use `AskUserQuestion`:

**Question:** "The `implement-design` skill can translate Figma designs into production code. Would you like to install it?"

**Options:**
1. **"Yes, install it"** — Run `npx skills add https://github.com/figma/mcp-server-guide` via Bash, then invoke `Skill("implement-design")` after installation
2. **"Skip implementation"** — End with the design context only, do NOT proceed to implementation

## Error Handling

- **MCP Not Available**: Use `AskUserQuestion` — guide user to install Figma MCP: https://developers.figma.com/docs/figma-mcp-server/local-server-installation/
- **Invalid Link**: "Figma link format not recognized. Provide a URL like `https://www.figma.com/design/...`"
- **Access Denied**: Use `AskUserQuestion` — ask user to verify Figma MCP token permissions
