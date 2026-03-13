---
name: verification
description: Verify implementation changes via code review and QA web testing. Runs a loop of codex-review + qa-web-test until all issues are resolved. Use after implementation is complete, on a branch with uncommitted or committed changes.
argument-hint: <dev-env-context>
allowed-tools: Read, Bash, Write, Edit
---

# Verification

Verify implementation changes via iterative code review and optional QA web testing.

## Arguments
- `$ARGUMENTS[0]` — (optional) Dev environment context. Can be a dev server URL or empty to auto-detect.

## Execution

### Resolve Dev URL (once, before loop)

If `$ARGUMENTS[0]` is provided, use it to infer the dev environment setup (it may reference a skill, project, service, or directory — use your judgement to determine the dev server URL from its context). Otherwise check for a running dev server (`localhost:3000`, `localhost:5173`, `localhost:8080`). If no dev server found, QA web test will be skipped.

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

3. **Confidence Check** — After both code review and QA pass with no issues, verify again:
   - Review the diff one more time — any edge cases missed, logic errors, regressions, security vulnerabilities, performance issues, improper abstractions, duplicate code, or failure to reuse existing shared code?
   - Any issues dismissed as minor that are actually important?
   - Are you lacking specific technical knowledge relevant to this task (e.g., framework APIs, library behavior, platform constraints)? If so, look it up before concluding.
   - **If any issue found** — fix it and loop back to step 1.
   - **Only exit the loop when sure** there are no remaining issues.

## Output

Do NOT delete `.codex-review-output.md` — it serves as an audit trail of the code review.

Output a summary of what was verified and any fixes applied:

```json
{
  "status": "passed | fixed | skipped",
  "reviewRounds": 2,
  "qaRun": true,
  "fixesApplied": ["Fixed missing null check in auth handler"],
  "errors": []
}
```

- `passed` — all checks passed without needing fixes
- `fixed` — issues were found and fixed, final round passed
- `skipped` — verification was skipped (e.g. no dev server, no changes)
