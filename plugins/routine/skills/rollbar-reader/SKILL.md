---
name: rollbar-reader
description: Investigate and analyse Rollbar errors, items, occurrences, deploys, and project health using the rollbar CLI. Use when asked to investigate Rollbar errors, search error items, check deploy status, run RQL queries, get occurrence details, or analyse any Rollbar data.
argument-hint: <what to investigate> <out-dir>
allowed-tools: Bash(rollbar config *), Bash(rollbar items *), Bash(rollbar occurrences *), Bash(rollbar metrics *), Bash(rollbar deploys *), Bash(rollbar environments *), Bash(rollbar rql *), Bash(rollbar reports *), Bash(rollbar projects *), Bash(rollbar tokens *), Bash(rollbar teams *), Bash(rollbar users *), Bash(rollbar team-users *), Bash(rollbar team-projects *), Bash(rollbar user-projects *), Bash(rollbar people *), Bash(rollbar notifications *), Bash(rollbar replays *), Bash(rollbar service-links *), Bash(rollbar versions *), Bash(rollbar agent *), Bash(rollbar --help *), Bash(mkdir *), Bash(test *), Read, Write, Edit
model: sonnet
context: fork
---

# Rollbar Reader

Investigate and analyse Rollbar error tracking data using the `rollbar` CLI (https://github.com/delexw/rollbar-cli).

## Arguments

- `$ARGUMENTS[0]` — What to investigate. Include the time range in the sentence. Use current agent's local timezone (detect via system clock) for any time-based queries, not UTC. Defaults to last 24 hours if no time range is mentioned.
- `$ARGUMENTS[1]` — (optional) Base directory for all temp assets. Defaults to `.rollbar-reader-tmp/`.

## System Requirements

- `rollbar` CLI installed — `npm install -g @delexw/rollbar-cli` (see https://github.com/delexw/rollbar-cli)
- A project access token configured via `rollbar config set-token <project> <token>` and `rollbar config set-default <project>`. **Important:** When checking configuration, verify at least 2 times before concluding it is not configured. **Never expose token values** — use existence checks only.
- For account-level commands (teams, users, projects): account token configured via `rollbar config set-account-token <token>` (optional, only needed for account-level queries)

## Output Directory

All intermediate JSON and the final report are saved to the output directory (default `.rollbar-reader-tmp/`):

```
.rollbar-reader-tmp/
├── items.json                  # Error items list
├── occurrences/
│   └── <ITEM_ID>.json          # Occurrences per item
├── deploys.json                # Deploy history
├── rql-results.json            # RQL query results (if used)
├── reports/
│   ├── top-active.json         # Top active items report
│   └── occurrence-counts.json  # Occurrence count data
└── report.md                   # Final analysis report
```

## Execution

### 1. Verify Installation & Configuration

Check if the `rollbar` CLI is installed:

```bash
which rollbar
```

If not found, install it automatically: `npm install -g @delexw/rollbar-cli`. See [references/setup-guide.md](references/setup-guide.md) for full setup details.

If no projects are configured, guide the user through token setup using [references/setup-guide.md](references/setup-guide.md). **Never expose token values** — use existence checks only.

Do NOT continue until both installation and configuration are verified.

### 2. Discover Configured Projects & Select Target

**Always start by listing configured projects** to know which projects are available:

```bash
rollbar config list
```

This returns all configured project names. Use this to:
- Show the user which projects are available to query
- **Infer the correct `--project` flag** from the user's request context (e.g. if they mention "storefront errors", match to a project name like `elements-storefront`)
- If only one project is configured, use it automatically
- If multiple projects match the context, ask the user which one to query

The `--project <name>` global flag selects which project to query. It must match a name from `rollbar config list`. Examples:

```bash
# Query items for a specific project
rollbar --project elements-storefront items list --status active

# Query occurrences for a specific project
rollbar --project elements-backend occurrences list
```

If the user does not specify a project and the default project (from `rollbar config show`) is appropriate, you can omit `--project` to use the default.

### 3. Prepare Output Directory

Create the output directory and subdirectories:

```bash
mkdir -p <OUT_DIR>/occurrences <OUT_DIR>/reports
```

Where `<OUT_DIR>` is `$ARGUMENTS[1]` or `.rollbar-reader-tmp/` if not provided.

### 4. Investigate Using Items & Occurrences

Based on `$ARGUMENTS[0]` (which includes the time range), query Rollbar data. Use `--format json` for all commands to get structured output. Run commands sequentially.

#### `rollbar items` — Query Error Items (Readonly)

**List items** with optional status and level filters:

```bash
# List all active items (default project)
rollbar items list --status active

# List active critical items for a specific project
rollbar --project my-app items list --status active --level critical

# List active errors (not warnings/info)
rollbar --project my-app items list --status active --level error

# List resolved items
rollbar --project my-app items list --status resolved

# List muted items
rollbar items list --status muted

# Paginate through results
rollbar --project my-app items list --status active --page 2
```

Available `--status` values: `active`, `resolved`, `muted`, etc.
Available `--level` values: `critical`, `error`, `warning`, `info`, `debug`.

**Get a single item** by ID, UUID, or project counter:

```bash
# Get item by numeric ID
rollbar items get --id 123456789

# Get item by UUID
rollbar items get --uuid "abcd1234-ef56-7890-abcd-ef1234567890"

# Get item by project counter (the "#123" number shown in Rollbar UI)
rollbar --project my-app items get --counter 123
```

#### `rollbar occurrences` — Query Occurrences (Readonly)

**List all recent occurrences** across the project:

```bash
# List recent occurrences (default project)
rollbar occurrences list

# List occurrences for a specific project
rollbar --project my-app occurrences list

# Paginate
rollbar --project my-app occurrences list --page 2
```

**List occurrences for a specific item** (requires the item ID from `items list` or `items get`):

```bash
# Get all occurrences for item ID 123456789
rollbar --project my-app occurrences list-by-item 123456789

# Paginate through occurrences
rollbar --project my-app occurrences list-by-item 123456789 --page 2
```

**Get a single occurrence** by occurrence ID (for full detail including stack trace, request data, etc.):

```bash
# Get full occurrence detail
rollbar occurrences get 987654321
```

This returns the complete occurrence payload — stack trace, request params, person data, server info, custom data, etc.

#### Typical Investigation Workflow

1. **List configured projects** → `rollbar config list`
2. **List active errors** → `rollbar --project <name> items list --status active --level error`
3. **Pick a high-impact item** → note the item ID from the list
4. **Get item detail** → `rollbar --project <name> items get --id <item_id>`
5. **List occurrences for that item** → `rollbar --project <name> occurrences list-by-item <item_id>`
6. **Get full occurrence detail** → `rollbar occurrences get <occurrence_id>` (to see stack trace, request data)
7. **Repeat** for other high-priority items

**Time range handling:**
- Extract time range from `$ARGUMENTS[0]`
- Convert to appropriate `--hours` flags for report commands or date ranges for RQL queries
- Default: last 24 hours if no time range is mentioned in `$ARGUMENTS[0]`

Save intermediate results as JSON to the output directory for reference.

### 5. Deep-Dive (if needed)

For error investigation, drill into specific items:

1. List active error/critical items
2. For each high-priority item, fetch recent occurrences
3. Get the full occurrence detail for the most recent occurrence to understand the error context (stack trace, request data, etc.)
4. Check deploys around the time errors started to correlate with releases

### 6. Report

All timestamps in the report must use current agent's local timezone (detect via system clock), not UTC.

Write a structured analysis to `<OUT_DIR>/report.md` using the Write tool:

1. **Summary** — Overall error health and key findings
2. **Top Items** — Highest impact error items with occurrence counts, levels, and first/last seen
3. **Error Details** — Breakdown of investigated items: stack traces, affected environments, occurrence patterns
4. **Deploy Correlation** — Recent deploys and any correlation with error spikes
5. **Trends** — Occurrence count trends over the time range
6. **Recommendations** — Suggested follow-up actions (items to resolve, investigate further, etc.)

Inform the user of the report location: `<OUT_DIR>/report.md`

## Reference Files

| Name | When to Read |
|------|-------------|
| [references/setup-guide.md](references/setup-guide.md) | Installation and configuration guide |