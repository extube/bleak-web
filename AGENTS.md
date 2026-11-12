# AGENTS.md

Rules for AI agents and contributors working in the **bleak-node front-end** repository.

## Communication & escalation policy

**The no-ask rule:** with the two exceptions below, no agent ever asks the
user anything. The user is reached only through the two primary agents.

1. **Two agents may talk to the user**, each in its own scope:
   - the **concept agent** — project/product working-stream decisions only:
     concept approval, DESIGN/TZ review, per-feature gates, and escalations
     of grants or decisions it cannot make itself;
   - the **devops agent** — environment, system rules, and processes: the
     user interacts with devops **directly** to change system rules,
     processes, and environment settings. Devops is exempt from the no-ask
     rule for that scope only.
2. **Every other agent must never ask the user anything in chat.** If an
   agent lacks a permission for something, it first tries to solve the task
   without that permission (workaround within its allowed tools and files).
   Permission prompts ("ask" effects) must never be triggered by sub-agents.
3. **Advice requests** go to the architect, routed through the agent's
   process manager: worker/tester instances route via the **process**,
   architect/design instances route via the **concept agent**. Advice
   requests are logged via `scripts/log.sh` and marked **"ADVICE NEEDED"** in
   the agent's report.
4. **Self-block on impossibility:** if a task is impossible with the current
   permissions, the agent blocks its own card, closes its session record as
   `blocked`, and stops cleanly:
   ```bash
   python3 scripts/task.py status <id> blocked --as <hash> --reason "<missing>"
   ```
5. **Grants — devops only, at the user's direction:** no agent edits
   environment settings to grant itself or anyone else permissions. Only the
   **devops agent** changes environment settings (`.opencode/**` agent
   configs, `opencode.jsonc`, plugins, plus `AGENTS.md`, `Makefile`,
   `scripts/**`, and the task DB schema), always at the user's direction.
   Process managers escalate instead of granting:
   - the **process** is the process manager of worker/tester instances — it
     leaves a blocked-permission card `blocked` and reports the exact missing
     grant to the **concept agent**;
   - the **concept agent** is the process manager of architect/design
     instances — likewise, it informs the user, who directs **devops** to
     make the grant.
   After devops has granted, the process manager sets the card back to
   `in-progress` (`blocked → in-progress`) and resumes the instance's stored
   OpenCode session (the `opencode-session` field in
   `docs/sessions/<hash>.md`) so it continues where it stopped. If the change
   needs something devops cannot do at the user's direction, the card stays
   `blocked` and the concept agent brings it to the user.

## Git Flow Rules

The workflow is based on a `dev` branch with feature and bugfix branches.

### Branches

| Rule | Detail |
| --- | --- |
| Pushing `main` | Only with the user's explicit direction — mechanically gated: `git push * main` / `git push * main:*` trigger an interactive approval prompt; an approval is the user's consent. |
| Don't merge into `main` | Never merge any branch into `main`. |
| Don't commit to `dev` | Never commit directly on the `dev` branch. |
| Pushing `dev` and feature/bug branches | Allowed to the project remote at the user's direction. |
| Merging into `dev` is allowed | You may merge `feature/*` and `bug/*` branches into `dev`. |

### Commit identity

- `.env` (gitignored, canonical source) holds the project identity:
  `GITHUB_USERNAME=extube`, `GITHUB_EMAIL=extube@proton.me`.
- **All commits — by humans and every agent — are created only with this
  identity.** It is enforced by the repo-local git config
  (`user.name=extube`, `user.email=extube@proton.me`), which every commit in
  this checkout picks up automatically.
- **No agent may override the commit identity.** Denied mechanically
  (see `.opencode/opencode.jsonc`): `git config user.*` / `--global` /
  `--local` / `--add` / `--replace`, `git commit --author=…`, `git -c …user…`
  / `…author…` / `…committer…`, and the `GIT_AUTHOR_*` / `GIT_COMMITTER_*` /
  `GIT_CONFIG_*` environment-variable prefixes.
- If the identity ever needs to change, the user directs the **devops
  agent**, which updates `.env` and the repo-local git config.

### Remotes & publishing

- The project remote is `origin` = `git@github.com:extube/bleak-web.git`
  (added at the user's explicit direction; HTTPS was replaced by SSH because
  the environment authenticates via the SSH key `/root/.ssh/id_a_key`,
  configured for `github.com` in `/root/.ssh/config` — key and config are
  environment, owned by devops).
- `main` is the published branch. The old bleak-node "never push main" rule
  was adapted for publishing: pushes to `main` happen only when the user
  explicitly asks, enforced by the approval prompt on the push command.
- `main` already exists with the correct name; never run
  `git branch -M main`-style renames while other branches exist.

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

1. **Pushes to `main` only at the user's explicit direction** (approval-prompt
   gated, see Branches). Pushing `dev` and feature/bug branches is allowed at
   the user's direction.
2. **Never merge into `main`.**
3. **Never commit directly on `dev`.** All work happens on
   `feature/<hash>-*` / `bug/<hash>-*` branches, merged into `dev`.
4. **One sub-agent instance = one feature = one hash:** the instance works on
   exactly **one feature branch** (`feature/<hash>-<slug>`), but may create
   **any number of bug branches** (`bug/<hash>-<slug>`, each branched from
   `dev`) — e.g. 1 feature branch + 3 bug branches — all attributable to the
   same instance. The hash is used for its branch names, its task-DB records,
   its session record and its log file, so the whole history of an instance
   is traceable.

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
| (new) | todo | process (`created_by`) |
| todo → in-progress | worker (`worker_hash`) |
| in-progress → ready-for-test | worker (`worker_hash`) |
| in-progress → blocked | worker (`worker_hash`, `--reason` required) |
| ready-for-test → testing | tester (`tester_hash`) |
| testing → done \| blocked | tester (`tester_hash`) |
| blocked → in-progress | process (`created_by`) |

Every other transition is rejected with a clear error, and each transition is
only allowed for the actor recorded on the task (process = `created_by`,
worker = `worker_hash`, tester = `tester_hash`). Acceptance criteria text
lives in the `criteria` column — **the DB is the single source of truth for
task state.**

#### CLI examples

```bash
# Process creates a task (status todo), printing its id:
python3 scripts/task.py new "Task table component" "TZ-3.1" \
  feature/1640ba9e-task-table 1640ba9e - --as ab12cd34

# Process assigns a tester:
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

# Process reopens a blocked task:
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

### Resource limits

Worker and tester sessions are bounded by **steps caps** in their agent
configs (`steps: 200` for worker, `steps: 120` for tester) plus OpenCode's
automatic compaction. OpenCode V2 does not support a per-agent token-context
cap (agent options are model/steps/permissions only), so the 250k-token limit
is approximated by these levers. Ask the **devops agent** to tune the caps
(they are environment settings, user-tunable at the user's direction).
