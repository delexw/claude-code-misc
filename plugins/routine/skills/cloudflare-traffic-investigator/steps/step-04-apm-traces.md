# Step 4: Request APM Error Traces

Use `AskUserQuestion` to request APM traces from the user:

"Please check your APM dashboard for errors during this time window. **Sort traces by time descending** to see the most recent errors first.

Look for:
- Error messages (e.g., TimeoutError, ConnectionError, 429/500 status codes)
- Stack traces showing which services/APIs failed
- Service/module names in error traces
- Circuit breaker or rate limiter messages

Please share:
1. Error types and messages
2. Stack traces (especially external service calls)
3. Affected endpoints/controllers
4. Error rates or counts"

## Why APM traces matter

- They reveal **which services/APIs actually failed** — traffic data alone only shows volume
- Stack traces show the code path from endpoint to failing dependency
- Error timing helps correlate failures with the traffic spike
- They distinguish capacity issues (timeouts) from bugs (exceptions)

## Key error types to watch for

- Service timeouts: TimeoutError, ReadTimeout, ConnectionTimeout
- Rate limiting: 429 responses from downstream services
- Circuit breaker state changes: opened/half-open/closed
- Database connection pool exhaustion
- External API/service failures
- Queue/worker failures
