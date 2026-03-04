# Phase 6: Execute

> **Worktree reminder:** If Phase 2.5 created a worktree, ensure you are in the worktree directory before proceeding (`cd "$WORKTREE_PATH"`).

- Invoke `Skill("{ticket_id}-impl")` — the dynamic skill has all context and the implementation plan as lazy-loaded reference files
- The skill's `SKILL.md` directs the agent to follow `implementation-plan.md` and read context files as needed
