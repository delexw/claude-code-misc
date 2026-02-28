# Phase 3.3: Page Inspection (Conditional)

> **Worktree reminder:** If Phase 2.5 created a worktree, ensure you are in the worktree directory before proceeding (`cd "$WORKTREE_PATH"`).

> **Skip this phase** if the JIRA ticket context does not suggest frontend or UI-affecting changes.

## Determine If Page Inspection Applies

Based on the JIRA ticket analysis from Phase 2, use your best judgement. Run this phase when:
- The ticket involves UI changes (layout, styling, components)
- The ticket involves backend changes that affect what users see
- A Figma design or UI screenshot is attached — capturing the current state helps compare before/after
- The ticket references a specific page or route

If the ticket has no web-visible impact, skip this phase.

## Find Development URL

1. If `$ARGUMENTS[1]` is provided, use it to infer the dev environment setup (it may reference a skill, project, service, or directory — use your judgement to determine the dev server URL from its context)
2. Check for a running dev server (e.g. `localhost:3000`, `localhost:5173`, `localhost:8080`)
3. If no dev server is found, skip this phase and note "Page inspection skipped: no dev server running"

Combine the dev server URL with the relevant page path from the JIRA ticket to form the full URL.

## Run Page Inspector

Launch a `Task` call with prompt to invoke `Skill("page-inspector")` with `{url} {TICKET_ASSETS_DIR}/page-inspector`:

After completion, **read `TICKET_ASSETS_DIR/page-inspector/output.md`** and append it to `<task><design>` as a baseline reference for the current page state.
