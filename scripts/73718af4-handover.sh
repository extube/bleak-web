#!/usr/bin/env bash
# 73718af4 handover, step 2 (TZ2-04): commit the worker's session record, log
# and handover script on the worker's own branch (same shared-checkout
# discipline as the gate run; non-destructive, guarded).
set -euo pipefail
cd /workspace

MINE=feature/73718af4-stores-v2
START=$(git branch --show-current)
echo "start HEAD: $START"

DIRTY=$(git status --porcelain -- apps packages .opencode AGENTS.md Makefile docs/TZ.md docs/ARCHITECTURE.md docs/Concept.md docs/DESIGN.md 2>/dev/null || true)
if [ -n "$DIRTY" ]; then
  echo "ABORT: unexpected local changes outside docs/logs — refusing to switch" >&2
  echo "$DIRTY" | head -20 >&2
  exit 3
fi

clean_activity_log() {
  git show "$(git branch --show-current):docs/logs/activity.log" > docs/logs/activity.log
}

clean_activity_log
git checkout -f "$MINE"
NOW=$(git branch --show-current)
if [ "$NOW" != "$MINE" ]; then
  echo "ABORT: lost the branch switch race (HEAD: $NOW)" >&2
  exit 4
fi

git add docs/logs/73718af4.log docs/sessions/73718af4.md scripts/73718af4-handover.sh
if ! git diff --cached --quiet; then
  git commit -m "docs(sessions+logs+scripts): 73718af4 TZ2-04 session record, worker log, gate-run handover script (shared-checkout race discipline)" -- docs/logs/73718af4.log docs/sessions/73718af4.md scripts/73718af4-handover.sh
else
  echo "nothing to commit"
fi

if [ "$START" != "$MINE" ] && git rev-parse --verify "$START" >/dev/null 2>&1; then
  clean_activity_log
  git checkout -f "$START"
fi
echo "final HEAD: $(git branch --show-current)"
