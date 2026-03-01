# Step 2: Confirm Traffic Spike

Use `mcp__cloudflare-api__execute` to POST a GraphQL query to `/graphql` for hourly traffic.

Query 48 hours of data centered around the user's time window to establish a baseline for comparison. Look for sudden increases in request volume or error rates.

- Dataset: `httpRequests1hGroups`
- Metrics: requests, threats, responseStatusMap

## Example Query

```javascript
async () => {
  return cloudflare.request({
    method: "POST",
    path: "/graphql",
    body: {
      query: `{
        viewer {
          zones(filter: { zoneTag: "ZONE_ID" }) {
            httpRequests1hGroups(
              filter: { datetime_geq: "START_UTC", datetime_lt: "END_UTC" }
              limit: 48
              orderBy: [datetime_ASC]
            ) {
              dimensions { datetime }
              sum { requests threats responseStatusMap { edgeResponseStatus requests } }
            }
          }
        }
      }`
    }
  });
}
```

## What to look for

- Hours with significantly higher request counts than surrounding hours
- Spikes in 4xx or 5xx error responses
- Correlation between traffic increase and error rate increase
