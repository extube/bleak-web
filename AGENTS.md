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
   process manager: worker (and feature-scoped design) instances route via
   the **process**, architect/design instances route via the **concept
   agent**. Architect consultations run in **think mode** — read, analyze,
   answer only: no file edits, no git writes, no spawns; the answer is
   delivered in the consult instance's report. Advice requests are logged
   via `scripts/log.sh` and marked **"ADVICE NEEDED"** in the agent's
   report.
4. **Self-block on impossibility:** if a task is impossible with the current
   permissions, the agent blocks its own card, closes its session record as
   `blocked`, and stops cleanly:
   ```bash
   python3 scripts/task.py status <id> blocked --as <hash> --reason "<missing>"
   ```
5. **QA is CI, run by the process (temporary tester disable):** there is no
   QA step by a tester subagent — the process agent merges a
   `ready-for-merge` feature into `dev` and runs `make lint/test/build` as
   CI (green → task auto-closes; red → the process saves the CI output to
   `docs/bugs/ci-<slug>-N.log`, files the bug itself, and reopens the task
   for the same worker). The tester role is disabled in its config
   (`disabled: true` in `.opencode/agents/tester.md`); `assign-tester` and
   the `tester_hash` column are deprecated/unused.
6. **Grants — devops only, at the user's direction:** no agent edits
   environment settings to grant itself or anyone else permissions. Only the
   **devops agent** changes environment settings (`.opencode/**` agent
   configs, `opencode.jsonc`, plugins, plus `AGENTS.md`, `Makefile`,
   `scripts/**`, and the task DB schema), always at the user's direction.
   Process managers escalate instead of granting:
   - the **process** is the process manager of worker and feature-scoped
     design instances — it leaves a blocked-permission card `blocked` and
     reports the exact missing grant to the **concept agent**;
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

### Local clones

- After cloning bleak-web on a workstation, if git reports
  *"detected dubious ownership in repository at …"* (the clone directory is
  owned by a different user than the one running git), add an exception:
  `git config --global --add safe.directory /path/to/bleak-web`.
  This is a per-machine git setting; it is not part of the repository.

### Primary agents — user-selected in the TUI

- Only two agents talk to the user, and the **user selects them in the
  OpenCode TUI**; no agent spawns them:
  - **concept** — when the user wants to change or drive the **product**
    (concept, reviews, approvals, build-loop decisions);
  - **devops** — when the user wants to change the **environment** (system
    rules, processes, configs, tooling).
- Spawning `concept` or `devops` as subagents is mechanically denied
  (global `subagent` deny rules in `.opencode/opencode.jsonc`; both are
  also `mode: primary` and therefore not spawnable anyway).

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
   exactly **one feature branch** (`feature/<hash>-<slug>`), but may
   complete **any number of bug-fix rounds** on `bug/<hash>-<slug>` branches
   (each branched from `dev`, created by the process after a CI failure) —
   all attributable to the same instance. The hash is used for its branch
   names, its task-DB records, its session record and its log file, so the
   whole history of an instance is traceable.

### Git rights matrix (mechanically enforced by `.opencode` permissions)

| Agent | Git rights |
| --- | --- |
| **worker** | Read + commit on its assigned branch only (`status/add/commit/log/diff/show/checkout`); **denied**: branch create/delete/rename (`git branch *`, `git checkout -b/--orphan`), merge, push. The process creates the branch; the worker only commits on it. |
| **process** | Branch management + merge: `git checkout dev`, `git merge --no-ff feature/*` and `bug/*`, create/delete `feature/*` and `bug/*` branches. **Never commits** — no commit permission; commits on feature/bug branches belong to the worker. |
| **tester** | Disabled (role retired; QA is CI run by the process). |
| **design** | Read-only on code, never touches git (feature-scoped design instances included). |

### Automation tied to branches

- **Auto task creation on branch creation:** `scripts/open-feature.sh <slug>
  [depends] --as <processHash>` is the ONE feature-opening command — it
  generates the worker hash + session record, creates
  `feature/<hash>-<slug>` from `dev` (no checkout) and auto-creates the task
  card (`todo`) linked to hash + branch; the process fills the acceptance
  criteria right after (`task.py criteria <id> "<text>" --as <processHash>`).
- **Auto task close on merged + green CI:** when the process merges
  (`ready-for-merge → merged`) and CI on `dev` is green, the task closes
  automatically (`task.py ci <id> green` sets `merged → done`); the process
  deletes the merged branches. A red CI run marks the MR record `failed`
  instead and routes through the bug flow.

---

## Task / Session / Log system

The repository carries a lightweight coordination system so sub-agents can
work without stepping on each other.

### Instance hashes

- Each sub-agent instance generates one hash at start:
  `od -An -N4 -tx1 /dev/urandom | tr -d ' \n'` (8 lowercase hex chars).
  Feature workers get theirs from `scripts/open-feature.sh` automatically.
- The hash identifies the instance everywhere: branch names, task records
  (`worker_hash` / `created_by`), session file `docs/sessions/<hash>.md`,
  log file `docs/logs/<hash>.log`.
- Bug-fix rounds continue on `bug/<hash>-<slug>` branches carrying the
  **feature worker's** hash; the process creates those branches and resumes
  the same worker session to fix.

### Task database (`tasks.db`)

`tasks.db` is a SQLite database (WAL mode) at the repo root. It is **runtime
state and not committed** (see `.gitignore`); the durable audit trail lives in
its `task_log` table, in session files and in `docs/logs/`.

The **only** interface is `scripts/task.py`. Never touch the DB directly.

Schema:

- `tasks` — `id, hash, title, branch, tz_section, criteria, status,
  created_by, worker_hash, tester_hash (kept, unused), depends_on,
  bug_branches, created_at, updated_at`. `branch` tracks the task's
  **current work branch** (the feature branch, or the latest
  `bug/<hash>-<slug>` fix branch after a CI-failure reopen).
- `task_log` — `task_id, actor, action, detail, at` (every mutation)
- `merges` — MR records, one per ready-for-merge round: `id, task_id,
  branch, status (open | merged | failed), opened_at, merged_at, ci_result,
  ci_log`. The `in-progress → ready-for-merge` transition **auto-opens** the
  MR record (the worker does one action only); `ready-for-merge → merged`
  stamps `merged_at`; the `ci` command records `ci_result`/`ci_log`.
- `bugs` — `task_id, hash, slug, file (the CI-log context file), severity,
  status, created_at`

#### QA is CI (no tester)

QA is the CI gate run by the **process** on `dev` after the merge:
`make lint && make test && make build`. Green → the task auto-closes
(`merged → done`); red → the process saves the full CI output to
`docs/bugs/ci-<slug>-N.log`, records the red run, files the bug with that
context file, and reopens the task for the same worker on a
`bug/<hash>-<slug>` branch. The tester role is disabled; `assign-tester` is
deprecated and `tester_hash` is kept as an unused column.

#### Task lifecycle and authority

| From | To | Allowed for |
| --- | --- | --- |
| (new) | todo | process (`created_by`) — via `task.py new` / `open-feature.sh` |
| todo → in-progress | worker (`worker_hash`) |
| in-progress → ready-for-merge | worker (`worker_hash`) — auto-opens the MR record |
| in-progress → blocked | worker (`worker_hash`, `--reason` required) |
| ready-for-merge → merged | process (`created_by`) — **this transition IS the merge moment** (concept approves the merge in default mode) |
| merged → done | process (`created_by`) — **automatic when CI is green** (`task.py ci <id> green`) |
| merged → in-progress | process (`created_by`) — when CI failed, **after the bug is filed** (enforced) |
| blocked → in-progress | process (`created_by`) |

Every other transition is rejected with a clear error, and each transition is
only allowed for the actor recorded on the task (process = `created_by`,
worker = `worker_hash`). Acceptance criteria text lives in the `criteria`
column — **the DB is the single source of truth for task state.**

#### CLI examples

```bash
# Process opens a feature — ONE command: worker hash + session record,
# branch feature/<hash>-<slug> from dev (no checkout), task card (todo):
scripts/open-feature.sh task-table-component - --as ab12cd34
# → hash: <hash>, task: <id>, branch: feature/<hash>-task-table-component

# Process fills the acceptance criteria right after:
python3 scripts/task.py criteria <id> "criterion one; criterion two" --as ab12cd34

# Worker starts / hands over for merge (worker_hash must match --as);
# ready-for-merge auto-opens the MR record:
python3 scripts/task.py status <id> in-progress --as 1640ba9e
python3 scripts/task.py status <id> ready-for-merge --as 1640ba9e

# Worker blocks its own card when the task is impossible with the current
# permissions (--reason is mandatory; see "Communication & escalation policy"):
python3 scripts/task.py status <id> blocked --as 1640ba9e \
  --reason "needs write access to the API contract to fix the endpoint"

# Process merges (after the user's per-feature approval, relayed via concept;
# NOT_MAINTAIN_APPROVAL=true skips the gate) and runs CI on dev:
git checkout dev && git merge --no-ff feature/1640ba9e-task-table-component
python3 scripts/task.py status <id> merged --as ab12cd34
make lint && make test && make build

# Green CI closes the task automatically; the process deletes the branch:
python3 scripts/task.py ci <id> green --as ab12cd34
git branch -d feature/1640ba9e-task-table-component

# Red CI: save output, record red, file the bug with the context file,
# reopen for the same worker on a bug branch (created by process):
python3 scripts/task.py ci <id> red docs/bugs/ci-task-table-1.log --as ab12cd34
python3 scripts/task.py bug <id> 1640ba9e fix-task-table high \
  docs/bugs/ci-task-table-1.log --as ab12cd34
python3 scripts/task.py status <id> in-progress --as ab12cd34
git branch bug/1640ba9e-fix-task-table dev     # worker resumes its session

# Process reopens a blocked task:
python3 scripts/task.py status <id> in-progress --as ab12cd34

# Read-only:
python3 scripts/task.py list            # all tasks
python3 scripts/task.py list todo       # only tasks in status todo
python3 scripts/task.py show <id>       # incl. MR records, bugs, history
```

Deprecated: `assign-tester` is rejected with a deprecation error (QA is CI
run by the process; `tester_hash` is kept but unused).

Test suite for the DB interface and the feature opener (runs entirely in a
scratch directory under /tmp/opencode): `bash scripts/test-task.sh`.

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

Worker sessions are bounded by a **steps cap** in the agent config
(`steps: 200` for worker) plus OpenCode's automatic compaction. The tester
role is disabled (QA is CI run by the process). OpenCode V2 does not support
a per-agent token-context cap (agent options are model/steps/permissions
only), so the 250k-token limit is approximated by these levers. Ask the
**devops agent** to tune the caps (they are environment settings,
user-tunable at the user's direction).
