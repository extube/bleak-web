# bleak-web v3.5 — Verification sweep (tz8-07, verification-only)

Worker instance `d89a0d18` · 2026-11-20 · branch
`feature/d89a0d18-tz8-07-verify-v35` (base = dev tip `071da34` — the landing of
`feature/bc92eac7-tz8-06-dot-size`; all three §18 feature branches landed into
`dev` before this sweep, see the commit map below). This sweep verifies the
**Concept §18 microchanges** (v3.5 GREAT-tier cleanup, finished-dot size,
lazy background summary loading — DESIGN §4.15.3) are delivered on `dev`.
It adds **no product code and no test files** — one-shot source reads and
targeted spot-check runs recorded here, per the verification-only constraint
of the card. It completes the §13–§18 verification record (§13 =
`docs/verification-v3.md`, §14 = `-v31.md`, §15 = `-v32.md`, §16 = `-v33.md`,
§17 = `-v34.md`).

Method legend: **S** = source inspection / landed-code read in this sweep,
**T** = merged automated test (file — title), **R** = targeted spot-run
executed first-hand in this session.

Landing commits of the §18 round (dev log, all pre-sweep): tz8-04
great-tier-cleanup `14c59ba` (task 84, worker `c2190dd4`), tz8-05
summary-lazy-background `401cbea` (task 85, worker `fdcbf411`), tz8-06
dot-size `071da34` (task 86, worker `bc92eac7`).

---

## 1. Gate record (TZ §8.8 discipline — full gates are delta-wave-CI's job)

| Check | Result | Source |
| --- | --- | --- |
| Full `make test` re-run by this sweep | **not run** (the process runs the delta-wave CI after this landing) | this session |
| Owning workers' local gates — task 84 (tz8-04) | **green**: targeted summary-sheet 57/57 · full `make test` 805 passed · `make lint` clean · `make build` 0 errors | `docs/sessions/c2190dd4.md` report |
| Owning workers' local gates — task 85 (tz8-05) | **green**: targeted suites (104) · full `make test` (819) · `make lint` · `make build` — all green | `docs/sessions/fdcbf411.md` report |
| Owning workers' local gates — task 86 (tz8-06) | **green**: targeted chats-page 27/27 · full `make test` 762/762 (as reported) · `make lint` clean · `make build` clean | `docs/sessions/bc92eac7.md` report |
| Targeted spot-runs (4 card-anchored suites, first-hand) | **green — 131 tests / 4 files** (summary-sheet + summary-cache + transcript-page + chats-page) | `npm run test -w @bleak/web -- <files>` (§4), all passing |
| Owning tasks of the §18 items | tasks 84 + 85 + 86 all landed into `dev` (dev tip `071da34` at sweep time) | dev log |

No test was added or modified by this sweep. No product code touched.

DELTA-WAVE CI: [pending — process fills]

---

## 2. Per-item checklist — Concept §18

### Item 1 — GREAT-TIER CLEANUP (§18.1 / §4.15.3.1, task 84 `14c59ba`) — PASS

All checks against `apps/web/src/lib/components/SummarySheet.svelte` (landed
state) + `apps/web/tests/summary-sheet.test.ts:614-626, 696-725` (the
§4.15.3.1 blocks).

| Check | Result | Evidence |
| --- | --- | --- |
| Dashed beam connector fully removed — no `.beam` styles/keyframes | PASS S/T | one-shot repo-wide grep over `apps/web/src` for `beam`: only 4 matches, ALL comment prose (the doc-comment `:36`, the GREAT markup comment `:428-431`, the CSS removal comment `:900-904` citing "the 4px dashed strip, .beam/.beam-stripes, its march and pulse keyframes — was REMOVED"); zero CSS selectors, zero `@keyframes` for beam; tests `summary-sheet.test.ts:720-724` (rendered GREAT sheet: `.beam`/`.beam-stripes` both null; `SHEET_SOURCE` not matching `/\.beam[\s,{]/`, no `beam-march`, no `beam-pulse`) |
| GREAT approach + hop animations intact | PASS S/T | `.tier-great .side.me .mover` → `avatar-approach 300ms ease-out 200ms both` `:780-781`; `.side.them .mover` → `avatar-approach-left` `:783-784`; keyframes `:786-801` (±18px); `.tier-great .mover .avatar-frame` → `avatar-hop 600ms steps(2, jump-none) infinite alternate` (delay 500ms) `:802-805`, keyframes `:806-813` (0 → −6px); tests `summary-sheet.test.ts:697-712` |
| GREAT sparkles intact | PASS S/T | 6 poppers (star ×3 `:433,435,437`, heart ×3 `:434,436,438`) + `.popper` `sparkle-pop 1.2s steps(2, jump-none) infinite` `:917-923`, staggered 0–500ms, yellow/orange/white `:924-929`, keyframes `:930-947`; test `summary-sheet.test.ts:727+` |
| Tier thresholds 80/50 intact | PASS S/T | tier stage classes 90 → tier-great / 66 → tier-good / 30 → tier-low (test `summary-sheet.test.ts:664-674`); tier labels + yellow GREAT ink (`:676-694`) — all green in the spot-run (§4) |
| Checklist / slide / layout untouched by the removal | PASS S/T | the checklist choreography, sheet-variant slide contracts and §16.2 layout describe blocks — all green in the spot-run (§4); the removal touched only the GREAT bridge (comment-only residue + test contracts), no layout-selective diff |
| User names 16px / 600, centered below their avatars — matching the GOOD-chat styling | PASS S/T | `.who` `:705-715` — `font-size: 16px; font-weight: 600; text-align: center` on `--font-body` (white ink, ellipsis), under the 56×56 frame inside the `.side` column (`flex-direction: column; align-items: center` `:675-680`); the doc-comment pins the chat-surfaces name treatment (`:702-704`); test `summary-sheet.test.ts:614-626` ("names sit under the frames (Inter 16px semibold, centered — matching the good-chat styling)": `.who` count/order, `font-family/--font-body`, `font-size: 16px`, `font-weight: 600`, `text-align: center`) |

### Item 2 — FINISHED-DOT SIZE (§18.2 / §4.15.3.2, task 86 `071da34`) — PASS

All checks against `apps/web/src/lib/components/chats/ChatCard.svelte`
(landed state) + `apps/web/tests/chats-page.test.ts:253-287, 360-399` (the
§4.15.2.2/§4.15.3.2 blocks).

| Check | Result | Evidence |
| --- | --- | --- |
| `.dot` is 14px (border-box) = the `.loader` spinner's outer diameter exactly | PASS S/T | `.dot` `:232-238` (`width: 14px; height: 14px; border-radius: 50%`) — the §4.15.3.2 doc-comment pins "the §4.13.4 loader's outer diameter exactly (14px, border-box …)" `:228-231`; `.loader` `:259-267` (`width: 14px; height: 14px` + the 2px ring, border-box per the global `box-sizing`) with the size documented as the dot's match `:254-258`; test `chats-page.test.ts:384-396` (the SIZE-CONTRACT test: dot width === loader width, dot height === loader height, both `'14'`) |
| Hue unchanged | PASS S/T | `.dot.deepa-1…deepa-5` → `var(--color-deepa-<n>)` `:239-253`; the hue class still comes from `codeHue(counterpartAddress)` (`fnv1a % 5`); tests `chats-page.test.ts:280, 344, 367-370, 547` — green in the spot-run |
| Position unchanged (right side, last flex child) | PASS S | the dot span stays the `<a class="chat-card">`'s last element `:137-147` (finished branch), after the avatar + `.main` block |
| Behavior unchanged (finished-only, aria-hidden, title, never with the spinner) | PASS S/T | `{#if state === 'finished'}<span class="dot {hueClass}" aria-hidden="true" title={statusLabel}>` `:137-144` / `{:else}<span class="loader">` `:145-147`; tests `chats-page.test.ts:253-287` (finished-only + no-dot-on-unfinished), `:289-317` (poll flip dot ↔ spinner) — green in the spot-run |
| Unfinished items still no dot + spinner | PASS S/T | the unfinished branch carries only `.loader` + `loader-spin 0.9s linear infinite` `:145-147, 259-272`; tests `chats-page.test.ts:261, 516, 532-533, 571-572` — green in the spot-run |

### Item 3 — SUMMARY LAZY BACKGROUND (§18.3 / §4.15.3.3, task 85 `401cbea`) — PASS

All checks against `apps/web/src/lib/stores/summaryCache.ts` (new session
store) + `apps/web/src/routes/chats/[address]/+page.svelte` +
`apps/web/src/lib/components/SummarySheet.svelte` (landed state) +
`apps/web/tests/summary-cache.test.ts`, `tests/transcript-page.test.ts:518-604`,
`tests/summary-sheet.test.ts:313-326` (the §4.15.3.3 blocks).

| Check | Result | Evidence |
| --- | --- | --- |
| `summaryCache` store: chat-address key, owner stamp, pending/ready/failed machine | PASS S/T | `summaries = writable<ReadonlyMap<string, SummaryEntry>>` keyed by chat address (`summaryCache.ts:64-65`); `SummaryEntry` = `{ status: 'ready'; owner; summary } \| { status: 'pending'; owner } \| { status: 'failed'; owner; failure }` (`:59-62`); every write stamps the session persona owner (`:120, 127, 134-137`); a stale-persona sweep drops previous-persona entries on the next refresh (`:93-108`); tests `summary-cache.test.ts:56-64` (address key + owner stamp), `:148` (stale persona dropped) |
| In-flight guard | PASS S/T | a `pending` entry returns early — "a fetch is running" (`:114-116`); test `summary-cache.test.ts:70` ("an in-flight (pending) fetch blocks a second request — the cadence never piles up") |
| 401 → global gate | PASS S/T | `classifySummaryFailure`: `ApiError` → `{ kind: 'api', message, gate: cause.status === 401 }` (`:72-73`); the page suppresses the sheet error for gate failures (`[address]/+page.svelte:443-456` — `!summaryEntry.failure.gate` guards both `summaryError` and `summaryErrorMessage`); tests `summary-cache.test.ts:102` (401 flags the §2.8 gate), `:170+` (the error-family mapping) |
| Fetch fires on done-observation (not at open) | PASS S/T | the page's background `$effect` fires `ensureSummary` when `done` is observed (`[address]/+page.svelte:496-506` — "fires when the chat is known finished — NOT at sheet open"); the auto-open effect only sets `summaryOpen` (never fetches, `:508-512`); `openSummary()` only sets `summaryOpen` (`:522-525`); test `transcript-page.test.ts:534-555` (hardMatch called once at page render, before any open) + `:647-655` (an ACTIVE dialog calls hardMatch zero times, button disabled) |
| One fetch per finished chat; cache hit never re-posted; failure only re-fetched via sheet retry | PASS S/T | `ensureSummary` skips `ready` (cache hit — one fetch per chat), `pending` (in-flight), and `failed` **unless** `force` (`:110-117`); `ready` is never re-posted even under force (`:114`, force only lifts the failed guard); the sheet retry passes `{ force: true }` (`[address]/+page.svelte:471-480`) and is the ONLY force caller; tests `summary-cache.test.ts:62` (ready never re-posted), `:122` (failed blocks the cadence; only forced retry re-fetches), `:141` (ready never re-posted under force), `transcript-page.test.ts:356-377` (once-only + poll tick never re-fires), `:557-570` (re-mount cache hit — no second hardMatch, no loading row) |
| The sheet reads the cache — animated pixel loading state while pending | PASS S/T | the page derives `summary`/`summaryLoading`/`summaryError` from the cached entry (`[address]/+page.svelte:433-456`, pending = no entry or `status === 'pending'`) and feeds them as props (`:676-686`); the sheet's loading row = three square pixel dots stepping under the status text (`SummarySheet.svelte:357-368`), `.dot` 6px squares on `--sheet-yellow`, `loading-pulse 1.2s steps(2, jump-none) infinite`, staggered 120/240ms (`:1211-1242`); no ring, no checklist while loading (`:324-325`); tests `summary-sheet.test.ts:313-326`, `transcript-page.test.ts:534-555` (loading while pending → content swap on landing, still exactly one fetch) |
| Loading state animated (steps(2) pixel dots), reduced-motion respected | PASS S/T | `steps(2, jump-none)` pinned from source (`transcript-page.test.ts:594-603`: the `animation: loading-pulse 1.2s steps(2, jump-none) infinite` string, transform/opacity-only keyframes, and the `@media (prefers-reduced-motion: reduce)` block covering `.loading .dot` → `animation-delay: 0ms` — `SummarySheet.svelte:1344-1357` + the base.css duration catch-all, per the comment `:1339-1343`) |
| Instant content on hit; error + retry | PASS S/T | cache hit → the sheet renders the Summary with no loading row (`transcript-page.test.ts:557-570`); failure → inline `role="alert"` error + retry button (`SummarySheet.svelte:369-379`; tests `summary-sheet.test.ts:328-339`, `transcript-page.test.ts:503+` — green in the spot-run) |
| The footer button never double-posts | PASS S/T | the button re-opens the sheet over the still-pending background fetch with NO second request (`transcript-page.test.ts:572-592`: close → `.summary-open` click → loading row visible, hardMatch still 1×, content lands at 1×); the §4.15.B.2 enabled/disabled contract stays (`:647-675`) — green in the spot-run |

---

## 3. Known findings (recorded, NOT fixed — verification-only constraint)

**Verdict: items 1–3 — 3/3 PASS, 0 FAIL.** No product defect found; no fix-up
performed. Two recorded notes (neither behavioral):

1. **Trivial (comment-only residue):** the removal of the GREAT beam leaves
   only comment prose — the doc-comment (`SummarySheet.svelte:36-37`) and the
   CSS removal comment (`:900-904`) still name the removed selectors
   (`.beam`/`.beam-stripes`, beam-march/beam-pulse) as lineage context.
   Accurate as history, no live styles behind them. Cosmetic only; left
   untouched per the constraint.
2. **Gate-record arithmetic note:** the tz8-06 session report records its
   full `make test` as "762/762", which is lower than the 819 tests reported
   by the immediately preceding tz8-05 worker — plausibly the branch's dev
   base predated the tz8-05 landing at run time. Recorded verbatim per the
   owning workers' session reports; the delta-wave CI on `dev` (§1
   placeholder) is the authoritative count.

The standing trivial notes from earlier sweeps remain open, unchanged
(`docs/verification-v34.md` §3: the ChatCard "retired marks" lineage
comments; the inert §15-era `--slide-height` slot + stale comments in the
sheet slide scope; the stale room-page duration comments; the
ShareContactSlide doc-comment's stale opening sentence).

---

## 4. Spot-run record (first-hand, this session)

```
npm run test -w @bleak/web -- tests/summary-sheet.test.ts tests/summary-cache.test.ts tests/transcript-page.test.ts tests/chats-page.test.ts
  → Test Files 4 passed (4) · Tests 131 passed (131)   (06:59:30Z, 26.11 s)
```

All four §18 evidence anchors green: the §4.15.3.1 GREAT contracts (beam
removal + name styling) in summary-sheet, the §4.15.3.2 dot-size contract in
chats-page, the §4.15.3.3 store contracts in summary-cache and the lazy
fetch + loading-state contracts in transcript-page. No full `make test` by
this sweep — the process runs the delta-wave CI on `dev` after this landing
(§1 placeholder).

---

## 5. Carried-forward manual checks (owner, real device)

The automated suites pin the logic; these need a real phone/API:

**New for v3.5:**

1. **The lazy summary flow end-to-end on a real finished chat** — on a chat
   that has JUST flipped to finished: open the sheet while summarization is
   still in progress on the server (or immediately after the flip) — the
   sheet must show the animated three-dot loading row under the status text
   (no ring, no checklist, no fake data), then SWAP to the real summary
   (tally ring, checklist, slide) when the background fetch lands, without
   closing or re-opening. Confirm the footer Summarization button pressed
   during the pending window shows the same loading state and never fires a
   second request (no double summary POST in the backend logs).
2. **The bigger finished-dot legibility on device** — on the /chats list on
   a real phone: the finished cards' color dot is now 14px (the loading
   circle's size) — check it stays readable and does not crowd the card
   layout for all five Deepa hues on the dark theme; unfinished cards still
   show the small spinner instead, never dot + spinner together.

**Carried forward (standing arcade-sheet/on-device items — full notes in
`docs/verification-v32.md` §5, `docs/verification-v33.md` §5,
`docs/verification-v34.md` §5 and earlier):** the arcade-sheet end-to-end on
a real finished chat (spring-bounce rise, cascade stagger, tally +
clockwise ring, tier animations across all three tiers — GREAT now without
the dotted line, with the centered 16px semibold names — checklist
pop-flash-draw, completion confetti + victory jumps + copy swap, re-open
replays nothing); slide v2 feel on touch AND mouse (85% snap vs
spring-back, wrapping fill, marquee seam); sheet scroll with a long summary
text (pinned top bar/stage, pinned bottom slide); slide /
Summarization-button bottom alignment on device; Summarization button
states on device; Press Start 2P RU headers on device; and the earlier
standing items — RU date/time ICU, Deepa violet legibility, radar feel
after the §13 tuning, summary-sheet freshness (no re-summarize), contacts
tab dot flow, join digit-row/full-screen forms, the on-device scanner smoke
(HTTPS secure-context gate, iOS Safari + Android Chrome decode path,
camera light off on close), PWA install, venue Wi-Fi polling,
host-console flows, return-to-event round-trip.

---

*Verification-only sweep by worker `d89a0d18` (task 87, tz8-07) — no product
code, no test files; the delta-wave CI record above is filled by the process
after the merge.*
