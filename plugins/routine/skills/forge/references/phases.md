# Implement Phases — Index

## Architecture

Each phase writes its output to files inside a **dynamically created skill** at `~/.claude/skills/{ticket_id}/`.

### Skill directory structure (built progressively)

```
~/.claude/skills/{ticket_id}/
├── SKILL.md                    # Created in Phase 5, references all context files
├── context.md                  # P1: additional user-provided context
├── jira/                       # P2: raw JIRA ticket output
│   └── output.json
├── domains.json                # P2: identified domains + summary
├── domains/                    # P3.1: codebase knowledge per domain
│   └── {domain}.md
├── supporting-context/         # P3.2: scanned links
│   ├── confluence/
│   ├── linked-jira/
│   └── other/
├── design/                     # P3.2: Figma/UI design context
│   └── figma-{index}.md
├── meta-prompter/              # P4: optimized prompt
│   └── output.md
└── implementation-plan.md      # P5: structured execution plan
```

> **Output file convention:** Sub-skills with `context: fork` run as subagents whose return values may be summarized. To get the **complete** output, each sub-skill persists its full response to a file on disk. After a forked skill completes, **always read the output file** (e.g. `OUT_DIR/output.md`) rather than relying on the subagent's return value.

## Phases

Execute each phase sequentially. Read the linked file for detailed instructions when you reach that phase.

1. **Initialization** — [phase1-initialization.md](references/phase1-initialization.md)
2. **JIRA Analysis** — [phase2-jira-analyzer.md](references/phase2-jira-analyzer.md)
3. **Create Git Branch** — [phase2.5-create-branch.md](references/phase2.5-create-branch.md)
4. **Discovery & Scanning** (all 3.x phases run concurrently):
   - 3.1 **Domain Discovery** — [phase3.1-domain-discovery.md](references/phase3.1-domain-discovery.md)
   - 3.2 **Resource Scanning** — [phase3.2-resource-scanning.md](references/phase3.2-resource-scanning.md)
5. **Prompt Optimization** — [phase4-prompt-optimization.md](references/phase4-prompt-optimization.md)
6. **Implementation Planning + Skill Generation** — [phase5-implementation-planning.md](references/phase5-implementation-planning.md)
7. **Execute** — [phase6-execution.md](references/phase6-execution.md)
8. **QA Web Test** (conditional: user-visible web changes) — [phase6.5-qa-web-test.md](references/phase6.5-qa-web-test.md)
9. **Verification** — [verification.md](references/verification.md)
