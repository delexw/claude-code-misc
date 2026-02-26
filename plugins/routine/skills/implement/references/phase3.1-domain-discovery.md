# Phase 3.1: Domain Discovery (via `Skill("domain-discover")`)

> **Worktree reminder:** If Phase 2.5 created a worktree, ensure you are in the worktree directory before proceeding (`cd "$WORKTREE_PATH"`).

- For each domain listed in `<task><domains>`, launch a `Task` call with prompt: `Invoke Skill("domain-discover") with "{domain_name} {TICKET_ASSETS_DIR}/domains"` (e.g. `payments .implement-assets/EC-10420/domains`)
- Each invocation creates a `{domain}.md` file in `TICKET_ASSETS_DIR/domains/`.
- After all invocations complete, read each generated `TICKET_ASSETS_DIR/domains/{domain}.md` file and append its content to `<task><domain_knowledge>`.
