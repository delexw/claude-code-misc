# Phase 3.2: Resource Scanning

> **Worktree reminder:** If Phase 2.5 created a worktree, ensure you are in the worktree directory before proceeding (`cd "$WORKTREE_PATH"`).

## Link Scanning
- Use the `links` object from the Phase 2 parsed JSON to identify categorized URLs
- Additionally scan the description text for any URLs not captured in `links`
- Visit each link — **launch all link visits as separate `Task` calls in a single message**:
   - Confluence pages (`links.confluence`): `Task` with prompt to invoke `Skill("confluence-page-viewer")` with `{url} {TICKET_ASSETS_DIR}/confluence/{index}`, then **read `TICKET_ASSETS_DIR/confluence/{index}/output.md`**
   - Jira tickets: `Task` with prompt to invoke `Skill("jira-ticket-viewer")` with `{linked_key} {TICKET_ASSETS_DIR}/linked-jira/{linked_key}`, then **read `TICKET_ASSETS_DIR/linked-jira/{linked_key}/output.json`**
   - GitHub links (`links.github`): `Task` with prompt to use `gh pr view` for PRs, `gh api` for files
   - Other links (`links.other`): `Task` with prompt to use `WebFetch` (changelogs, documentation, etc.)
- MUST read the content from the link to understand what is required to do
- Compile the retrieved information into `<task><supporting_context>`

## Design Scanning
- Collect all Figma links from **`links.figma`** in the Phase 2 parsed JSON output
- **If Figma links found:** Launch a `Task` call for each link with prompt to invoke `Skill("figma-reader")` with `{figma_link} {TICKET_ASSETS_DIR}/figma/{index}` (use a numeric index starting at 0 for each Figma link). After each completes, **read `TICKET_ASSETS_DIR/figma/{index}/output.md`**.
- **Only if NO Figma links found:** Check downloaded attachments from Phase 2 (`TICKET_ASSETS_DIR/jira/`) for images that appear to be UI designs. Launch a `Task` call with prompt to invoke `Skill("figma-reader")` with `{image_path} {TICKET_ASSETS_DIR}/figma/0`. Read `TICKET_ASSETS_DIR/figma/0/output.md` after completion.
- Save all design context to `<task><design>`
- Use `<task><design>` during implementation to ensure UI changes comply with the design
