#!/usr/bin/env python3
"""Task database interface for bleak-web (stdlib only, SQLite WAL).

Every mutation is appended to the task_log table. The lifecycle/authority
rules are enforced here — the DB is the single source of truth for task state.

QA is CI, run by the process (make lint/test/build on dev after the merge);
there is no tester step. Lifecycle:

    todo -> in-progress -> ready-for-merge -> merged -> done
                       \\-> blocked                 \\-> in-progress (CI red)

Authority: process = created_by, worker = worker_hash. When the worker sets
ready-for-merge, an MR record (merges table) is opened automatically — the
worker does one action only. The process merges (ready-for-merge -> merged,
this IS the merge moment), runs CI and records the outcome with `ci`:
green auto-closes the task (merged -> done); red leaves the task merged so
the process can file a bug (with the saved docs/bugs/ci-<slug>-N.log as
error context) and reopen it (merged -> in-progress).
"""

import re
import sqlite3
import sys
from datetime import datetime, timezone

DB_PATH = "tasks.db"

NOW = lambda: datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

SCHEMA = """
CREATE TABLE IF NOT EXISTS tasks (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    hash         TEXT NOT NULL,
    title        TEXT NOT NULL,
    branch       TEXT NOT NULL,
    tz_section   TEXT NOT NULL DEFAULT '',
    criteria     TEXT NOT NULL DEFAULT '',
    status       TEXT NOT NULL DEFAULT 'todo'
                 CHECK (status IN ('todo','in-progress','ready-for-merge',
                                   'merged','done','blocked')),
    created_by   TEXT NOT NULL,
    worker_hash  TEXT NOT NULL,
    tester_hash  TEXT NOT NULL DEFAULT '',
    depends_on   TEXT NOT NULL DEFAULT '-',
    bug_branches TEXT NOT NULL DEFAULT '',
    created_at   TEXT NOT NULL,
    updated_at   TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS task_log (
    id     INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER NOT NULL,
    actor  TEXT NOT NULL,
    action TEXT NOT NULL,
    detail TEXT NOT NULL DEFAULT '',
    at     TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS bugs (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id    INTEGER NOT NULL REFERENCES tasks(id),
    hash       TEXT NOT NULL,
    slug       TEXT NOT NULL,
    file       TEXT NOT NULL DEFAULT '',
    severity   TEXT NOT NULL DEFAULT 'medium',
    status     TEXT NOT NULL DEFAULT 'open',
    created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS merges (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id   INTEGER NOT NULL REFERENCES tasks(id),
    branch    TEXT NOT NULL,
    status    TEXT NOT NULL DEFAULT 'open'
              CHECK (status IN ('open','merged','failed')),
    opened_at TEXT NOT NULL,
    merged_at TEXT NOT NULL DEFAULT '',
    ci_result TEXT NOT NULL DEFAULT '',
    ci_log    TEXT NOT NULL DEFAULT ''
);
"""

# Transitions: (from_status, to_status) -> role required
# Role 'process' = task.created_by
# Role 'worker'  = task.worker_hash
# (tester_hash is kept as a column but unused: QA is CI run by the process.)
TRANSITIONS = {
    ("todo", "in-progress"): "worker",
    ("in-progress", "ready-for-merge"): "worker",
    ("in-progress", "blocked"): "worker",
    ("ready-for-merge", "merged"): "process",
    ("merged", "done"): "process",
    ("merged", "in-progress"): "process",
    ("blocked", "in-progress"): "process",
}

# Transitions that require a mandatory --reason "<text>" flag.
REQUIRES_REASON = {("in-progress", "blocked")}

# merged -> in-progress requires a bug filed after the merge moment.
REQUIRES_BUG = {("merged", "in-progress")}

VALID_STATUSES = ["todo", "in-progress", "ready-for-merge", "merged", "done", "blocked"]
HEX8 = re.compile(r"^[0-9a-f]{8}$")
SLUG = re.compile(r"^[a-z0-9][a-z0-9-]*$")


def die(msg, code=1):
    print(f"error: {msg}", file=sys.stderr)
    sys.exit(code)


def connect():
    con = sqlite3.connect(DB_PATH)
    con.row_factory = sqlite3.Row
    con.execute("PRAGMA journal_mode=WAL")
    con.execute("PRAGMA foreign_keys=ON")
    return con


def log(con, task_id, actor, action, detail=""):
    con.execute(
        "INSERT INTO task_log (task_id, actor, action, detail, at) VALUES (?,?,?,?,?)",
        (task_id, actor, action, detail, NOW()),
    )


def get_task(con, task_id):
    try:
        task_id = int(task_id)
    except ValueError:
        die(f"invalid task id '{task_id}' (expected a number)")
    row = con.execute("SELECT * FROM tasks WHERE id=?", (task_id,)).fetchone()
    if row is None:
        die(f"task {task_id} not found")
    return row


def actor_for(task, role):
    return {
        "process": task["created_by"],
        "worker": task["worker_hash"],
    }[role]


def parse_as(args, role_hint):
    as_idx = args.index("--as") if "--as" in args else -1
    if as_idx == -1:
        die(f"missing --as <{role_hint}>")
    actor = args[as_idx + 1] if len(args) > as_idx + 1 else ""
    return actor, args[:as_idx]


def latest_merge(con, task_id, statuses=("open", "merged", "failed")):
    qmarks = ",".join("?" * len(statuses))
    return con.execute(
        f"SELECT * FROM merges WHERE task_id=? AND status IN ({qmarks})"
        " ORDER BY id DESC LIMIT 1",
        (task_id, *statuses),
    ).fetchone()


# --- commands ---------------------------------------------------------------

def cmd_init(args):
    if args:
        die("init takes no arguments")
    con = connect()
    con.executescript(SCHEMA)
    con.commit()
    con.close()
    print(f"initialized empty task database at {DB_PATH}")


def cmd_new(args):
    # new <title> <tz_section> <branch> <worker_hash> <depends_on> --as <processHash>
    process, positional = parse_as(args, "processHash")
    if len(positional) != 5:
        die("usage: task.py new <title> <tz_section> <branch> <worker_hash> <depends_on> --as <processHash>")
    title, tz_section, branch, worker_hash, depends_on = positional
    if not HEX8.match(process):
        die(f"process hash '{process}' must be 8 lowercase hex chars")
    if not HEX8.match(worker_hash):
        die(f"worker hash '{worker_hash}' must be 8 lowercase hex chars")
    branch = branch.strip()
    if branch == "-":
        die("branch '-' is not a valid branch name")
    if not branch.startswith("feature/"):
        die(f"feature branch must start with 'feature/', got '{branch}'")
    if not branch.startswith(f"feature/{worker_hash}-"):
        die(f"branch must be 'feature/{worker_hash}-<description>', got '{branch}'")
    depends_on = depends_on or "-"

    con = connect()
    con.executescript(SCHEMA)
    ts = NOW()
    cur = con.execute(
        "INSERT INTO tasks (hash, title, branch, tz_section, status, created_by,"
        " worker_hash, depends_on, created_at, updated_at)"
        " VALUES (?,?,?,?,?,?,?,?,?,?)",
        (worker_hash, title, branch, tz_section, "todo", process, worker_hash, depends_on, ts, ts),
    )
    task_id = cur.lastrowid
    log(con, task_id, process, "create", f"task created as todo, branch={branch}")
    con.commit()
    con.close()
    print(task_id)


def cmd_criteria(args):
    # criteria <id> <acceptance criteria text> --as <processHash>
    process, positional = parse_as(args, "processHash")
    if len(positional) < 2:
        die("usage: task.py criteria <id> <acceptance criteria text> --as <processHash>")
    if not HEX8.match(process):
        die(f"process hash '{process}' must be 8 lowercase hex chars")
    task_id = positional[0]
    text = " ".join(positional[1:]).strip()
    if not text:
        die("criteria text must be non-empty")

    con = connect()
    task = get_task(con, task_id)
    if task["created_by"] != process:
        die(f"only the process ({task['created_by']}) may set criteria for task {task['id']}, not '{process}'")
    con.execute("UPDATE tasks SET criteria=?, updated_at=? WHERE id=?",
                (text, NOW(), task["id"]))
    log(con, task["id"], process, "criteria", text)
    con.commit()
    con.close()
    print(f"task {int(task_id)}: criteria set ({len(text)} chars)")


def cmd_assign_tester(args):
    die("assign-tester is deprecated: QA is CI run by the process; "
        "the tester_hash column is kept but unused")


def open_mr(con, task):
    con.execute(
        "INSERT INTO merges (task_id, branch, status, opened_at) VALUES (?,?,?,?)",
        (task["id"], task["branch"], "open", NOW()),
    )
    return con.execute("SELECT id FROM merges WHERE task_id=? ORDER BY id DESC LIMIT 1",
                       (task["id"],)).fetchone()["id"]


def cmd_status(args):
    # status <id> <new-status> --as <hash> [--reason "<text>"]
    actor = None
    reason = None
    positional = []
    i = 0
    while i < len(args):
        arg = args[i]
        if arg == "--as":
            if i + 1 >= len(args):
                die("--as requires a hash value")
            actor = args[i + 1]
            i += 2
        elif arg == "--reason":
            if i + 1 >= len(args):
                die('--reason requires a quoted text value')
            reason = args[i + 1]
            i += 2
        elif arg.startswith("--"):
            die(f"unknown flag '{arg}' (supported: --as <hash>, --reason \"<text>\")")
        else:
            positional.append(arg)
            i += 1
    if actor is None:
        die("missing --as <hash>")
    if len(positional) != 2:
        die('usage: task.py status <id> <new-status> --as <hash> [--reason "<text>"]')
    task_id, new_status = positional
    if not HEX8.match(actor):
        die(f"actor hash '{actor}' must be 8 lowercase hex chars")
    if new_status not in VALID_STATUSES:
        die(f"invalid status '{new_status}'. Valid: {', '.join(VALID_STATUSES)}")
    if reason is not None and not reason.strip():
        die('--reason must be a non-empty text explaining what is missing')

    con = connect()
    task = get_task(con, task_id)
    cur = task["status"]
    rule = TRANSITIONS.get((cur, new_status))
    if rule is None:
        allowed = [to for (frm, to) in TRANSITIONS if frm == cur]
        hint = f" from '{cur}' you may only go to: {', '.join(allowed)}" if allowed \
            else f" status '{cur}' is terminal; no transitions allowed"
        die(f"invalid transition '{cur}' -> '{new_status}'.{hint}")
    if actor != actor_for(task, rule):
        die(f"transition {cur} -> {new_status} requires the {rule} "
            f"(hash {actor_for(task, rule)}), not '{actor}'")
    if (cur, new_status) in REQUIRES_REASON and (reason is None or not reason.strip()):
        die(f'transition {cur} -> {new_status} requires --reason "<text>" '
            f"describing the missing permission or input")
    if (cur, new_status) in REQUIRES_BUG:
        # A bug must have been filed after the merge moment (task_log ids are
        # strictly increasing, so this is robust against second-granularity
        # timestamps).
        merge_log = con.execute(
            "SELECT id FROM task_log WHERE task_id=? AND action='status'"
            " AND detail LIKE '%-> merged | mr %' ORDER BY id DESC LIMIT 1",
            (task["id"],),
        ).fetchone()
        merge_log_id = merge_log["id"] if merge_log else 0
        bug = con.execute(
            "SELECT id FROM task_log WHERE task_id=? AND action='bug' AND id > ?"
            " ORDER BY id DESC LIMIT 1",
            (task["id"], merge_log_id),
        ).fetchone()
        if bug is None:
            die(f"transition {cur} -> {new_status} requires a bug filed after the "
                f"merge moment (CI red): save the CI output to "
                f"docs/bugs/ci-<slug>-N.log and run "
                f"'task.py bug {task['id']} <hash> <slug> <severity> <file> "
                f"--as {task['created_by']}' first")

    detail = f"{cur} -> {new_status}"
    if reason:
        detail += f" | reason: {reason}"
    extra = ""
    if (cur, new_status) == ("in-progress", "ready-for-merge"):
        mr_id = open_mr(con, task)
        extra = f" | mr #{mr_id} auto-opened for branch {task['branch']}"
    elif (cur, new_status) == ("ready-for-merge", "merged"):
        mr = latest_merge(con, task["id"], ("open",))
        if mr is None:
            die(f"no open MR record for task {task['id']} — cannot record the merge")
        con.execute("UPDATE merges SET status='merged', merged_at=? WHERE id=?",
                    (NOW(), mr["id"]))
        extra = f" | mr #{mr['id']} merged"
    con.execute("UPDATE tasks SET status=?, updated_at=? WHERE id=?",
                (new_status, NOW(), task["id"]))
    log(con, task["id"], actor, "status", detail + extra)
    con.commit()
    con.close()
    suffix = f" (reason: {reason})" if reason else ""
    print(f"task {int(task_id)}: {cur} -> {new_status}{suffix}")


def cmd_bug(args):
    # bug <id> <hash> <slug> <severity> <context-file> --as <processHash>
    # The context file is the saved CI output, conventionally
    # docs/bugs/ci-<slug>-N.log; it must already exist on disk.
    process, positional = parse_as(args, "processHash")
    if len(positional) != 5:
        die("usage: task.py bug <id> <hash> <slug> <severity> <context-file> --as <processHash>")
    task_id, worker_hash, slug, severity, context_file = positional
    if not HEX8.match(process):
        die(f"process hash '{process}' must be 8 lowercase hex chars")
    if not HEX8.match(worker_hash):
        die(f"bug branch hash '{worker_hash}' must be 8 lowercase hex chars")
    if not SLUG.match(slug):
        die(f"invalid slug '{slug}' (lowercase letters/digits, hyphens)")
    if severity not in ("low", "medium", "high", "critical"):
        die(f"invalid severity '{severity}' (low|medium|high|critical)")
    context_file = context_file.strip()
    if not context_file:
        die("context file is required (the saved CI output, e.g. docs/bugs/ci-<slug>-N.log)")

    con = connect()
    task = get_task(con, task_id)
    if task["created_by"] != process:
        die(f"only the process ({task['created_by']}) may register bugs for task "
            f"{task['id']} — QA is CI run by the process, not '{process}'")
    if task["status"] not in ("merged", "in-progress"):
        die(f"bugs are filed from CI failures: task {task['id']} is "
            f"'{task['status']}', expected 'merged' (or 'in-progress' on a reopened task)")
    import os
    if not os.path.isfile(context_file):
        die(f"context file '{context_file}' does not exist — save the CI output "
            f"first (docs/bugs/ci-<slug>-N.log)")
    branch = f"bug/{worker_hash}-{slug}"
    cur = con.execute(
        "INSERT INTO bugs (task_id, hash, slug, file, severity, status, created_at)"
        " VALUES (?,?,?,?,?,?,?)",
        (task["id"], worker_hash, slug, context_file, severity, "open", NOW()),
    )
    bug_id = cur.lastrowid
    branches = [b.strip() for b in task["bug_branches"].split(",") if b.strip()]
    if branch not in branches:
        branches.append(branch)
    con.execute("UPDATE tasks SET bug_branches=?, branch=?, updated_at=? WHERE id=?",
                (", ".join(branches), branch, NOW(), task["id"]))
    log(con, task["id"], process, "bug",
        f"bug #{bug_id} {branch} severity={severity} file={context_file}")
    con.commit()
    con.close()
    print(f"bug {bug_id} registered for task {int(task_id)} -> branch {branch} "
          f"(context: {context_file})")


def cmd_ci(args):
    # ci <id> <green|red> [logfile] --as <processHash>
    # green: the CI passed on dev — the task is closed automatically
    #        (merged -> done). red: the MR record is marked failed; file a
    #        bug and reopen the task (merged -> in-progress).
    process, positional = parse_as(args, "processHash")
    if len(positional) not in (2, 3):
        die("usage: task.py ci <id> <green|red> [logfile] --as <processHash>")
    if not HEX8.match(process):
        die(f"process hash '{process}' must be 8 lowercase hex chars")
    task_id, result = positional[0], positional[1]
    logfile = positional[2] if len(positional) == 3 else ""
    if result not in ("green", "red"):
        die(f"invalid CI result '{result}' (green|red)")
    if result == "red" and not logfile:
        die("a red CI run requires a logfile (the saved docs/bugs/ci-<slug>-N.log path)")

    con = connect()
    task = get_task(con, task_id)
    if task["created_by"] != process:
        die(f"only the process ({task['created_by']}) may record CI results for "
            f"task {task['id']}, not '{process}'")
    if task["status"] != "merged":
        die(f"CI results are recorded on merged tasks: task {task['id']} is "
            f"'{task['status']}', expected 'merged'")
    mr = latest_merge(con, task["id"], ("merged",))
    if mr is None:
        die(f"no merged MR record for task {task['id']} — cannot record CI")
    if result == "green":
        con.execute("UPDATE merges SET ci_result='green', ci_log=? WHERE id=?",
                    (logfile, mr["id"]))
        con.execute("UPDATE tasks SET status='done', updated_at=? WHERE id=?",
                    (NOW(), task["id"]))
        log(con, task["id"], process, "ci",
            f"green | mr #{mr['id']} | log={logfile or '(inline)'} | "
            f"task auto-closed merged -> done")
        con.commit()
        con.close()
        print(f"task {int(task_id)}: CI green on mr #{mr['id']} — auto-closed (done)")
    else:
        con.execute("UPDATE merges SET status='failed', ci_result='red', ci_log=? WHERE id=?",
                    (logfile, mr["id"]))
        log(con, task["id"], process, "ci",
            f"red | mr #{mr['id']} | log={logfile}")
        con.commit()
        con.close()
        print(f"task {int(task_id)}: CI red on mr #{mr['id']} — file a bug "
              f"(docs/bugs/ci-<slug>-N.log saved) and reopen the task")


def blocked_reason(con, task_id):
    """Latest 'reason:' stored with a -> blocked transition, or ''. """
    row = con.execute(
        "SELECT detail FROM task_log WHERE task_id=? AND action='status'"
        " AND detail LIKE '%-> blocked%' ORDER BY id DESC LIMIT 1",
        (task_id,),
    ).fetchone()
    if row is None:
        return ""
    detail = row["detail"]
    return detail.split("| reason: ", 1)[1].split(" |", 1)[0] if "| reason: " in detail else ""


def cmd_list(args):
    if len(args) > 1:
        die("usage: task.py list [status]")
    con = connect()
    if args:
        status = args[0]
        if status not in VALID_STATUSES:
            die(f"invalid status '{status}'. Valid: {', '.join(VALID_STATUSES)}")
        rows = con.execute("SELECT * FROM tasks WHERE status=? ORDER BY id", (status,)).fetchall()
    else:
        rows = con.execute("SELECT * FROM tasks ORDER BY id").fetchall()
    reasons = {r["id"]: blocked_reason(con, r["id"]) if r["status"] == "blocked" else ""
               for r in rows}
    con.close()
    if not rows:
        print("no tasks")
        return
    print(f"{'id':<4} {'status':<16} {'worker':<9} {'branch':<40} title")
    print("-" * 100)
    for r in rows:
        print(f"{r['id']:<4} {r['status']:<16} {r['worker_hash']:<9} "
              f"{r['branch']:<40} {r['title']}")
        if reasons.get(r["id"]):
            print(f"{'':<4} {'':<16} {'':<9} blocked reason: {reasons[r['id']]}")


def cmd_show(args):
    if len(args) != 1:
        die("usage: task.py show <id>")
    con = connect()
    t = get_task(con, args[0])
    bugs = con.execute("SELECT * FROM bugs WHERE task_id=? ORDER BY id", (t["id"],)).fetchall()
    mrs = con.execute("SELECT * FROM merges WHERE task_id=? ORDER BY id", (t["id"],)).fetchall()
    tlog = con.execute("SELECT * FROM task_log WHERE task_id=? ORDER BY id", (t["id"],)).fetchall()
    breason = blocked_reason(con, t["id"]) if t["status"] == "blocked" else ""
    con.close()

    print(f"task {t['id']}: {t['title']}")
    print(f"  status:      {t['status']}")
    if t["status"] == "blocked" and breason:
        print(f"  blocked reason: {breason}")
    print(f"  branch:      {t['branch']}")
    print(f"  tz_section:  {t['tz_section']}")
    print(f"  criteria:    {t['criteria'] or '(none)'}")
    print(f"  created_by:  {t['created_by']} (process)")
    print(f"  worker:      {t['worker_hash']}")
    print(f"  depends_on:  {t['depends_on']}")
    print(f"  bug_branches:{(' ' + t['bug_branches']) if t['bug_branches'] else ' (none)'}")
    print(f"  created_at:  {t['created_at']}")
    print(f"  updated_at:  {t['updated_at']}")
    if mrs:
        print("  merges (MR records):")
        for m in mrs:
            ci = f" ci={m['ci_result']}" if m["ci_result"] else ""
            logf = f" log={m['ci_log']}" if m["ci_log"] else ""
            merged = f" merged_at={m['merged_at']}" if m["merged_at"] else ""
            print(f"    mr #{m['id']} [{m['status']}] {m['branch']}{merged}{ci}{logf}")
    if bugs:
        print("  bugs:")
        for b in bugs:
            print(f"    #{b['id']} [{b['severity']}] {b['status']} bug/{b['hash']}-{b['slug']}"
                  f" (context: {b['file']})")
    if tlog:
        print("  history:")
        for e in tlog:
            print(f"    {e['at']} [{e['actor']}] {e['action']}: {e['detail']}")


COMMANDS = {
    "init": cmd_init,
    "new": cmd_new,
    "criteria": cmd_criteria,
    "assign-tester": cmd_assign_tester,
    "status": cmd_status,
    "bug": cmd_bug,
    "ci": cmd_ci,
    "list": cmd_list,
    "show": cmd_show,
}


def main():
    argv = sys.argv[1:]
    if not argv or argv[0] in ("-h", "--help"):
        print(__doc__.strip())
        print("\ncommands: " + " | ".join(COMMANDS))
        sys.exit(0)
    cmd = argv[0]
    if cmd not in COMMANDS:
        die(f"unknown command '{cmd}'. Available: {', '.join(COMMANDS)}")
    COMMANDS[cmd](argv[1:])


if __name__ == "__main__":
    main()
