# Step 2d: Discover from Rollbar — Error Tracking

This step runs concurrently with PagerDuty, Datadog, and Cloudflare discovery.

Use the Skill tool to invoke "rollbar-reader" with args "QUERY". Then read and return the report contents from .rollbar-reader-tmp/report.md

**Extract from report** (`.rollbar-reader-tmp/report.md`):
- Active error items and occurrence counts → **What**
- Affected services and environments → **Who**
- Stack traces, error patterns, and error-to-deploy correlation → **Culprit**
- Occurrence trends and new item activations → severity input
- Error timeline (first/last seen) → **When**

**On failure**: Note reason (e.g. "rollbar CLI not installed or not configured"). Use `AskUserQuestion` to ask the user for error tracking details manually (e.g. error spikes, stack traces, affected services), then continue.
