---
name: qa-web-test
description: QA web testing skill using PinchTab browser automation for visual regression testing, responsive breakpoint validation, and CSS layout debugging. Use this skill whenever the user asks to "test a page", "check breakpoints", "verify responsive layout", "QA this page", "test CSS at different viewports", "check for layout bugs", "verify the fix", or wants to visually inspect a web page at specific viewport widths. Also triggers when the user provides a URL and asks to take screenshots, compare layouts, or inspect element dimensions. Works with any PinchTab-connected browser session on localhost or staging environments.
argument-hint: <target URL and optional output directory>
allowed-tools: Bash, Read, Glob, Grep, Write, Edit, Skill
model: sonnet
context: fork
---

# QA Web Testing with PinchTab

Uses `Skill("pinchtab")` for all browser interaction — navigation, screenshots, viewport emulation, and DOM inspection. Describe what you need and let pinchtab handle the details.

## Inputs

Raw arguments: $ARGUMENTS

Infer from the arguments:
- TARGET_URL: the URL to test
- OUT_DIR: output directory for QA report and screenshots, or `./qa-reports` if not provided

## Output Location

- Creates or updates `OUT_DIR/qa-report-{timestamp}.md`
- Screenshots are saved to `OUT_DIR/screenshots/`
- Run `mkdir -p OUT_DIR/screenshots` before writing to ensure directories exist.

## Workflow

Follow these steps in order. Read each step file for detailed instructions.

1. **[Connect and navigate](steps/step-01-connect.md)** — Navigate to target URL
2. **[Determine breakpoints](steps/step-02-breakpoints.md)** — Choose viewport widths to test
3. **[Emulate and capture](steps/step-03-emulate-and-capture.md)** — Set viewport, screenshot, inspect dimensions
4. **[CSS inspection](steps/step-04-css-inspection.md)** — Inspect computed styles and container queries
5. **[Visual design inspection](steps/step-04b-visual-inspection.md)** — Check typography, color, spacing, borders, and visibility
6. **[Report results](steps/step-05-report.md)** — Summarize findings with pass/fail table

## Reference Files

| Reference | When to Read |
|-----------|-------------|
| [references/breakpoints.md](references/breakpoints.md) | Common breakpoint values, container query vs media query gotchas |
| [references/css-inspection.md](references/css-inspection.md) | JS snippets for overflow detection, grid/flex inspection, DOM traversal |
