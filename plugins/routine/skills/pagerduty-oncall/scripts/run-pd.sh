#!/usr/bin/env bash
# run-pd.sh — Single-command wrapper for PagerDuty CLI operations.
# Runs a pd command, saves raw output, then parses it via parse-pd.js.
# Handles progress-message noise and retries automatically.
#
# Usage:
#   run-pd.sh <command> <outdir> [pd-args...]
#
# Commands:
#   auth      <outdir>                        — Authenticate with $PAGEDUTY_API_TOKEN
#   ep        <outdir>                        — List escalation policies
#   incidents <outdir> --since=X --until=Y    — List incidents (pass pd flags as extra args)
#   log       <outdir> <incident_id>          — Get incident log
#   notes     <outdir> <incident_id>          — Get incident notes
#   analytics <outdir> <incident_id>          — Get incident analytics

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PARSER="$SCRIPT_DIR/parse-pd.js"
MAX_RETRIES=3

CMD="${1:?Usage: run-pd.sh <command> <outdir> [args...]}"
OUTDIR="${2:?Usage: run-pd.sh <command> <outdir> [args...]}"
shift 2

# Create output directories
mkdir -p "$OUTDIR/raw/logs" "$OUTDIR/raw/notes" "$OUTDIR/raw/analytics" \
         "$OUTDIR/logs" "$OUTDIR/notes" "$OUTDIR/analytics"

# run_pd_and_parse <parse_type> <raw_file> <parsed_file> <pd_command...>
run_pd_and_parse() {
  local parse_type="$1"
  local raw_file="$2"
  local parsed_file="$3"
  shift 3

  local attempt=0
  while [ $attempt -lt $MAX_RETRIES ]; do
    attempt=$((attempt + 1))

    # Run pd command, capture stdout (includes progress messages + JSON)
    if "$@" > "$raw_file" 2>&1; then
      : # command succeeded
    else
      echo "  [attempt $attempt/$MAX_RETRIES] pd command failed, retrying..." >&2
      sleep 1
      continue
    fi

    # Parse raw output
    if node "$PARSER" "$parse_type" < "$raw_file" > "$parsed_file" 2>/dev/null; then
      echo "  OK: $parsed_file"
      return 0
    else
      echo "  [attempt $attempt/$MAX_RETRIES] parse failed, retrying..." >&2
      sleep 1
    fi
  done

  echo "  FAILED after $MAX_RETRIES attempts: $parsed_file" >&2
  echo "[]" > "$parsed_file"
  return 1
}

case "$CMD" in
  auth)
    echo "==> Authenticating..."
    pd auth add --token "$PAGEDUTY_API_TOKEN"
    echo "  OK: authenticated"
    ;;

  ep)
    echo "==> Listing escalation policies..."
    run_pd_and_parse ep \
      "$OUTDIR/raw/ep-list.json" \
      "$OUTDIR/ep-list.json" \
      pd ep list --json
    ;;

  incidents)
    echo "==> Listing incidents..."
    run_pd_and_parse incident \
      "$OUTDIR/raw/incidents.json" \
      "$OUTDIR/incidents.json" \
      pd incident list --json \
        --statuses=open --statuses=closed \
        --statuses=triggered --statuses=acknowledged --statuses=resolved \
        "$@"
    ;;

  log)
    INCIDENT_ID="${1:?Usage: run-pd.sh log <outdir> <incident_id>}"
    echo "==> Getting log for $INCIDENT_ID..."
    run_pd_and_parse log \
      "$OUTDIR/raw/logs/$INCIDENT_ID.json" \
      "$OUTDIR/logs/$INCIDENT_ID.json" \
      pd incident log -i "$INCIDENT_ID" --json
    ;;

  notes)
    INCIDENT_ID="${1:?Usage: run-pd.sh notes <outdir> <incident_id>}"
    echo "==> Getting notes for $INCIDENT_ID..."
    run_pd_and_parse notes \
      "$OUTDIR/raw/notes/$INCIDENT_ID.json" \
      "$OUTDIR/notes/$INCIDENT_ID.json" \
      pd incident notes -i "$INCIDENT_ID" --output=json
    ;;

  analytics)
    INCIDENT_ID="${1:?Usage: run-pd.sh analytics <outdir> <incident_id>}"
    echo "==> Getting analytics for $INCIDENT_ID..."
    run_pd_and_parse analytics \
      "$OUTDIR/raw/analytics/$INCIDENT_ID.json" \
      "$OUTDIR/analytics/$INCIDENT_ID.json" \
      pd incident analytics -i "$INCIDENT_ID" --json
    ;;

  *)
    echo "Unknown command: $CMD" >&2
    echo "Commands: auth, ep, incidents, log, notes, analytics" >&2
    exit 1
    ;;
esac
