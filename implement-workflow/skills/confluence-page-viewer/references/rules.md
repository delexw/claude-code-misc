# Confluence Page Viewer Rules

## Validation Rules
- URL must match Confluence page format: `https://[domain].atlassian.net/wiki/spaces/...`
- Required: `$ARGUMENTS` must contain a valid Confluence page URL

## Error Handling

- **CLI Not Installed**: Use `AskUserQuestion` — guide user to install confluence-cli: https://github.com/pchuri/confluence-cli
- **CLI Not Configured**: Use `AskUserQuestion` — guide user to configure their Confluence instance credentials
- **Page Not Found**: "Page not found. Verify the URL exists and you have access permissions."
- **Auth Error**: Use `AskUserQuestion` — guide user to reconfigure credentials
