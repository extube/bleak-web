# bleak-web v2.1 — Verification sweep (TZ3-08, verification-only)

Worker instance `ca16ac6c` · 2026-11-17 · branch
`feature/ca16ac6c-tz3-08-verify-v21` (tip = post-wave-2 `dev` `c180309`,
all of TZ3-01…TZ3-07 merged). This sweep verifies the seven owner change
requests of Concept §7.1 (v2.1 UI-polish round, DESIGN §4.8 amendments) are
delivered on `dev`. It adds **no product code and no test files** — one-shot
source greps, landed-code reads and targeted spot-check runs recorded here,
per the verification-only constraint of the card.

Method legend: **S** = source inspection / one-shot grep in this sweep,
**T** = merged automated test (file — title), **R** = targeted spot-run
executed first-hand in this session.

---

## 1. Gate record (TZ §8.8 discipline — full gates are wave-CI's job)

| Check | Result | Source |
| --- | --- | --- |
| Full `make test` re-run by this sweep | **not run** (full gates are run BY the process per the card) | this session |
| Targeted spot-runs (8 named suites, first-hand) | **green — 116 tests / 8 files** (bubble-contrast + avatar + chat-clear-guard = 31; radar-placement + room-radar + i18n = 54; profile-page + join-flow = 31) | `npm run test -w @bleak/web -- <files>` ×3, all passing (§3) |
| Wave-CI on `dev` after wave 2 (tasks 26–28: TZ3-03/05/06) | **green — lint clean, 505 tests, build 0 errors** | process log `docs/logs/e5057764.log` 2026-11-17T20:38:57Z («wave 2 closed … wave CI green (505 tests)») |
| Wave-CI on `dev` after wave 1 (tasks 22–25: TZ3-01/02/04/07) | green — lint clean, 488 tests, build 0 errors | `docs/logs/e5057764.log` 2026-11-17T20:06:23Z |
| Owning tasks P1–P7 | **22, 23, 24, 25, 26, 27, 28 — all `done`** (CI-gated closure) | `task.py list` at sweep time |

The process re-runs the full three-gate CI on `dev` per wave; the 505-test
green wave-CI is the authoritative gate for this round. **No test was added
or modified by this sweep.**

---

## 2. Per-AC checklist — P1–P7

### P1 — "bleak-web" title removal (task 22, Concept §7.1.1) — PASS

| Check | Result | Evidence |
| --- | --- | --- |
| No visible "bleak-web" title on the join form / main page | PASS S | one-shot grep `bleak-web` over `apps/web/src`: zero hits in `routes/+page.svelte`, the join components, or any heading element; the page renders `join.*` content titles only |
| Document titles are route-neutral (no app-name title anywhere) | PASS S | `<title>` grep: every route title is an i18n key — `/` → `join.title` («Войти на событие» / "Join the event"), `/room` → `room.title`, `/chats` + `/chats/[address]` → `chats.title` (`routes/+layout.svelte:24`, `routes/room/+page.svelte:252`, `routes/chats/{,+page.svelte:102,[address]/+page.svelte:353}`) |
| Out of scope: /host document-title suffix | recorded | `routes/host/+page.svelte:462` keeps `<title>{title} — bleak-web</title>` — explicitly out of scope per the TZ3-01 card (card 22); not a visible in-UI title |
| Other "bleak-web" strings are non-titles | recorded | remaining grep hits: SVG-part doc comments, tokens/base.css header comments, `scan.invalid_qr` copy («Это не QR-код bleak-web.» — a scan-error message, not a title), PWA manifest name (not in-page). None is a visible UI title |

### P2 — Bright chat/avatar color coding (task 23, Concept §7.1.2) — PASS

| Check | Result | Evidence |
| --- | --- | --- |
| tokens.css carries the 4 code hues + bubble tints + danger token | PASS S/T | `tokens.css:32,39-49`: `--color-danger: #c53030`; `--color-code-{yellow #fedc5c, orange #ffa24a, blue #63a8ff, violet #b58cff}`; `--color-bubble-<hue> = color-mix(in srgb, <hue> 18%, var(--color-surface))` — pinned by `bubble-contrast.test.ts` "the four code hues match the documented palette values" + "every bubble tint is the documented 18% color-mix over --color-surface" |
| Assignment rule `fnv1a(address) % 4` | PASS T | `avatar.test.ts` "codeHue — chat color assignment": "is the exact fnv1a(address) % 4 rule over the documented hue order", "the two sides of a chat get their own hues (mine is NOT fixed yellow)" |
| MessageBubble color-codes BOTH mine and theirs | PASS S | `MessageBubble.svelte:33` — `codeHue(mine ? myAddress : message.from)`; hue class sets `--color-bubble-<hue>` background for every bubble (`.bubble.code-*` rules, lines 75–86) overriding the mine/theirs surface defaults |
| PixelAvatar art uses vivid tokens | PASS S/T | `PixelAvatar.svelte:53-72` — all art palettes reference `--color-art-*` tokens; `tokens.css:56-69` declares the vivid register (skins, 4 code hues + platinum hair, dark shade backdrops); `bubble-contrast.test.ts` "avatar-art tokens exist" pins all 14 declarations |
| AA tests green (bubble-contrast, danger contrast) | PASS T/R | `bubble-contrast.test.ts` AA suite ("--color-text on every bubble tint ≥4.5:1", measured 10.62–12.39:1 per the worker log `dac03d93`); danger AA pinned in `profile-page.test.ts` "the exit button uses the danger token with light text, AA ≥4.5:1 on it" (numeric check). Both files green in the spot-run |
| Charcoal base + yellow-accent discipline unchanged elsewhere | PASS S | tints are derived `color-mix` tokens only (no raw hex in components — `sweep.test.ts` "no .svelte file contains a raw color literal" stays green via wave-CI); interactive elements outside bubbles/art still use `--color-accent` |

### P3 — Avatar 1px backdrop-colored padding (task 26, Concept §7.1.3) — PASS

| Check | Result | Evidence |
| --- | --- | --- |
| 1px padding in the backdrop color on all sides | PASS S/T | `PixelAvatar.svelte:147-153` — `.frame { box-sizing: border-box; padding: 1px }` with `style:background={backdropColor}` (the same token string that fills the backdrop part, line 104); svg renders `size − 2` so the art shrinks, not the box |
| Outer box unchanged at every rendered size | PASS T | `avatar.test.ts` "PixelAvatar — backdrop padding": "pads the art by 1px per side at every rendered size, keeping the outer box the declared size", "the padding color is the SAME token that fills the art backdrop", "own persona pads in the accent; the ghost fallback pads in the elevated surface", "the ghost fallback keeps its padded outer box unchanged too" — green in the spot-run |

### P4 — Attendee chat clear-history control removed (task 24, Concept §7.1.4) — PASS

| Check | Result | Evidence |
| --- | --- | --- |
| Attendee chat exposes NO clear-history control | PASS T/R | `chat-clear-guard.test.ts` — per-state DOM pin of every interactive control (`transcript` / `confirmOpen` / `chip` / `notFound` / `hostView` label sets) + `expectNoClear`: no «Очистить историю»/"Clear history" label, generic `/очист|clear/` sweep, no `clearChatHistory` call through `api` or `apiRaw` — green in the spot-run (all 5 state rows + scrolled-up chip) |
| Host drill-down clear stays present | PASS T/R | same suite, "host drill-down clear remains present and wired (unaffected by §7.1.4)": `MemberDrillDown` renders `host.drill.clear` behind its own confirm dialog; `clearChatHistory` API surface intact |

### P5 — Radar fixes (task 27, Concept §7.1.5) — PASS

| Check | Result | Evidence |
| --- | --- | --- |
| No name labels on other users' icons | PASS S/T | `RadarNode.svelte` renders avatar + markers only (no visible name node); accessible name carries the state (`room.node.*`); `room-radar.test.ts` "renders the Me chip…": `nodeButtons()` text content asserted `['', '', '']` (§4.8.3a comment in-test) |
| "You" chip keeps its name | PASS T | same test — `screen.getByText('Я')`; chip block (name + «N вокруг вас» + count) stays outside the orbit layer |
| Nodes ride the rings (orbit layer, no counter-rotation) | PASS S/T | `routes/room/+page.svelte:307-328` — one rigid `.nodes-orbit` layer with the same 90 s `orbit-spin` transform as the rings (§4.8.3c comment; «+N ещё» rides too); `room-radar.test.ts` asserts every node button is inside `.nodes-orbit` |
| `layoutRadarNodes` guarantees non-overlap + min center gap | PASS T | `radar.ts:59,50` — `MIN_CENTER_GAP_PX = 128` (increased chip exclusion, §4.8.3b; old inner ring sat ~45px from center on a 320px stage), `MIN_NODE_DIST_PX = 60`; `radar-placement.test.ts` `assertInvariants` checks center gap, pairwise ≥60px and vs the «+N» slot for every layout |
| Phone-size tests green | PASS T/R | `radar-placement.test.ts` parametrized stages 320×480 (smallest phone) → 768×1024 × 14 nodes × mixed states: "guarantees center gap, no overlap and on-canvas at every stage size", "worst case: 14 same-ring (outer) nodes still never overlap at 320×480"; rings scaled up (`RING_FRACTIONS` [0.56, 0.7, 0.84] — "inner ring clears the enlarged 'you'-chip exclusion zone"). Suite green in the spot-run |

### P6 — Profile settings block (task 28, Concept §7.1.6) — PASS

| Check | Result | Evidence |
| --- | --- | --- |
| Settings block with heading, RU + EN | PASS S/T/R | `routes/profile/+page.svelte:434-464` — `<section class="settings">` with `<h2 class="settings-title">`; keys `profile.settings.title` «Настройки» / "Settings" (`i18n/ru.ts:176`, `i18n/en.ts:175`); `profile-page.test.ts` "the settings rows render under a titled settings heading (RU + EN)" — green in the spot-run |
| Token regeneration in the block | PASS S/T | block button `profile.rotate.row` «Сгенерировать новый ключ доступа» opens the `ConfirmDialog` (other-device lockout copy) → `rotateUserToken` (`+page.svelte:440-457,497-503,309-341`); pinned by `profile-page.test.ts` v2 rotation tests (identity + vault in place) |
| Locale switch in the block | PASS S | `<LocaleControl />` inside the block (`+page.svelte:437-439`); app-wide persistence pinned by existing `profile-page.test.ts` / `i18n.test.ts` |
| Exit-room rendered in red (`--color-danger`) with confirmation dialog | PASS S/T/R | `.leave` button wired to `var(--color-danger)` + light `--color-text` (`+page.svelte:458-460,630-633`); `profile-page.test.ts` "the exit button uses the danger token with light text, AA ≥4.5:1 on it" (numeric 4.80:1) + "the exit-room confirmation question stays wired (ConfirmDialog + confirm_body)" (no DELETE before confirm) — green in the spot-run |

### P7 — Import persona: no room address on the row (task 25, Concept §7.1.7) — PASS

| Check | Result | Evidence |
| --- | --- | --- |
| Import row shows no room address in RU/EN | PASS S/T/R | `VaultList.svelte:61-68` — row renders name + `join.import.saved_at` relative time only; the key is «Сохранено {date}» / 'Saved {date}' in both dictionaries (no `{room}` interpolation); `join-flow.test.ts` "(AC 11)" asserts `queryByText(/комната/)` is null and «Сохранено» renders — green in the spot-run |

---

## 3. Spot-run record (first-hand, this session)

```
npm run test -w @bleak/web -- tests/bubble-contrast.test.ts tests/avatar.test.ts tests/chat-clear-guard.test.ts
  → Test Files 3 passed (3) · Tests 31 passed (31)
npm run test -w @bleak/web -- tests/radar-placement.test.ts tests/room-radar.test.ts tests/i18n.test.ts
  → Test Files 3 passed (3) · Tests 54 passed (54)
npm run test -w @bleak/web -- tests/profile-page.test.ts tests/join-flow.test.ts
  → Test Files 2 passed (2) · Tests 31 passed (31)
```

All 8 card-named suites: **116 tests green, 0 failures, ~6 s total**. RU/EN
parity stays pinned by `i18n.test.ts` ("ru and en have exactly the same
keys", "every entry is a non-empty string in both languages") — the v2.1 keys
(`profile.settings.title`, `profile.rotate.*`, `join.import.saved_at`,
`room.node.*`, bubble/copy keys) live in both dictionaries.

---

## 4. Findings

**Verdict: P1–P7 — 7/7 PASS, 0 FAIL.** No product defect found; no fix-up
performed (verification-only constraint).

| # | Severity | Finding | Recommendation |
| --- | --- | --- | --- |
| F1 | low (doc-only) | **`--color-danger` hex: code delivers `#c53030`, DESIGN §4.8.4 text lists `#e05252`.** The delivered value passes the AA requirement with `--color-text` (#f0f0f0): 4.80:1 (verified numerically in `profile-page.test.ts`, green). The listed `#e05252` would compute ≈3.3:1 — it FAILS the same AA rule the section itself states. The code/test deviation is therefore correctness-driven (Concept §7.1.6 requires only "red"); the test comment calls #c53030 "the DESIGN §4.8.4 card value", so the DESIGN hex line is stale. | Architect amend: DESIGN §4.8.4 hex `#e05252` → `#c53030` (one-line doc edit on a doc branch; no product code involved). |
| F2 | none (informational) | Residual visible "bleak-web" strings that are NOT titles: `scan.invalid_qr` copy («Это не QR-код bleak-web.»), PWA manifest name, code comments. The /host document title suffix is out of scope per the TZ3-01 card. | None — recorded for the record. |

---

## 5. Pre-event manual smoke note (owner, running app)

Carried from v1/v2 sweeps plus the three v2.1-specific eyeball checks. The
automated suites pin the logic; these need a real phone:

1. **v2.1 — bubble/avatar color legibility on a real phone:** open a chat
   with several participants — each side's bubble should carry a clearly
   different tint (yellow/orange/blue/violet, dark tints, not garish), text
   crisp on the phone screen (AA is verified numerically, but confirm the
   *perceived* legibility on an OLED panel at outdoor brightness too); the
   pixel avatars read as vivid (colored hair/backdrops) against the
   charcoal cards.
2. **v2.1 — radar spin at phone width (320–390px):** icons ride the rings
   smoothly (90 s rotation), never overlap each other, never come close to
   the static «Я» chip, no name labels under other icons, and the tap targets
   stay hittable while spinning; check the «+N ещё» counter rides cleanly if
   >14 attendees.
3. **v2.1 — profile settings block:** «Настройки» heading groups locale
   switch, «Сгенерировать новый ключ доступа» (confirm → other-device
   lockout copy) and the red «Выйти из комнаты» with its confirmation
   question; after confirming exit you land back on `/` signed out.
4. **v2.1 — join/import screens:** the device-vault import row shows only
   persona name + «Сохранено {date}» — no room address, nothing overflowing
   the card contour in RU or EN.
5. **Carried pre-event (unchanged):** HTTPS secure-context gate (camera +
   `crypto.subtle`), scanner real-device smoke (iOS Safari + Android Chrome:
   permission states, decode path, camera light off on close), PWA install,
   live polling on venue Wi-Fi, host console gate/rotation flows — full
   checklist in `docs/verification-v2.md` §8.
