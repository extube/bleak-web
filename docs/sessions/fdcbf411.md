hash: fdcbf411
role: worker
opencode-session: ses_e08501199ffe3SsiAWOUwJKoL6
parent: process
task: 85
branch: feature/fdcbf411-tz8-05-summary-lazy-background
status: done
started: 2026-11-20T06:40:29Z
finished: 2026-11-20T06:52:43Z

## Report

Implemented tz8-05 summary lazy background loading (Concept §18.3 / DESIGN §4.15.3.3): new session summaryCache store (ready/pending/failed state machine, owner stamp, in-flight guard, no aggressive re-post, 401 gate classification, stale-persona sweep); transcript page fetches on done-observation instead of at sheet open, auto-open + footer button never fire the fetch, retry forces through the store; SummarySheet loading row is now the animated arcade dots state (reduced-motion respected). Gates: targeted suites (104), full make test (819), make lint, make build — all green. Commit 2951a31 on feature/fdcbf411-tz8-05-summary-lazy-background.
