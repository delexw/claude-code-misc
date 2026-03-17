# Step 1: Connect and Navigate

Navigate to the target URL and take an initial interactive snapshot.

- If the user provides a URL, navigate directly
- If they mention "current page" or "this page", read the current page text first

## Authentication (do this FIRST, before navigating)

When the target page may require login:

1. **Check the system prompt** for any guidance on where to find credentials.
2. **Check environment variables** — run `env | grep -iE 'USER|PASS|LOGIN|AUTH|TOKEN|CRED|SECRET|API_KEY' | sed 's/=.*/=***/'` to list available credential env vars (mask values in output).
3. Navigate to TARGET_URL and take an initial snapshot.
4. If the snapshot shows a login page:
   - Use discovered credentials to fill the login form and submit
   - Re-snapshot after login to get fresh refs before proceeding
5. If no credentials are found and no system prompt guidance exists, use the `AskUserQuestion` tool to ask where credentials can be found (skip this in autonomous mode). If credentials cannot be obtained, **skip the entire skill** and note: "Skipped — page requires authentication but no credentials found."
