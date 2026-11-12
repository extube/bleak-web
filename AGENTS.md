# AGENTS.md

Rules for AI agents and contributors working in the **bleak-node front-end** repository.

## Communication & escalation policy

**The no-ask rule:** with the single exception below, no agent ever asks the
user anything. The user is only reached through the concept agent.

1. **Only the concept agent** (the single primary agent) may ask the user
   questions or request approvals — and only for decisions that genuinely
   block the working stream: concept approval, TZ review, per-feature gates,
   and escalation of grants it cannot make itself.
2. **Every other agent must never ask the user anything in chat.** If an
   agent lacks a permission for something, it first tries to solve the task
   without that permission (workaround within its allowed tools and files).
   Permission prompts ("ask" effects) must never be triggered by sub-agents.
3. **Advice requests** go to the architect, routed through the agent's
   process manager: worker/tester instances route via the **planner**,
   architect/design/devops instances route via the **concept agent**. Advice
   requests are logged via `scripts/log.sh` and marked **"ADVICE NEEDED"** in
   the agent's report.
4. **Self-block on impossibility:** if a task is impossible with the current
   permissions, the agent blocks its own card, closes its session record as
   `blocked`, and stops cleanly:
   ```bash
   python3 scripts/task.py status <id> blocked --as <hash> --reason "<missing>"
   ```
5. **Grants by the process manager:** the process manager of the blocked
   instance may grant the missing permission by editing the agent's
   `.opencode` config, provided the grant is reasonable:
   - the **planner** is the process manager of worker/tester instances and
     may edit exactly `.opencode/agents/worker.md` and
     `.opencode/agents/tester.md`;
   - the **concept agent** is the process manager of architect/design/devops
     instances and may edit any agent config.
   After granting, the manager sets the card back to `in-progress`
   (`blocked → in-progress`) and resumes the instance's stored OpenCode
   session (the `opencode-session` field in `docs/sessions/<hash>.md`) so it
   continues where it stopped. If the grant is out of the manager's reach,
   the card stays `blocked` and escalates to the concept agent — which may
   then ask the user.

## Git Flow Rules

The workflow is based on a `dev` branch with feature and bugfix branches.

### Branches

| Rule | Detail |
| --- | --- |
| Don't push `main` | Never push to the `main` branch. |
| Don't merge into `main` | Never merge any branch into `main`. |
| Don't commit to `dev` | Never commit directly on the `dev` branch. |
| Pushing `dev` is allowed | You may push the `dev` branch. |
| Merging into `dev` is allowed | You may merge `feature/*` and `bug/*` branches into `dev`. |

### Branch naming (hash-based)

Every spawned sub-agent instance receives a **unique instance hash** `<hash>`:
**8 lowercase hex characters** (e.g. `1640ba9e`, generated with
`od -An -N4 -tx1 /dev/urandom | tr -d ' \n'`). One sub-agent instance = one
feature = one hash.

Branch names **must** follow this format:

```
feature/<hash>-<description>
bug/<hash>-<description>
```

Examples:

```
feature/1640ba9e-task-table-component
bug/1640ba9e-fix-task-row-re-render
```

Where:

- `<hash>` — the 8-hex instance hash of the **feature worker** that owns the task;
- `bug/<hash>-...` — a bug branch **reuses the hash of the feature sub-agent**
  the bug belongs to, so all work on one feature (including its bugs) is
  attributable to a single instance;
- `<description>` — a short, lowercase, hyphen-separated description.

### Core rules

1. **Never push** any branch to any remote.
2. **Never merge into `main`.**
3. **Never commit directly on `dev`.** All work happens on
   `feature/<hash>-*` / `bug/<hash>-*` branches, merged into `dev`.
4. **One sub-agent instance = one feature = one hash.** The instance hash is
   used for its branch names, its task-DB records, its session record and its
   log file, so the whole history of an instance is traceable.

---

## Task / Session / Log system

The repository carries a lightweight coordination system so sub-agents can
work without stepping on each other.

### Instance hashes

- Each sub-agent instance generates one hash at start:
  `od -An -N4 -tx1 /dev/urandom | tr -d ' \n'` (8 lowercase hex chars).
- The hash identifies the instance everywhere: branch names, task records
  (`worker_hash` / `tester_hash` / `created_by`), session file
  `docs/sessions/<hash>.md`, log file `docs/logs/<hash>.log`.
- A tester instance has its own hash; bug branches, however, carry the
  **feature worker's** hash (`bug/<featureHash>-<slug>`).

### Task database (`tasks.db`)

`tasks.db` is a SQLite database (WAL mode) at the repo root. It is **runtime
state and not committed** (see `.gitignore`); the durable audit trail lives in
its `task_log` table, in session files and in `docs/logs/`.

The **only** interface is `scripts/task.py`. Never touch the DB directly.

Schema:

- `tasks` — `id, hash, title, branch, tz_section, criteria, status,
  created_by, worker_hash, tester_hash, depends_on, bug_branches,
  created_at, updated_at`
- `task_log` — `task_id, actor, action, detail, at` (every mutation)
- `bugs` — `task_id, hash, slug, file, severity, status, created_at`

#### Task lifecycle and authority

| From | To | Allowed for |
| --- | --- | --- |
| (new) | todo | planner (`created_by`) |
| todo → in-progress | worker (`worker_hash`) |
| in-progress → ready-for-test | worker (`worker_hash`) |
| in-progress → blocked | worker (`worker_hash`, `--reason` required) |
| ready-for-test → testing | tester (`tester_hash`) |
| testing → done \| blocked | tester (`tester_hash`) |
| blocked → in-progress | planner (`created_by`) |

Every other transition is rejected with a clear error, and each transition is
only allowed for the actor recorded on the task (planner = `created_by`,
worker = `worker_hash`, tester = `tester_hash`). Acceptance criteria text
lives in the `criteria` column — **the DB is the single source of truth for
task state.**

#### CLI examples

```bash
# Planner creates a task (status todo), printing its id:
python3 scripts/task.py new "Task table component" "TZ-3.1" \
  feature/1640ba9e-task-table 1640ba9e - --as ab12cd34

# Planner assigns a tester:
python3 scripts/task.py assign-tester 1 ef56ab78 --as ab12cd34

# Worker starts / hands over for test (worker_hash must match --as):
python3 scripts/task.py status 1 in-progress --as 1640ba9e
python3 scripts/task.py status 1 ready-for-test --as 1640ba9e

# Worker blocks its own card when the task is impossible with the current
# permissions (--reason is mandatory; see "Communication & escalation policy"):
python3 scripts/task.py status 1 blocked --as 1640ba9e \
  --reason "needs write access to the API contract to fix the endpoint"

# Tester picks it up and closes it (tester_hash must match --as):
python3 scripts/task.py status 1 testing --as ef56ab78
python3 scripts/task.py status 1 done --as ef56ab78
python3 scripts/task.py status 1 blocked --as ef56ab78   # or: done

# Planner reopens a blocked task:
python3 scripts/task.py status 1 in-progress --as ab12cd34

# Tester registers a bug (branch will be bug/<featureHash>-<slug>):
python3 scripts/task.py bug 1 1640ba9e fix-row-re-render high \
  src/components/TaskTable.tsx --as ef56ab78

# Read-only:
python3 scripts/task.py list            # all tasks
python3 scripts/task.py list todo       # only tasks in status todo
python3 scripts/task.py show 1
```

Convenience wrappers: `make task-list`, `make task-show ID=1`.

### Session records (`docs/sessions/`)

One file per sub-agent instance, created from `docs/sessions/_template.md`:

- `scripts/session.sh new <role> <parent> <task> <branch>` — generates a fresh
  8-hex `<hash>`, creates `docs/sessions/<hash>.md`, prints the hash.
- `scripts/session.sh set <hash> <field> <value>` — update one field.
- `scripts/session.sh close <hash> <done|failed|blocked> "<report>"` — sets
  `finished` + `status` and fills the `## Report` section.
- `scripts/session.sh list [status]` — overview of all sessions.

Fields: `hash`, `role`, `opencode-session`, `parent`, `task`, `branch`,
`status` (`running` | `done` | `failed` | `blocked`), `started`, `finished`,
and a `## Report` section. Session files **are committed** — they are the
durable record of who did what.

### Log files (`docs/logs/`)

- `scripts/log.sh log <hash> "<message>"` — appends a UTC-timestamped
  `[<role>] <message>` line to `docs/logs/<hash>.log` (the role is read from
  the session record; if none exists, `<unknown>` is used).
- `make log-tail HASH=1640ba9e` — tail an instance's log.
- Log files **are committed**.

### Resetting the task DB

The DB is runtime state. To reset it to empty for real use:

```bash
rm -f tasks.db tasks.db-wal tasks.db-shm
python3 scripts/task.py init     # recreates an empty schema
```
