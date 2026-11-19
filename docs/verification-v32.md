# bleak-web v3.2 — Verification sweep (tz7-05, verification-only)

Worker instance `efd2f934` · 2026-11-19 · branch
`feature/efd2f934-tz7-05-verify-v32` (base = dev tip `c94219e` — the landing of
`feature/f95c407f-tz7-04-share-placement-cutover`; all four §15 items landed
into `dev` before this sweep, see the commit map below). This sweep verifies
the **Concept §15 addendum** (v3.2 arcade sheet redesign + ShareContactSlide
v2, DESIGN §4.15) is delivered on `dev`. It adds **no product code and no test
files** — one-shot source greps, landed-code reads and targeted spot-check
runs recorded here, per the verification-only constraint of the card. It
completes the §13–§15 verification record (the §13 record is
`docs/verification-v3.md`, §14 is `docs/verification-v31.md`).

Method legend: **S** = source inspection / one-shot grep in this sweep,
**T** = merged automated test (file — title), **R** = targeted spot-run
executed first-hand in this session.

Landing commits of the §15 round (dev log, all pre-sweep): tz7-01
slide-v2-rebuild `9b79dda` (task 73), tz7-02 arcade-sheet-core `31a99cb`
(task 74), tz7-03 arcade-centerpiece `62eba81` (task 75), tz7-04
share-placement-cutover `c94219e` (task 76).

---

## 1. Gate record (TZ §8.8 discipline — full gates are delta-wave-CI's job)

| Check | Result | Source |
| --- | --- | --- |
| Full `make test` re-run by this sweep | **not run** (the process runs the delta-wave CI after this landing) | this session |
| DELTA-WAVE CI | **GREEN** (2026-11-19T20:42Z, process, dev tip `158f77c` post-sweep-landing): `make lint` clean · `make test` 801 passed (49 api-client + 8 helper + 744 web, 48 files) · `make build` 0 svelte-check errors (9 pre-existing warnings) | process gate run; recorded via `task.py ci` |
| Targeted spot-runs (6 card-anchored suites, first-hand) | **green — 168 tests / 6 files** (kit + summary-sheet + transcript-page + i18n + sweep + tabbar) | `npm run test -w @bleak/web -- <files>` (§4), all passing |
| Owning tasks of the §15 items | tz7-01…tz7-04 all landed into `dev` (dev tip `c94219e` at sweep time) | dev log |

No test was added or modified by this sweep. No product code touched.

---

## 2. Per-item checklist — Concept §15 (A–E)

### Item A — ShareContactSlide v2 (tz7-01 `9b79dda`, DESIGN §4.15.A) — PASS

| Check | Result | Evidence |
| --- | --- | --- |
| 76px glass pill, ~3.8:1, full radius | PASS S/T | `ShareContactSlide.svelte:275` `--slide-height: 76px`; `:296` `width: min(100%, 288px)` (288/76 ≈ 3.79:1); `:301` `border-radius: var(--radius-pill)`; test `kit.test.ts:327-345` ("the glass pill — 76px track at min(100%, 288px)…") |
| backdrop-blur glassmorphism | PASS S/T | `:277` `color-mix(in srgb, var(--color-bg) 45%, transparent)` + `:304-305` `backdrop-filter: blur(12px)` with the `-webkit-` prefixed twin; both pinned by `kit.test.ts:333-335` |
| Shimmering hint fading on drag | PASS S/T | sheen: `.armed .hint::after` `:320-342` (2.4s transform-only sweep); fade: `:227` inline `opacity = 1 − progress` (`progress = dx/maxDx`, `:95-99`); tests `kit.test.ts:269-282` (opacity 1 → 0.5 at halfway → 1 after spring-back), `:382-391` (CSS contract: inline fade + 2.4s shimmer) |
| 68px white thumb + 4px padding + green phone glyph | PASS S/T | `:276` `--slide-pad: 4px`, `:394-395` thumb `calc(var(--slide-height) - 8px)` = 68px; `:279` `--slide-thumb: var(--color-text)` (white), `:280` `--slide-thumb-ink: var(--color-check-green)`; glyph `:247-249` `<PixelIcon name="phone" size={16}>`; tests `kit.test.ts:347-358` (invariant), `:311-320` (phone = in-grid 16×16 rect data) |
| 12px-stripe 45° candy trail filling to the thumb's near edge | PASS S/T | clip layer `:217-226` `style:width="{4 + dx}px"` (= the thumb's near edge), armed only `:213-226` (disabled/pending/shared stay plain — test `kit.test.ts:222-231`); stripes `:374-378` `repeating-linear-gradient(45deg, A 0 12px, B 12px 24px)` full opacity; behavior test `kit.test.ts:199-220` (rest 4px → 114px at dx=110 → back to 4px) |
| Seamless 33.941px marquee loop | PASS S/T | `:381-388` `@keyframes candy-move { translateX(0) → translateX(-33.941px) }` (24px period ÷ sin45°), 1.1s linear infinite `:379`, transform-only; test `kit.test.ts:360-380` (pins the exact gradient + the −33.941px shift, forbids `background-position`/filter animation) |
| 85% snap vs 240ms spring-back (keyboard exempt) | PASS S/T | release rule `:173-183` — `dx >= 0.85 * max` → complete, below → spring; transitions `:417` / `:365` (thumb + trail) 240ms `cubic-bezier(0.34, 1.56, 0.64, 1)`, snap 160ms ease-out; keyboard/click completes directly `:193-199` (NOT subject to 85%); tests `kit.test.ts:233-252` (below/above), `:254-267` (mid-gesture end), `:156-168` (activation exempt at dx=0), `:393-406` (transition contract) |
| `variant` prop, internal-token API | PASS S/T | `:57` `variant?: 'base' \| 'sheet'` (default base `:69`), scope classes `:204-205`; colors ONLY through the internal `--slide-*` tokens `:270-285`; the sheet scope overrides them from outside `SummarySheet.svelte:1077-1095` (no color props on the slide API); tests `kit.test.ts:284-294` (scope classes), `summary-sheet.test.ts:813-820` (embedded slide renders `variant-sheet`, not `variant-base`) |
| Touch AND mouse drag | PASS S | one `pointerdown/move/up/cancel` path with `setPointerCapture` `:237-240,150-158` + `touch-action: none` `:405` (§4.15.A "confirmed, keep as is") |
| Base confetti unchanged (12 flakes, gesture-gated) | PASS S/T | `:111-122,252-266` — `celebrated` set in `complete()` (`:143`), render gate `celebrated && shared`; test `kit.test.ts:322-325` (an already-shared mount replays nothing); 201/409 matrix re-asserted in `transcript-page.test.ts` (unchanged from v3.1) |

### Item B — Placement & chat-page cutover (tz7-04 `c94219e`, DESIGN §4.15.B) — PASS

| Check | Result | Evidence |
| --- | --- | --- |
| Footer slide instance REMOVED | PASS S/T | one-shot grep over `routes/chats/[address]/+page.svelte`: zero `ShareContactSlide` matches; the supersession is recorded in-code (`:361-371` — "the dialog-footer slide instance is REMOVED (§4.15.B.1)"); the only slide instance is inside the sheet (`:626-627` comment "the ONLY slide instance since the §4.15.B.1 footer cutover", `<SummarySheet>` embed `:628-642`); test `transcript-page.test.ts:416` (`footer .slide` is null after closing the sheet) |
| Sheet slide fully functional; re-open over a held Summary without a second hard-match | PASS S/T | `openSummary()` `:477-481` — `summaryOpen = true` and `requestSummary()` ONLY when `summary === null` (the once-per-pair rule holds); test `transcript-page.test.ts:421-437` ("re-opens the sheet over a held Summary WITHOUT re-issuing the hard-match" — `hardMatch` stays at 1 call) |
| Summarization button in the footer slot; finished → enabled opens the sheet | PASS S/T | `:605-621` — `<button class="summary-open" disabled={!done} onclick={openSummary}>` with `chat.summary.open` when done; `done` comes from the authoritative `isChatDone` (`:387`); tests `transcript-page.test.ts:555-567` (enabled + opens), `:745` |
| Unfinished → disabled with "Dialog in progress" / «Диалог ещё идёт» | PASS S/T | `disabled={!done}` + the `chat.summary.open.disabled` key `:617-619`; test `transcript-page.test.ts:544-551` (button disabled, text contains `ru['chat.summary.open.disabled']` = «Диалог ещё идёт»); active-dialog interactive-elements sweep `:752-767` |
| Auto-open trigger preserved | PASS S | the tz5-06 once-per-open effect stays as landed: `:462-467` (`done` while open → `summaryOpen = true` + `requestSummary()`, `summaryRequested` resets per chat address `:451-460`); the button is the documented ON-DEMAND path BESIDE it (`:469-476`) |
| ContactStub stays retired | PASS S | one-shot grep over `apps/web/src`: zero `ContactStub` matches (the v3 retirement holds; no re-introduction in the round) |

### Item C — Arcade sheet (tz7-02 `31a99cb` + tz7-03 `62eba81`, DESIGN §4.15.C) — PASS

| Check | Result | Evidence |
| --- | --- | --- |
| `.arcade-sheet` scope with the owner-locked hexes (#8A12FF bg superseding the Deepa-hue background) | PASS S/T | `SummarySheet.svelte:501-513` — `--sheet-bg: #8a12ff`, `--sheet-charcoal: #18181b`, `--sheet-yellow: #facc15`, `--sheet-white: #ffffff`, `--sheet-orange: #ff8a00`, `--sheet-green: var(--color-check-green)` (no new hex), `--sheet-ink: var(--sheet-white)`; the Deepa-hue background supersession recorded in-code `:494-500`; the sheet root carries the class (`:289`) and NO `deepa-N` hue class remains (test `transcript-page.test.ts:399-402`); tests `summary-sheet.test.ts:433-449` (locked hexes verbatim in the scope block) |
| 24px top corners, dark scrim | PASS S/T | `:486` `border-radius: var(--radius-lg) var(--radius-lg) 0 0` (= 24px, `tokens.css:112`); scrim `:462-468` `var(--color-scrim)` |
| Arcade-rise spring + 50ms cascade | PASS S/T | `:491` `animation: arcade-rise 460ms cubic-bezier(0.22, 1, 0.36, 1)`, keyframes `:517-530` (100% → −12px at 62% → +4px at 82% → 0); cascade `:535-548` `calc(120ms + i×50ms)` fade-and-slide-up 240ms; tests `summary-sheet.test.ts:468-486` (rise), `:488-505` (cascade stagger + per-section indices) |
| Press Start 2P pixel headers (Cyrillic subsets bundled; Handjet safety net) + Inter body | PASS S/T | `:512` `--sheet-font-pixel: 'Press Start 2P', 'Handjet Variable', 'Handjet', monospace` (EN AND RU — one face); Fontsource import `routes/+layout.svelte:10-12` — `press-start-2p/latin.css` + `cyrillic.css` + `cyrillic-ext.css`; Handjet already imported (`:2`); body copy stays Inter (`--font-body`, e.g. `.who :629-639`, `.description` default); test `summary-sheet.test.ts:507-539` (the pixel stack string + label/score/tier blocks) |
| Pixel top bar (MEETING SUMMARY + scale-down X) | PASS S/T | `:331-336` — the i18n'd `chat.summary.title` uppercase in the pixel face 10px white `:558-565`; X close: 48px target `:568-571`, `scale(0.88)` press over 90ms `:578-582`, yellow glyph `:577`, yellow focus ring `:583-586`; test `summary-sheet.test.ts:541-...` ("the pixel X close with scale(0.88) press and a 48px target") |
| Dual 56×56 square pixel-framed avatars (me/counterpart via Summary.user_a/b) | PASS S/T | `.avatar-frame` `:612-623` — 56×56, `border: 2px solid var(--sheet-white)`, `border-radius: 0`, `image-rendering: pixelated`; "me" derived from the Summary's server truth `:157-160` (`summary.user_a === user.address ? user_b : user_a`), counterpart `:388`; PixelAvatar art inside (no new sprites); names in Inter 12px semibold `:629-639` |
| White ring clockwise fill + rAF tally landing on ceil(score) | PASS S/T | ring SVG `:367-383` (r=66, stroke 12, butt caps, crispEdges); fill clockwise from 12 o'clock: `.arc` `:661-668` `rotate(-90deg)` + `ring-fill` 900ms ease-out `:669-676` (dashoffset c → c×(1−score/100), geometry `lib/chats/summary.ts:53-61`); tally rAF `:220-243` (700ms, integer steps via `tallyValue`, reduced-motion jump `:224-230`, lands EXACTLY on ceil `:238`); pure helpers `summary.ts:70-72,109-119`; tests `summary-sheet.test.ts:178-201` (tally math), `transcript-page.test.ts:380-388` (arc target + the tally lands on '66') |
| Tiers at the OWNER-REVISED 80/50 cut | PASS S/T | `summary.ts:80-100` — `isCelebration = score >= 80` (re-cut from >80), `summaryTier`: ≥80 GREAT, ≥50 GOOD, <50 LOW; sheet consumes the raw score for the tier (`:153`) and keeps the ceil display (§4.14.4); tests `summary-sheet.test.ts:148-177` (the 80/50 re-cut incl. score 80 celebrating), `transcript-page.test.ts:439-...` (celebration class at ≥80) |
| GREAT ≥80: approach + hops + marching beam + star/heart poppers | PASS S/T | approach `:704-725` (±18px, 300ms, 200ms delay), hop loops `:726-737` (`avatar-hop` 600ms `steps(2, jump-none)` infinite alternate); beam `:824-867` (stepped strip marching `steps(2)` 800ms + opacity pulse 0.7↔1.0); 6 poppers star×3/heart×3 `:401-408` + `:899-937` (staggered 0–500ms, yellow/orange/white); the recolored spark burst + brightness pulse fold in (`:1217-1281`, `--sheet-*` colors, 0.22 wash); tests `summary-sheet.test.ts:714-...` (§4.15.C-6b GREAT sparkles incl. the heart registry rects) |
| GOOD 50–79: nod/wave + dotted glow line | PASS S/T | nod/wave once on open `:738-770` (me dips 2×, them rocks ±6° 2×, transform-origin bottom); dotted line `:868-898` (6px dots at 60% white + the pre-blurred `filter: blur(6px)` duplicate with pulsing opacity 0.4↔0.9 — static filter, §4.6-safe) |
| LOW <50: sweat drop + blink | PASS S/T | sweat drop element `:390-392` + `:771-808` (8×10px white drop, falls twice, 4s idle cycle); idle blink `:809-823` (120ms dip to 0.65 every 4s); avatars stay apart (no approach animation on tier-low) |
| Checklist pop-flash-draw choreography | PASS S/T | `:1027-1067` — closed boxes pop `box-pop` 150ms `steps(2)` at `400ms + i×140ms`, retro white flash `:1039-1055` (120ms, right after the pop), the green check appears 60ms after the flash (`check-in` at +280ms); open checkpoints ride the cascade (no pop); the green check = `--sheet-green` → `--color-check-green` `:1013-1016` (square 16px box `:1000-1009`); tests `summary-sheet.test.ts` (§4.15.C-7 block within :581-926) |
| Summary paragraph | PASS S | `:419-421` `summary.description` left-aligned Inter 14px/1.45 white ink (`.description :966-972`); test `transcript-page.test.ts:389-391` |
| Sheet-variant slide (yellow thumb/charcoal track/yellow border, 50.912px loop) | PASS S/T | variant="sheet" embed `:443-455`; overrides `:1077-1095` — height `clamp(64px, width÷3.75, 80px)` (the §15.2/§15.3 reconciliation, §4.15.G), `--slide-track-bg: var(--sheet-charcoal)`, 2px yellow border `:1096-1098`, yellow thumb + charcoal ink, pixel hint 10px (12px from 720px `:1317-1320`); 3-color stripes `:1106-1115` (yellow/white/orange 12px segments, 0.9s) with the seamless `sheet-marquee` −50.912px loop `:1116-1123` (36px ÷ sin45°); pulsing pixel arrow `:1124-1137` (1↔0.6 over 1s); tests `summary-sheet.test.ts:813-870` (the override contract + loop) |
| Completion: 'Contact shared!' + 24 square-pixel confetti + victory jumps, gesture-gated | PASS S/T | gesture flag `completedHere` `:127,256-259`; the hint swaps to `chat.contact_share.shared_done` ONLY for a gesture made here, the 409 label keeps its own copy `:172-176,448`; 24 deterministic square flakes (`border-radius: 0` `:1148`, 8–10px, yellow/white/orange + Deepa hues) `:198-206,312-327,1138-1188`; victory jumps `:941-963` (`victory-jump` 700ms `steps(2, jump-none)` ×2 on `.stage.victory`); all gated on `completedHere && slideShared` `:179` — a re-mount replays nothing (the close disarms `:245-248`); tests `summary-sheet.test.ts` (§4.15.C-8 block), `transcript-page.test.ts` (the sheet slide completes via the page's shareCard) |

### Item D — Ratifications on record — PASS (both documented; tests non-vacuous)

| Check | Result | Evidence |
| --- | --- | --- |
| Sweep-test `.arcade-sheet` hex exception — documented in the logs | PASS S | worker flag `docs/logs/7357adbe.log:3-4` (TZ-10 conflict raised + the amendment made, flagged for ratification); **ratification** `docs/logs/e5057764.log:64` (process: "the mechanical consequence of the owner's BINDING spec (Concept 15.3: palette locked exactly as specified, do not remap to app tokens) — supersedes the 2.4 tokens-only rule for that one block; worker's amendment kept non-vacuous (locked hexes asserted verbatim)") |
| The exception is real but non-vacuous | PASS S/T | `tests/sweep.test.ts:170-190` — the hex rule strips ONLY the `.arcade-sheet` scope block (`:175`) and every other file stays enforced (`:177`); the non-vacuousness test `:187-190` asserts the locked hexes verbatim (`--sheet-bg: #8a12ff` inside the scope block — the exception cannot be silently widened); the scope block is the ONLY raw-hex site in `apps/web/src` (one-shot grep: sole `#8a12ff` match = `SummarySheet.svelte:502`) |
| Additive `heart` glyph — documented | PASS S | process ratification `docs/logs/e5057764.log:66` ("additive 'heart' registry glyph outside the constraint's file list is design-required (GREAT-tier sparkles per DESIGN 4.15.C) — additive icon entry, no palette/behavior impact"); the glyph is in the registry: `icons/registry.ts:28` (type union) + `:227-229` (16×16 rect data, in-grid) |
| The heart glyph's tests stay non-vacuous | PASS S/T | `tests/summary-sheet.test.ts:714-722` — asserts the 6 poppers render star/heart AND reads `ICON_RECTS.heart` with in-grid rect assertions (the registry entry is exercised, not just tolerated) |

### Item E — i18n RU/EN parity — PASS

| Check | Result | Evidence |
| --- | --- | --- |
| All new keys present in BOTH dictionaries | PASS S/T | `ru.ts:152-153,167-168,171-174` / `en.ts:152-153,167-168,172-175` — `chat.contact_share.sheet_label` («Смахните, чтобы поделиться» / "Slide to share contact"), `chat.contact_share.shared_done` («Контакт отправлен!» / "Contact shared!"), `chat.summary.open` («Итоги встречи» / "Meeting summary"), `chat.summary.open.disabled` («Диалог ещё идёт» / "Dialog in progress"), `chat.summary.me` («Вы» / "You"), the three tier keys (verbatim per §4.15.E); the global key-set parity test `i18n.test.ts:14-19` covers any unenumerated key |
| Parity block extended (§4.15.E) | PASS S/T | `i18n.test.ts:347-375` — the §4.15.E block enumerates `chat.summary.me` + the tier keys + the slide sheet keys with verbatim spot-checks incl. the 409 label pair; `chat.summary.open`/`open.disabled` asserted through the button tests (`transcript-page.test.ts:550,562,745,765`) + the global parity |
| Sheet-i18n EN regression guard stays green | PASS S/T | `summary-sheet.test.ts:398-424` — "EN interface: every sheet copy renders EN from the i18n table, never RU (§4.14.5 bug round)", now extended to the sheet-variant slide hint (`:418`); green in the spot-run (§4) |

---

## 3. Known findings (recorded, NOT fixed — verification-only constraint)

**Verdict: items A–E — 5/5 PASS, 0 FAIL.** No product defect found; no
fix-up performed.

- **Trivial (comment-only):** the ShareContactSlide doc-comment still opens
  with "Rendered in the dialog footer (routes/chats/[address])"
  (`ShareContactSlide.svelte:6-7`) — the §4.15.B.1 cutover removed the
  footer instance, so that sentence is stale; the same doc-comment's later
  paragraphs already describe the sheet as the embed. Cosmetic only, no
  behavioral impact; left untouched per the constraint.
- The standing trivial note from the §13 sweep (stale comment-only duration
  references in `routes/room/+page.svelte`) remains open, unchanged — see
  `docs/verification-v3.md` §3.

---

## 4. Spot-run record (first-hand, this session)

```
npm run test -w @bleak/web -- tests/kit.test.ts tests/summary-sheet.test.ts
  tests/transcript-page.test.ts tests/i18n.test.ts
  → Test Files 4 passed (4) · Tests 149 passed (149)   (20:39:37Z, 11.61 s)
npm run test -w @bleak/web -- tests/sweep.test.ts tests/tabbar.test.ts
  → Test Files 2 passed (2) · Tests 19 passed (19)     (20:39:52Z, 0.64 s)
```

All 6 card-anchored suites: **168 tests green, 0 failures**. The run covers
every §15 surface's evidence anchors: the slide v2 (kit component tests incl.
the 85%/variant/geometry CSS contracts), the arcade sheet core + centerpiece
+ completion (summary-sheet), the placement cutover + button states +
once-per-pair re-open (transcript-page), the RU/EN parity + EN regression
guard (i18n + summary-sheet), the ratified sweep exception with its
non-vacuousness check (sweep), and the tab bar (unaffected-surface anchor).
No full `make test` by this sweep — the process runs the delta-wave CI on
`dev` after this landing (§1 placeholder).

---

## 5. Carried-forward manual checks (owner, real device)

The automated suites pin the logic; these need a real phone/API:

**New for v3.2:**

1. **Arcade sheet end-to-end on a real finished chat** — open the sheet:
   the spring-bounce rise plays and the five sections cascade in (~50ms
   stagger); the tally counts up arcade-style and lands exactly on the
   ceil score with the ring filling clockwise; the tier animation matches
   the score (drive all three tiers if reachable: ≥80 GREAT — avatars
   approach + hop with the marching beam and star/heart sparkles; 50–79
   GOOD — nod/wave + the glowing dotted line; <50 LOW — sweat drop + idle
   blink); closed checklist items pop-flash-draw one by one; completing
   the slide fires the 24-flake square confetti + both avatars' victory
   jumps + "Contact shared!"/«Контакт отправлен!»; closing and re-opening
   over the held Summary replays nothing.
2. **Slide v2 feel on touch AND mouse** — the glass pill drags smoothly on
   a touchscreen and with a mouse (pointer capture; no scroll-jank), the
   hint fades out with the thumb, the candy trail stripes scroll
   continuously without a visible loop seam (base 33.941px loop; sheet
   variant 50.912px), release below 85% springs back with a light
   overshoot, release at/past 85% snaps and completes.
3. **Summarization button states on device** — an active dialog shows the
   disabled «Диалог ещё идёт» button; a finished dialog's enabled
   «Итоги встречи» opens the sheet over the stored record without a
   second hard-match spinner.
4. **Press Start 2P RU headers on device** — the MEETING SUMMARY label,
   the tier label, the checklist header and the score numeral render in
   the pixel face for BOTH locales (Cyrillic subsets bundled); no serif
   fallback for missing glyphs (Handjet is the second stack entry).

**Carried forward (unchanged — full notes in `docs/verification-v3.md` §6,
`-v31.md` §5 and earlier):** RU date/time ICU («8 сентября» + hh:mm, no
«мин»/AM-PM), Deepa violet legibility (`#9B0CFF` with light ink at arm's
length / outdoor brightness), radar feel after the §13 tuning (74px center
gap, 40px icons in 48px touch circles, 90/135/30s rings), summary-sheet
freshness (a repeat open re-shows the stored record without re-summarizing),
contacts tab dot flow at real phone width (receive → dot lights → visiting
/contacts clears it, per-persona isolation), join digit-row + full-screen
forms at real phone widths, and the standing on-device scanner smoke (HTTPS
secure-context gate, iOS Safari + Android Chrome decode path, camera light
off on close), PWA install, venue Wi-Fi polling, host-console flows,
return-to-event round-trip.

---

DELTA-WAVE CI: GREEN — 2026-11-19T20:42Z, dev 158f77c, lint clean / 801 tests / build 0 errors
