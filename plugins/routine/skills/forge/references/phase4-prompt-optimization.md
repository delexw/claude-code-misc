# Phase 4: Prompt Optimization (via `Skill("meta-prompter")`)

> **Worktree reminder:** If Phase 2.5 created a worktree, ensure you are in the worktree directory before proceeding (`cd "$WORKTREE_PATH"`).

- Build a summary of the task context by reading key output files:
  - `SKILL_DIR/jira/output.json` — requirements
  - `SKILL_DIR/domains.json` — domain analysis
  - `SKILL_DIR/domains/*.md` — domain knowledge
  - `SKILL_DIR/supporting-context/` — scanned links (if any)
  - `SKILL_DIR/design/` — design specs (if any)
  - `SKILL_DIR/context.md` — additional user context (if exists)
- Launch a `Task` call with prompt: `Invoke Skill("meta-prompter") with "{summarized_context} {SKILL_DIR}/meta-prompter"` — pass the summarized context and the output path
- After the task completes, **read `SKILL_DIR/meta-prompter/output.md`** to get the full `<OPTIMIZED_PROMPT>`
