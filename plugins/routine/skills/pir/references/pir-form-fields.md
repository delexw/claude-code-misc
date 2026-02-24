# PIR Form Fields

## Required Fields

### Impact Summary
- **Label**: Impact Summary
- **Help text**: Title for this incident. Summary of the impact seen by users.
- **Format**: Short text (1-2 sentences)
- **Example**: "Elements search results returning 500 errors for 45 minutes during peak traffic"

### What
- **Label**: What
- **Help text**: Which feature has been impacted, and how.
- **Format**: Multi-line text
- **Example**: "The Elements search API experienced cascading failures due to RSS feed service overload. Search results returned 500 errors and timeouts. Browse and download functionality were unaffected."

### Who
- **Label**: Who
- **Help text**: Which users and how many have been impacted.
- **Format**: Short text
- **Example**: "All Elements users attempting to search. Estimated ~12,000 unique users affected based on error tracking data."

### Incident date
- **Label**: Incident date
- **Help text**: Date to be used on this incident.
- **Format**: YYYY-MM-DD

### When
- **Label**: When
- **Help text**: Time for the incident. Be as specific as you can.
- **Format**: Free text with time range
- **Example**: "2025-02-20 03:15 - 04:00 AEDT (2025-02-19 16:15 - 17:00 UTC)"

## Optional Fields

### Remediation
- **Label**: Remediation (optional)
- **Help text**: Mitigation or remediation in place, if any.
- **Format**: Multi-line text
- **Example**: "Rate limiting applied to the offending JA4 fingerprint. RSS feed caching TTL increased from 5min to 30min. Circuit breaker thresholds adjusted."

### Incident controller
- **Label**: Incident controller (optional)
- **Help text**: Incident controller assigned to this incident. Mandatory for longer SEV1 and SEV2s.
- **Format**: User selection (name)
