#!/usr/bin/env bash
# Log a UTC-timestamped line for a sub-agent instance.
# Usage: log.sh log <hash> "<message>"
# Role is read from docs/sessions/<hash>.md; falls back to <unknown>.
set -euo pipefail

usage() {
  grep '^#' "$0" | sed 's/^# \{0,1\}//'
  exit 1
}

[ $# -ge 1 ] || usage
cmd="$1"; shift

case "$cmd" in
  log)
    [ $# -eq 2 ] || usage
    hash="$1"; message="$2"
    [[ "$hash" =~ ^[0-9a-f]{8}$ ]] || { echo "error: hash must be 8 lowercase hex chars" >&2; exit 1; }
    role="<unknown>"
    if [ -f "docs/sessions/${hash}.md" ]; then
      r=$(sed -n 's/^role: //p' "docs/sessions/${hash}.md")
      [ -n "$r" ] && role="$r"
    fi
    mkdir -p docs/logs
    printf '%s [%s] %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$role" "$message" >> "docs/logs/${hash}.log"
    ;;
  *)
    usage
    ;;
esac
