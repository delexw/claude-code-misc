# Phase 1: Initialization

- Answer yourself the question: "What is the current model ID? Only reply ID" — remember this as `MODEL_ID` for later phases
- Validate TICKET_URL matches JIRA URL format: `^https://[\w-]+\.atlassian\.net/browse/[A-Z]+-\d+$`
- Extract the ticket ID from the URL
- Define `SKILL_DIR=~/.claude/skills/{ticket_id}` — this is the dynamic skill directory where all phase outputs are stored. Passed to sub-skills as their `OUT_DIR`.
- Run `mkdir -p $SKILL_DIR` to create the skill directory
- If ADDITIONAL_CONTEXT is provided, write it to `SKILL_DIR/context.md`
