# Step 4: Synthesise PIR for Each Incident

For each PagerDuty incident, combine enrichment data and produce a PIR. Correlate Datadog/Cloudflare data to the incident by matching time windows and service names.

**Impact Summary**: Concise 1-2 sentence title.
- Pattern: `"[Service/Feature] [failure type] for [duration] affecting [user scope]"`

**What**: Which feature was impacted and how, combining:
- PagerDuty: incident title, service name, triggered alerts
- Datadog: error types, status codes, failing services
- Cloudflare: traffic patterns, affected endpoints

**Who**: Which users and how many, using:
- Cloudflare: unique user counts from sampled data (note sampling)
- Datadog: RUM sessions, error tracking affected users
- If no precise count, estimate and note the method

**Incident date**: PagerDuty incident created date (`YYYY-MM-DD`).

**When**: Specific time range with timezone.
- Format: `"YYYY-MM-DD HH:MM - HH:MM TZ (HH:MM - HH:MM UTC)"`
- Boundaries from PagerDuty created/resolved, refined by Datadog error timeline

**Remediation**: Mitigations applied from PagerDuty notes, Datadog monitor changes, Cloudflare WAF rules. If none found, output "To be determined".

**Incident controller**: From PagerDuty escalation policy responders. Note: mandatory for SEV1 and SEV2.

**Severity**: Auto-classified per the severity table in SKILL.md.
