---
name: pir
description: Create Post Incident Records (PIRs) by analysing incidents discovered from PagerDuty. Orchestrates pagerduty-oncall, datadog-analyser, and traffic-spikes-investigator skills to enrich each incident with observability and traffic data, auto-determines severity, and outputs completed PIR forms. Use when asked to "create a PIR", "write a post incident record", "fill out PIR form", "incident report", "analyse incidents", or after on-call shifts need documentation.
---

# Post Incident Record (PIR)

Discover incidents from PagerDuty, enrich with Datadog and Cloudflare data, auto-determine severity, and produce completed PIR forms for each incident.

## Arguments
- `$ARGUMENTS[0]` — (optional) Start date in `YYYY-MM-DD` format. Defaults to today.
- `$ARGUMENTS[1]` — (optional) End date in `YYYY-MM-DD` format. Defaults to today.

## PIR Form Fields

Each PIR maps to these fields — see [PIR Form Fields](references/pir-form-fields.md) for format and examples:

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

Only ask the user for the **date range** if not provided in `$ARGUMENTS`. Do NOT ask about services, incident IDs, or severity — these are all derived from data.

### Step 2: Discover Incidents from PagerDuty

PagerDuty is the primary source of truth. Run it first to discover all incidents.

```
Skill("pagerduty-oncall", "$DATE_START $DATE_END")
```

**Extract from report** (`$CLAUDE_PROJECT_DIR/.pagerduty-oncall-tmp/report.md`):
- All incident IDs, titles, services, statuses
- Created/resolved timestamps → **When**, **Incident date**
- Escalation policies and responders → **Incident controller**
- Incident notes → **Remediation**
- Timeline, duration, and urgency

**On failure**: Note reason (e.g. "PagerDuty CLI not configured, PAGEDUTY_API_TOKEN not set"). Use `AskUserQuestion` to ask the user for incident details manually, then continue to enrichment.

### Step 3: Enrich with Datadog and Cloudflare

For each incident discovered in Step 2, enrich with observability and traffic data. Run both skills. If either fails, record the failure reason and continue.

#### 3a. Datadog — Observability Data

```
Skill("datadog-analyser", "incidents and errors $DATE_START to $DATE_END")
```

**Extract from report** (`$CLAUDE_PROJECT_DIR/.datadog-analyser-tmp/report.md`):
- Error rates and affected services → **What**
- User impact metrics from RUM/error tracking → **Who**
- Monitor alerts and SLO breaches → severity input
- Timeline of degradation → refine **When**
- Remediation actions visible in monitors → **Remediation**

**On failure**: Note reason (e.g. "pup CLI not installed, DD_API_KEY not set"). Continue.

#### 3b. Cloudflare — Traffic Analysis

```
Skill("traffic-spikes-investigator")
```

**Extract from findings**:
- Traffic volume and spike details → **What**
- Affected endpoints and user counts → **Who**
- JA4 fingerprints and traffic sources
- Bot/WAF security assessment
- Requests/second calculations → severity input

**On failure**: Note reason (e.g. "Cloudflare MCP tools not available"). Continue.

### Step 4: Synthesise PIR for Each Incident

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

**Severity**: Auto-classified per the severity table above.

### Step 5: Save and Present Results

Save each PIR as a separate markdown file in `$CLAUDE_PROJECT_DIR/.pir-tmp/`, using the naming convention:

```
$CLAUDE_PROJECT_DIR/.pir-tmp/
├── PIR-YYYY-MM-DD-<short-slug>.md   # One file per PIR
└── ...
```

Where `<short-slug>` is a kebab-case summary of the incident (e.g. `admin-health-check`, `web-idp-degradation`).

Each PIR file should contain:

```markdown
# PIR — [Incident Title from PagerDuty]

**Severity**: [SEV1/SEV2/SEV3 — auto-classified]

**Impact Summary**: [synthesised summary]

**What**: [feature impact description]

**Who**: [user impact with counts]

**Incident date**: [YYYY-MM-DD]

**When**: [specific time range with timezone]

**Remediation**: [mitigations applied, or "To be determined"]

**Incident controller**: [name from PagerDuty, or "Not assigned"]

---

### PagerDuty Incidents

[Table of correlated PagerDuty incident IDs, titles, urgency, timestamps, duration]

### Data Sources

- **PagerDuty**: [incident IDs, escalation policy]
- **Datadog**: [monitor IDs, key metrics]
- **Cloudflare**: [zone, key findings]
```

After writing all files, display a summary table to the user listing the files, their severity, and incident title. Include the data sources status:

```
### Data Sources
- PagerDuty: [✅ Success — N incidents found / ❌ Skipped — reason]
- Datadog: [✅ Success / ❌ Skipped — reason]
- Cloudflare: [✅ Success / ❌ Skipped — reason]
```

Inform the user of the output directory: `$CLAUDE_PROJECT_DIR/.pir-tmp/`

Ask the user to review. Offer to adjust any field or regenerate individual PIRs.
