#!/bin/bash
# UserPromptSubmit hook — scans user prompt for secrets before sending to Claude

LOG_FILE="$HOME/.claude/logs/scan-prompt.log"
mkdir -p "$(dirname "$LOG_FILE")"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" >> "$LOG_FILE"
}

INPUT=$(cat)
PROMPT=$(echo "$INPUT" | jq -r '.prompt // ""')

if [ -z "$PROMPT" ]; then
  log "Empty prompt, skipping scan"
  exit 0
fi

PROMPT_LEN=${#PROMPT}
log "Scanning prompt (${PROMPT_LEN} chars)"

TMPDIR=$(mktemp -d /tmp/claude-prompt-scan-XXXXXX)
printf '%s' "$PROMPT" > "$TMPDIR/content"

GITLEAKS_OUTPUT=$(gitleaks dir --config ~/.gitleaks.toml --redact --no-banner --log-level error "$TMPDIR" 2>&1)
EXIT_CODE=$?
rm -rf "$TMPDIR"

log "gitleaks exit code: $EXIT_CODE"
if [ -n "$GITLEAKS_OUTPUT" ]; then
  log "gitleaks output: $GITLEAKS_OUTPUT"
else
  log "gitleaks output: (none)"
fi

if [ $EXIT_CODE -ne 0 ]; then
  log "BLOCKED: secret detected in prompt"
  jq -n '{
    "decision": "block",
    "reason": "Secret detected in your prompt. Remove credentials and try again.",
    "hookSpecificOutput": {
      "hookEventName": "UserPromptSubmit"
    }
  }'
else
  log "ALLOWED: prompt is clean"
fi

exit 0
