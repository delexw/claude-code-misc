---
name: jira-ticket-prioritizer
description: Analyze JIRA tickets to determine priority and dependency order. Outputs an ordered JIRA ID list. Use before implement/forge, or when asked to "prioritize tickets", "order these JIRAs", "what should I work on first".
argument-hint: <ticket keys or JQL query>
allowed-tools: Read, Bash, Write
---

# JIRA Ticket Prioritizer

Analyze a set of JIRA tickets to determine optimal execution order based on dependencies, priority, and grouping. Produces grouped layers usable standalone or as a pre-step before `implement`/`forge`.

## Inputs

Raw arguments: $ARGUMENTS

Infer from the arguments:
- TICKET_INPUT: comma-separated ticket keys OR a JQL query (detected by presence of `=`, `AND`, `OR`)
- EXTRA_CONTEXT: (optional) additional context for prioritization

## System Requirements
- `jira` CLI installed and configured (https://github.com/ankitpokhrel/jira-cli)
- Environment variable `JIRA_API_TOKEN` set with a valid Jira API token. **Important:** When checking this variable, verify at least 2 times before concluding it is not set. **Never expose the value** — use existence checks only.

## Execution

### Step 1 — Parse Input
- Check if `TICKET_INPUT` contains `=`, `AND`, or `OR` (case-insensitive) to detect JQL
- **If JQL detected**: run `jira issue list --jql "TICKET_INPUT" --plain --columns key,status --no-headers` to resolve to ticket keys with statuses
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

### Step 4b — Redundancy Detection
- Read [references/redundancy-analysis.md](references/redundancy-analysis.md) for the full detection rules
- Look at every pair of pending tickets and assess how much their scope overlaps — consider their summaries, descriptions, components, labels, ticket type, and any explicit JIRA duplicate links
- For each pair, form a judgment on how likely they are to describe the same work: assign a weight (how much overlap) and a confidence level (how certain you are)
- When two tickets clearly overlap, decide which one is the primary — prefer the higher-scoring ticket, or the lower-numbered one if scores are equal
- When the overlap is strong enough to act on (high confidence, or medium confidence with substantial weight), pull the secondary ticket out of the pending set and put it in `skipped`. Write a plain-English reason that explains exactly what was found — which fields overlapped, what the textual similarity was, and why you concluded one ticket's scope is covered by the other. See [references/redundancy-analysis.md](references/redundancy-analysis.md) for evidence string guidelines
- When the overlap is weaker (low confidence, or medium confidence with low weight), treat the tickets as independent — leave both in the layers and do not flag them
- Tickets moved to `skipped` here must not appear in the scoring or grouping steps below

### Step 5 — Priority Scoring & Grouping
- Only score `pending` tickets — `context` tickets are not scored or placed in layers
- For tickets at the same dependency layer, score using weights from [references/priority-weights.md](references/priority-weights.md)
- Sort within each layer by descending score
- Apply `EXTRA_CONTEXT` context as a tiebreaker or boost
- **Group related tickets** within the same layer — see [references/dependency-analysis.md](references/dependency-analysis.md) Grouping Rules. First ticket in each group (highest score) is the primary ticket.
- **Understand each repo** before assigning tickets: for each repo path in `EXTRA_CONTEXT`, read `README.md` and `AGENT.md` (if they exist) to understand what the repo owns, its tech stack, and boundaries. Use this understanding — not just keyword heuristics — to determine repo assignments.
- **Determine `repos`** for each ticket (REQUIRED): based on the repo context above and the ticket summary, description, components, labels, and linked issues, assign the ticket to one or more repos. A ticket may need multiple repos when changes span boundaries. Output the repo **basename** only (not the full path). Every ticket MUST have at least one repo.
- **Determine `branch`** for each ticket (REQUIRED): slugify the ticket key + summary into a branch name. Format: `{ticket-key}-{slugified-title}` — lowercase, replace spaces and special characters with hyphens, collapse consecutive hyphens, strip leading/trailing hyphens, truncate to 50 characters (e.g. `"ec-123-fix-payment-bug"`). Every ticket MUST have a `branch`.
- **Determine `complexity`** for each ticket (REQUIRED): classify based on ticket summary, description, type, and components:
  - `trivial` — single-line or single-file change; config, copy, or text fix; no logic change; no UI, DB, or cross-service impact
  - `moderate` — multi-file change within a single domain; clear requirements; no DB migrations; no cross-service orchestration
  - `complex` — multiple domains; DB migrations; feature flags with rollout phases; cross-service changes; ambiguous/underspecified requirements
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
| [references/redundancy-analysis.md](references/redundancy-analysis.md) | Step 4b — redundancy detection, weight/confidence rules, skipped entry format |
