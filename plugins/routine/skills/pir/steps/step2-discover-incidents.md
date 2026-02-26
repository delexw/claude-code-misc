# Step 2: Discover Incidents from PagerDuty

PagerDuty is the primary source of truth. Run it first to discover all incidents.

**Run via Task subagent** to isolate context:

Use the Task tool and a prompt like:

> Use the Skill tool to invoke "pagerduty-oncall" with args "$ARGUMENTS[0] $ARGUMENTS[1]". Then read and return the report contents from $CLAUDE_PROJECT_DIR/.pagerduty-oncall-tmp/report.md

**Extract from report** (`$CLAUDE_PROJECT_DIR/.pagerduty-oncall-tmp/report.md`):
- All incident IDs, titles, services, statuses
- Created/resolved timestamps → **When**, **Incident date**
- Escalation policies and responders → **Incident controller**
- Incident notes → **Remediation**
- Trigger details and alert conditions → **Culprit**
- Timeline, duration, and urgency

**On failure**: Note reason (e.g. "PagerDuty CLI not configured, PAGEDUTY_API_TOKEN not set"). Use `AskUserQuestion` to ask the user for incident details manually, then continue to enrichment.
