# Step 1: Connect and Navigate

Navigate to the target URL and take an initial interactive snapshot.

- If the user provides a URL, navigate directly
- If they mention "current page" or "this page", read the current page text first

## Authentication

When testing pages that require login:

- Check if the page is already authenticated by reading the snapshot output
- If credentials are available via environment variables, use those (never hardcode credentials)
- If not authenticated, navigate to the login page, fill credentials, and submit
- Re-snapshot after login to get fresh refs before proceeding
