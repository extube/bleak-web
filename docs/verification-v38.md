# bleak-web v3.8 — Verification sweep (tz10-03, verification-only)

> **v3.10 ROUND NOTE (§23 design-review amendments — tz11-01a mascot fixes +
> the tz11-02 fold, appended by the process 2026-11-20, post-round three-gate
> run GREEN: lint clean · 805 web tests, 50 files · build 0 errors, dev
> `48e3172`):**
> (1) **Mascot de-plated** (§23.1.1, task 102): BleakMascot's backdrop fill +
> §4.8.2-style frame removed — the pixel figure sits directly on the page
> (idle blink and token fills unchanged).
> (2) **Mascot-at-top ordering** (§23.1.2–3, task 102): mascot → title →
> content on the enter-code form AND the room-form surface (found in
> `RoomPreview.svelte` — the create-profile/join choice step); the wizard
> intro verified already mascot-at-top (task 102 report, item 4).
> (3) **§23.2 wizard amendments folded** (task 101 follow-up, commit
> `7f3eeda` on dev — ratified): iOS-Messages send button + counters (no send
> on input taps), "Next" removed (fixed bottom input that rises with the
> keyboard, scrollable chat, centered back below the input), example
> placeholders per input case, nickname field with `tg:@/signal:@/inst:@`
> prefixes, **themes model** (8 themes × 6 dedicated topics, slug titles
> `theme:topic_key` mapped onto the numeric server contract), interests
> creation-only (InterestsEditor deleted from settings), multi-theme loop
> returning to the badges step until "Ready", arcade-sheet loading
> animation, fade transitions, intro bubble un-plated.
> **Incident disclosed:** the fold-in commit landed directly on dev (worker
> dev-commit — the process left the checkout on dev mid-handover window);
> content ratified (803/50 green pre-commit), branch copy tree-identical.
> Manual checks for the owner: the mascot un-plated on all surfaces, the
> mascot-at-top order, the wizard end-to-end (send button/counter/
> placeholders/prefixes/themes loop/Ready/loading animation/fades).

> **v3.9 ROUND NOTE (tz11-01 + tz11-02, lean protocol — appended by the process
> 2026-11-20, post-round three-gate run GREEN: lint clean · 858 tests total
> (49 api-client + 8 helper + 801 web, 50 files) · build 0 errors, dev
> `925e913`):** §22.3 delivered — (1) **Bleak mascot** (`BleakMascot.svelte`,
> tz11-01, task 100): reusable 12×12 chunky pixel-art ghost (token fills,
> 2-frame steps() blink idle, decorative/label props, reduced-motion via the
> base.css catch-all, §4.8.2-style backdrop-frame padding) mounted on the
> enter-invite-code form between the subtitle and the digit cells (§12 phone
> contract intact); contracts in `mascot.test.ts` (6/6). (2) **Step-by-step
> creation wizard** (`CreationWizard.svelte` + `WizardBubble.svelte` +
> the `WIZARD_STEPS` machine in `lib/join.ts`, tz11-02, task 101, P1):
> intro → name → auto-chat interview (public bio → private bio → contact
> type/value → group/items multi-select) → creating-your-profile loading
> step; chat-styled (WizardBubble rows, mascot as the interviewer), smooth
> transitions, RU/EN parity (22 `join.wizard.*` keys); `createPersona` body
> UNCHANGED (name/bios/invite_code/token — no contact/interests keys on the
> wire, machine-test-pinned); interests QUEUED during the interview and
> flushed post-2xx via one bulk `addUserInterests` (failure never undoes the
> creation); contact persisted locally post-2xx (§14.1.3); `PersonaForm`
> deleted (replaced); import/return flows untouched. Tests: 15 wizard
> machine/surface tests + updated join-machine/join-flow. Manual checks for
> the owner: the wizard end-to-end on a real invite (all steps, skip/back
> paths, the loading step), mascot placement on phone full-screen.

Worker instance `95489390` · 2026-11-20 · branch
`feature/95489390-tz10-03-verify-v38` (base = dev tip `88633c6` — the landing of
`feature/794a26e9-tz10-02-chats-common-block`; both §10 landings — tz10-01 time
sort `3a2b4ef` and tz10-02 common block `88633c6` — are in `dev` before this
sweep, see the commit map below). This sweep verifies the **Concept §19
addendum** (sheet §19.1 as CANCELLED by the owner reversal, people page
§19.2+§19.3 **including the folded §19.3 tap-form addendum**), the **folded
§15.5/§15.6 owner additions** (sheet hue restore + name-caption removal /
Great-match title / X-close per-hue ink — DESIGN §4.15.4–§4.15.6), the
**Concept §20 addendum** (single time sort, score cache retired — DESIGN
§4.15.7) and the **Concept §21 addendum** (common block + thin dividers +
dimmed content — DESIGN §4.15.8) are delivered on `dev` — **completing the
§8–§21 verification record** (§13 = `docs/verification-v3.md`, §14 = `-v31.md`,
§15 = `-v32.md`, §16 = `-v33.md`, §17 = `-v34.md`, §18 = `-v35.md`, §19 =
`-v36.md`, §20 = `-v37.md`). No product code and no test files — one-shot
source reads and targeted spot-check runs recorded here, per the
verification-only constraint of the card.

Method legend: **S** = source inspection / landed-code read in this sweep,
**T** = merged automated test (file — title), **R** = targeted spot-run
executed first-hand in this session.

Landing commits of the verified scope (dev log, all pre-sweep): tz9-01 sheet
`e9edcad`, tz9-02 people-rework `5975efa`, tz9-03 sheet-hue `d68b72d`,
good-tier-pull-refix `23a4e94`, the v3.6 sweep `e145953`, §19.3 tap-form
`dfab56d` (the §19 state — carried forward, re-verified first-hand below),
tz10-01 **time sort** `3a2b4ef` (task 97, worker `913d1694` — the §20 scope)
and tz10-02 **common block** `88633c6` (task 98, worker `794a26e9` — the §21
scope, the NEW items this sweep verifies first-hand).

Spec-source note (recorded, factual): at sweep time the §19–§21 spec text
still lives in the shared checkout's **uncommitted working-copy edits** of
`docs/Concept.md` (§13–§21) and `docs/DESIGN.md` (§4.13–§4.15.8) — the
process's pending doc landing; `dev` HEAD's Concept.md still ends at §12.
`dev` HEAD carries the full §19–§21 **product** state (every source/test file
read below is committed at `88633c6`). The sweep reads the owner amendments
from that working copy and verifies the product tree, not the docs.

---

## 1. Gate record (TZ §8.8 discipline — full gates are delta-wave-CI's job)

| Check | Result | Source |
| --- | --- | --- |
| Full `make test` re-run by this sweep | **not run** (the process runs the delta-wave CI after this landing) | this session |
| Owning worker's local gates — task 98 (tz10-02, the §21 landing) | **green**: targeted chats-page 31 · full `make test` 840 · `make lint` green · `make build` green (0 errors, 9 pre-existing warnings elsewhere) | `docs/sessions/794a26e9.md` report (landed in `88633c6`) |
| Owning worker's gates — task 97 (tz10-01, the §20 landing) | **authoritative CI green**: MR #97 `merged` `ci=green` (process wave CI on `dev`); the task-97 session report itself was left empty (status still `running` in `docs/sessions/913d1694.md`) — the landing's gates are recorded by the MR CI record | `scripts/task.py show 97` (MR #97), session file read |
| Task 98 MR record | **green**: MR #98 `merged` `ci=green` | `scripts/task.py show 98` |
| Targeted spot-runs (first-hand, this session) | **green — 199 tests / 7 web files + 49 api-client**: chats-page 29 + chats-view 25 + summary-sheet 62 + people-page 24 + people-view 18 + i18n 34 + tabbar 7 = 199/199; api-client client.test.ts 49/49 (the match/matchV2/hardMatch endpoint-mapping block) | `npm run test -w @bleak/web -- <files>`, `npm run test -w @bleak/api-client -- tests/client.test.ts` (§4) |
| Owning tasks of the verified items | tasks 88 + 90 + 91 + 93 + 95 (§19 base) + **97** (§20) + **98** (§21) all landed into `dev` (dev tip `88633c6` at sweep time; 89 + 92 superseded per the v3.6 record) | dev log / task list |

No test was added or modified by this sweep. No product code touched.

DELTA-WAVE CI: [pending — process fills]

---

## 2. Per-item checklist — Concept §19 (as amended/cancelled) + §20 + §21 (DESIGN §4.15.4–§4.15.8)

### Item 1 — SHEET STATE (§19.1 as CANCELLED + the folded §15.6 owner additions / §4.15.4.1 + §4.15.6) — PASS

All checks against `apps/web/src/lib/components/SummarySheet.svelte` +
`apps/web/tests/summary-sheet.test.ts` (landed state — unchanged since the
v3.7 sweep verified it at `dfab56d`; re-verified first-hand on dev).

| Check | Result | Evidence |
| --- | --- | --- |
| §19.1 CANCELLED: converging animation by-spec in ALL tiers — no no-pull contract remains | PASS S/T | the landed doc-comment states the reversal verbatim (SummarySheet.svelte:58-59 — "across ALL tiers per the owner reversal 2026-11-20, Concept §19.1 — the §4.15.4.1 no-pull restriction is CANCELLED"); the behavioral no-pull test is GONE (summary-sheet.test.ts:892-894 — "§4.15.4.1 GOOD no-pull test REMOVED — the owner CANCELLED the no-pull …"); the landed animations sit inside the now-free surface (GREAT `avatar-approach`/`avatar-approach-left` :846-859; GOOD nod/wave :882/:894) |
| Name captions REMOVED both tiers; `chat.summary.me` retired | PASS S/T | the `.who` rule set is gone — only the removal comment remains (SummarySheet.svelte:777); no `chat.summary.me` key in either dictionary — the removal is recorded in the i18n comments (en.ts:167, ru.ts:167) and pinned by the retired-key/`.who`-free rendered tests (`summary-sheet.test.ts:717-733` — `querySelectorAll('.who')` length 0 in both tiers; `:221` element-level) |
| GREAT-match title in the COMMON ink — RU «Отличное совпадение», near the ring | PASS S/T | the `.tier-label` sits directly under the score ring (SummarySheet.svelte:486; CSS :833-838 `color: var(--sheet-ink)`); verbatim copy pinned (`summary-sheet.test.ts:787-794` — RU «Отличное совпадение» / EN "Great match"; i18n index en/ru.ts:170/169); the special-color override removed (`:809` — `.tier-label.great` absent from the source) |
| X close per-hue ink + scrim chip visible on every hue incl. yellow | PASS S/T | `.close` reads the per-hue ink over a subtle ink chip (SummarySheet.svelte:696-713 — `color: var(--sheet-ink)`, `background: color-mix(in srgb, var(--sheet-ink) 12%, transparent)`, 48px target, press scale + ink focus ring); test `summary-sheet.test.ts:650-670` (§4.15.6.3 — `not.toContain('var(--sheet-yellow)')`, the chip + focus contracts, all five `.deepa-<n>` ink pairings; the yellow hue's dark surface ink pinned `:419-423`) |

### Item 2 — PEOPLE PAGE (§19.2 + §19.3 incl. the §19.3 TAP-FORM ADDENDUM / §4.15.4.2 + §4.15.4.3) — PASS

All checks against `apps/web/src/lib/people/view.ts`,
`apps/web/src/routes/people/+page.svelte`,
`apps/web/src/lib/components/people/PersonCard.svelte` +
`apps/web/tests/people-view.test.ts`, `tests/people-page.test.ts`
(`tests/i18n.test.ts` for the copy). The §19 state is unchanged since the
v3.7 sweep (`dfab56d` was the last people-scope landing) — re-verified
first-hand on dev.

| Check | Result | Evidence |
| --- | --- | --- |
| No filter chips; deterministic 4-bucket sort | PASS S/T | the page renders only the search pill (+ reset) — no chip row (people/+page.svelte:5 doc comment "no filter chips"; markup read); `relationshipBucket` maps the four buckets (view.ts:25 — "incoming (who added you) …" §4.15.4.2) and `sortedPeople` orders bucket-first with the roster tie-break (view.ts:49-51); tests `people-page.test.ts:269` (bucket order end-to-end) + `people-view.test.ts:92-141` (comparator contracts) |
| Right icon removed (+ direct-send «+» kept for state none) | PASS S/T | the chat-open/handshake-form toggle icon is REMOVED — the only remaining right-edge icon is the direct «+» send scoped to `none` (PersonCard.svelte, v3.6 doc comments + markup; component contract `people-page.test.ts:186`, flow `:316-351`) |
| Auto-open handshake-back for the FIRST added-you user only | PASS S/T | one-shot mount effect (`autoOpenDone` flag, +page.svelte:170-178) opens the first sorted card when incoming; never re-opened after dismissal; tests `people-page.test.ts:353-413` (auto-open / ONLY-first / not-incoming / dismiss-never-reopens) |
| 'handshake!' / «Привет!» + 'Open chat' button (badge removed) | PASS S/T | `people.action.back` = EN `handshake!` / RU «Привет!» and `people.action.open_chat` = RU «Открыть чат» / EN "Open chat" (en.ts:121-122, ru.ts:121-122 — §4.15.4.3 comments :118); the chatting badge is gone, state `chat` renders the `.open-chat` pill (PersonCard.svelte; rendered in the auto-open test `people-page.test.ts:353`) |
| NEW — tapping any added-you item opens the Handshake!/Dismiss form for THAT user | PASS S/T | the incoming row IS the tap target (`role="button"` + `aria-expanded` + `ontoggle`); the route wires `ontoggle={() => toggleIncoming(user.address)}` per card (+page.svelte:299) and `toggleIncoming` opens the form for that user only (guards: non-incoming / dismissed return early, +page.svelte:216-220); tests `people-page.test.ts:211` (component: role=button + aria-expanded + ontoggle; non-incoming inert) and the addendum suite `:428-514` (tap opens ITS form — «Привет!» + dismissal side by side; dismissal stays local-only, never re-opens) |
| NEW — single-expanded move/collapse | PASS S/T | ONE `expandedAddress` state drives the list (+page.svelte:51; the toggle is `expandedAddress === address ? null : address` :220) — opening another added-you card MOVES the form, tapping the expanded card collapses it; test `people-page.test.ts:429` (move + collapse) |

### Item 3 — TIME SORT (§20 / §4.15.7, task 97 `3a2b4ef`) — PASS

All checks against `apps/web/src/lib/chats/view.ts`,
`apps/web/src/routes/chats/+page.svelte` +
`apps/web/tests/chats-view.test.ts`, `tests/chats-page.test.ts`.

| Check | Result | Evidence |
| --- | --- | --- |
| Single time sort, newest first — supersedes the score-first ordering | PASS S/T | `stableChats` is a pure `created_at`-descending comparator with address dedupe (view.ts:43-49; doc comment :36-42 pins Concept §20 / DESIGN §4.15.7 and the supersession of §4.13.4); the route feeds the cards through it (+page.svelte:118-131); unit test `chats-view.test.ts:96-111` ("newest created_at first, deduped by address" + the done/active-scrambled single-sort test — finished chats do NOT float first) |
| Finished and unfinished sort TOGETHER by the same comparator | PASS S/T | `chats-page.test.ts:745-763` (§4.15.7 block: a 2-finished + 2-unfinished fixture orders 0xu2 → 0xf2 → 0xf1 → 0xu1 — pure created_at DESCENDING across the done/active split); in-place poll update test `:778` (a newer chat takes the top without a reload) |
| Score cache RETIRED: orderByMatchScore gone; matchScores store + fetch wiring + tests removed | PASS S | `orderByMatchScore` — zero matches in the tree; `apps/web/src/lib/stores/matchScores.ts` — file REMOVED; `apps/web/tests/match-scores.test.ts` — file REMOVED; the chats page's match/v2 fetch wiring is out (the §4.15.7 doc comment records the retirement, +page.svelte:21-25); test `chats-page.test.ts:765-776` ("no score-fetch wiring: match/v2 is never called from the list (the store is retired)" — mock asserts `matchV2` never called across poll ticks) |
| match / match-v2 / hardMatch API methods STAY (summary sheet consumes them) | PASS S/T/R | `packages/api-client/src/client.ts:463-527` — `match` (POST /api/match), `matchV2` (POST /api/match/v2), `hardMatch` (POST /api/hard-match) all present with their v3 doc comments; endpoint-mapping tests inside `packages/api-client/tests/client.test.ts` (the v3 block, incl. :560-616) — all 49 tests green in the spot-run (§4) |
| Unfinished styling / dot / preview / hue coding UNAFFECTED | PASS S/T | ChatCard keeps the §4.13.4 dimmed treatment + circle loader, the §4.15.2.2 finished-only dot (14px, Deepa hue), the §4.11.6 preview line and the §4.12.2 neutral-surface/avatar coding (ChatCard.svelte:54-77 doc comments + markup/CSS; tests `chats-page.test.ts:259-409`, `:494-642` — all green) |

### Item 4 — COMMON BLOCK + DIVIDERS + DIMMED CONTENT (§21 / §4.15.8, task 98 `88633c6`) — PASS

All checks against `apps/web/src/routes/chats/+page.svelte`,
`apps/web/src/lib/components/chats/ChatCard.svelte` +
`apps/web/tests/chats-page.test.ts:645-732` (the §4.15.8 describe).

| Check | Result | Evidence |
| --- | --- | --- |
| ONE `--color-surface` block behind the list | PASS S/T | the list container itself carries the surface: `ul.cards.common-block` with `background: var(--color-surface)` (+page.svelte:174 markup, :219-229 CSS — token only, no raw hex; `gap: 0` so the dividers carry the rhythm, plus edge padding); the per-item card is transparent (ChatCard.svelte:209-216 — "the items share ONE COMMON BACKGROUND BLOCK … the item itself is transparent"); tests `chats-page.test.ts:649-664` (the container contract + the skeleton list is NOT a common block) |
| Thin dividers in `--color-bg`, centered, ≤95% width | PASS S/T | `.divider` = `width: 95%; height: 1px; margin-inline: auto; margin-block: var(--space-2); background: var(--color-bg)` (ChatCard.svelte:191-203 — token, no raw hex); source contracts pinned by `chats-page.test.ts:666-685` (bg token, 1px, 95%, centered, aria-hidden decoration) |
| n−1 dividers for n items (rides the item markup) | PASS S/T | the route sets `divider={index > 0}` on every ChatCard after the first (+page.svelte:182) — the divider spans ABOVE its item inside the `.chat-item` (ChatCard.svelte:136-141); tests `chats-page.test.ts:670-676` (2 items → exactly 1 divider; the first item has none) and `:687-709` (the `divider` prop renders only when asked) |
| Unfinished = DIMMED CONTENT (name/preview/time reduced opacity; spinner stays; NO per-item panel); finished = full emphasis | PASS S/T | the owner amendment (Concept §21, in-progress items) is landed: `.chat-card .main.dimmed-content { opacity: 0.6 }` on the CONTENT wrapper only (ChatCard.svelte:220-229 — "NOT an opacity panel behind the item … the card itself is transparent"), the card background stays `transparent` (:212), the loader stays (outside the wrapper, :175-176); `dimmed-content` renders only when `state === 'active'` (:151) — finished items get full emphasis + the dot; tests `chats-page.test.ts:595-642` (unfinished → class + loader / finished → none; the 0.6 CSS contract; token discipline) and the page-level mixed-fixture test `:712-731` |
| Per-item styling unchanged; ≥720px grid divergence (recorded design decision) | PASS S | dot/loader/preview/hue CSS untouched (ChatCard.svelte:230-322); on the ≥720px multi-column grid the items are spatially separated by the grid gap and the divider is hidden there (ChatCard.svelte:199-203; +page.svelte:246-255) — a documented single-column rule: the §21 block/dividers apply to the phone-width chats box, the desktop grid keeps its own separation |

### Item 5 — REGRESSIONS (all prior chats/people/sheet contracts) — PASS

| Check | Result | Evidence |
| --- | --- | --- |
| All prior chats contracts green on top of the §20+§21 landings | PASS T/R | chats-page (29) + chats-view (25) suites green in the spot-runs (§4) — the §3.4/§4.11.5-7/§4.12.2/§4.13.2/§4.13.4/§4.15.2.2/§4.15.3.2 contracts (cards, previews, dot↔spinner, badge, poller, states) hold; the time sort and the common block extended, not replaced, the v3.5-era blocks |
| All prior people contracts green | PASS T/R | people-view (18) + people-page (24) suites green — search, poll diffing, dismissal rule, income state, bucket order, the tap-form addendum all hold |
| All prior sheet contracts green | PASS T/R | summary-sheet (62) green — the §15/§16/§17/§18/§19 contracts (checklist choreography, slide embed + palette, layout pins, lazy fetch, dot size, loading rework, hue restore) hold |
| Copy + tab-bar anchors green | PASS T/R | i18n (34) + tabbar (7) suites green — RU/EN parity incl. the v3.6/v3.7 key blocks (`people.action.back`/`open_chat`, `chat.summary.tier.great`) and the retired-key lists (chips, right-icon copy, `chat.summary.me`); the tab bar contract unaffected |
| api-client endpoint surface intact | PASS T/R | api-client `client.test.ts` 49/49 green — the v3 endpoint mapping (interests / match / match-v2 / hard-match / contacts) unchanged by the chats landings |

---

## 3. Known findings (recorded, NOT fixed — verification-only constraint)

**Verdict: items 1–5 — PASS, 0 FAIL.** No product defect found; no fix-up
performed. Recorded notes:

1. **Trivial (comment-only, new — stale lineage references to the retired
   matchScores store):** `apps/web/src/lib/api/client.ts:392` ("fetched from
   the matchScores session cache's refresh cadence"),
   `apps/web/src/lib/stores/summaryCache.ts:6+10` ("mirrors the matchScores
   cache pattern"),
   `apps/web/tests/summary-cache.test.ts:8-9` ("the same cache semantics as
   the matchScores store"),
   `apps/web/src/routes/chats/[address]/+page.svelte:24+423` ("like the
   lastMessage/matchScores cadence pattern") — all reference
   `stores/matchScores.ts`, which tz10-01 removed. The code is correct; only
   the prose pointers are stale. Cosmetic; left untouched per the constraint.
2. **Trivial (comment-only, new):** `apps/web/src/lib/chats/view.ts:150-151`
   still says "tz5-05 keys the list ordering off `chatStatus`" — since §20
   (`stableChats`, time sort) the list ordering no longer keys off
   `chatStatus` at all. The code is correct; the lineage prose is stale.
   Cosmetic; left untouched per the constraint.
3. **Factual note (desktop divergence, recorded design decision — not a
   defect):** the §21 common block/dividers are a single-column rule; on the
   ≥720px grid the list re-enables the grid gap and hides the dividers
   (+page.svelte:246-255, ChatCard.svelte:199-203, both documented in-code).
   Worth a device/desktop look in the carried-forward manual checks.
4. **Factual note (gate-record bookkeeping, not a product defect):** the
   task-97 (tz10-01) session file was closed with an empty report
   (`docs/sessions/913d1694.md` — status still `running`, report blank), so
   its local per-worker gate numbers are unrecorded; its authoritative green
   is the process wave CI (MR #97 `ci=green`). Also, the task-98 session
   report cites "targeted chats-page 31 passed" while the landed
   `tests/chats-page.test.ts` carries 29 tests (all green in this sweep) —
   a counting discrepancy in the prose record only.
5. **Factual note (docs landing state, not a product defect):** the §19–§21
   spec text itself (Concept §13–§21, DESIGN §4.13–§4.15.8) is at sweep time
   an uncommitted working-copy edit in the shared checkout (the process's
   pending doc landing) — `dev` HEAD's Concept.md ends at §12. The verified
   §19–§21 **product** state is fully committed at dev tip `88633c6`; the
   delta-wave CI on `dev` (§1 placeholder) is the authoritative record.

The standing trivial notes from earlier sweeps remain open, unchanged
(`docs/verification-v35.md` §3 and `docs/verification-v37.md` §3: the GREAT
beam lineage comments; the ChatCard "retired marks" lineage comments; the
inert §15-era `--slide-height` slot + stale comments in the sheet slide
scope; the stale room-page duration comments; the ShareContactSlide
doc-comment's stale opening sentence; the people-page auto-open comment's
off-by-one bucket index at `apps/web/src/routes/people/+page.svelte:166`).

---

## 4. Spot-run record (first-hand, this session)

```
npm run test -w @bleak/web -- tests/chats-page.test.ts tests/chats-view.test.ts
  → Test Files 2 passed (2) · Tests 54 passed (54)    (17:35:09Z, 30.34 s)

npm run test -w @bleak/web -- tests/summary-sheet.test.ts tests/people-page.test.ts
  tests/people-view.test.ts tests/i18n.test.ts tests/tabbar.test.ts
  → Test Files 5 passed (5) · Tests 145 passed (145)  (17:35:44Z, 14.64 s)

npm run test -w @bleak/web -- tests/chats-page.test.ts
  → Test Files 1 passed (1) · Tests 29 passed (29)    (17:36:53Z, 30.07 s)

npm run test -w @bleak/web -- tests/chats-view.test.ts
  → Test Files 1 passed (1) · Tests 25 passed (25)    (17:37:27Z, 1.45 s)

npm run test -w @bleak/api-client -- tests/client.test.ts
  → Test Files 1 passed (1) · Tests 49 passed (49)    (17:37:51Z, 0.55 s)
```

All card-anchored suites green: the §4.15.7 time-sort + no-score-wiring
contracts and the §4.15.8 common-block/divider/dimmed-content contracts in
chats-view and chats-page; the §4.15.4.1/§4.15.6 sheet contracts (no-pull
removal, caption removal, Great-match title, per-hue X close) in
summary-sheet; the §4.15.4.2/§4.15.4.3 bucket-sort, item-rework and tap-form
contracts in people-view and people-page; the copy parity in i18n; the tab
bar regression anchor; the api-client match/match-v2/hardMatch surface
(the §20 "methods stay" clause). No full `make test` by this sweep — the
process runs the delta-wave CI on `dev` after this landing (§1 placeholder).

---

## 5. Carried-forward manual checks (owner, real device)

The automated suites pin the logic; these need a real phone/API:

**New for v3.8:**

1. **The common block + dividers look on device:** on a phone-width room
   with several chats the list reads as ONE surface block with thin
   page-background-colored dividers between items (each divider centered
   and ≤95% of the box width; none before the first item). Check the block's
   edge padding feel and that the dividers read on the dark background.
2. **The dimmed-content rendering on a real unfinished chat:** an
   in-progress chat shows name/preview/time at reduced opacity (0.6) INSIDE
   the shared block — the block background itself stays untouched (no
   per-item panel) and the small circle spinner keeps spinning; a finished
   chat renders at full emphasis with its hue dot; check both side by side
   in one list.
3. **The time order with mixed finished/unfinished items:** in a room with
   both finished and in-progress chats, the list is a single newest-first
   time order — a finished chat must NOT float above a newer unfinished one;
   a newer chat created after page load takes the top on the next poll
   without a reload.
4. **The common block on desktop (≥720px):** the grid re-enables spacing and
   hides the dividers there (recorded design decision, finding 3) — confirm
   the desktop list still reads well as designed.

**Carried forward (standing arcade-sheet/on-device items — full notes in
`docs/verification-v32.md` §5 through `docs/verification-v37.md` §5 and
earlier):**
the tap-form flow end-to-end on a REAL added-you item (auto-open first card,
tap-open second, move/collapse, inert non-added-you, local dismissal);
the arcade-sheet end-to-end on a real finished chat (spring-bounce rise,
cascade stagger, tally + clockwise ring, tier animations across all three
tiers — hue-driven per chat and caption-free; the GREAT tier's converging
animations now by-spec everywhere after the owner reversal; Great-match
title in the common ink; the X close legible on every Deepa hue incl.
yellow; checklist pop-flash-draw, completion confetti + victory jumps +
copy swap, re-open replays nothing);
the per-hue sheet legibility on device (dark ink on green/yellow/orange/
cyan, light ink on violet); slide v2 feel on touch AND mouse (85% snap vs
spring-back, wrapping fill, marquee seam); sheet scroll with a long summary
text (pinned top bar/stage, pinned bottom slide); slide / Summarization-
button bottom alignment on device; Summarization button states on device;
Press Start 2P RU headers on device; the lazy summary flow end-to-end
(loading dots → content swap, no double POST); the people-page sort order
end-to-end on a real mixed room (who added you → untouched → chatting →
sent); the bigger finished-dot legibility on device; and the earlier
standing items — RU date/time ICU, Deepa violet legibility, radar feel
after the §13 tuning, summary-sheet freshness (no re-summarize), contacts
tab dot flow, join digit-row/full-screen forms, the on-device scanner smoke
(HTTPS secure-context gate, iOS Safari + Android Chrome decode path, camera
light off on close), PWA install, venue Wi-Fi polling, host-console flows,
return-to-event round-trip.

---

*Verification-only sweep by worker `95489390` (task 99, tz10-03) — no product
code, no test files; the delta-wave CI record above is filled by the process
after the merge.*
