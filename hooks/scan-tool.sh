#!/bin/bash
# PreToolUse hook — scans Write/Edit/Bash tool inputs for secrets before execution

INPUT=$(cat)
TOOL=$(echo "$INPUT" | jq -r '.tool_name // ""')

case "$TOOL" in
  Write)
    CONTENT=$(echo "$INPUT" | jq -r '.tool_input.content // ""')
    ;;
  Edit)
    CONTENT=$(echo "$INPUT" | jq -r '(.tool_input.old_string // "") + "\n" + (.tool_input.new_string // "")')
    ;;
  Bash|PowerShell)
    CONTENT=$(echo "$INPUT" | jq -r '.tool_input.command // ""')
    ;;
  NotebookEdit)
    CONTENT=$(echo "$INPUT" | jq -r '.tool_input.new_source // ""')
    ;;
  WebFetch)
    CONTENT=$(echo "$INPUT" | jq -r '.tool_input.url // ""')
    ;;
  WebSearch)
    CONTENT=$(echo "$INPUT" | jq -r '.tool_input.query // ""')
    ;;
  *)
    exit 0
    ;;
esac

[ -z "$CONTENT" ] && exit 0

TMPDIR=$(mktemp -d /tmp/claude-tool-scan-XXXXXX)
printf '%s' "$CONTENT" > "$TMPDIR/content"

gitleaks dir --config ~/.gitleaks.toml --redact --no-banner --log-level error "$TMPDIR" > /dev/null 2>&1
EXIT_CODE=$?
rm -rf "$TMPDIR"

if [ $EXIT_CODE -ne 0 ]; then
  jq -n '{
    "hookSpecificOutput": {
      "hookEventName": "PreToolUse",
      "permissionDecision": "deny",
      "permissionDecisionReason": "Secret detected in tool input. Remove credentials before proceeding."
    }
  }'
fi

exit 0
