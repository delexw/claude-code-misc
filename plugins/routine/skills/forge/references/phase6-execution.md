# Phase 6: Execute

- Invoke `Skill("{ticket_id}-impl")` — the dynamic skill has all context and the implementation plan as lazy-loaded reference files
- The skill's `SKILL.md` directs the agent to follow `battle-plan.md` and read context files as needed

## Output

Before cleanup, read `SKILL_DIR/references/mugshots/affected-urls.json` if it exists to populate the `affected_urls` field below. Then delete the dynamic skill directory:

```bash
rm -rf ~/.claude/skills/{ticket_id}
```

Then output a JSON summary as the skill's response:

```json
{
  "ticket_id": "EC-1234",
  "branch": "EC-1234-fix-payment-checkout-bug",
  "status": "completed | partial | failed",
  "summary": "Brief description of what was implemented",
  "affected_urls": ["https://localhost:1234/affected/page"],
  "errors": []
}
```

- `status`:
  - `completed` — all phases succeeded, implementation done
  - `partial` — implementation done but some non-critical phases were skipped (e.g. no Figma links)
  - `failed` — a critical phase failed, implementation incomplete
- `affected_urls` — page URLs the ticket affects. Empty array if no page inspection was run.
- `errors` — array of error messages from any failed phases (empty if none)
