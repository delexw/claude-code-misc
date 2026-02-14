# Jira Ticket Viewer Rules

## Validation Rules
- Issue keys: Must match pattern `[A-Z]+-\d+` exactly
- Required: `$ARGUMENTS` must contain a valid issue key

## Error Handling

- **CLI Not Installed**: Use `AskUserQuestion` — guide user to install jira-cli: https://github.com/ankitpokhrel/jira-cli?tab=readme-ov-file#getting-started
- **CLI Not Configured**: Use `AskUserQuestion` — guide user to run `jira init` and configure their Jira instance
- **Invalid Issue Key**: "Issue key format invalid. Use PROJECT-123 format (uppercase letters, hyphen, numbers)."
- **Issue Not Found**: "Issue '{key}' not found. Verify the issue key exists in your Jira instance."
- **Auth Error**: Use `AskUserQuestion` — guide user to reconfigure credentials via `jira init`
- **JIRA_API_TOKEN Not Set** (attachment download): Use `AskUserQuestion` — guide user to set `JIRA_API_TOKEN` environment variable with their Jira API token (generate at https://id.atlassian.com/manage-profile/security/api-tokens). Do NOT block the workflow — ticket content is still available, only attachments are skipped.
- **Attachment Download Failed**: Warn but continue — attachment download is best-effort
