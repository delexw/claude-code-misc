---
name: page-inspector
description: Capture current page layout, styles, and structure from a live web page using PinchTab browser automation. Use when you need to understand the existing UI before making changes — captures screenshots, DOM structure, computed styles, and layout properties. Useful as a pre-implementation baseline for frontend or UI-affecting changes.
argument-hint: <target URL and optional output directory>
allowed-tools: Bash, Read, Write, Edit, Skill
model: sonnet
context: fork
---

# Page Inspector — Capture Current Page Layout & Styles

Uses `Skill("pinchtab")` for all browser interaction — navigation, screenshots, viewport emulation, and DOM inspection. Describe what you need and let pinchtab handle the details.

## Inputs

Raw arguments: $ARGUMENTS

Infer from the arguments:
- TARGET_URL: the URL to inspect
- OUT_DIR: output directory, or `./page-inspector-output` if not provided

## Execution

### 1. Navigate & Authenticate

- Navigate to TARGET_URL and take an interactive snapshot to confirm the page loaded.
- If the page requires authentication:
  1. **Check the system prompt** for any guidance on where to find credentials.
  2. **Check environment variables** — run `env | grep -iE 'USER|PASS|LOGIN|AUTH|TOKEN|CRED|SECRET|API_KEY' | sed 's/=.*/=***/'` to list available credential env vars (mask values in output).
  3. If credentials are found, fill the login form and submit, then re-snapshot.
  4. If none are found, use the `AskUserQuestion` tool to ask where credentials can be found (skip this in autonomous mode). If credentials cannot be obtained, **skip the entire skill** and note: "Skipped — page requires authentication but no credentials found."

### 2. Capture Desktop Screenshot

- Take a screenshot and save to `OUT_DIR/screenshots/desktop.png`
- Ensure `mkdir -p OUT_DIR/screenshots` before writing files

### 3. Capture Key Viewport Screenshots

For each width (1440px, 1024px, 768px, 375px):
- Resize viewport to the target width
- Take a screenshot and save to `OUT_DIR/screenshots/{width}px.png`

### 4. Inspect Layout Structure

Evaluate JavaScript that extracts:
- Key layout containers and their CSS display/position properties
- Flex/grid configurations on major layout elements
- Any fixed/sticky positioned elements
- Overall page structure (header, nav, main content, sidebar, footer)

### 5. Inspect Computed Styles

Evaluate JavaScript that captures for key UI elements:
- Font families, sizes, weights, line heights
- Colors (text, background, borders)
- Spacing (margins, paddings)
- Box sizing and dimensions

### 6. Write Output

Create `OUT_DIR/mugshot.md` with:

```markdown
# Page Inspector Report: {url}

## Screenshots
- Desktop (current): `screenshots/desktop.png`
- 1440px: `screenshots/1440px.png`
- 1024px: `screenshots/1024px.png`
- 768px: `screenshots/768px.png`
- 375px: `screenshots/375px.png`

## Page Structure
{DOM structure overview — key containers and their roles}

## Layout Properties
{CSS display, grid/flex configs, positioning for key elements}

## Typography & Colors
{Font stacks, sizes, color palette observed}

## Spacing & Dimensions
{Key measurements observed}

## Notes
{Any observations relevant to upcoming changes}
```
