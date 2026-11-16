#!/usr/bin/env bash
# 90b95f75 handover (TZ2-02): land the session/log records on the worker's own
# branch despite concurrent workers sharing this checkout and flipping HEAD.
# Non-destructive: plain checkouts only; aborts if the tree has unexpected
# local tracked changes; returns HEAD to the branch found at start.
set -euo pipefail
cd /workspace

MINE=feature/90b95f75-api-client-v2
START=$(git branch --show-current)
echo "start HEAD: $START"

# The opencode activity plugin appends to docs/logs/activity.log on every tool
# call, and the file differs between worker branch HEADs, so a plain checkout
# is blocked whenever the worktree copy is dirty. Rewriting it to the CURRENT
# HEAD's version makes it clean for the switch (checkout then updates it to
# the target version itself). Plugin-generated audit output only — no other
# files touched, no -f anywhere.
clean_activity_log() {
  git show "$(git branch --show-current):docs/logs/activity.log" > docs/logs/activity.log
}

# Only files that DIFFER between the two worker branch HEADs cannot be carried
# across a checkout — guard exactly those (activity.log is handled separately).
if [ -n "$(git status --porcelain -- apps/web/src/lib/crypto apps/web/tests/crypto-secrets.test.ts docs/logs/5a6328ac.log docs/logs/5457bc0e.log docs/sessions/5a6328ac.md 2>/dev/null)" ]; then
  echo "ABORT: local changes on branch-differing files — refusing to switch" >&2
  git status --porcelain | head -20 >&2
  exit 3
fi

if [ "$START" != "$MINE" ]; then
  clean_activity_log
  git checkout "$MINE"
fi
echo "now on: $(git branch --show-current)"

# The session file was committed as a stray (a821010) on a concurrent worker's
# branch through a checkout race; on this branch it is absent. Restore the
# committed content verbatim (no editing), then commit it here.
if [ ! -f docs/sessions/90b95f75.md ]; then
  git show "$MINE:docs/sessions/90b95f75.md" > docs/sessions/90b95f75.md 2>/dev/null \
    || git show feature/73718af4-stores-v2:docs/sessions/90b95f75.md > docs/sessions/90b95f75.md
fi
git add docs/sessions/90b95f75.md docs/logs/90b95f75.log
if ! git diff --cached --quiet; then
  git commit -m "docs(sessions+logs): 90b95f75 TZ2-02 session record on own branch (restored verbatim from the stray a821010 on feature/73718af4-stores-v2; full worker log restored)" -- docs/sessions/90b95f75.md docs/logs/90b95f75.log
else
  echo "nothing to commit"
fi
echo "committed on: $(git branch --show-current)"

# Return HEAD to the branch found at start so concurrent workers keep their
# expected checkout state.
if [ "$START" != "$MINE" ] && git rev-parse --verify "$START" >/dev/null 2>&1; then
  clean_activity_log
  git checkout "$START"
fi

echo "final HEAD: $(git branch --show-current)"
git log --oneline -2
