# Phase 5: Implementation Planning + Skill Generation

> **Worktree reminder:** If Phase 2.5 created a worktree, ensure you are in the worktree directory before proceeding (`cd "$WORKTREE_PATH"`).

## 5a: Generate Implementation Plan

- Read `SKILL_DIR/meta-prompter/output.md` for the optimized prompt
- Launch a `Task` call with the optimized prompt and context from key output files, instructing it to generate a structured implementation plan:
  - **Identify task type:** code, debug, content/docs, or safety
  - **Detect required phases:** look for sequencing constraints in the ticket (e.g., DB migrations → application changes → backfill, feature flags → rollout → cleanup). Each constraint must be its own numbered phase in the plan.
  - **For each phase, document:**
    - What will be done (files to change, commands to run)
    - Why it must happen in this order (dependency / safety reasoning)
    - Rollback or recovery steps for risky operations (migrations, data changes, deploys)
  - **List critical files** that will be touched
  - **Identify risks** and how they will be mitigated
  - Write the plan to `SKILL_DIR/implementation-plan.md`
- After the task completes, **read `SKILL_DIR/implementation-plan.md`**

## 5b: Generate Dynamic Skill

Create `SKILL_DIR/SKILL.md` using the **Write** tool with the following template:

```markdown
---
name: {ticket_id}-impl
description: "Implementation context for {ticket_id}: {summary}"
allowed-tools: Read, Bash, Write
context: fork
model: opus
---

# {ticket_id} Implementation

## Context Files

All context files are under `SKILL_DIR/`. Read these files as needed during implementation:

- **Requirements**: `SKILL_DIR/jira/output.json` — JIRA ticket details, acceptance criteria, links
- **Domain Analysis**: `SKILL_DIR/domains.json` — identified business domains and summary
- **Domain Knowledge**: files in `SKILL_DIR/domains/` — codebase patterns and conventions per domain
- **Supporting Context**: files in `SKILL_DIR/supporting-context/` — linked Confluence pages, related JIRA tickets, GitHub PRs
- **Design Specs**: files in `SKILL_DIR/design/` — Figma designs and UI specifications
- **Additional Context**: `SKILL_DIR/context.md` — user-provided context (if exists)
- **Optimized Prompt**: `SKILL_DIR/meta-prompter/output.md` — refined task description with clarifications

## Execution

Follow `SKILL_DIR/implementation-plan.md` step by step. Complete each phase fully before starting the next.

Ensure UI changes comply with design specs. Ensure code follows project conventions.
```

## 5c: Present Plan

- Call the `ExitPlanMode` tool to present the implementation plan to the user, then proceed to Phase 6
