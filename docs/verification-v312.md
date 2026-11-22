# bleak-web v3.12 — Verification sweep (tz11-11, verification-only)

Worker instance `3adc1f08` · 2026-11-21 · branch
`feature/3adc1f08-tz11-11-verify-v312` (base = dev tip `2fe74ca` — the landing of
`feature/c1266ebd-two-region-layout`). This sweep verifies the **Concept §27
owner structural order** (two fixed areas for the creation chat, bug round 3,
task 111) against **DESIGN §4.17** (carried §4.15.8 context) + the carried
§24/§25 contracts — **completing the §8–§27 verification record** (§24 items
1–13 = `docs/verification-v310.md`, §24.12 amendment + §25 =
`docs/verification-v311.md`, … earlier per that file's map). No product code
and no test files — one-shot source reads and targeted spot-runs recorded
here, per the verification-only constraint of the card.

Method legend: **S** = source inspection / landed-code read in this sweep,
**T** = merged automated test (file — title), **R** = targeted spot-run
executed first-hand in this session.

Landing commit of the verified scope (dev log, pre-sweep): tz11-10 two-region
layout `2fe74ca` (task 111, bug round 3, worker `c1266ebd`, branch
`feature/c1266ebd-two-region-layout`). Task 111 is `done` with MR record
`merged` `ci=green` (read first-hand via `task.py show 111`). The landing
touched exactly: `CreationWizard.svelte`, `JoinFlow.svelte`,
`ChatTranscript.svelte`, `creation-wizard.test.ts`, `join-flow.test.ts`
(+ the worker's session record) — the /chats route files were not touched
(regression item 4).

Spec-source note (recorded, factual): at sweep time the §27 spec text still
lives in the shared checkout's **uncommitted working-copy edit** of
`docs/Concept.md` (§27 — the process's pending doc landing); `dev` HEAD
carries the DESIGN §4.15.8/§4.17 spec text committed, and the full §27
**product** state (every source/test file read below is committed at
`2fe74ca`). The sweep reads the owner order from that working copy and
verifies the product tree, not the docs.

---

## 1. Gate record (TZ §8.8 discipline — full gates are delta-wave-CI's job)

| Check | Result | Source |
| --- | --- | --- |
| Full `make test` re-run by this sweep | **not run** (the process runs the delta-wave CI after this landing) | this session |
| Owning worker's MR gates — task 111 (tz11-10 two-region layout) | **green**: MR #111 `merged` `ci=green` (process wave CI on `dev`) | `scripts/task.py show 111` |
| Owning worker's local gates (recorded in its session report) | **green**: targeted 73/73 + chat-transcript 6/6; `make test` 894 green; `make lint` clean; `make build` 0 errors (9 pre-existing warnings unrelated) | `docs/sessions/c1266ebd.md` |
| Targeted spot-runs (first-hand, this session) | **green — 139 tests / 5 files**: creation-wizard 37 + join-flow 36 + chat-transcript 6 + chats-view/chats-page/chats-seen 60 = 139/139 | `npm run test -w @bleak/web -- <files>` (§4) |
| Owning task of the verified scope | task 111 landed into `dev` (dev tip `2fe74ca` at sweep time) | dev log / task list |

No test was added or modified by this sweep. No product code touched.

DELTA-WAVE CI: [pending — process fills]

---

## 2. Per-item checklist — Concept §27 (DESIGN §4.17, carried §4.15.8 context)

All checks against the landed state at `2fe74ca`.

### Item 1 — TWO-REGION GEOMETRY (Concept §27 items 1–2/4; DESIGN §4.17) — PASS

All checks against `apps/web/src/lib/components/join/JoinFlow.svelte`,
`apps/web/src/lib/components/join/CreationWizard.svelte` and the
`join-flow.test.ts` / `creation-wizard.test.ts` contracts.

| Check | Result | Evidence |
| --- | --- | --- |
| **Definite-height root**: `height: 100vh` fallback + `height: 100dvh` on the **persona-gated wrapper** — `:global(.app-shell > .join:has(> .persona-step))`; the later supported declaration wins | PASS | S: JoinFlow.svelte 444–465 — the rule carries `min-height: 0; max-width: none; padding: 0;` **then `height: 100vh` (463) and `height: 100dvh` (464)** with the tz11-10 comment (448–462: a min-height alone never makes a flex chain definite; 100dvh = the dynamic viewport — the area left after the keyboard; the later supported declaration wins); T: join-flow.test.ts — "tz11-08 (task 109…) the page-level .join wrapper link ABOVE JoinFlow is bounded for the persona step" (961–976: the source pin asserts BOTH declarations and the ORDER — `indexOf('height: 100vh')` < `indexOf('height: 100dvh')`); the cascade contract ("the computed chain from div.log to the app-shell… the two-region root is the DEFINITE 100dvh wrapper height", 1149) asserts the off-state wrapper computes `height: ''` (no declared height for the other join steps) and the on-state wrapper's height resolves to a definite px length (1234) — R: green |
| The **messages area is the ONLY scrollable region** with its own scroll-port — `.log` = flex: 1 + min-height: 0 + `overflow-y: auto`; no other element in the whole rendered chain scrolls | PASS | S: CreationWizard.svelte 864–882 (`.log { flex: 1; min-height: 0; overflow-y: auto; }` — the bounded messages area; markup 656–669, REGION 1 first child of `.stage`); T: join-flow.test.ts cascade contract 1255–1262 — `getComputedStyle(pLog).overflowY === 'auto'` and the scrollers filter over the ENTIRE rendered chain yields **exactly `[pLog]`** (the only element with `overflow-y: auto`); creation-wizard.test.ts — "the computed chat-stage cascade (tz11-10, Concept §27): TWO REGIONS — the log is the SINGLE scroll container (the messages area) and the ONLY scrollable element…" — R: green |
| **Bounded scroll within the area; edge flicks do not chain to the page** — `overscroll-behavior: contain` on the scroll-port | PASS | S: CreationWizard.svelte 878–881 — `overscroll-behavior: contain` with the comment ("the area's scroll-port is the ONLY scrollable region, so an edge flick never chains to the page — layout geometry, not a visual style"); T: creation-wizard.test.ts two-region source pin — `expect(css).toMatch(/\.log\s*\{[^}]*overscroll-behavior:\s*contain/)` (294) — R: green |
| **The composer = the USER-FORM AREA: flex:none / static, OUTSIDE the scroll-port** — `log.contains(composer)` false; the stage has exactly the two regions `[log, composer]`; the sticky overlay vestige of the pre-two-region rounds is GONE | PASS | S: markup order — CreationWizard.svelte 651–675: `div.stage` → `div.log` (REGION 1) then `div.composer` (REGION 2, 675); `.composer { flex: none; … }` (898–910, static — no `position: sticky`/`bottom: 0` remains); T: creation-wizard.test.ts 279–321 source pin asserts `\.composer\s*\{[^}]*flex:\s*none` AND `not.toMatch(/\.composer\s*\{[^}]*position:\s*sticky/)` AND `not.toMatch(/\.composer\s*\{[^}]*bottom:\s*0/)`; behavioral structure contract 748–764 — `log.contains(composer)` false, `stage.children` length 2, log first / composer last; join-flow.test.ts cascade contract 1264–1275 — `pLog.contains(pComposer)` false, `[...pStage.children]` equals `[pLog, pComposer]`, `getComputedStyle(pComposer).flexGrow === '0'` — R: green |
| **The definite-height chain resolves below the wrapper** — every flex-item link from the log up to the shell is a bounded flex column (`display: flex; flex-direction: column; min-height: 0`) | PASS | S: the chain — wrapper (JoinFlow 444–465) → `.join.persona-step { min-height: 0 }` (426–428) → `.card.composer-card { flex: 1; min-height: 0 }` (506–511) → `.card.composer-card .stage` (515–520) → `.wizard { flex: 1; min-height: 0 }` (CreationWizard 812–822) → `.stage { flex: 1; min-height: 0 }` (889–897) → `.log`; T: join-flow.test.ts cascade contract 1236–1249 — walks every ancestor between the log and the shell (≥6 links) and asserts flex + column + min-height 0 computed on EACH — R: green |
| **Persona-gating**: the definite height + bounded geometry engage ONLY while the creation chat is mounted; the other join steps (code/preview/vault/resume) keep their content-driven geometry | PASS | S: the gate selector itself is `:has(> .persona-step)` (JoinFlow 444); `class:persona-step={flow.step === 'persona'}` (317), `class:composer-card={flow.step === 'persona'}` (344); T: join-flow.test.ts cascade contract GATE — the code-step wrapper does NOT match the gate and computes `min-height` unset + `height: ''` (1166–1169, 1206–1213), the persona-step wrapper DOES (1223–1224); desktop contract 1001–1020 — the other steps keep `.join { max-width: 480px }` inside the ≥720px block — R: green |

### Item 2 — AUTOSCROLL (Concept §27 item 3 — autoscroll to the bottom OF THE AREA, not a measured page hack) — PASS

All checks against `apps/web/src/lib/components/chats/ChatTranscript.svelte`
(the shared machinery the wizard drives with `smooth` + `pinKey`,
CreationWizard.svelte 663–668) and the creation-wizard.test.ts contracts.

| Check | Result | Evidence |
| --- | --- | --- |
| The pin targets the messages area's **OWN scroll-port** (the caller's scroller = the wizard's `.log`) — never a measured hack against the page/parents | PASS | S: ChatTranscript.svelte 135–145 — `pinToBottom(el)` calls `el.scrollTo({ top: el.scrollHeight, … })` on the CALLER'S scroller; the wizard binds `scroller={logEl}` (CreationWizard 665, `bind:this={logEl}` on `div.log` 658); T: creation-wizard.test.ts — "auto-scrolls to the log bottom SMOOTHLY when the chat opens" (710–726: asserts the scroll ran against THE LOG to its `scrollHeight`) — R: green |
| **Smooth pin on open** (the chat stage mounts) | PASS | T: creation-wizard.test.ts 710–726 ("auto-scrolls to the log bottom SMOOTHLY when the chat opens" — `{ top: log.scrollHeight, behavior: 'smooth' }`) — R: green; the pin effect runs on mount (lines dependency) |
| **Smooth pin on every append** (every sent line) | PASS | S: ChatTranscript.svelte 156–183 — the `$effect` reads `lines` (and `pinKey`), calls `pinToBottom(el)`; T: creation-wizard.test.ts 728–746 ("re-pins the newest message on every sent line" — two sends → ≥2 scroll runs, each smooth to the log's bottom) — R: green |
| **Smooth pin on every composer step swap** (`pinKey={wizard.step}`) | PASS | S: CreationWizard.svelte 667 (`pinKey={wizard.step}`); ChatTranscript 156–158 (`void pinKey` in the effect) — the keyed panel remount re-runs the pin; T: creation-wizard.test.ts — "item 12 (tz11-09, DESIGN §4.18): the autoscroll IS the shared main-room machinery — the wizard drives ChatTranscript (smooth pin + composer pinKey)…" (641) — R: green |
| **The bounded double-rAF settled-layout re-assert** — one more pin two rAFs later, cancelled on re-run or unmount | PASS | S: ChatTranscript.svelte 161–180 — `requestAnimationFrame(() => requestAnimationFrame(() => { if (el.isConnected) pinToBottom(el); }))`, cancelled in the cleanup; T: creation-wizard.test.ts — "the settled-layout re-assert fires two rAFs after a send (deterministic, stubbed frames)" (848) — R: green |
| **NEW (tz11-10): the ResizeObserver re-assert on the scroll-port's OWN box-height changes** (keyboard open/close over the 100dvh area, late font metrics, a composer panel swap) — smooth mode ONLY; observing the scroll-port itself (border-box) **cannot loop** (a scrollTop pin never resizes the box); **disconnected on unmount** | PASS | S: ChatTranscript.svelte 194–214 — the effect returns early unless `smooth`; `new ResizeObserver(() => { if (el.isConnected) pinToBottom(el); })` + `observer.observe(el)`; the cleanup `observer?.disconnect()`; the code comment 185–193 documents the no-loop argument and the main-room stick contract staying untouched; T: creation-wizard.test.ts 893–940 — the RO stub asserts the observed element IS the log, a fired height change re-pins `{ top: log.scrollHeight, behavior: 'smooth' }`, and `cleanup()` calls `disconnect` (no leak) — R: green |
| Smooth mode honors **prefers-reduced-motion** (instant under the media query) | PASS | S: ChatTranscript.svelte 130–141 — `reducedMotion` from `matchMedia('(prefers-reduced-motion: reduce)')`; `behavior: reducedMotion ? 'auto' : 'smooth'` (and the rAF re-assert is skipped under reduced motion, 163) — R: source-read only this sweep (the media-query contract was first-hand green in v311) |

### Item 3 — NO VISIBLE BOUNDARY (Concept §27 item 4) — PASS

| Check | Result | Evidence |
| --- | --- | --- |
| Geometry-only — **no visual styles touched** (colors, dark bg shades, bubble colors, fonts, borders, button styles) | PASS | S: the landing diff `2fe74ca` (read first-hand via `git show --stat` + per-file diffs) — the only style-block additions are `overscroll-behavior: contain` (CreationWizard 881), `height: 100vh/100dvh` (JoinFlow 463–464) and the flex/overflow geometry above; a grep of the diff's ± lines for `background/border/font/radius/clip/shadow/color:` matches ONLY comment lines; `.composer` keeps its pre-existing `background: var(--color-surface)` and `padding-top`; T: join-flow.test.ts desktop contract — `expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)` (no hex color overrides anywhere in JoinFlow, 1019) — R: green |
| The two areas partition layout geometry only — no separator element/border between REGION 1 and REGION 2 | PASS | S: the stage has exactly two children (`div.log`, `div.composer`) — no divider/border element exists between them; `.composer` carries no top border (only `padding-top: var(--space-2)`, 909); T: the structure contracts (`stage.children` length 2, cascade `[pLog, pComposer]`) — R: green |

### Item 4 — REGRESSIONS — PASS

| Check | Result | Evidence |
| --- | --- | --- |
| **/chats default mode untouched** — the main room keeps its stick-tracking contract; NO ResizeObserver, no chip regression | PASS | S: routes/chats/[address]/+page.svelte 633–638 — ChatTranscript is used WITHOUT `smooth` (default), bound to the page's own `scrollEl`; ChatTranscript.svelte 120–125 — the scroll listener binds only in default mode (`if (!el || smooth) return`); 194–197 — the RO effect returns early unless `smooth`; the landing commit touched no /chats route file (git show --stat first-hand); T/R: chats-view.test.ts + chats-page.test.ts + chats-seen.test.ts — **60/60 green** in this session |
| **Prior wizard contracts green** (§24 items 1–13 + §25 desktop layout carried intact) | PASS | T/R: creation-wizard.test.ts **37/37** + join-flow.test.ts **36/36** green in this session — incl. the §4.16.1 batch contracts (no echo, revert arrow ⇄ send, full monotonic history, centered counter, 400ms fades, calm intro, pixel greeting, clear "x", fixed input height, no footer note, autofocus, right back on non-standard forms), the §25 desktop contracts (750–850px column, padding 0, other steps untouched) and the task-107/109 geometry contracts |
| **Prior chat-transcript/people/arcade surface contracts green** | PASS | T/R: chat-transcript.test.ts **6/6** green in this session (the shared machinery's own suite); the people/arcade suites are untouched by the landing (git show --stat first-hand — only the three chat components + two wizard tests changed) and were green at the owner worker's full gate (894 green, `docs/sessions/c1266ebd.md`) |

---

## 3. Test anchors (existing suites kept green, extended by task 111)

| Suite | Contracts added by the verified scope (task 111) | Status this sweep |
| --- | --- | --- |
| `apps/web/tests/creation-wizard.test.ts` | the two-region source pin rewritten (279–321: flex:none composer, no sticky/bottom, `.log` flex:1 + min-height:0 + overflow-y + overscroll-behavior contain); NEW cascade contract "TWO REGIONS — the log is the SINGLE scroll container…" (791); NEW RO height-change re-assert contract (893–940) | 37/37 green (spot-run) |
| `apps/web/tests/join-flow.test.ts` | the wrapper source pin extended (961–976: `height: 100vh` + `height: 100dvh`, later-supported-wins order); the cascade contract extended to the DEFINITE-height root (1149–1276: on/off-state gate cascade, the ≥6-link bounded chain, the single-scroller proof, the two regions [log, composer] + flexGrow 0) | 36/36 green (spot-run) |
| `apps/web/tests/chat-transcript.test.ts` | the shared smooth machinery's suite (the wizard drives it with smooth + pinKey; the RO lives smooth-only) | 6/6 green (spot-run) |
| `apps/web/tests/chats-view.test.ts`, `chats-page.test.ts`, `chats-seen.test.ts` | none — deliberately untouched (the /chats behavior must not change; they stayed green across the landing) | 60/60 green (spot-run) |

---

## 4. Targeted spot-runs (first-hand in this session)

| Run | Result |
| --- | --- |
| `npm run test -w @bleak/web -- tests/creation-wizard.test.ts` | 1 file, **37 passed** |
| `npm run test -w @bleak/web -- tests/join-flow.test.ts` | 1 file, **36 passed** |
| `npm run test -w @bleak/web -- tests/chat-transcript.test.ts` | 1 file, **6 passed** |
| `npm run test -w @bleak/web -- tests/chats-view.test.ts tests/chats-page.test.ts tests/chats-seen.test.ts` | 3 files, **60 passed** |

Total: **139/139 green across 5 files.** No new test files; no product code
changes (working-tree product files untouched by this sweep — the
pre-existing foreign edits to `docs/Concept.md` / `docs/DESIGN.md` /
`apps/web/vite.config.ts` in the shared checkout are not this sweep's and
were left alone).

---

## 5. Carried-forward manual checks for the owner

**NEW this round (the Concept §27 structural order — a REAL long wizard
chat):**

1. **The two-region layout on a real long wizard chat:** create a persona
   over a long interview (all name → public → private → contact → theme →
   topic steps so the transcript clearly overflows the messages area) — the
   **message area scrolls WITHIN its own bounds** (the page must never
   scroll; the composer and the intro/head chrome must never be pushed off
   screen); the **last message always sits strictly above the composer**
   (never behind or partially cut off by the input bar or the
   tg:@/signal:@/inst:@ badge row — the log's bottom padding gives it
   breathing room); on every send and on chat open the newest bubble is
   pinned to the bottom of the messages area smoothly (instant under
   reduced motion).
2. **Edge flicks do not chain to the page:** with the transcript overflowing,
   flick hard at the TOP of the messages area and drag at the bottom — the
   scroll must stop (rubber-band inside the area on iOS) without ever
   chaining the momentum to the page/any outer container.
3. **Keyboard open/close re-pin:** on a real device (soft keyboard), with the
   newest message pinned — open the keyboard (tap the input): the messages
   area shrinks to the area left after the keyboard and the pin RE-ASSERTS
   (the last message stays strictly above the composer); close the keyboard:
   the area grows back and the pin re-asserts again. No "stuck at top"
   recurrence, no jump that lands short of the bottom.

**Carried forward (standing wizard/desktop items — full notes in
`docs/verification-v311.md` §5 and earlier):** the wizard end-to-end on a
REAL invite (arrow ⇄ send swap, "x" clear, centered counter, prefixes above
the input, right back on non-standard forms, multi-theme loop, 400ms fades,
no echo, monotonic history); the desktop full-height ~800px-column check
(Concept §25 — unchanged by tz11-10, which added the definite 100dvh root
beneath it); autofocus on device after every send; the send
button/counter/placeholders feel on real and soft keyboards; the skip/back
paths on a real invite; the bulk-interests flush surviving a slow backend;
the tap-form flow on a REAL added-you item; the arcade-sheet end-to-end on a
real finished chat (spring rise, cascade stagger, tally + ring, tier
animations across all three tiers, Great-match title, X close legibility on
every Deepa hue incl. yellow, checklist pop-flash-draw, confetti + victory
jumps + copy swap, re-open replays nothing); per-hue sheet legibility on
device; slide v2 feel on touch AND mouse; sheet scroll with a long summary
text; slide / Summarization-button bottom alignment and button states on
device; Press Start 2P RU headers on device; the lazy summary flow
end-to-end; the people-page sort order on a real mixed room; the bigger
finished-dot legibility on device; the chats-list common block + dividers
and the dimmed-content unfinished item on device; the single newest-first
time order with mixed items; and the earlier standing items — RU date/time
ICU, Deepa violet legibility, radar feel after the §13 tuning,
summary-sheet freshness, contacts tab dot flow, join digit-row/full-screen
forms, the on-device scanner smoke (HTTPS secure-context gate, iOS Safari +
Android Chrome decode path, camera light off on close), PWA install, venue
Wi-Fi polling, host-console flows, return-to-event round-trip.

---

## tz11-11 appendix (real-browser manual smoke — MANDATORY pre-event)

1. Open `/` in a real browser (phone profile <720px AND desktop ≥720px),
   resolve an invite code, choose create, start the wizard interview.
2. Fill enough answers that the transcript visibly exceeds the messages
   area. EXPECT (Concept §27): the messages area scrolls within its bounds —
   the page never scrolls; after EVERY send the newest bubble is pinned
   strictly above the composer with breathing room; flicks at the edges do
   not chain to the page; opening/closing the keyboard re-pins the bottom
   of the area.
3. Desktop: the chat column is ~800px, centered, and the box reaches the
   window's top and bottom edges (the §25 full-height conduit still holds —
   the tz11-10 definite-height root rides under it); code/vault/resume
   steps are unchanged.
4. `prefers-reduced-motion: reduce`: the re-pin is instant (no smooth
   animation), all other behavior identical.

---

*Verification-only sweep by worker `3adc1f08` (task 112, tz11-11) — no
product code, no test files; the delta-wave CI record above is filled by
the process after the merge.*
