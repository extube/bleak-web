# bleak-web v3.6 — Verification sweep (tz9-04, verification-only)

Worker instance `42bf55a5` · 2026-11-20 · branch
`feature/42bf55a5-tz9-04-verify-v36` (base = dev tip `23a4e94` — the landing of
`feature/cff2cd18-good-tier-pull-refix`; all four §19 round branches landed into
`dev` before this sweep, see the commit map below). This sweep verifies the
**Concept §19 addendum** (GOOD-tier §19.1 as CANCELLED by the owner reversal,
people-page §19.2+§19.3, sheet loading §19.4) plus the **folded §15.5/§15.6
additions** (sheet hue restore + owner additions — DESIGN §4.15.4–§4.15.6) are
delivered on `dev`. It adds **no product code and no test files** — one-shot
source reads and targeted spot-check runs recorded here, per the
verification-only constraint of the card. It completes the §13–§19 verification
record (§13 = `docs/verification-v3.md`, §14 = `-v31.md`, §15 = `-v32.md`,
§16 = `-v33.md`, §17 = `-v34.md`, §18 = `-v35.md`).

Method legend: **S** = source inspection / landed-code read in this sweep,
**T** = merged automated test (file — title), **R** = targeted spot-run
executed first-hand in this session.

Landing commits of the §19 round (dev log, all pre-sweep): tz9-01
sheet-tweaks `e9edcad` (task 88, worker `142bd964`), tz9-02 people-rework
`5975efa` (task 90, worker `5d5256a9` — task 89's card `todo` superseded by
this re-homed landing), tz9-03 sheet-hue-background `d68b72d` (task 91, worker
`cff2cd18`), good-tier-pull-refix `23a4e94` (task 93 bug round, worker
`cff2cd18` — the task-92 re-fix card stayed `todo` and is closed by 93 per the
owner reversal). In the same window, `8c1d03b` (`ignore-agents-logs`) is a
logs-housekeeping landing, not §19 scope.

---

## 1. Gate record (TZ §8.8 discipline — full gates are delta-wave-CI's job)

| Check | Result | Source |
| --- | --- | --- |
| Full `make test` re-run by this sweep | **not run** (the process runs the delta-wave CI after this landing) | this session |
| Owning workers' local gates — task 88 (tz9-01) | **green**: targeted 58/58 · full `make test` 820 green · `make lint` green · build next (followed by the §15.5/§15.6/§19 landings on top) | `docs/sessions/142bd964.md` report |
| Owning workers' local gates — task 90 (tz9-02) | **green**: targeted people-view/people-page/i18n 72 passed · `make lint` green · `make build` green (0 errors); full `make test` 766/771 with the 5 failures traced to the concurrent `cff2cd18` uncommitted sheet edits in the shared checkout (out of its constraints scope) | `docs/sessions/5d5256a9.md` report |
| Owning workers' local gates — task 91 (tz9-03) | **green**: targeted 111/111 (summary-sheet + sweep + transcript-page) · full `make test` 832 green (775 web) · `make lint` green · `make build` green | `docs/sessions/cff2cd18.md` report (tz9-03 lines) |
| Owning workers' local gates — task 93 (good-tier-pull-refix) | **green**: full `make test` green (49+8+775) · `make lint` clean · `make build` green (svelte-check 0 errors, 9 pre-existing warnings) | `docs/sessions/cff2cd18.md` report (bug-round line) |
| Targeted spot-runs (6 card-anchored suites + 2 sweep/cache suites, first-hand) | **green — 200 tests / 8 files** (summary-sheet + people-page + people-view + transcript-page + i18n + tabbar = 178/178; sweep + summary-cache = 22/22) | `npm run test -w @bleak/web -- <files>` (§4), all passing |
| Owning tasks of the §19 items | tasks 88 + 90 + 91 + 93 all landed into `dev` (dev tip `23a4e94` at sweep time; 89 + 92 superseded as described above) | dev log |

No test was added or modified by this sweep. No product code touched.

DELTA-WAVE CI: [pending — process fills]

---

## 2. Per-item checklist — Concept §19 + folded §15.5/§15.6

### Item 1 — GOOD TIER, §19.1 as CANCELLED + owner additions (§4.15.4.1 + §4.15.6) — PASS

All checks against `apps/web/src/lib/components/SummarySheet.svelte` (landed
state) + `apps/web/tests/summary-sheet.test.ts` (the §4.15.4.1/§4.15.6 blocks).

| Check | Result | Evidence |
| --- | --- | --- |
| §19.1 CANCELLED: NO no-pull restriction remains — the task-88 contract stays removed | PASS S/T | the landed doc-comment states the reversal verbatim (SummarySheet.svelte:57-61 — "converging is by-spec across ALL tiers per the owner reversal 2026-11-20, Concept §19.1 — the §4.15.4.1 no-pull restriction is CANCELLED and the landed nod/wave stays"); the behavioral no-pull test is GONE — summary-sheet.test.ts:892-896 ("§4.15.4.1 GOOD no-pull test REMOVED — the owner CANCELLED the no-pull restriction … no behavioral contract pins the GOOD tier's transform surface anymore"); repo-wide grep for no-pull/pull contracts in the GOOD tier: only the removal comment remains |
| The landed GOOD tier converges or not per the landed animation — both acceptable | PASS S | the landed GOOD-tier animation is the nod/wave, no approach transform (`.tier-good .side.me .avatar-frame` → `avatar-nod 400ms ease-in-out 400ms 2 both` :881-892; `.side.them` → `avatar-wave` :893-911) — within the now-free surface; the GREAT tier keeps its 18px pull (`avatar-approach`/`avatar-approach-left`, ±18px :845-866) |
| Name captions REMOVED — no `.who` in either tier | PASS S/T | the `.who` rule set is gone from the component — only the removal comment cites it (SummarySheet.svelte:777-779, "the name captions under the frames (.who, Inter 16px semibold) were REMOVED"); no `.who {` selector anywhere in the sheet scope (repo grep: `.who` lives only in ProfileBadge.svelte:149 and chats/[address]/+page.svelte:744 — unrelated surfaces); markup has no caption element under `.side` (:426-461 — `.mover` + frame only, the LOW sweat drop aside); tests: rendered GOOD and GREAT sheets both `.who`-free (`summary-sheet.test.ts:717-737` — `querySelectorAll('.who')` length 0 in both tiers) + the source contract `/^\.who[\s,{]/m` not matching (:630, :736) |
| `chat.summary.me` key retired | PASS S/T | no `chat.summary.me` key in either dictionary (repo grep: only the removal comments ru.ts:167 / en.ts:167-169); dropped from the i18n parity list by the task-93 landing (`git show 23a4e94` — the `'chat.summary.me'` line removed from `i18n.test.ts:349-355`); "me" avatar is decorative, the interlocutor keeps its accessible name on the avatar art (`summary-sheet.test.ts:725-728` — `aria-label` on `[role="img"]`, the me-side `[aria-hidden]`) |
| GREAT-match title in the COMMON ink — RU «Отличное совпадение», near the ring | PASS S/T | the tier label under the score ring IS the title (SummarySheet.svelte:483-486 markup — `.tier-label` directly after the `.duel` stage, "near the score ring"; CSS :833-840 — pixel face 10px, `color: var(--sheet-ink)`); the special yellow override is REMOVED (`summary-sheet.test.ts:806-811` — `.tier-label.great` not in the source, the tier block carries `--sheet-ink`); verbatim copy pinned (`summary-sheet.test.ts:793-795` — RU `«Отличное совпадение»` / EN "Great match") and the i18n parity test (`i18n.test.ts:360-361`) |
| X close per-hue visible (ink pairing incl. yellow, scrim chip, press state) | PASS S/T | `.close` reads the per-hue ink over a subtle ink chip (SummarySheet.svelte:690-715 — `color: var(--sheet-ink)`, `background: color-mix(in srgb, var(--sheet-ink) 12%, transparent)`, square `border-radius: 0`, 48px `--touch-target` target, press `scale(0.88)` over 90ms :709-711, ink focus ring :712-715); no fixed yellow left (`summary-sheet.test.ts:650-672` — the §4.15.6.3 test: `not.toContain('var(--sheet-yellow)')`, chip + focus + all five `.arcade-sheet.deepa-<n>` ink pairings asserted); the pairing includes the yellow hue's dark surface ink (`tokens.css` deepa-ink-2 = `--color-surface`, pinned by `summary-sheet.test.ts:417-424`) |

### Item 2 — PEOPLE PAGE (§19.2 + §19.3 / §4.15.4.2 + §4.15.4.3, task 90 `5975efa`) — PASS

All checks against `apps/web/src/lib/people/view.ts`,
`apps/web/src/routes/people/+page.svelte`,
`apps/web/src/lib/components/people/PersonCard.svelte` (landed state) +
`apps/web/tests/people-view.test.ts`, `tests/people-page.test.ts`,
`tests/i18n.test.ts` (the §4.15.4.2/4.15.4.3 blocks).

| Check | Result | Evidence |
| --- | --- | --- |
| No filter chips | PASS S/T | the page renders only the search pill + reset (people/+page.svelte:237-242 — no chip row in the markup, no filter state); the chip keys are retired from BOTH dictionaries (`i18n.test.ts:475-486` — `people.filter.*` + `people.filters` absent); rendered page has no chips and every card stays listed (`people-page.test.ts:418-422` — no `radio` role, 3 `.person-card`s) |
| Deterministic 4-bucket sort: incoming → none → chat → outgoing | PASS S/T | `relationshipBucket` maps incoming 0 / none 1 / chat 2 / outgoing 3 (view.ts:25-36); `sortedPeople` sorts by bucket first (view.ts:44-56); bucket-order test (`people-view.test.ts:61-66`) + the end-to-end bucket test with a newest-first roster overridden (`:92-113` — 0xin, 0xnone, 0xchat, 0xout); page order test (`people-page.test.ts:244-246` — added-you Алиса before chatting Борис); the old `people.filter` UI is replaced by the pure sort (view.ts:7-9 doc-comment) |
| Tie-break preserved (roster newest-first + address guard) | PASS S/T | within a bucket the roster `created_at`-desc tie-break holds, then the address as the final determinism key (view.ts:52-54); tests `people-view.test.ts:115-127` (tie-break + address guard), `:129-136` (deterministic regardless of input order, non-mutating), `:138-141` (a missing relationship classifies as none) |
| Right icon removed (+ direct-send kept for none) | PASS S/T | the chat-open/handshake-form toggle icon is REMOVED — the only remaining right-edge icon is the direct «+» send, scoped to state `none` (PersonCard.svelte:123-137 markup, "The only remaining right-edge icon: the direct «+» send … the chat-open / handshake-form toggle icon is REMOVED (v3.6)" :124-125; component doc comment :8-13); after a handshake-back the `.action` block is gone (`people-page.test.ts:334`); the retired right-icon copy keys are gone while `hs.back` stays for the sheet (`i18n.test.ts:488-497`); the «+» send flow + the 403 income state stay green (`people-page.test.ts:279-314`) |
| Auto-open handshake-back for the FIRST added-you user only | PASS S/T | one-shot mount effect on the page: on the FIRST data arrival the first card of the sorted list auto-expands when `incoming` and not dismissed; never re-opened after dismissal; every other card (including other bucket-0 ones) stays closed (+page.svelte:163-178 — `autoOpenDone` one-shot flag); tests `people-page.test.ts:316-338` (auto-open on mount, no click), `:340-354` (ONLY the first card; non-first incoming stays closed), `:356-360` (no auto-open when the first card is not incoming), `:362-388` (dismiss collapses, sends NOTHING to the server — ruling 2, never re-opened by polls) |
| 'handshake!' / «Привет!» copy | PASS S/T | `people.action.back` = EN `handshake!` / RU `«Привет!»` (en.ts:118-122, ru.ts:118-122), verbatim-pinned (`i18n.test.ts:469-470`) with RU/EN parity (`:464-466`); renders in the expanded panel's back button (PersonCard.svelte:142-144) — asserted in the auto-open test (`people-page.test.ts:328-329`) |
| 'Open chat' button instead of the chatting badge | PASS S/T | the `chatting` badge is gone — state `chat` renders the `.open-chat` pill button linking to `resolve('/chats/[address]', …)` (PersonCard.svelte:68-76 pill derivation skips chat, :104-114 open-chat anchor, :236-255 styles); `people.action.open_chat` = RU `«Открыть чат»` / EN `Open chat` (`i18n.test.ts:471-472`); rendered assertions (`people-page.test.ts:249-252` — `hs.chatting` absent + the button present; `:331-337` — after handshake-back the card flips to the Open-chat link, badge gone, no right icon) |

### Item 3 — SHEET LOADING (§19.4 / §4.15.4.4, tasks 88 `e9edcad` + 93 `23a4e94`) — PASS

All checks against `apps/web/src/lib/components/SummarySheet.svelte` (landed
state) + `apps/web/tests/summary-sheet.test.ts:328-354`,
`tests/transcript-page.test.ts:521-605`.

| Check | Result | Evidence |
| --- | --- | --- |
| 5 pixel dots | PASS S/T | the loading view carries FIVE square pixel dots in a stepped row (SummarySheet.svelte:402-407 markup — `dot d1…d5`; CSS `.dot` 6px squares on `--sheet-yellow`, `loading-pulse 1.2s steps(2, jump-none) infinite` :1293-1298, staggered 120/240/360/480ms :1299-1310, transform/opacity keyframes :1311-1321); test `summary-sheet.test.ts:328-338` (5 `.dot`s in `.loading-dots`, aria-hidden on the row) — owner microchange "more loading items, was three" |
| Text below, centered | PASS S/T | the dots row is the loading element's FIRST child and the status text sits BELOW it, the whole column centered (SummarySheet.svelte:1269-1282 — `.loading` = `flex-direction: column; align-items: center; gap; text-align: center`, the doc comment :1269-1272 pins the §19.4 restructure "the text no longer sits beside/above the dots"); test `summary-sheet.test.ts:339-351` (first child `.loading-dots`, last child `.loading-text`, the centered-column CSS contract) + no ring and no checklist while loading (`:352-353`) |
| Reduced-motion respected | PASS S/T | the `@media (prefers-reduced-motion: reduce)` block zeroes the loading dots' stagger delay (`.loading .dot → animation-delay: 0ms`, SummarySheet.svelte:1423-1437) on top of the base.css duration catch-all; test `transcript-page.test.ts:597-604` (the reduced-motion contract: the `steps(2, jump-none)` string, the `opacity: 0.25` keyframe floor, the `.loading .dot` delay-zeroing inside the media query) |
| End-to-end wiring (background fetch → loading → swap) unchanged | PASS S/T | the §18.3 lazy-background contracts stay green: the fetch fires on done-observation with the animated loading state while pending, swapping to the summary when it lands (`transcript-page.test.ts:537-555`), cache hit on re-open shows no loading row (`:560-571`), the footer button never double-posts (`:572-596`) — all green in the spot-run (§4) |

### Item 4 — SHEET HUE (folded §15.5 + §15.6 / §4.15.5 + §4.15.6, task 91 `d68b72d`) — PASS

All checks against `apps/web/src/lib/components/SummarySheet.svelte` (landed
state) + `apps/web/tests/summary-sheet.test.ts:382-441`, `tests/sweep.test.ts:167-213`.

| Check | Result | Evidence |
| --- | --- | --- |
| bg = the interlocutor's Deepa hue, derived per counterpart | PASS S/T | `hueClass = codeHue(user.address)` on the sheet root (`class="sheet arcade-sheet {hueClass}"` :345; derivation :210-220 — `fnv1a(address) % 5`, the same derivation ChatCard's dot uses); tests: the hue class lands on the sheet root and follows the counterpart (`summary-sheet.test.ts:382-400` — `codeHue(ALICE/BOB)` asserted) |
| The §4.10 ink pairing per hue | PASS S/T | the five `.arcade-sheet.deepa-<n>` classes map `--sheet-bg: var(--color-deepa-<n>)` + `--sheet-ink: var(--color-deepa-ink-<n>)` (SummarySheet.svelte:609-632 — dark surface ink on green/yellow/orange/cyan, light text ink on violet deepa-4); the base `.arcade-sheet` scope defines NEITHER token (`summary-sheet.test.ts:402-415`); token pairing pinned (`summary-sheet.test.ts:417-424`); text-on-hue reads the paired ink while the white structural elements stay (`:426-441` — `.sheet-label`/`.ring .score`/`.tier-label`/`.checklist h3` on `--sheet-ink`, frame border + ring stroke on `--sheet-white`) |
| Slide charcoal/yellow palette verbatim | PASS S/T | the locked slide hexes stay verbatim in the `.arcade-sheet` scope block (SummarySheet.svelte:598-608 — `--sheet-charcoal: #18181b`, `--sheet-yellow: #facc15`, `--sheet-white: #ffffff`, `--sheet-orange: #ff8a00`, `--sheet-green` reusing `--color-check-green`); test `sweep.test.ts:203-213` (the four locked declarations asserted in the scope block) |
| Sweep-test enforcement restored WITHOUT the hex exception | PASS S/T | the superseded `#8a12ff` purple is gone from the component and the whole-`.arcade-sheet`-block hex exception is DISSOLVED — the sheet is token-driven again; the sweep now sanctions ONLY the four slide-palette declarations (sweep.test.ts:168-201 — comments stripped, `withoutLockedHexes` reduces exactly the four locked lines, every other file and line obeys §2.4; `:203-207` — `#8a12ff` absent); all green in the spot-run (§4) |

### Item 5 — REGRESSIONS (task 93 diagnosis record + prior contracts) — PASS

| Check | Result | Evidence |
| --- | --- | --- |
| Task 93's diagnosis record: the landed animation wiring verified CORRECT end-to-end — the convergence was by-spec; the task-88 fix was moot and correctly removed | PASS (record confirmed) | `docs/sessions/cff2cd18.md` (task 93 report, bug-round line): "diagnosis verified the landed animation wiring CORRECT end-to-end (source, compiled CSS, compiled JS — GOOD tier has only nod/wave, GREAT keeps its 18px pull; the task-88 no-pull contract survived task 91; compiled artifacts at HEAD show no GOOD-tier convergence), so with the owner's later REVERSAL (Concept 19.1 cancelled, convergence by-spec across all tiers) NO animation changes were made — animations stay as landed"; the CI context of the bug round is saved at `docs/bugs/good-tier-pull-1.log` (the process-filed CI record); the card-88 no-pull test is confirmed removed in the landed tree (item 1, row 1) |
| All prior sheet contracts green | PASS T/R | summary-sheet (57) + summary-cache (13) + transcript-page (45) + sweep (9) suites all green in the spot-runs (§4) — the §15/§16/§17/§18 contracts (checklist choreography, slide embed, layout pins, lazy fetch, dot size) hold on top of the §19 landings |
| All prior people contracts green | PASS T/R | people-view (25) + people-page (28) suites green — the §3.3 contracts (search, poll diffing, dismissal rule, income state, empty/error states) hold; the old chips/UI contracts were replaced by the v3.6 blocks recorded in item 2 |
| i18n + tabbar anchors green | PASS T/R | i18n (68) + tabbar (9) suites green — the RU/EN parity incl. the v3.6 key block and the retired-key lists (chips, right-icon copy, `chat.summary.me`) holds; the tab bar contract unaffected |

---

## 3. Known findings (recorded, NOT fixed — verification-only constraint)

**Verdict: items 1–4 — PASS, 0 FAIL; task 93's diagnosis record confirmed.**
No product defect found; no fix-up performed. Two recorded notes (both
comment-only):

1. **Trivial (comment-only):** `apps/web/src/routes/people/+page.svelte:164`
   describes the auto-open target as "(who added you — bucket 1)", while the
   bucket numbering in `lib/people/view.ts` assigns incoming **0** ("none" is
   bucket 1). The code is correct; only the prose index is off by one.
   Cosmetic; left untouched per the constraint.
2. **Trivial (report-arithmetic note):** task 90's full `make test` records
   766/771 with the 5 failures attributed to the concurrent `cff2cd18` uncommitted
   sheet edits in the shared checkout (its own report, `docs/sessions/5d5256a9.md`);
   the subsequent task 91 + 93 full runs (832 green / full green) cover the same
   suites on the landed tree — the delta-wave CI on `dev` (§1 placeholder) is the
   authoritative count.

The standing trivial notes from earlier sweeps remain open, unchanged
(`docs/verification-v35.md` §3: the GREAT beam lineage comments; the ChatCard
"retired marks" lineage comments; the inert §15-era `--slide-height` slot +
stale comments in the sheet slide scope; the stale room-page duration comments;
the ShareContactSlide doc-comment's stale opening sentence).

---

## 4. Spot-run record (first-hand, this session)

```
npm run test -w @bleak/web -- tests/summary-sheet.test.ts tests/people-page.test.ts tests/people-view.test.ts tests/transcript-page.test.ts tests/i18n.test.ts tests/tabbar.test.ts
  → Test Files 6 passed (6) · Tests 178 passed (178)   (08:52:34Z, 14.25 s)

npm run test -w @bleak/web -- tests/sweep.test.ts tests/summary-cache.test.ts
  → Test Files 2 passed (2) · Tests 22 passed (22)     (08:52:54Z, 1.59 s)
```

All eight evidence anchors green: the §4.15.4.1/§4.15.6 sheet contracts (no-pull
removal, caption removal, Great-match title, per-hue X close) + the §4.15.4.4
loading contracts + the §4.15.5 hue contracts in summary-sheet and sweep; the
§4.15.4.2/4.15.4.3 bucket-sort and item-rework contracts in people-view and
people-page; the lazy-fetch wiring in transcript-page and summary-cache; the
copy parity in i18n; the tab bar regression anchor. No full `make test` by this
sweep — the process runs the delta-wave CI on `dev` after this landing (§1
placeholder).

---

## 5. Carried-forward manual checks (owner, real device)

The automated suites pin the logic; these need a real phone/API:

**New for v3.6:**

1. **The sheet on a real GOOD-tier chat (50–79):** open the summary sheet on a
   finished GOOD-tier chat — avatars sit spaced with the nod/wave playing once,
   NO name captions under the frames (avatars alone); then on a GREAT-tier
   (≥ 80) chat the avatars pull 18px to center + hop loops (by-spec after the
   reversal), the title under the ring reads «Отличное совпадение» / "Great
   match" in the sheet's common text ink (no special color); the X close stays
   visible on EVERY Deepa hue — including the yellow hue, where the former
   fixed-yellow glyph would have vanished (per-hue ink + scrim chip + press).
2. **The people page end-to-end:** on a room with mixed relationships — the
   list is NOT filtered, just sorted: who added you first, then untouched, then
   chatting, then sent-handshake; the first added-you card's «Привет!» /
   handshake! panel is ALREADY open on page entry (no click), other incoming
   cards stay closed; «Привет!» sends the reverse handshake and the card
   becomes the «Открыть чат» / "Open chat" button; Dismiss collapses locally
   (nothing sent to the server) and the panel never re-opens by itself.

**Carried forward (standing arcade-sheet/on-device items — full notes in
`docs/verification-v32.md` §5, `docs/verification-v33.md` §5,
`docs/verification-v34.md` §5, `docs/verification-v35.md` §5 and earlier):**
the arcade-sheet end-to-end on a real finished chat (spring-bounce rise,
cascade stagger, tally + clockwise ring, tier animations across all three
tiers — now hue-driven per chat and caption-free; checklist pop-flash-draw,
completion confetti + victory jumps + copy swap, re-open replays nothing); the
per-hue sheet legibility on device (text ink pairing on all five Deepa hues,
dark ink on green/yellow/orange/cyan, light ink on violet); slide v2 feel on
touch AND mouse (85% snap vs spring-back, wrapping fill, marquee seam); sheet
scroll with a long summary text (pinned top bar/stage, pinned bottom slide);
slide / Summarization-button bottom alignment on device; Summarization button
states on device; Press Start 2P RU headers on device; the lazy summary flow
end-to-end (loading dots → content swap, no double POST); the bigger
finished-dot legibility on device; and the earlier standing items — RU date/time
ICU, Deepa violet legibility, radar feel after the §13 tuning, summary-sheet
freshness (no re-summarize), contacts tab dot flow, join digit-row/full-screen
forms, the on-device scanner smoke (HTTPS secure-context gate, iOS Safari +
Android Chrome decode path, camera light off on close), PWA install, venue
Wi-Fi polling, host-console flows, return-to-event round-trip.

---

*Verification-only sweep by worker `42bf55a5` (task 94, tz9-04) — no product
code, no test files; the delta-wave CI record above is filled by the process
after the merge.*
