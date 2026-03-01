# Step 10: Synthesize Findings & Generate Report

Combine all data from previous steps into a coherent narrative and incident report.

## Data to synthesize

| Source | Steps | Key data |
|--------|-------|----------|
| Traffic spike | 2-3 | Total volume, timing, duration |
| APM errors | 4 | Service failures, error types, stack traces |
| Culprit source | 5 | JA4 fingerprint and request count |
| Affected paths | 6 | Which endpoints were hit |
| Traffic legitimacy | 7 | Bot & WAF scores, security assessment |
| Top users | 8 | Who made the most requests |
| Code analysis | 9A | Service dependencies and failure points |
| Service load | 9B | Requests/second to failing services |

## Determine root cause

Match the evidence to a [failure pattern](../references/failure-patterns.md):

- Low req/sec causes failure → Undersized Service (Pattern 4)
- Specific users dominate → Single User Amplification (Pattern 3)
- Single JA4 across millions of requests → backend misconfiguration
- Error count exceeds initial traffic → Retry Storm (Pattern 2)
- 429 → timeout → circuit breaker → Circuit Breaker Cascade (Pattern 1)
- Multiple services failing sequentially → Cascading Failure (Pattern 5)
- APM error timing should align with traffic spike timing

## Generate report

Write the incident report using the **[Incident Report Template](../references/incident-report-template.md)**.

Save to: `.cloudflare-traffic-investigator-tmp/report.md`

Present a summary to the user highlighting:
1. Root cause and failure pattern
2. Key metrics (traffic volume, error rate, req/sec)
3. Top recommendations (immediate, short-term, long-term)
