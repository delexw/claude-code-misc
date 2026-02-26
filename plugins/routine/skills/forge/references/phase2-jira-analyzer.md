# Phase 2: JIRA Analysis (via `Skill("jira-ticket-viewer")`)

- Launch a `Task` call with prompt: `Invoke Skill("jira-ticket-viewer") with "{ticket_id} {SKILL_DIR}/jira"` (e.g. `EC-10420 .claude/skills/EC-10420/jira`)
- After the task completes, **read `SKILL_DIR/jira/output.json`** to get the full parsed ticket JSON
- If attachments were downloaded (check `SKILL_DIR/jira/` for attachment files), note the file paths for use in Phase 3.2. Do NOT Read or view image attachments here — design images are handled in Phase 3.2 Design Scanning via `Skill("figma-reader")`.
- From the ticket output, identify:
   - **Domains:** 1-3 business domains using stakeholder terminology (business-first, ordered by impact, max 3 with justifications)
   - **Ticket summary:** 20-word objective summary
- Write domain analysis and summary as JSON to `SKILL_DIR/domains.json`:
  ```json
  {
    "domains": ["domain1", "domain2"],
    "summary": "20-word objective summary"
  }
  ```
