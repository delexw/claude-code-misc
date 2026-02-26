# Step 3b: Enrich with Cloudflare — Traffic Analysis

**Run via Task subagent** to isolate context:

Use the Task tool and a prompt like:

> Use the Skill tool to invoke "traffic-spikes-investigator". Then read and return the report contents from $CLAUDE_PROJECT_DIR/.traffic-spikes-investigator-tmp/report.md

**Extract from report** (`$CLAUDE_PROJECT_DIR/.traffic-spikes-investigator-tmp/report.md`):
- Traffic volume and spike details → **What**
- Affected endpoints and user counts → **Who**
- JA4 fingerprints and traffic sources
- Bot/WAF security assessment
- Requests/second calculations → severity input

**On failure**: Note reason (e.g. "Cloudflare MCP tools not available"). Continue.
