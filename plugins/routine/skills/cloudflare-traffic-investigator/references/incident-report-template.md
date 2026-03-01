# Incident Report Template

Use this template when documenting traffic spike incidents. Fill in all sections with specific details from your investigation.

---

```markdown
## Incident: [Traffic Spike - Brief Description]

**Time Window:** [Time in current agent timezone]
**Affected Service:** [Service/API name that failed]
**Affected Endpoint:** [Path that received traffic]

---

### Metrics

- **Total traffic:** [X] requests ([+Y%] above baseline)
- **Failing endpoint traffic:** [Z] requests ([P%] of total)
- **Request rate to failing service:** [N] req/sec
- **Error rate:** [E]%
- **Top users:** [User IDs with request counts] (sampled)

---

### Root Cause

[1-2 sentence explanation of what caused the incident]

**Pattern:** [Reference to Common Failure Pattern if applicable]

---

### Timeline (Local Time)

- **[Time]**: Traffic spike began
- **[Time]**: Service errors started (429/timeout/connection errors)
- **[Time]**: Circuit breaker opened (if applicable)
- **[Time]**: Peak error rate - [N] errors/minute
- **[Time]**: Issue resolved/mitigated

---

### Technical Details

- **Culprit JA4 Fingerprint:** [fingerprint] ([X] requests, [Y%] of spike traffic)
- **Code path:** [Controller#action -> Service/API call at file:line]
- **Service capacity:** Failed at [N] req/sec
- **Traffic pattern:** [Backend service / User traffic / Mixed]

---

### Security Analysis

- **Bot Score:** [Range] ([automated/human-like behavior])
  - Detection: [botScoreSrcName]
- **WAF Attack Score:** [Range] ([clean/likely_clean/suspicious])
  - Classification: [wafAttackScoreClass]
- **WAF XSS/SQLi/RCE Scores:** [Ranges] ([attack patterns detected or clean])
- **Cloudflare Action:** [skip/challenge/block]
- **Assessment:** [Traffic is legitimate/suspicious/attack]

**Interpretation:**
[Brief explanation of what the security scores tell us about the traffic]

---

### APM Errors

- **Error type:** [e.g., TimeoutError, ConnectionError, HTTPError, CircuitBreakerError]
- **Failed service:** [Service/API name]
- **Status code:** [e.g., 429, 500, 503]
- **Stack trace:**
  ```
  [Key lines from stack trace showing failure point]
  [Include file paths and line numbers]
  [Show service call that failed]
  ```
- **Circuit breaker:** [Opened/Closed at X time] (if applicable)
- **Error rate:** [Y%] of requests during spike period

---

### User Activity Analysis

**Top users hitting failing endpoint:**
1. `[user_uuid]` - [N] requests (sampled) - [once every X seconds]
2. `[user_uuid]` - [N] requests (sampled) - [once every X seconds]
3. `[user_uuid]` - [N] requests (sampled) - [once every X seconds]

**Behavior assessment:**
- [ ] Normal usage pattern
- [ ] Possible frontend polling bug
- [ ] Automation/bot behavior
- [ ] User manually refreshing

**Recommendation for top users:**
[Investigate user behavior, contact if necessary, implement rate limiting, etc.]

---

### Data Sources

- **APM:** [Link to APM dashboard/traces]
- **Cloudflare Analytics:** Zone ID [zone_id], Time range [start - end]
- **Code:** [List file paths examined during investigation]
- **Codebase path:** [Path to backend repository used for analysis]

---

### Recommendations

#### Immediate (Priority: CRITICAL/HIGH/MEDIUM)

1. **[Action title]**
   - Current state: [Brief description]
   - Target state: [What needs to change]
   - Action items:
     - [Specific action 1]
     - [Specific action 2]

2. **[Action title]**
   - Current state: [Brief description]
   - Target state: [What needs to change]
   - Action items:
     - [Specific action 1]
     - [Specific action 2]

#### Short-term (Next sprint)

1. **[Action title]**
   - Why: [Reason this is needed]
   - What: [Specific implementation]
   - Expected impact: [Measurable improvement]

2. **[Action title]**
   - Why: [Reason this is needed]
   - What: [Specific implementation]
   - Expected impact: [Measurable improvement]

#### Long-term (Next month/quarter)

1. **[Action title]**
   - Strategic goal: [Long-term improvement]
   - Implementation: [High-level approach]
   - Benefits: [Why this matters]

2. **[Action title]**
   - Strategic goal: [Long-term improvement]
   - Implementation: [High-level approach]
   - Benefits: [Why this matters]

---

### Follow-up Actions

- [ ] Load test service at [X] req/sec (3-5x peak)
- [ ] Implement monitoring for [metric]
- [ ] Add alerting for [condition]
- [ ] Document runbook for [scenario]
- [ ] Schedule post-mortem meeting
- [ ] Update capacity planning documentation

---

**Generated:** [Date]
**Analyst:** [Your name]
**Report Status:** [Draft / Final / Under Review]

```

---

## Template Usage Guidelines

### When to Create Report

Create incident reports for:
- P1: Service outages, circuit breaker openings, >10% error rates
- P2: Sustained spikes >50% above baseline, single user >500 req/hour
- P3: Moderate increases worth documenting for future reference

### How to Fill In Sections

**Metrics:**
- Use actual numbers from Cloudflare queries
- Note if numbers are from sampled data
- Calculate percentages for context

**Timeline:**
- Always use current agent timezone
- Mark key events (spike start, errors start, circuit breaker, peak, resolution)

**Technical Details:**
- Always include JA4 fingerprint if identified
- Provide exact file paths and line numbers from code analysis
- Calculate actual req/sec to failing service

**Security Analysis:**
- Reference [Security Scores Reference](security-scores.md) for interpretation
- Explain what the scores mean in context

**APM Errors:**
- Copy actual stack traces (key lines only)
- Include service names that failed
- Note circuit breaker state if applicable

**User Activity:**
- List top 3-5 users from query analysis
- Calculate request frequency (once every X seconds)
- Note if behavior suggests bugs or abuse

**Recommendations:**
- Be specific and actionable
- Include current vs. target state
- Prioritize by impact and urgency

### Saving Reports

Save incident reports to: `.cloudflare-traffic-investigator-tmp/report.md`

---

## Example Report Excerpt

```markdown
## Incident: Downstream Service Overload - Morning Traffic Spike

**Time Window:** 4am-5am (current agent timezone), 2026-01-07
**Affected Service:** Subscription API
**Affected Endpoint:** `/api/subscription`

---

### Metrics

- **Total traffic:** 4.4M requests (+57% above baseline 2.8M)
- **Failing endpoint traffic:** 29,577 requests (~1% of total)
- **Request rate to failing service:** ~300 req/sec (confirmed from APM)
- **Error rate:** 19,220 errors (peak: 2,517 errors/minute at 4:39am)
- **Top users:**
  - `f3cbe216-feb3-4007-9d78-d761f83b354b` - 640 requests (sampled)
  - `73bcd4b4-1b12-4394-9bd6-ef9a9695f51a` - 609 requests (sampled)

---

### Root Cause

Downstream service capacity limit (~300 req/sec) exceeded by legitimate traffic spike, causing 429 errors and circuit breaker opening. Only 1% of total traffic drained the service.

**Pattern:** Legitimate Traffic, Undersized Service (Pattern 4)

---

### Security Analysis

- **Bot Score:** 1 (automated behavior)
  - Detection: Heuristics
- **WAF Attack Score:** 86 (clean)
  - Classification: clean
- **WAF XSS/SQLi/RCE Scores:** 65-99 (no attack patterns)
- **Cloudflare Action:** skip (all requests allowed)
- **Assessment:** Traffic is 100% legitimate internal application backend API calls

**Interpretation:**
Bot score of 1 indicates automated behavior, which is expected for an internal application making backend API calls. All WAF scores indicate clean traffic with no security threats detected.
```
