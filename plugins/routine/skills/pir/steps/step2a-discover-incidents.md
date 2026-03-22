# Step 2a: Discover Incidents from PagerDuty

One of four concurrent discovery sources (alongside Datadog, Cloudflare, and Rollbar). All sources carry equal weight for incident discovery.

**If PD_INCIDENT was resolved in Step 1b**: Skip this step entirely. PagerDuty data is already in `.pagerduty-oncall-tmp/report.md`.

Otherwise, build args and invoke the skill:

- If SINCE and UNTIL are set (UTC ISO8601):
  `Skill("pagerduty-oncall")` with args `"QUERY --since SINCE --until UNTIL"`
- Otherwise:
  `Skill("pagerduty-oncall")` with args `"QUERY"`

Then read and return the report contents from `.pagerduty-oncall-tmp/report.md`

**Extract from report** (`.pagerduty-oncall-tmp/report.md`):
- All incident IDs, titles, services, statuses
- Created/resolved timestamps → **When**, **Incident date**
- Escalation policies and responders → **Incident controller**
- Incident notes → **Remediation**
- Trigger details and alert conditions → **Culprit**
- Timeline, duration, and urgency

**On failure**: Note reason (e.g. "PagerDuty CLI not configured, PAGERDUTY_API_TOKEN not set"). Use `AskUserQuestion` to ask the user for incident details manually, then continue.
