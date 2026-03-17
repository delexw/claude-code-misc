# Implement Phases — Index

## Architecture

Each phase writes its output to files inside a **dynamically created skill** at `~/.claude/skills/{ticket_id}/`.

### Skill directory structure (built progressively)

```
~/.claude/skills/{ticket_id}/
├── SKILL.md                            # Created in Phase 5
└── references/
    ├── briefing.md                     # P1: additional user-provided context
    ├── dossier.json                    # P2: JIRA ticket data
    ├── domains.json                    # P2: identified domains + summary
    ├── domain-index.md                 # P3.1: lightweight domain path index
    ├── soul.md                         # P4: optimized prompt (conditional)
    ├── intel/                          # P3.2: scanned links
    │   ├── scrolls/
    │   ├── dossiers/
    │   └── scraps/
    ├── blueprints/                     # P3.2: Figma/UI design context
    │   └── {index}/blueprint.md
    └── mugshots/                       # P3.3: page inspection baseline
        ├── mugshot.md
        └── screenshots/
```

> **Output file convention:** Sub-skills with `context: fork` run as subagents whose return values may be summarized. To get the **complete** output, each sub-skill persists its full response to a file on disk. After a forked skill completes, **always read the output file** (e.g. `SKILL_DIR/references/soul.md`, `SKILL_DIR/references/intel/scrolls/{index}/scroll.md`) rather than relying on the subagent's return value.

## Phases

Execute each phase sequentially. Read the linked file for detailed instructions when you reach that phase.

1. **Initialization** — [phase1-initialization.md](references/phase1-initialization.md)
2. **JIRA Analysis** — [phase2-jira-analyzer.md](references/phase2-jira-analyzer.md)
3. **Discovery & Scanning** (all 3.x phases run concurrently):
   - 3.1 **Domain Index** (lightweight Glob/Grep, no domain-discover) — [phase3.1-domain-discovery.md](references/phase3.1-domain-discovery.md)
   - 3.2 **Resource Scanning** — [phase3.2-resource-scanning.md](references/phase3.2-resource-scanning.md)
   - 3.3 **Page Inspection** (conditional: frontend/UI-affecting changes) — [phase3.3-page-inspection.md](references/phase3.3-page-inspection.md)
4. **Prompt Optimization** (conditional: skip if ticket is well-specified) — [phase4-prompt-optimization.md](references/phase4-prompt-optimization.md)
5. **Skill Generation** — [phase5-skill-generation.md](references/phase5-skill-generation.md)
6. **Execute** — [phase6-execution.md](references/phase6-execution.md)
