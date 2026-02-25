# Phase 2: jira_analyzer (via `Skill("jira-ticket-viewer")`)

- Invoke `Skill("jira-ticket-viewer")` with `{ticket_id} {TICKET_ASSETS_DIR}/jira` (e.g. `EC-10420 .implement-assets/EC-10420/jira`)
- After the skill completes, **read `TICKET_ASSETS_DIR/jira/output.json`** to get the full parsed ticket JSON
- Save the content of `output.json` to `<task><requirements>`
- If attachments were downloaded (check `TICKET_ASSETS_DIR/jira/` for attachment files), note the file paths for use in Phase 4. Do NOT Read or view image attachments here — design images are handled in Phase 4 Design Scanning via `Skill("figma-reader")`.
- From the ticket output, identify:
   - **Domains:** 1-3 business domains using stakeholder terminology (business-first, ordered by impact, max 3 with justifications)
   - **Ticket summary:** 20-word objective summary
- Save domain analysis and summary to `<task><domains>`
