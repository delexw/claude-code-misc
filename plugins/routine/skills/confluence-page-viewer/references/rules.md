# Confluence Page Viewer Rules

## Validation Rules
- URL must match Confluence page format: `https://[domain].atlassian.net/wiki/spaces/...`
- Required: `$ARGUMENTS` must contain a valid Confluence page URL

## Command Restrictions
- Only read-only commands from `npx confluence-cli` are permitted:
  - `read` — Read a page by ID or URL
  - `info` — Get information about a page
  - `search` — Search for pages
  - `spaces` — List all spaces
  - `stats` — Show usage statistics
  - `find` — Find a page by title
  - `comments` — List comments for a page
  - `children` — List child pages
  - `attachments` — List attachments for a page (listing only, not downloading)
- Do NOT use any mutating commands.

## Error Handling

- **CLI Not Available**: Use `AskUserQuestion` — guide user to ensure Node.js/npx is available and `confluence-cli` can be run via `npx confluence-cli`: https://github.com/pchuri/confluence-cli
- **CLI Not Configured**: Use `AskUserQuestion` — guide user to configure their Confluence instance credentials
- **Page Not Found**: "Page not found. Verify the URL exists and you have access permissions."
- **Auth Error**: Use `AskUserQuestion` — guide user to reconfigure credentials
