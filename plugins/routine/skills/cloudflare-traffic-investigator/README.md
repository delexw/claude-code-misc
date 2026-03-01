# Cloudflare Traffic Investigator

A Claude Code skill for investigating traffic anomalies on Cloudflare-protected domains that may cause downstream service failures.

## Overview

This skill automates the investigation process when unusual traffic patterns cause service degradation. It uses Cloudflare MCP tools to analyze traffic via GraphQL analytics, identify root causes through JA4 fingerprint analysis and security scoring, map affected endpoints to service dependencies in your codebase, and generate structured incident reports.

## What This Skill Does

1. Collects investigation parameters (time range, timezone)
2. Confirms traffic anomalies using Cloudflare hourly and minute-level analytics
3. Requests APM error traces from the user (sorted by time desc)
4. Discovers culprit JA4 TLS fingerprints dynamically from Cloudflare
5. Analyzes traffic sources — paths, user IDs, ASNs for top JA4s
6. Verifies traffic legitimacy — bot scores, WAF attack scores, User-Agent strings
7. Extracts user patterns — identifies users or services causing excess load
8. Maps endpoints to code — traces request flows through backend codebase
9. Calculates service load — determines req/sec to understand capacity issues
10. Generates an incident report with security analysis, APM traces, code paths, and recommendations

## When Claude Will Use This Skill

Claude activates this skill when you:
- Report unusual traffic spikes or service degradation
- Mention 429 errors, circuit breakers, or service overload
- Ask to investigate Cloudflare analytics data
- Reference domain performance issues
- Mention APM errors correlated with traffic patterns
- Ask about specific endpoints or user behavior causing load

## Structure

```
cloudflare-traffic-investigator/
├── SKILL.md                              # Core workflow, key concepts, escalation criteria
├── README.md                             # This file
├── steps/                                # Individual investigation steps (loaded on demand)
│   ├── step-01-get-parameters.md
│   ├── step-02-confirm-spike.md
│   ├── step-03-minute-detail.md
│   ├── step-04-apm-traces.md
│   ├── step-05-identify-ja4.md
│   ├── step-06-analyze-traffic.md
│   ├── step-07-verify-legitimacy.md
│   ├── step-08-extract-users.md
│   ├── step-09-map-and-calculate.md      # Code mapping + load calculation
│   └── step-10-synthesize.md             # Final report generation
└── references/                           # Detailed reference material (loaded when needed)
    ├── cloudflare-api-mcp.md             # Cloudflare API MCP usage patterns
    ├── known-fingerprints.json           # Pre-verified legitimate JA4 fingerprints
    ├── security-scores.md                # Bot & WAF score interpretation
    ├── failure-patterns.md               # Common failure patterns & resolutions
    └── incident-report-template.md       # Complete incident report template
```

**Design:** Progressive disclosure. SKILL.md contains the workflow overview and key concepts. Each step is in its own file loaded only when needed, optimizing context usage.

## Prerequisites

- Cloudflare API token with Analytics Read permission
- APM dashboard access (e.g., Datadog, New Relic, Honeycomb)
- Repository access to your backend codebase
- Claude Code with `cloudflare-api` MCP server configured

## Zone Configuration

Pass domain and zone ID as arguments when invoking the skill, or the skill will ask the user.

## Maintenance

- **Core workflow**: Edit `SKILL.md`
- **Individual steps**: Edit files in `steps/`
- **Cloudflare API usage**: Edit `references/cloudflare-api-mcp.md`
- **Security scoring**: Edit `references/security-scores.md`
- **Failure patterns**: Edit `references/failure-patterns.md`
- **Incident template**: Edit `references/incident-report-template.md`
- **Known fingerprints**: Edit `references/known-fingerprints.json`
