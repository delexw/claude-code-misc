---
name: implement
description: "Automate JIRA ticket processing through domain analysis, initialization, prompt evaluation-optimization and final task execution with comprehensive error handling in thinking model. Use when given a JIRA ticket URL (format: https://[domain].atlassian.net/browse/[TICKET-ID]) to process end-to-end."
argument-hint: 'JIRA ticket URL (format: https://[domain].atlassian.net/browse/[TICKET-ID]) "(Optional) Additional Context"'
allowed-tools: Read, Bash
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

Orchestrates end-to-end JIRA ticket processing through 7 phases:
1. Pre-flight Validation
2. JIRA Analysis (via `Skill("jira-ticket-viewer")`)
3. Domain Discovery (via `Skill("domain-discover")`)
4. Resource Scanning (links, Figma designs)
5. Prompt Optimization (via `Skill("meta-prompter")`)
6. Execute <FINAL_PROMPT>
7. Change Verification

## Phase Dependencies

The following skills are invoked during execution using the `Skill()` tool:
- `Skill("jira-ticket-viewer")` — Fetch JIRA ticket details via jira CLI
- `Skill("confluence-page-viewer")` — Read Confluence pages via confluence CLI
- `Skill("figma-reader")` — Read Figma designs (when Figma links present in ticket)
- `Skill("domain-discover")` — Domain knowledge discovery
- `Skill("meta-prompter")` — Prompt evaluation and optimization (returns <FINAL_PROMPT>)

## Execution

Follow [references/phases.md](references/phases.md) for step-by-step phase instructions.
After execution, run [references/verification.md](references/verification.md) checklist.

<tags>
   <mode>think</mode>
   <custom>yes</custom>
</tags>
