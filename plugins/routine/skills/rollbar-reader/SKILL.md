---
name: rollbar-reader
description: Investigate and analyse Rollbar errors, items, occurrences, deploys, and project health using the rollbar CLI. Use when asked to investigate Rollbar errors, search error items, check deploy status, run RQL queries, get occurrence details, or analyse any Rollbar data.
argument-hint: "what to investigate (e.g. 'active errors last 24h', 'top items production', 'item 12345') [OUT_DIR]"
allowed-tools: Bash(rollbar config *), Bash(rollbar items *), Bash(rollbar occurrences *), Bash(rollbar metrics *), Bash(rollbar deploys *), Bash(rollbar environments *), Bash(rollbar rql *), Bash(rollbar reports *), Bash(rollbar projects *), Bash(rollbar tokens *), Bash(rollbar teams *), Bash(rollbar users *), Bash(rollbar team-users *), Bash(rollbar team-projects *), Bash(rollbar user-projects *), Bash(rollbar people *), Bash(rollbar notifications *), Bash(rollbar replays *), Bash(rollbar service-links *), Bash(rollbar versions *), Bash(rollbar agent *), Bash(rollbar --help *), Bash(mkdir *), Bash(test *), Read, Write, Edit
model: sonnet
---

# Rollbar Reader

Investigate and analyse Rollbar error tracking data using the `rollbar` CLI (https://github.com/delexw/rollbar-cli).

## Arguments

- `$ARGUMENTS[0]` — What to investigate (e.g. `"active errors last 24h"`, `"top items production"`, `"item 12345"`, `"deploys this week"`). Use current agent's local timezone (detect via system clock) for any time-based queries, not UTC.
- `$ARGUMENTS[1]` — (optional) Time range in format `YYYY-MM-DD YYYY-MM-DD` (start end) or `last Nh` (e.g. `last 24h`, `last 7d`). In current agent's local timezone (detect via system clock), not UTC. Defaults to last 24 hours.
- `$ARGUMENTS[2]` — (optional) Base directory for all temp assets. Defaults to `.rollbar-reader-tmp/`.

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

First check if the `rollbar` CLI is installed:

```bash
which rollbar
```

If not found, consult [references/setup-guide.md](references/setup-guide.md) for installation instructions (`npm install -g @delexw/rollbar-cli`) and use `AskUserQuestion` to guide the user through setup.

Once installed, verify configuration:

```bash
rollbar config show
```

If no projects are configured, guide the user through token setup using the instructions in [references/setup-guide.md](references/setup-guide.md):

```bash
rollbar config set-token <project-name> <access-token>
rollbar config set-default <project-name>
```

**Important:** When checking configuration, verify at least 2 times before concluding it is not configured. **Never expose token values** — use existence checks only.

Do NOT continue until both installation and configuration are verified.

### 2. Prepare Output Directory

Create the output directory and subdirectories:

```bash
mkdir -p <OUT_DIR>/occurrences <OUT_DIR>/reports
```

Where `<OUT_DIR>` is `$ARGUMENTS[2]` or `.rollbar-reader-tmp/` if not provided.

### 3. Discover Available Commands

Run `rollbar agent` to get the full command reference with all available commands, usage patterns, and common workflows. This is the authoritative guide for all CLI capabilities:

```bash
rollbar agent
```

Use `rollbar agent --compact` for a brief summary instead.

### 4. Investigate

Based on `$ARGUMENTS[0]` and the time range from `$ARGUMENTS[1]`, use the command reference from Step 3 to determine which `rollbar` commands are most relevant. Use `--format json` for all commands to get structured output. Run commands sequentially.

**Time range handling:**
- If `$ARGUMENTS[1]` is `last Nh` or `last Nd`, convert to appropriate `--hours` flags for report commands or date ranges for RQL queries
- If `$ARGUMENTS[1]` is `YYYY-MM-DD YYYY-MM-DD`, use as start/end for RQL queries or filter results by timestamp
- Default: last 24 hours

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

<tags>
  <mode>think</mode>
  <custom>yes</custom>
</tags>
