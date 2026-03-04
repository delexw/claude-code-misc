---
name: pagerduty-oncall
description: Investigate PagerDuty incidents for Envato on-call escalation policies. Use when asked about incidents, on-call status, incident analysis, or PagerDuty investigation.
argument-hint: "YYYY-MM-DD YYYY-MM-DD"
allowed-tools: Bash(pd auth *), Bash(pd ep list *), Bash(pd incident list *), Bash(pd incident log *), Bash(pd incident notes *), Bash(pd incident analytics *), Bash(mkdir *), Bash(test *), Read, Write, Edit
model: sonnet
---

# PagerDuty On-Call Incident Investigator

Authenticate, list escalation policies, fetch all incidents and their details, then analyse relevance across Envato on-call teams.

## Arguments
- `$ARGUMENTS[0]` — (optional) Start date in `YYYY-MM-DD` format. Defaults to today's date. In current agent's local timezone (detect via system clock), not UTC.
- `$ARGUMENTS[1]` — (optional) End date in `YYYY-MM-DD` format. Defaults to today's date. In current agent's local timezone (detect via system clock), not UTC.

## Target Escalation Policies

The list of escalation policies to investigate is resolved in order:
1. `config.json` — `escalation_policies` array in [config.json](config.json)
2. `PD_ESCALATION_POLICIES` — comma-separated env var (e.g. `"On Call, Platform Engineering On-Call"`)
3. If both are empty, all escalation policies are included

## System Requirements
- `pd` CLI installed (https://github.com/martindstone/pagerduty-cli)
- Environment variable `PAGERDUTY_API_TOKEN` set with a valid PagerDuty REST API token. **Important:** When checking this variable, verify at least 2 times before concluding it is not set. Environment variables can appear unset due to shell context differences. **Never expose the value** — use existence checks only (e.g. `test -n "$PAGERDUTY_API_TOKEN"`).

## Output Directory

All intermediate JSON and the final report are saved to:

```
.pagerduty-oncall-tmp/
├── ep-list.json              # Filtered escalation policies
├── incidents.json            # Incidents filtered by target EPs
├── logs/<INCIDENT_ID>.json   # Log entries per incident
├── notes/<INCIDENT_ID>.json  # Notes per incident
├── analytics/<INCIDENT_ID>.json # Analytics per incident
└── report.md                 # Final analysis report
```

## CLI Output Handling

The `pd` CLI may include non-JSON text (status messages, warnings) before or after the JSON payload. When processing output:
- Look for the JSON array `[...]` or object `{...}` in the output
- Ignore any surrounding text
- If the output contains "no ... found" or similar empty-result messages, treat it as an empty array `[]`

## Execution

### 1. Verify Connection

Check that `PAGERDUTY_API_TOKEN` is set (verify at least 2 times before concluding it is missing):
```bash
test -n "$PAGERDUTY_API_TOKEN" && echo "TOKEN_SET" || echo "TOKEN_MISSING"
```

If token is set, authenticate:
```bash
pd auth add --token "$PAGERDUTY_API_TOKEN"
```

If authentication fails, use `AskUserQuestion` to inform the user and link to the [PagerDuty CLI User Guide](https://github.com/martindstone/pagerduty-cli/wiki/PagerDuty-CLI-User-Guide) for setup instructions. Do NOT continue until authentication succeeds.

### 2. Prepare Output Directory

Create the output directory `.pagerduty-oncall-tmp/` and subdirectories `logs/`, `notes/`, `analytics/` before saving any files.

### 3. Load Escalation Policy Configuration

Read [config.json](config.json) using the Read tool. Extract the `escalation_policies` array.

If the array is empty, check for the `PD_ESCALATION_POLICIES` env var:
```bash
test -n "$PD_ESCALATION_POLICIES" && echo "$PD_ESCALATION_POLICIES" || echo "EMPTY"
```

Remember the list of target EP names (case-insensitive) for filtering in Step 4. If both sources are empty, skip filtering (include all EPs).

### 4. List Escalation Policies

Fetch all escalation policies:
```bash
pd ep list --json
```

From the JSON output, extract only these fields per EP:
- `id`, `name`, `num_loops`, `services` (array of `{id, name}`)

Filter to only target EP names (case-insensitive match) if configured. Save the filtered and extracted list using Write to `.pagerduty-oncall-tmp/ep-list.json`.

Keep the set of target EP IDs in memory for incident filtering.

### 5. Fetch Incidents

List all incidents in the date range with all statuses:
```bash
pd incident list --json --statuses=open --statuses=closed --statuses=triggered --statuses=acknowledged --statuses=resolved --since=$ARGUMENTS[0] --until=$ARGUMENTS[1]
```

From the JSON output, extract only these fields per incident:
- `id`, `incident_number`, `title`, `status`, `urgency`
- `created_at`, `resolved_at`
- `service` → `{id, name}`
- `escalation_policy` → `{id, name}`
- `assigned_to` (array of user names)
- `alert_counts`

Filter to only incidents whose `escalation_policy.id` is in the target EP IDs from Step 4. Save using Write to `.pagerduty-oncall-tmp/incidents.json`.

If no matching incidents are found, write a report noting zero incidents and stop.

### 6. Gather Incident Details

For each incident, fetch details **sequentially** (to avoid PagerDuty API rate limits). On failure for any individual command, save `[]` for that file and continue with the next.

**Log entries:**
```bash
pd incident log -i <INCIDENT_ID> --json
```
Extract per entry: `type`, `created_at`, `channel`, `agent`, `note`
Save to `.pagerduty-oncall-tmp/logs/<INCIDENT_ID>.json`

**Notes:**
```bash
pd incident notes -i <INCIDENT_ID> --output=json
```
Extract per note: `id`, `content`, `created_at`, `user`
Save to `.pagerduty-oncall-tmp/notes/<INCIDENT_ID>.json`

**Analytics:**
```bash
pd incident analytics -i <INCIDENT_ID> --json
```
Extract: `mean_seconds_to_resolve`, `mean_seconds_to_first_ack`, `mean_seconds_to_engage`, `mean_seconds_to_mobilize`, `escalation_count`, `timeout_escalation_count`, `num_interruptions`
Save to `.pagerduty-oncall-tmp/analytics/<INCIDENT_ID>.json`

### 7. Analyse and Report

Read all saved JSON files from `.pagerduty-oncall-tmp/` using the Read tool. Produce a structured analysis and save it using Write to `.pagerduty-oncall-tmp/report.md`:

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
