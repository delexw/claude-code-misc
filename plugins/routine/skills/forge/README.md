# Forge (Experiment)

JIRA ticket to implementation via dynamic skill generation.

## How it works

Forge takes a JIRA ticket URL and produces a working implementation through two stages:

### Stage 1: Context gathering (Phases 1-5)

Each phase runs as a `Task` **subagent** with its own isolated context window, writing output to files inside a **dynamically created skill** at `.claude/skills/{ticket_id}/`:

```
.claude/skills/{ticket_id}/
├── SKILL.md                    # Generated in Phase 5 — ties everything together
├── context.md                  # User-provided context
├── jira/output.json            # JIRA ticket data
├── domains.json                # Identified business domains
├── domains/{domain}.md         # Codebase knowledge per domain
├── supporting-context/         # Confluence pages, linked tickets, PRs
├── design/                     # Figma designs, UI specs
├── meta-prompter/output.md     # Optimized prompt
└── implementation-plan.md      # Structured execution plan
```

### Stage 2: Execution (Phases 6-7)

Forge invokes `Skill("{ticket_id}-impl")` — the dynamic skill it just created. Claude Code auto-discovers it via live change detection. The execution subagent gets a **clean context window** with only the skill's `SKILL.md` loaded initially. Reference files (requirements, domain knowledge, designs, etc.) are **lazy-loaded on demand** — the subagent only reads the files it actually needs for the current implementation step.

## The problem forge solves

In Claude headless mode (non-interactive), `implement` (v1) dumps the full `<task>` XML — requirements, domain knowledge, design specs, supporting context — into the execution subagent's prompt upfront. This bloats the context window with data that isn't needed at every step, leading to **context exhaustion that kills the process mid-run**.

## How forge solves it

The core insight: **the dynamic skill is a context container with on-demand access**.

1. **Subagent isolation** — each gathering phase runs in its own context window, keeping the orchestrator lean
2. **Dynamic skill as disk-based context** — phases write output files into the skill directory instead of accumulating in-memory XML
3. **Lazy loading at execution time** — when the execution subagent invokes `Skill("{ticket_id}-impl")`, it starts clean and only reads the files it needs for the current step, not everything at once

```
implement (v1)                          forge (v2)
─────────────────                       ──────────────────
Phase 1-5: gather context               Phase 1-5: gather context
    ↓ accumulate into <task> XML             ↓ write to .claude/skills/{ticket_id}/
Phase 6: subagent gets full <task>       Phase 5: generate SKILL.md
    ↓ everything loaded at once              ↓ references all output files
    ↓ context exhaustion risk            Phase 6: invoke Skill("{ticket_id}-impl")
Phase 7: verify with full <task>             ↓ subagent lazy-loads only what's needed
                                         Phase 7: verify via same skill
```

**Key benefits:**

- **Prevents context exhaustion** — The execution subagent starts with a clean context and pulls files on demand, avoiding the mid-process crash seen in headless mode
- **Persistent** — The generated skill survives session restarts. You can re-invoke `/{ticket_id}-impl` later
- **Extensible** — Add new `3.x` phases to gather more context; they just write files to the skill directory
- **Debuggable** — All context is on disk as readable files, not buried in conversation history

## Usage

```
/forge https://yourcompany.atlassian.net/browse/PROJ-123
/forge https://yourcompany.atlassian.net/browse/PROJ-123 "focus on the payment module in ~/code/payments"
```

## Phase overview

| Phase | What | Output |
|-------|------|--------|
| 1 | Initialization | `SKILL_DIR` created, model ID captured |
| 2 | JIRA Analysis | `jira/output.json`, `domains.json` |
| 2.5 | Create Git Branch | Git worktree for isolated work |
| 3.1 | Domain Discovery | `domains/{domain}.md` |
| 3.2 | Resource Scanning | `supporting-context/`, `design/` |
| 4 | Prompt Optimization | `meta-prompter/output.md` |
| 5 | Planning + Skill Gen | `implementation-plan.md`, `SKILL.md` |
| 6 | Execute | Invoke `Skill("{ticket_id}-impl")` |
| 7 | Verification | Verify via same skill |

Phases 3.x run concurrently. All other phases are sequential.

## Comparison with `implement`

| | `implement` | `forge` |
|---|---|---|
| Execution context | Full `<task>` XML loaded upfront | Lazy-loaded skill references on demand |
| Context exhaustion risk | High in headless mode | Low — subagent starts clean |
| Reusability | Context lost after session | Skill persists, re-invocable |
| Extensibility | Add XML tags | Add files to skill directory |

## See also

- **`implement`** — Original variant using `<task>` XML accumulation
