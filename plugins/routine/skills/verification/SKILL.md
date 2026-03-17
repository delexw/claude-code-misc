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
- TARGET_URLS: one or more URLs to test — full affected page URLs or a root dev server URL. Multiple URLs are space-separated.

## Execution

### Resolve Target URLs (once, before loop)

If TARGET_URLS are provided, use them directly as the QA test targets. If no URLs are provided, QA web test will be skipped.

### Run Autoresearch

Invoke `Skill("autoresearch")` with the verification process as context — let autoresearch decide the goal, metric, guard, and loop configuration:

```
Verify implementation changes on the current branch.

Each iteration MUST run these skills in order:
1. Skill("codex-review", "review the uncommitted changes against main branch") — use OpenAI Codex CLI (always run)
2. Skill("qa-web-test", "{target_urls}") — visual QA web testing (only if dev server/URLs found). Pass ALL target URLs so each affected page is tested.

Fix all issues found, then loop until verification pass clean.
```

## Output

Output a JSON summary:

```json
{
  "status": "passed | fixed | skipped",
  "summary": "<build a report using the Summary Template below, then write a short funny poem reflecting what was reviewed and what was fixed — return the poem here as the summary>",
  "screenshots": ["path/to/screenshot1.png", "path/to/screenshot2.png"]
}
```

The `screenshots` array must contain **absolute paths** to all screenshots captured during QA web testing. If no screenshots were taken, return an empty array `[]`.

### Summary Template

Use this structure for the `summary` field. Omit sections that don't apply.

```markdown
## Verification Report

**Status:** {✅ passed | 🔧 fixed | ⏭️ skipped} | **Iterations:** {n}

### Code Review

| Area | Finding | Severity | Resolution |
|------|---------|----------|------------|
| {area} | {description} | Critical/Warning/Info | Fixed/Acknowledged/N/A |

### Visual QA

| Viewport | Page/Component | Result | Notes |
|----------|---------------|--------|-------|
| {width}px | {target} | Pass/Fail/Fixed | {details} |

### Fixes Applied

- **{file_path}**: {what changed} — {why}

### Screenshots

- `{path}` — {viewport}px {page/component}
```

**Guidelines:** Be specific — reference file paths, line numbers, component names. Group findings by area (accessibility, layout, logic, types). Show before/after for non-trivial fixes.
