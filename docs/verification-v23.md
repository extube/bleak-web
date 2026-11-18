# bleak-web v2.3 — Verification addendum sweep (TZ4-13, verification-only)

Worker instance `51b86c08` · 2026-11-18 · branch
`feature/51b86c08-tz4-13-verify-v23` (tip = dev `957af53` — the landing of
`feature/84aca8b6-tz4-12-avatar-deepa`; all of the §9 delta wave TZ4-08…TZ4-12
merged). This sweep verifies the **six refinements of Concept §9.1** (v2.3
addendum, DESIGN §4.10 amendments) are delivered on `dev`. It adds **no
product code and no test files** — one-shot source greps, landed-code reads
and targeted spot-check runs recorded here, per the verification-only
constraint of the card.

Method legend: **S** = source inspection / one-shot grep in this sweep,
**T** = merged automated test (file — title), **R** = targeted spot-run
executed first-hand in this session.

---

## 1. Gate record (TZ §8.8 discipline — full gates are delta-wave-CI's job)

| Check | Result | Source |
| --- | --- | --- |
| Full `make test` re-run by this sweep | **not run** (the process runs the delta-wave CI after this landing) | this session |
| DELTA-WAVE CI: [pending — process fills] | — | — |
| Landing CI records for the delta wave (tasks 37–41, one CI run per landing, per §8.8) | **all green** — task 37 landed `aba7384` (log 09:12:44Z); 38 `a5b5e3f` (09:15:38Z); 39 `1283bf3` (09:18:36Z); 40 `0f876c7` (09:24:38Z, "AA-verified 4.74–13.5:1"); 41 `957af53` (09:31:39Z) | process log `docs/logs/e5057764.log` |
| Targeted spot-runs (7 card-anchored suites, first-hand) | **green — 136 tests / 7 files** (avatar + bubble-contrast = 36; room-radar + radar-placement = 55; chats-page + transcript-page + profile-page = 45) | `npm run test -w @bleak/web -- <files>` ×4, all passing (§3) |
| Owning tasks of the 6 items | **37, 38, 39, 40, 41 — all `merged`** (CI-gated closure follows the delta-wave CI) | `task.py list` at sweep time |

No test was added or modified by this sweep.

---

## 2. Per-item checklist — Concept §9.1 items 1–6

### Item 1 — Private-bio heading: position kept, Inter, muted red (task 39, §9.1.1, DESIGN §4.10.3) — PASS

| Check | Result | Evidence |
| --- | --- | --- |
| Position/order kept — the heading still sits between the «only your agent sees this» label and the private bio text | PASS S/T | `ProfileBadge.svelte:100-108` — `for_agent` label → `<p class="private-bio-heading">` → `.bio-text`; `profile-page.test.ts:437-461` — "the «only your agent sees this» heading reverts to the body face with a MUTED red…" pins the heading ABOVE the content via the `for_agent…bio-text` source block order |
| Typeface = Inter (`--font-body`) — NOT the pixel font | PASS S/T | `ProfileBadge.svelte:262-270` — `font-family: var(--font-body)` (comment §9.1.1/§4.10.3 at 257–261); test asserts the block contains `var(--font-body)` and NOT `var(--font-pixel)`; `--font-body: 'Inter Variable', …` (`tokens.css:105`) |
| Muted red, not solid: `color-mix(in srgb, var(--color-danger-text) 70%, transparent)` | PASS S/T | `ProfileBadge.svelte:269` — the exact card expression, tokens only (test: no raw hex in the block); `--color-danger-text: #e05252` (`tokens.css:42`); uppercase/weight kept so the heading stays distinct from the bio text |
| Companion treatment in the persona editor | PASS S/T | `PersonaEditor.svelte:69` (same heading class) + styles at `:126`; `profile-page.test.ts:463-473` — "the persona editor caption carries the same reverted treatment" |

### Item 2 — Settings button in the profile page's TOP-RIGHT corner (task 38, §9.1.2, DESIGN §4.10.2) — PASS

| Check | Result | Evidence |
| --- | --- | --- |
| A real link to `/profile/settings` in the header's top-right corner | PASS S/T | `routes/profile/+page.svelte:316-324` — `<header class="header"><h1>…</h1><a class="settings-corner" href={resolve('/profile/settings')}>` (comment §9.1.2/§4.10.2 at 317–318); header is `display: flex; justify-content: space-between` (`:420-427`), so the button hugs the right edge; rounded-square button styling, tokens only, full touch target (`:431-450`) |
| Body row absorbed — single entry point | PASS S/T | grep `settings-row` over the profile route: **zero hits** — the v2.2 body-level row is gone; `profile-page.test.ts:516-531` — "a settings link sits in the page header top-right corner; the body-level row is absorbed" asserts `.header .settings-corner` present, href `/profile/settings`, and `.settings-row` ABSENT (exactly one entry point) |
| EN/RU parity of the corner label | PASS T | `profile-page.test.ts:533-544` — "EN parity: the corner label follows the locale"; green in the spot-run |
| The settings sub-page itself is untouched (route, rotate, leave) | PASS S | `routes/profile/settings/+page.svelte` unchanged by this round (heading/rows/confirm dialogs intact; task 38 touched only `/profile`) |

### Item 3 — Radar ring diameter = max(screen-w, screen-h) (task 37, §9.1.3, DESIGN §4.10.1) — PASS

| Check | Result | Evidence |
| --- | --- | --- |
| `radarStageSize` helper: square stage of side max(w, h) | PASS S/T | `lib/room/radar.ts:130-143` — `const side = Math.max(availWidth, availHeight); return { width: side, height: side };` ("the radar spans the larger viewport dimension, centered; the page container clips the overflow"); pure/deterministic, unit-tested |
| Placement math scales against HALF of the max dimension (ring diameter = max) | PASS S/T | `radar.ts:120-127` — `radius = placement.radiusFrac * (Math.max(stageWidth, stageHeight) / 2)`; `radar-placement.test.ts:110-123` — "uses HALF OF THE MAX dimension when the stage is not square (§4.10.1)" for `[320,640]`, `[640,320]`, `[800,200]` |
| Page sizes a centered square stage, clipped by the page | PASS S/T | `routes/room/+page.svelte:133-151` (measures the viewport box, applies `radarStageSize`), `:365-369` (`<div class="radar-stage" style:width=…px style:height=…px>`), `:546-563` — wrapper `.stage { overflow: hidden }` + `.radar-stage { left: 50%; top: 50%; transform: translate(-50%,-50%) }` (comments §4.10.1); `room-radar.test.ts:434-442` — "the clipping wrapper hides the overflow: no horizontal scrollbar" pins the CSS contract |
| Portrait + landscape tests green | PASS T/R | `room-radar.test.ts:418-432` — "portrait phone 320×640: stage = 640" / "landscape 640×320: stage = 640" (rendered style asserts `width: 640px; height: 640px`); `radar-placement.test.ts:126-141` — `radarStageSize` param set incl. square + degenerate 0×0; `:243-259` — layout invariants hold on the square stage in BOTH orientations; `radar-placement.test.ts:103-104` note: on the square stage min = max, so the pre-existing square-stage assertion still holds; all green in the spot-run |

### Item 4 — Margin between the Interests title and the interest items (task 39, §9.1.4, DESIGN §4.10.4) — PASS

| Check | Result | Evidence |
| --- | --- | --- |
| `--space-3` (12px) gap below the «Interests» title row, before the chips/empty state | PASS S/T | `ProfileBadge.svelte:271-279` — `.row-head { … margin-bottom: var(--space-3); }` (comment §9.1.4/§4.10.4; `--space-3: 12px`, `tokens.css:115`); the row-head (title + edit button, `:111-122`) directly precedes the chips `ul` / empty-state |
| Test pins the spacing, tokens only | PASS T/R | `profile-page.test.ts:476-492` — "a clear vertical gap sits between the «Interests» title row and the interest chips — tokens only" (asserts the title renders and the `.row-head` block contains `margin-bottom: var(--space-3)`, no raw hex); green in the spot-run |

### Item 5 — Deepa palette chat coding (task 40, §9.1.5, DESIGN §4.10.5) — PASS

| Check | Result | Evidence |
| --- | --- | --- |
| `--color-deepa-1..5` tokens = the exact owner palette | PASS S/T | `tokens.css:54-58` — `#00B57F` (green), `#E8E000` (yellow), `#FF5000` (orange), `#9B0CFF` (violet), `#0DECFF` (cyan); `bubble-contrast.test.ts:91-96` — "the five Deepa hues match the documented owner palette values" |
| Full-opacity Deepa backgrounds on chats-list cards | PASS S/T/R | `ChatCard.svelte:42-47` (counterpart hue class) + `:99-117` — `.chat-card.deepa-{1..5} { background: var(--color-deepa-<n>) }` — no opacity/color-mix, straight token fills; `chats-page.test.ts:138` — "every card wears the bright §4.10.5 color coding: the counterpart Deepa hue as its full-opacity background class" |
| Full-opacity Deepa backgrounds on interlocutor bubbles; own bubbles muted | PASS S/T/R | `MessageBubble.svelte:36-38` — `hueClass = mine ? '' : codeHue(message.from)` (no deepa class on own bubbles at all) + `:84-103` full-opacity deepa classes; muted own bubble on `--color-surface-elevated` (`#292c2d`); `transcript-page.test.ts:289-304` — "their bubbles keep the full-opacity Deepa hue background; own bubbles are muted (no Deepa hue)" |
| Assignment = `fnv1a(address) % 5` | PASS S/T | `lib/avatar/traits.ts:54-74` — `CODE_HUES = ['deepa-1'…'deepa-5']`, `codeHue = fnv1a(address) % CODE_HUES.length`; `avatar.test.ts:88+` — codeHue describe (§9.1.5) |
| AA ink pairings ≥4.5:1 on every hue; dark ink on green/yellow/orange/cyan, light ink on violet | PASS S/T/R | `tokens.css:59-63` — `--color-deepa-ink-1..5` (surface ink on 1/2/3/5, `--color-text` on violet); `bubble-contrast.test.ts:104-128` — per-hue pairing + numeric ≥4.5 assertions + the light-ink-exception guard. **Measured ratios (sweep's independent WCAG computation, matching the card): deepa-1 = 7.08, deepa-2 = 13.50, deepa-3 = 5.72, deepa-4 = 4.74, deepa-5 = 12.93; muted own bubble (`--color-text` on `#292c2d`) = 12.35** — the test's inline comment records ≈7.09/≈5.73/≈13.03 for hues 1/3/5 (assertion is `≥4.5`, so the ±0.1 rounding drift is comment-only — see F1) |
| The §7.1.2 four-hue set removed | PASS S | grep `--color-bubble`, `code-yellow`, `code-orange`, `code-blue`, `code-violet` over `apps/web/src`: **zero hits** — the old palette is fully retired; `traits.ts:54-64` documents the supersession |

### Item 6 — Avatar generation on Deepa (task 41, §9.1.6, DESIGN §4.10.6) — PASS

| Check | Result | Evidence |
| --- | --- | --- |
| Art tokens derived from the Deepa hues in `tokens.css` | PASS S/T | `tokens.css:66-87` — `--color-art-skin-1..4` = color-mix of deepa-2/deepa-3 over `--color-text`; `--color-art-hair-1..5` = the five Deepa hues; no new raw hex ("every value is a color-mix or var() over existing tokens", comment 65–71); `avatar.test.ts:228-240` — "every art token derives from a Deepa hue (var/color-mix, no raw hex in the family)"; `PixelAvatar.svelte:51-75` consumes the same token family |
| Backdrops = 30% hue mix over `--color-surface`, darker than the art (numerically asserted) | PASS S/T | `tokens.css:83-87` — all five backdrops are `color-mix(in srgb, var(--color-deepa-<n>) 30%, var(--color-surface))`; `avatar.test.ts:242-256` — "every backdrop is DARKER than the art drawn on top (luminance < min(skin, hair))" — the whole-family numeric assertion (stronger than a per-address sample) |
| 1px background-colored padding ring intact (§7.1.3) | PASS S/T | `PixelAvatar.svelte:91-100` (padding color = the backdrop token) + `:103-117` (frame at declared `size`, svg at `size − 2` → 1px per side); `avatar.test.ts:259-303` — "pads the art by 1px per side at every rendered size…", "the padding color is the SAME token that fills the art backdrop…", "own persona pads in the accent; the ghost fallback pads in the elevated surface" |

---

## 3. Spot-run record (first-hand, this session)

```
npm run test -w @bleak/web -- tests/avatar.test.ts tests/bubble-contrast.test.ts
  → Test Files 2 passed (2) · Tests 36 passed (36)
npm run test -w @bleak/web -- tests/room-radar.test.ts tests/radar-placement.test.ts
  → Test Files 2 passed (2) · Tests 55 passed (55)
npm run test -w @bleak/web -- tests/chats-page.test.ts tests/transcript-page.test.ts tests/profile-page.test.ts
  → Test Files 3 passed (3) · Tests 45 passed (45)
```

All 7 card-anchored suites: **136 tests green, 0 failures**
(36 + 55 + 45). No full `make test` by this sweep — the process runs the
delta-wave CI on `dev` after this landing (§1 placeholder).

---

## 4. Carried ICU note (from the v2.2 sweep — unchanged)

This Node build has **restricted ICU**: the `ru` locale is not available to
the test runner, so `Intl.DateTimeFormat('ru-RU', …)` falls back inside
tests. The helpers (`messageTime` / `chatDateLabel`,
`lib/chats/view.ts:107-125`) are pinned to the same Intl formatter they use
with the active-locale tag (self-consistency, not literal «8 сентября»
glyphs). **Browsers ship full ICU**, so RU runtime output is correct in the
real app.

**Pre-event manual check (owner, real device):** open a dialog in RU — the
date label at the top should read «8 сентября» (day + month long) and
message times «14:05» (hh:mm, no «мин», no AM/PM). If the device renders
differently, that is an ICU/device build issue, not app logic.

## 5. Findings

**Verdict: items 1–6 — 6/6 PASS, 0 FAIL.** No product defect found; no
fix-up performed (verification-only constraint).

| # | Severity | Finding | Recommendation |
| --- | --- | --- | --- |
| F1 | none (doc-comment rounding only) | `bubble-contrast.test.ts:115-116` inline comment records deepa-1 ≈7.09 / deepa-3 ≈5.73 / deepa-5 ≈13.03, while the exact WCAG ratios (computed first-hand this sweep and matching the card) are 7.08 / 5.72 / 12.93 — the assertion itself is `≥4.5` and passes regardless; only the comment's rounding drifts. | Cosmetic comment fixup whenever that file is next touched; no action required this round. |
| F2 | none (informational) | `avatar.test.ts:236-239` asserts backdrop tokens are color-mixes over `--color-surface` with ANY percentage (`\d+%`); the exact 30% is pinned by the source (`tokens.css:83-87`) and by the darker-than-art numeric check, so the contract is fully covered in combination. | None — recorded for the record. |

## 6. Pre-event manual smoke notes (owner, running app)

Carried from v1/v2/v2.1/v2.2 sweeps plus the v2.3-specific eyeball checks.
The automated suites pin the logic; these need a real phone:

1. **v2.3 — Deepa legibility on a real phone (the critical eyeball check):**
   every chats-list card and interlocutor bubble carries a full-opacity
   Deepa background — pay special attention to **violet `#9B0CFF`** (the
   one hue whose text is light `#f0f0f0`, measured 4.74:1 — the tightest AA
   pairing): at arm's length on an OLED panel at outdoor brightness the
   text must stay readable; the yellow `#E8E000` card with dark surface
   ink (13.50:1) should feel the easiest to read. Secondary text and chips
   on each card must also stay legible (the AA bumps are token-based).
2. **v2.3 — radar oversize on small screens:** the radar square now spans
   the LARGER viewport dimension — on a portrait phone the ring extends
   past the left/right screen edges by design; confirm NO horizontal
   scrollbar appears (the wrapper clips), the center "you" chip and the
   node icons stay visible and tappable within the clipped view, and
   rotating the phone (landscape) re-sizes the stage to the new larger
   dimension without a broken layout.
3. **v2.3 — settings corner button reachability:** on /profile the
   «Настройки» button sits at the TOP-RIGHT of the header — confirm a
   one-handed thumb reach is comfortable on a 6″ phone (compact
   rounded-square, ≥44px touch target), no duplicate settings row lower on
   the page, and tapping opens /profile/settings as before.
4. **v2.3 — profile badge text check:** the «видно только вашему агенту»
   caption is now Inter (body face), UPPERCASE, in a muted red (~70% of the
   danger red) — not the pixel font, not solid red; visually distinct from
   the private text below but clearly a heading.
5. **v2.3 — avatar palette:** generated personages draw skin/hair in the
   Deepa-derived art tokens with a visibly darker backdrop of the same hue
   family; the 1px backdrop-colored padding ring stays at every avatar
   size; own persona keeps the accent backdrop.
6. **v2.3 — Interests spacing:** a clear ~12px gap between the
   «Интересы» title row and the chips/empty state.
7. **Carried pre-event (unchanged, full checklists in
   `docs/verification-v2.md` §8, v2.1 §5, v2.2 §6):** HTTPS secure-context
   gate (camera + `crypto.subtle`), scanner real-device smoke (iOS Safari +
   Android Chrome: permission states, decode path, camera light off on
   close), PWA install, live polling on venue Wi-Fi, host console
   gate/rotation/clear/kickoff flows, radar motion (upright icons, distinct
   ring speeds, smooth ring-change glide), yellow-dot incoming marker,
   hh:mm times + centered RU date label (§4 ICU note), three profile stat
   tiles, outline-style leave button, dialog header public bio with no
   phase/scenario chips and no «Restart the dialog».

---

*End of the v2.3 verification addendum sweep — worker 51b86c08, 2026-11-18,
branch `feature/51b86c08-tz4-13-verify-v23` (tip `957af53`).*
