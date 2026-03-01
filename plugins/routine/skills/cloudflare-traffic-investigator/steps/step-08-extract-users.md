# Step 8: Extract Top Users

For the high-traffic endpoints identified in Step 6, find which users are driving the most requests.

Filter by `clientRequestPath` (paths hit by culprit JA4) and group by `clientRequestQuery` to extract user identifiers.

Always note: "User counts are from sampled data."

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
            firewallEventsAdaptiveGroups(
              filter: {
                datetime_geq: "START_UTC",
                datetime_lt: "END_UTC",
                clientJA4: "CULPRIT_JA4",
                clientRequestPath: "/TARGET_PATH"
              }
              limit: 20
              orderBy: [count_DESC]
            ) {
              count
              dimensions { clientRequestQuery }
            }
          }
        }
      }`
    }
  });
}
```

## What to look for

- Users making 5-10x more requests than average
- Whether a small number of users dominate the traffic (suggests bug or abuse)
- Request frequency per user (calculate: requests / time window in seconds)
- Patterns suggesting automation or polling bugs
