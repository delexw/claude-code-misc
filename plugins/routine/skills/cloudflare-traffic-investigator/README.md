# Cloudflare Traffic Investigator

A Claude Code skill for investigating traffic anomalies on Cloudflare-protected domains that may cause downstream service failures.

## Overview

This skill automates the investigation process when unusual traffic patterns cause service degradation. It uses the `cloudflare-mcp-cli` CLI tool to analyze traffic via GraphQL analytics, identify root causes through JA4 fingerprint analysis and security scoring, and generate structured incident reports.

## What This Skill Does

1. Collects investigation parameters (time range, timezone)
2. Confirms traffic anomalies using Cloudflare hourly and minute-level analytics
3. Discovers culprit JA4 TLS fingerprints dynamically from Cloudflare
4. Analyzes traffic sources — paths, user IDs, ASNs for top JA4s
5. Verifies traffic legitimacy — bot scores, WAF attack scores, User-Agent strings
6. Extracts user patterns — identifies users or services causing excess load
7. Generates an incident report with security analysis and recommendations

## When Claude Will Use This Skill

Claude activates this skill when you:
- Report unusual traffic spikes or service degradation
- Mention 429 errors, circuit breakers, or service overload
- Ask to investigate Cloudflare analytics data
- Reference domain performance issues
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
│   ├── step-04-identify-ja4.md
│   ├── step-05-analyze-traffic.md
│   ├── step-06-verify-legitimacy.md
│   ├── step-07-extract-users.md
│   └── step-08-synthesize.md             # Final report generation
└── references/                           # Detailed reference material (loaded when needed)
    ├── cloudflare-api-cli.md             # Cloudflare API CLI usage patterns
    ├── security-scores.md                # Bot & WAF score interpretation
    ├── failure-patterns.md               # Common failure patterns & resolutions
    └── incident-report-template.md       # Complete incident report template
```

**Design:** Progressive disclosure. SKILL.md contains the workflow overview and key concepts. Each step is in its own file loaded only when needed, optimizing context usage.

## Prerequisites

- `cloudflare-mcp-cli` CLI installed (`npm install -g cloudflare-mcp-cli`)
- Cloudflare API token configured via `cloudflare-mcp-cli config set-token <token>`

## Zone Configuration

Pass domain and zone ID as arguments when invoking the skill, or the skill will ask the user.

## Maintenance

- **Core workflow**: Edit `SKILL.md`
- **Individual steps**: Edit files in `steps/`
- **Cloudflare API usage**: Edit `references/cloudflare-api-cli.md`
- **Security scoring**: Edit `references/security-scores.md`
- **Failure patterns**: Edit `references/failure-patterns.md`
- **Incident template**: Edit `references/incident-report-template.md`
