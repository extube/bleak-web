# bleak-web v3.11 — Verification sweep (tz11-07, verification-only)

Worker instance `58699d30` · 2026-11-21 · branch
`feature/58699d30-tz11-07-verify-v311` (base = dev tip `d37c688` — the landing of
`feature/c1266ebd-wizard-autoscroll`). This sweep verifies the **Concept §24
item 12 amendment** (creation-chat auto-scroll, tz11-06 bug round, task 107)
and the **Concept §25 creation-chat desktop layout** (folded into the same
landing) against **DESIGN §4.16.1 item 12 refined + §4.17** — **completing
the §8–§25 verification record** (§24 items 1–13 = `docs/verification-v310.md`,
… earlier per that file's map). No product code and no test files — one-shot
source reads and targeted spot-runs recorded here, per the verification-only
constraint of the card.

Method legend: **S** = source inspection / landed-code read in this sweep,
**T** = merged automated test (file — title), **R** = targeted spot-run
executed first-hand in this session.

Landing commit of the verified scope (dev log, pre-sweep): tz11-06 wizard
autoscroll + folded §25 desktop layout `d37c688` (task 107, worker
`c1266ebd`, branch `feature/c1266ebd-wizard-autoscroll`). Task 107 is `done`
with MR record `merged` `ci=green` (read first-hand via `task.py show 107`).
The landing touched exactly: `CreationWizard.svelte`, `JoinFlow.svelte`,
`creation-wizard.test.ts`, `join-flow.test.ts` (+ the worker's session
record) — the /chats surfaces were not touched (regression item 3).

Spec-source note (recorded, factual): at sweep time the §24-amendment/§25
spec text still lives in the shared checkout's **uncommitted working-copy
edits** of `docs/Concept.md` (§24 item 12 owner fix report + §25) and
`docs/DESIGN.md` (§4.16.1 item 12 refined + §4.17) — the process's pending
doc landing; `dev` HEAD carries the full §24.12-amendment/§25 **product**
state (every source/test file read below is committed at `d37c688`). The
sweep reads the owner amendments from that working copy and verifies the
product tree, not the docs.

---

## 1. Gate record (TZ §8.8 discipline — full gates are delta-wave-CI's job)

| Check | Result | Source |
| --- | --- | --- |
| Full `make test` re-run by this sweep | **not run** (the process runs the delta-wave CI after this landing) | this session |
| Owning worker's MR gates — task 107 (tz11-06 wizard autoscroll + §25 fold) | **green**: MR #107 `merged` `ci=green` (process wave CI on `dev`) | `scripts/task.py show 107` |
| Owning worker's local gates (recorded in its session report) | **green**: targeted 68 green; `make test` 883 green (826 web); `make lint` clean; `make build` 0 errors | `docs/sessions/c1266ebd.md` |
| Targeted spot-runs (first-hand, this session) | **green — 128 tests / 5 web files**: creation-wizard 34 + join-flow 34 + chats-view 25 + chats-page/chats-seen 35 = 128/128 | `npm run test -w @bleak/web -- <files>` (§4) |
| Owning task of the verified scope | task 107 landed into `dev` (dev tip `d37c688` at sweep time) | dev log / task list |

No test was added or modified by this sweep. No product code touched.

DELTA-WAVE CI: [pending — process fills]

---

## 2. Per-item checklist — Concept §24 item 12 amendment + §25 (DESIGN §4.16.1 item 12 + §4.17)

All checks against the landed state at `d37c688`.

### Item 1 — AUTO-SCROLL (§24 item 12 amendment, tz11-06 bug round, task 107) — PASS

All checks against `apps/web/src/lib/components/join/CreationWizard.svelte`
and `apps/web/src/lib/components/join/JoinFlow.svelte`.

| Check | Result | Evidence |
| --- | --- | --- |
| Auto-scroll to the bottom **on chat open** | PASS | S: CreationWizard.svelte 286–299 — the `$effect` reads `transcript.length` + `wizard.step`, so it runs on mount of the chat stage (open) and re-runs on every change; `el.scrollTo({ top: el.scrollHeight, … })`; T: creation-wizard.test.ts — "auto-scrolls to the log bottom SMOOTHLY when the chat opens" (spies the log's real `scrollTo`; asserts the call ran against THE LOG to its `scrollHeight`, `behavior: 'smooth'`) — R: green |
| Auto-scroll **on every new message** | PASS | S: same effect (reactive over the transcript); T: creation-wizard.test.ts — "re-pins the newest message on every sent line (smooth scroll to the bottom)" (two sends → ≥2 scroll runs, each `{ top: log.scrollHeight, behavior: 'smooth' }`) — R: green |
| **Smooth** scrolling; **reduced-motion → auto** | PASS | S: CreationWizard.svelte 281–295 — `reducedMotion` from `matchMedia('(prefers-reduced-motion: reduce)')`; `behavior: reducedMotion ? 'auto' : 'smooth'` (the base.css catch-all only covers CSS animations, not JS scrolling — hence the explicit media check); T: creation-wizard.test.ts 608–627 source pin asserts the exact call shape — R: green |
| **Root cause documented**: the `.join` min-height chain grew with content → the log's flex/overflow never engaged → `scrollTo` was a no-op (the PAGE scrolled) and the sticky composer overlayed the newest bubble | PASS | S: JoinFlow.svelte 419–428 (in-code root-cause comment); join-flow.test.ts 919–931 (describe-block diagnosis note); owner report `docs/bugs/wizard-autoscroll-1.log`; worker session `docs/sessions/c1266ebd.md` (root-cause paragraph) |
| **Structurally fixed** — bounded persona-step chain: `min-height: 0` + flex card; **the log is the scroll container**; **the composer below it in normal flow** (the newest message can never be covered) | PASS | S: JoinFlow.svelte 426–428 (`.join.persona-step { min-height: 0 }` — scoped to the persona step only, other join steps keep their content-driven block layout), 469–483 (`.card.composer-card` flex:1 + min-height:0, flex column; `.stage` carries the flex column), 419–424; CreationWizard.svelte 775–785 (`.wizard` root flex:1 + min-height:0 inside the card), 818–832 (`.log { flex: 1; min-height: 0; overflow-y: auto }` — THE scroll container), 847–860 (`.composer { flex: none; position: sticky; bottom: 0 }` — below the log in normal flow, the sticky pin is a no-op fallback since the composer is not inside the log's scrollport); markup order: `ul.log` first, `.composer` last (CreationWizard.svelte 630–638); T: join-flow.test.ts — "the persona step bounds the height chain so the LOG scrolls, not the page (source pins)"; creation-wizard.test.ts — "structure: the composer sits BELOW the log as a flex sibling — the newest message can never be cut off behind the input bar" (asserts `log.contains(composer)` false, log first / composer last among the stage's children); join-flow.test.ts — "structure: in the rendered persona step the composer follows the log…" — R: green |
| **Bottom padding** — the newest message clears the composer (input + suggestion badges area) | PASS | S: CreationWizard.svelte 818–832 — `.log { padding: 0 0 var(--space-2); }` (comment 821–824: breathing room above the composer edge); T: creation-wizard.test.ts source pin `\.log\s*\{[^}]*padding:\s*0 0 var\(--space-2\)` + `.composer { … flex: none }` (composer keeps its full fixed height) — R: green |

### Item 2 — DESKTOP LAYOUT (Concept §25 / DESIGN §4.17) — PASS

All checks against `JoinFlow.svelte` (+ `+layout.svelte` for the height chain).

| Check | Result | Evidence |
| --- | --- | --- |
| ≥720px: `.join.persona-step` **max-width 800px** — the explicit 750–850px centered column (supersedes the §24 7b 640px rule) | PASS | S: JoinFlow.svelte 503–519 — inside `@media (min-width: 720px)`: `.join.persona-step { max-width: 800px; padding: 0; }` with the supersession comment (508–515); no `max-width: 640px` rule remains in the file; T: join-flow.test.ts — "desktop (Concept §25 / DESIGN §4.17): a 750–850px centered column spanning the FULL screen height; the other join steps untouched" (parses the width, asserts 750 ≤ width ≤ 850); creation-wizard.test.ts — "§24 item 7b superseded by Concept §25 / DESIGN §4.17: the persona card is the explicit 750–850px desktop column in JoinFlow" (800 chosen; the 640px approximation gone) — R: green |
| ≥720px: **padding 0**, **full screen height** — the chat box reaches the window's top and bottom edges, **no vertical centering, no empty space above/below** | PASS | S: the height chain — `+layout.svelte` 60–64 `.app-shell { min-height: 100dvh; display: flex; flex-direction: column }` → `.join` (flex: 1, flex column, JoinFlow.svelte 404–414) → **`.join.persona-step { min-height: 0 }`** (426–428 — the fix: the flex-item automatic minimum size no longer grows with the chat's content, so the bounded height is exactly the 100dvh viewport) → `.card.composer-card { flex: 1; min-height: 0 }` (469–474 — the card FILLS the bounded height, full width at `.join`'s 800px) with `padding: 0` on the persona step at ≥720px (518) — the box reaches both edges; the pre-existing `.join { justify-content: center }` (505) is inert on the persona step (the flex:1 card leaves nothing over to center); T: join-flow.test.ts desktop contract asserts `padding: 0` on `.join.persona-step` in the ≥720px block — R: green |
| ≥720px: **composer anchored at the bottom edge**; the message area above expands to fill all remaining vertical space | PASS | S: the same flex chain — `.stage` (flex: 1, 478–483) → `.wizard` (flex: 1, CreationWizard.svelte 775–785) → `.log` (flex: 1) expands to fill; `.composer { flex: none }` (847–860) is the last child of the flex column, pinned at the card's bottom edge (inside the card's untouched `--space-5` padding — §4.17 item 4 style-untouched rule; the sticky `bottom: 0` is the fallback); T: creation-wizard.test.ts structure contract ("composer … pinned at the bottom edge, Concept §25 item 3") — R: green |
| Phone (<720px) **unchanged** | PASS | S: JoinFlow.svelte 528–538 — the `@media (max-width: 719px)` block is pre-existing v2.6 text (§12 full-screen forms: `.join { max-width: none; padding: 0 }`, `.card { border-radius: 0; clip-path: none; flex: 1 }`); the ≥720px persona-step overrides live only inside the 720px query; T: join-flow.test.ts desktop contract slices the ≥720px block BEFORE the 719px query and pins only that slice — R: green |
| **Visual styles untouched** — colors, dark bg shades, bubble colors, fonts, borders, button styles — size/layout proportions only | PASS | S: the landed diff touches only the flex/width/padding geometry quoted above (JoinFlow.svelte 419–519; CreationWizard.svelte scroll effect + `.log` padding + `.composer` flex) — no color/border/font rules added; T: join-flow.test.ts — `expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)` (no hex color overrides anywhere in the file) — R: green |

### Item 3 — REGRESSIONS — PASS

| Check | Result | Evidence |
| --- | --- | --- |
| Other join steps (code / preview / vault) untouched | PASS | S: every new geometry rule is scoped to the persona step: `.join.persona-step { min-height: 0 }` (JoinFlow.svelte 426), `class:composer-card={flow.step === 'persona'}` (344), `class:persona-step={flow.step === 'persona'}` (317) — the `.card.composer-card`/`.stage` flex treatments only engage on the persona step; the desktop block's other steps keep `.join { max-width: 480px }` (504–507); T: join-flow.test.ts — "…the other join steps untouched" (`\.join\s*\{[^}]*max-width:\s*480px` in the ≥720px block); creation-wizard.test.ts — "The card flex-column treatment is scoped to the persona step" — R: green |
| The /chats page chat behavior untouched | PASS | S: the tz11-06 landing commit `d37c688` touched only CreationWizard.svelte / JoinFlow.svelte + their two test files (git show --stat, read first-hand) — `routes/chats/[address]/+page.svelte` (own `height: 100dvh` + `isNearBottom` stick-chip auto-scroll, chats-view.test.ts 173–179) is untouched; the creation-chat scroll effect lives only in the wizard; T: chats-page.test.ts + chats-seen.test.ts + chats-view.test.ts all green first-hand — R: green (35 + 25 tests) |
| Prior wizard contracts green | PASS | T/R: creation-wizard.test.ts 34/34 + join-flow.test.ts 34/34 green in this session (incl. the §4.16.1 v3.10 batch contracts: items 1–13 of §24 — no echo, revert arrow, full history, counter, fades, calm intro, pixel greeting, clear "x", fixed input height, no footer note, autofocus, right back) |

---

## 3. Test anchors (existing suites kept green, extended by task 107)

| Suite | Contracts added by the verified scope (task 107) | Status this sweep |
| --- | --- | --- |
| `apps/web/tests/creation-wizard.test.ts` | item-12 source pin rewritten (608–627: reactive over transcript+step, smooth/reduced-motion call shape, log bottom padding, composer flex:none, JoinFlow bounded chain); NEW behavioral describe "item 12 auto-scroll" (638–704: scroll-to-bottom on open, re-pin on every sent line, composer-below-log structure); §4.17 width contract (307–319) | 34/34 green (spot-run) |
| `apps/web/tests/join-flow.test.ts` | NEW describe "creation-chat geometry" (919–995: bounded height-chain source pins, §4.17 desktop column 750–850px + padding 0 + no-hex + other steps untouched, rendered persona-step composer-follows-log structure) | 34/34 green (spot-run) |
| `apps/web/tests/chats-page.test.ts`, `chats-seen.test.ts`, `chats-view.test.ts` | none — deliberately untouched (the /chats behavior must not change; they stayed green across the landing) | 35 + 25 green (spot-runs) |

---

## 4. Targeted spot-runs (first-hand in this session)

| Run | Result |
| --- | --- |
| `npm run test -w @bleak/web -- tests/creation-wizard.test.ts` | 1 file, **34 passed** |
| `npm run test -w @bleak/web -- tests/join-flow.test.ts` | 1 file, **34 passed** |
| `npm run test -w @bleak/web -- tests/chats-view.test.ts` | 1 file, **25 passed** |
| `npm run test -w @bleak/web -- tests/chats-page.test.ts tests/chats-seen.test.ts` | 2 files, **35 passed** |

Total: **128/128 green across 5 files.** No new test files; no product code
changes (working-tree product files untouched by this sweep — the
pre-existing foreign edits to `docs/Concept.md` / `docs/DESIGN.md` /
`apps/web/vite.config.ts` in the shared checkout are not this sweep's and
were left alone).

---

## 5. Carried-forward manual checks for the owner

**NEW this round:**

1. **The auto-scroll on a REAL long wizard chat (the §24 item 12 amendment's
   own manual check):** create a persona over a long interview (all name →
   public → private → contact → theme → topic steps so the log clearly
   overflows the screen) — on **chat open and after EVERY send** the newest
   message must be **fully visible right above the composer** (never stuck
   at the top, never partially cut off behind the input bar or the
   tg:@/signal:@/inst:@ badge row); the scroll motion should read as
   smooth (instant if the device prefers reduced motion); the newest bubble
   should have a little breathing room above the composer edge (the log's
   bottom padding).
2. **The desktop full-height layout on a real screen (Concept §25):** on a
   computer (≥720px wide) open the creation chat — the chat box must span
   the window's **full height** (top edge to bottom edge, no vertical
   gutter, no vertical centering) as an **~800px centered column** (the
   750–850px target, no longer the narrow room-chat approximation), with
   the **input bar anchored at the bottom edge** of the screen and the
   message area filling everything above it; on a phone (<720px) the wizard
   stays full-screen exactly as before; colors/bubbles/fonts/borders/buttons
   must be visually unchanged (size/proportions only).

**Carried forward (standing arcade-sheet/on-device items — full notes in
`docs/verification-v32.md` §5 through `docs/verification-v39.md`/`-v310.md`
§5 and earlier):** the wizard end-to-end on a REAL invite (arrow ⇄ send
swap, "x" clear, centered counter, prefixes above the input, right back on
non-standard forms, multi-theme loop, 400ms fades, no echo, monotonic
history); **supersedes v310 §5 item 2** (the 640px desktop-dims check is
replaced by the full-height ~800px-column check above); autofocus on device
after every send; the send button/counter/placeholders feel on real and
soft keyboards; the skip/back paths on a real invite; the bulk-interests
flush surviving a slow backend; the tap-form flow on a REAL added-you item;
the arcade-sheet end-to-end on a real finished chat (spring rise, cascade
stagger, tally + ring, tier animations across all three tiers, Great-match
title, X close legibility on every Deepa hue incl. yellow, checklist
pop-flash-draw, confetti + victory jumps + copy swap, re-open replays
nothing); per-hue sheet legibility on device; slide v2 feel on touch AND
mouse; sheet scroll with a long summary text; slide / Summarization-button
bottom alignment and button states on device; Press Start 2P RU headers on
device; the lazy summary flow end-to-end; the people-page sort order on a
real mixed room; the bigger finished-dot legibility on device; the
chats-list common block + dividers and the dimmed-content unfinished item
on device; the single newest-first time order with mixed items; and the
earlier standing items — RU date/time ICU, Deepa violet legibility, radar
feel after the §13 tuning, summary-sheet freshness, contacts tab dot flow,
join digit-row/full-screen forms, the on-device scanner smoke (HTTPS
secure-context gate, iOS Safari + Android Chrome decode path, camera light
off on close), PWA install, venue Wi-Fi polling, host-console flows,
return-to-event round-trip.

---

*Verification-only sweep by worker `58699d30` (task 108, tz11-07) — no
product code, no test files; the delta-wave CI record above is filled by
the process after the merge.*
