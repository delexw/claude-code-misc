---
name: datadog-analyser
description: Analyse Datadog observability data including metrics, logs, monitors, incidents, SLOs, APM traces, RUM, security signals, and more. Use when asked to investigate infrastructure health, query metrics, search logs, check monitors, diagnose errors, or analyse any Datadog data.
argument-hint: <what-to-analyse>
allowed-tools: Bash(pup test), Bash(pup auth status), Bash(pup agent *), Bash(pup monitors list *), Bash(pup monitors get *), Bash(pup monitors search *), Bash(pup metrics query *), Bash(pup metrics list *), Bash(pup metrics get *), Bash(pup metrics search *), Bash(pup logs search *), Bash(pup logs list *), Bash(pup logs aggregate *), Bash(pup events list *), Bash(pup events search *), Bash(pup events get *), Bash(pup incidents list *), Bash(pup incidents get *), Bash(pup incidents attachments *), Bash(pup dashboards list *), Bash(pup dashboards get *), Bash(pup dashboards url *), Bash(pup slos list *), Bash(pup slos get *), Bash(pup slos status *), Bash(pup apm *), Bash(pup rum apps *), Bash(pup rum sessions *), Bash(pup rum metrics *), Bash(pup synthetics tests *), Bash(pup synthetics locations *), Bash(pup infrastructure hosts *), Bash(pup error-tracking issues *), Bash(pup service-catalog list *), Bash(pup service-catalog get *), Bash(pup scorecards list *), Bash(pup scorecards get *), Bash(pup security rules list *), Bash(pup security signals list *), Bash(pup security findings *), Bash(pup cicd pipelines *), Bash(pup cicd events *), Bash(pup on-call teams *), Bash(pup cases search *), Bash(pup cases get *), Bash(pup notebooks list *), Bash(pup notebooks get *), Bash(pup misc status), Bash(pup misc ip-ranges), Read, Write, Edit
model: sonnet
context: fork
---

# Datadog Analyser

Investigate and analyse Datadog observability data using the `pup` CLI.

## Inputs

Raw arguments: $ARGUMENTS

Infer from the arguments:
- QUERY: what to analyse.
- SINCE: (optional) UTC ISO8601 start of analysis window. When provided, convert to epoch seconds for `pup` `--from` flags (e.g. `date -d "2026-03-20T02:30:00Z" +%s` on Linux, or `date -jf "%Y-%m-%dT%H:%M:%SZ" "2026-03-20T02:30:00Z" +%s` on macOS).
- UNTIL: (optional) UTC ISO8601 end of analysis window. When provided, convert to epoch seconds for `pup` `--to` flags where supported; otherwise omit (defaults to now).
- SERVICE_HINT: (optional) Service name to prioritise in queries (filter monitors, logs, APM by this service first).

## System Requirements
- `pup` CLI installed — see https://github.com/datadog-labs/pup/blob/main/README.md
- `DD_API_KEY` and `DD_APP_KEY` environment variables set. **Important:** When checking these variables, verify at least 2 times before concluding they are not set. Environment variables can appear unset due to shell context differences. **Never expose the values** — use existence checks only (e.g. `test -n "$DD_API_KEY"`).
- `DD_SITE` set if not using `datadoghq.com` (optional)

## Output Directory

```
.datadog-analyser-tmp/
└── report.md    # Final analysis report
```

## Execution

### 1. Verify Connection

Run `pup test` to confirm the CLI is configured and connected:

```bash
pup test
```

If this fails, use `AskUserQuestion` to inform the user that `pup` is not configured or `DD_API_KEY`/`DD_APP_KEY` are not set, and link to the setup guide: https://github.com/datadog-labs/pup/blob/main/README.md

Do NOT continue until `pup test` succeeds.

### 2. Discover Available Commands

Run `pup agent guide` to get the full list of available commands and usage patterns for this session:

```bash
pup agent guide
```

If `pup agent guide` is not available (command not found), use the known command reference below and continue.

### 3. Analyse

Based on `QUERY`, determine which `pup` commands are most relevant. Use `--output=json` (default) for all commands to get structured output. Run commands sequentially.

**Time window rule** — when QUERY contains a named day ("today", "yesterday") or a calendar range, compute the window using local day boundaries, not UTC calendar days. A user saying "today" means since local midnight, so an event at 11am local is included even if it falls on a different UTC date.

For relative durations ("last 1h", "last 24h"), pass them directly as pup relative strings: `--from="1h"`, `--from="24h"`.

For named days, compute the local day boundary as epoch seconds and pass to `--from`/`--to`:
```bash
# Start of local today as epoch (Linux / macOS)
date -d "$(date +%Y-%m-%d) 00:00:00" +%s          # Linux
date -jf "%Y-%m-%d %H:%M:%S" "$(date +%Y-%m-%d) 00:00:00" +%s  # macOS
# Current time as epoch
date +%s
# Start of local yesterday
date -d "$(date -d yesterday +%Y-%m-%d) 00:00:00" +%s          # Linux
date -jf "%Y-%m-%d %H:%M:%S" "$(date -v-1d +%Y-%m-%d) 00:00:00" +%s  # macOS
```

**When SINCE and UNTIL are provided as UTC ISO8601**, convert each to epoch seconds and use them for all `--from`/`--to` flags instead of inferring time windows from QUERY. This ensures all Datadog queries cover exactly the same window as the other PIR sub-skills:
```bash
# Linux
SINCE_EPOCH=$(date -d "2026-03-20T02:30:00Z" +%s)
UNTIL_EPOCH=$(date -d "2026-03-20T06:00:00Z" +%s)
# macOS
SINCE_EPOCH=$(date -jf "%Y-%m-%dT%H:%M:%SZ" "2026-03-20T02:30:00Z" +%s)
UNTIL_EPOCH=$(date -jf "%Y-%m-%dT%H:%M:%SZ" "2026-03-20T06:00:00Z" +%s)
```

**When SERVICE_HINT is provided**, prioritise it in queries:
- Filter monitors: `pup monitors search --query="service:<SERVICE_HINT>"`
- Scope log searches with `service:<SERVICE_HINT>` in the query string
- Focus APM traces on that service first

**Common analysis patterns:**

| Goal | Commands |
|------|----------|
| Triggered/alerting monitors | `pup monitors list`, `pup monitors search --query="status:alert"` |
| Error logs | `pup logs search --query="status:error" --from="1h"` |
| Metric trend | `pup metrics query --query="<metric>" --from="<window>"` |
| Active incidents | `pup incidents list` |
| SLO health | `pup slos list`, `pup slos status <id>` |
| APM service health | `pup apm services`, `pup apm dependencies` |
| Security signals | `pup security signals list`, `pup security findings search` |
| Error tracking | `pup error-tracking issues search --query="<service>"` |
| Synthetics failures | `pup synthetics tests list` |
| CI failures | `pup cicd pipelines list`, `pup cicd events list` |

All commands default to JSON output. Use flags like `--from`, `--to`, `--query`, `--tags` to narrow scope. Refer to `pup <command> --help` for available flags.

### 4. Report

All timestamps in the report must use current agent's local timezone (detect via system clock), not UTC. Format: `2026-03-20 15:30 NZDT` (with TZ abbreviation). Do NOT use UTC in user-facing report sections — this includes timestamps that come directly from API responses (e.g. `last_triggered`, `overall_state_modified`, event times). Convert every timestamp to local time before writing it to the report.

Write a structured analysis to `.datadog-analyser-tmp/report.md` using the Write tool:

1. **Summary** — Overall health status and key findings
2. **Details** — Breakdown of findings per domain (monitors, logs, metrics, etc.)
3. **Anomalies** — Anything alerting, degraded, or unusual
4. **Recommendations** — Suggested follow-up actions

Inform the user of the report location: `.datadog-analyser-tmp/report.md`