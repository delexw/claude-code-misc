---
name: cloudflare-traffic-investigator
description: Investigate traffic anomalies, spikes, and service degradation on Cloudflare-protected domains. Uses Cloudflare MCP tools for GraphQL analytics, JA4 fingerprint analysis, bot/WAF security scoring, and incident reporting. Use this skill whenever traffic spikes, service overloads, 429 errors, circuit breaker events, Cloudflare analytics, or domain performance issues are mentioned — even if the user doesn't explicitly say "traffic spike". Also triggers for APM error investigation correlated with traffic patterns, or when asked to check Cloudflare data for any domain.
allowed-tools: mcp__cloudflare-api__search, mcp__cloudflare-api__execute, Read, Bash, Write, Edit
argument-hint: "[domain] [zone-id]"
model: sonnet
context: fork
---

# Investigating Traffic on Cloudflare-Protected Domains

## Arguments

| Argument | Description |
|----------|-------------|
| `$ARGUMENTS[0]` | Cloudflare-protected domain to investigate (e.g., `example.com`) |
| `$ARGUMENTS[1]` | Cloudflare zone ID for the domain (e.g., `abc123def456`) |

If any argument is not provided, ask the user via `AskUserQuestion`.

---

Investigate unusual traffic patterns on Cloudflare-protected domains that cause downstream service failures (e.g., service overload, database saturation, API rate limiting). This skill walks through a structured investigation from confirming the spike through to a full incident report.

## Investigation Workflow

Follow these steps in order. Each step file contains detailed instructions and example Cloudflare GraphQL queries.

1. **[Get parameters](steps/step-01-get-parameters.md)** — Collect time range and zone info
2. **[Confirm spike](steps/step-02-confirm-spike.md)** — Query hourly traffic to verify the anomaly
3. **[Minute-level detail](steps/step-03-minute-detail.md)** — Narrow to exact spike timing
4. **[Request APM traces](steps/step-04-apm-traces.md)** — Ask user for APM errors (sorted by time desc)
5. **[Identify culprit JA4](steps/step-05-identify-ja4.md)** — Find JA4 fingerprints with highest request counts
6. **[Analyze traffic](steps/step-06-analyze-traffic.md)** — For top JA4s, identify paths, user IDs, ASNs
7. **[Verify legitimacy](steps/step-07-verify-legitimacy.md)** — Check bot scores, WAF scores, User-Agent
8. **[Extract top users](steps/step-08-extract-users.md)** — Find which users made the most requests
9. **[Map to code & calculate load](steps/step-09-map-and-calculate.md)** — Connect endpoints to service dependencies, compute req/sec
10. **[Synthesize & report](steps/step-10-synthesize.md)** — Combine findings into an incident report

## Cloudflare API MCP

All Cloudflare interactions use two tools:
- `mcp__cloudflare-api__search` — Discover API endpoints by searching the OpenAPI spec
- `mcp__cloudflare-api__execute` — Execute API calls via `cloudflare.request()` (GraphQL analytics via POST to `/graphql`, Radar via REST, zone operations via `/zones`)

See **[Cloudflare API MCP Reference](references/cloudflare-api-mcp.md)** for query patterns and examples.

## Time Zone Handling

Always present times in the current agent timezone. Convert user-provided times to UTC for Cloudflare queries, then convert results back for display.

## JA4 TLS Fingerprints

- Format: `t13d311200_e8f1e7e78f70_d339722ba4af`
- A single fingerprint across millions of requests indicates backend service configuration, not individual users
- Useful for identifying automated/service-to-service traffic
- Cross-reference with [Known Fingerprints](references/known-fingerprints.json) before flagging as unknown

## Cloudflare Sampled Data

Firewall events use **adaptive sampling**. Numbers are sampled counts, not actual totals. Use them for pattern identification and relative comparisons — top users in sample likely represent top users overall. Always note this in reports.

## Common Failure Patterns

Quickly identify root causes using these patterns:

| Pattern | Signal | Resolution |
|---------|--------|------------|
| Circuit Breaker Cascade | 429 → timeout → breaker opens | Scale service or add rate limiting |
| Retry Storm | Error count exceeds initial traffic | Add exponential backoff, client-side circuit breaker |
| Single User Amplification | One user dominates request count | Contact user, fix frontend logic |
| Undersized Service | Normal distribution, fails at <10 req/sec | Scale service capacity urgently |
| Cascading Failure | Multiple services failing sequentially | Isolate fault, restart root service |
| Cache Stampede | Spike after cache expiration | Cache lock, stale-while-revalidate |

**Detailed descriptions and resolution steps:** [Failure Patterns Reference](references/failure-patterns.md)

## Escalation Criteria

| Priority | Condition |
|----------|-----------|
| **P1 — Immediate** | Service 429 errors / circuit breaker open, >10% error rate, cascading failures |
| **P2 — High** | Single user >500 req/hour on critical endpoint, sustained spike >50% above baseline, multiple dependencies affected |
| **P3 — Monitor** | Moderate increase <50% above baseline, isolated user anomalies |

## Incident Report

Document findings using the **[Incident Report Template](references/incident-report-template.md)** covering metrics, timeline, security analysis, APM errors, root cause, and recommendations.

## Tips

- Ask for time range first using `AskUserQuestion` if not provided
- Request APM traces early — after confirming the spike, ask for APM errors (sorted by time desc)
- Ask for codebase path when you need to analyze code (Step 9)
- Identify JA4 dynamically — query Cloudflare, don't assume
- Only ask the user about unknown/suspicious User-Agents — skip well-known bots and clearly internal services
- Cross-reference APM errors with Cloudflare paths and code analysis
- Focus on the endpoint calling the failing service, not just high-traffic endpoints
- Calculate actual req/sec to understand service load
- Document findings immediately using the incident template

## Reference Files

**Steps:** [1](steps/step-01-get-parameters.md) · [2](steps/step-02-confirm-spike.md) · [3](steps/step-03-minute-detail.md) · [4](steps/step-04-apm-traces.md) · [5](steps/step-05-identify-ja4.md) · [6](steps/step-06-analyze-traffic.md) · [7](steps/step-07-verify-legitimacy.md) · [8](steps/step-08-extract-users.md) · [9](steps/step-09-map-and-calculate.md) · [10](steps/step-10-synthesize.md)

**References:** [Cloudflare API MCP](references/cloudflare-api-mcp.md) · [Known Fingerprints](references/known-fingerprints.json) · [Security Scores](references/security-scores.md) · [Failure Patterns](references/failure-patterns.md) · [Incident Report Template](references/incident-report-template.md)
