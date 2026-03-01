# Step 3: Get Minute-Level Detail

Once the spike hour is confirmed, drill down to minute-level granularity to find the exact start time and peak.

Use `mcp__cloudflare-api__execute` with a GraphQL query:
- Dataset: `httpRequests1mGroups`
- Narrow to the 60-minute spike window
- Identify exact start time and peak minute

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
            httpRequests1mGroups(
              filter: { datetime_geq: "START_UTC", datetime_lt: "END_UTC" }
              limit: 60
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

- Exact minute the spike started (sharp increase)
- Peak minute (highest request count)
- How quickly the spike ramped up (sudden vs gradual)
- When error rates started climbing relative to traffic increase
