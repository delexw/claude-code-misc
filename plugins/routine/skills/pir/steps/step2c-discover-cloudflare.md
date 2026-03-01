# Step 2c: Discover from Cloudflare — Traffic Analysis

**Run via Task subagent** to isolate context.

This step runs concurrently with PagerDuty and Datadog discovery. Use the date range from `$ARGUMENTS[0]` and `$ARGUMENTS[1]` to query Cloudflare traffic for the full date range.

Use the Task tool and a prompt like:

**If `$ARGUMENTS[3]` is provided** (format: `domain:zone_id`):
> Use the Skill tool to invoke "cloudflare-traffic-investigator" with args "DOMAIN ZONE_ID TIMERANGE" (split domain/zone from $ARGUMENTS[3] on `:`, TIMERANGE covers $ARGUMENTS[0] to $ARGUMENTS[1]). Then read and return the report contents from .cloudflare-traffic-investigator-tmp/report.md

**If `$ARGUMENTS[3]` is not provided**:
> Use the Skill tool to invoke "cloudflare-traffic-investigator" with args "" "" "TIMERANGE" (pass empty strings for domain/zone so the skill asks the user, TIMERANGE covers $ARGUMENTS[0] to $ARGUMENTS[1]). Then read and return the report contents from .cloudflare-traffic-investigator-tmp/report.md

Note: The time range covers the full date range from arguments since this step runs in parallel with PagerDuty discovery and PagerDuty incident timestamps are not yet available. When `$ARGUMENTS[3]` is omitted, the skill will still ask the user for domain and zone ID via `AskUserQuestion`.

**Extract from report** (`.cloudflare-traffic-investigator-tmp/report.md`):
- Traffic volume and spike details → **What**
- Affected endpoints and user counts → **Who**
- JA4 fingerprints and traffic sources → **Culprit**
- Bot/WAF security assessment → **Culprit**
- Requests/second calculations → severity input

**On failure**: Note reason (e.g. "Cloudflare MCP tools not available"). Continue.
