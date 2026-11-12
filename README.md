# bleak-node front-end

Front-end repository for the **bleak-node** project. The API contract with the
(read-only) backend at `/mount/bleak-node` is defined in
`/mount/bleak-node/docs/swagger.json`.

## Agent workflow

This repo is developed by orchestrated AI sub-agents. Coordination rules:

- **`AGENTS.md`** — git policy, hash-based branch naming
  (`feature/<hash>-<description>`, `bug/<hash>-<description>`), and the
  task/session/log coordination system.
- **`scripts/task.py`** — the only interface to the SQLite task database
  (`tasks.db`, WAL, not committed): plan, assign, transition, report bugs.
- **`scripts/session.sh`** — one session record per sub-agent instance in
  `docs/sessions/` (committed).
- **`scripts/log.sh`** — per-instance UTC timestamped logs in `docs/logs/`
  (committed).

## Common commands

```bash
make help                    # list targets
make task-list               # list tasks (STATUS=<status> to filter)
make task-show ID=1          # show one task
make session-list            # list session records
make log-tail HASH=1640ba9e  # tail an instance log
```

Feature targets (`setup`, `dev`, `build`, `test`, `lint`) are placeholders
until the architect wires them up.
