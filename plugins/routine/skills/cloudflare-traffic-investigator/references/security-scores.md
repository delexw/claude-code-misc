# Cloudflare Security Scores Reference

This reference provides detailed interpretation guidelines for Cloudflare bot scores and WAF attack scores.

## Bot Score (`botScore`)

**Range:** 1-99 (1 = most automated, 99 = most human-like)

**Score Ranges:**
- **1-10**: Highly automated traffic
  - Expected for backend services, APIs, service-to-service communication
  - Normal for internal infrastructure (e.g., "YourApp", microservices)
- **11-30**: Likely automated
  - Could be legitimate bots, scrapers, or automation tools
  - May include CI/CD systems, monitoring tools
- **31-99**: Human-like behavior
  - Normal user traffic from browsers
  - Interactive applications with human users

**Detection Source (`botScoreSrcName`):**
- **Heuristics**: Pattern-based detection
- **Machine Learning**: ML model classification
- **Verified Bot**: Known legitimate bot (e.g., Googlebot)
- **JavaScript Fingerprinting**: Browser behavior analysis

---

## User-Agent Verification (`userAgent`)

**CRITICAL for automated traffic (bot score 1-10):** Always check User-Agent and confirm with user.

**Why User-Agent matters:**
- Bot score alone cannot distinguish between legitimate and malicious automation
- Same bot score (e.g., 1) could be:
  - ✅ Your internal service (e.g., "YourApp", "MyBackendService/1.0")
  - ⚠️ Unknown automation tool
  - 🚨 Malicious bot mimicking legitimate traffic

**Verification Process:**

When you see automated traffic (bot score 1-10):

1. **Query for User-Agent**: Include `userAgent` field in your Cloudflare query
2. **Categorize User-Agent**:
   - **Well-known public bots**: Googlebot, Bingbot, verified crawlers → No action needed
   - **Clearly internal services**: "YourApp", "InternalService", company-specific names → Document as expected
   - **Unknown/suspicious**: python-requests, curl, generic strings → **Use AskUserQuestion tool**

3. **Only ask user for unknown User-Agents:**

**Example question format (only for unknown agents):**
```
I see automated traffic from an unknown User-Agent:
- Bot Score: 1 (automated behavior)
- User-Agent: "python-requests/2.28.0"

Is this expected internal traffic, or should we investigate further?
```

**Well-Known Public User-Agents (no need to ask):**
- Search engines: "Googlebot", "Bingbot", "Slurp" (Yahoo), "DuckDuckBot"
- Social media: "facebookexternalhit", "Twitterbot", "LinkedInBot"
- Monitoring: "UptimeRobot", "Pingdom", "StatusCake"
- CDN/Security: Verified bots with `botScoreSrcName: "Verified Bot"`

**Clearly Internal Services (document as expected, no need to ask):**
- Company-specific names: "YourApp", "InternalService", "[CompanyName]Service"
- Internal apps: "AppName/Version (Platform; Build)"
- Backend services: "[Company]Worker/Version", "Internal-API/Version"

**Unknown/Suspicious User-Agents (ASK USER):**
- Generic automation: "python-requests/2.28.0", "curl/7.68.0", "Go-http-client"
- Generic browsers: "Mozilla/5.0" alone (no app identifier)
- Unknown strings: User-Agent doesn't match any known pattern
- Suspicious patterns: Randomly generated strings, encoded values

**Documentation:**
Always document:
- Bot Score value
- User-Agent string
- **User confirmation**: "Confirmed as legitimate internal service" or "Unknown automation - investigating"
- Decision: Continue investigation or escalate

**Example Analysis:**

✅ **Clearly Internal (no need to ask):**
```
Bot Score: 1
User-Agent: "YourApp/2.1.0 (iOS)"
Assessment: Internal mobile app (company name in User-Agent)
→ Document as legitimate, continue to Step 8
```

✅ **Well-Known Public Bot (no need to ask):**
```
Bot Score: 5
User-Agent: "Googlebot/2.1"
botScoreSrcName: "Verified Bot"
Assessment: Legitimate search engine crawler
→ Document as legitimate, continue to Step 8
```

⚠️ **Unknown User-Agent (ASK USER):**
```
Bot Score: 1
User-Agent: "python-requests/2.28.0"
→ Use AskUserQuestion tool to confirm
→ If user confirms: "No, we don't use Python scripts for this endpoint"
→ Escalate immediately, investigate source, consider blocking
```

⚠️ **Generic Automation (ASK USER):**
```
Bot Score: 2
User-Agent: "curl/7.68.0"
→ Use AskUserQuestion tool to confirm
→ If user confirms: "Yes, this is our internal health check script"
→ Document as legitimate internal tool, continue to Step 8
```

---

## WAF Attack Score (`wafAttackScore`)

**Range:** 0-100 (higher score = cleaner traffic, lower score = more suspicious)

**Score Classifications:**
- **86-100**: "clean"
  - No security threats detected
  - Normal, safe traffic
- **50-85**: "likely_clean"
  - Low risk traffic
  - Minor anomalies but not threatening
- **0-49**: "suspicious" or higher threat levels
  - Potential attack patterns detected
  - Requires investigation

**Classification Field (`wafAttackScoreClass`):**
- `clean`: No threats
- `likely_clean`: Low risk
- `suspicious`: Moderate risk
- `likely_malicious`: High risk
- `malicious`: Confirmed attack patterns

---

## WAF XSS Attack Score (`wafXssAttackScore`)

**Range:** 0-100 (higher = cleaner)

**Purpose:** Detects Cross-Site Scripting (XSS) attack patterns

**What it checks for:**
- `<script>` tag injections
- JavaScript event handlers in HTML
- Data URI schemes with JavaScript
- Encoded script payloads
- DOM-based XSS patterns

**Interpretation:**
- **80-100**: No XSS patterns detected
- **50-79**: Minor patterns, likely false positive
- **0-49**: XSS attack attempt likely

---

## WAF SQLi Attack Score (`wafSqliAttackScore`)

**Range:** 0-100 (higher = cleaner)

**Purpose:** Detects SQL Injection attack patterns

**What it checks for:**
- SQL syntax in parameters (`' OR '1'='1`)
- UNION SELECT statements
- Comment sequences (`--`, `/**/`)
- Database function calls
- Stacked queries (`;`)

**Interpretation:**
- **80-100**: No SQLi patterns detected
- **50-79**: Minor patterns, possibly legitimate SQL-like strings
- **0-49**: SQL injection attempt likely

---

## WAF RCE Attack Score (`wafRceAttackScore`)

**Range:** 0-100 (higher = cleaner)

**Purpose:** Detects Remote Code Execution attack patterns

**What it checks for:**
- Shell command injection (`; ls`, `| cat`)
- Path traversal (`../../../etc/passwd`)
- Template injection (`{{7*7}}`)
- Serialization exploits
- File inclusion attempts

**Interpretation:**
- **80-100**: No RCE patterns detected
- **50-79**: Minor patterns, possibly legitimate paths
- **0-49**: RCE attack attempt likely

---

## Cloudflare Action (`action`)

**Possible Values:**
- **skip**: Request allowed through (no rules triggered)
- **challenge**: CAPTCHA or JavaScript challenge presented
- **block**: Request blocked by firewall rule
- **managed_challenge**: Cloudflare Managed Challenge presented
- **log**: Logged but not blocked (monitoring mode)

**Interpretation:**
- `skip` with high WAF scores = legitimate traffic
- `block` or `challenge` = security rules triggered
- `skip` with low WAF scores = potential security gap (investigate WAF rules)

---

## Traffic Pattern Recognition

### Legitimate Backend/Service Traffic
**Expected Pattern:**
- Bot Score: 1-10 (automated)
- WAF Attack Score: 65-100 (clean)
- WAF XSS/SQLi/RCE Scores: 65-100 (clean)
- Action: "skip"
- User-Agent: Service identifier (e.g., "YourApp", "ServiceName", "InternalAPI")

**Example:**
```json
{
  "botScore": 1,
  "botScoreSrcName": "Heuristics",
  "wafAttackScore": 86,
  "wafAttackScoreClass": "clean",
  "wafXssAttackScore": 99,
  "wafSqliAttackScore": 99,
  "wafRceAttackScore": 99,
  "action": "skip",
  "userAgent": "YourApp"
}
```

**Assessment:** ✅ Legitimate internal infrastructure traffic

---

### Legitimate Human User Traffic
**Expected Pattern:**
- Bot Score: 30-99 (human-like)
- WAF Attack Score: 65-100 (clean)
- WAF XSS/SQLi/RCE Scores: 65-100 (clean)
- Action: "skip" or "managed_challenge"
- User-Agent: Browser string (Chrome, Firefox, Safari, etc.)

**Example:**
```json
{
  "botScore": 45,
  "botScoreSrcName": "Machine Learning",
  "wafAttackScore": 78,
  "wafAttackScoreClass": "likely_clean",
  "wafXssAttackScore": 85,
  "wafSqliAttackScore": 82,
  "wafRceAttackScore": 90,
  "action": "skip",
  "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0"
}
```

**Assessment:** ✅ Legitimate user traffic

---

### Attack Traffic (Red Flags)
**Warning Signs:**
- Bot Score: Any (attackers can mimic human or automated behavior)
- WAF Attack Score: <50 (suspicious)
- WAF XSS/SQLi/RCE Scores: <50 (attack patterns detected)
- Action: "block" or "challenge" (OR "skip" with low scores = potential security gap)
- Inconsistent patterns across requests

**Example - XSS Attack:**
```json
{
  "botScore": 25,
  "botScoreSrcName": "Heuristics",
  "wafAttackScore": 12,
  "wafAttackScoreClass": "likely_malicious",
  "wafXssAttackScore": 8,
  "wafSqliAttackScore": 95,
  "wafRceAttackScore": 92,
  "action": "block",
  "userAgent": "curl/7.68.0"
}
```

**Assessment:** ⚠️ XSS attack attempt - blocked by WAF

**Example - SQL Injection:**
```json
{
  "botScore": 15,
  "botScoreSrcName": "Heuristics",
  "wafAttackScore": 25,
  "wafAttackScoreClass": "suspicious",
  "wafXssAttackScore": 88,
  "wafSqliAttackScore": 15,
  "wafRceAttackScore": 90,
  "action": "challenge",
  "userAgent": "python-requests/2.28.0"
}
```

**Assessment:** ⚠️ SQL injection attempt - challenged

---

## What to Document in Incident Reports

When documenting security analysis findings:

1. **Bot Score Distribution:**
   - "All requests: Bot Score 1 (automated behavior)"
   - "Mixed: Bot Scores 1-15 (automated) and 40-60 (human-like)"
   - Include `botScoreSrcName` if relevant (e.g., "Heuristics detection")

2. **WAF Score Ranges:**
   - "WAF Attack Score: 86-100 (clean)"
   - "WAF XSS/SQLi/RCE Scores: 65-99 (no attack patterns)"
   - Include `wafAttackScoreClass` for context

3. **Attack Patterns Detected:**
   - "WAF XSS Score: 8-15 (XSS attack patterns detected)"
   - "WAF SQLi Score: 12-25 (SQL injection attempts)"
   - Specify which attack type(s) were detected

4. **Cloudflare Actions:**
   - "All requests: action 'skip' (allowed through)"
   - "Majority blocked: action 'block' (N requests)"
   - Note if action doesn't match scores (e.g., skip with low scores)

5. **Final Assessment:**
   - ✅ "Traffic is 100% legitimate [backend service/user] traffic"
   - ⚠️ "Traffic is partially suspicious - [X%] shows attack patterns"
   - 🚨 "Traffic is attack traffic - immediate escalation required"

---

## Decision Tree

```
Query firewall events for JA4 fingerprint
  ↓
Check botScore and WAF scores
  ↓
  ├─ Bot Score 1-10 + WAF Scores 65-100 + Action "skip"
  │  → ✅ Legitimate backend traffic
  │  → Continue to user analysis (Step 8)
  │
  ├─ Bot Score 30-99 + WAF Scores 65-100
  │  → ✅ Legitimate user traffic
  │  → Continue to user analysis (Step 8)
  │
  └─ WAF Scores <50 (especially XSS/SQLi/RCE)
     → ⚠️ Attack traffic detected
     → Escalate immediately
     → Skip user analysis
     → Recommend WAF rules/blocking
```

---

## Related Cloudflare Documentation

- [Cloudflare Bot Management](https://developers.cloudflare.com/bots/)
- [WAF Attack Score](https://developers.cloudflare.com/waf/about/waf-attack-score/)
- [Security Analytics](https://developers.cloudflare.com/analytics/security-analytics/)
