# bleak-web — Docs index (agent reading map)

> This file is the ONLY doc auto-injected into agent sessions (owner
> token-budget directive 2026-11-16: the full Concept/ARCHITECTURE/DESIGN/TZ
> texts are NOT injected — each agent reads exactly what its task needs).

| Agent / situation | Read |
| --- | --- |
| **worker** starting a task | Your task card's `criteria` (task DB) + your `tz-section` in `docs/TZ.md` + the DESIGN sections that section references. Nothing else up front. |
| **process** | `docs/TZ.md` §8 (Part II) + §8.8 (token-budget policy) + AGENTS.md |
| **architect** | `docs/ARCHITECTURE.md` + `docs/TZ.md` (the sections your pass amends) |
| **design** | `docs/DESIGN.md` (sections your rev touches) + `docs/Concept.md` §6 |
| **concept** | `docs/Concept.md` (whole) + current-pass docs as needed |
| **devops** | `AGENTS.md` + `.opencode/**` (environment ownership) |
| API contract | `/mount/bleak-node/docs/swagger.json` (read-only) + `/mount/bleak-node/CONCEPT.md` §7 |
| Visual refs (gitignored, local only) | `docs/refs/*.png` |
| Rules of engagement (all agents) | `AGENTS.md` — communication/escalation, git flow, task/session/log system, QA-is-CI |

Current build state: v1 delivered; v2 credentials loop in progress —
`docs/TZ.md` Part II is the authoritative task plan; wave-1 + TZ2-05 merged;
see `docs/logs/` and `docs/sessions/` for instance trails.
