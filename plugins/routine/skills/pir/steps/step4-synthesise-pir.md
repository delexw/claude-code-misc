# Step 4: Synthesise PIR for Each Issue

Produce a PIR for each distinct issue identified across all four discovery sources (PagerDuty incidents, Datadog abnormalities, Cloudflare traffic anomalies, Rollbar errors). Correlate findings across sources by matching time windows and service names — a single issue may have signals in multiple sources. Deduplicate where the same underlying issue appears in more than one source. If `.codebase-analysis-tmp/report.md` exists, read it and incorporate findings.

**Impact Summary**: Concise 1-2 sentence title.
- Pattern: `"[Service/Feature] [failure type] for [duration] affecting [user scope]"`

**What**: Which feature was impacted and how, combining:
- PagerDuty: incident title, service name, triggered alerts
- Datadog: error types, status codes, failing services, abnormal monitors, SLO breaches
- Cloudflare: traffic patterns, affected endpoints, traffic anomalies
- Rollbar: active error items, occurrence counts, affected environments

**Who**: Which users and how many, using:
- Cloudflare: unique user counts from sampled data (note sampling)
- Datadog: RUM sessions, error tracking affected users
- If no precise count, estimate and note the method

**Culprit**: Root cause or trigger source, combining:
- Codebase analysis: culprit commits, specific file/code references, deploy correlation (from `.codebase-analysis-tmp/report.md` if available)
- Rollbar: stack traces, error-to-deploy correlation, error patterns
- Cloudflare: JA4 fingerprints, traffic sources, bot activity, IP ranges
- Datadog: error traces, failing dependencies, upstream service failures
- PagerDuty: trigger details, alert conditions
- If codebase analysis identified high-confidence culprit commits, lead with those and reference the specific commit hash, file, and code change
- If root cause is unclear, state what is known and note "Under investigation"

**Incident date**: Date the issue first appeared (`YYYY-MM-DD`), from whichever source detected it earliest.

**When**: Specific time range in current agent's local timezone (detect via system clock).
- Format: `"YYYY-MM-DD HH:MM - HH:MM TZ"`
- Boundaries from the earliest signal (PagerDuty created, Datadog error spike, Cloudflare traffic anomaly, or Rollbar error first seen) to resolution or end of observation window

**Remediation**: Mitigations applied from PagerDuty notes, Datadog monitor changes, Cloudflare WAF rules, Rollbar item resolutions. If none found, output "To be determined".

**Incident controller**: From PagerDuty escalation policy responders (if a PagerDuty incident exists for this issue). Note: mandatory for SEV1 and SEV2.

**Severity**: Auto-classified per the severity table in SKILL.md.
