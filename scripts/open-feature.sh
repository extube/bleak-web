#!/usr/bin/env bash
# Open a feature — the ONE command for the process agent.
# Usage:
#   open-feature.sh <slug> [depends] --as <processHash>
#   open-feature.sh <slug> [depends] --title "<title>" --as <processHash>
#
# Does all of the following in one step:
#   1. generates the worker instance hash + session record
#      (session.sh new worker process - -),
#   2. creates the branch feature/<hash>-<slug> from dev (no checkout),
#   3. auto-creates the task card (status todo) linked to hash + branch,
#      with the worker's session record updated to point at both.
# The process fills the acceptance criteria right after:
#   python3 scripts/task.py criteria <id> "<criteria text>" --as <processHash>
# Run from the repository root.
set -euo pipefail

usage() {
  grep '^#' "$0" | sed 's/^# \{0,1\}//'
  exit 1
}

HEX_RE='^[0-9a-f]{8}$'
SLUG_RE='^[a-z0-9][a-z0-9-]*$'

[ $# -ge 1 ] || usage

slug=""
depends="-"
title=""
process=""

while [ $# -gt 0 ]; do
  case "$1" in
    --title)
      [ $# -ge 2 ] || usage
      title="$2"; shift 2 ;;
    --as)
      [ $# -ge 2 ] || usage
      process="$2"; shift 2 ;;
    -*)
      usage ;;
    *)
      if [ -z "$slug" ]; then slug="$1"
      elif [ "$depends" = "-" ]; then depends="$1"
      else usage
      fi
      shift ;;
  esac
done

[ -n "$slug" ] || usage
[ -n "$process" ] || usage
[[ "$slug" =~ $SLUG_RE ]] || { echo "error: slug must be lowercase letters/digits with hyphens, got '$slug'" >&2; exit 1; }
[[ "$process" =~ $HEX_RE ]] || { echo "error: process hash must be 8 lowercase hex chars" >&2; exit 1; }

git rev-parse --verify --quiet refs/heads/dev >/dev/null \
  || { echo "error: branch 'dev' not found" >&2; exit 1; }

# 1. Worker instance hash + session record (task/branch set below).
hash=$(scripts/session.sh new worker process - -)

branch="feature/${hash}-${slug}"
if git show-ref --verify --quiet "refs/heads/${branch}"; then
  echo "error: branch '${branch}' already exists" >&2
  exit 1
fi

# 2. Branch from dev, no checkout (the worker checks it out itself).
git branch "${branch}" dev

# 3. Task card, linked to hash + branch (status todo).
[ -n "$title" ] || title=$(echo "$slug" | tr '-' ' ')
task_id=$(python3 scripts/task.py new "$title" "-" "$branch" "$hash" "$depends" --as "$process")

scripts/session.sh set "$hash" task "$task_id"
scripts/session.sh set "$hash" branch "$branch"
scripts/log.sh log "$hash" "feature opened by process ${process}: branch ${branch} (from dev), task ${task_id} (todo) — criteria to be filled by process"

echo "hash:     $hash"
echo "task:     $task_id"
echo "branch:   $branch"
echo "next:     python3 scripts/task.py criteria $task_id \"<criteria>\" --as $process"
echo "then:     spawn the worker (hash $hash) with task id + branch name"
