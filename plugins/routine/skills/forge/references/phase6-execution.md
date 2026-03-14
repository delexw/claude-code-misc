# Phase 6: Execute

> **Worktree reminder:** If Phase 2.5 created a worktree, ensure you are in the worktree directory before proceeding (`cd "$WORKTREE_PATH"`).

- Invoke `Skill("{ticket_id}-impl")` — the dynamic skill has all context and the implementation plan as lazy-loaded reference files
- The skill's `SKILL.md` directs the agent to follow `battle-plan.md` and read context files as needed

## Output

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
  - `partial` — implementation done but some non-critical phases were skipped (e.g. no Figma links)
  - `failed` — a critical phase failed, implementation incomplete
- `worktree_path` — the absolute path to the git worktree where changes were made (empty string if Phase 2.5 was skipped)
- `errors` — array of error messages from any failed phases (empty if none)
