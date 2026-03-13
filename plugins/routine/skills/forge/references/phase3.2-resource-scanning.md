# Phase 3.2: Resource Scanning

> **Worktree reminder:** If Phase 2.5 created a worktree, ensure you are in the worktree directory before proceeding (`cd "$WORKTREE_PATH"`).

## Link Scanning
- Read `SKILL_DIR/jira/output.json` to get the `links` object and identify categorized URLs
- Additionally scan the description text for any URLs not captured in `links`
- Visit each link — **invoke all link visits in a single message** for parallelism:
   - Confluence pages (`links.confluence`): invoke `Skill("confluence-page-viewer")` with `{url} {SKILL_DIR}/supporting-context/confluence/{index}`
   - Jira tickets: invoke `Skill("jira-ticket-viewer")` with `{linked_key} {SKILL_DIR}/supporting-context/linked-jira/{linked_key}`
   - GitHub links (`links.github`): use `gh pr view` for PRs, `gh api` for files — write output to `SKILL_DIR/supporting-context/other/github-{index}.md`
   - Other links (`links.other`): use `WebFetch` — write output to `SKILL_DIR/supporting-context/other/{index}.md`
- **Wait for all skill invocations to complete**, then read each output file:
   - Confluence: `SKILL_DIR/supporting-context/confluence/{index}/output.md`
   - Jira: `SKILL_DIR/supporting-context/linked-jira/{linked_key}/output.json`
- MUST read the content from the link to understand what is required to do

## Design Scanning
- **Codebase check first:** Determine if the ticket involves frontend work. For existing codebases, look for `package.json` with frontend dependencies (React, Vue, Angular, Svelte, etc.), frontend config files (`next.config.*`, `vite.config.*`, `tailwind.config.*`, `tsconfig.json` with JSX), or `src/` directories with `.tsx`/`.jsx`/`.vue`/`.svelte` files. For greenfield projects, infer from JIRA ticket context (e.g., mentions of UI, React, frontend framework, components). If not frontend-related, skip Design Scanning entirely.
- Collect all Figma links from **`links.figma`** in the JIRA output
- **If Figma links found:** For each link, invoke `Skill("figma-reader")` with `{figma_link} {SKILL_DIR}/design/{index}` (use a numeric index starting at 0 for each Figma link). **Wait for all to complete**, then read each `SKILL_DIR/design/{index}/output.md`.
- **Only if NO Figma links found:** Check downloaded attachments from Phase 2 (`SKILL_DIR/jira/`) for images that appear to be UI designs. Invoke `Skill("figma-reader")` with `{image_path} {SKILL_DIR}/design/0`. **Wait for it to complete**, then read `SKILL_DIR/design/0/output.md`.
