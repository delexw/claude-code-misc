# Step 3b: Enrich with Cloudflare — Traffic Analysis

**Run via Task subagent** to isolate context:

Use the Task tool and a prompt like:

**If `$ARGUMENTS[3]` is provided** (format: `domain:zone_id`):
> Use the Skill tool to invoke "cloudflare-traffic-investigator" with args "DOMAIN ZONE_ID" (split from $ARGUMENTS[3] on `:`) . Then read and return the report contents from .cloudflare-traffic-investigator-tmp/report.md

**If `$ARGUMENTS[3]` is not provided**:
> Use the Skill tool to invoke "cloudflare-traffic-investigator". Then read and return the report contents from .cloudflare-traffic-investigator-tmp/report.md

Note: When `$ARGUMENTS[3]` is omitted, the cloudflare-traffic-investigator skill will ask the user for domain and zone ID via `AskUserQuestion`.

**Extract from report** (`.cloudflare-traffic-investigator-tmp/report.md`):
- Traffic volume and spike details → **What**
- Affected endpoints and user counts → **Who**
- JA4 fingerprints and traffic sources → **Culprit**
- Bot/WAF security assessment → **Culprit**
- Requests/second calculations → severity input

**On failure**: Note reason (e.g. "Cloudflare MCP tools not available"). Continue.
