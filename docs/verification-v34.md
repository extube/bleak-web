# bleak-web v3.4 — Verification sweep (tz8-03, verification-only)

Worker instance `c1f2512b` · 2026-11-19 · branch
`feature/c1f2512b-tz8-03-verify-v34` (base = dev tip `dc0620f` — the landing of
`feature/d838f57e-tz8-02-chat-list-dot`; both §17 fix rounds landed into `dev`
before this sweep, see the commit map below). This sweep verifies the
**Concept §17 microchanges** (v3.4 sheet line + chat-list dot, DESIGN §4.15.2)
are delivered on `dev`. It adds **no product code and no test files** —
one-shot source reads and targeted spot-check runs recorded here, per the
verification-only constraint of the card. It completes the §13–§17
verification record (§13 = `docs/verification-v3.md`, §14 = `-v31.md`, §15 =
`-v32.md`, §16 = `-v33.md`).

Method legend: **S** = source inspection / landed-code read in this sweep,
**T** = merged automated test (file — title), **R** = targeted spot-run
executed first-hand in this session.

Landing commits of the §17 round (dev log, both pre-sweep): tz8-01
sheet-line-removal `b72daca` (task 81, worker `ccf1d63f`), tz8-02
chat-list-dot `dc0620f` (task 82, worker `d838f57e`).

---

## 1. Gate record (TZ §8.8 discipline — full gates are delta-wave-CI's job)

| Check | Result | Source |
| --- | --- | --- |
| Full `make test` re-run by this sweep | **not run** (the process runs the delta-wave CI after this landing) | this session |
| Owning workers' local gates — task 81 (tz8-01) | **green**: targeted summary-sheet 57/57 · full `make test` 807 passed (48 files) · `make lint` clean · `make build` ok | `docs/sessions/ccf1d63f.md` report |
| Owning workers' local gates — task 82 (tz8-02) | **green**: targeted + full `make test` (749 + 57) · `make lint` clean · `make build` ok | `docs/sessions/d838f57e.md` report |
| Targeted spot-runs (2 card-anchored suites, first-hand) | **green — 85 tests / 2 files** (summary-sheet + chats-page) | `npm run test -w @bleak/web -- <files>` (§4), all passing |
| Owning tasks of the §17 items | tasks 81 + 82 both landed into `dev` (dev tip `dc0620f` at sweep time) | dev log |

No test was added or modified by this sweep. No product code touched.

DELTA-WAVE CI: [pending — process fills]

---

## 2. Per-item checklist — Concept §17

### Item 1 — SHEET LINE (§17.1 / §4.15.2.1, task 81 `b72daca`) — PASS

All checks against `apps/web/src/lib/components/SummarySheet.svelte` (landed
state) + `apps/web/src/lib/chats/summary.ts` +
`apps/web/tests/summary-sheet.test.ts:740-759` (the §4.15.2.1 GOOD test).

| Check | Result | Evidence |
| --- | --- | --- |
| GOOD-tier dotted connector fully removed from the sheet source | PASS S/T | one-shot grep over `SummarySheet.svelte`: **zero matches** for `.dots` / `dots-glow` / `dots-pulse`; the GOOD branch carries only a removal comment (`:425-428` "NO bridge element — the old glowing dotted line … removed (owner microchange Concept §17.1 / DESIGN §4.15.2.1)"); markup has no bridge element between the avatars (`:403-429`); tests `summary-sheet.test.ts:752-758` (rendered GOOD sheet: `.dots`/`.dots-glow` both null; `SHEET_SOURCE` not matching `/\.dots[\s,{]/`, no `dots-pulse`) |
| Connector gone from its source everywhere | PASS S | repo-wide grep over `apps/web/src`: zero matches for `dots-glow` / `dots-pulse` / `class="dots` (the only remaining mentions are the test removal-contracts themselves, `summary-sheet.test.ts:756-758`) |
| GOOD nod/wave avatar animations intact | PASS S/T | `.tier-good .side.me .avatar-frame` `:799-800` (`avatar-nod 400ms ease-in-out 400ms 2 both`, keyframes `:802-810` two dips to 2px); `.tier-good .side.them .avatar-frame` `:811-813` (`avatar-wave … 2 both`, `transform-origin: 50% 100%`), keyframes `:815-829` (±6deg rocks); tests `summary-sheet.test.ts:740-748` |
| GREAT beam/sparkles intact | PASS S/T | beam markup `:416` + CSS `:883-931` (4px stepped strip, `beam-march 800ms steps(2, jump-none) infinite`, `beam-pulse`); 6 sparkle poppers (star ×3, heart ×3) `:417-424` + `.popper` loop `:933-951` (staggered 0–500ms, yellow/orange/white); tests `summary-sheet.test.ts:700-738` |
| LOW sweat/blink intact | PASS S/T | `.tier-low .side.them .sweat` `:833-841` (8×10px white drop, `sweat-cycle 4s linear infinite`, keyframes `:842-867` two falls then idle); idle blink `.tier-low .mover .avatar-frame` `:868-870` (`avatar-blink 4s linear infinite`, 120ms dip to 0.65); tests `summary-sheet.test.ts:761-778` |
| Tier thresholds 80/50 intact | PASS S/T | `lib/chats/summary.ts:81` `score >= 80` → GREAT celebration; `:99` `score >= 50 ? 'good' : 'low'`; the sheet doc-comment pins the raw-score cut (`SummarySheet.svelte:33-38,167`); i18n tier-label comment `en.ts:170` ("80/50 thresholds per the owner revision") |
| Checklist / slide / layout untouched by the removal | PASS T | the §4.15.C-7 checklist choreography test (`summary-sheet.test.ts:780-811`, cadence 400ms + i×140ms), the §16.2 pinned layout describe block and the sheet-variant slide contracts — all green in the spot-run (§4); the removal touched only the GOOD bridge (markup + styles + keyframes), no layout-selective diff |

### Item 2 — CHAT LIST DOT (§17.2 / §4.15.2.2, task 82 `dc0620f`) — PASS

All checks against `apps/web/src/lib/components/chats/ChatCard.svelte`
(landed state) + `apps/web/src/lib/avatar/traits.ts` +
`apps/web/tests/chats-page.test.ts:250-376, 510-534` (the §4.15.2.2 blocks).

| Check | Result | Evidence |
| --- | --- | --- |
| Right-side status marks removed (both glyphs) | PASS S/T | ChatCard markup has no status glyph at all — the card's right side is the loader (`:133-135`, active only) + the dot (`:140`); no `PixelIcon` import/usage remains in the component (imports `:60-66` — PixelAvatar only); test `chats-page.test.ts:365-366` (`cardCss` not matching `/^\s*\.status\b/m`, no `PixelIcon`), `:264-265, :521-522` (`.dot` renders, `dot.querySelector('svg')` null) |
| `.status` spin + `chat-status-spin` keyframes removed | PASS S/T | zero matches for `chat-status-spin` / `.status` in ChatCard.svelte (one-shot grep; the doc-comment records the removal, `:29-31`); tests `chats-page.test.ts:367, 526, 531` (`cardSource` not matching `/chat-status-spin/`, no `.status` element in the rendered card) |
| One state-agnostic 8px color dot per card, right side | PASS S/T | `<span class="dot {hueClass}" aria-hidden="true" title={statusLabel}>` `:140` — rendered OUTSIDE any `{#if state …}` block (unconditional per card); CSS `.dot` `:220-226` (`width: 8px; height: 8px; border-radius: 50%`), the LAST flex child = right side; tests `chats-page.test.ts:250-263` (dot present, no `active`/`finished` class on it), `:271-285` (Chat.done → the SAME dot), `:286-307` (a poll flip changes the aria wording, the dot does not change shape) |
| Dot in the interlocutor's Deepa hue (fnv1a % 5 contract) | PASS S/T | `hueClass = codeHue(counterpartAddress)` `:101`; `.dot.deepa-1…deepa-5` → `var(--color-deepa-<n>)` `:227-241`; `codeHue` = `CODE_HUES[fnv1a(address) % CODE_HUES.length]` (`traits.ts:70-73`); tests `chats-page.test.ts:326-327` (`codeHue('0xa')` = `CODE_HUES[fnv1a('0xa') % 5]`), `:263, :283, :334, :521` (the dot wears `codeHue('0xa')`), `:358-360` (all five hue→token mappings pinned), `:361` (danger red gone) |
| Missing-counterpart fallback to currentColor | PASS S | `hueClass` = `''` when `counterpartAddress === null` (`:101`, degenerate 0-participant case per the doc-comment `:46-48`); `.dot` base `background: currentColor` (`:225`) — with no hue class the dot rides the neutral surface's text color |
| Rendered for BOTH states | PASS S/T | the dot span `:140` sits outside the active-only loader conditional (`:133-135`); tests `chats-page.test.ts:250-268` (active card), `:271-285` (finished card — same dot), `:286-307` (flip mid-poll — the dot stays) |
| aria-hidden, status title retained, accessible name still carries status via chatStatus | PASS S/T | `aria-hidden="true"` + `title={statusLabel}` on the dot (`:140`); the accessible name is `chats.card.aria` with `{name, status}` from `chatStatus(chat)` (`:92, :102-107`); tests `chats-page.test.ts:267-268, :523` (aria-hidden) + the §4.13.2 flip test (`:298` wording flips with Chat.done) |

> **CORRECTION NOTE (2026-11-20, owner correction per Concept §17.2, recorded
> mid-sweep as §3.2 above) — SUPERSEDES the state-agnostic rows of item 2.**
> The owner correction has LANDED: `bug/d838f57e-chat-dot-finished-only`
> squashed to `dev` as `f658f69` (worker `d838f57e`, bug #2). The color dot
> now renders on **FINISHED cards only** — an unfinished item shows **no
> dot**, only the §4.13.4 loading circle; **the dot and the spinner never
> coexist**. Everything else verified above stands unchanged: the dot keeps
> the interlocutor's Deepa hue (fnv1a % 5), stays right-side, 8px, round,
> aria-hidden with `title={statusLabel}`, the accessible name still carries
> the status via `chatStatus`. Superseded by the correction: the
> "state-agnostic / rendered for BOTH states" rows — the sweep's original
> item-2 verification described the PRE-correction landed state (dev
> `dc0620f`), which was accurate at sweep time. Corrected test anchors
> (`apps/web/tests/chats-page.test.ts`, landed state at `f658f69`): the
> FINISHED contract "color dot on FINISHED cards only …" (dot in the
> interlocutor's hue + no spinner + no `.status` on the finished card, no
> dot + `.loader` present on the unfinished card); the §4.13.2 poll-flip
> contract "the dot appears only while done; the poll flip swaps dot ↔
> spinner" (asserts the swap BOTH directions, done true → dot/loader-null,
> done false → dot-null/loader-back); the ChatCard-direct contract
> "done → the DOT (no loader); missing/false → NO dot, the loader only".
> Re-verified first-hand post-correction: `npm run test -w @bleak/web --
> tests/chats-page.test.ts` → 28/28 green against the corrected working
> tree (2026-11-20). The §5 manual dot-legibility check accordingly applies
> to finished cards; unfinished cards show the loader instead.

### Item 3 — SPINNER (§17.3 / §4.15.2.2, task 82 `dc0620f`) — PASS

Same evidence base as item 2.

| Check | Result | Evidence |
| --- | --- | --- |
| Old rotated-dots indicator gone | PASS S/T | the §10.1.7-era animated glyph spin left with the marks: no `.status` element, no `chat-status-spin` keyframes anywhere in ChatCard.svelte (one-shot grep, zero matches); tests `chats-page.test.ts:364-367, 524-531` |
| §4.13.4 unfinished circle spinner kept exactly (`.loader` + `loader-spin`) | PASS S/T | `{#if state === 'active'}<span class="loader" aria-hidden="true">` `:133-135`; CSS `.loader` `:246-254` (14px border ring, transparent top arc, `loader-spin 0.9s linear infinite`), keyframes `:255-259` (`rotate(360deg)`); tests `chats-page.test.ts:368-371` (border-radius 50% / animation loader-spin / keyframes 360deg pinned from source), `:532-533` (the loader renders on the unfinished card) |
| Unfinished opacity treatment untouched | PASS S/T | `.chat-card.unfinished { opacity: 0.6 }` `:167-169` (+ pressed dip 0.5 `:170-172`), the §4.13.4 doc-comment intact (`:50-58`); the §4.12.2/§4.15.2.2 CSS test keeps the neutral-surface contract (`chats-page.test.ts:354-355`) |
| Preview line untouched | PASS S/T | `.preview-line` muted 0.75 + single-line ellipsis `:196-210`, markup `:120-126` (time + preview, `title` on the content) — unchanged by the round |
| Sorting untouched | PASS S/T | the route's §4.13.4 score-first sorting is intact (`routes/chats/+page.svelte:93-107` — finished chats' match/v2 score refresh per tick; the sort itself lives in the score store, unedited); the sorting describe block `chats-page.test.ts:605+` — green in the spot-run |
| Deepa avatar coding untouched | PASS S/T | the item's avatar carries the coding: `<PixelAvatar address={counterpartAddress ?? ''} size={56}>` `:117`, the §4.12.2 doc-comment intact (`:33-40`); the §4.12.2 test block (`chats-page.test.ts:324-348`) — green in the spot-run |

---

## 3. Known findings (recorded, NOT fixed — verification-only constraint)

**Verdict: items 1–3 — 3/3 PASS, 0 FAIL.** No product defect found; no fix-up
performed. One recorded note (not a behavioral defect):

1. **Trivial (comment-only residue):** the ChatCard doc-comment still
   references "the retired marks" lineage when describing the dot
   (`ChatCard.svelte:42-44`, `:215-219`) — accurate as lineage context, but
   the marks no longer exist in the component. Cosmetic only; left untouched
   per the constraint.

The standing trivial notes from earlier sweeps remain open, unchanged
(`docs/verification-v33.md` §3: the inert §15-era `--slide-height` slot +
stale comments in the sheet slide scope; the stale room-page duration
comments; the ShareContactSlide doc-comment's stale opening sentence).

2. **Working-tree observation at commit time (NOT a delivered-state
   finding):** while this sweep was committing, an UNCOMMITTED foreign edit
   appeared in the shared checkout on
   `apps/web/src/lib/components/chats/ChatCard.svelte` — it moves the color
   dot inside a `{#if state === 'finished'}` branch (dot renders on finished
   dialogs only, loader on unfinished; doc-comment cites an "owner
   correction, Concept §17.2"). It is NOT part of the landed `dev` state
   verified above and NOT staged by this sweep (explicit-path staging only).
   If the process intends to land it, it needs its own task card — against
   the card's criterion as written ("rendered for BOTH states"), so flagged
   here for the process, untouched by this sweep.

---

## 4. Spot-run record (first-hand, this session)

```
npm run test -w @bleak/web -- tests/summary-sheet.test.ts tests/chats-page.test.ts
  → Test Files 2 passed (2) · Tests 85 passed (85)   (21:22:11Z, 20.83 s)
```

Both §17 evidence anchors green: the §4.15.2.1 GOOD test (nod/wave kept,
dots contracts removed) in summary-sheet, and the §4.15.2.2 blocks (state-
agnostic dot + hue contract + marks/rotated-dots removal + circle loader kept)
in chats-page. No full `make test` by this sweep — the process runs the
delta-wave CI on `dev` after this landing (§1 placeholder).

---

## 5. Carried-forward manual checks (owner, real device)

The automated suites pin the logic; these need a real phone/API:

**New for v3.4:**

1. **The sheet without the connector line on a real GOOD-tier chat** — open
   the summary sheet on a chat whose score is 50–79 (GOOD): the two avatars
   nod/wave once as before, but the space between them is now EMPTY — no
   dotted line, no glow; confirm the tier label, ring, checklist and slide
   still look right with the gap (nothing else shifted).
2. **Chat-list dot legibility on device** — on the /chats list on a real
   phone: every card shows a single small dot at the right edge, in the
   interlocutor's Deepa hue, readable against the card surface for all five
   hues on the dark theme (check a few chats with different counterparts —
   the hues are deterministic per address); the unfinished cards' opacity
   must not wash the dot out; no leftover glyph ever appears.

**Carried forward (standing arcade-sheet/on-device items — full notes in
`docs/verification-v32.md` §5, `docs/verification-v33.md` §5 and earlier):**
the arcade-sheet end-to-end on a real finished chat (spring-bounce rise,
cascade stagger, tally + clockwise ring, tier animations across all three
tiers — now without the GOOD dotted line — checklist pop-flash-draw,
completion confetti + victory jumps + copy swap, re-open replays nothing);
slide v2 feel on touch AND mouse (85% snap vs spring-back, wrapping fill,
marquee seam); sheet scroll with a long summary text (pinned top bar/stage,
pinned bottom slide); slide / Summarization-button bottom alignment on
device; Summarization button states on device; Press Start 2P RU headers on
device; and the earlier standing items — RU date/time ICU, Deepa violet
legibility, radar feel after the §13 tuning, summary-sheet freshness (no
re-summarize), contacts tab dot flow, join digit-row/full-screen forms, the
on-device scanner smoke (HTTPS secure-context gate, iOS Safari + Android
Chrome decode path, camera light off on close), PWA install, venue Wi-Fi
polling, host-console flows, return-to-event round-trip.

---

*Verification-only sweep by worker `c1f2512b` (task 83, tz8-03) — no product
code, no test files; the delta-wave CI record above is filled by the process
after the merge.*
