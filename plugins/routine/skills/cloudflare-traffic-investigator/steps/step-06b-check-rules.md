# Step 6b: Check Active WAF Rules, Rate Limits & Page Rules

After assessing traffic legitimacy, inspect what Cloudflare rules are currently configured for this zone. This reveals whether protections are working as expected, and surfaces gaps that explain why certain traffic was allowed through.

## Why this matters

- If traffic was assessed as **attack or suspicious**, existing WAF rules should have caught it — if they didn't, something is misconfigured or missing.
- If traffic is **legitimate**, rate limiting or page rules may still be relevant (e.g., a cache rule not applying correctly could amplify origin load).
- The rules inventory feeds directly into the Recommendations section of the incident report.

## What to fetch

Run these in parallel (they're independent zone queries):

### 1. WAF Custom Firewall Rules

```bash
cloudflare-mcp-cli execute 'async () => cloudflare.request({
  method: "GET",
  path: "/zones/ZONE_ID/firewall/rules?per_page=50"
})'
```

Note each rule's: `description`, `action` (block/challenge/js_challenge/allow/log), `filter.expression`, and `paused` status.

### 2. Custom Rulesets (newer WAF format)

```bash
cloudflare-mcp-cli execute 'async () => cloudflare.request({
  method: "GET",
  path: "/zones/ZONE_ID/rulesets"
})'
```

Look for rulesets with `phase: "http_request_firewall_custom"` or `phase: "http_ratelimit"`. For each relevant ruleset, fetch its rules:

```bash
cloudflare-mcp-cli execute 'async () => cloudflare.request({
  method: "GET",
  path: "/zones/ZONE_ID/rulesets/RULESET_ID"
})'
```

### 3. Rate Limiting Rules

```bash
cloudflare-mcp-cli execute 'async () => cloudflare.request({
  method: "GET",
  path: "/zones/ZONE_ID/rate_limits?per_page=50"
})'
```

For each rule note: `threshold`, `period` (seconds), `url` pattern, `action.mode` (simulate/ban/challenge), and `disabled` status.

### 4. Page Rules

```bash
cloudflare-mcp-cli execute 'async () => cloudflare.request({
  method: "GET",
  path: "/zones/ZONE_ID/pagerules?status=active"
})'
```

For each rule note: URL pattern, actions (cache level, edge cache TTL, forwarding URL, etc.), and `priority`.

### 5. Cache Rules (if applicable)

```bash
cloudflare-mcp-cli search 'async (spec) => {
  return Object.keys(spec.paths).filter(p => p.includes("cache_rules") || p.includes("cache-rules"));
}'
```

If cache rules exist, fetch them — they affect how aggressively Cloudflare serves cached responses vs. hitting origin.

## Cross-reference with incident

After fetching the rules, assess each category against what you found in steps 2-6:

### WAF rules — did they fire?

- For the culprit paths from Step 5, check if any WAF rule expressions match (e.g., `http.request.uri.path eq "/api/subscription"`).
- If traffic was **suspicious/attack** (WAF score < 50), were any block/challenge rules in place for that path?
- If no rules cover the affected endpoint → **gap identified: missing WAF rule**.
- If rules exist but action is `log` only → **gap identified: rules not enforcing**.

### Rate limiting — did thresholds apply?

- Check if any rate limit covers the affected endpoint.
- Compare the configured `threshold/period` to the peak req/sec from Step 3.
  - E.g., if threshold is 1000 req/10min but peak was 300 req/sec (180,000 req/10min) → threshold is far too high to protect.
- If no rate limit covers the endpoint → **gap identified: no rate limiting on endpoint**.

### Page rules — are they contributing?

- Check if any page rule sets cache level to `bypass` on the affected path — this forces all requests to origin and amplifies load.
- Check if any forwarding rule might be double-counting requests.
- A cache TTL of 0 or "no-store" on a heavily-hit path is worth flagging.

## Document

Record a concise rules inventory and gap analysis:

```
WAF Custom Rules: [N active rules, M paused]
  - Rule covering affected path? [Yes (action: X) / No]
  - Gaps: [description or "none"]

Rate Limiting: [N active rules]
  - Rule covering affected endpoint? [Yes (threshold: X req/Ys, action: Y) / No]
  - Threshold vs. actual peak: [adequate / too high / no rule]

Page Rules: [N active rules]
  - Cache behavior on affected path: [standard / bypass / no rule]
  - Any rules contributing to amplification? [Yes: description / No]

Protection gaps identified: [list, or "none"]
```

## Next step

Proceed to **Step 7: Extract Top Users** regardless of findings here. Gaps identified in this step feed into the Recommendations in Step 8.
