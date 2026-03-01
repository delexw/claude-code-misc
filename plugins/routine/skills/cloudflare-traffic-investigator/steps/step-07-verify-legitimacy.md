# Step 7: Verify Traffic Legitimacy

Before analyzing users, determine whether the traffic is legitimate or an attack.

Use `mcp__cloudflare-api__execute` with a GraphQL query for `firewallEventsAdaptiveGroups` filtered by the culprit JA4, requesting security dimensions.

## Security dimensions to query

- `botScore` (1-99): 1-10 = automated, 30-99 = human-like
- `wafAttackScore` (0-100): 86-100 = clean, <50 = suspicious
- `wafXssAttackScore`, `wafSqliAttackScore`, `wafRceAttackScore` (0-100)
- `action`: skip / challenge / block
- `botScoreSrcName`, `wafAttackScoreClass`
- `userAgent`

## User-Agent verification (for automated traffic)

When bot score indicates automation (1-10), categorize the User-Agent:

| Category | Examples | Action |
|----------|----------|--------|
| Well-known public bots | Googlebot, Bingbot, DuckDuckBot | Document, no need to ask |
| Clearly internal services | YourApp, InternalService, company-specific names | Document as expected |
| Unknown/suspicious | python-requests, curl, generic strings | **Ask user** via `AskUserQuestion` |

Only ask the user about unknown User-Agents. Well-known bots and clearly internal services don't need confirmation — this avoids unnecessary interruptions while still catching real threats.

## Quick assessment decision tree

- **Known JA4 fingerprint** (in [known-fingerprints.json](../references/known-fingerprints.json)) → Legitimate, skip remaining checks
- **Internal service**: Bot Score 1-10, WAF 65-100, Action "skip", User-Agent clearly internal → Legitimate
- **Public bot**: Bot Score 1-30, "Verified Bot", well-known User-Agent → Legitimate
- **User traffic**: Bot Score 30-99, WAF 65-100, Action "skip" → Legitimate
- **Attack**: WAF <50, Action "block"/"challenge" → Escalate immediately
- **Unknown automation**: Bot Score 1-10, unknown User-Agent → Ask user, then investigate or escalate

**Detailed scoring guide:** [Security Scores Reference](../references/security-scores.md)

## Document

- Bot Score range and behavior type
- User-Agent string and categorization
- WAF score ranges (Attack/XSS/SQLi/RCE)
- Cloudflare actions taken
- Assessment: "Traffic is [legitimate / suspicious / attack]"

## Next steps

- Legitimate → Continue to Step 8 (Extract Top Users)
- Attack or unknown automation → Escalate immediately, skip user analysis, recommend WAF rules/blocking
