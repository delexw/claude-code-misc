---
name: pir
description: Create Post Incident Records (PIRs) by analysing incidents discovered from PagerDuty. Orchestrates pagerduty-oncall, datadog-analyser, and traffic-spikes-investigator skills to enrich each incident with observability and traffic data, auto-determines severity, and outputs completed PIR forms. Use when asked to "create a PIR", "write a post incident record", "fill out PIR form", "incident report", "analyse incidents", or after on-call shifts need documentation.
model: sonnet
context: fork
---

# Post Incident Record (PIR)

Discover incidents from PagerDuty, enrich with Datadog and Cloudflare data, auto-determine severity, and produce completed PIR forms for each incident.

## Arguments
- `$ARGUMENTS[0]` — (optional) Start date in `YYYY-MM-DD` format. Defaults to today.
- `$ARGUMENTS[1]` — (optional) End date in `YYYY-MM-DD` format. Defaults to today.

## PIR Form Fields

Each PIR maps to these fields — see [PIR Form Fields](references/pir-form-fields.md) for format, examples, and output template:

| Field | Required | Source |
|-------|----------|--------|
| Impact Summary | Yes | Synthesised from all skills |
| What | Yes | PagerDuty incident + Datadog + Cloudflare |
| Who | Yes | Datadog (RUM/error tracking) + Cloudflare (user counts) |
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
— Runs `Skill("traffic-spikes-investigator")` via a Task subagent.

### Step 4: Synthesise PIR for Each Incident
See [step4-synthesise-pir.md](steps/step4-synthesise-pir.md)

### Step 5: Save and Present Results
See [step5-save-and-present.md](steps/step5-save-and-present.md)

<tags>
   <mode>think</mode>
   <custom>yes</custom>
</tags>
