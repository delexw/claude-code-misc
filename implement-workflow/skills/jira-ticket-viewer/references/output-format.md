# Output Format

Parse the `jira issue view --raw` JSON and format into the following structured output.

## Standard Fields

```
{key}: {summary}
Type: {issuetype.name} | Status: {status.name} | Priority: {priority.name}
Assignee: {assignee.displayName} | Reporter: {reporter.displayName}
Parent/Epic: {parent.key} — {parent.fields.summary}
Sprint: {customfield_10020[last].name} ({customfield_10020[last].state})
Created: {created} | Updated: {updated}
Labels: {labels[]} | Components: {components[].name}
```

## Description

Convert the ADF (Atlassian Document Format) `fields.description` to readable text:
- Walk `content` nodes recursively
- Extract `text` values from `text` nodes
- Convert `heading` nodes to markdown headings
- Convert `bulletList`/`orderedList` to markdown lists
- Convert `codeBlock` to markdown code blocks
- Convert `inlineCard` to markdown links `[url](url)`
- Note `media` nodes as `[image: {alt}]` or `[attachment: {id}]`

## Design Links

Extract from `customfield_10031` (may be null):

```
Design Links:
- {displayName}: {url}
```

## Attachments

Extract from `fields.attachment`:

From `parse-ticket.js`:
```
Attachments:
- {filename} ({mimeType}, {size})
```

Download paths are output separately by `download-attachment.js` (step 5 in SKILL.md). Include those paths in the final output alongside the parsed ticket.

## Issue Links

Extract from `fields.issuelinks`:

```
Linked Issues:
- {type.outward}: {outwardIssue.key} — {outwardIssue.fields.summary} [{outwardIssue.fields.status.name}]
```

## Omit

- Null or empty fields — do not include in output
- Internal custom fields with no meaningful content (rank, SLA, cost category, etc.)
