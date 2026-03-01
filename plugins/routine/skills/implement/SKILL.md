---
name: implement
description: "Automate JIRA ticket processing through domain analysis, initialization, prompt evaluation-optimization and final task execution with comprehensive error handling in thinking model. Use when given a JIRA ticket URL (format: https://[domain].atlassian.net/browse/[TICKET-ID]) to process end-to-end."
argument-hint: 'JIRA ticket URL (format: https://[domain].atlassian.net/browse/[TICKET-ID]) "(Optional) Additional Context"'
allowed-tools: Read, Bash, ExitPlanMode, Write, Edit
hooks:
  PreToolUse:
    - matcher: "Skill"
      hooks:
        - type: command
          command: "s=\"$CLAUDE_PROJECT_DIR/.claude/skills/implement/scripts/log-skill-execution.js\"; [ ! -f \"$s\" ] && s=\"$HOME/.claude/skills/implement/scripts/log-skill-execution.js\"; node \"$s\""
  PostToolUse:
    - matcher: "Skill"
      hooks:
        - type: command
          command: "s=\"$CLAUDE_PROJECT_DIR/.claude/skills/implement/scripts/log-skill-execution.js\"; [ ! -f \"$s\" ] && s=\"$HOME/.claude/skills/implement/scripts/log-skill-execution.js\"; node \"$s\""
  Stop:
    - hooks:
        - type: command
          command: "s=\"$CLAUDE_PROJECT_DIR/.claude/skills/implement/scripts/generate-execution-flow.js\"; [ ! -f \"$s\" ] && s=\"$HOME/.claude/skills/implement/scripts/generate-execution-flow.js\"; node \"$s\""
          once: true
---

# Implement: JIRA Ticket Processor

## Arguments
- `$ARGUMENTS[0]` — JIRA ticket URL (format: `https://[domain].atlassian.net/browse/[TICKET-ID]`)
- `$ARGUMENTS[1]` — Additional context (quoted string, optional)

Orchestrates end-to-end JIRA ticket processing:
1. Initialization
2. JIRA Analysis (via `Skill("jira-ticket-viewer")`)
2.5. Create Git Branch (named `{TICKET-ID}-{slugified-title}`)
3. Discovery & Scanning (parallel):
   - 3.1 Domain Discovery (via `Skill("domain-discover")`)
   - 3.2 Resource Scanning (links, Figma designs)
   - 3.3 Page Inspection (conditional, via `Skill("page-inspector")`)
4. Prompt Optimization (via `Skill("meta-prompter")`)
5. Implementation Planning (present plan, then proceed)
6. Execute per planning
6.5. QA Web Test (conditional: user-visible web changes)
7. Verification

## Phase Dependencies

The following skills are invoked during execution using the `Skill()` tool:
- `Skill("jira-ticket-viewer")` — Fetch JIRA ticket details via jira CLI
- `Skill("confluence-page-viewer")` — Read Confluence pages via confluence CLI
- `Skill("figma-reader")` — Read Figma designs (when Figma links present in ticket)
- `Skill("domain-discover")` — Domain knowledge discovery
- `Skill("page-inspector")` — Capture current page layout/styles as baseline (conditional: frontend/UI-affecting changes)
- `Skill("meta-prompter")` — Prompt evaluation and optimization
- `Skill("qa-web-test")` — Visual QA testing via Chrome DevTools MCP (conditional: user-visible web changes)

## Execution

Follow [references/phases.md](references/phases.md) for step-by-step phase instructions.

<tags>
   <mode>think</mode>
   <custom>yes</custom>
</tags>
