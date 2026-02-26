# Phase 5: Implementation Planning

> **Worktree reminder:** If Phase 2.5 created a worktree, ensure you are in the worktree directory before proceeding (`cd "$WORKTREE_PATH"`).

- Launch a `Task` call with prompt containing all accumulated `<task>` context and `<OPTIMIZED_PROMPT>`, instructing it to generate a structured implementation plan:
  - **Identify task type:** code, debug, content/docs, or safety
  - **Detect required phases:** look for sequencing constraints in the ticket (e.g., DB migrations → application changes → backfill, feature flags → rollout → cleanup). Each constraint must be its own numbered phase in the plan.
  - **For each phase, document:**
    - What will be done (files to change, commands to run)
    - Why it must happen in this order (dependency / safety reasoning)
    - Rollback or recovery steps for risky operations (migrations, data changes, deploys)
  - **List critical files** that will be touched
  - **Identify risks** and how they will be mitigated
  - Write the plan to `TICKET_ASSETS_DIR/implementation-plan.md`
- After the task completes, **read `TICKET_ASSETS_DIR/implementation-plan.md`**
- Call the `ExitPlanMode` tool to present the plan to the user, then proceed to Phase 6
