# Phase 3.1: Domain Index (lightweight)

- Read `SKILL_DIR/references/domains.json` to get the list of domain names
- For each domain, use Glob and Grep to locate relevant directories, key entry files, and any README/AGENT.md inside those directories
- Write `SKILL_DIR/references/domain-index.md` in this format:

```markdown
# Domain Index

## {domain1}
- **Paths**: `app/services/foo/`, `lib/foo/`
- **Key files**: `app/services/foo/base.rb`, `app/models/foo.rb`
- **Description**: One-line description of what this domain covers

## {domain2}
...
```

Do **not** invoke `Skill("domain-discover")`. Full lore is fetched on-demand by the impl skill from source files in these paths.
