# Step 1: Connect to Browser

List available pages and select the right one, or navigate to the target URL.

```
Use mcp__chrome-devtools__list_pages to see open tabs
Use mcp__chrome-devtools__navigate_page to go to the target URL
```

- If the user provides a URL, navigate directly
- If they mention "current page" or "this page", list pages and select the appropriate tab

## Authentication

When testing pages that require login:

- The browser session should already be authenticated
- If credentials are available via environment variables, use those (never hardcode credentials)
- If not authenticated, navigate to the login page first and use `mcp__chrome-devtools__fill`
  and `mcp__chrome-devtools__click` to complete the login flow
