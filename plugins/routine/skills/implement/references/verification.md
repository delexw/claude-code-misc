# Verification Checklist

## Phase 7: Verify Changes

> **Worktree reminder:** If Phase 2.5 created a worktree, ensure you are in the worktree directory before proceeding (`cd "$WORKTREE_PATH"`).

Launch a `Task` call with prompt containing all accumulated `<task>` context, instructing it to review every change and ensure it is:
- reasonable and well-justified
- within the scope of the JIRA ticket:
   - If a PR link was provided as an example → "Are my changes aligned with what the example PR guides?"
   - If a Figma design or UI image was present → "Are the UI changes compliant with `<task><design>`?"
   - If a runbook or guidance link was present → "Are my changes fully following the runbook?"
- compliant with project conventions/standards
- evidence-based (no guesswork)

The task must fix or rollback anything that's wrong or off.

## Error Handling

- Network failures → Return timeout error with retry suggestion
- If any phase failed, report which phase and why

## Final Output

After verification, output a JSON summary as the skill's final response:

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
