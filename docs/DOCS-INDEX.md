# bleak-web — Docs index (agent reading map)

> This file is the ONLY doc auto-injected into agent sessions (owner
> token-budget directive 2026-11-16: the full Concept/ARCHITECTURE/DESIGN/TZ
> texts are NOT injected — each agent reads exactly what its task needs).

| Agent / situation | Read |
| --- | --- |
| **worker** starting a task | Your task card's `criteria` **+ `test cases` + `constraints`** (task DB) + your `tz-section` in `docs/TZ.md` + the DESIGN sections that section references. Nothing else up front. |
| **process** | `docs/TZ.md` §8 (Part II) + §8.8 (token-budget policy) + AGENTS.md |
| **architect** | `docs/ARCHITECTURE.md` + `docs/TZ.md` (the sections your pass amends) |
| **design** | `docs/DESIGN.md` (sections your rev touches) + `docs/Concept.md` §6 |
| **concept** | `docs/Concept.md` (whole) + current-pass docs as needed |
| **devops** | `AGENTS.md` + `.opencode/**` (environment ownership) |
| API contract | `/mount/bleak-node/docs/swagger.json` (read-only) + `/mount/bleak-node/CONCEPT.md` §7 |
| Visual refs (gitignored, local only) | `docs/refs/*.png` |
| Rules of engagement (all agents) | `AGENTS.md` — communication/escalation, git flow, task/session/log system, QA-is-CI |

## Your tool permissions — KNOW THESE, never probe

**Denied commands are statically configured.** Do not test whether a
command is allowed — check this table first; if something you need is not
here, report it **once** ("PERMISSION NEEDED: <tool>") in your report and
work around it — never loop on denied probes.

| Agent | Shell allowed | Shell denied (examples) |
| --- | --- | --- |
| **worker** | `git status/add/commit/log/diff/show/checkout` · `make *` · `node *` · `npm run *` · `python3 scripts/task.py *` · `scripts/{task,log,session}.sh *` · `bash/sh scripts/*` | branch create/delete/rename · merge · push · `git checkout -b/--orphan` · commits on `dev` · anything not listed |
| **process** | `git checkout dev` · `git merge --no-ff feature\|bug/*` · branch create/delete for `feature/*`+`bug/*` · `task.py` · scripts · `make *` | commits (any) · `git branch -f`/rebase · merges into `main` |
| **architect / design** | git read-only (log/show/diff); **design: no git writes**; architect commits only on its own doc branch | product-code edits, worker branches |
| **concept / devops (primary)** | broad (incl. merges into `dev`, config edits at user direction) | `git push * main` (approval-gated) · commit-identity overrides (mechanically denied) |
| **all** | file tools within the repo (workers deny: `AGENTS.md`, `Makefile`, `docs/{Concept,TZ}.md`, `docs/sessions/**`, `.opencode/**`) | edits to `/mount/bleak-node/**` (read-only) |

Also true for every agent: `subagent` spawning is role-scoped (workers deny
all), the task DB is `scripts/task.py` only, and `/tmp/opencode` is the
approved scratch space.

Current build state: **v2 credentials DELIVERED end-to-end** (2026-11-16 —
owner landed the bleak-node v2 backend; WP-6 reconciliation round executed on
worker hash `90b95f75`, merged as `631644b`, CI green 522-equivalent). The
pre-authorized `tz2-07a` follow-up (flag 6.9a) remains available. Pre-event
manual checklist (scanner device smoke) in the verification doc. Pushes to
origin are owner-directed.
