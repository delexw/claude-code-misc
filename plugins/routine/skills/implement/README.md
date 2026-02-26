# Implement

JIRA ticket to working implementation via orchestrated sub-skill pipeline.

## How it works

Implement takes a JIRA ticket URL and produces a working implementation by orchestrating multiple skills through a phased pipeline.

### Orchestrator + Subagent architecture

The implement skill acts as an **orchestrator**. Each phase runs as a `Task` **subagent** — an isolated agent with its own context window. This is critical because:

- **Prevents context overflow** — In Claude headless mode (non-interactive), a single agent accumulating much context will exhaust the context window and stop mid-process. Subagents isolate each phase's work.
- **Each subagent starts clean** — The orchestrator passes only the necessary inputs to each subagent, not the entire conversation history.
- **Subagent output persists to disk** — Each sub-skill writes its output to files in `TICKET_ASSETS_DIR`, so context is preserved across phases without bloating the orchestrator's window.

### Progressive phase loading

Each phase is split into its own `.md` file under `references/`. This leverages Claude Code's **lazy loading** mechanism:

- At startup, only `phases.md` (the lightweight index) is loaded
- Individual phase files (e.g. `phase3.1-domain-discovery.md`) are read **only when the orchestrator reaches that phase**
- This prevents **context contamination** — instructions for Phase 6 don't occupy context while Phase 2 is running

Without this split, loading the single phase instructions upfront would waste context on instructions that aren't yet relevant, contributing to the context exhaustion problem in headless mode.

### Context accumulation

The orchestrator accumulates key data in a `<task>` XML tag as phases complete:

```xml
<task>
  <model_id/>             <!-- P1: current model ID -->
  <context/>              <!-- P1: user-provided context -->
  <requirements/>         <!-- P2: JIRA ticket data -->
  <domains/>              <!-- P2: identified business domains -->
  <domain_knowledge/>     <!-- P3.1: codebase patterns per domain -->
  <supporting_context/>   <!-- P3.2: linked resources -->
  <design/>               <!-- P3.2: Figma/UI specs -->
</task>
```

Each subagent also writes its full output to files in `.implement-assets/{ticket_id}/`, so the orchestrator can read from disk rather than relying on subagent return values (which may be summarized).

## Usage

```
/implement https://yourcompany.atlassian.net/browse/PROJ-123
/implement https://yourcompany.atlassian.net/browse/PROJ-123 "focus on the payment module in ~/code/payments"
```

## Phase overview

| Phase | What | Subagent | Output |
|-------|------|----------|--------|
| 1 | Initialization | No (orchestrator) | `<task><model_id>`, `TICKET_ASSETS_DIR` |
| 2 | JIRA Analysis | `Skill("jira-ticket-viewer")` | `jira/output.json` |
| 2.5 | Create Git Branch | Script | Git worktree |
| 3.1 | Domain Discovery | `Skill("domain-discover")` | `domains/{domain}.md` |
| 3.2 | Resource Scanning | Multiple skills | `confluence/`, `figma/`, etc. |
| 4 | Prompt Optimization | `Skill("meta-prompter")` | `meta-prompter/output.md` |
| 5 | Implementation Planning | `Task` | `implementation-plan.md` |
| 6 | Execute | `Task` | Code changes |
| 7 | Verification | `Task` | JSON summary |

Phases 3.x run concurrently. All other phases are sequential.

## File structure

```
implement/
├── SKILL.md                          # Orchestrator entry point
├── README.md                         # This file
├── references/
│   ├── phases.md                     # Phase index (loaded first)
│   ├── phase1-initialization.md      # Loaded when Phase 1 starts
│   ├── phase2-jira-analyzer.md       # Loaded when Phase 2 starts
│   ├── phase2.5-create-branch.md     # Loaded when Phase 2.5 starts
│   ├── phase3.1-domain-discovery.md  # Loaded when Phase 3.1 starts
│   ├── phase3.2-resource-scanning.md # Loaded when Phase 3.2 starts
│   ├── phase4-prompt-optimization.md # Loaded when Phase 4 starts
│   ├── phase5-implementation-planning.md
│   ├── phase6-execution.md
│   └── verification.md
└── scripts/
    ├── create-branch.sh              # Git worktree creation
    ├── log-skill-execution.js        # Hook: log skill invocations
    └── generate-execution-flow.js    # Hook: generate flow diagram on stop
```

## See also

- **`forge`** — Next-gen variant that writes context into a dynamically created skill with lazy-loaded reference files instead of `<task>` XML accumulation
