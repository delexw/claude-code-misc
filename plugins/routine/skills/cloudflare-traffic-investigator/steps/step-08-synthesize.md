# Step 8: Synthesize Findings & Generate Report

Combine all data from previous steps into a coherent narrative and incident report.

## Data to synthesize

| Source | Steps | Key data |
|--------|-------|----------|
| Traffic spike | 2-3 | Total volume, timing, duration |
| Culprit source | 4 | JA4 fingerprint and request count |
| Affected paths | 5 | Which endpoints were hit |
| Traffic legitimacy | 6 | Bot & WAF scores, security assessment |
| Rules inventory | 6b | Active WAF rules, rate limits, page rules, identified gaps |
| Top users | 7 | Who made the most requests |

## Determine root cause

Match the evidence to a [failure pattern](../references/failure-patterns.md):

- Specific users dominate → Single User Amplification (Pattern 3)
- Single JA4 across millions of requests → backend misconfiguration
- Error count exceeds initial traffic → Retry Storm (Pattern 2)
- 429 → timeout → circuit breaker → Circuit Breaker Cascade (Pattern 1)
- Multiple services failing sequentially → Cascading Failure (Pattern 5)

## Generate report

Write the incident report using the **[Incident Report Template](../references/incident-report-template.md)**.

Save to: `.cloudflare-traffic-investigator-tmp/report.md`

Present a summary to the user highlighting:
1. Root cause and failure pattern
2. Key metrics (traffic volume, error rate, req/sec)
3. Top recommendations (immediate, short-term, long-term)
