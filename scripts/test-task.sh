#!/usr/bin/env bash
# Test suite for scripts/task.py and scripts/open-feature.sh.
# Runs entirely in a scratch directory under /tmp/opencode — the real
# tasks.db, branches and session records are never touched.
# Usage: scripts/test-task.sh   (from the repository root)
set -u

REPO="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
SCRATCH="$(mktemp -d /tmp/opencode/tasktest.XXXXXX)"
trap 'rm -rf "$SCRATCH"' EXIT

PASS=0
FAIL=0
LAST_OUT=""

run_ok() { # run_ok <desc> <command...> — command must succeed
  local desc="$1"; shift
  if LAST_OUT=$("$@" 2>&1); then
    PASS=$((PASS+1))
  else
    FAIL=$((FAIL+1)); echo "FAIL (expected ok): $desc"
    echo "$LAST_OUT" | sed 's/^/    /'
  fi
}

run_ko() { # run_ko <desc> <command...> — command must fail
  local desc="$1"; shift
  if LAST_OUT=$("$@" 2>&1); then
    FAIL=$((FAIL+1)); echo "FAIL (expected error): $desc"
    echo "$LAST_OUT" | sed 's/^/    /'
  else
    PASS=$((PASS+1))
  fi
}

contains() { # contains <desc> <pattern> — LAST_OUT must match
  if echo "$LAST_OUT" | grep -qE "$2"; then
    PASS=$((PASS+1))
  else
    FAIL=$((FAIL+1)); echo "FAIL (missing '$2'): $1"
    echo "$LAST_OUT" | sed 's/^/    /'
  fi
}

not_contains() { # not_contains <desc> <pattern> — LAST_OUT must NOT match
  if echo "$LAST_OUT" | grep -qE "$2"; then
    FAIL=$((FAIL+1)); echo "FAIL (unexpected '$2'): $1"
    echo "$LAST_OUT" | sed 's/^/    /'
  else
    PASS=$((PASS+1))
  fi
}

# ---------------------------------------------------------------- task.py ---
cd "$SCRATCH"
cp "$REPO/scripts/task.py" .
T="python3 $SCRATCH/task.py"

run_ok "init" $T init

run_ok "new: create task" $T new "Feature A" "-" feature/aaaa0001-feat-a aaaa0001 - --as 51a3949b
run_ko "new: bad worker hash" $T new "X" "-" feature/12345678-x 1234567 - --as 51a3949b
run_ko "new: branch prefix mismatch" $T new "X" "-" feature/bbbb0002-x aaaa0001 - --as 51a3949b
run_ko "new: not a feature branch" $T new "X" "-" dev aaaa0001 - --as 51a3949b
run_ko "new: missing --as" $T new "X" "-" feature/aaaa0001-x aaaa0001 -

run_ko "assign-tester is deprecated" $T assign-tester 1 eeee1111 --as 51a3949b

# --- green path (todo -> in-progress -> ready-for-merge -> merged -> done)
run_ko "process cannot start the task" $T status 1 in-progress --as 51a3949b
run_ok "worker takes the task" $T status 1 in-progress --as aaaa0001
run_ko "unknown actor rejected" $T status 1 ready-for-merge --as ffff0009
run_ko "process cannot hand over" $T status 1 ready-for-merge --as 51a3949b
run_ok "worker hands over (MR auto-opens)" $T status 1 ready-for-merge --as aaaa0001
run_ok "show 1 after handover" $T show 1
contains "ready-for-merge auto-opens the MR" "mr #1 auto-opened for branch feature/aaaa0001-feat-a"
contains "MR record exists as open" "mr #1 \[open\] feature/aaaa0001-feat-a"
run_ko "worker cannot merge" $T status 1 merged --as aaaa0001
run_ok "process merges (the merge moment)" $T status 1 merged --as 51a3949b
run_ko "worker cannot record CI" $T ci 1 green --as aaaa0001
run_ok "CI green auto-closes the task" $T ci 1 green --as 51a3949b
contains "green CI auto-closes" "auto-closed \(done\)"
run_ko "done is terminal" $T status 1 in-progress --as aaaa0001
run_ko "done is terminal (process)" $T status 1 merged --as 51a3949b
run_ok "show 1" $T show 1
contains "MR record shown as merged+green" "mr #1 \[merged\] feature/aaaa0001-feat-a.*ci=green"
contains "show: status done" "status: +done"
not_contains "show: no tester line" "tester:"

# --- red path (merge -> ci red -> bug -> reopen -> second round -> done)
run_ok "new task 2" $T new "Feature B" "TZ-2" feature/bbbb0002-feat-b bbbb0002 - --as 51a3949b
run_ok "criteria set by process" $T criteria 2 "criterion one; criterion two" --as 51a3949b
contains "criteria recorded" "criteria set"
run_ko "worker cannot set criteria" $T criteria 2 "x" --as bbbb0002
run_ok "show 2 has criteria" $T show 2
contains "criteria shown" "criterion one"

run_ok "worker takes task 2" $T status 2 in-progress --as bbbb0002
run_ko "blocked without --reason rejected" $T status 2 blocked --as bbbb0002
run_ko "blocked with empty --reason rejected" $T status 2 blocked --as bbbb0002 --reason "  "
run_ok "worker self-blocks with reason" $T status 2 blocked --as bbbb0002 --reason "missing swagger section"
run_ko "worker cannot reopen" $T status 2 in-progress --as bbbb0002
run_ok "process reopens blocked" $T status 2 in-progress --as 51a3949b
run_ok "worker hands over again" $T status 2 ready-for-merge --as bbbb0002
run_ok "process merges task 2" $T status 2 merged --as 51a3949b
run_ko "ci red without logfile rejected" $T ci 2 red --as 51a3949b
run_ko "invalid CI result rejected" $T ci 2 orange --as 51a3949b
run_ok "CI red recorded" $T ci 2 red docs/bugs/ci-feat-b-1.log --as 51a3949b
run_ko "bug by worker rejected (QA is CI by process)" $T bug 2 bbbb0002 fix-ci-red high docs/bugs/ci-feat-b-1.log --as bbbb0002
run_ko "bug rejected while todo" $T bug 3 cccc0003 fix-early low docs/bugs/ci-x-1.log --as 51a3949b
run_ko "bug with missing context file rejected" $T bug 2 bbbb0002 fix-ci-red high docs/bugs/nonexistent.log --as 51a3949b
mkdir -p docs/bugs && echo "make: *** error" > docs/bugs/ci-feat-b-1.log
run_ok "bug filed by process with context" $T bug 2 bbbb0002 fix-ci-red high docs/bugs/ci-feat-b-1.log --as 51a3949b
contains "bug branch recorded" "bug/bbbb0002-fix-ci-red"
run_ok "process reopens after CI red + bug" $T status 2 in-progress --as 51a3949b
run_ok "second handover opens MR #2" $T status 2 ready-for-merge --as bbbb0002
run_ok "second merge" $T status 2 merged --as 51a3949b
run_ok "second CI green closes task 2" $T ci 2 green --as 51a3949b
run_ok "show 2" $T show 2
contains "first MR marked failed+red" "mr #2 \[failed\].*ci=red"
contains "second MR merged+green" "mr #3 \[merged\].*ci=green"
contains "bug_branches listed" "bug/bbbb0002-fix-ci-red"
contains "task branch points at fix branch" "branch: +bug/bbbb0002-fix-ci-red"

# --- invalid transitions & statuses
run_ok "new task 3" $T new "Feature C" "-" feature/cccc0003-feat-c cccc0003 - --as 51a3949b
run_ko "todo -> ready-for-merge rejected" $T status 3 ready-for-merge --as cccc0003
run_ko "todo -> merged rejected" $T status 3 merged --as 51a3949b
run_ko "todo -> done rejected" $T status 3 done --as 51a3949b
run_ko "todo -> blocked rejected" $T status 3 blocked --as cccc0003 --reason x
run_ko "old status ready-for-test rejected" $T status 3 ready-for-test --as cccc0003
run_ko "old status testing rejected" $T status 3 testing --as cccc0003
# merged -> in-progress requires a bug filed after the merge moment
run_ok "task 3 handover + merge" sh -c "$T status 3 in-progress --as cccc0003 && $T status 3 ready-for-merge --as cccc0003 && $T status 3 merged --as 51a3949b"
run_ko "reopen without a filed bug rejected" $T status 3 in-progress --as 51a3949b
run_ko "list with invalid status rejected" $T list wat
run_ok "list" $T list
contains "list shows task 3 merged" "^3 +merged.*Feature C"

# ------------------------------------------------------- open-feature.sh ---
cd "$SCRATCH"
git clone --quiet "$REPO" openfeat 2>/dev/null
cd openfeat
cp "$REPO"/scripts/*.sh "$REPO/scripts/task.py" scripts/
git branch dev origin/dev 2>/dev/null || true

run_ok "open-feature creates hash+branch+task" \
  scripts/open-feature.sh test-feature - --as 51a3949b
contains "open-feature prints a hash" "^hash: +[0-9a-f]{8}"
contains "open-feature prints a task id" "^task: +[0-9]+"
contains "open-feature prints the branch" "^branch: +feature/[0-9a-f]{8}-test-feature"
HASH=$(echo "$LAST_OUT" | sed -n 's/^hash: *//p')
TASKID=$(echo "$LAST_OUT" | sed -n 's/^task: *//p')
BRANCH=$(echo "$LAST_OUT" | sed -n 's/^branch: *//p')
run_ok "branch exists (no checkout)" git show-ref --verify --quiet "refs/heads/$BRANCH"
[ "$(git branch --show-current)" != "$BRANCH" ] && PASS=$((PASS+1)) \
  || { FAIL=$((FAIL+1)); echo "FAIL: open-feature checked out the branch"; }
run_ok "session record exists" test -f "docs/sessions/$HASH.md"
grep -q "^task: $TASKID$" "docs/sessions/$HASH.md" && PASS=$((PASS+1)) \
  || { FAIL=$((FAIL+1)); echo "FAIL: session record task not linked"; }
grep -q "^branch: $BRANCH$" "docs/sessions/$HASH.md" && PASS=$((PASS+1)) \
  || { FAIL=$((FAIL+1)); echo "FAIL: session record branch not linked"; }
grep -q "^role: worker$" "docs/sessions/$HASH.md" && PASS=$((PASS+1)) \
  || { FAIL=$((FAIL+1)); echo "FAIL: session record role not worker"; }
grep -q "^parent: process$" "docs/sessions/$HASH.md" && PASS=$((PASS+1)) \
  || { FAIL=$((FAIL+1)); echo "FAIL: session record parent not process"; }
run_ok "task exists as todo" python3 scripts/task.py list todo
contains "open-feature task is todo on the right branch" "$BRANCH"
run_ok "criteria fill-in works" python3 scripts/task.py criteria "$TASKID" "it works" --as 51a3949b
run_ko "open-feature rejects bad process hash" scripts/open-feature.sh other --as zzzz
run_ko "open-feature rejects bad slug" scripts/open-feature.sh "Bad Slug" - --as 51a3949b
run_ok "open-feature with --title" scripts/open-feature.sh titled --title "Custom Title" --as 51a3949b
LAST_TITLE_OUT="$LAST_OUT"
T2=$(echo "$LAST_TITLE_OUT" | sed -n 's/^task: *//p')
run_ok "titled task exists" python3 scripts/task.py show "$T2"
contains "custom title used" "Custom Title"

# ---------------------------------------------------------------- summary ---
echo
echo "task.py + open-feature.sh test suite: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ] || exit 1
