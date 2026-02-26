# Step 3a: Enrich with Datadog — Observability Data

**Run via Task subagent** to isolate context:

Use the Task tool and a prompt like:

> Use the Skill tool to invoke "datadog-analyser" with args "incidents and errors $ARGUMENTS[0] to $ARGUMENTS[1]". Then read and return the report contents from $CLAUDE_PROJECT_DIR/.datadog-analyser-tmp/report.md

**Extract from report** (`$CLAUDE_PROJECT_DIR/.datadog-analyser-tmp/report.md`):
- Error rates and affected services → **What**
- User impact metrics from RUM/error tracking → **Who**
- Monitor alerts and SLO breaches → severity input
- Timeline of degradation → refine **When**
- Remediation actions visible in monitors → **Remediation**

**On failure**: Note reason (e.g. "pup CLI not installed, DD_API_KEY not set"). Continue.
