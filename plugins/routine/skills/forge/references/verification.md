# Verification Checklist

## Phase 7: Verify Changes

> **Worktree reminder:** If Phase 2.5 created a worktree, ensure you are in the worktree directory before proceeding (`cd "$WORKTREE_PATH"`).

### Resolve Dev URL (once, before loop)

If `$ARGUMENTS[1]` is provided, use it to infer the dev environment setup (it may reference a skill, project, service, or directory — use your judgement to determine the dev server URL from its context). Otherwise check for a running dev server (`localhost:3000`, `localhost:5173`, `localhost:8080`). If no dev server found, QA web test will be skipped.

### Loop until all issues are resolved:

1. **Code Review** — Invoke `Skill("codex-review", "review the uncommitted changes against main branch")` to review all changed files.
   - **If critical or important issues found** — fix them and re-run the code review (loop back to step 1).
   - **If only minor or no issues** — proceed to step 2.

2. **QA Web Test** (conditional) — Run only when code review passes (no P1/P2) AND a dev URL was resolved AND:
   - UI files were changed (`.tsx`, `.jsx`, `.vue`, `.css`, `.scss`, `.html`, templates, components)
   - Backend changes affect data the UI renders (API responses, formatting, rendering logic)
   - Bug fixes where the browser is the best way to visually confirm the fix

   Invoke `Skill("qa-web-test", "{dev_url}")`.
   - **If QA issues found** — fix them and loop back to step 1 (code review again after fixes).

## Error Handling

- If any phase failed, report which phase and why

## Output

Do NOT delete `.codex-review-output.md` — it serves as an audit trail of the code review.

Clean up the dynamic skill directory — only delete the exact `~/.claude/skills/{ticket_id}` directory, nothing else:

```bash
rm -rf ~/.claude/skills/{ticket_id}
```

Then output a JSON summary as the skill's response:

```json
{
  "ticket_id": "EC-1234",
  "branch": "EC-1234-fix-payment-checkout-bug",
  "worktree_path": "/absolute/path/to/worktree",
  "status": "completed | partial | failed",
  "summary": "Brief description of what was implemented",
  "errors": []
}
```

- `status`:
  - `completed` — all phases succeeded, implementation done
  - `partial` — implementation done but some non-critical phases were skipped (e.g. no git repo, no Figma links)
  - `failed` — a critical phase failed, implementation incomplete
- `worktree_path` — the absolute path to the git worktree where changes were made (empty string if Phase 2.5 was skipped)
- `errors` — array of error messages from any failed phases (empty if none)
