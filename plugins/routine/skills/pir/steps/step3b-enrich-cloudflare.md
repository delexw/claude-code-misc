# Step 3b: Enrich with Cloudflare — Traffic Analysis

**Run via Task subagent** to isolate context:

Use the Task tool and a prompt like:

> Use the Skill tool to invoke "traffic-spikes-investigator". Then return the findings

**Extract from findings**:
- Traffic volume and spike details → **What**
- Affected endpoints and user counts → **Who**
- JA4 fingerprints and traffic sources
- Bot/WAF security assessment
- Requests/second calculations → severity input

**On failure**: Note reason (e.g. "Cloudflare MCP tools not available"). Continue.
