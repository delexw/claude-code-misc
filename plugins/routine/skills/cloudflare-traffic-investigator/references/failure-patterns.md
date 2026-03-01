# Common Traffic Spike Failure Patterns

This reference documents common patterns observed during traffic spike investigations and their typical causes.

---

## Pattern 1: Circuit Breaker Cascade

**Symptoms:**
- Initial 429 (Too Many Requests) rate limit errors
- Circuit breaker opens
- All subsequent requests timeout (ReadTimeout, Connection errors)
- Error count continues even after traffic normalizes

**Timeline:**
1. Service receives traffic spike
2. Service hits capacity limit, returns 429 errors
3. Circuit breaker detects failure threshold
4. Circuit breaker opens to protect service
5. All new requests fail immediately with timeout
6. Circuit breaker eventually closes after cooldown period

**Cause:**
Service capacity exceeded, triggering protective circuit breaker mechanism.

**Resolution:**
- **Immediate**: Wait for circuit breaker cooldown, or manually reset if possible
- **Short-term**: Increase service capacity to handle peak load
- **Long-term**: Implement auto-scaling based on load metrics

---

## Pattern 2: Retry Storm

**Symptoms:**
- Error count exponentially exceeds initial traffic volume
- Same users/services making repeated requests
- Error rate continues climbing even after initial spike subsides
- Network/service saturation

**Timeline:**
1. Initial service failure (500, 429, timeout)
2. Clients detect failure and retry
3. Retries amplify load on already struggling service
4. More failures trigger more retries
5. Exponential feedback loop

**Cause:**
Client retry logic without backoff amplifies load on failing service.

**Example:**
```
Initial failures: 1,000 requests
First retry wave: 1,000 additional (2,000 total)
Second retry wave: 2,000 additional (4,000 total)
Third retry wave: 4,000 additional (8,000 total)
```

**Resolution:**
- **Immediate**:
  - Temporarily disable client retries if possible
  - Implement rate limiting at load balancer
  - Add jitter to prevent thundering herd
- **Short-term**:
  - Add exponential backoff to client retry logic
  - Implement max retry limit (e.g., 3 attempts)
  - Add circuit breaker on client side
- **Long-term**:
  - Use message queues for async processing
  - Implement request deduplication

---

## Pattern 3: Single User Amplification

**Symptoms:**
- One user/service making 10-15x more requests than normal
- Specific user ID or IP dominates traffic
- Requests concentrated on specific endpoint(s)
- User behavior inconsistent with normal patterns

**Common Causes:**

**Frontend Polling Bug:**
- JavaScript timer set too aggressively (e.g., polling every 1 second instead of 60 seconds)
- Polling loop doesn't stop on tab close
- Multiple tabs open, each polling independently

**Automation Script:**
- Bot or script making automated requests
- Missing rate limiting in script
- Script stuck in error-retry loop

**App State Bug:**
- App stuck in infinite loop
- Failed state transition keeps re-triggering request
- Cache invalidation causing repeated fetches

**User Behavior:**
- User refreshing page constantly
- Multiple devices logged in
- Browser extension causing repeated requests

**Identification:**
```
Normal user: 5-20 requests/hour to endpoint
Abnormal user: 500-2,000 requests/hour to endpoint
```

**Resolution:**
- **Immediate**:
  - Contact user to identify issue
  - Temporarily rate limit the specific user
  - Check if it's a test/staging account
- **Short-term**:
  - Fix frontend polling frequency
  - Add client-side caching
  - Implement per-user rate limiting
- **Long-term**:
  - Add monitoring for per-user request rates
  - Implement automatic rate limiting thresholds
  - Add frontend circuit breakers

---

## Pattern 4: Legitimate Traffic, Undersized Service

**Symptoms:**
- Normal-looking traffic distribution (no single user dominates)
- Thousands of unique users across the traffic
- Service fails at low request rate (<10 req/sec)
- No obvious attack pattern
- Bot scores indicate legitimate automated or user traffic
- WAF scores clean (65-100)

**Cause:**
Production service capacity insufficient for legitimate workload.

**Example Scenario:**
```
Total traffic spike: 4.4M requests/hour
Endpoint receiving: 30K requests/hour (~8.3 req/sec)
Service capacity: ~10 req/sec
Result: Service fails under 1% of total traffic
```

**Why This Happens:**
- Service was sized for average load, not peak load
- Service never load tested at production scale
- Dependency on external service with tight rate limits
- Database connection pool too small
- No caching layer

**Resolution:**
- **Immediate (P1)**:
  - Scale service horizontally (add more instances)
  - Scale service vertically (larger instances)
  - Enable auto-scaling if available
  - Add temporary rate limiting to protect service
- **Short-term**:
  - Load test service at 3-5x expected peak load
  - Identify bottlenecks (CPU, memory, network, database)
  - Add caching layer (Redis, CDN)
  - Optimize database queries
- **Long-term**:
  - Implement auto-scaling based on metrics
  - Add redundancy (multiple instances, regions)
  - Implement graceful degradation
  - Regular capacity planning reviews

---

## Pattern 5: Cascading Service Failure

**Symptoms:**
- Multiple services failing simultaneously
- Failure starts with one service, spreads to others
- Increasing error rates across the stack
- Database connection pool exhaustion
- Message queue backlog growing

**Failure Chain Example:**
```
1. Downstream service hits rate limit (429)
2. Backend retries downstream calls
3. Backend request queue grows
4. Backend exhausts database connections
5. Backend stops responding (timeouts)
6. Frontend starts getting 500 errors
7. Frontend retries amplify backend load
8. Entire stack becomes unresponsive
```

**Cause:**
Lack of fault isolation between services. One service failure cascades through dependencies.

**Resolution:**
- **Immediate**:
  - Identify root failing service
  - Scale or restart the root service
  - Clear message queue backlogs
  - Manually open circuit breakers to stop cascade
- **Short-term**:
  - Implement circuit breakers between all service calls
  - Add request timeouts (fail fast)
  - Implement bulkheading (isolate resources)
- **Long-term**:
  - Design services to degrade gracefully
  - Implement retry budgets
  - Add comprehensive monitoring/alerting
  - Regular chaos engineering exercises

---

## Pattern 6: Cache Stampede / Thundering Herd

**Symptoms:**
- Traffic spike immediately after cache expiration
- Multiple identical requests hit backend simultaneously
- Cache miss rate suddenly spikes
- Service overwhelmed regenerating cached data

**Scenario:**
```
1. Popular cached item expires (e.g., homepage data)
2. 10,000 requests arrive for the same item
3. All 10,000 requests miss cache
4. All 10,000 requests hit backend to regenerate
5. Backend overwhelmed
```

**Resolution:**
- **Immediate**:
  - Manually refresh hot cache entries
  - Extend cache TTL temporarily
- **Short-term**:
  - Implement cache lock (first request regenerates, others wait)
  - Add probabilistic early expiration
  - Use stale-while-revalidate pattern
- **Long-term**:
  - Implement background cache warming
  - Use jittered cache expiration times
  - Monitor cache hit rates

---

## Identifying Patterns During Investigation

**Decision Tree:**

```
Check error type and progression:
  ↓
  ├─ 429 → Timeout → Circuit Breaker
  │  → Pattern 1: Circuit Breaker Cascade
  │
  ├─ Error count > initial traffic
  │  → Pattern 2: Retry Storm
  │
  ├─ Single user dominates request count
  │  → Pattern 3: Single User Amplification
  │
  ├─ Normal distribution, service fails <10 req/sec
  │  → Pattern 4: Undersized Service
  │
  ├─ Multiple services failing sequentially
  │  → Pattern 5: Cascading Failure
  │
  └─ Traffic spike after cache expiry
     → Pattern 6: Cache Stampede
```

---

## Documentation in Incident Reports

When documenting pattern identification:

**Format:**
```markdown
## Root Cause

Pattern identified: [Pattern Name]

**Evidence:**
- [Symptom 1 from pattern]
- [Symptom 2 from pattern]
- [Timeline matching pattern]

**Cause:**
[Pattern cause explanation]

**Why it occurred:**
[Specific reason in this context]
```

**Example:**
```markdown
## Root Cause

Pattern identified: Legitimate Traffic, Undersized Service (Pattern 4)

**Evidence:**
- Normal traffic distribution across thousands of users
- Service failed at ~8 req/sec (extremely low capacity)
- Only 1% of total traffic affected the failing service
- Bot scores show legitimate automated traffic (score: 1)
- WAF scores clean (86-100)

**Cause:**
Downstream service capacity insufficient for production workload

**Why it occurred:**
Downstream service was never load tested at production scale. Designed for average load (~2 req/sec), failed when legitimate traffic reached ~8 req/sec during morning peak usage.
```
