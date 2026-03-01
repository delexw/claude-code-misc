# Step 1: Get Investigation Parameters

Use `AskUserQuestion` to collect required information if not already provided.

## Time range

If `$ARGUMENTS[2]` (time range) was provided, use it directly — **do not ask the user again**.

Otherwise, ask: "What time range should I investigate? (Please include your timezone)"

Accept formats like: "NZ 4am-5am", "today 9:00-10:00 AEDT", "yesterday 14:00-15:00 UTC", "2025-06-01 04:00-05:00 NZST"

Always present results in the current agent timezone. Convert to UTC for Cloudflare queries.

## Zone ID

Use `$ARGUMENTS[0]` (domain) and `$ARGUMENTS[1]` (zone ID) passed when invoking the skill. If not provided, ask the user for the domain and zone ID.
