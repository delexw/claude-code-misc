---
name: pagerduty-oncall
description: Investigate PagerDuty incidents for Envato on-call escalation policies. Use when asked about incidents, on-call status, incident analysis, or PagerDuty investigation.
argument-hint: <what-to-investigate>
allowed-tools: Bash(pd auth *), Bash(pd ep list *), Bash(pd incident list *), Bash(pd rest *), Bash(pd incident log *), Bash(pd incident notes *), Bash(pd incident analytics *), Bash(node *), Bash(mkdir *), Bash(test *), Bash(chmod *), Bash(date *), Read, Write, Edit
model: sonnet
context: fork
---

# PagerDuty On-Call Incident Investigator

Authenticate, list escalation policies, fetch all incidents and their details, then analyse relevance across Envato on-call teams.

## Inputs

Raw arguments: $ARGUMENTS

Infer from the arguments:
- QUERY: what to investigate. Defaults to "incidents today". Interpret the time range to derive --since and --until dates (YYYY-MM-DD) in UTC (not local timezone). See the date derivation table in Step 5.
- MODE: Inferred from QUERY.
  - If QUERY starts with "incident <ID>" or contains a PagerDuty URL (matching `pagerduty\.com/incidents/([A-Z0-9]+)`) → **SINGLE-INCIDENT mode**
  - Otherwise → **LIST mode** (existing behaviour)
- SINCE: (optional) UTC ISO8601 start of analysis window. Takes precedence over QUERY-derived dates in LIST mode.
- UNTIL: (optional) UTC ISO8601 end of analysis window. Takes precedence over QUERY-derived dates in LIST mode.

## Target Escalation Policies

The list of escalation policies to investigate is resolved in order:
1. `config.json` — `escalation_policies` array in [config.json](config.json)
2. `PD_ESCALATION_POLICIES` — comma-separated env var (e.g. `"On Call, Platform Engineering On-Call"`)
3. If both are empty, all escalation policies are included

## System Requirements
- `pd` CLI installed (https://github.com/martindstone/pagerduty-cli)
- Environment variable `PAGERDUTY_API_TOKEN` set with a valid PagerDuty REST API token. **Important:** When checking this variable, verify at least 2 times before concluding it is not set. Environment variables can appear unset due to shell context differences. **Never expose the value** — use existence checks only (e.g. `test -n "$PAGERDUTY_API_TOKEN"`).

## Scripts

All parsing and filtering is handled by scripts in `${CLAUDE_SKILL_DIR}/scripts/`:

| Script | Purpose |
|--------|---------|
| `extract-json.js` | Extracts JSON from pd CLI output that may contain non-JSON text |
| `filter-eps.js` | Filters EPs by target names, extracts relevant fields |
| `filter-incidents.js` | Filters incidents by service IDs from `ep-list.json`, extracts fields |
| `parse-log.js` | Extracts relevant fields from incident log entries |
| `parse-notes.js` | Extracts relevant fields from incident notes |
| `parse-analytics.js` | Extracts relevant fields from incident analytics |

All scripts read from stdin and write to stdout. Pipe pd CLI output through `extract-json.js` first, then through the appropriate filter/parse script.

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

Build the list of target EP names for the next step. If both sources are empty, no names will be passed (all EPs included).

### 4. List and Filter Escalation Policies

Fetch, extract JSON, filter by target names, and save in one pipeline:
```bash
pd ep list --json 2>&1 | node ${CLAUDE_SKILL_DIR}/scripts/extract-json.js | node ${CLAUDE_SKILL_DIR}/scripts/filter-eps.js "EP Name 1" "EP Name 2" > .pagerduty-oncall-tmp/ep-list.json
```

Pass each target EP name as a separate argument to `filter-eps.js`. If no target names, omit the arguments (all EPs pass through).

### 5-ALT. Single-Incident Mode (when MODE = SINGLE-INCIDENT)

Extract the incident ID from QUERY:
- From URL: match `pagerduty\.com/incidents/([A-Z0-9]+)` → capture group is the ID
- From shorthand: match `incident ([A-Z0-9]+)` → capture group is the ID

Fetch the specific incident:
```bash
pd rest get --endpoint "/incidents/<INCIDENT_ID>" 2>&1 \
  | node ${CLAUDE_SKILL_DIR}/scripts/extract-json.js \
  > .pagerduty-oncall-tmp/incidents.json
```

Extract from the incident JSON:
- `id`, `incident_number`, `title`, `status`, `urgency`
- `created_at`, `resolved_at` (null if still open)
- `service.summary` → SERVICE
- `escalation_policy.summary` → EP

Also fetch related incidents on the same service within ±2h of `created_at`:
```bash
pd incident list --json --statuses=open --statuses=closed --statuses=triggered --statuses=acknowledged --statuses=resolved \
  --since=<created_at minus 2h, YYYY-MM-DD UTC> --until=<created_at plus 2h, YYYY-MM-DD UTC> 2>&1 \
  | node ${CLAUDE_SKILL_DIR}/scripts/extract-json.js \
  | node ${CLAUDE_SKILL_DIR}/scripts/filter-incidents.js .pagerduty-oncall-tmp/ep-list.json \
  > .pagerduty-oncall-tmp/related-incidents.json
```

Then continue to Step 6 (gather details) and Step 7 (report) as normal.

The report MUST include a structured metadata section at the top (UTC ISO8601 for machine parsing):

```markdown
## Incident Metadata
- created_at: <ISO8601 UTC>
- resolved_at: <ISO8601 UTC or "ongoing">
- service: <name>
- title: <title>
```

Followed by the human-readable timeline in local timezone (see Step 7).

### 5. Fetch and Filter Incidents (LIST mode)

Derive `SINCE_DATE` and `UNTIL_DATE` (YYYY-MM-DD, in UTC) from `QUERY`. **Important:** `--until` is **exclusive** in the `pd` CLI — it does NOT include that day.

**If SINCE and UNTIL are provided as UTC ISO8601 timestamps**, pass them directly to `pd incident list` — the pd CLI accepts ISO8601 for `--since` / `--until`:
```bash
pd incident list --json ... --since=<SINCE> --until=<UNTIL> ...
```

**Otherwise**, derive SINCE and UNTIL as **UTC ISO8601 timestamps** from QUERY using the agent's **local timezone**. "Today" means the local calendar day — an incident at 11am local is in "today" even if it falls on a different UTC date. Compute local day boundaries and convert to UTC ISO8601 for the pd API.

For relative durations, use pd CLI natural language directly:
```bash
pd incident list --json ... --since "24 hours ago" --until "now" ...
```

For named days and calendar ranges, compute local midnight as UTC ISO8601:
```bash
# Start of local today as UTC ISO8601 (Linux / macOS)
date -d "$(date +%Y-%m-%d) 00:00:00" -u +%Y-%m-%dT%H:%M:%SZ          # Linux
date -jf "%Y-%m-%d %H:%M:%S" "$(date +%Y-%m-%d) 00:00:00" -u +%Y-%m-%dT%H:%M:%SZ  # macOS

# Start of local yesterday
date -d "$(date -d yesterday +%Y-%m-%d) 00:00:00" -u +%Y-%m-%dT%H:%M:%SZ       # Linux
date -jf "%Y-%m-%d %H:%M:%S" "$(date -v-1d +%Y-%m-%d) 00:00:00" -u +%Y-%m-%dT%H:%M:%SZ  # macOS
```

Use these ISO8601 values directly as `--since` / `--until` on `pd incident list`. For "today": SINCE = start of local today as UTC ISO8601, UNTIL = omit (defaults to now). For "yesterday": SINCE = start of local yesterday, UNTIL = start of local today. For explicit date ranges: SINCE = start of first local day, UNTIL = start of day after last local day.

Then fetch, extract JSON, filter by service IDs from `ep-list.json`, and save. **Run this as two separate commands** — do NOT chain Step 4 and Step 5 into a single pipeline, as `filter-incidents.js` reads `ep-list.json` from disk and the file must be fully written before Step 5 begins:

```bash
# Step 4 must be complete before running this
pd incident list --json --statuses=open --statuses=closed --statuses=triggered --statuses=acknowledged --statuses=resolved --since=SINCE_DATE --until=UNTIL_DATE 2>&1 > /tmp/pd-incidents-raw.json
node ${CLAUDE_SKILL_DIR}/scripts/extract-json.js < /tmp/pd-incidents-raw.json | node ${CLAUDE_SKILL_DIR}/scripts/filter-incidents.js .pagerduty-oncall-tmp/ep-list.json > .pagerduty-oncall-tmp/incidents.json
```

Read `.pagerduty-oncall-tmp/incidents.json` to check the result. If the array is empty, write a report noting zero incidents and stop.

### 6. Gather Incident Details

For each incident in `.pagerduty-oncall-tmp/incidents.json`, fetch details **sequentially** (to avoid PagerDuty API rate limits). Use the `id` field (e.g. `Q1V3O5Q3JX39LJ`), NOT `incident_number` — the `pd` CLI only accepts internal IDs.

**Log entries:**
```bash
pd incident log -i <INCIDENT_ID> --json 2>&1 | node ${CLAUDE_SKILL_DIR}/scripts/extract-json.js | node ${CLAUDE_SKILL_DIR}/scripts/parse-log.js > .pagerduty-oncall-tmp/logs/<INCIDENT_ID>.json
```

**Notes:**
```bash
pd incident notes -i <INCIDENT_ID> --output=json 2>&1 | node ${CLAUDE_SKILL_DIR}/scripts/extract-json.js | node ${CLAUDE_SKILL_DIR}/scripts/parse-notes.js > .pagerduty-oncall-tmp/notes/<INCIDENT_ID>.json
```

**Analytics:**
```bash
pd incident analytics -i <INCIDENT_ID> --json 2>&1 | node ${CLAUDE_SKILL_DIR}/scripts/extract-json.js | node ${CLAUDE_SKILL_DIR}/scripts/parse-analytics.js > .pagerduty-oncall-tmp/analytics/<INCIDENT_ID>.json
```

### 7. Analyse and Report

Read all saved JSON files from `.pagerduty-oncall-tmp/` using the Read tool. Produce a structured analysis and save it using Write to `.pagerduty-oncall-tmp/report.md`:

**When in SINGLE-INCIDENT mode**, begin the report with the structured metadata block (UTC ISO8601, for machine parsing by the PIR orchestrator):

```markdown
## Incident Metadata
- created_at: 2026-03-20T02:30:00Z
- resolved_at: 2026-03-20T04:15:00Z
- service: storefront
- title: High error rate on checkout
```

Then include:

1. **Incident Summary Table** — For each incident: ID, title, service, escalation policy, status, urgency, created/resolved timestamps in **local timezone** (detect via system clock, format: `2026-03-20 15:30 NZDT`), duration
2. **Cross-Team Correlation** — Identify incidents that overlap in time across different escalation policies. Flag potential cascading failures or shared root causes
3. **Timeline** — Chronological view of all incidents across all teams in **local timezone**, highlighting clusters of activity
4. **Key Findings** — Patterns, recurring services, repeated triggers, or escalation policy gaps
5. **Recommendations** — Actionable suggestions based on the analysis

All timestamps displayed to users must use local timezone with TZ abbreviation. Do NOT use UTC in human-readable sections.

After writing the report, **explicitly tell the user** its location as the final line of your response:

> Report saved to `.pagerduty-oncall-tmp/report.md`