---
name: pagerduty-oncall
description: Investigate PagerDuty incidents for Envato on-call escalation policies. Use when asked about incidents, on-call status, incident analysis, or PagerDuty investigation.
argument-hint: "YYYY-MM-DD YYYY-MM-DD"
allowed-tools: Bash(~/.claude/skills/pagerduty-oncall/scripts/run-pd.sh *), Read, Write
---

# PagerDuty On-Call Incident Investigator

Authenticate, list escalation policies and incidents, then analyse relevance across Envato on-call teams.

All commands use a single wrapper script: `~/.claude/skills/pagerduty-oncall/scripts/run-pd.sh`

## Arguments
- `$ARGUMENTS[0]` — (optional) Start date in `YYYY-MM-DD` format. Defaults to today's date.
- `$ARGUMENTS[1]` — (optional) End date in `YYYY-MM-DD` format. Defaults to today's date.

## Target Escalation Policies

The list of escalation policies to investigate is defined in [config.json](config.json). Read this file at the start of execution to get the target team names. Only investigate incidents matching these policies.

To customize which teams are investigated, edit `~/.claude/skills/pagerduty-oncall/config.json`.

## System Requirements
- `pd` CLI installed (https://github.com/martindstone/pagerduty-cli)
- Environment variable `PAGEDUTY_API_TOKEN` set with a valid PagerDuty REST API token

## Output Directory

All intermediate JSON and the final report are saved to:

```
$CLAUDE_PROJECT_DIR/.pagerduty-oncall-tmp/
├── raw/                       # Raw output from pd CLI (includes progress messages)
├── ep-list.json              # Parsed escalation policies
├── incidents.json            # Parsed incident list
├── logs/<INCIDENT_ID>.json   # Parsed log per incident
├── notes/<INCIDENT_ID>.json  # Parsed notes per incident
├── analytics/<INCIDENT_ID>.json # Parsed analytics per incident
└── report.md                 # Final analysis report
```

The script creates all directories automatically. The script also handles retries (up to 3 attempts) and strips pd CLI progress messages from output before parsing.

## Execution

### 1. Authenticate

```bash
~/.claude/skills/pagerduty-oncall/scripts/run-pd.sh auth $CLAUDE_PROJECT_DIR/.pagerduty-oncall-tmp
```

If this fails, use `AskUserQuestion` to inform the user and link to the [PagerDuty CLI User Guide](https://github.com/martindstone/pagerduty-cli/wiki/PagerDuty-CLI-User-Guide) for setup instructions. Do NOT continue until authentication succeeds.

### 2. List Escalation Policies

```bash
~/.claude/skills/pagerduty-oncall/scripts/run-pd.sh ep $CLAUDE_PROJECT_DIR/.pagerduty-oncall-tmp
```

Read `$CLAUDE_PROJECT_DIR/.pagerduty-oncall-tmp/ep-list.json` and filter to find only the target escalation policies from config.json. Record their IDs for the next step.

### 3. List Incidents

If arguments are not provided, default both `--since` and `--until` to today's date (`YYYY-MM-DD`):

```bash
~/.claude/skills/pagerduty-oncall/scripts/run-pd.sh incidents $CLAUDE_PROJECT_DIR/.pagerduty-oncall-tmp --since=$ARGUMENTS[0] --until=$ARGUMENTS[1]
```

Read `$CLAUDE_PROJECT_DIR/.pagerduty-oncall-tmp/incidents.json` and filter to only incidents associated with the target escalation policies identified in Step 2. Record all incident IDs.

### 4. Gather Incident Details

**IMPORTANT: Run each command ONE AT A TIME sequentially to avoid PagerDuty API rate limits. Do NOT run commands in parallel.**

For each incident ID found in Step 3, run these three commands one after another:

```bash
~/.claude/skills/pagerduty-oncall/scripts/run-pd.sh log $CLAUDE_PROJECT_DIR/.pagerduty-oncall-tmp <INCIDENT_ID>
```

```bash
~/.claude/skills/pagerduty-oncall/scripts/run-pd.sh notes $CLAUDE_PROJECT_DIR/.pagerduty-oncall-tmp <INCIDENT_ID>
```

```bash
~/.claude/skills/pagerduty-oncall/scripts/run-pd.sh analytics $CLAUDE_PROJECT_DIR/.pagerduty-oncall-tmp <INCIDENT_ID>
```

Complete all three commands for one incident before moving to the next incident. Read the parsed JSON files from `logs/`, `notes/`, and `analytics/` subdirectories after all incidents are processed.

### 5. Analyse and Report

Read all saved JSON files from `$CLAUDE_PROJECT_DIR/.pagerduty-oncall-tmp/` using the Read tool. Then produce a structured analysis and save it using Write to `$CLAUDE_PROJECT_DIR/.pagerduty-oncall-tmp/report.md`:

1. **Incident Summary Table** — For each incident: ID, title, service, escalation policy, status, urgency, created/resolved timestamps, duration
2. **Cross-Team Correlation** — Identify incidents that overlap in time across different escalation policies. Flag potential cascading failures or shared root causes
3. **Timeline** — Chronological view of all incidents across all teams, highlighting clusters of activity
4. **Key Findings** — Patterns, recurring services, repeated triggers, or escalation policy gaps
5. **Recommendations** — Actionable suggestions based on the analysis

After writing the report, inform the user of the report location: `$CLAUDE_PROJECT_DIR/.pagerduty-oncall-tmp/report.md`

<tags>
   <mode>think</mode>
   <custom>yes</custom>
</tags>
