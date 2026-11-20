# bleak-web v3.7 — Verification sweep (tz9-06, verification-only)

Worker instance `41df9ff6` · 2026-11-20 · branch
`feature/41df9ff6-tz9-06-verify-v37` (base = dev tip `dfab56d` — the landing of
`feature/edace188-tz9-05-added-you-tap-form`; the §19 round and the v3.6 sweep
were all landed into `dev` before this sweep, see the commit map below). This
sweep verifies the **Concept §19 addendum** (GOOD tier §19.1 as CANCELLED by
the owner reversal, people-page §19.2+§19.3 **including the folded §19.3
tap-form addendum**, sheet loading §19.4) plus the **folded §15.5/§15.6
additions** (sheet hue restore + owner additions — DESIGN §4.15.4–§4.15.6)
are delivered on `dev`. It adds **no product code and no test files** —
one-shot source reads and targeted spot-check runs recorded here, per the
verification-only constraint of the card. It completes the §8–§19
verification record (§13 = `docs/verification-v3.md`, §14 = `-v31.md`,
§15 = `-v32.md`, §16 = `-v33.md`, §17 = `-v34.md`, §18 = `-v35.md`,
§19 = `-v36.md`).

Method legend: **S** = source inspection / landed-code read in this sweep,
**T** = merged automated test (file — title), **R** = targeted spot-run
executed first-hand in this session.

Landing commits of the verified scope (dev log, all pre-sweep): tz9-01
sheet-tweaks `e9edcad` (task 88, worker `142bd964`), tz9-02 people-rework
`5975efa` (task 90, worker `5d5256a9`), tz9-03 sheet-hue-background `d68b72d`
(task 91, worker `cff2cd18`), good-tier-pull-refix `23a4e94` (task 93 bug
round, worker `cff2cd18`), the v3.6 sweep itself `e145953` (task 94, worker
`42bf55a5`), and the §19.3 tap-form addendum `dfab56d` (task 95, worker
`edace188` — the NEW item this sweep re-verifies first-hand). In an earlier
window, `8c1d03b` (`ignore-agents-logs`) is a logs-housekeeping landing, not
§19 scope.

Spec-source note (recorded, factual): at sweep time the §19 spec text lives
in the shared checkout's **uncommitted working-copy edits** of
`docs/Concept.md` (§13–§20) and `docs/DESIGN.md` (§4.13–§4.15.7) — the
process's pending doc landing; `dev` HEAD carries the full §19 **product**
state (every source/test file read below is committed at `dfab56d`). The
sweep reads the owner amendments from that working copy and verifies the
product tree, not the docs.

---

## 1. Gate record (TZ §8.8 discipline — full gates are delta-wave-CI's job)

| Check | Result | Source |
| --- | --- | --- |
| Full `make test` re-run by this sweep | **not run** (the process runs the delta-wave CI after this landing) | this session |
| Owning workers' local gates — task 95 (tz9-05, the NEW tap-form landing) | **green**: people-page 24/24 · full `make test` 836 green · `make lint` clean · `make build` 0 errors | `docs/sessions/edace188.md` report |
| Owning workers' local gates — tasks 88 + 90 + 91 + 93 (the §19 base landings) | **green** — carried forward unchanged from the v3.6 sweep record (task 88: targeted 58/58 + full 820; task 90: lint/build green with the 5 concurrent-checkout failures traced; task 91: targeted 111/111 + full 832; task 93: full green) | `docs/verification-v36.md` §1 (citing `docs/sessions/{142bd964,5d5256a9,cff2cd18}.md`) |
| Targeted spot-runs (6 card-anchored suites + 2 sweep/cache suites, first-hand) | **green — 204 tests / 8 files** (summary-sheet 62 + people-page 24 + people-view 18 + transcript-page 37 + i18n 34 + tabbar 7 = 182/182; sweep 12 + summary-cache 10 = 22/22) | `npm run test -w @bleak/web -- <files>` (§4), all passing |
| Owning tasks of the verified items | tasks 88 + 90 + 91 + 93 + 95 all landed into `dev` (dev tip `dfab56d` at sweep time; 89 + 92 superseded per the v3.6 record) | dev log |

No test was added or modified by this sweep. No product code touched.

DELTA-WAVE CI: [pending — process fills]

---

## 2. Per-item checklist — Concept §19 + folded §15.5/§15.6 (incl. the §19.3 tap-form addendum)

### Item 1 — GOOD TIER, §19.1 as CANCELLED + owner additions (§4.15.4.1 + §4.15.6) — PASS

All checks against `apps/web/src/lib/components/SummarySheet.svelte` (landed
state) + `apps/web/tests/summary-sheet.test.ts` (the §4.15.4.1/§4.15.6 blocks).

| Check | Result | Evidence |
| --- | --- | --- |
| §19.1 CANCELLED: NO no-pull restriction remains — the task-88 contract stays removed | PASS S/T | the landed doc-comment states the reversal verbatim (SummarySheet.svelte:57-61 — "converging is by-spec across ALL tiers per the owner reversal 2026-11-20, Concept §19.1 — the §4.15.4.1 no-pull restriction is CANCELLED and the landed nod/wave stays"); the behavioral no-pull test is GONE — summary-sheet.test.ts:892-896 ("§4.15.4.1 GOOD no-pull test REMOVED — the owner CANCELLED the no-pull restriction … no behavioral contract pins the GOOD tier's transform surface anymore") |
| The landed GOOD tier converges or not per the landed animation — both acceptable | PASS S | the landed GOOD-tier animation is the nod/wave, no approach transform (`.tier-good .side.me .avatar-frame` → `avatar-nod 400ms ease-in-out 400ms 2 both` SummarySheet.svelte:882; `.side.them` → `avatar-wave` :894) — within the now-free surface; the GREAT tier keeps its 18px pull (`avatar-approach`/`avatar-approach-left`, :846-866) |
| Name captions REMOVED — no `.who` in either tier | PASS S/T | the `.who` rule set is gone from the component — only the removal comment cites it (SummarySheet.svelte:777-779, "The name captions under the frames (.who, Inter 16px semibold) were REMOVED"); no `.who {` selector in the sheet scope (source contract `not.toMatch(/^\.who[\s,{]/m)` — summary-sheet.test.ts:630, :736); rendered GOOD and GREAT sheets both `.who`-free (`summary-sheet.test.ts:717-737` — `querySelectorAll('.who')` length 0 in both tiers; element-level `:228`) |
| `chat.summary.me` key retired | PASS S/T | no `chat.summary.me` key in either dictionary; the i18n retired-key block stays (i18n.test.ts:149ff, `people.filter.*` retired block co-located); "me" avatar is decorative, the interlocutor keeps its accessible name on the avatar art (the §4.15.6.1 names-REMOVED test asserts the aria-label placement, summary-sheet.test.ts:717-737) |
| GREAT-match title in the COMMON ink — RU «Отличное совпадение», near the ring | PASS S/T | the tier label under the score ring IS the title (SummarySheet.svelte:486 markup — `.tier-label` directly after the `.duel` stage; CSS :833-840 — pixel face 10px, `color: var(--sheet-ink)`, doc comment :830-832 "carries the sheet's COMMON text ink — the special yellow override is REMOVED"); verbatim copy pinned (`summary-sheet.test.ts:798-803` — RU «Отличное совпадение» / EN "Great match"; i18n.test.ts:360) and the override removal asserted (`:809-810` — `.tier-label.great` absent from the source) |
| X close per-hue visible (ink pairing incl. yellow, scrim chip, press state) | PASS S/T | `.close` reads the per-hue ink over a subtle ink chip (SummarySheet.svelte:696-715 — `color: var(--sheet-ink)`, `background: color-mix(in srgb, var(--sheet-ink) 12%, transparent)`, square `border-radius: 0`, 48px `--touch-target` target, press scale-down over 90ms, ink focus ring); no fixed yellow left (`summary-sheet.test.ts:650-672` — the §4.15.6.3 test: `not.toContain('var(--sheet-yellow)')`, chip + focus + all five `.arcade-sheet.deepa-<n>` ink pairings asserted); the pairing includes the yellow hue's dark surface ink (`tokens.css` deepa-ink-2 = `--color-surface`, pinned by `summary-sheet.test.ts:417-424`) |

### Item 2 — PEOPLE PAGE (§19.2 + §19.3 + the §19.3 TAP-FORM ADDENDUM / §4.15.4.2 + §4.15.4.3, tasks 90 `5975efa` + 95 `dfab56d`) — PASS

All checks against `apps/web/src/lib/people/view.ts`,
`apps/web/src/routes/people/+page.svelte`,
`apps/web/src/lib/components/people/PersonCard.svelte` (landed state) +
`apps/web/tests/people-view.test.ts`, `tests/people-page.test.ts`,
`tests/i18n.test.ts` (the §4.15.4.2/4.15.4.3 blocks incl. the addendum
describe).

| Check | Result | Evidence |
| --- | --- | --- |
| No filter chips | PASS S/T | the page renders only the search pill (+ reset on empty search) (people/+page.svelte:254-259, :277-281 — no chip row in the markup, no filter state); the chip keys are retired from BOTH dictionaries (`i18n.test.ts:477-486` — `people.filter.*` + `people.filters` absent); rendered page has no chips and every card stays listed (`people-page.test.ts:544-549` — "no filter chips render and every card stays listed (the list is just sorted)") |
| Deterministic 4-bucket sort: incoming → none → chat → outgoing | PASS S/T | `relationshipBucket` maps incoming 0 / none 1 / chat 2 / outgoing 3 (view.ts:25-36); `sortedPeople` sorts by bucket first (view.ts:44-56); bucket-order test (`people-view.test.ts:61-66`) + the end-to-end bucket test (`:92-113` — who added you, then untouched, then chatting, then you-sent); page order test (`people-page.test.ts:269-292` — one card per attendee in bucket order) |
| Tie-break preserved (roster newest-first + address guard) | PASS S/T | within a bucket the roster `created_at`-desc tie-break holds, then the address as the final determinism key (view.ts:52-54); tests `people-view.test.ts:115-127` (tie-break + address guard), `:129-136` (deterministic regardless of input order, non-mutating), `:138-141` (a missing relationship classifies as none) |
| Right icon removed (+ direct-send kept for none) | PASS S/T | the chat-open/handshake-form toggle icon is REMOVED — the only remaining right-edge icon is the direct «+» send, scoped to state `none` (PersonCard.svelte:141-155 markup, "The only remaining right-edge icon: the direct «+» send … The chat-open / handshake-form toggle icon is REMOVED (v3.6)" :142-143; component doc comment :8-13); the retired right-icon copy keys are gone while `hs.back` stays for the sheet (the i18n retired-key block, i18n.test.ts:477-486ff); the «+» send flow + the 403 income state stay green (`people-page.test.ts:186-209` component contract, `:316-351` page flow) |
| Auto-open handshake-back for the FIRST added-you user only (PRESERVED under the addendum) | PASS S/T | one-shot mount effect on the page: on the FIRST data arrival the first card of the sorted list auto-expands when `incoming` and not dismissed; never re-opened after dismissal; every other card (including other bucket-0 ones) stays closed (+page.svelte:165-180 — `autoOpenDone` one-shot flag); tests `people-page.test.ts:353-375` (auto-open on mount, no click), `:377-391` (ONLY the first card; non-first incoming stays closed), `:393-397` (no auto-open when the first card is not incoming), `:399-413` (dismiss collapses, sends NOTHING to the server — ruling 2, never re-opened by polls); the tap-form landing did NOT regress it (the addendum suite's first assertions re-check auto-open, `:438-441`) |
| 'handshake!' / «Привет!» copy | PASS S/T | `people.action.back` = EN `handshake!` / RU `Привет!` (en.ts:121, ru.ts:121), verbatim-pinned (`i18n.test.ts:469-470`) with RU/EN parity for both v3.6 keys (`:463-466`); renders in the expanded panel's back button (PersonCard.svelte:179-181) — asserted in the auto-open test (`people-page.test.ts:368-371`) and the tap-move test (`:451-453`) |
| 'Open chat' button instead of the chatting badge | PASS S/T | the `chatting` badge is gone — state `chat` renders the `.open-chat` pill button linking to `resolve('/chats/[address]', …)` (PersonCard.svelte:77-85 pill derivation skips chat, :122-132 open-chat anchor, :286-305 styles); `people.action.open_chat` = RU «Открыть чат» / EN `Open chat` (i18n.test.ts:471-472); rendered assertions (`people-page.test.ts:353-375` — after handshake-back the card flips to the Open-chat link; `:469-489` — the non-added-you suite asserts the link + the `hs.sent` pill unchanged) |
| NEW — tapping/clicking ANY added-you item opens the Handshake!/Dismiss form for that user | PASS S/T | an incoming ("added you") row IS the tap target: `role="button"` `tabindex=0` `aria-expanded={expanded}` with `onclick={() => ontoggle?.()}` (PersonCard.svelte:157-170 — the removed right icon's toggle role moved to the card tap, doc comment :15-19); the route wires `ontoggle={() => toggleIncoming(user.address)}` per card (+page.svelte:299) and `toggleIncoming` opens the form for THAT user only (+page.svelte:208-221 — guards: non-incoming returns, dismissed returns); tests `people-page.test.ts:211-244` (component: role=button + aria-expanded + ontoggle fires), `:429-467` (page: tapping a non-first added-you card opens ITS form, `.expanded-actions` with the «Привет!»/«Закрыть» buttons — handshake-back send + local dismissal side by side, PersonCard.svelte:177-187) |
| NEW — tap MOVES the single-expanded form; tapping the expanded card collapses it | PASS S/T | ONE `expandedAddress` state drives the whole list (+page.svelte:51, :292 `expanded={!dismissed && expandedAddress === user.address}`); the toggle is `expandedAddress === address ? null : address` (+page.svelte:220) — opening another added-you card MOVES the form to it, tapping the expanded card collapses it; test `people-page.test.ts:429-467` (tap Борис → form moves from Алиса to Борис; tap again → collapsed; Enter on Алиса re-opens — keyboard parity on the page, PersonCard.svelte:102-109 `onRowKeydown`) |
| NEW — non-added-you taps are inert | PASS S/T | non-incoming rows render a plain `.row` div — no role, no tabindex, no handler (PersonCard.svelte:171-175, "non-incoming rows stay inert (no tap behavior added)"); test `people-page.test.ts:469-489` (zero `.row[role="button"]`, clicking every row opens NO form, Open-chat link + sent pill unchanged); component-level `:231-243` (untouched card: `untouchedToggle` never called) |
| NEW — dismissal stays local-only; a dismissed card never re-opens by tap either | PASS S/T | `toggleIncoming` returns early on a dismissed relationship (+page.svelte:219 — "never re-open (ruling 2)") on top of the `expanded={!dismissed && …}` render guard (+page.svelte:292) and the collapse effect (:151-163); dismissal records the address → incomingAt locally, no server call (+page.svelte:202-206); test `people-page.test.ts:491-514` (tap-open a second card → dismiss → `createHandshake` NOT called, panel gone → tapping it again does NOT re-open) |

### Item 3 — SHEET LOADING (§19.4 / §4.15.4.4, tasks 88 `e9edcad` + 93 `23a4e94`) — PASS

All checks against `apps/web/src/lib/components/SummarySheet.svelte` (landed
state) + `apps/web/tests/summary-sheet.test.ts:328-354`,
`tests/transcript-page.test.ts:521-605`.

| Check | Result | Evidence |
| --- | --- | --- |
| 5 pixel dots | PASS S/T | the loading view carries FIVE square pixel dots in a stepped row (SummarySheet.svelte:403-406 markup — `dot d1…d5`; CSS `.dot` 6px squares on `--sheet-yellow`, `loading-pulse 1.2s steps(2, jump-none) infinite` :1293-1298, staggered 120/240/360/480ms :1299-1310, transform/opacity keyframes :1311-1321); test `summary-sheet.test.ts:328-338` (5 `.dot`s in `.loading-dots`, aria-hidden on the row) — owner microchange "more loading items, was three" |
| Text below, centered | PASS S/T | the dots row is the loading element's FIRST child and the status text sits BELOW it, the whole column centered (SummarySheet.svelte:1269-1282 — `.loading` = `flex-direction: column; align-items: center; gap; text-align: center`, the doc comment :1269-1272 pins the §19.4 restructure "the text no longer sits beside/above the dots"); test `summary-sheet.test.ts:339-351` (first child `.loading-dots`, last child `.loading-text`, the centered-column CSS contract) + no ring and no checklist while loading (`:352-353`) |
| Reduced-motion respected | PASS S/T | the `@media (prefers-reduced-motion: reduce)` block zeroes the loading dots' stagger delay (`.loading .dot → animation-delay: 0ms`, SummarySheet.svelte:1423-1437) on top of the base.css duration catch-all; test `transcript-page.test.ts:597-604` (the reduced-motion contract: the `steps(2, jump-none)` string, the `opacity: 0.25` keyframe floor, the `.loading .dot` delay-zeroing inside the media query) |
| End-to-end wiring (background fetch → loading → swap) unchanged | PASS S/T | the §18.3 lazy-background contracts stay green: the fetch fires on done-observation with the animated loading state while pending, swapping to the summary when it lands (`transcript-page.test.ts:521-605` block, all green in the spot-run §4), cache hit on re-open shows no loading row (`summary-cache.test.ts`, 10/10 green), the footer button never double-posts — all green in the spot-run (§4) |

### Item 4 — SHEET HUE (folded §15.5 + §15.6 / §4.15.5 + §4.15.6, task 91 `d68b72d`) — PASS

All checks against `apps/web/src/lib/components/SummarySheet.svelte` (landed
state) + `apps/web/tests/summary-sheet.test.ts:382-441`,
`tests/sweep.test.ts:167-213`.

| Check | Result | Evidence |
| --- | --- | --- |
| bg = the interlocutor's Deepa hue, derived per counterpart | PASS S/T | `hueClass = codeHue(user.address)` on the sheet root (`class="sheet arcade-sheet {hueClass}"` SummarySheet.svelte:345; derivation :213-220 — `fnv1a(address) % 5`, the same derivation ChatCard's dot uses); tests: the hue class lands on the sheet root and follows the counterpart (`summary-sheet.test.ts:382-400` — `codeHue(ALICE/BOB)` asserted) |
| The §4.10 ink pairing per hue | PASS S/T | the five `.arcade-sheet.deepa-<n>` classes map `--sheet-bg: var(--color-deepa-<n>)` + `--sheet-ink: var(--color-deepa-ink-<n>)` (SummarySheet.svelte:610-632 — dark surface ink on green/yellow/orange/cyan, light text ink on violet deepa-4); the base `.arcade-sheet` scope defines NEITHER token (`summary-sheet.test.ts:402-415`); token pairing pinned (`summary-sheet.test.ts:417-424`); text-on-hue reads the paired ink while the white structural elements stay (`:426-441` — `.sheet-label`/`.ring .score`/`.tier-label`/`.checklist h3` on `--sheet-ink`, frame border + ring stroke on `--sheet-white`) |
| Slide charcoal/yellow palette verbatim | PASS S/T | the locked slide hexes stay verbatim in the `.arcade-sheet` scope block (SummarySheet.svelte:598-608 — `--sheet-charcoal: #18181b` :599, `--sheet-yellow: #facc15` :600, plus `--sheet-white`/`--sheet-orange` and `--sheet-green` reusing `--color-check-green`); test `sweep.test.ts:178-213` (the locked declarations asserted in the scope block) |
| Sweep-test enforcement restored WITHOUT the hex exception | PASS S/T | the superseded `#8a12ff` purple is gone from the component (only the prose comment at SummarySheet.svelte:588 mentions its REMOVAL) and the whole-`.arcade-sheet`-block hex exception is DISSOLVED — the sheet is token-driven again; the sweep now sanctions ONLY the slide-palette declarations (sweep.test.ts:167-213 — comments stripped, `withoutLockedHexes` reduces exactly the locked lines, every other file and line obeys §2.4; `:203-207` — `#8a12ff` absent); all green in the spot-run (§4) |

### Item 5 — REGRESSIONS (all prior sheet/people contracts on top of the tap-form landing) — PASS

| Check | Result | Evidence |
| --- | --- | --- |
| All prior sheet contracts green | PASS T/R | summary-sheet (62) + summary-cache (10) + transcript-page (37) + sweep (12) suites all green in the spot-runs (§4) — the §15/§16/§17/§18 contracts (checklist choreography, slide embed, layout pins, lazy fetch, dot size) hold on top of the §19 landings + the tap-form addendum |
| All prior people contracts green | PASS T/R | people-view (18) + people-page (24) suites green — the §3.3 contracts (search, poll diffing, dismissal rule, income state, empty/error states) hold; the tap-form landing extended (not replaced) the v3.6 blocks recorded in item 2 |
| i18n + tabbar anchors green | PASS T/R | i18n (34) + tabbar (7) suites green — the RU/EN parity incl. the v3.6 key block (`people.action.back`/`open_chat`, i18n.test.ts:463-472) and the retired-key lists (chips, right-icon copy, `chat.summary.me`) holds; the tab bar contract unaffected |
| Task 93's diagnosis record stands (the convergence was by-spec; the task-88 fix moot and correctly removed) | PASS (record confirmed) | `docs/sessions/cff2cd18.md` (task 93 report, bug-round line) + `docs/bugs/good-tier-pull-1.log` (the process-filed CI record); the card-88 no-pull test is confirmed removed in the landed tree (item 1, row 1) |

---

## 3. Known findings (recorded, NOT fixed — verification-only constraint)

**Verdict: items 1–5 — PASS, 0 FAIL.** No product defect found; no fix-up
performed. Recorded notes:

1. **Trivial (comment-only, carried forward from v3.6 — still open,
   unchanged):** `apps/web/src/routes/people/+page.svelte:166` describes the
   auto-open target as "(who added you — bucket 1)", while the bucket
   numbering in `lib/people/view.ts` assigns incoming **0** ("none" is
   bucket 1). The code is correct; only the prose index is off by one. The
   tap-form landing (`dfab56d`) left the comment untouched. Cosmetic; left
   untouched per the constraint.
2. **Factual note (docs landing state, not a product defect):** the §19 spec
   text itself (Concept §13–§20, DESIGN §4.13–§4.15.7) is at sweep time an
   uncommitted working-copy edit in the shared checkout (the process's
   pending doc landing) — `dev` HEAD's Concept.md ends at §12. The verified
   §19 **product** state is fully committed at dev tip `dfab56d`; the
   delta-wave CI on `dev` (§1 placeholder) is the authoritative record.

The standing trivial notes from earlier sweeps remain open, unchanged
(`docs/verification-v35.md` §3: the GREAT beam lineage comments; the ChatCard
"retired marks" lineage comments; the inert §15-era `--slide-height` slot +
stale comments in the sheet slide scope; the stale room-page duration
comments; the ShareContactSlide doc-comment's stale opening sentence).

---

## 4. Spot-run record (first-hand, this session)

```
npm run test -w @bleak/web -- tests/summary-sheet.test.ts tests/people-page.test.ts
  tests/people-view.test.ts tests/transcript-page.test.ts tests/i18n.test.ts
  tests/tabbar.test.ts
  → Test Files 6 passed (6) · Tests 182 passed (182)   (17:09:42Z, 14.90 s)

npm run test -w @bleak/web -- tests/sweep.test.ts tests/summary-cache.test.ts
  → Test Files 2 passed (2) · Tests 22 passed (22)     (17:10:02Z, 1.23 s)
```

Per-suite counts (individual cached re-runs, 17:10:39Z–17:11:58Z, all
passing): summary-sheet 62 · people-page 24 · people-view 18 ·
transcript-page 37 · i18n 34 · tabbar 7 · sweep 12 · summary-cache 10.

All eight evidence anchors green: the §4.15.4.1/§4.15.6 sheet contracts
(no-pull removal, caption removal, Great-match title, per-hue X close) + the
§4.15.4.4 loading contracts + the §4.15.5 hue contracts in summary-sheet and
sweep; the §4.15.4.2/4.15.4.3 bucket-sort and item-rework contracts in
people-view and people-page — now including the §4.15.4.3 ADDENDUM tap
contracts (role=button rows, single-expanded move/collapse, inert
non-added-you rows, dismissal never re-opens) landed by `dfab56d`; the
lazy-fetch wiring in transcript-page and summary-cache; the copy parity in
i18n; the tab bar regression anchor. No full `make test` by this sweep — the
process runs the delta-wave CI on `dev` after this landing (§1 placeholder).

---

## 5. Carried-forward manual checks (owner, real device)

The automated suites pin the logic; these need a real phone/API:

**New for v3.7:**

1. **The tap-form flow end-to-end on a REAL added-you item:** on a room with
   ≥ 2 people who added you — the first added-you card's «Привет!» /
   handshake! panel is already open on page entry; TAPPING a second
   added-you card opens ITS Handshake!/Dismiss form (the open form MOVES —
   only one expanded at a time); tapping the expanded card again collapses
   it; tapping a NON-added-you card (untouched / sent / chatting) does
   nothing; «Привет!» sends the reverse handshake and the card becomes the
   «Открыть чат» / "Open chat" button; Dismiss collapses locally (nothing
   sent to the server) and the dismissed card never re-opens by tap or poll.
   Check the touch feel of the tappable row (cursor/active dim is
   desktop-only; on touch the whole row should respond like a button) and
   the `aria-expanded` announcement with a screen reader.

**Carried forward (standing arcade-sheet/on-device items — full notes in
`docs/verification-v32.md` §5, `docs/verification-v33.md` §5,
`docs/verification-v34.md` §5, `docs/verification-v35.md` §5,
`docs/verification-v36.md` §5 and earlier):**
the arcade-sheet end-to-end on a real finished chat (spring-bounce rise,
cascade stagger, tally + clockwise ring, tier animations across all three
tiers — now hue-driven per chat and caption-free; checklist pop-flash-draw,
completion confetti + victory jumps + copy swap, re-open replays nothing);
the per-hue sheet legibility on device (text ink pairing on all five Deepa
hues, dark ink on green/yellow/orange/cyan, light ink on violet); slide v2
feel on touch AND mouse (85% snap vs spring-back, wrapping fill, marquee
seam); sheet scroll with a long summary text (pinned top bar/stage, pinned
bottom slide); slide / Summarization-button bottom alignment on device;
Summarization button states on device; Press Start 2P RU headers on device;
the lazy summary flow end-to-end (loading dots → content swap, no double
POST); the people-page sort order end-to-end on a real mixed room (who added
you → untouched → chatting → sent); the bigger finished-dot legibility on
device; and the earlier standing items — RU date/time ICU, Deepa violet
legibility, radar feel after the §13 tuning, summary-sheet freshness (no
re-summarize), contacts tab dot flow, join digit-row/full-screen forms, the
on-device scanner smoke (HTTPS secure-context gate, iOS Safari + Android
Chrome decode path, camera light off on close), PWA install, venue Wi-Fi
polling, host-console flows, return-to-event round-trip.

---

*Verification-only sweep by worker `41df9ff6` (task 96, tz9-06) — no product
code, no test files; the delta-wave CI record above is filled by the process
after the merge.*
