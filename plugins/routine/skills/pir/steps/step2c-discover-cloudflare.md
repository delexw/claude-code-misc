# Step 2c: Discover from Cloudflare — Traffic Analysis

This step runs concurrently with PagerDuty, Datadog, and Rollbar discovery.

Build args based on available inputs:

**Base domain/zone args** (from CF_DOMAIN_ZONE if provided, else empty strings):
- Split CF_DOMAIN_ZONE on `:` to get DOMAIN and ZONE_ID
- If not provided, pass `""` `""` so the skill prompts the user

**Time args** (append when SINCE and UNTIL are set):
- Append `--since SINCE --until UNTIL` to pass the UTC ISO8601 window

**Invocation:**

- If CF_DOMAIN_ZONE and SINCE/UNTIL are set:
  `Skill("cloudflare-traffic-investigator")` with args `"DOMAIN ZONE_ID QUERY --since SINCE --until UNTIL"`
- If CF_DOMAIN_ZONE is set (no explicit time):
  `Skill("cloudflare-traffic-investigator")` with args `"DOMAIN ZONE_ID QUERY"`
- If SINCE/UNTIL are set (no CF_DOMAIN_ZONE):
  `Skill("cloudflare-traffic-investigator")` with args `"" "" QUERY --since SINCE --until UNTIL"`
- Otherwise:
  `Skill("cloudflare-traffic-investigator")` with args `"" "" QUERY"`

Then read and return the report contents from `.cloudflare-traffic-investigator-tmp/report.md`

**Extract from report** (`.cloudflare-traffic-investigator-tmp/report.md`):
- Traffic volume and spike details → **What**
- Affected endpoints and user counts → **Who**
- JA4 fingerprints and traffic sources → **Culprit**
- Bot/WAF security assessment → **Culprit**
- Requests/second calculations → severity input

**On failure**: Note reason (e.g. "Cloudflare MCP tools not available"). Use `AskUserQuestion` to ask the user for traffic analysis details manually (e.g. traffic patterns, affected endpoints, suspicious sources), then continue.
