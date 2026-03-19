# Using the Cloudflare API CLI

This skill uses `cloudflare-mcp-cli search` and `cloudflare-mcp-cli execute` for all Cloudflare interactions via the Bash tool.

## How the commands work

1. **`cloudflare-mcp-cli search '<async fn>'`** - Search the Cloudflare OpenAPI spec to discover REST endpoints, parameters, and schemas. The function receives a `spec` object with all $refs resolved.

2. **`cloudflare-mcp-cli execute '<async fn>'`** - Execute JavaScript code against the Cloudflare API using `cloudflare.request()`. The `accountId` variable is available automatically.

## GraphQL Analytics queries

The Cloudflare GraphQL Analytics API is accessed by POSTing to `/graphql`:

```bash
cloudflare-mcp-cli execute 'async () => {
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
}'
```

## Zone operations

```bash
# List zones
cloudflare-mcp-cli execute 'async () => cloudflare.request({ method: "GET", path: "/zones" })'

# Get zone details
cloudflare-mcp-cli execute 'async () => cloudflare.request({ method: "GET", path: "/zones/ZONE_ID" })'
```

## Radar API calls

```bash
# Get AS details
cloudflare-mcp-cli execute 'async () => cloudflare.request({ method: "GET", path: "/radar/entities/asns/ASN_NUMBER" })'

# Get traffic anomalies
cloudflare-mcp-cli execute 'async () => cloudflare.request({ method: "GET", path: "/radar/annotations/outages" })'

# Get bot data
cloudflare-mcp-cli execute 'async () => cloudflare.request({ method: "GET", path: "/radar/bots/summary/bot_class" })'

# Get HTTP data
cloudflare-mcp-cli execute 'async () => cloudflare.request({ method: "GET", path: "/radar/http/summary/bot_class" })'
```

Use `cloudflare-mcp-cli search` to discover additional Radar endpoints and their parameters when needed.

## WAF rules

```bash
# List legacy custom firewall rules
cloudflare-mcp-cli execute 'async () => cloudflare.request({ method: "GET", path: "/zones/ZONE_ID/firewall/rules?per_page=50" })'

# List custom rulesets (newer WAF format)
cloudflare-mcp-cli execute 'async () => cloudflare.request({ method: "GET", path: "/zones/ZONE_ID/rulesets" })'

# Fetch all rules within a specific ruleset
cloudflare-mcp-cli execute 'async () => cloudflare.request({ method: "GET", path: "/zones/ZONE_ID/rulesets/RULESET_ID" })'

# Search for WAF/cache ruleset paths in the OpenAPI spec
cloudflare-mcp-cli search 'async (spec) => Object.keys(spec.paths).filter(p => p.includes("ruleset"))'
```

## Rate limiting rules

```bash
# List rate limiting rules
cloudflare-mcp-cli execute 'async () => cloudflare.request({ method: "GET", path: "/zones/ZONE_ID/rate_limits?per_page=50" })'
```

## Page rules and cache rules

```bash
# List active page rules
cloudflare-mcp-cli execute 'async () => cloudflare.request({ method: "GET", path: "/zones/ZONE_ID/pagerules?status=active" })'

# Discover cache rule endpoints
cloudflare-mcp-cli search 'async (spec) => Object.keys(spec.paths).filter(p => p.includes("cache_rules") || p.includes("cache-rules"))'
```
