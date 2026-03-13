# Phase 4: Prompt Optimization (via `Skill("meta-prompter")`)

> **Worktree reminder:** If Phase 2.5 created a worktree, ensure you are in the worktree directory before proceeding (`cd "$WORKTREE_PATH"`).

- Build a summary of the task context by reading key output files:
  - `SKILL_DIR/jira/output.json` — requirements
  - `SKILL_DIR/domains.json` — domain analysis
  - `SKILL_DIR/domains/*.md` — domain knowledge
  - `SKILL_DIR/supporting-context/` — scanned links (if any)
  - `SKILL_DIR/specs/` — design specs (if any)
  - `SKILL_DIR/context.md` — additional user context (if exists)
- Invoke `Skill("meta-prompter")` with the summarized context and `SKILL_DIR/meta-prompter` as the output directory
- After completion, **read `SKILL_DIR/meta-prompter/output.md`** to get the full `<OPTIMIZED_PROMPT>`
