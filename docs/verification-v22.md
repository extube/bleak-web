# bleak-web v2.2 — Verification sweep (TZ4-07, verification-only)

Worker instance `fbadb5d2` · 2026-11-18 · branch
`feature/fbadb5d2-tz4-07-verify-v22` (tip = dev `4238392` — the wave-C
landing of `feature/96f1040d-tz4-06-chats-bright-list`; all of
TZ4-01…TZ4-06 merged). This sweep verifies the **twelve owner change
requests of Concept §8.1** (v2.2 UI-polish round #2, DESIGN §4.9
amendments) are delivered on `dev`. It adds **no product code and no
test files** — one-shot source greps, landed-code reads and targeted
spot-check runs recorded here, per the verification-only constraint of
the card.

Method legend: **S** = source inspection / one-shot grep in this sweep,
**T** = merged automated test (file — title), **R** = targeted spot-run
executed first-hand in this session.

---

## 1. Gate record (TZ §8.8 discipline — full gates are wave-CI's job)

| Check | Result | Source |
| --- | --- | --- |
| Full `make test` re-run by this sweep | **not run** (full gates are run BY the process per the card) | this session |
| Final wave-CI on `dev` (wave C close, 2026-11-18T08:47:54Z, tasks 34–35: TZ4-05/06) | **green — lint clean, 525 tests, build 0 errors** | process log `docs/logs/e5057764.log` 2026-11-18T08:47:54Z («wave C closed … wave CI green (525 tests)») |
| Wave-CI on `dev` after wave B (2026-11-18T08:30:39Z, tasks 32–33: TZ4-03/04) | green — 517 tests | `docs/logs/e5057764.log` 2026-11-18T08:30:39Z |
| Wave-CI on `dev` after wave A (2026-11-18T08:13:53Z, tasks 30–31: TZ4-01/02) | green — 511 tests | `docs/logs/e5057764.log` 2026-11-18T08:13:53Z |
| Targeted spot-runs (10 card-anchored suites, first-hand) | **green — 126 tests / 10 files** (room-radar + radar-placement = 20; profile-settings + profile-page = 25; chats-page + transcript-page + chats-view = 44; chat-clear-guard + bubble-contrast + i18n + member-drilldown = 37) | `npm run test -w @bleak/web -- <files>` ×4, all passing (§3) |
| Owning tasks T1–T6 | **30, 31, 32, 33, 34, 35 — all `done`** (CI-gated closure) | `task.py list` at sweep time |

The process re-runs the full three-gate CI on `dev` per wave; the
525-test green wave-CI is the authoritative gate for this round. **No
test was added or modified by this sweep.**

---

## 2. Per-item checklist — Concept §8.1 items 1–12

### Item 1 — Radar upright riding (task 30, §8.1.1, DESIGN §4.9.1) — PASS

| Check | Result | Evidence |
| --- | --- | --- |
| Icons travel with the rings but never spin on their own axis | PASS S/T/R | `RadarNode.svelte:106-114` — `.avatar-box` (node content) runs `animation: orbit-counter var(--orbit-duration, 90s) linear infinite` with `animation-delay: var(--orbit-delay, 0s)`, inside the parent `.orbit-unit` spinning `orbit-spin 360°` with the SAME inherited vars (`room/+page.svelte:609-615`); `@keyframes orbit-counter` rotates −360° (`RadarNode.svelte:152-158`) — the two rotations cancel exactly, so icon orientation stays upright while the orbit position rides |
| Counter-rotation is phase-locked with the orbit layer | PASS S | both animations start at mount and share the duration/delay vars set by the page's `.orbit-unit` (`style:--orbit-duration` / `style:--orbit-delay`, `room/+page.svelte:401-402`) — phase-lock comment `RadarNode.svelte:106-110` |
| Tests pin upright riding | PASS T/R | `room-radar.test.ts` — "node content counter-rotates so icons stay upright (§4.9.1)", "the «+N ещё» counter rides the outer-ring orbit and stays upright (§4.9.1/4.9.2)"; green in the spot-run |

### Item 2 — Per-ring speeds 60 s / 90 s / 20 s (task 30, §8.1.2, DESIGN §4.9.2) — PASS

| Check | Result | Evidence |
| --- | --- | --- |
| Owner's example speeds as constants: ring 1 faster (60 s), ring 2 slightly slower (90 s), ring 3 very fast (20 s) | PASS S/T/R | `lib/room/radar.ts:28-34` — `RING_ORBIT_DURATIONS_S: readonly [60, 90, 20]` ("ring 1 (inner, chat) fastest, ring 2 (middle, pending) a bit slower, ring 3 (outer, none-state) very fast — per the owner's example") |
| One rotating orbit layer per ring; ring lines share the speed | PASS S/T/R | page renders one `.orbit-unit` per node keyed by ring, duration from `RING_ORBIT_DURATIONS_S[ring]` (`room/+page.svelte:233-252,395-426`); `RadarRings.svelte:26-29` — ring `<g>` duration = `RING_ORBIT_DURATIONS_S[i]` (single source in radar.ts) |
| Phase-lock: units mounting later stay in their ring's rigid group | PASS S | negative `--orbit-delay` back-dates every unit's spin to the common epoch of the first successful tick (`room/+page.svelte:103-105,199-212` — `orbitDelayFor` memoized per key) |
| Tests pin distinct speeds | PASS T/R | `room-radar.test.ts` — "each node rides a per-ring orbit layer with a distinct duration (§4.9.2)", "the ring lines spin at their rings' distinct speeds (§4.9.2)"; green in the spot-run |

### Item 3 — Settings on `/profile/settings`; outline-style leave (task 32, §8.1.3, DESIGN §4.9.3) — PASS

| Check | Result | Evidence |
| --- | --- | --- |
| Settings block lives on the new `/profile/settings` route | PASS S/T/R | `routes/profile/settings/+page.svelte` (route file exists; heading `profile.settings.title`, locale row `LocaleControl` line 151, rotate row lines 153–167, leave button lines 171–176, both ConfirmDialogs lines 180–194); `/profile` links to it with a real `<a class="settings-row" href={resolve('/profile/settings')}>` (`routes/profile/+page.svelte:371-373`) |
| Leave button: red font + red border ONLY — no fill | PASS S/T/R | `.leave { border-color: var(--color-danger); color: var(--color-danger-text); }` on `background: transparent` (`profile/settings/+page.svelte:267-276`); tokens: `--color-danger: #c53030` (`tokens.css:35`), `--color-danger-text: #e05252` (`tokens.css:41`) — the exact roles the card names |
| Contrast roles recorded (border ≥3:1 non-text, font ≥4.5:1 AA) | PASS T/R | `profile-settings.test.ts` — "the exit button is red font + red border on a transparent background — NO filled red", "numeric contrast — font #e05252 on the surface ≥4.5:1 AA; border #c53030 on the surface ≥3:1 non-text" (the architect-consult option B roles, DESIGN §4.9.3); green in the spot-run |
| Old settings block removed from /profile | PASS T/R | `profile-page.test.ts` — "the leave/rotate rows are GONE from /profile; a settings nav link renders instead (RU + EN)" (also "settings relocation" describe block); green in the spot-run |

### Item 4 — Avatar-change button rounded, not circular (task 33, §8.1.4, DESIGN §4.9.4) — PASS

| Check | Result | Evidence |
| --- | --- | --- |
| The persona/avatar edit control is a rounded square (`--radius-md`) | PASS S/T/R | `ProfileBadge.svelte:199-201` — `.icon-button { border-radius: var(--radius-md); }` with the in-code comment "Concept §8.1.4: the persona/avatar edit control is no longer a full circle — a rounded square (--radius-md), consistent with the tiles" (the control is the identity-header edit button on the badge, applied to all three icon buttons of the card) |
| Test pins the radius | PASS T/R | `profile-page.test.ts` — "the persona/avatar edit control on the badge is a rounded square — not a full circle" (avatar-change-button-radius describe); green in the spot-run |

### Item 5 — Profile stats exactly 3: Sent / Added you / Chatting (task 33, §8.1.5, DESIGN §4.9.5) — PASS

| Check | Result | Evidence |
| --- | --- | --- |
| Exactly three tiles, renamed labels | PASS S/T/R | `ProfileBadge.svelte:139-145` — exactly three `<StatTile>`: `profile.stats.handshakes_label` / `profile.stats.added_label` / `profile.stats.dialogs_label`; values derived in the page from handshakes/chats (`routes/profile/+page.svelte:308-310`); `.stats { grid-template-columns: repeat(3, 1fr) }` (`ProfileBadge.svelte:300-304`) |
| RU labels: «Отправлено / Добавили вас / В диалогах» | PASS S | `i18n/ru.ts:167-169` (with the §8.1.5 comment block) |
| EN labels: Sent / Added you / Chatting | PASS S | `i18n/en.ts:166-168` |
| Old labels gone | PASS S | grep «Хендшейк»/«Диалоги» over `src`: no stat-label use remains — old stat labels retired; leftover hits are handshake-action copy (`hs.sent`, `hs.waiting`) and nav/chats titles, all untouched scopes |
| Tests pin the three tiles + parity | PASS T/R | `profile-page.test.ts` — "renders EXACTLY three stat tiles — Sent / Added you / Chatting — with the renamed RU labels", "EN parity: the same three tiles read Sent / Added you / Chatting" (profile-stats describe); green in the spot-run |

### Item 6 — Private-bio heading visually distinct (task 34, §8.1.6, DESIGN §4.9.6) — PASS

| Check | Result | Evidence |
| --- | --- | --- |
| «Only your agent sees this» heading: pixel font, uppercase, muted — distinct from the private content | PASS S/T/R | `ProfileBadge.svelte:102-107` — dedicated `<p class="private-bio-heading">` between `profile.badge.for_agent` and the private bio text; styles `ProfileBadge.svelte:259-267` — `font-family: var(--font-pixel); font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: var(--color-text-muted)` (vs the 14px Inter `.bio-text`, lines 249–255) |
| Test pins the distinct styling | PASS T/R | `profile-page.test.ts` — "the «only your agent sees this» heading is styled DISTINCTLY from the private content below it" (private-bio-heading describe) + `i18n.test.ts` — "the private-bio caption key is present in both dictionaries (Concept §8.1.6)"; green in the spot-run |

### Item 7 — Chats-list bright; dialog theirs bright / mine muted (task 35, §8.1.7, DESIGN §4.9.7) — PASS

| Check | Result | Evidence |
| --- | --- | --- |
| Every chats-list card gets the bright §7.1.2 counterpart-hue background | PASS S/T/R | `ChatCard.svelte:42-46` — `hueClass = code-${codeHue(counterpartAddress)}`; `ChatCard.svelte:99-110` — `.chat-card.code-{yellow,orange,blue,violet} { background: var(--color-bubble-<hue>) }` declared after the base (hue wins); AA bumps for secondary text/chips on the tint (`ChatCard.svelte:111-131`) |
| Dialog: interlocutor's bubbles keep the bright background | PASS S/T/R | `MessageBubble.svelte:36` — `hueClass` computed for theirs only (`mine ? '' : code-${codeHue(message.from)}`); hue classes override the theirs surface (`MessageBubble.svelte:80-91`) |
| Dialog: own messages muted (`--color-surface-elevated`), AA 12.35:1 | PASS S/T/R | `MessageBubble.svelte:71-73` — `.bubble.mine { background: var(--color-surface-elevated); }` ("no `code-*` class is emitted for own bubbles at all"); `bubble-contrast.test.ts` — "--color-surface-elevated stays the neutral muted surface (--color-text on it ≈12.35:1)" — the card's exact 12.35:1 figure |
| Tests pin the list + dialog colors | PASS T/R | `chats-page.test.ts` — "every card wears the bright §4.9.7 color coding: the counterpart hue as its background class"; `transcript-page.test.ts` — "their bubbles keep the bright code-hue background; own bubbles are muted (no code hue)" (v2.2 chat colors describe); both green in the spot-run |

### Item 8 — Times hh:mm + centered locale date label (task 34, §8.1.8, DESIGN §4.9.8) — PASS

| Check | Result | Evidence |
| --- | --- | --- |
| Message time = absolute 24-hour hh:mm (Intl, `hourCycle: 'h23'`) | PASS S/T/R | `lib/chats/view.ts:107-113` — `messageTime` with `hour: '2-digit', minute: '2-digit', hourCycle: 'h23'` (relative «2 мин» wording retired); used by the dialog route per bubble (`routes/chats/[address]/+page.svelte:322-325,427`) |
| Centered locale date label (day + month long) atop the transcript | PASS S/T/R | `view.ts:120-125` — `chatDateLabel` with `day: 'numeric', month: 'long'`; rendered as `.date-label { text-align: center }` above the first message (`routes/chats/[address]/+page.svelte:414-418,582-587`) |
| Tests pin both formatters | PASS T/R | `chats-view.test.ts` — "message time is absolute 24-hour hh:mm via Intl with the active locale", "date label is a locale day+month label (day-first: «8 сентября» / \"8 September\")"; `transcript-page.test.ts` — "message times render as absolute 24-hour hh:mm (active locale), not relative", "a locale day+month date label sits centered above the first message; none while warming up"; all green in the spot-run |

### Item 9 — No «Restart the dialog» in the attendee dialog; host kickoff intact (task 34, §8.1.9, DESIGN §4.9.9) — PASS

| Check | Result | Evidence |
| --- | --- | --- |
| Kickoff button + confirm removed from the dialog view; footer = ContactStub only | PASS S/T/R | `routes/chats/[address]/+page.svelte:443-449` — `<footer class="footer"><ContactStub /></footer>` with the in-code note "the kickoff button left the dialog view (Concept §8.1.9)"; grep `kickoff|restart` over the dialog route: only doc comments — no kickoff element, no `chat.kickoff` invocation |
| Retired keys gone from BOTH dictionaries; confirm copy stays for the host | PASS S/T | `i18n/ru.ts:129-134` / `i18n/en.ts:128-133` — comment "§8.1.9: kickoff left the attendee dialog view; the confirm copy stays (host drill-down kickoff uses it)"; `i18n.test.ts` — "kickoff button/speaker keys are retired from BOTH dictionaries; the confirm copy stays (Concept §8.1.9)" |
| Host drill-down kickoff still present and wired | PASS S/T/R | `MemberDrillDown.svelte:59-74,175-179,204-214` — kickoff row + `ConfirmDialog` reusing the `chat.kickoff.confirm_*` copy (`host.drill.kickoff` label); `member-drilldown.test.ts` — "renders dialog rows linking to /chats/{address} with clear + restart actions"; green in the spot-run |
| Tests pin the removal | PASS T/R | `transcript-page.test.ts` — "the kickoff button and its confirm are GONE from the dialog view (§8.1.9)", "the transcript UI contains no input/textarea/send control; only the back control (kickoff left, §8.1.9)"; `chat-clear-guard.test.ts` (kickoff-free allowed-control pins per state); green in the spot-run |

### Item 10 — No phase/scenario chips in the dialog header; public bio instead (task 34, §8.1.10, DESIGN §4.9.10) — PASS

| Check | Result | Evidence |
| --- | --- | --- |
| No theme (phase/scenario) display in the dialog header | PASS S/T | `routes/chats/[address]/+page.svelte:346-375` — header shows avatar + name + the `chat.language` chip (+ host-view chip in the §10.3 fallback only); no phase/scenario chip anywhere (grep `phase|scenario` over the route: doc comments only — the aria label `chats.card.aria` lives on the /chats list card, which is out of this item's scope) |
| Interlocutor's public_bio shown when present | PASS S/T/R | `routes/chats/[address]/+page.svelte:80-89` — `publicBio` derived from the counterpart record (empty bio → nothing extra renders); `routes/chats/[address]/+page.svelte:369-373` — `<p class="public-bio">` with the §8.1.10 comment |
| Tests pin the header swap | PASS T/R | `transcript-page.test.ts` — "the header shows the counterpart public bio when present and nothing extra when absent"; green in the spot-run |

### Item 11 — Incoming marker = small yellow dot top-right, no ring (task 31, §8.1.11, DESIGN §4.9.11) — PASS

| Check | Result | Evidence |
| --- | --- | --- |
| The former yellow ring is replaced by a small dot at the icon's top-right | PASS S/T/R | `RadarNode.svelte:130-141` — `.in-dot { top: -2px; right: -2px; width: 8px; height: 8px; border-radius: 50%; background: var(--color-accent); }` (accent = warm yellow, `tokens.css:17`); rendered inside the counter-rotating `.avatar-box` so it rides upright (`RadarNode.svelte:65-67`); grep `in-ring` over `src`: zero hits — the ring element no longer exists |
| Same visual language as the outgoing dot (distinguished by the corner offset) | PASS S | `.out-dot` sits inside the same top-right corner (`RadarNode.svelte:116-124`); `.in-dot`'s −2px offset documented at `RadarNode.svelte:130-136` |
| Tests pin the marker | PASS T/R | `room-radar.test.ts` — "incoming pending: handshake-back sends the reverse direction; success offers Open dialog (AC 6)" (asserts `.in-dot` present, `.in-ring` absent, `:417-422`); "renders the Me chip…" row asserts no incoming dot for `none`-state nodes (`:181-185`); green in the spot-run |

### Item 12 — Ring-level movement transitions smoothly (task 30, §8.1.12, DESIGN §4.9.12) — PASS

| Check | Result | Evidence |
| --- | --- | --- |
| 700 ms ease transition on left/top; element kept across ring-level changes | PASS S/T/R | `RadarNode.svelte:96` — `transition: left 700ms ease, top 700ms ease;` (comment §4.9.12, lines 92–95); keyed-stable node elements — the `{#each orbitItems as item (item.key)}` keeps the button across a ring change (`room/+page.svelte:395-412`), so the placement swap glides |
| Tests pin the glide | PASS T/R | `room-radar.test.ts` — "a ring-level change keeps the node element and glides via CSS transition (§4.9.12)"; "unchanged data between polls does not move nodes (deterministic, no jitter)" (deterministic layout ⇒ no accidental transitions); green in the spot-run |

---

## 3. Spot-run record (first-hand, this session)

```
npm run test -w @bleak/web -- tests/room-radar.test.ts tests/radar-placement.test.ts
  → Test Files 2 passed (2) · Tests 20 passed (20)
npm run test -w @bleak/web -- tests/profile-settings.test.ts tests/profile-page.test.ts
  → Test Files 2 passed (2) · Tests 25 passed (25)
npm run test -w @bleak/web -- tests/chats-page.test.ts tests/transcript-page.test.ts tests/chats-view.test.ts
  → Test Files 3 passed (3) · Tests 44 passed (44)
npm run test -w @bleak/web -- tests/chat-clear-guard.test.ts tests/bubble-contrast.test.ts
  → bundled with i18n + member-drilldown below · Tests 37 passed across 4 files
npm run test -w @bleak/web -- tests/chat-clear-guard.test.ts tests/bubble-contrast.test.ts
                                        tests/i18n.test.ts tests/member-drilldown.test.ts
  → Test Files 4 passed (4) · Tests 37 passed (37)
```

All 10 card-anchored suites: **126 tests green, 0 failures**. RU/EN parity
stays pinned by `i18n.test.ts` — the v2.2 keys
(`profile.stats.*`, `profile.private_bio.caption`, `--color-danger-text`
token, retired `chat.kickoff`/`chat.kickoff.speaker`) are all verified in
both dictionaries.

---

## 4. Known note — restricted ICU in the test Node (from task 34, recorded per the card)

This Node build has **restricted ICU**: the `ru` locale is not available
to the test runner, so `Intl.DateTimeFormat('ru-RU', …)` falls back
inside tests. The helpers (`messageTime` / `chatDateLabel`,
`lib/chats/view.ts:107-125`) are pinned in `chats-view.test.ts:184-206`
to **the same Intl formatter they use with the active-locale tag**
(self-consistency, not literal «8 сентября» glyphs). **Browsers ship
full ICU**, so RU runtime output is correct in the real app.

**Pre-event manual check (owner, real device):** open a dialog in RU —
the date label at the top should read «8 сентября» (day + month long)
and message times «14:05» (hh:mm, no «мин», no AM/PM). If the device
renders differently, that is an ICU/device build issue, not app logic.

## 5. Findings

**Verdict: items 1–12 — 12/12 PASS, 0 FAIL.** No product defect found;
no fix-up performed (verification-only constraint).

| # | Severity | Finding | Recommendation |
| --- | --- | --- | --- |
| F1 | none (doc-only) | `StatTile.svelte:8` doc comment still uses the example «"Хендшейков: 7"» for the accessible-name format — the tiles now read «Отправлено/Добавили вас/В диалогах» (§8.1.5). The accessible name itself is generic (`${label}: ${value}`), so behavior is correct. | Cosmetic doc-comment fixup whenever that file is next touched; no action required this round. |
| F2 | none (informational) | The dialog header keeps the `chat.language` chip next to the name (`routes/chats/[address]/+page.svelte:360-362`). §8.1.10 removes only the phase/scenario (theme) display — language was never part of that request, and the profile badge renders the language meta the same way. | None — recorded for the record. |

## 6. Pre-event manual smoke notes (owner, running app)

Carried from v1/v2/v2.1 sweeps plus the v2.2-specific eyeball checks.
The automated suites pin the logic; these need a real phone:

1. **v2.2 — radar motion at a real phone:** the three rings rotate at
   visually DISTINCT speeds (inner 60 s, middle 90 s, outer 20 s — the
   outer ring should read clearly faster), icons stay upright while
   riding (avatars never tilt/flip), tapping a node while spinning works,
   and a relationship change (send/accept a handshake) glides the icon
   smoothly to its new ring (~0.7 s), no jump-cut.
2. **v2.2 — "added you" marker:** a pending incoming handshake shows as
   a small yellow dot at the avatar's top-right — NO yellow ring, no
   blur; check it's distinguishable from the outgoing dot at arm's length
   on the phone (both 8 px; incoming pokes slightly outside the corner).
3. **v2.2 — settings route navigation:** /profile shows a «Настройки»
   row; tapping opens the sub-page (back control, no tab bar) with the
   locale switch, «Сгенерировать новый ключ доступа» (confirm →
   other-device lockout copy) and «Выйти из комнаты» drawn as red text +
   red outline on transparent — no filled red block; confirming exit
   lands on `/` signed out.
4. **v2.2 — profile stats + badge:** exactly three tiles — «Отправлено»,
   «Добавили вас», «В диалогах» — nothing else; the badge's
   avatar-change control is a rounded square (not a circle); the
   «видно только вашему агенту» caption is pixel-font, uppercase and
   muted, visually distinct from the private text below.
5. **v2.2 — chats list + dialog colors:** every list card carries a
   clearly different bright hue background (counterpart's code hue), text
   crisp on the tint; in the dialog the interlocutor's bubbles stay
   bright-hued and own bubbles are muted charcoal — confirm perceived
   legibility on an OLED panel at outdoor brightness.
6. **v2.2 — dialog chrome + RU date/time:** dialog header shows the
   counterpart's public bio under the name (no phase/scenario theme);
   no «Restart the dialog» button anywhere in the attendee dialog;
   centered date label «8 сентября» at the top of the transcript and
   hh:mm times per bubble (the §4 ICU note — RU glyphs are browser-ICU
   backed; this is the manual confirmation).
7. **Carried pre-event (unchanged):** HTTPS secure-context gate (camera
   + `crypto.subtle`), scanner real-device smoke (iOS Safari + Android
   Chrome: permission states, decode path, camera light off on close),
   PWA install, live polling on venue Wi-Fi, host console
   gate/rotation/clear/kickoff flows — full checklist in
   `docs/verification-v2.md` §8, v2.1 additions in
   `docs/verification-v21.md` §5.

---

*End of the v2.2 verification sweep — worker fbadb5d2, 2026-11-18,
branch `feature/fbadb5d2-tz4-07-verify-v22` (tip `4238392`).*
