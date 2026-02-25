# Phase 3 + 4: Domain Discovery & Resource Scanning (parallel)

> **Worktree reminder:** If Phase 2.5 created a worktree, ensure you are in the worktree directory before proceeding (`cd "$WORKTREE_PATH"`).

> **Parallelism:** Phase 3 and Phase 4 both depend only on Phase 2 output — they do NOT depend on each other. **You MUST issue all Phase 3 and Phase 4 skill calls as multiple `Task` tool calls in a single message** to ensure they run concurrently. Do NOT call them sequentially with `Skill()`. Each `Task` call should include the `Skill("skill-name")` invocation in its prompt — the skill's own frontmatter defines the subagent type. Wait for all to complete before proceeding to Phase 5.

## Phase 3: domain_discover (via `Skill("domain-discover")`)

- For each domain listed in `<task><domains>`, launch a `Task` call with prompt: `Invoke Skill("domain-discover") with "{domain_name} {TICKET_ASSETS_DIR}/domains"` (e.g. `payments .implement-assets/EC-10420/domains`)
- Each invocation creates a `{domain}.md` file in `TICKET_ASSETS_DIR/domains/`.
- After all invocations complete, read each generated `TICKET_ASSETS_DIR/domains/{domain}.md` file and append its content to `<task><domain_knowledge>`.

## Phase 4: Resource Scanning

### Link Scanning
- Use the `links` object from the Phase 2 parsed JSON to identify categorized URLs
- Additionally scan the description text for any URLs not captured in `links`
- Visit each link — **launch all link visits as separate `Task` calls in a single message**:
   - Confluence pages (`links.confluence`): `Task` with prompt to invoke `Skill("confluence-page-viewer")` with `{url} {TICKET_ASSETS_DIR}/confluence/{index}`, then **read `TICKET_ASSETS_DIR/confluence/{index}/output.md`**
   - Jira tickets: `Task` with prompt to invoke `Skill("jira-ticket-viewer")` with `{linked_key} {TICKET_ASSETS_DIR}/linked-jira/{linked_key}`, then **read `TICKET_ASSETS_DIR/linked-jira/{linked_key}/output.json`**
   - GitHub links (`links.github`): `Task` with prompt to use `gh pr view` for PRs, `gh api` for files
   - Other links (`links.other`): `Task` with prompt to use `WebFetch` (changelogs, documentation, etc.)
- MUST read the content from the link to understand what is required to do
- Compile the retrieved information into `<task><supporting_context>`

### Design Scanning
- Collect all Figma links from **`links.figma`** in the Phase 2 parsed JSON output
- **If Figma links found:** Launch a `Task` call for each link with prompt to invoke `Skill("figma-reader")` with `{figma_link} {TICKET_ASSETS_DIR}/figma/{index}` (use a numeric index starting at 0 for each Figma link). After each completes, **read `TICKET_ASSETS_DIR/figma/{index}/output.md`**.
- **Only if NO Figma links found:** Check downloaded attachments from Phase 2 (`TICKET_ASSETS_DIR/jira/`) for images that appear to be UI designs. Launch a `Task` call with prompt to invoke `Skill("figma-reader")` with `{image_path} {TICKET_ASSETS_DIR}/figma/0`. Read `TICKET_ASSETS_DIR/figma/0/output.md` after completion.
- Save all design context to `<task><design>`
- Use `<task><design>` during implementation to ensure UI changes comply with the design
