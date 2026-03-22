# Step 1: Resolve Time Scope

## 1a. Detect Input Mode

Scan QUERY for one of three modes:

**PagerDuty URL**: regex `pagerduty\.com/incidents/([A-Z0-9]+)` → extract incident ID
**PagerDuty ID shorthand**: pattern `(?:^|\s)incident\s+([A-Z0-9]{6,})` → extract incident ID
**Explicit time range**: "from <datetime> to <datetime>", "past <N> hours/days", "last <N>h", "yesterday", etc.
**Default**: anything else (vague query or empty)

Proceed to the matching section below.

---

## 1b. PagerDuty-First Resolution (only if PD URL or ID detected)

Invoke `Skill("pagerduty-oncall")` with args `"incident <INCIDENT_ID>"`.

This triggers SINGLE-INCIDENT mode in pagerduty-oncall (fetches the specific incident and its related context).

Read `.pagerduty-oncall-tmp/report.md`. Extract from the `## Incident Metadata` block:
- `created_at` (UTC ISO8601) → **SINCE** = created_at minus 1 hour (lookback for root cause signals before the alert fired)
- `resolved_at` (UTC ISO8601) → **UNTIL** = resolved_at plus 30 minutes; use `now` (current UTC time) if `resolved_at` is "ongoing"
- `service` → **SERVICE_HINT** (for scoping Datadog/Rollbar queries)
- `title` → **TITLE_HINT** (for Rollbar keyword search)

Set **PD_INCIDENT** = the incident ID (signals Step 2a to skip — PagerDuty data already collected).

Log: `Anchored to PD incident <ID>: analysing <SINCE> → <UNTIL>`

Proceed to Step 2. **Only steps 2b, 2c, and 2d run** — step 2a is skipped (PD data already in `.pagerduty-oncall-tmp/report.md`).

---

## 1c. Explicit Time (no PD reference)

Parse QUERY for time expressions and resolve to UTC ISO8601.

First, detect local timezone and current local time via system clock (`date` command). Use the local timezone — not UTC — to interpret calendar-relative terms like "today" and "yesterday", then convert to UTC ISO8601.

| Expression | SINCE | UNTIL |
|---|---|---|
| `"past 6 hours"` | now − 6h (UTC) | now (UTC) |
| `"last 3 days"` | now − 3 days (UTC) | now (UTC) |
| `"yesterday"` | midnight yesterday **local time** → UTC | midnight today **local time** → UTC |
| `"from 2026-03-20T02:00Z to 2026-03-20T08:00Z"` | 2026-03-20T02:00:00Z | 2026-03-20T08:00:00Z |
| `"incidents today"` | midnight today **local time** → UTC | now (UTC) |

Set SINCE and UNTIL as UTC ISO8601 strings. Leave PD_INCIDENT, SERVICE_HINT, TITLE_HINT empty.

Proceed to Step 2 with all four sub-skills (2a + 2b + 2c + 2d).

---

## 1d. Default (no time info, no PD reference)

**If QUERY is empty**: use `AskUserQuestion`:
> What should I investigate? Examples:
> - `incidents today` (default)
> - `past 6 hours`
> - `https://mycompany.pagerduty.com/incidents/P1234ABC`
> - `incident P1234ABC`
> - `from 2026-03-20T02:00Z to 2026-03-20T08:00Z`

**If QUERY is present but has no time info**: default SINCE = now − 24h (UTC), UNTIL = now (UTC).

Proceed to Step 2 with all four sub-skills.
