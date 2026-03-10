# Forge (Experiment)

JIRA ticket to implementation via dynamic skill generation.

Forge is **spec-driven** — but the spec is discovered, not prescribed. The agent explores the codebase, discovers related domains, and scans linked resources (Confluence pages, PRs, Figma designs) to generate the implementation spec itself. Even a one-line ticket becomes a fully contextualized spec — gathered automatically before any code is written.

## How it works

Two stages: **gather context**, then **execute in a clean context**.

### Stage 1: Context gathering (Phases 1-5)

Each phase runs in isolated context (`context: fork`), writing output to a **dynamically created skill** at `~/.claude/skills/{ticket_id}/`:

```
~/.claude/skills/{ticket_id}/
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

Forge invokes `Skill("{ticket_id}-impl")` — the dynamic skill it just created. The execution subagent starts with a **clean context window** and lazy-loads only the files it needs for each step.

## Why a dynamic skill in a clean context?

The dynamic skill is a **context container with on-demand access**. This design solves three problems:

1. **Prevents context exhaustion** — Instead of dumping all gathered context into the prompt upfront (which bloats the context window and kills headless runs mid-process), files are lazy-loaded on demand.

2. **Skill-agnostic execution** — The generated skill contains only the implementation plan and context references. It does **not** hardcode any skill dependencies. The execution subagent discovers and uses whatever skills the user has configured in `~/.claude/skills/` at runtime — a code review skill, a testing skill, a deployment skill — without forge needing to know about them in advance.

3. **No context pollution** — Forge's orchestrator invokes many skills during gathering (JIRA viewer, domain discovery, meta-prompter, etc.). If the execution subagent inherited that context, it would be biased toward those orchestrator-specific skills rather than the user's own. A clean context means Claude makes unbiased decisions about which tools and skills to use based on the task at hand.

The dynamic skill is a **task description**, not a workflow script. Forge separates **what to build** from **how to build it** (Claude's runtime decisions using available skills).

**Additional benefits:**
- **Persistent** — survives session restarts; re-invoke via `/{ticket_id}-impl`
- **Extensible** — add new `3.x` phases; they just write files to the skill directory
- **Debuggable** — all context is on disk as readable files

## Best fit

Forge is designed for work on **existing codebases** where the spec needs to be discovered from the code itself. It shines when:

- **Bug fixes and feature work in mature codebases** — the ticket says "fix X" but the agent needs to understand the surrounding architecture, data flows, and conventions before touching anything
- **Vague or under-specified tickets** — a one-liner like "improve checkout error handling" that requires exploring the codebase to understand what exists before deciding what to build
- **Cross-domain changes** — tickets that touch multiple modules or services where understanding the boundaries and contracts matters
- **Tickets with scattered context** — linked Confluence docs, Figma designs, related PRs, and previous tickets that need to be pulled together into a coherent plan

Forge is **not** the best fit for:
- **Greenfield projects** — there's no existing codebase to discover specs from
- **Simple, self-contained tasks** — if the ticket already describes exactly what to do and where, the exploration overhead isn't worth it

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
| 7 | Verification | Verify → fix → verify loop until passing |

Phases 3.x run concurrently. All other phases are sequential.

---

## Background: Previous orchestration approach (`implement`)

The previous orchestration skill (`implement`) used `<task>` XML accumulation — all gathered context was loaded into the execution subagent's prompt upfront.

```
implement (previous)                    forge (current)
─────────────────                       ──────────────────
Phase 1-5: gather context               Phase 1-5: gather context
    ↓ accumulate into <task> XML             ↓ write to ~/.claude/skills/{ticket_id}/
Phase 6: subagent gets full <task>       Phase 5: generate SKILL.md
    ↓ everything loaded at once              ↓ references all output files
    ↓ context exhaustion risk            Phase 6: invoke Skill("{ticket_id}-impl")
Phase 7: verify with full <task>             ↓ subagent lazy-loads only what's needed
                                         Phase 7: verify via same skill
```

| | `implement` (previous) | `forge` (current) |
|---|---|---|
| Execution context | Full `<task>` XML loaded upfront | Lazy-loaded skill references on demand |
| Context exhaustion risk | High in headless mode | Low — subagent starts clean |
| Skill dependencies | Hardcoded in orchestrator | None — adapts to user's installed skills |
| Reusability | Context lost after session | Skill persists, re-invocable |
| Extensibility | Add XML tags | Add files to skill directory |
