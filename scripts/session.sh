#!/usr/bin/env bash
# Session records for bleak-node front-end: one file per sub-agent instance.
# Usage:
#   session.sh new <role> <parent> <task> <branch>   # creates session, prints hash
#   session.sh set <hash> <field> <value>
#   session.sh close <hash> <done|failed|blocked> "<report>"
#   session.sh list [status]
set -euo pipefail

DIR="docs/sessions"
TEMPLATE="$DIR/_template.md"
HEX_RE='^[0-9a-f]{8}$'

usage() {
  grep '^#' "$0" | sed 's/^# \{0,1\}//'
  exit 1
}

new_hash() { od -An -N4 -tx1 /dev/urandom | tr -d ' \n'; }

now_utc() { date -u +%Y-%m-%dT%H:%M:%SZ; }

valid_status() {
  case "$1" in
    running|done|failed|blocked) return 0 ;;
    *) return 1 ;;
  esac
}

field_value() { sed -n "s/^${1}: //p" "$2"; }

[ $# -ge 1 ] || usage
cmd="$1"; shift

case "$cmd" in
  new)
    [ $# -eq 4 ] || usage
    role="$1"; parent="$2"; task="$3"; branch="$4"
    [ -f "$TEMPLATE" ] || { echo "error: template $TEMPLATE missing" >&2; exit 1; }
    hash=$(new_hash)
    while [ -e "$DIR/$hash.md" ]; do hash=$(new_hash); done
    {
      echo "hash: $hash"
      echo "role: $role"
      echo "opencode-session: PENDING"
      echo "parent: $parent"
      echo "task: $task"
      echo "branch: $branch"
      echo "status: running"
      echo "started: $(now_utc)"
      echo "finished: -"
      echo ""
      echo "## Report"
      echo ""
    } > "$DIR/$hash.md"
    echo "$hash"
    ;;
  set)
    [ $# -eq 3 ] || usage
    hash="$1"; field="$2"; value="$3"
    [[ "$hash" =~ $HEX_RE ]] || { echo "error: hash must be 8 lowercase hex chars" >&2; exit 1; }
    file="$DIR/$hash.md"
    [ -f "$file" ] || { echo "error: session $hash not found" >&2; exit 1; }
    if [ "$field" = "status" ] && ! valid_status "$value"; then
      echo "error: invalid status '$value' (running|done|failed|blocked)" >&2
      exit 1
    fi
    if grep -q "^${field}: " "$file"; then
      sed -i "s|^${field}: .*|${field}: ${value}|" "$file"
    elif [ "$field" = "status" ]; then
      echo "$field: $value" >> "$file"
    else
      echo "error: unknown field '$field'" >&2
      exit 1
    fi
    ;;
  close)
    [ $# -eq 3 ] || usage
    hash="$1"; status="$2"; report="$3"
    [[ "$hash" =~ $HEX_RE ]] || { echo "error: hash must be 8 lowercase hex chars" >&2; exit 1; }
    valid_status "$status" || { echo "error: invalid status '$status' (running|done|failed|blocked)" >&2; exit 1; }
    [ "$status" != "running" ] || { echo "error: close status must be done|failed|blocked" >&2; exit 1; }
    file="$DIR/$hash.md"
    [ -f "$file" ] || { echo "error: session $hash not found" >&2; exit 1; }
    sed -i "s|^status: .*|status: ${status}|" "$file"
    sed -i "s|^finished: .*|finished: $(now_utc)|" "$file"
    printf '%s\n' "$report" >> "$file"
    ;;
  list)
    [ $# -le 1 ] || usage
    filter="${1:-}"
    header=1
    for f in "$DIR"/*.md; do
      [ -f "$f" ] || continue
      base=$(basename "$f" .md)
      [ "$base" = "_template" ] && continue
      if [ -n "$filter" ]; then
        st=$(field_value status "$f") || true
        [ "$st" = "$filter" ] || continue
      fi
      if [ "$header" = 1 ]; then
        printf '%-9s %-10s %-8s %-9s %-40s %s\n' hash role status task branch report
        printf '%.0s-' {1..100}; echo
        header=0
      fi
      printf '%-9s %-10s %-8s %-9s %-40s %s\n' \
        "$base" \
        "$(field_value role "$f")" \
        "$(field_value status "$f")" \
        "$(field_value task "$f")" \
        "$(field_value branch "$f")" \
        "$(sed -n '/^## Report$/,$p' "$f" | tail -n +2 | head -n 1 | cut -c1-60)"
    done
    ;;
  *)
    usage
    ;;
esac
