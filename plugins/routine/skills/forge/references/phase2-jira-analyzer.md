# Phase 2: JIRA Analysis (via `Skill("jira-ticket-viewer")`)

- Invoke `Skill("jira-ticket-viewer")` with the JIRA ticket key and `SKILL_DIR/references` as the output directory
- After completion, **read `SKILL_DIR/references/dossier.json`** to get the full parsed ticket JSON
- If attachments were downloaded (check `SKILL_DIR/references/` for attachment files), note the file paths for use in Phase 3.2. Do NOT Read or view image attachments here — design images are handled in Phase 3.2 Design Scanning via `Skill("figma-reader")`.
- From the ticket output, identify:
   - **Domains:** 1-3 business domains using stakeholder terminology (business-first, ordered by impact, max 3 with justifications)
   - **Ticket summary:** 20-word objective summary
- Write domain analysis and summary as JSON to `SKILL_DIR/references/domains.json`:
  ```json
  {
    "domains": ["domain1", "domain2"],
    "summary": "20-word objective summary"
  }
  ```
