# Step 6: Analyze Traffic for Culprit JA4

Now that the culprit JA4 is identified, understand what it was doing.

Use `mcp__cloudflare-api__execute` with a GraphQL query for `firewallEventsAdaptiveGroups` filtered by the culprit JA4:
- **Path distribution** — Which endpoints did this JA4 hit?
- **Query strings** — Extract user identifiers from query parameters
- **User agents** — Identify the service/application
- **ASN/Geography** — Source networks (internal AWS traffic may not be informative)

**Correlate with APM traces from Step 4** — Do the paths here match the failing endpoints?

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
                clientJA4: "CULPRIT_JA4"
              }
              limit: 20
              orderBy: [count_DESC]
            ) {
              count
              dimensions { clientRequestPath clientRequestQuery userAgent clientASNDescription }
            }
          }
        }
      }`
    }
  });
}
```

## What to document

- Top paths by request count
- Whether high-traffic paths match APM error endpoints
- User-Agent string (will be verified in Step 7)
- Any user IDs visible in query strings
