# Step 2b: Discover from Datadog — Observability Data

Build args and invoke the skill:

- If SINCE, UNTIL, and SERVICE_HINT are all set:
  `Skill("datadog-analyser")` with args `"QUERY --since SINCE --until UNTIL --service SERVICE_HINT"`
- If SINCE and UNTIL are set (no SERVICE_HINT):
  `Skill("datadog-analyser")` with args `"QUERY --since SINCE --until UNTIL"`
- Otherwise:
  `Skill("datadog-analyser")` with args `"QUERY"`

Then read and return the report contents from `.datadog-analyser-tmp/report.md`

**Extract from report** (`.datadog-analyser-tmp/report.md`):
- Error rates and affected services → **What**
- User impact metrics from RUM/error tracking → **Who**
- Monitor alerts and SLO breaches → severity input
- Timeline of degradation → refine **When**
- Error traces, failing dependencies → **Culprit**
- Remediation actions visible in monitors → **Remediation**

**On failure**: Note reason (e.g. "pup CLI not installed, DD_API_KEY not set"). Use `AskUserQuestion` to ask the user for observability details manually (e.g. error rates, affected services, monitor alerts), then continue.
