# Confluence Page Viewer Rules

## Validation Rules
- URL must match one of these Confluence page formats:
  - Standard: `https://[domain].atlassian.net/wiki/spaces/SPACE/pages/ID/Title`
  - Short link: `https://[domain].atlassian.net/wiki/x/ENCODED`
- Required: `$ARGUMENTS` must contain a valid Confluence page URL

## Short Link Resolution
The confluence CLI does **not** support short links (`/wiki/x/...`) directly — they return 404.
Short links use a base64-encoded little-endian page ID. To resolve:

```bash
# Extract the encoded part from the URL (e.g., "BADROQ" from /wiki/x/BADROQ)
# Pad with "==" if needed, decode base64, convert little-endian bytes to page ID
python3 -c "import base64; data = base64.b64decode('ENCODED=='); print(int.from_bytes(data, 'little'))"
```

Then use the decoded numeric page ID with the CLI: `confluence read <pageId>`

## Command Restrictions
- Only read-only commands from `confluence-cli` are permitted:
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

- **CLI Not Available**: Use `AskUserQuestion` — guide user to install `confluence-cli` and ensure it is available in PATH: https://github.com/pchuri/confluence-cli
- **CLI Not Configured**: Use `AskUserQuestion` — guide user to configure their Confluence instance credentials
- **Page Not Found**: "Page not found. Verify the URL exists and you have access permissions."
- **Auth Error**: Use `AskUserQuestion` — guide user to reconfigure credentials
