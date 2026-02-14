# Comment Interpretation Rules

When comments are present, read them chronologically and produce a `commentSummary` object that replaces the raw `comments` array in the output JSON.

## Reading Order

- Process comments **oldest to newest** — this is the natural conversation flow
- Later comments **supersede** earlier ones on the same topic
- If an earlier proposal was rejected or revised in a later comment, only include the final outcome

## What to Extract

Categorize comment content into these fields (omit any that have no entries):

| Field | What belongs here |
|---|---|
| `decisions` | Confirmed architectural or implementation choices (e.g. "Decided to use Redis for caching") |
| `requirements` | Additional requirements or acceptance criteria not in the description |
| `risks` | Identified risks or concerns that affect how the code should be implemented |

Each field is an array of concise strings (one statement per entry).

## What to Discard

- **Outdated proposals** — suggestions that were later rejected, revised, or superseded
- **Resolved questions** — questions that were answered in a follow-up comment (extract the answer as a `decision` or `requirement` instead)
- **Process noise** — status updates like "moved to In Progress", "assigned to X", automated bot comments
- **Social messages** — greetings, thanks, acknowledgements with no technical content

## Output

- Replace the `comments` array with a `commentSummary` object (see [output-format.md](output-format.md) for schema)
- If all comments are noise/outdated and nothing is actionable, set `commentSummary` to `null`
