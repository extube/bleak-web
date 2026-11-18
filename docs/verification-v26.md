# bleak-web v2.6 — Verification sweep (TZ4-28, verification-only)

Worker instance `3111a3f0` · 2026-11-18 · branch
`feature/3111a3f0-tz4-28-verify-v26` (base = dev tip `698a48b` — the landing
of `feature/9c056c0b-tz4-27-phone-fullscreen-forms`; the §12 delta wave
task 56 re-fix `607241c` + task 57 full-screen forms `698a48b` both landed
before this sweep). This sweep verifies the **two items of Concept §12**
(v2.6 addendum, DESIGN §4.12.1) are delivered on `dev`. It adds **no
product code and no test files** — one-shot source greps, landed-code reads
and targeted spot-check runs recorded here, per the verification-only
constraint of the card. It completes the §8–§12 verification record
(v2.2–v2.5 in `docs/verification-v22.md` … `-v25.md`).

Method legend: **S** = source inspection / one-shot grep in this sweep,
**T** = merged automated test (file — title), **R** = targeted spot-run
executed first-hand in this session, **C** = read of the landing commit's
diff (read-only git).

---

## 1. Gate record (TZ §8.8 discipline — full gates are delta-wave-CI's job)

| Check | Result | Source |
| --- | --- | --- |
| Full `make test` re-run by this sweep | **not run** (the process runs the delta-wave CI after this landing) | this session |
| DELTA-WAVE CI | **GREEN** (2026-11-18T13:47Z, process, dev tip `b464d8d` post-sweep-landing): `make lint` clean · `make test` 591 passed (23 api-client + 8 helper + 560 web, 43 files) · `make build` 0 svelte-check errors (8 pre-existing warnings) | process gate run; recorded via `task.py ci` |
| Landing commits of the §12 delta wave | **both landed 2026-11-18** — 56 join-input-overflow re-fix `607241c` (13:36:04Z); 57 phone-fullscreen-forms `698a48b` (13:43:43Z) | dev log |
| Targeted spot-runs (4 card-anchored suites, first-hand) | **green — 54 tests / 4 files** (join-flow + digit-input + code-input + profile-page) | `npm run test -w @bleak/web -- <files>` (§3), all passing |
| Owning tasks of the 2 items | **56, 57 — both landed into `dev`** (dev tip `698a48b` at sweep time) | `task.py list` / dev log |

No test was added or modified by this sweep.

---

## 2. Per-item checklist — Concept §12 items 1–2

### Item 1 — Join overflow RE-FIX (bug round, task 56, §12.2, DESIGN §4.12.1 item 6) — PASS

| Check | Result | Evidence |
| --- | --- | --- |
| Root cause documented (.cells was a flex container → .digit-input an unconstrained min-width:auto flex item locked at 376px max-content) | PASS S/T | `CodeEntry.svelte:122-130` — the `.cells` comment records it verbatim ("NOT a flex container anymore — as a flex row it made .digit-input an unconstrained flex item (min-width: auto) that sized to its capped 376px content and never shrank, locking the row past the card at every phone width"); the same diagnosis is the doc-comment of the test describe block (`join-flow.test.ts:444-462` — "the task-53 cell flexibility … never ENGAGED … sized to its capped content (6×56px + 5×gap = 376px) and never shrank, so the row overflowed the card's content box at ALL THREE widths (224/264/294 at 320/360/390)") |
| Structural fix: `.cells` a plain block + min-width: 0 | PASS S/T | `CodeEntry.svelte:122-130` — `.cells { min-width: 0; }` only (no `display: flex`; centering moved inside DigitInput `justify-content`); test `join-flow.test.ts:546` — `.cells` must NOT match `/\.cells\s*\{[^}]*display:\s*flex/` |
| Structural fix: `.digit-input` width-constrained | PASS S/T | `DigitInput.svelte:141-153` — `width: 100%; min-width: 0` on `.digit-input` (comment `:145-150` — "the row itself must be width-constrained — without min-width: 0 it is an unconstrained flex item that sizes to its capped 376px content"); tests `join-flow.test.ts:533-534` pin both declarations |
| Behavior-level flex-math: row fits AND tracks the content box at 320/360/390 (cells 30.7/37.3/42.3px, ≥24px, ≤56px cap) | PASS T/R | `join-flow.test.ts:508-521` — "behavior: the row fits the card content box at 320px, 360px AND 390px": the browser's flex algorithm is re-derived from the REAL tokens (`--space-2: 8px`, `--space-5: 24px` — `tokens.css:114,117` read live by the test, not literals) and the real DOM structure; for each viewport it asserts `row <= box`, `row === box` (exactly fits — "no dead side gaps that could hide a lock"), and `24 <= cell <= 56`. Computed cells: (224−5×8)/6 = **30.7px** at 320, (264−40)/6 = **37.3px** at 360, (294−40)/6 = **42.3px** at 390 — the card's values exactly; first-hand re-derivation in this sweep matches (C/R) |
| Diagnosis test pins the OLD lock | PASS T | `join-flow.test.ts:497-506` — "diagnosis: the 376px content-locked row overflowed ALL THREE required widths": locked = 6×56 + 5×8 = **376px** > contentBox(320)=224 / contentBox(360)=264 / contentBox(390)=294 — all three asserted |
| 720px cap regression | PASS T | `join-flow.test.ts:520` — `expect(flexRow(720).cell).toBe(56)` — on wide screens the cells cap at the 56px design size (desktop rendering unchanged) |
| DOM structure: the rendered row is the 6-cell flex row the math applies to | PASS T/R | `join-flow.test.ts:523-528` — "structure: the rendered JoinFlow row is the 6-cell flex row the math applies to" — renders JoinFlow, asserts the `.digit-input` group exists with exactly 6 `input`s |
| CSS contract | PASS T | `join-flow.test.ts:530-551` — pins `width:100%` + `min-width:0` on `.digit-input`, no unbounded `width: 56px`, `flex: 1 1 0 / min-width: 0 / max-width: 56px / height: 56px` on `input`, the `--space-2` gap, no raw hex, `.cells` not a flex container, plus `overflow-wrap: anywhere` on the entry h1 and the gone-card h2 (long words wrap, do not overflow) |
| Input behavior suites green | PASS R | The pre-existing behavior suites (auto-advance, backspace-retreat, paste-fill, invalid-char rejection) all green in the spot-run (§3): `digit-input.test.ts` + `code-input.test.ts` + the full `join-flow.test.ts` (23 tests incl. the whole layout block) — no behavior change, layout only (C: the `607241c` diff touches DigitInput/CodeEntry CSS+comments and the join-flow test file, nothing else) |

### Item 2 — Phone full-screen forms (task 57, §12.1, DESIGN §4.12.1 item 5) — PASS

The contract: at **<720px** (the design system's existing phone breakpoint)
each surface renders as a **full-screen form** — the card becomes the page
(no floating chrome: no rounded corners, no pixel-corner clip; `flex: 1`
fills the viewport height; the container's gutters dropped; the card's own
`--space-5` padding is the content gutter) — with content in bounds
including the digit row. Overrides live ONLY inside one
`max-width: 719px` query per surface; desktop `min-width: 720px` rules
untouched (contract-tested); tokens only; no behavior/copy changes.

| Check | Result | Evidence |
| --- | --- | --- |
| Exactly one `max-width: 719px` query per surface — 3 files total (join card, resume card, profile badge); import+return share the join card's query | PASS S/T | Grep over `apps/web/src/**/*.svelte`: exactly **3** `max-width: 719px` matches — `join/JoinFlow.svelte:369`, `routes/+page.svelte:197`, `routes/profile/+page.svelte:372`. Import profile and return-to-event (the §10.1.1 vault screen, `VaultList`) render INSIDE the JoinFlow card (`JoinFlow.svelte:297-303` — `{:else if flow.step === 'vault'} <VaultList …>`), so the one join query covers them; the test doc-comment states it explicitly (`join-flow.test.ts:564-566` — "One treatment covers every surface rendered in the join card: enter-code …, import profile and return-to-event (the §10.1.1 vault screen); the route-level resume card shares it") |
| Join card (enter-code / import / return): card becomes the page | PASS S/T | `JoinFlow.svelte:369-379` — phone query: `.join { max-width: none; padding: 0; }` + `.card { border-radius: 0; clip-path: none; flex: 1; }` (comment `:362-368`); test `join-flow.test.ts:587-604` pins every declaration + tokens-only (no raw hex) + **the task-56 fix preserved underneath: `.digit-input` still `width: 100%` / `min-width: 0` so the digit row is in bounds at EVERY phone width** (`:599-603`) |
| Resume card (same join screen) identical treatment | PASS S/T | `routes/+page.svelte:197-207` — `.join { max-width: none; padding: 0; }` + `.resume { border-radius: 0; clip-path: none; flex: 1; }` (comment `:192-196`); test `join-flow.test.ts:606-614` |
| Profile page/badge: badge card becomes the page | PASS S/T | `profile/+page.svelte:372-384` — phone query: `.profile-page { padding: 0 0 calc(var(--bottom-tabbar-height) + var(--space-5)); }` (container drops side padding; the functional tab-bar clearance stays), `.header { padding: var(--space-5) var(--space-5) 0; }` (header keeps its own gutter), `.badge { border-radius: 0; clip-path: none; flex: 1; }`; test `profile-page.test.ts:460-481` pins every declaration + tokens-only |
| Desktop untouched: min-width:720px rules intact, overrides only inside the 719px query | PASS S/T | Desktop blocks intact in all three files (`JoinFlow.svelte:356-361`, `+page.svelte:187-191`, `profile/+page.svelte:358-365`); tests `join-flow.test.ts:616-633` (each chrome-dropping declaration appears exactly ONCE per file — inside the 719px query, never in the base rules) and `profile-page.test.ts:483-498` (same once-only assertion for the badge) |
| Tokens only | PASS T | All three phone blocks asserted `not.toMatch(/#[0-9a-fA-F]{3,8}\b/)` (`join-flow.test.ts:598,613`, `profile-page.test.ts:480`); the landed blocks use only tokens + the functional tab-bar var |
| No behavior/copy changes | PASS C | The `698a48b` diff touches ONLY: 3 svelte files (18/16/19 added lines — the CSS blocks + comments), 2 test files, session/log records — **no dictionary files, no script logic**; the joins' machine and all copy are untouched |

---

## 3. Spot-run record (first-hand, this session)

```
npm run test -w @bleak/web -- tests/join-flow.test.ts tests/digit-input.test.ts
  tests/code-input.test.ts tests/profile-page.test.ts
  → Test Files 4 passed (4) · Tests 54 passed (54)   (13:45:07Z, 2.32 s)
```

All 4 card-anchored suites: **54 tests green, 0 failures** (join-flow 23,
digit-input + code-input + profile-page 31). The join-flow run includes the
whole item-1 layout block (4 tests) AND the whole item-2 block (3 tests);
the profile-page run includes the item-2 badge block (2 tests).
No full `make test` by this sweep — the process runs the delta-wave CI on
`dev` after this landing (§1 placeholder).

---

## 4. Findings

**Verdict: items 1–2 — 2/2 PASS, 0 FAIL.** No product defect found; no
fix-up performed (verification-only constraint).

| # | Severity | Finding | Recommendation |
| --- | --- | --- | --- |
| — | none | No new findings this round. | — |

The §10.1.7 backend gap (chat lifecycle field) carries forward unchanged —
see §6 below.

---

## 5. Pre-event manual checks carried forward (owner, real device)

The automated suites pin the logic; these need a real phone:

1. **v2.6 — join input + full-screen forms at REAL phone widths (now the
   primary on-device check):** at ~320px (iPhone SE class) and the common
   360–390px widths — the 6-digit row stays inside the form (cells ~30.7 /
   37.3 / 42.3px wide, 56px tall, still legible/tappable) **and** the
   enter-code, import, return-to-event and profile screens render as
   full-screen forms: the card fills the viewport with no rounded floating
   chrome and no horizontal scroll, content sits comfortably inside the
   card's `--space-5` gutter, the profile badge keeps its top-right
   settings button above the content column and the bottom tab-bar
   clearance; wide viewports (>720px) look unchanged (cells capped at
   56px, floating cards back).
2. **Carried from v2.5 (unchanged, full notes in
   `docs/verification-v25.md` §5):** chat-list preview freshness — with
   the 4 s cadence each visible dialog's preview + hh:mm tracks the
   agents' latest message without a reload; a fresh chat shows no preview
   row; the owner-scoped cache never shows another session persona's
   preview; the rotating status glyph (in the chat's Deepa hue on a
   NEUTRAL card) still reads as "in progress" and does not collide with
   the truncated preview on narrow screens; the outline-style local-leave
   button.
3. **Carried from v2.3/v2.4 (unchanged, full notes in
   `docs/verification-v23.md` §6 / `verification-v24.md` §5):** **ICU RU
   date/time** — the date label «8 сентября» + hh:mm times with no
   «мин»/AM-PM on a real device (the test runner's Node ICU is restricted;
   browsers ship full ICU); **Deepa violet legibility** — `#9B0CFF`
   bubbles/cards with light ink (4.74:1, the tightest AA pairing) must
   stay readable at arm's length on an OLED panel at outdoor brightness;
   **radar oversize on small screens** — the stage spans the larger
   viewport dimension, no horizontal scrollbar, center chip + nodes stay
   visible/tappable in the clipped view, rotation re-sizes without
   breaking layout.
4. **Carried pre-event (full checklists in `docs/verification-v2.md` §8,
   v2.1 §5, v2.2 §6):** HTTPS secure-context gate (camera +
   `crypto.subtle`), scanner real-device smoke (iOS Safari + Android
   Chrome: permission states, decode path, camera light off on close),
   PWA install, live polling on venue Wi-Fi, host console
   gate/rotation/clear/kickoff flows, radar motion (upright icons, ring
   speeds, glide), yellow-dot incoming marker, dialog header public bio,
   three profile stat tiles, return-to-event round-trip end-to-end on a
   real device.

---

## 6. Standing backend-TODO reminder (carried from v2.4, unchanged)

> **Chat lifecycle signal for the chat-list status icon (Concept §10.1.7).**
> bleak-node exposes no chat lifecycle state: `model.Chat` /
> `server.ChatResponse` (swagger.json definitions `model.Chat`,
> `server.ChatResponse`) carry only `address`, `room`, `scenario`,
> `language`, `phase` (a free agent-work theme string — «networking»,
> «debate»), `phase_started_at` and `created_at` (+`participants`), and the
> `chats` table (`internal/db/chat.go`) stores exactly those columns — no
> `finished_at`/`state` field exists, `ClearChatMessages` and `ChatKickoff`
> leave the chat row in place, and `phase` is reset (not a completion
> signal). The status icon therefore derives `active` for every chat
> (`lib/chats/view.ts` `chatStatus` — re-confirmed on the current dev tree:
> `view.ts:131-150` still derives `active` for every chat; the doc-comment
> records the slot: the signature already takes the full `Chat`, so adding
> the field is a one-function client change; the `FINISHED` mark — the «!»
> in the chat's own Deepa hue per the §4.12.2 restyle — is already shipped
> behind the `status` prop, `ChatCard.svelte:186-209`). REQUEST: a
> lifecycle field on the chat (e.g. `finished_at` timestamp or a `state`
> enum) exposed through the chat endpoints.

---

DELTA-WAVE CI: GREEN — 2026-11-18T13:47Z, dev b464d8d, lint clean / 591 tests / build 0 errors
