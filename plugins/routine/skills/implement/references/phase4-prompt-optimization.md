# Phase 4: Prompt Optimization (via `Skill("meta-prompter")`)

> **Worktree reminder:** If Phase 2.5 created a worktree, ensure you are in the worktree directory before proceeding (`cd "$WORKTREE_PATH"`).

- Launch a `Task` call with prompt: `Invoke Skill("meta-prompter") with "{task_context} {TICKET_ASSETS_DIR}/meta-prompter"` — pass all accumulated `<task>` context and the output path
- After the task completes, **read `TICKET_ASSETS_DIR/meta-prompter/output.md`** to get the full `<OPTIMIZED_PROMPT>`
