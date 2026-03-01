# Step 9: Map Endpoint to Service Dependencies & Calculate Load

This step connects Cloudflare traffic data with actual code paths and quantifies the service load.

## Part A: Map to code

Use `AskUserQuestion` to request the codebase path if not already provided:
"What is the path to your backend codebase?"

Then explore the codebase dynamically:

1. Use `Glob` to find the endpoint implementation (controller, action, handler)
2. Use `Read` to understand the request flow
3. Use `Grep` to search for external service calls (HTTP clients, API calls, database queries, cache operations)
4. Identify which services/APIs are called that could be failing

### Key things to identify

- External services/APIs called (match with APM traces from Step 4)
- Caching presence and TTL
- Retry/backoff logic
- Database queries
- Error handling and graceful degradation

### Cross-reference with APM traces

- Verify endpoint code matches stack traces
- Confirm service calls in code match failing services in APM
- Check if error locations match code line numbers

## Part B: Calculate service load

With the traffic data from previous steps, compute the actual load on the failing service:

```
Total requests to endpoint (from culprit JA4): X
Time window: 3,600 seconds (1 hour)
Request rate: X / 3,600 = Y req/sec

Percentage of total traffic: X / Total * 100%
```

### Interpret results

- If <1% of traffic causes failure → severe under-provisioning
- If service fails at <10 req/sec → capacity issue
- If specific users dominate → possible bug or abuse
- If single JA4 dominates → service-to-service architecture issue
