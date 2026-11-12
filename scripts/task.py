#!/usr/bin/env python3
"""Task database interface for bleak-node front-end (stdlib only, SQLite WAL).

Every mutation is appended to the task_log table. The lifecycle/authority
rules are enforced here — the DB is the single source of truth for task state.
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
                 CHECK (status IN ('todo','in-progress','ready-for-test',
                                   'testing','done','blocked')),
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
"""

# Transitions: (from_status, to_status) -> role required
# Role 'planner'  = task.created_by
# Role 'worker'   = task.worker_hash
# Role 'tester'   = task.tester_hash
TRANSITIONS = {
    ("todo", "in-progress"): "worker",
    ("in-progress", "ready-for-test"): "worker",
    ("ready-for-test", "testing"): "tester",
    ("testing", "done"): "tester",
    ("testing", "blocked"): "tester",
    ("blocked", "in-progress"): "planner",
}

VALID_STATUSES = ["todo", "in-progress", "ready-for-test", "testing", "done", "blocked"]
HEX8 = re.compile(r"^[0-9a-f]{8}$")


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
        "planner": task["created_by"],
        "worker": task["worker_hash"],
        "tester": task["tester_hash"],
    }[role]


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
    # new <title> <tz_section> <branch> <worker_hash> <depends_on> --as <plannerHash>
    as_idx = args.index("--as") if "--as" in args else -1
    if as_idx == -1:
        die("missing --as <plannerHash>")
    planner = args[as_idx + 1] if len(args) > as_idx + 1 else ""
    positional = args[:as_idx]
    if len(positional) != 5:
        die("usage: task.py new <title> <tz_section> <branch> <worker_hash> <depends_on> --as <plannerHash>")
    title, tz_section, branch, worker_hash, depends_on = positional
    if not HEX8.match(planner):
        die(f"planner hash '{planner}' must be 8 lowercase hex chars")
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
        (worker_hash, title, branch, tz_section, "todo", planner, worker_hash, depends_on, ts, ts),
    )
    task_id = cur.lastrowid
    log(con, task_id, planner, "create", f"task created as todo, branch={branch}")
    con.commit()
    con.close()
    print(task_id)


def cmd_assign_tester(args):
    as_idx = args.index("--as") if "--as" in args else -1
    if as_idx == -1:
        die("missing --as <plannerHash>")
    planner = args[as_idx + 1] if len(args) > as_idx + 1 else ""
    positional = args[:as_idx]
    if len(positional) != 2:
        die("usage: task.py assign-tester <id> <testerHash> --as <plannerHash>")
    task_id, tester_hash = positional
    if not HEX8.match(planner):
        die(f"planner hash '{planner}' must be 8 lowercase hex chars")
    if not HEX8.match(tester_hash):
        die(f"tester hash '{tester_hash}' must be 8 lowercase hex chars")

    con = connect()
    task = get_task(con, task_id)
    if task["created_by"] != planner:
        die(f"only the planner ({task['created_by']}) may assign a tester for task {task['id']}, not '{planner}'")
    con.execute("UPDATE tasks SET tester_hash=?, updated_at=? WHERE id=?",
                (tester_hash, NOW(), task["id"]))
    log(con, task["id"], planner, "assign-tester", f"tester={tester_hash}")
    con.commit()
    con.close()
    print(f"task {int(task_id)}: tester set to {tester_hash}")


def cmd_status(args):
    as_idx = args.index("--as") if "--as" in args else -1
    if as_idx == -1:
        die("missing --as <hash>")
    actor = args[as_idx + 1] if len(args) > as_idx + 1 else ""
    positional = args[:as_idx]
    if len(positional) != 2:
        die("usage: task.py status <id> <new-status> --as <hash>")
    task_id, new_status = positional
    if not HEX8.match(actor):
        die(f"actor hash '{actor}' must be 8 lowercase hex chars")
    if new_status not in VALID_STATUSES:
        die(f"invalid status '{new_status}'. Valid: {', '.join(VALID_STATUSES)}")

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
    con.execute("UPDATE tasks SET status=?, updated_at=? WHERE id=?",
                (new_status, NOW(), task["id"]))
    log(con, task["id"], actor, "status", f"{cur} -> {new_status}")
    con.commit()
    con.close()
    print(f"task {int(task_id)}: {cur} -> {new_status}")


def cmd_bug(args):
    as_idx = args.index("--as") if "--as" in args else -1
    if as_idx == -1:
        die("missing --as <testerHash>")
    tester = args[as_idx + 1] if len(args) > as_idx + 1 else ""
    positional = args[:as_idx]
    if len(positional) != 5:
        die("usage: task.py bug <id> <hash> <slug> <severity> <file> --as <testerHash>")
    task_id, worker_hash, slug, severity, file = positional
    if not HEX8.match(tester):
        die(f"tester hash '{tester}' must be 8 lowercase hex chars")
    if not HEX8.match(worker_hash):
        die(f"bug branch hash '{worker_hash}' must be 8 lowercase hex chars")
    if severity not in ("low", "medium", "high", "critical"):
        die(f"invalid severity '{severity}' (low|medium|high|critical)")

    con = connect()
    task = get_task(con, task_id)
    if task["tester_hash"] != tester:
        die(f"only the assigned tester ({task['tester_hash'] or 'unassigned'}) may register bugs for task {task['id']}, not '{tester}'")
    cur = con.execute(
        "INSERT INTO bugs (task_id, hash, slug, file, severity, status, created_at)"
        " VALUES (?,?,?,?,?,?,?)",
        (task["id"], worker_hash, slug, file, severity, "open", NOW()),
    )
    bug_id = cur.lastrowid
    branch = f"bug/{worker_hash}-{slug}"
    con.execute("UPDATE tasks SET bug_branches=?, updated_at=? WHERE id=?",
                (branch, NOW(), task["id"]))
    log(con, task["id"], tester, "bug", f"bug #{bug_id} {branch} severity={severity} file={file}")
    con.commit()
    con.close()
    print(f"bug {bug_id} registered for task {int(task_id)} -> branch {branch}")


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
    con.close()
    if not rows:
        print("no tasks")
        return
    print(f"{'id':<4} {'status':<15} {'worker':<9} {'tester':<9} {'branch':<40} title")
    print("-" * 100)
    for r in rows:
        print(f"{r['id']:<4} {r['status']:<15} {r['worker_hash']:<9} "
              f"{r['tester_hash'] or '-':<9} {r['branch']:<40} {r['title']}")


def cmd_show(args):
    if len(args) != 1:
        die("usage: task.py show <id>")
    con = connect()
    t = get_task(con, args[0])
    bugs = con.execute("SELECT * FROM bugs WHERE task_id=? ORDER BY id", (t["id"],)).fetchall()
    tlog = con.execute("SELECT * FROM task_log WHERE task_id=? ORDER BY id", (t["id"],)).fetchall()
    con.close()

    print(f"task {t['id']}: {t['title']}")
    print(f"  status:      {t['status']}")
    print(f"  branch:      {t['branch']}")
    print(f"  tz_section:  {t['tz_section']}")
    print(f"  criteria:    {t['criteria'] or '(none)'}")
    print(f"  created_by:  {t['created_by']} (planner)")
    print(f"  worker:      {t['worker_hash']}")
    print(f"  tester:      {t['tester_hash'] or '(unassigned)'}")
    print(f"  depends_on:  {t['depends_on']}")
    print(f"  bug_branches:{(' ' + t['bug_branches']) if t['bug_branches'] else ' (none)'}")
    print(f"  created_at:  {t['created_at']}")
    print(f"  updated_at:  {t['updated_at']}")
    if bugs:
        print("  bugs:")
        for b in bugs:
            print(f"    #{b['id']} [{b['severity']}] {b['status']} bug/{b['hash']}-{b['slug']} ({b['file']})")
    if tlog:
        print("  history:")
        for e in tlog:
            print(f"    {e['at']} [{e['actor']}] {e['action']}: {e['detail']}")


COMMANDS = {
    "init": cmd_init,
    "new": cmd_new,
    "assign-tester": cmd_assign_tester,
    "status": cmd_status,
    "bug": cmd_bug,
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
