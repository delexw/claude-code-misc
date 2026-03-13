---
name: forge
description: "Forge implementation from JIRA tickets using dynamic skill generation. Gathers context into a lazy-loaded skill, then invokes it for execution. Use when given a JIRA ticket URL to process end-to-end."
argument-hint: JIRA ticket URL and optional context
allowed-tools: Read, Bash, ExitPlanMode, Write, Edit
hooks:
  PreToolUse:
    - matcher: "Skill"
      hooks:
        - type: command
          command: "s=\"$CLAUDE_SKILL_DIR/.claude/skills/forge/scripts/log-skill-execution.js\"; [ ! -f \"$s\" ] && s=\"$HOME/.claude/skills/forge/scripts/log-skill-execution.js\"; [ -f \"$s\" ] && node \"$s\""
  PostToolUse:
    - matcher: "Skill"
      hooks:
        - type: command
          command: "s=\"$CLAUDE_SKILL_DIR/.claude/skills/forge/scripts/log-skill-execution.js\"; [ ! -f \"$s\" ] && s=\"$HOME/.claude/skills/forge/scripts/log-skill-execution.js\"; [ -f \"$s\" ] && node \"$s\""
  Stop:
    - hooks:
        - type: command
          command: "s=\"$CLAUDE_SKILL_DIR/.claude/skills/forge/scripts/generate-execution-flow.js\"; [ ! -f \"$s\" ] && s=\"$HOME/.claude/skills/forge/scripts/generate-execution-flow.js\"; [ -f \"$s\" ] && node \"$s\""
          once: true
---

# Forge: JIRA Ticket → Dynamic Skill → Implementation

## Inputs

Raw arguments: $ARGUMENTS

Infer from the arguments:
- TICKET_URL: the JIRA ticket URL
- ADDITIONAL_CONTEXT: any extra context provided beyond the URL (optional)

Orchestrates end-to-end JIRA ticket processing. Phases 1–5 gather context and write output files into a **dynamically created skill** at `~/.claude/skills/{ticket_id}/`. Phase 6 invokes that skill — context files are lazy-loaded on demand.

1. Initialization — create skill directory at `~/.claude/skills/{ticket_id}/`
2. JIRA Analysis (via `Skill("jira-ticket-viewer")`)
2.5. Create Git Branch (named `{TICKET-ID}-{slugified-title}`)
3. Discovery & Scanning (all 3.x run concurrently):
   - 3.1 Domain Discovery (via `Skill("domain-discover")`)
   - 3.2 Resource Scanning (links, Figma designs)
   - 3.3 Page Inspection (conditional, via `Skill("page-inspector")`)
4. Prompt Optimization (via `Skill("meta-prompter")`)
5. Implementation Planning + generate `SKILL.md` for the dynamic skill
6. Execute — invoke `Skill("{ticket_id}-impl")`

## Skill Dependencies

The following skills are invoked during orchestration:
- `Skill("jira-ticket-viewer")` — Fetch JIRA ticket details via jira CLI
- `Skill("confluence-page-viewer")` — Read Confluence pages via confluence CLI
- `Skill("figma-reader")` — Read Figma designs (when Figma links present in ticket)
- `Skill("domain-discover")` — Domain knowledge discovery
- `Skill("page-inspector")` — Capture current page layout/styles as baseline (conditional: frontend/UI-affecting changes)
- `Skill("meta-prompter")` — Prompt evaluation and optimization
- `Skill("{ticket_id}-impl")` — Dynamically generated skill for execution (created in Phase 5)

## Execution

Follow [references/phases.md](references/phases.md) for step-by-step phase instructions.