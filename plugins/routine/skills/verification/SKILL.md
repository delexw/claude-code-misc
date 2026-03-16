---
name: verification
description: Verify implementation changes via autoresearch-driven code review and QA web testing. Iterates autonomously — review, fix, verify, keep/discard — until all issues are resolved. Use after implementation is complete, on a branch with uncommitted or committed changes.
argument-hint: <dev-env-context>
allowed-tools: Read, Bash, Write, Edit
---

# Verification

Verify implementation changes using the autoresearch loop pattern: review → fix → verify → keep/discard → repeat.

## Inputs

Raw arguments: $ARGUMENTS

Infer from the arguments:
- DEV_CONTEXT: (optional) dev environment context — can be a dev server URL or empty to auto-detect

## Execution

### Resolve Dev URL (once, before loop)

If DEV_CONTEXT is provided, use it to infer the dev environment setup (it may reference a skill, project, service, or directory — use your judgement to determine the dev server URL from its context). Otherwise check for a running dev server (`localhost:3000`, `localhost:5173`, `localhost:8080`). If no dev server found, QA web test will be skipped.

### Run Autoresearch

Invoke `Skill("autoresearch")` with the verification process as context — let autoresearch decide the goal, metric, guard, and loop configuration:

```
Verify implementation changes on the current branch.

Available verification tools:
- Skill("codex-review", "review the uncommitted changes against main branch")
- Skill("qa-web-test", "{dev_url}") — visual QA web testing (only if Web UI verification required and dev server found)

Fix all issues found until verification passes clean.
```

## Output

Output a JSON summary:

```json
{
  "status": "passed | fixed | skipped",
  "summary": "Rich markdown summary of what was verified and any fixes applied",
  "screenshots": ["path/to/screenshot1.png", "path/to/screenshot2.png"]
}
```

The `screenshots` array must contain **absolute paths** to all screenshots captured during QA web testing. If no screenshots were taken, return an empty array `[]`.
