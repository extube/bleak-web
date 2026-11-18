# bleak-web v2.4 — Verification sweep (TZ4-20, verification-only)

Worker instance `98375dd3` · 2026-11-18 · branch
`feature/98375dd3-tz4-20-verify-v24` (tip = dev `6f6cea0` — the landing of
`feature/fd9a2270-tz4-19-chat-list-preview-status`; the whole §10 delta wave
TZ4-14…TZ4-19 merged, tasks 43–48 status `merged`). This sweep verifies the
**eight refinements of Concept §10.1** (v2.4 addendum, DESIGN §4.11
amendments) are delivered on `dev`. It adds **no product code and no test
files** — one-shot source greps, landed-code reads and targeted spot-check
runs recorded here, per the verification-only constraint of the card.

Method legend: **S** = source inspection / one-shot grep in this sweep,
**T** = merged automated test (file — title), **R** = targeted spot-run
executed first-hand in this session, **B** = read-only check against the
bleak-node contract (`/mount/bleak-node`, not edited).

---

## 1. Gate record (TZ §8.8 discipline — full gates are delta-wave-CI's job)

| Check | Result | Source |
| --- | --- | --- |
| Full `make test` re-run by this sweep | **not run** (the process runs the delta-wave CI after this landing) | this session |
| DELTA-WAVE CI: [pending — process fills] | | |
| Landing CI records for the v2.4 delta wave (tasks 43–48, one CI run per landing) | **all landed 2026-11-18** — 43 `a061969` (10:27:46Z); 44 `fe245e1` (10:38:16Z); 45 `9743fef` (10:47:26Z); 46 `4b682cc` (10:50:16Z); 47 `d197e59` (10:56:03Z); 48 `6f6cea0` (11:05:25Z) | dev log |
| Targeted spot-runs (10 card-anchored suites, first-hand) | **green — 186 tests / 11 files** (chats-page + last-message + chats-view = 46; profile-page + profile-settings + join-machine + join-flow + identity + tabbar + radar-placement + avatar = 140) | `npm run test -w @bleak/web -- <files>` ×2, all passing (§3) |
| Owning tasks of the 8 items | **43, 44, 45, 46, 47, 48 — all `merged`** (CI-gated closure follows the delta-wave CI) | `task.py list` at sweep time |

No test was added or modified by this sweep.

---

## 2. Per-item checklist — Concept §10.1 items 1–8

### Item 1 — Private-bio heading: smaller than content, sentence case, Inter + muted red kept (task 43, §10.1.3, DESIGN §4.11.3) — PASS

| Check | Result | Evidence |
| --- | --- | --- |
| Smaller than the content: heading 11px vs bio text 14px | PASS S/T/R | `ProfileBadge.svelte:206-213` — `.private-bio-heading { font-size: 11px }` (comment §10.1.3/§4.11.3 at 201–205); `.bio-text { font-size: 14px }` (`:194-200`); `profile-page.test.ts:309-343` — "the «only your agent sees this» heading is small, sentence case, and keeps the muted red" extracts BOTH blocks and asserts `headingSize < bioSize` numerically |
| Sentence case — no uppercase | PASS S/T/R | `ProfileBadge.svelte:211` — `text-transform: none`; the test asserts the block contains `text-transform: none` and NOT `uppercase` (`profile-page.test.ts:328-330`); companion in the persona editor: `PersonaEditor.svelte:126-133` — same 11px / `text-transform: none` block (comment §10.1.3 at 123–125), pinned by `profile-page.test.ts:345+` ("the persona editor caption carries the same small sentence-case treatment") |
| Inter (body face) kept — NOT the pixel font | PASS S/T/R | `ProfileBadge.svelte:208` + `PersonaEditor.svelte:128` — `font-family: var(--font-body)`; test asserts `var(--font-body)` present and `var(--font-pixel)` absent (`profile-page.test.ts:323-324`); `--font-body: 'Inter Variable', …` (`tokens.css:105`) |
| Muted red kept (not solid): `color-mix(in srgb, var(--color-danger-text) 70%, transparent)` | PASS S/T/R | `ProfileBadge.svelte:212` — the exact card expression, tokens only (test: `:325-327` — no raw hex, no `--color-text-muted`); `--color-danger-text: #e05252` (`tokens.css:42`); position above the private content still pinned (`profile-page.test.ts:338-342`) |

### Item 2 — Radar center gap smaller: 88px vs 128, arithmetic recorded, no-overlap intact (task 47, §10.1.2, DESIGN §4.11.2) — PASS

| Check | Result | Evidence |
| --- | --- | --- |
| `MIN_CENTER_GAP_PX = 88` (was 128 in v2.1) | PASS S/T/R | `lib/room/radar.ts:79` — `export const MIN_CENTER_GAP_PX = 88;` with the ARITHMETIC RECORDED in the doc-comment (`:66-78`): the chip's worst visible-content offset from the stage center — truncated name line end (name capped at 120px → half 60px, ≈10px off the line centerline) ≈ 61px — plus the node hit radius (26px), rounded up; the comment also records WHY 128 was retired (it cleared the chip block's empty corners: bounding half-diagonal ≈ 101px + 26px; at 88px a node hit disk still clears every opaque chip element — the 64px avatar circle and the name line — and can only graze the dithered corner padding) |
| The pinned constant test records the same arithmetic | PASS T/R | `radar-placement.test.ts:350-360` — "the cap constants stay intact" asserts `MIN_CENTER_GAP_PX` **= 88**, **< 128**, `MIN_NODE_DIST_PX ≥ 60`, with the arithmetic in the test's comment (`:352-356`) |
| Clamping uses the smaller edge (the gap is real, not just a constant) | PASS T/R | `radar-placement.test.ts:294-305` — "v2.4: a node clamped to the inner exclusion edge sits at the reduced 88px gap (§10.1.2)": `0xedge-4` on a 320×320 stage computes base = 0.56 × 160 × 0.94 ≈ 84.2px → clamped to exactly 88 (`point.radiusPx` + hypot asserted `toBeCloseTo(88, 6)`); the comment records that under the v2.1 value the same node sat 40px farther out |
| No-overlap rule stays | PASS S/T/R | `radar.ts:63-64` — `MIN_NODE_DIST_PX = 52 + 8` untouched; `assertInvariants` (`radar-placement.test.ts:215-243`) still asserts BOTH the reduced center gap (≥ 88, `:226`) AND node–node ≥ `MIN_NODE_DIST_PX` (`:240`) on every parametrized stage, including the 14-same-ring worst case (`:288-292`) — all green in the spot-run |

### Item 3 — Import = return to event: vault pick → stored-token validation → saveIdentity → /room, no re-creation (task 44, §10.1.1, DESIGN §4.11.1) — PASS

| Check | Result | Evidence |
| --- | --- | --- |
| The vault picker is the RETURN screen; lists ONLY `bleak.tokenVault` entries, never a server listing | PASS S/T/R | `lib/join.ts:13-20` (module contract: "the vault picker is the RETURN screen… NEVER `GET /api/room`"), `VaultList.svelte:1-10` + rows rendered from the passed `entries` prop (`:44-78`); `join-flow.test.ts:291-306` — "the picker lists ONLY bleak.tokenVault entries — no server room listing call (AC 11)": `getRoom`/`listRoomUsers`/`createRoomUser` all NOT called |
| Selecting a row validates the STORED token with the explicit-token read | PASS S/T/R | `join.ts:114-128` — `verifyVaultEntry(entry)` = `getRoomUser(room, address, { token: entry.token })` (doc-comment §10.1.1/§10.6); `JoinFlow.svelte:174`; `join-machine.test.ts:292-296` — the Bearer equals the vault entry's stored token; `join-flow.test.ts:308-320` — assertion `toHaveBeenCalledWith('0xoldroom', '0xold', { token: 'stored-vault-token' })` |
| Identity restore → /room, NO re-creation | PASS S/T/R | `JoinFlow.svelte:167-196` — after the validation read: `saveIdentity({…entry fields})` then `goto(resolve('/room'))` (comment "identity restore — NO re-creation", `:175-177`); `join-flow.test.ts:308-340` — identity + persisted `bleak.identity` equal the entry fields, `goto('/room')`, `createRoomUser` NOT called, vault length still 1 (no re-creation appended); the machine has no copy-flow step (`join.ts:255-261` events: `choose-return` only) |
| «Return / Вернуться» badge on each row | PASS S/T/R | `VaultList.svelte:32,65` — badge = `translate('join.import.return')`; `ru.ts:41 'join.import.return': 'Вернуться'`, `en.ts:40 'Return'`; row aria `ru.ts:44 'Вернуться к персоне {name}'`; `join-flow.test.ts:298-300` asserts the badge text + aria-label; Step-1 title `ru.ts:39 'Вернуться на событие'` |
| Copy-flow UI removed | PASS S | grep over `apps/web/src`: `ImportRooms`/`ImportUsers` have **zero render/import references** (both files are the deliberate TZ2-06 tombstones — emptied, awaiting merge-processing removal; no runtime cost); no helper-copy persona call exists anywhere in the join flow (grep `copy persona`/`import.rooms`: zero hits); `join.import.return` is the only import-badge copy |
| Vault storage writes intact | PASS S/T/R | creation still writes identity + vault ONLY after a 2xx: `JoinFlow.svelte:206-217` (`appendVaultEntry` with room/user/token/name/savedAt); `token-vault.test.ts` suite green in the card anchor set (§3 run 2); the return flow never mutates/removes the entry (append-only, `join.ts:119-121`) |
| Dead/stale handling | PASS S/T/R | `join.ts:181-187` — `vaultErrorOf`: 404/401/403 (or any other ApiError) → `dead` (server text surfaced), NetworkError → banner; `VaultList.svelte:68-75` — the dead-note `role="alert"` ON the row, entry stays listed; `JoinFlow.svelte:190-192` — no enter on dead; `join-flow.test.ts:342-377` — 404 AND 401 variants: dead-note copy + server text, no identity, no `goto`, no creation, vault length unchanged; 401 also trips the global §2.8 gate underneath (`join.ts:176-179`) |

### Item 4 — Profile read-only display; all persona editing in /profile/settings (task 45, §10.1.4, DESIGN §4.11.4) — PASS

| Check | Result | Evidence |
| --- | --- | --- |
| /profile has NO edit affordances | PASS S/T/R | `routes/profile/+page.svelte:24-27` (header comment "READ-ONLY display"); the badge is pure display: `ProfileBadge.svelte:10-13` + no edit callbacks/icons (source-level test `profile-page.test.ts:236-247`: no `oneditpersona`/`oneditgreeting`/`oneditinterests`, no `PixelIcon name="edit"`, no `add-chip`); DOM-level test `:218-234` — zero persona/greeting/interests edit buttons rendered, display content intact |
| /profile/settings carries the Persona/Персона section with the three editor rows | PASS S/T/R | `routes/profile/settings/+page.svelte:58-59` (View state), `:303-319` — `<section class="persona" aria-label=…>` + `<h2 class="section-title">` + the three rows (persona / greeting / interests), one editor at a time via the inline-swap pattern (`:351-378`); `profile-settings.test.ts:145-158` — "renders the persona section with the three editor rows (RU + EN)"; section label = `profile.settings.persona` — **the one new parity key**: `ru.ts:181 'Персона'`, `en.ts:180 'Persona'` (present in both dictionaries; the i18n binding checklist keeps CI green) |
| Editors moved verbatim (logic intact) | PASS S/T/R | `settings/+page.svelte:1-31` (doc-comment "the PersonaEditor (name/public/private bio), the GreetingEditor and the InterestsEditor moved wholesale from /profile with their logic intact"); handlers are the same patterns (savePersona = `updateRoomUser` with ALL THREE fields `:116-136`; greeting fetch/save/regenerate `:148-202`); `profile-settings.test.ts` suite green (140-test spot-run §3 run 2) |
| Token rotation + leave-room unchanged on the sub-page | PASS S | `settings/+page.svelte:204-260` — rotation writes `identity.token` + the vault entry ONLY after 2xx; leave clears identity + mutual code; untouched by the round |

### Item 5 — Chat color derived from the interlocutor's user id: fnv1a % 5 pinned, cross-visit determinism (task 48, §10.1.5, DESIGN §4.11.5) — PASS

| Check | Result | Evidence |
| --- | --- | --- |
| Hue = `fnv1a(address) % 5` over the five Deepa hues | PASS S/T/R | `lib/avatar/traits.ts:54-74` — `CODE_HUES = ['deepa-1'…'deepa-5']`, `codeHue(address) = CODE_HUES[fnv1a(address) % 5]` (doc-comment names the consumers, incl. chats-list cards); `avatar.test.ts:88-99` — "the exact fnv1a(address) % 5 rule over the documented Deepa order" + "deterministic: same address ⇒ same hue" |
| The card wears the INTERLOCUTOR's (counterpart's) hue | PASS S/T/R | `ChatCard.svelte:71-75` — `hueClass = codeHue(counterpartAddress)` (comment §4.10.5/§4.11.5 "derived from the interlocutor's user id"), applied as the card class (`:86`); degenerate 0-participant case → neutral surface; `chats-page.test.ts:246-262` — "§4.11.5 hue pin: the Deepa hue derives deterministically from the INTERLOCUTOR'S user id (fnv1a % 5) and is stable across polls": class == `codeHue('0xa')`, no retired `code-*` classes, hue KEPT after a fresh poll snapshot (cross-visit determinism) |
| Cross-visit determinism by construction | PASS S | `codeHue` is pure over the address (fnv1a, no store/session input) — the same user id yields the same hue in any visit/browser; the trait/avatar consumers hash the same way (§9.1.5 tests still green) |

### Item 6 — Chat item content: last-message preview (opacity 0.75 + ellipsis) + last-message time; theme text removed; lazy fetches with session cache (task 48, §10.1.6, DESIGN §4.11.6) — PASS

| Check | Result | Evidence |
| --- | --- | --- |
| Theme text removed from list items | PASS S/T/R | `ChatCard.svelte:8-9` ("the dialog-theme chips (phase/scenario) are REMOVED") — no phase/scenario chip markup anywhere in the card; `chats-page.test.ts:134-150` — "theme text REMOVED (§4.11.6)": `networking`/`ai-future` strings absent from the card |
| Preview muted with opacity 0.75, single-line ellipsis («…») truncation | PASS S/T/R | `ChatCard.svelte:171-187` — `.preview-line { opacity: 0.75 }` + `.preview { overflow: hidden; text-overflow: ellipsis; white-space: nowrap }` (comment §4.11.6); `chats-page.test.ts:203-221` — "truncation approach: single-line CSS ellipsis on the preview (§4.11.6 «…»)" (full content rendered verbatim, `title` attr carries it) |
| Last-message TIME (hh:mm) in the preview line | PASS S/T/R | `ChatCard.svelte:68-70,95` — `time = messageTime(lastMessage.created_at)` (absolute 24-hour hh:mm per `view.ts:102-113`, the §4.9.8 form); `chats-page.test.ts:152-165` — `.time` content matches `/^\d{2}:\d{2}$/`; the retired right-side relative card time is gone with it |
| Transcript fetched for the VISIBLE list, per the owner's frontend-only decision | PASS S/T/R | `routes/chats/+page.svelte:10-17,64-70` — every poll tick calls `refreshLastMessages(stableChats(chats).map(address), owner, api.listChatMessages)`; `last-message.test.ts:60-80` — "fetches exactly the requested (visible) addresses" / "an address left out of the visible list is never fetched"; `chats-page.test.ts:152-158` — `listChatMessages` called with the visible chat address |
| `lastMessage` store: owner-scoped, in-flight guard, failure-tolerant | PASS S/T/R | `lib/stores/lastMessage.ts` — entries carry `owner` (the session persona); stale-owner entries dropped on the next refresh (`:64-79`); `inFlight` set skips concurrent refetches (`:49-50,83-84,96`); fetch failures swallowed, previous entry kept (`:92-94`); empty transcript → no entry (`:40-47`). Tests: `last-message.test.ts:89-133` — "a failed fetch never throws and keeps the previous cached entry", "a chat already in flight is not re-requested by a concurrent refresh", "entries from a previous session persona are dropped on the next refresh" |
| No preview until fetched (no spinner), card renders fine without | PASS S/T/R | `ChatCard.svelte:15-16,93-99` + `chats-page.test.ts:167-171,195-201` (empty transcript → no `.preview-line`) |

### Item 7 — Status icon: ACTIVE = loading glyph on every card; the finished-signal GAP recorded as a backend-TODO (task 48, §10.1.7, DESIGN §4.11.7) — PASS (deliverable part) + recorded backend gap

| Check | Result | Evidence |
| --- | --- | --- |
| ACTIVE → a loading-style glyph on every card | PASS S/T/R | `ChatCard.svelte:104-112` — `.status` span with `PixelIcon status-active`; `lib/components/icons/registry.ts:162-168` — `status-active` = three dots ("the in-progress/typing rhythm, ink pairing via currentColor"); `chatStatus(chat)` defaults to `'active'` (`view.ts:150-152`) so EVERY card renders the loading glyph today; `chats-page.test.ts:223-234` — `.status.active` + svg present, status wording in the accessible name (`chats.card.aria` with `{status}`) |
| FINISHED → the red reminder-style mark (derivation-slot intact) | PASS S/T/R | `registry.ts:169-174` — `status-finished` = bold «!»; `ChatCard.svelte:199-208` — `.status.finished { color: var(--color-danger) }`; the `status?: ChatStatus` presentation-level prop (`ChatCard.svelte:53-54,67`) slots the finished state in without structural change; `chats-page.test.ts:349-387` — both states pinned directly on ChatCard |
| The finished-signal GAP is real — bleak-node contract check (first-hand, this sweep) | PASS B | `swagger.json:2032-2062` (`model.Chat`) and `:2249-2285` (`server.ChatResponse`) carry ONLY: `address`, `room`, `scenario`, `language`, `phase` (example "networking"), `phase_started_at`, `created_at` (+`participants` on the response) — **no lifecycle field** (no `finished_at`/`state`/`status`); `internal/db/chat.go` — the `chats` table columns are exactly `(address, room, scenario, language, phase, phase_started_at, created_at)` (`:23,60-62,112`); `phase` is the free agent-work theme string (`SetChatPhase` doc-comment `:190-197` — "«», networking, debate…"), a kickoff RESETS it (`ChatKickoff` `:358-361` sets `phase = ''`), and history-clear/kickoff leave the chat row in place (`ClearChatMessages :310-325` — "the chat, its participants and its events stay untouched"). The gap the tz4-19 worker recorded is confirmed verbatim by the contract |
| The derivation-slot note | PASS S | `view.ts:134-148` — the doc-comment records the gap AND the slot: "the signature already takes the full Chat so the switch stays local to this function" once the backend grows `finished_at`/`state` |

**Backend-TODO ledger entry (ready to hand to the concept agent):**

> **Chat lifecycle signal for the chat-list status icon (Concept §10.1.7).**
> bleak-node exposes no chat lifecycle state: `model.Chat` /
> `server.ChatResponse` (swagger.json definitions `model.Chat`,
> `server.ChatResponse`) carry only `address`, `room`, `scenario`,
> `language`, `phase` (a free agent-work theme string — «networking»,
> «debate»), `phase_started_at` and `created_at` (+`participants`), and the
> `chats` table (`internal/db/chat.go`) stores exactly those columns — no
> `finished_at`/`state` field exists, `ClearChatMessages` and `ChatKickoff`
> leave the chat row in place, and `phase` is reset (not a completion
> signal). The v2.4 status icon therefore derives `active` for every chat
> (`lib/chats/view.ts` `chatStatus`). REQUEST: a lifecycle field on the
> chat (e.g. `finished_at` timestamp or a `state` enum) exposed through the
> chat endpoints. DERIVATION SLOT READY: `chatStatus(_chat: Chat)` already
> receives the full `Chat`, so adding the field is a one-function client
> change (the `FINISHED` icon — the red «!» on the danger token — is
> already shipped behind the `status` prop, ChatCard.svelte).

### Item 8 — Host out of the footer nav: 4-tab set, nav.host retired, /host URL-reachable (task 46, §10.1.8, DESIGN §4.11.8) — PASS

| Check | Result | Evidence |
| --- | --- | --- |
| Exactly four tabs | PASS S/T/R | `TabBar.svelte:16-23` — `TabRoute = '/room' | '/people' | '/chats' | '/profile'` (no host); `tabbar.test.ts:42-46` — "resolves tab hrefs to literal routes" asserts exactly `['/room', '/people', '/chats', '/profile']`; `:14-21` — "renders the four tabs" |
| `nav.host` retired | PASS S/T | grep `nav.host` over `apps/web/src`: **zero hits**; the i18n binding checklist records the retirement: `i18n.test.ts:130` — "navigation ('nav.host' retired — Concept §10.1.8: Host left the tab bar)" and the 4-key nav list `:131` |
| `/host` route stays URL-reachable | PASS S | `routes/host/+page.svelte` unchanged — full console (creation-token gate at `:475`, hostSession store); the removal touched only the TabBar; the layout renders the route by URL as before (the route file exists and renders — no guard against direct URL entry beyond its own TokenGate) |

---

## 3. Spot-run record (first-hand, this session)

```
npm run test -w @bleak/web -- tests/chats-page.test.ts tests/last-message.test.ts tests/chats-view.test.ts
  → Test Files 3 passed (3) · Tests 46 passed (46)
npm run test -w @bleak/web -- tests/profile-page.test.ts tests/profile-settings.test.ts
  tests/join-machine.test.ts tests/join-flow.test.ts tests/identity.test.ts
  tests/tabbar.test.ts tests/radar-placement.test.ts tests/avatar.test.ts
  → Test Files 8 passed (8) · Tests 140 passed (140)
```

All 11 card-anchored suites: **186 tests green, 0 failures** (46 + 140).
No full `make test` by this sweep — the process runs the delta-wave CI on
`dev` after this landing (§1 placeholder).

---

## 4. Findings

**Verdict: items 1–8 — 8/8 PASS, 0 FAIL.** The §10.1.7 backend gap is
**not** a delivery failure — the deliverable part (active loading glyph on
every card + the finished slot) is complete, and the missing lifecycle
signal is a bleak-node contract fact, recorded above as the backend-TODO
ledger entry. No product defect found; no fix-up performed
(verification-only constraint).

| # | Severity | Finding | Recommendation |
| --- | --- | --- | --- |
| F1 | none (doc-comment staleness only) | Two v2.3-era comments still say "(uppercase, weight)" — `ProfileBadge.svelte:82-85` and `PersonaEditor.svelte:66-68` — while the same files' v2.4 blocks (`:201-213` / `:123-133`) and the pinned test (`text-transform: none`, no `uppercase` in the block) state the amendment. Assertion-level coverage is unaffected. | Cosmetic comment fixup whenever those files are next touched; no action required this round. |
| F2 | none (informational, carried) | `ImportRooms.svelte` / `ImportUsers.svelte` remain in the tree as deliberate TZ2-06 tombstones (emptied, zero references) — the worker's command set cannot `rm`; the process removes them during merge processing. | Unchanged from the TZ2-06 record. |

## 5. Pre-event manual checks carried forward (owner, real device)

The automated suites pin the logic; these need a real phone:

1. **v2.4 — chat-list preview freshness on device:** with the 4 s cadence
   each visible dialog's preview + hh:mm time should track the agents'
   latest message without a page reload; a fresh chat (no messages yet)
   shows no preview row at all; leaving and re-entering /chats must never
   show another session persona's preview (owner-scoped cache).
2. **v2.4 — status icon eyeball:** every card carries the small three-dot
   loading glyph in the card's ink pairing (on Deepa hues, the ink token
   color) — confirm it reads as "in progress" next to the preview line and
   does not collide with the truncated preview on narrow screens.
3. **v2.4 — return-to-event flow:** after "Join another event", the Step-1
   «Вернуться на событие» entry lists the saved personas with the
   «Вернуться» badge; tapping enters the previous room directly (no
   persona form, no code re-entry); a dead persona shows the dead-note on
   the row without entering.
4. **v2.4 — read-only profile:** /profile shows no edit buttons anywhere
   (name/bios/greeting/interests are display-only); the «Персона» section
   on /profile/settings holds the three editor rows.
5. **v2.4 — radar center gap:** nearest-ring nodes now sit closer to the
   center "you" chip — confirm no node's hit disk visually covers the chip
   (the 88px derivation clears the avatar circle + name line) and the
   nodes still never overlap each other.
6. **Carried from v2.3 (unchanged, full notes in
   `docs/verification-v23.md` §6):** **ICU RU date/time** — the date label
   «8 сентября» + hh:mm times with no «мин»/AM-PM on a real device (the
   test runner's Node ICU is restricted; browsers ship full ICU);
   **Deepa violet legibility** — `#9B0CFF` cards/bubbles with light ink
   (4.74:1, the tightest AA pairing) must stay readable at arm's length on
   an OLED panel at outdoor brightness; **radar oversize on small screens**
   — the stage spans the larger viewport dimension, no horizontal
   scrollbar, center chip + nodes stay visible/tappable in the clipped
   view, rotation re-sizes without breaking layout.
7. **Carried pre-event (full checklists in `docs/verification-v2.md` §8,
   v2.1 §5, v2.2 §6):** HTTPS secure-context gate (camera +
   `crypto.subtle`), scanner real-device smoke (iOS Safari + Android
   Chrome: permission states, decode path, camera light off on close), PWA
   install, live polling on venue Wi-Fi, host console gate/rotation/
   clear/kickoff flows, radar motion (upright icons, ring speeds, glide),
   yellow-dot incoming marker, dialog header public bio, three profile
   stat tiles, outline-style leave button.

---

*End of the v2.4 verification sweep — worker 98375dd3, 2026-11-18, branch
`feature/98375dd3-tz4-20-verify-v24` (tip = dev `6f6cea0`).*
