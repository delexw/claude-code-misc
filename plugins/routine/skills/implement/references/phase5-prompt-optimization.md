# Phase 5: Prompt Optimization (via `Skill("meta-prompter")`)

> **Worktree reminder:** If Phase 2.5 created a worktree, ensure you are in the worktree directory before proceeding (`cd "$WORKTREE_PATH"`).

- Before invoking, use `/model <model_id>` (from `<task><model_id>`) to reset to the original model, in case a previous sub-skill changed it
- Invoke `Skill("meta-prompter")` with all accumulated `<task>` context **and the output path**: `{task_context} {TICKET_ASSETS_DIR}/meta-prompter`
- After the skill completes, **read `TICKET_ASSETS_DIR/meta-prompter/output.md`** to get the full `<OPTIMIZED_PROMPT>`
