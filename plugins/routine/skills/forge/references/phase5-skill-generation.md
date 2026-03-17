# Phase 5: Skill Generation

## 5a: Generate Dynamic Skill

Create `SKILL_DIR/SKILL.md` using the **Write** tool with the following template:

```markdown
---
name: {ticket_id}-impl
description: "Implementation context for {ticket_id}: {summary}"
allowed-tools: Read, Bash, Write, Glob, Grep
context: fork
model: opus
---

# {ticket_id} Implementation

## Context Files

All context files are under `SKILL_DIR/references/`. Read these files as needed during implementation:

- **Requirements**: `SKILL_DIR/references/dossier.json` — JIRA ticket details, acceptance criteria, links
- **Domain Index**: `SKILL_DIR/references/domain-index.md` — domains, relevant paths, and key files; read source files in those paths directly as needed
- **Supporting Context**: files in `SKILL_DIR/references/intel/` — linked Confluence pages, related JIRA tickets, GitHub PRs
- **Design Specs**: files in `SKILL_DIR/references/blueprints/` — Figma designs and UI specifications
- **Additional Context**: `SKILL_DIR/references/briefing.md` — user-provided context (if exists)
- **Optimized Prompt**: `SKILL_DIR/references/soul.md` — refined task description with clarifications (if exists)

## Execution

### Step 1: Plan

Read `dossier.json`, `domain-index.md`, and `soul.md` (if exists). Produce a structured implementation plan:

- **Identify task type:** code, debug, content/docs, or safety
- **Detect required phases:** look for sequencing constraints (e.g., DB migrations → application changes → backfill, feature flags → rollout → cleanup). Each constraint is its own numbered phase.
- **For each phase:** what will be done, why this order, rollback steps for risky operations
- **List critical files** to touch
- **Identify risks** and mitigations
- Check `dossier.json` for `subtasks` and `parent`:
  - **Subtasks not started** (`To Do`, `Backlog`): mark as out-of-scope; do not plan or implement their work
  - **Parent is non-null** (this is a subtask): use parent summary as broader context only

### Step 2: Implement

Execute the plan phase by phase. Read source files in the domain paths from `domain-index.md` as needed. Complete each phase fully before starting the next.

Ensure UI changes comply with design specs. Ensure code follows project conventions.

## Output

After completing all implementation phases, save the affected page URLs to `SKILL_DIR/references/affected-urls.json` based on what you actually changed:

e.g.

```json
["http://domain:3000/affected/page", "http://domain:3000/other/page"]
```

If no UI-visible pages are affected, save `[]`.
```

## 5b: Present Summary and Proceed

- Read `SKILL_DIR/references/dossier.json` and `SKILL_DIR/references/domain-index.md`
- Write a brief pre-flight summary (ticket goal, affected domains, key risks) for the user
- Call the `ExitPlanMode` tool to present the summary, then proceed to Phase 6
