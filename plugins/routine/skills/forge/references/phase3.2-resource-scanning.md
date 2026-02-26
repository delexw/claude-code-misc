# Phase 3.2: Resource Scanning

> **Worktree reminder:** If Phase 2.5 created a worktree, ensure you are in the worktree directory before proceeding (`cd "$WORKTREE_PATH"`).

## Link Scanning
- Read `SKILL_DIR/jira/output.json` to get the `links` object and identify categorized URLs
- Additionally scan the description text for any URLs not captured in `links`
- Visit each link — **launch all link visits as separate `Task` calls in a single message**:
   - Confluence pages (`links.confluence`): `Task` with prompt to invoke `Skill("confluence-page-viewer")` with `{url} {SKILL_DIR}/supporting-context/confluence/{index}`, then **read `SKILL_DIR/supporting-context/confluence/{index}/output.md`**
   - Jira tickets: `Task` with prompt to invoke `Skill("jira-ticket-viewer")` with `{linked_key} {SKILL_DIR}/supporting-context/linked-jira/{linked_key}`, then **read `SKILL_DIR/supporting-context/linked-jira/{linked_key}/output.json`**
   - GitHub links (`links.github`): `Task` with prompt to use `gh pr view` for PRs, `gh api` for files — write output to `SKILL_DIR/supporting-context/other/github-{index}.md`
   - Other links (`links.other`): `Task` with prompt to use `WebFetch` — write output to `SKILL_DIR/supporting-context/other/{index}.md`
- MUST read the content from the link to understand what is required to do

## Design Scanning
- Collect all Figma links from **`links.figma`** in the JIRA output
- **If Figma links found:** Launch a `Task` call for each link with prompt to invoke `Skill("figma-reader")` with `{figma_link} {SKILL_DIR}/design/{index}` (use a numeric index starting at 0 for each Figma link). After each completes, **read `SKILL_DIR/design/{index}/output.md`**.
- **Only if NO Figma links found:** Check downloaded attachments from Phase 2 (`SKILL_DIR/jira/`) for images that appear to be UI designs. Launch a `Task` call with prompt to invoke `Skill("figma-reader")` with `{image_path} {SKILL_DIR}/design/0`. Read `SKILL_DIR/design/0/output.md` after completion.
