# Phase 3.1: Domain Discovery (via `Skill("domain-discover")`)

> **Worktree reminder:** If Phase 2.5 created a worktree, ensure you are in the worktree directory before proceeding (`cd "$WORKTREE_PATH"`).

- Read `SKILL_DIR/domains.json` to get the list of domains
- For each domain, launch a `Task` call with prompt: `Invoke Skill("domain-discover") with "{domain_name} {SKILL_DIR}/domains"` (e.g. `payments .claude/skills/EC-10420/domains`)
- Each invocation creates a `{domain}.md` file in `SKILL_DIR/domains/`
