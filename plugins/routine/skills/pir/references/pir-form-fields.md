# PIR Form Fields

## Required Fields

### Impact Summary
- **Help text**: Title for this incident. Summary of the impact seen by users.
- **Format**: Short text (1-2 sentences)
- **Example**: "Elements search results returning 500 errors for 45 minutes during peak traffic"

### What
- **Help text**: Which feature has been impacted, and how.
- **Format**: Multi-line text
- **Example**: "The Elements search API experienced cascading failures due to RSS feed service overload. Search results returned 500 errors and timeouts. Browse and download functionality were unaffected."

### Who
- **Help text**: Which users and how many have been impacted.
- **Format**: Short text
- **Example**: "All Elements users attempting to search. Estimated ~12,000 unique users affected based on error tracking data."

### Incident date
- **Help text**: Date to be used on this incident.
- **Format**: YYYY-MM-DD

### Culprit
- **Help text**: Root cause or source of the incident. What triggered it.
- **Format**: Multi-line text. Must be a **definitive statement** — either a confirmed root cause or "Root cause not identified". Never use hedging language ("may have", "could be", "possibly", "might").
- **Example**: "Aggressive bot crawler (JA4 fingerprint: t13d1516h2_8daaf6152771_02713d6af862) sending ~4,000 req/s to /search endpoints, overwhelming the RSS feed service and triggering cascading failures."

### When
- **Help text**: Time for the incident. Be as specific as you can.
- **Format**: Free text with time range
- **Example**: "2025-02-20 03:15 - 04:00 AEDT"

## Optional Fields

### Remediation
- **Help text**: Mitigation or remediation in place, if any.
- **Format**: Multi-line text
- **Example**: "Rate limiting applied to the offending JA4 fingerprint. RSS feed caching TTL increased from 5min to 30min. Circuit breaker thresholds adjusted."

### Incident controller
- **Help text**: Incident controller assigned to this incident. Mandatory for longer SEV1 and SEV2s.
- **Format**: User selection (name)

## Output Template

```markdown
# PIR — [Incident Title — synthesised from all sources]

**Severity**: [SEV1/SEV2/SEV3 — auto-classified]

**Impact Summary**: [synthesised summary]

**What**: [feature impact description]

**Who**: [user impact with counts]

**Culprit**: [root cause or trigger source]

**Incident date**: [YYYY-MM-DD]

**When**: [specific time range with timezone]

**Remediation**: [mitigations applied, or "To be determined"]

**Incident controller**: [name from PagerDuty, or "Not assigned"]

---

### Evidence Sources

#### PagerDuty
[Correlated incident IDs, titles, urgency, timestamps, duration, escalation policy]

#### Datadog
[Correlated monitor IDs, key metrics, error rates, SLO breaches, affected services]

#### Cloudflare
[Zone, traffic patterns, affected endpoints, JA4 fingerprints, key findings]
```
