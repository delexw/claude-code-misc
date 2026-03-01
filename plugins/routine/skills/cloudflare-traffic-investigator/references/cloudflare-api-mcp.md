# Using the Cloudflare API MCP

This skill uses `mcp__cloudflare-api__search` and `mcp__cloudflare-api__execute` for all Cloudflare interactions.

## How the tools work

1. **`mcp__cloudflare-api__search`** - Search the Cloudflare OpenAPI spec to discover REST endpoints, parameters, and schemas. Use this when you need to find or verify an endpoint before calling it.

2. **`mcp__cloudflare-api__execute`** - Execute JavaScript code against the Cloudflare API using `cloudflare.request()`. The `accountId` variable is available automatically.

## GraphQL Analytics queries

The Cloudflare GraphQL Analytics API is accessed by POSTing to `/graphql`:

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
              filter: { datetime_geq: "START", datetime_lt: "END" }
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

## Zone operations

```javascript
// List zones
async () => cloudflare.request({ method: "GET", path: "/zones" })

// Get zone details
async () => cloudflare.request({ method: "GET", path: "/zones/ZONE_ID" })
```

## Radar API calls

```javascript
// Get AS details
async () => cloudflare.request({ method: "GET", path: "/radar/entities/asns/ASN_NUMBER" })

// Get traffic anomalies
async () => cloudflare.request({ method: "GET", path: "/radar/annotations/outages" })

// Get bot data
async () => cloudflare.request({ method: "GET", path: "/radar/bots/summary/bot_class" })

// Get HTTP data
async () => cloudflare.request({ method: "GET", path: "/radar/http/summary/bot_class" })
```

Use `mcp__cloudflare-api__search` to discover additional Radar endpoints and their parameters when needed.
