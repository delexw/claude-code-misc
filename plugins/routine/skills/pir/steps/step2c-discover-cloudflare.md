# Step 2c: Discover from Cloudflare — Traffic Analysis

This step runs concurrently with PagerDuty, Datadog, and Rollbar discovery.

**If `CF_DOMAIN_ZONE` is provided** (format: `domain:zone_id`):
> Use the Skill tool to invoke "cloudflare-traffic-investigator" with args "DOMAIN ZONE_ID QUERY" (split domain/zone from CF_DOMAIN_ZONE on `:`). Then read and return the report contents from .cloudflare-traffic-investigator-tmp/report.md

**If `CF_DOMAIN_ZONE` is not provided**:
> Use the Skill tool to invoke "cloudflare-traffic-investigator" with args "" "" "QUERY" (pass empty strings for domain/zone so the skill asks the user). Then read and return the report contents from .cloudflare-traffic-investigator-tmp/report.md

**Extract from report** (`.cloudflare-traffic-investigator-tmp/report.md`):
- Traffic volume and spike details → **What**
- Affected endpoints and user counts → **Who**
- JA4 fingerprints and traffic sources → **Culprit**
- Bot/WAF security assessment → **Culprit**
- Requests/second calculations → severity input

**On failure**: Note reason (e.g. "Cloudflare MCP tools not available"). Use `AskUserQuestion` to ask the user for traffic analysis details manually (e.g. traffic patterns, affected endpoints, suspicious sources), then continue.
