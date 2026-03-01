---
name: pir
description: Create Post Incident Records (PIRs) by analysing incidents discovered from PagerDuty. Orchestrates pagerduty-oncall, datadog-analyser, and cloudflare-traffic-investigator skills to enrich each incident with observability and traffic data, auto-determines severity, and outputs completed PIR forms. Use when asked to "create a PIR", "write a post incident record", "fill out PIR form", "incident report", "analyse incidents", or after on-call shifts need documentation.
model: sonnet
context: fork
argument-hint: "[start-date] [end-date] [repos-list] [domain:zone-id]"
allowed-tools: Read, Bash, Write, Edit
---

# Post Incident Record (PIR)

Discover incidents from PagerDuty, enrich with Datadog and Cloudflare data, auto-determine severity, and produce completed PIR forms for each incident.

## Arguments
- `$ARGUMENTS[0]` — (optional) Start date in `YYYY-MM-DD` format. Defaults to today.
- `$ARGUMENTS[1]` — (optional) End date in `YYYY-MM-DD` format. Defaults to today.
- `$ARGUMENTS[2]` — (optional) Comma-separated local repo paths for codebase root cause analysis (e.g. `~/repos/frontend,~/repos/backend`).
- `$ARGUMENTS[3]` — (optional) Cloudflare domain and zone ID in `domain:zone_id` format (e.g. `example.com:abc123def456`). Passed to the `cloudflare-traffic-investigator` skill. If not provided, the cloudflare skill will ask the user.

## PIR Form Fields

Each PIR maps to these fields — see [PIR Form Fields](references/pir-form-fields.md) for format, examples, and output template:

| Field | Required | Source |
|-------|----------|--------|
| Impact Summary | Yes | Synthesised from all skills |
| What | Yes | PagerDuty incident + Datadog + Cloudflare |
| Who | Yes | Datadog (RUM/error tracking) + Cloudflare (user counts) |
| Culprit | Yes | Cloudflare (JA4, traffic sources) + Datadog (error traces) + PagerDuty (trigger details) + Codebase analysis (culprit commits) |
| Incident date | Yes | PagerDuty incident created timestamp |
| When | Yes | PagerDuty created/resolved + Datadog timeline |
| Remediation | Optional | PagerDuty notes + Datadog monitors |
| Incident controller | Optional | PagerDuty escalation policy responders |

## Severity Auto-Classification

Determine severity from the collected data — do NOT ask the user:

| Severity | Criteria |
|----------|----------|
| **SEV1** | Service outage or >50% error rate on critical path; cascading failures; >30 min duration |
| **SEV2** | Partial degradation; 10-50% error rate; single service affected; 10-30 min duration |
| **SEV3** | Minor impact; <10% error rate; brief spike (<10 min); limited user impact |

Use the highest applicable severity when multiple criteria match.

## Execution

### Step 1: Gather Date Range
See [step1-gather-date-range.md](steps/step1-gather-date-range.md)

### Step 2: Discover Incidents from PagerDuty *(Task subagent)*
See [step2-discover-incidents.md](steps/step2-discover-incidents.md)
— Runs `Skill("pagerduty-oncall")` via a Task subagent to isolate context.

### Step 3: Enrich with Datadog and Cloudflare

Run 3a and 3b in parallel using Task subagents:

#### 3a. Datadog *(Task subagent)*
See [step3a-enrich-datadog.md](steps/step3a-enrich-datadog.md)
— Runs `Skill("datadog-analyser")` via a Task subagent.

#### 3b. Cloudflare *(Task subagent)*
See [step3b-enrich-cloudflare.md](steps/step3b-enrich-cloudflare.md)
— Runs `Skill("cloudflare-traffic-investigator")` via a Task subagent. Passes domain and zone ID from `$ARGUMENTS[3]` if provided.

### Step 4: Codebase Analysis *(Task subagent, conditional)*
See [step4-codebase-analysis.md](steps/step4-codebase-analysis.md)
— Only runs when `$ARGUMENTS[2]` (repos list) is provided. Investigates recent commits on `origin/main` to identify culprit code changes. Saves findings to `.codebase-analysis-tmp/report.md`.

### Step 5: Synthesise PIR for Each Incident
See [step5-synthesise-pir.md](steps/step5-synthesise-pir.md)

### Step 6: Save and Present Results
See [step6-save-and-present.md](steps/step6-save-and-present.md)

<tags>
   <mode>think</mode>
   <custom>yes</custom>
</tags>
