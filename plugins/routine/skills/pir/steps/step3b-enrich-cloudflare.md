# Step 3b: Enrich with Cloudflare — Traffic Analysis

**Run via Task subagent** to isolate context.

For each incident discovered in Step 2, derive the time range from the PagerDuty created/resolved timestamps (e.g. `"2025-06-01 04:00-05:00 UTC"`). Add a buffer of ~15 minutes before and after to capture lead-up and tail.

Use the Task tool and a prompt like:

**If `$ARGUMENTS[3]` is provided** (format: `domain:zone_id`):
> Use the Skill tool to invoke "cloudflare-traffic-investigator" with args "DOMAIN ZONE_ID TIMERANGE" (split domain/zone from $ARGUMENTS[3] on `:`, TIMERANGE from incident timestamps). Then read and return the report contents from .cloudflare-traffic-investigator-tmp/report.md

**If `$ARGUMENTS[3]` is not provided**:
> Use the Skill tool to invoke "cloudflare-traffic-investigator" with args "" "" "TIMERANGE" (pass empty strings for domain/zone so the skill asks the user, but still pass the time range derived from PagerDuty). Then read and return the report contents from .cloudflare-traffic-investigator-tmp/report.md

Note: The time range is always passed from PagerDuty incident timestamps so the cloudflare-traffic-investigator skill does not need to ask the user for it. When `$ARGUMENTS[3]` is omitted, the skill will still ask the user for domain and zone ID via `AskUserQuestion`.

**Extract from report** (`.cloudflare-traffic-investigator-tmp/report.md`):
- Traffic volume and spike details → **What**
- Affected endpoints and user counts → **Who**
- JA4 fingerprints and traffic sources → **Culprit**
- Bot/WAF security assessment → **Culprit**
- Requests/second calculations → severity input

**On failure**: Note reason (e.g. "Cloudflare MCP tools not available"). Continue.
