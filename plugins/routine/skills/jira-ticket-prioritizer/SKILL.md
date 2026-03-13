---
name: jira-ticket-prioritizer
description: Analyze JIRA tickets to determine priority and dependency order. Outputs an ordered JIRA ID list. Use before implement/forge, or when asked to "prioritize tickets", "order these JIRAs", "what should I work on first".
argument-hint: <TICKET-KEY1,TICKET-KEY2,...> <additional-context>
allowed-tools: Read, Bash, Write
---

# JIRA Ticket Prioritizer

Analyze a set of JIRA tickets to determine optimal execution order based on dependencies, priority, and grouping. Produces grouped layers usable standalone or as a pre-step before `implement`/`forge`.

## Arguments
- `$ARGUMENTS[0]` — Comma-separated ticket keys (e.g. `EC-100,EC-101,EC-102`) OR a JQL query (detected by presence of `=`, `AND`, `OR`)
- `$ARGUMENTS[1]` — (optional) Additional context for prioritization (e.g. "focus on backend", "frontend first")

## System Requirements
- `jira` CLI installed and configured (https://github.com/ankitpokhrel/jira-cli)
- Environment variable `JIRA_API_TOKEN` set with a valid Jira API token. **Important:** When checking this variable, verify at least 2 times before concluding it is not set. **Never expose the value** — use existence checks only.

## Execution

### Step 1 — Parse Input
- Check if `$ARGUMENTS[0]` contains `=`, `AND`, or `OR` (case-insensitive) to detect JQL
- **If JQL detected**: run `jira issue list --jql "$ARGUMENTS[0]" --plain --columns key,status --no-headers` to resolve to ticket keys with statuses
- **If comma-separated**: split on `,` and trim whitespace
- Validate each key matches `[A-Z]+-\d+`
- If fewer than 2 valid tickets, report the single ticket and exit

### Step 2 — Classify and Fetch All Tickets
- Create temp directory: `mkdir -p .jira-ticket-prioritizer-tmp/tickets`
- For each ticket key, fetch via jira CLI:
  ```
  jira issue view {KEY} --raw > .jira-ticket-prioritizer-tmp/tickets/{KEY}.json
  ```
- Parse each ticket using the jira-ticket-viewer parse script:
  ```
  node ${CLAUDE_SKILL_DIR}/../jira-ticket-viewer/scripts/parse-ticket.js < .jira-ticket-prioritizer-tmp/tickets/{KEY}.json > .jira-ticket-prioritizer-tmp/tickets/{KEY}-parsed.json
  ```
- Collect all parsed outputs into a single JSON array and write to `.jira-ticket-prioritizer-tmp/all-tickets.json`
- **Classify tickets** by status — fetch and parse ALL tickets, then split into two groups:
  - `pending` = tickets with status "To Do" or "Backlog" — these will be scored, grouped, and placed in output layers
  - `context` = tickets with any other status ("In Progress", "In Review", "Done", "Closed", "Resolved") — these are NOT placed in layers but are used for dependency resolution in Steps 3-5

### Step 3 — Build Dependency Graph
- Run: `node ${CLAUDE_SKILL_DIR}/scripts/build-dependency-graph.js < .jira-ticket-prioritizer-tmp/all-tickets.json > .jira-ticket-prioritizer-tmp/graph.json`
- Review graph output for cycles or warnings
- See [references/dependency-analysis.md](references/dependency-analysis.md) for relationship mapping rules
- The graph includes ALL tickets (pending + context) so dependencies on in-progress/done tickets are visible

### Step 4 — Semantic Dependency Analysis & Parent Ticket Evaluation
- Evaluate parent/container tickets and semantic dependencies per [references/dependency-analysis.md](references/dependency-analysis.md)
- Add soft edges with confidence levels (high/medium/low) to the graph
- Re-run topological sort if new edges were added:
  - Update `all-tickets.json` with additional `softEdges` and re-run `build-dependency-graph.js`

### Step 5 — Priority Scoring & Grouping
- Only score `pending` tickets — `context` tickets are not scored or placed in layers
- For tickets at the same dependency layer, score using weights from [references/priority-weights.md](references/priority-weights.md)
- Sort within each layer by descending score
- Apply `$ARGUMENTS[1]` context as a tiebreaker or boost (e.g. "focus on backend" boosts tickets with backend labels/components)
- **Group related tickets** within the same layer — see [references/dependency-analysis.md](references/dependency-analysis.md) Grouping Rules. First ticket in each group (highest score) is the primary ticket.
- **Determine `hasFrontend`** for each group: set to `true` if **any** ticket in the group involves frontend/UI work. Infer from ticket summary, description, components, and labels — look for signals like UI, frontend, React, CSS, component, page, layout, design, Figma links, `.tsx`/`.jsx` file mentions, or visual/browser-related keywords. Set to `false` only when all tickets in the group are clearly backend-only.
- **Resolve cross-layer dependencies:**
  - If a pending ticket depends on a `context` ticket with status "Done"/"Closed"/"Resolved" → dependency is resolved, ticket proceeds normally
  - If a pending ticket depends on a `context` ticket with any other status (e.g. "In Progress") → mark as `skipped` with reason including the dependency key and its status
  - If a pending ticket depends on another `pending` ticket in a different layer → normal layering (layer N+1 depends on layer N)
- Tickets with status "Done"/"Closed"/"Resolved" → `excluded`
- Container/parent stories with no implementable work → `excluded`

### Step 6 — Generate Output
- See [references/output-format.md](references/output-format.md) for report schema and JSON structure
- Write `.jira-ticket-prioritizer-tmp/detailed-report.json` — full details including scores, justifications, dependency graph, skipped tickets, excluded tickets, and warnings
- Write `.jira-ticket-prioritizer-tmp/output.json` — the grouped layers object with `layers`, `skipped`, and `excluded` arrays
- **Present only `output.json`** to the user. The detailed report is saved for reference but not displayed.

## Reference Files

| Name | When to Read |
|------|-------------|
| [references/priority-weights.md](references/priority-weights.md) | Step 5 — scoring rules and factor weights |
| [references/output-format.md](references/output-format.md) | Step 6 — report template and JSON schema |
| [references/dependency-analysis.md](references/dependency-analysis.md) | Steps 3-5 — dependency detection and grouping rules |
