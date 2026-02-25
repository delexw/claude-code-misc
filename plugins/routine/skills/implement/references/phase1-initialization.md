# Phase 1: Initialization

- Answer yourself the question: "What is the current model ID? Only reply ID" (e.g. `claude-opus-4-6`, `claude-sonnet-4-6`) and save it to `<task><model_id>`
- Validate `$ARGUMENTS[0]` matches JIRA URL format: `^https://[\w-]+\.atlassian\.net/browse/[A-Z]+-\d+$`
- Extract the ticket ID (e.g. `PROJ-123`) from the URL for use with `Skill("jira-ticket-viewer")`
- Define `TICKET_ASSETS_DIR=.implement-assets/{ticket_id}` — this is the base directory for all ticket assets (raw JSON, attachments, skill outputs). Passed to sub-skills as their `OUT_DIR`.
- If `$ARGUMENTS[1]` is provided, save it to `<task><context>`
