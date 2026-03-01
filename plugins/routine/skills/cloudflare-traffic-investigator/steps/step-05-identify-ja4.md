# Step 5: Identify Culprit JA4 Fingerprints

This is the pivotal step — dynamically discover which JA4 TLS fingerprint(s) drove the spike.

Use `mcp__cloudflare-api__execute` with a GraphQL query to `/graphql` for `firewallEventsAdaptiveGroups` grouped by JA4:
- Dimension: `clientJA4`
- Time filter: the spike window (UTC)
- Order by: `count_DESC`
- Limit: 20

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
              filter: { datetime_geq: "START_UTC", datetime_lt: "END_UTC" }
              limit: 20
              orderBy: [count_DESC]
            ) {
              count
              dimensions { clientJA4 }
            }
          }
        }
      }`
    }
  });
}
```

## Analyze results

1. **Check known fingerprints first** — Read [Known Fingerprints](../references/known-fingerprints.json) and cross-reference. Pre-verified JA4s can skip the legitimacy check in Step 7.
2. **Identify anomalous counts** — A single JA4 with millions of requests is likely the culprit.
3. **Note the fingerprint format** — `t13d...` = TLS 1.3, common for backend services.
4. **Compare against baseline** if you have prior data.

## Present findings

"JA4 fingerprint `[fingerprint]` caused [X] requests ([Y%] of total traffic). This represents [service/backend/automated] traffic based on the fingerprint pattern."
