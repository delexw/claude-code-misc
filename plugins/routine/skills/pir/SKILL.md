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

Resolved during Step 1 (not provided directly):
- SINCE: UTC ISO8601 start of analysis window. Auto-derived from explicit time in QUERY or from PD incident timestamps.
- UNTIL: UTC ISO8601 end of analysis window. Auto-derived from explicit time in QUERY or from PD incident timestamps.
- PD_INCIDENT: PagerDuty incident ID detected from QUERY (triggers PD-first orchestration path).
- SERVICE_HINT: Service name extracted from PD incident (used to scope Datadog/Rollbar queries).
- TITLE_HINT: Incident title extracted from PD incident (used as Rollbar keyword search terms).

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

### Step 1: Prepare — Resolve Time Scope
See [step1-gather-date-range.md](steps/step1-gather-date-range.md)

Detects the input mode from QUERY and resolves SINCE/UNTIL:
- **PD URL/ID in QUERY** → runs pagerduty-oncall first (step 1b), extracts timestamps → sets SINCE, UNTIL, SERVICE_HINT, TITLE_HINT, PD_INCIDENT
- **Explicit time in QUERY** → parses into UTC ISO8601 SINCE/UNTIL → all four sub-skills run in parallel
- **Vague or empty QUERY** → defaults to past 24 hours → all four sub-skills run in parallel

### Step 2: Discover — PagerDuty, Datadog, Cloudflare, Rollbar

Orchestration depends on whether PD_INCIDENT was resolved in Step 1:
- **If PD_INCIDENT is set**: step 2a is skipped (data already collected). Run 2b + 2c + 2d in parallel.
- **Otherwise**: run all four (2a + 2b + 2c + 2d) in parallel.

Each sub-skill receives SINCE and UNTIL (UTC ISO8601) when available, ensuring a consistent analysis window across all data sources.

#### 2a. PagerDuty — Incidents
See [step2a-discover-incidents.md](steps/step2a-discover-incidents.md)
— Invokes `Skill("pagerduty-oncall")`. Skipped if PD_INCIDENT was resolved in Step 1b.

#### 2b. Datadog — Observability Data
See [step2b-discover-datadog.md](steps/step2b-discover-datadog.md)
— Invokes `Skill("datadog-analyser")`. Passes SINCE, UNTIL, SERVICE_HINT when available.

#### 2c. Cloudflare — Traffic Analysis
See [step2c-discover-cloudflare.md](steps/step2c-discover-cloudflare.md)
— Invokes `Skill("cloudflare-traffic-investigator")`. Passes domain and zone ID from `CF_DOMAIN_ZONE` if provided. Passes SINCE, UNTIL when available.

#### 2d. Rollbar — Error Tracking
See [step2d-discover-rollbar.md](steps/step2d-discover-rollbar.md)
— Invokes `Skill("rollbar-reader")`. Passes SINCE, UNTIL, TITLE_HINT when available.

### Step 3a: Codebase Analysis
See [step3a-codebase-analysis.md](steps/step3a-codebase-analysis.md)
— Analyses git history across working directories, correlates with incident timeline from discovery reports.

### Step 3b: Generate PIR via NotebookLM
See [step3b-generate-nlm.md](steps/step3b-generate-nlm.md)
— Runs after 3a. Creates NotebookLM notebook, uploads all discovery and codebase reports, generates report, infographic, and slide deck. Returns notebook ID.

### Step 4: Present Results
See [step4-present-results.md](steps/step4-present-results.md)
— Displays PIR summary and provides notebook link for interactive exploration. Preserves the NotebookLM notebook for further queries.