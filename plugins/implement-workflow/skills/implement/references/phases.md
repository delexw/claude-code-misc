# Implement Phases — Detailed Instructions

All phases accumulate data into a single `<task>` tag with structured sub-tags:

```xml
<task>
  <context/>              <!-- P1: additional user-provided context -->
  <requirements/>         <!-- P2: raw jira ticket output -->
  <domains/>              <!-- P2: identified business domains + summary -->
  <domain_knowledge/>     <!-- P3: codebase knowledge per domain -->
  <supporting_context/>   <!-- P4: content from scanned links -->
  <design/>               <!-- P4: Figma/UI design context -->
</task>
```

## Phase 1: Pre-flight Validation

- Validate `$ARGUMENTS[0]` matches JIRA URL format: `^https://[\w-]+\.atlassian\.net/browse/[A-Z]+-\d+$`
- Extract the ticket ID (e.g. `PROJ-123`) from the URL for use with `Skill("jira-ticket-viewer")`
- Define `TICKET_ASSETS_DIR=/tmp/jira-assets/{ticket_id}` — this is the base directory for all ticket temp assets (raw JSON, attachments). Passed to sub-skills so they don't hardcode paths.
- If `$ARGUMENTS[1]` is provided, save it to `<task><context>`

## Phase 2: jira_analyzer (via `Skill("jira-ticket-viewer")`)

- Invoke `Skill("jira-ticket-viewer")` with `{ticket_id} {TICKET_ASSETS_DIR}` (e.g. `EC-10420 /tmp/jira-assets/EC-10420`)
- Use the raw output directly — do NOT reformat or restructure it
- Save the raw ticket output to `<task><requirements>`
- If attachments were downloaded (paths included in the skill output), note the file paths for use in Phase 4. Do NOT Read or view image attachments here — design images are handled in Phase 4 Design Scanning via `Skill("figma-reader")`.
- From the ticket output, identify:
   - **Domains:** 1-3 business domains using stakeholder terminology (business-first, ordered by impact, max 3 with justifications)
   - **Ticket summary:** 20-word objective summary
- Save domain analysis and summary to `<task><domains>`

## Phase 3: domain_discover (via `Skill("domain-discover")`)

- Invoke `Skill("domain-discover")` for each domain listed in `<task><domains>` concurrently.
- Each invocation creates/updates a `{domain}.md` file in the project root.
- After all invocations complete, read each generated `{domain}.md` file and append its content to `<task><domain_knowledge>`.

## Phase 4: Resource Scanning

### Link Scanning
- Scan the task description for any web links (URLs)
- If links are present, visit each link:
   - Changelogs (use `WebFetch`)
   - Jira tickets (use `Skill("jira-ticket-viewer")`)
   - Confluence pages (use `Skill("confluence-page-viewer")`)
   - GitHub PRs (use `gh pr view <URL>`)
   - GitHub files (use `gh api` or clone/read via `gh`)
   - Other documentation (use `WebFetch`)
- MUST read the content from the link to understand what is required to do
- Compile the retrieved information into `<task><supporting_context>`

### Design Scanning
- Collect all Figma links from:
  - **Design Links** from Phase 2 output (`customfield_10031`) — structured Figma URLs from the ticket
  - Description text — scan for additional Figma links (e.g. `https://www.figma.com/design/...`)
- **If Figma links found:** Invoke `Skill("figma-reader")` with each link. This gives accurate design data (components, styles, tokens) directly from Figma — prefer this over image attachments.
- **Only if NO Figma links found:** Check downloaded attachments from Phase 2 (`TICKET_ASSETS_DIR/`) for images that appear to be UI designs. Invoke `Skill("figma-reader")` with the image, which will show it for context and ask the user to select the relevant component in Figma for accurate design data.
- Save all design context to `<task><design>`
- Use `<task><design>` during implementation to ensure UI changes comply with the design

## Phase 5: Prompt Optimization (via `Skill("meta-prompter")`)

- Invoke `Skill("meta-prompter")` with all accumulated `<task>` context
- `meta-prompter` returns <FINAL_PROMPT> after evaluation and optimization

## Phase 6: Execute <FINAL_PROMPT>

- **Execute <FINAL_PROMPT>** using all knowledge from `<task>`
- Identify the task type: code, debug, content/docs or safety
  - **Code:** outline a minimal plan; edit only necessary files; run the project's own checks (e.g., `npm test`, `make test`, linters, type checks) **if available**. If unknown, add TODOs instead of guessing.
  - **Debug:** use systematic debugging approach with <FINAL_PROMPT>
  - **Content/Docs:** save outputs to the project's standard location (**prefer repo conventions**; if unclear, use `./docs/` as a fallback and note it).
  - **Safety:** avoid destructive actions; require explicit confirmation for risky steps (migrations, data changes); include a brief rollback note.
- **MUST** execute the task rather than creating a plan only
