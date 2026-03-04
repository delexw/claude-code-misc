# Phase 3.2: Resource Scanning

> **Worktree reminder:** If Phase 2.5 created a worktree, ensure you are in the worktree directory before proceeding (`cd "$WORKTREE_PATH"`).

## Link Scanning
- Read `SKILL_DIR/jira/output.json` to get the `links` object and identify categorized URLs
- Additionally scan the description text for any URLs not captured in `links`
- Visit each link — **invoke all link visits in a single message** for parallelism:
   - Confluence pages (`links.confluence`): invoke `Skill("confluence-page-viewer")` with `{url} {SKILL_DIR}/supporting-context/confluence/{index}`, then **read `SKILL_DIR/supporting-context/confluence/{index}/output.md`**
   - Jira tickets: invoke `Skill("jira-ticket-viewer")` with `{linked_key} {SKILL_DIR}/supporting-context/linked-jira/{linked_key}`, then **read `SKILL_DIR/supporting-context/linked-jira/{linked_key}/output.json`**
   - GitHub links (`links.github`): use `gh pr view` for PRs, `gh api` for files — write output to `SKILL_DIR/supporting-context/other/github-{index}.md`
   - Other links (`links.other`): use `WebFetch` — write output to `SKILL_DIR/supporting-context/other/{index}.md`
- MUST read the content from the link to understand what is required to do

## Design Scanning
- Collect all Figma links from **`links.figma`** in the JIRA output
- **If Figma links found:** For each link, invoke `Skill("figma-reader")` with `{figma_link} {SKILL_DIR}/design/{index}` (use a numeric index starting at 0 for each Figma link). After each completes, **read `SKILL_DIR/design/{index}/output.md`**.
- **Only if NO Figma links found:** Check downloaded attachments from Phase 2 (`SKILL_DIR/jira/`) for images that appear to be UI designs. Invoke `Skill("figma-reader")` with `{image_path} {SKILL_DIR}/design/0`. Read `SKILL_DIR/design/0/output.md` after completion.
