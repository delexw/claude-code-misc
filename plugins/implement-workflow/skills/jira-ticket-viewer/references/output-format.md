# Output Format

`parse-ticket.js` reads the `jira issue view --raw` JSON from stdin and outputs a structured JSON object to stdout.

## JSON Schema

```json
{
  "key": "PROJ-123",
  "summary": "Ticket summary text",
  "type": "Story",
  "status": "In Progress",
  "priority": "High",
  "resolution": null,
  "assignee": "John Doe",
  "reporter": "Jane Doe",
  "parent": {
    "key": "PROJ-100",
    "summary": "Parent epic summary"
  },
  "sprint": {
    "name": "Sprint 1",
    "state": "active"
  },
  "created": "2024-01-01",
  "updated": "2024-01-15",
  "dueDate": null,
  "labels": ["backend", "api"],
  "components": ["auth"],
  "description": "Markdown-converted description text",
  "links": {
    "figma": [
      { "url": "https://figma.com/...", "displayName": "Design name" }
    ],
    "confluence": [
      { "url": "https://envato.atlassian.net/wiki/spaces/..." }
    ],
    "github": [
      { "url": "https://github.com/..." }
    ]
  },
  "attachments": [
    { "filename": "screen.png", "mimeType": "image/png", "size": "1.5 MB" }
  ],
  "linkedIssues": [
    { "relationship": "blocks", "key": "PROJ-456", "summary": "Linked issue summary", "status": "Open" }
  ],
  "commentSummary": {
    "decisions": ["Use approach X for Y"],
    "requirements": ["Must handle edge case A"],
    "risks": ["Breaking change risk for downstream consumers"]
  }
}
```

## Field Details

### Standard Fields
- `key`, `summary` — issue key and title
- `type`, `status`, `priority`, `resolution` — issue metadata (null if not set)
- `assignee`, `reporter` — display names (null if unassigned)
- `parent` — object with `key` and `summary`, or null
- `sprint` — object with `name` and `state` from `customfield_10020[last]`, or null
- `created`, `updated` — ISO date strings truncated to date portion
- `dueDate` — due date string or null
- `labels`, `components` — arrays of strings (empty array if none)

### Description
- ADF (Atlassian Document Format) `fields.description` converted to markdown text
- Returns null if no description

### Links
- Object with categorized URL arrays, keyed by type: `figma`, `confluence`, `github`, `other`
- Collected from two sources:
  - `customfield_10031` (design links) — includes `displayName` when available
  - `inlineCard` nodes in the description ADF
- Each entry is `{ url, displayName? }` — `displayName` is only present for design links
- Empty object `{}` if no links found
- Duplicates across sources are deduplicated by URL

### Attachments
- Extracted from `fields.attachment`
- Array of `{ filename, mimeType, size }` objects (empty array if none)
- `size` is human-readable (e.g. "1.5 MB")
- Download paths are output separately by `download-attachment.js` (step 5 in SKILL.md)

### Linked Issues
- Extracted from `fields.issuelinks`
- Array of `{ relationship, key, summary, status }` objects (empty array if none)
- Both outward and inward links are included

### Comment Summary
- Agent-interpreted summary of `fields.comment.comments` (see [comment-rules.md](comment-rules.md))
- Object with categorized arrays: `decisions`, `requirements`, `risks`
- Only actionable, current information — outdated proposals, resolved questions, and noise are discarded
- `null` if no comments or all comments are non-actionable

## Omit
- Null or empty fields use null (scalars) or empty arrays (collections)
- Internal custom fields with no meaningful content (rank, SLA, cost category, etc.) are excluded
