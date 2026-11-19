# bleak-web v3.3 — Verification sweep (tz7-08, verification-only)

Worker instance `890a2131` · 2026-11-19 · branch
`feature/890a2131-tz7-08-verify-v33` (base = dev tip `4902fea` — the landing of
`feature/63eff466-tz7-07-sheet-layout-fixes`; both §16 fix rounds landed into
`dev` before this sweep, see the commit map below). This sweep verifies the
**Concept §16 addendum** (v3.3 slide geometry + sheet layout fixes, DESIGN
§4.15.1) is delivered on `dev`. It adds **no product code and no test files** —
one-shot source reads and targeted spot-check runs recorded here, per the
verification-only constraint of the card. It completes the §13–§16
verification record (§13 = `docs/verification-v3.md`, §14 = `-v31.md`, §15 =
`-v32.md`).

Method legend: **S** = source inspection / landed-code read in this sweep,
**T** = merged automated test (file — title), **R** = targeted spot-run
executed first-hand in this session.

Landing commits of the §16 round (dev log, both pre-sweep): tz7-06
slide-geometry-fixes `9dacc79` (task 78, worker `fd8bc1d4`), tz7-07
sheet-layout-fixes `4902fea` (task 79, worker `63eff466`).

---

## 1. Gate record (TZ §8.8 discipline — full gates are delta-wave-CI's job)

| Check | Result | Source |
| --- | --- | --- |
| Full `make test` re-run by this sweep | **not run** (the process runs the delta-wave CI after this landing) | this session |
| Owning workers' local gates — task 78 (tz7-06) | **green**: test 803 passed · lint clean · build 0 errors | `docs/sessions/fd8bc1d4.md` report |
| Owning workers' local gates — task 79 (tz7-07) | **green**: all gates green (test/lint/build) | `docs/sessions/63eff466.md` report |
| Targeted spot-runs (6 card-anchored suites, first-hand) | **green — 174 tests / 6 files** (kit + summary-sheet + transcript-page + i18n + sweep + tabbar) | `npm run test -w @bleak/web -- <files>` (§4), all passing |
| Owning tasks of the §16 items | tasks 78 + 79 both landed into `dev` (dev tip `4902fea` at sweep time) | dev log |

No test was added or modified by this sweep. No product code touched.

DELTA-WAVE CI: GREEN — 2026-11-19T21:08Z, dev 36ee987, lint clean / 807 tests / build 0 errors

---

## 2. Per-item checklist — Concept §16

### Item 1 — SLIDE GEOMETRY (§16.1 / §4.15.1.1, task 78 `9dacc79`) — PASS

All checks against `apps/web/src/lib/components/ShareContactSlide.svelte`
(landed state) + `apps/web/tests/kit.test.ts` + the tokens
(`tokens.css:112-126`: `--radius-pill: 999px`, `--space-2: 8px`,
`--space-4: 16px`, `--space-5: 24px`).

| Check | Result | Evidence |
| --- | --- | --- |
| Sheet-variant track = the sheet's content column (aligned with the checklist/summary edges) | PASS S/T | `.variant-sheet .track` `:356-360` — `width: 100%` of the component's slot; the sheet embeds the slide inside its own `--space-5` padding box (`SummarySheet.svelte:522` `padding: var(--space-5) …`), the same column the summary text (`.description`) and checklist scroll in — the edges coincide exactly; test `kit.test.ts:348` (`.variant-sheet .track … width: 100%`); the §16.2 test block asserts the scroll region holds ONLY description + checklist (`summary-sheet.test.ts:996-1004`) — i.e. one content column |
| 64px height (literal, the §15 clamp superseded) | PASS S/T | `:358` `--slide-height: 64px` declared ON `.track` — the component's own declaration beats the sheet's inherited `--slide-height: clamp(64px, …, 80px)` slot on `.slide` (`SummarySheet.svelte:1145`), so the track is a literal 64px at every viewport; tests `kit.test.ts:349` (`\.variant-sheet \.track … --slide-height:\s*64px`), `:351` (border-w token 2px on the sheet scope) |
| Full pill radius (9999px-class) | PASS S/T | `.track` `:336` `border-radius: var(--radius-pill)` (= 999px, clamps to the half height); test `kit.test.ts:344` |
| Candy fill WRAPS the circle — full-height pill, concentric cap, uniform 4px ring, no flat edge | PASS S/T | `.candy` `:412-425` — absolute `top:0; bottom:0; left:0` (full padding-box height, flush to the track's left edge), `border-radius: var(--radius-pill)` `:421` + `overflow: hidden` `:417` (the rounded end IS the cap — no flat vertical edge); width binding `:257` `calc(var(--slide-height) − 2 × var(--slide-border-w) + {dx}px)` = thumb's padding-box diameter + the two 4px rings + dx. Geometry (64px sheet track): candy height 60px, cap radius 30 centered at x = (60+dx) − 30 = 30+dx; thumb 52px at left 4px → center x = 30+dx — **the cap center coincides with the thumb center at every dx**; ring = 30 − 26 = **4px uniform**. Tests `kit.test.ts:200-229` (rest `+0px` → `+110px` drag → spring back — the cap travels WITH the thumb), `:383-409` (the wrapping-pill CSS contract: full radius on the fill, overflow-clipped, width bound to dx) |
| Placeholder strictly centered (both axes, full track width) | PASS S/T | `.track` `:341-345` `display: flex; align-items: center` (candy/thumb absolute — the hint is the only in-flow child), `.hint` `:361-372` `flex: 1; text-align: center`; tests `kit.test.ts:427-429` |
| Z-order fill > text > thumb | PASS S/T | all three positioned, DOM order = paint order: `<span class="hint">` `:243` < `<span class="candy">` `:252-260` < `<button class="thumb">` `:262-284`; test `kit.test.ts:442-456` (`compareDocumentPosition` pins hint-before-candy, candy-before-thumb) |
| Fade completing BY center | PASS S/T | `:120` `hintFade = min(progress × 2, 1)` → fully gone at progress 0.5 (midpoint); inline binding `:243`; tests `kit.test.ts:278-294` (opacity 1 → 0.5 at a quarter range → 0 at the midpoint → 1 on spring-back), `:411-422` (CSS contract: `Math.min(progress * 2, 1)` + the 2.4s transform-only shimmer) |
| Completed state nests the thumb with 4px uniform margin (old clipping bug fixed) | PASS S/T | `.shared .thumb` `:501-509` — `right: var(--slide-pad)` (= 4px, inside the border), instant swap (`transition: none`); drag range `:155-159` `maxDx = track(clientWidth) − thumb − 8` → the thumb's right edge lands at the mirrored 4px padding edge — **no overflow, no clipping** (thumb 52px + 2×4px = the 60px padding box exactly); tests `kit.test.ts:436-439` (right: pad, transition none, the `Math.max(track - thumb - 8, 0)` invariant), `:189-198` (the shared terminal state) |
| Rest of the slide machine unchanged (85% snap / spring, activation exempt, touch+mouse, confetti gating, variant API) | PASS S/T | release rule `:199-209` (≥85% → complete), activation `:219-225` (exempt), one pointer path `:176-192` + `touch-action: none` `:476`; confetti `:132-143,286-300` gesture-gated; variant scope `:230-231`; tests `kit.test.ts:242-261, 263-276, 296-306, 334-337` — all green in the spot-run |

### Item 2 — SHEET LAYOUT (§16.2 / §4.15.1.2, task 79 `4902fea`) — PASS

All checks against `apps/web/src/lib/components/SummarySheet.svelte` (landed
state) + `apps/web/src/routes/chats/[address]/+page.svelte` +
`apps/web/tests/summary-sheet.test.ts:966-1048` (the §16.2 describe block, 5
tests).

| Check | Result | Evidence |
| --- | --- | --- |
| 88–90% screen height; `top = max(10dvh, 56px + 8px)` — top edge just below the chat header at every viewport | PASS S/T | `.sheet` `:507` `top: max(10dvh, calc(56px + var(--space-2)))` — the formula VERBATIM (56px = the transcript `.top-bar` height, `+page.svelte:678`; +8px gap). Height = 100dvh − top → **exactly 90dvh** on viewports ≥640px tall (10dvh ≥ 64px), **88–90%** from ~533px tall up; below that the 64px header-clearance floor wins so the header stays visible at EVERY viewport (the test records this trade-off, `summary-sheet.test.ts:982-985`); bottom-anchored `:500` `bottom: 0`. Tests `summary-sheet.test.ts:971-986` (bottom: 0, the max() expression with the header height read from the page source, 10dvh cap) |
| Pinned top: header/X, avatars + names + tier label + ring — flex-shrink 0, never scroll | PASS S/T | `.top-bar` `:587-593` + `.stage` `:629-635` both `flex-shrink: 0`, both OUTSIDE `.sheet-scroll` (markup `:345-350, :370-431` vs `:437-461`); the avatars (`:371-409`), names, ring (`:381-397`) and tier label (`:430`) all live in `.stage`; tests `summary-sheet.test.ts:994-995, 1002-1003, 1013-1015` |
| Scrollable middle: `.sheet-scroll` holds ONLY summary text + checklist | PASS S/T | `.sheet-scroll` `:642-651` — `flex: 1 1 auto; min-height: 0` (takes exactly the leftover fixed-height space), `overflow-y: auto; scroll-behavior: smooth; overscroll-behavior: contain` (no chaining to the transcript behind the scrim); markup `:437-461` — exactly `.description` + `.checklist` inside; tests `summary-sheet.test.ts:996-1012` (scroll holds both, stage/bar/share/ring all null inside it, the flex/min-height/overflow/smooth source contract) |
| Pinned bottom slide: flex-shrink 0, always visible; stale tab-bar reservation removed | PASS S/T | `.share` `:1132-1137` `flex-shrink: 0`, the sheet's LAST flex child (`:466-477`), outside the scroll region; the stale `--bottom-tabbar-height` reservation is GONE — one-shot grep over `SummarySheet.svelte`: only a comment mentions it (`:520`), no padding references it; the transcript page hides the tab bar itself (`+page.svelte:484-493` `nav.tabbar { display: none !important }`); tests `summary-sheet.test.ts:1018-1027` (`.share` is a direct dialog child, absent from `.sheet-scroll`, flex-shrink: 0), `:1045-1046` (the sheet padding declaration contains no tabbar reference) |
| Slide bottom edge aligned verbatim with the chat footer button's bottom offset (space-4 + safe-area inset) | PASS S/T | sheet `:522` `padding: var(--space-5) var(--space-5) calc(var(--space-4) + env(safe-area-inset-bottom, 0px))` — the transcript `.footer`'s padding-bottom (`+page.svelte:875`) VERBATIM (same expression, `calc(var(--space-4) + env(safe-area-inset-bottom, 0px))`), so the pinned slide's bottom edge sits at the SAME offset from the screen bottom as the Summarization button behind the sheet (the sheet is bottom-anchored, the footer is the page's last flex child); test `summary-sheet.test.ts:1029-1047` (extracts the footer's expression from the page source and asserts the sheet mirrors it verbatim) |

### Item 3 — §15 REGRESSIONS (spot-check: the pinned tiers/ring survive the restructure) — PASS

Full landed-code read of both components in this sweep (the §16 restructure
touched only layout/geometry; every §15 surface is intact, current line
numbers):

| Check | Result | Evidence |
| --- | --- | --- |
| Locked palette (owner hexes, `.arcade-sheet` scope) | PASS S/T | `SummarySheet.svelte:536-548` — `--sheet-bg: #8a12ff`, `--sheet-charcoal: #18181b`, `--sheet-yellow: #facc15`, `--sheet-white: #ffffff`, `--sheet-orange: #ff8a00`, `--sheet-green: var(--color-check-green)`, `--sheet-ink`, `--sheet-font-pixel`; the scope class is still on the sheet root (`:303`); test `summary-sheet.test.ts:434-446` (locked hexes verbatim) + `sweep.test.ts` (the scoped exception, non-vacuous) — green in the spot-run |
| Entrance arcade-rise + 50ms cascade | PASS S/T | `:526` `animation: arcade-rise 460ms cubic-bezier(0.22, 1, 0.36, 1)` on `.sheet`, keyframes `:552-565` (100% → −12px at 62% → +4px at 82% → 0); cascade `:570-583` `calc(120ms + i×50ms)`, sections carry `--cascade-i` 0–4 (`:345, :370, :439, :442, :466`); tests `summary-sheet.test.ts:468-505` |
| Typography (Press Start 2P + Handjet, Inter body) | PASS S/T | `:547` the pixel stack (EN+RU); Fontsource subsets in `routes/+layout.svelte` (unchanged); body copy Inter (`.who` `:688-691`, `.description` `:1024-1030` 14px/1.45); test `summary-sheet.test.ts:507-539` |
| Score ring + tally (survives the pinned-top restructure) | PASS S/T | ring SVG `:381-397` + CSS `:704-744` (160×160, stroke 12, butt caps, `rotate(-90deg)`, `ring-fill` 900ms); tally rAF `:234-257` (700ms, integer steps, lands exactly on ceil); tests `summary-sheet.test.ts:115-200` (math) + the rendering tests |
| Tier animations (GREAT/GOOD/LOW, pinned top) | PASS S/T | GREAT approach + hops `:762-795`, marching beam `:885-925`, 6 star/heart poppers `:960-995`; GOOD nod/wave `:798-828`, dotted glow line `:929-956` (static blur filter); LOW sweat drop `:832-866` + blink `:867-881`; reduced-motion delay zeroing `:1356-1369`; tests `summary-sheet.test.ts:648-780` — green in the spot-run |
| Checklist pop-flash-draw choreography | PASS S/T | `:1085-1125` — `box-pop` 150ms steps(2) at `400ms + i×140ms`, retro flash +150ms, check-in +280ms; square boxes + green check via `--sheet-green` `:1058-1074`; test `summary-sheet.test.ts:783-811` |
| Completion (confetti + victory jumps, gesture-gated) | PASS S/T | `completedHere` gating `:141,193,222-262,270-273`; 24 square flakes `:212-220,1199-1249`; victory jumps `:999-1021`; a re-mount replays nothing (close disarms `:259-262`); tests `summary-sheet.test.ts:383-396` |
| Sheet-variant slide dressing (3-color stripes, 50.912px loop, arrow pulse, pixel hint) | PASS S/T | overrides `:1138-1162`, stripes `:1167-1184` (−50.912px marquee, 0.9s), arrow pulse `:1187-1198`; tests `summary-sheet.test.ts:813-856` |
| §4.15.B placement/button contracts unchanged | PASS S/T | one-shot greps: zero `ShareContactSlide` matches in the transcript footer (`footer .slide` null — `transcript-page.test.ts:416,532,541`); the once-per-pair re-open (`:421-437`); disabled/enabled button states (`:544-570`) — all green in the spot-run |
| i18n parity (no new keys in §16 — the existing set holds) | PASS T | `i18n.test.ts` global key-set parity + the §4.15.E block — green in the spot-run |

---

## 3. Known findings (recorded, NOT fixed — verification-only constraint)

**Verdict: items 1–3 — 3/3 PASS, 0 FAIL.** No product defect found; no fix-up
performed. Two recorded notes (neither is a behavioral defect):

1. **Width-band nuance (Item 1, row 1 — spec math, not behavior):** the
   criterion's "88–92% of the modal width" holds only for modal widths
   ≈400–600px. The delivered track is the content column
   (`modal − 2 × --space-5` = modal − 48px, fixed insets), so the share is
   viewport-dependent: 83.3% at a 320px viewport (modal 288px), 85.4% at 360px,
   86.6% at 390px, 87.9% at 430px, 89.3% at 480px, 91.5% at 600px, 92.5% at the
   640px desktop cap. The parenthetical's PRIMARY requirement — horizontal
   alignment with the checklist and summary text edges — is met EXACTLY (one
   content column), and the 64px height / pill radius / wrapping geometry are
   all literal. The band deviation stems from the fixed 24px insets scaling
   against narrow phone modals; recorded here for the owner, untouched per the
   constraint.
2. **Trivial (token/comment-only §15 leftover in the sheet scope):** the
   sheet's `.share :global(.slide)` override still carries the §15-era
   `--slide-height: clamp(64px, …, 80px)` slot (`SummarySheet.svelte:1145`)
   with its pre-v3.3 comment (`:1139-1144`, "the slide caps at 288px wide" —
   no longer true for the sheet variant). It is INERT for the track height:
   the component's own `.variant-sheet .track { --slide-height: 64px }`
   declaration wins on the track element (own declaration beats inheritance),
   which is what the geometry tests pin (`kit.test.ts:349`). The §15-era
   source-text assertion of that override block (`summary-sheet.test.ts:823-828`)
   stays green for the same reason. Cosmetic only; left untouched per the
   constraint.
3. The standing trivial notes from earlier sweeps remain open, unchanged: the
   stale comment-only duration references in `routes/room/+page.svelte`
   (`docs/verification-v3.md` §3) and the ShareContactSlide doc-comment's
   stale opening sentence "Rendered in the dialog footer (routes/chats/[address])"
   (`ShareContactSlide.svelte:6-7`; recorded in `docs/verification-v32.md` §3 —
   the footer instance is gone, the sentence is cosmetic-only).

---

## 4. Spot-run record (first-hand, this session)

```
npm run test -w @bleak/web -- tests/kit.test.ts tests/summary-sheet.test.ts
  tests/transcript-page.test.ts
  → Test Files 3 passed (3) · Tests 124 passed (124)   (21:04:01Z, 11.65 s)
npm run test -w @bleak/web -- tests/i18n.test.ts tests/sweep.test.ts
  tests/tabbar.test.ts
  → Test Files 3 passed (3) · Tests 50 passed (50)     (21:04:16Z, 0.79 s)
```

All 6 card-anchored suites: **174 tests green, 0 failures**. The run covers
both §16 fix rounds' evidence anchors (the wrapping-geometry/fade/nesting
contracts in kit, the §16.2 layout describe block in summary-sheet, the
unchanged §4.15.B placement contracts in transcript-page) plus the i18n
parity, the sweep exception and the tab-bar anchors. No full `make test` by
this sweep — the process runs the delta-wave CI on `dev` after this landing
(§1 placeholder).

---

## 5. Carried-forward manual checks (owner, real device)

The automated suites pin the logic; these need a real phone/API:

**New for v3.3:**

1. **Slide wrapping fill during drag on touch AND mouse** — grip the sheet
   slide's yellow thumb and drag slowly on a touchscreen, then with a mouse:
   the striped fill wraps the circle the whole way (a uniform 4px ring around
   the thumb at EVERY dx — the rounded cap travels concentrically with the
   thumb, no flat vertical edge ever appears), the stripes keep scrolling
   seamlessly under the cap, the fill covers/clips the hint text as it expands
   and the hint is fully gone by the time the thumb passes mid-track; release
   below 85% springs the whole wrapping fill back with the thumb.
2. **Sheet scroll with a LONG summary text** — open the sheet on a chat whose
   summary paragraph is long: ONLY the summary text + the NETWORKING CHECKLIST
   scroll (smoothly, however long); the MEETING SUMMARY bar + X, the avatars,
   names, tier label and score ring stay pinned and never move; the slide
   stays pinned at the bottom and never disappears; scrolling to the end does
   not chain-scroll the transcript behind the scrim.
3. **Slide / Summarization-button alignment on device** — with the sheet open
   over a finished chat, the slide's bottom edge sits at the SAME vertical
   level from the screen bottom as the Summarization button in the chat view
   behind the scrim (both at the `--space-4` + safe-area-inset offset); check
   on a device with a home-indicator safe area that both shift together.

**Carried forward (standing arcade-sheet/on-device items — full notes in
`docs/verification-v32.md` §5 and earlier):** the arcade-sheet end-to-end on a
real finished chat (spring-bounce rise, cascade stagger, tally + clockwise
ring, tier animations across all three tiers, checklist pop-flash-draw,
completion confetti + victory jumps + copy swap, re-open replays nothing);
slide v2 feel on touch AND mouse (85% snap vs spring-back, marquee seam);
Summarization button states on device; Press Start 2P RU headers on device;
and the earlier standing items — RU date/time ICU, Deepa violet legibility,
radar feel after the §13 tuning, summary-sheet freshness (no re-summarize),
contacts tab dot flow, join digit-row/full-screen forms, the on-device scanner
smoke (HTTPS secure-context gate, iOS Safari + Android Chrome decode path,
camera light off on close), PWA install, venue Wi-Fi polling, host-console
flows, return-to-event round-trip.

---

*Verification-only sweep by worker `890a2131` (task 80, tz7-08) — no product
code, no test files; the delta-wave CI record above is filled by the process
after the merge.*
