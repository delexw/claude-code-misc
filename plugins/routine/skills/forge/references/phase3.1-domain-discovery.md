# Phase 3.1: Domain Discovery (via `Skill("domain-discover")`)

> **Worktree reminder:** If Phase 2.5 created a worktree, ensure you are in the worktree directory before proceeding (`cd "$WORKTREE_PATH"`).

- Read `SKILL_DIR/domains.json` to get the list of domains
- For each domain, invoke `Skill("domain-discover")` with the domain name and `SKILL_DIR/domains` as the output directory
- Each invocation creates a `{domain}.md` file in `SKILL_DIR/domains/`
