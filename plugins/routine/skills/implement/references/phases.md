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

> **Output file convention:** Sub-skills with `context: fork` run as subagents whose return values may be summarized. To get the **complete** output, each sub-skill persists its full response to a file on disk. After a forked skill completes, **always read the output file** (e.g. `OUT_DIR/output.md`) rather than relying on the subagent's return value.

## Phase 1: Pre-flight Validation

- Validate `$ARGUMENTS[0]` matches JIRA URL format: `^https://[\w-]+\.atlassian\.net/browse/[A-Z]+-\d+$`
- Extract the ticket ID (e.g. `PROJ-123`) from the URL for use with `Skill("jira-ticket-viewer")`
- Define `TICKET_ASSETS_DIR=.implement-assets/{ticket_id}` — this is the base directory for all ticket assets (raw JSON, attachments, skill outputs). Passed to sub-skills as their `OUT_DIR`.
- If `$ARGUMENTS[1]` is provided, save it to `<task><context>`

## Phase 2: jira_analyzer (via `Skill("jira-ticket-viewer")`)

- Invoke `Skill("jira-ticket-viewer")` with `{ticket_id} {TICKET_ASSETS_DIR}/jira` (e.g. `EC-10420 .implement-assets/EC-10420/jira`)
- After the skill completes, **read `TICKET_ASSETS_DIR/jira/output.json`** to get the full parsed ticket JSON
- Save the content of `output.json` to `<task><requirements>`
- If attachments were downloaded (check `TICKET_ASSETS_DIR/jira/` for attachment files), note the file paths for use in Phase 4. Do NOT Read or view image attachments here — design images are handled in Phase 4 Design Scanning via `Skill("figma-reader")`.
- From the ticket output, identify:
   - **Domains:** 1-3 business domains using stakeholder terminology (business-first, ordered by impact, max 3 with justifications)
   - **Ticket summary:** 20-word objective summary
- Save domain analysis and summary to `<task><domains>`

## Phase 2.5: Create Git Branch

- Using the ticket ID and ticket title from Phase 2:
  - Slugify the ticket title: lowercase, replace spaces and special characters with hyphens, collapse consecutive hyphens, strip leading/trailing hyphens, truncate to 50 characters
  - Compose branch name: `{ticket_id}-{slugified_title}` (e.g. `EC-1234-fix-payment-checkout-bug`)
- Run the script: `bash "$CLAUDE_PROJECT_DIR/.claude/skills/implement/scripts/create-branch.sh" {branch_name}`
- The script will: stash any uncommitted changes, pull latest `main`, create and checkout the branch, then restore the stash

## Phase 3 + 4: Domain Discovery & Resource Scanning (parallel)

> **Parallelism:** Phase 3 and Phase 4 both depend only on Phase 2 output — they do NOT depend on each other. **You MUST issue all Phase 3 and Phase 4 skill calls as multiple `Task` tool calls in a single message** to ensure they run concurrently. Do NOT call them sequentially with `Skill()`. Each `Task` call should include the `Skill("skill-name")` invocation in its prompt — the skill's own frontmatter defines the subagent type. Wait for all to complete before proceeding to Phase 5.

### Phase 3: domain_discover (via `Skill("domain-discover")`)

- For each domain listed in `<task><domains>`, launch a `Task` call with prompt: `Invoke Skill("domain-discover") with "{domain_name} {TICKET_ASSETS_DIR}/domains"` (e.g. `payments .implement-assets/EC-10420/domains`)
- Each invocation creates a `{domain}.md` file in `TICKET_ASSETS_DIR/domains/`.
- After all invocations complete, read each generated `TICKET_ASSETS_DIR/domains/{domain}.md` file and append its content to `<task><domain_knowledge>`.

### Phase 4: Resource Scanning

#### Link Scanning
- Use the `links` object from the Phase 2 parsed JSON to identify categorized URLs
- Additionally scan the description text for any URLs not captured in `links`
- Visit each link — **launch all link visits as separate `Task` calls in a single message**:
   - Confluence pages (`links.confluence`): `Task` with prompt to invoke `Skill("confluence-page-viewer")` with `{url} {TICKET_ASSETS_DIR}/confluence/{index}`, then **read `TICKET_ASSETS_DIR/confluence/{index}/output.md`**
   - Jira tickets: `Task` with prompt to invoke `Skill("jira-ticket-viewer")` with `{linked_key} {TICKET_ASSETS_DIR}/linked-jira/{linked_key}`, then **read `TICKET_ASSETS_DIR/linked-jira/{linked_key}/output.json`**
   - GitHub links (`links.github`): `Task` with prompt to use `gh pr view` for PRs, `gh api` for files
   - Other links (`links.other`): `Task` with prompt to use `WebFetch` (changelogs, documentation, etc.)
- MUST read the content from the link to understand what is required to do
- Compile the retrieved information into `<task><supporting_context>`

#### Design Scanning
- Collect all Figma links from **`links.figma`** in the Phase 2 parsed JSON output
- **If Figma links found:** Launch a `Task` call for each link with prompt to invoke `Skill("figma-reader")` with `{figma_link} {TICKET_ASSETS_DIR}/figma/{index}` (use a numeric index starting at 0 for each Figma link). After each completes, **read `TICKET_ASSETS_DIR/figma/{index}/output.md`**.
- **Only if NO Figma links found:** Check downloaded attachments from Phase 2 (`TICKET_ASSETS_DIR/jira/`) for images that appear to be UI designs. Launch a `Task` call with prompt to invoke `Skill("figma-reader")` with `{image_path} {TICKET_ASSETS_DIR}/figma/0`. Read `TICKET_ASSETS_DIR/figma/0/output.md` after completion.
- Save all design context to `<task><design>`
- Use `<task><design>` during implementation to ensure UI changes comply with the design

## Phase 5: Prompt Optimization (via `Skill("meta-prompter")`)

- Invoke `Skill("meta-prompter")` with all accumulated `<task>` context **and the output path**: `{task_context} {TICKET_ASSETS_DIR}/meta-prompter`
- After the skill completes, **read `TICKET_ASSETS_DIR/meta-prompter/output.md`** to get the full <FINAL_PROMPT>

## Phase 6: Implementation Planning

- Using all accumulated `<task>` context and `<FINAL_PROMPT>`, generate a structured implementation plan:
  - **Identify task type:** code, debug, content/docs, or safety
  - **Detect required phases:** look for sequencing constraints in the ticket (e.g., DB migrations → application changes → backfill, feature flags → rollout → cleanup). Each constraint must be its own numbered phase in the plan.
  - **For each phase, document:**
    - What will be done (files to change, commands to run)
    - Why it must happen in this order (dependency / safety reasoning)
    - Rollback or recovery steps for risky operations (migrations, data changes, deploys)
  - **List critical files** that will be touched
  - **Identify risks** and how they will be mitigated
- Write the plan to `TICKET_ASSETS_DIR/implementation-plan.md`
- Call the `ExitPlanMode` tool to present the plan to the user, then proceed to Phase 7

## Phase 7: Execute <FINAL_PROMPT>

- **Execute <FINAL_PROMPT>** using all knowledge from `<task>` and the implementation plan
- Follow the phased order defined in `TICKET_ASSETS_DIR/implementation-plan.md` — complete each phase fully before starting the next
- Identify the task type: code, debug, content/docs or safety
  - **Code:** edit only necessary files; run the project's own checks (e.g., `npm test`, `make test`, linters, type checks) **if available**. If unknown, add TODOs instead of guessing.
  - **Debug:** use systematic debugging approach with <FINAL_PROMPT>
  - **Content/Docs:** save outputs to the project's standard location (**prefer repo conventions**; if unclear, use `./docs/` as a fallback and note it).
  - **Safety:** avoid destructive actions; require explicit confirmation for risky steps (migrations, data changes); include a brief rollback note.
- **MUST** execute the task rather than creating a plan only
