#!/bin/bash
# PostToolUse / Stop / SubagentStop / Elicitation / ElicitationResult / TaskCompleted
# Scans tool responses and assistant messages for accidental secret exposure

INPUT=$(cat)
EVENT=$(echo "$INPUT" | jq -r '.hook_event_name // ""')

case "$EVENT" in
  PostToolUse)
    CONTENT=$(echo "$INPUT" | jq -r '.tool_response // ""')
    ;;
  Stop|SubagentStop)
    CONTENT=$(echo "$INPUT" | jq -r '.last_assistant_message // ""')
    ;;
  Elicitation)
    CONTENT=$(echo "$INPUT" | jq -r '.prompt // .message // .request // ""')
    ;;
  ElicitationResult)
    CONTENT=$(echo "$INPUT" | jq -r '.result // .response // .value // ""')
    ;;
  TaskCompleted)
    CONTENT=$(echo "$INPUT" | jq -r '(.task_subject // "") + "\n" + (.task_description // "")')
    ;;
  *)
    exit 0
    ;;
esac

[ -z "$CONTENT" ] && exit 0

TMPDIR=$(mktemp -d /tmp/claude-response-scan-XXXXXX)
printf '%s' "$CONTENT" > "$TMPDIR/content"

gitleaks dir --config ~/.gitleaks.toml --redact --no-banner --log-level error "$TMPDIR" > /dev/null 2>&1
EXIT_CODE=$?
rm -rf "$TMPDIR"

if [ $EXIT_CODE -ne 0 ]; then
  case "$EVENT" in
    PostToolUse)
      jq -n '{
        "decision": "block",
        "reason": "SECURITY: Tool output contains potential secrets or credentials. Do not repeat, log, or reference the actual values — acknowledge the operation result without revealing sensitive data."
      }'
      ;;
    Stop|SubagentStop)
      jq -n '{
        "decision": "block",
        "reason": "SECURITY: Response contains potential secrets or credentials. Regenerate without including sensitive values — use variable names or placeholders instead."
      }'
      ;;
    Elicitation)
      jq -n '{
        "action": "decline"
      }'
      ;;
    ElicitationResult)
      echo "SECURITY: Elicitation response contains potential secrets. Use environment variables or a secure store instead of passing credentials directly." >&2
      exit 2
      ;;
    TaskCompleted)
      jq -n '{
        "continue": false,
        "stopReason": "SECURITY: Completed task output contains potential secrets or credentials. Do not repeat or reference the actual values in subsequent messages."
      }'
      ;;
  esac
fi

exit 0
