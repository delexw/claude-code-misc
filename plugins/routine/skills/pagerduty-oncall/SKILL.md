---
name: pagerduty-oncall
description: Investigate PagerDuty incidents for Envato on-call escalation policies. Use when asked about incidents, on-call status, incident analysis, or PagerDuty investigation.
argument-hint: "YYYY-MM-DD YYYY-MM-DD"
allowed-tools: Bash(node scripts/fetch-pd.js *), Read, Write, Edit
model: haiku
context: fork
---

# PagerDuty On-Call Incident Investigator

Authenticate, list escalation policies, fetch all incidents and their details, then analyse relevance across Envato on-call teams.

## Arguments
- `$ARGUMENTS[0]` — (optional) Start date in `YYYY-MM-DD` format. Defaults to today's date. In current agent's local timezone (detect via system clock), not UTC.
- `$ARGUMENTS[1]` — (optional) End date in `YYYY-MM-DD` format. Defaults to today's date. In current agent's local timezone (detect via system clock), not UTC.

## Target Escalation Policies

The list of escalation policies to investigate is resolved in order:
1. `config.json` — `escalation_policies` array in [config.json](config.json)
2. `PD_ESCALATION_POLICIES` — comma-separated env var (e.g. `"Elements On Call, Platform Engineering (GPET) On-Call"`)
3. If both are empty, all escalation policies are included

## System Requirements
- `pd` CLI installed (https://github.com/martindstone/pagerduty-cli)
- `node` available on PATH
- Environment variable `PAGEDUTY_API_TOKEN` set with a valid PagerDuty REST API token

## Output Directory

All intermediate JSON and the final report are saved to:

```
.pagerduty-oncall-tmp/
├── ep-list.json              # Parsed escalation policies
├── incidents.json            # Parsed incident list (filtered by target EPs)
├── logs/<INCIDENT_ID>.json   # Parsed log per incident
├── notes/<INCIDENT_ID>.json  # Parsed notes per incident
├── analytics/<INCIDENT_ID>.json # Parsed analytics per incident
├── summary.json              # Execution summary (counts, errors)
└── report.md                 # Final analysis report
```

## Execution

### 1. Fetch All Data

Run the single fetch script. It handles authentication, EP listing, incident listing, and gathering logs/notes/analytics for each incident — all sequentially to avoid PagerDuty API rate limits.

```bash
node scripts/fetch-pd.js .pagerduty-oncall-tmp $ARGUMENTS[0] $ARGUMENTS[1]
```

If this fails with an authentication error, use `AskUserQuestion` to inform the user and link to the [PagerDuty CLI User Guide](https://github.com/martindstone/pagerduty-cli/wiki/PagerDuty-CLI-User-Guide) for setup instructions. Do NOT continue until the script succeeds.

### 2. Analyse and Report

Read `summary.json` first to understand the scope. Then read `incidents.json` and all files from `logs/`, `notes/`, and `analytics/` subdirectories using the Read tool.

Produce a structured analysis and save it using Write to `.pagerduty-oncall-tmp/report.md`:

1. **Incident Summary Table** — For each incident: ID, title, service, escalation policy, status, urgency, created/resolved timestamps (current agent's local timezone via system clock, not UTC), duration
2. **Cross-Team Correlation** — Identify incidents that overlap in time across different escalation policies. Flag potential cascading failures or shared root causes
3. **Timeline** — Chronological view of all incidents across all teams in current agent's local timezone, highlighting clusters of activity
4. **Key Findings** — Patterns, recurring services, repeated triggers, or escalation policy gaps
5. **Recommendations** — Actionable suggestions based on the analysis

After writing the report, inform the user of the report location: `.pagerduty-oncall-tmp/report.md`

<tags>
   <mode>think</mode>
   <custom>yes</custom>
</tags>
