---
name: pir
description: Create Post Incident Records (PIRs) by discovering issues from PagerDuty, Datadog, Cloudflare, and Rollbar concurrently. Orchestrates pagerduty-oncall, datadog-analyser, cloudflare-traffic-investigator, and rollbar-reader skills, auto-determines severity, and outputs completed PIR forms. Use when asked to "create a PIR", "write a post incident record", "fill out PIR form", "incident report", "analyse incidents", or after on-call shifts need documentation.
model: sonnet
context: fork
argument-hint: <what to investigate>
allowed-tools: Read, Bash, Write, Edit
---

# Post Incident Record (PIR)

Discover issues from PagerDuty, Datadog, Cloudflare, and Rollbar concurrently, auto-determine severity, and produce completed PIR forms for each issue.

## Inputs

Raw arguments: $ARGUMENTS

Infer from the arguments:
- QUERY: what to investigate. Passed directly to each sub-skill. Defaults to "incidents today".
- CF_DOMAIN_ZONE: (optional) Cloudflare domain and zone ID in domain:zone_id format. Passed to the cloudflare-traffic-investigator skill. If not provided, the cloudflare skill will ask the user.

## PIR Form Fields

Each PIR maps to these fields — see [PIR Form Fields](references/pir-form-fields.md) for format, examples, and output template:

| Field | Required | Source |
|-------|----------|--------|
| Impact Summary | Yes | Synthesised from all skills |
| What | Yes | PagerDuty incident + Datadog + Cloudflare |
| Who | Yes | Datadog (RUM/error tracking) + Cloudflare (user counts) |
| Culprit | Yes | Cloudflare (JA4, traffic sources) + Datadog (error traces) + Rollbar (stack traces, error-deploy correlation) + PagerDuty (trigger details) + Codebase analysis (culprit commits) |
| Incident date | Yes | Earliest detection across all sources (PagerDuty, Datadog, Cloudflare) |
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

### Step 1: Prepare
See [step1-gather-date-range.md](steps/step1-gather-date-range.md)
— If `QUERY` is empty, ask the user what to investigate. Otherwise proceed directly.

### Step 2: Discover — PagerDuty, Datadog, Cloudflare, Rollbar

Run all four in parallel (each sub-skill uses `context: fork` for isolation):

#### 2a. PagerDuty — Incidents
See [step2a-discover-incidents.md](steps/step2a-discover-incidents.md)
— Invokes `Skill("pagerduty-oncall")`.

#### 2b. Datadog — Observability Data
See [step2b-discover-datadog.md](steps/step2b-discover-datadog.md)
— Invokes `Skill("datadog-analyser")`.

#### 2c. Cloudflare — Traffic Analysis
See [step2c-discover-cloudflare.md](steps/step2c-discover-cloudflare.md)
— Invokes `Skill("cloudflare-traffic-investigator")`. Passes domain and zone ID from `CF_DOMAIN_ZONE` if provided.

#### 2d. Rollbar — Error Tracking
See [step2d-discover-rollbar.md](steps/step2d-discover-rollbar.md)
— Invokes `Skill("rollbar-reader")`.

### Step 3a: Codebase Analysis
See [step3a-codebase-analysis.md](steps/step3a-codebase-analysis.md)
— Task subagent. Analyses git history across working directories, correlates with incident timeline from discovery reports.

### Step 3b: Generate PIR via NotebookLM
See [step3b-generate-nlm.md](steps/step3b-generate-nlm.md)
— Task subagent. Runs after 3a. Creates NotebookLM notebook, uploads all discovery and codebase reports, generates report, infographic, and slide deck. Returns notebook ID.

### Step 4: Present Results and Clean Up
See [step4-present-results.md](steps/step4-present-results.md)
— Displays PIR summary, provides notebook link for interactive exploration, cleans up temporary discovery folders. Preserves the NotebookLM notebook for further queries.