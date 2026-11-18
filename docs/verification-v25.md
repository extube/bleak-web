# bleak-web v2.5 — Verification sweep (TZ4-25, verification-only)

Worker instance `c3eb6b5f` · 2026-11-18 · branch
`feature/c3eb6b5f-tz4-25-verify-v25` (tip = dev `a7bfda9` — the landing of
`feature/5c1c6036-tz4-24-join-input-overflow`; the whole §11 delta wave
TZ4-21…TZ4-24 merged, tasks 49–52). This sweep verifies the **four
refinements of Concept §11.1** (v2.5 addendum, DESIGN §4.12 amendments) are
delivered on `dev`. It adds **no product code and no test files** — one-shot
source greps, landed-code reads and targeted spot-check runs recorded here,
per the verification-only constraint of the card. It completes the §8–§11
verification record (v2.2/v2.3 in `docs/verification-v22.md`/`-v23.md`,
§10 in `docs/verification-v24.md`).

Method legend: **S** = source inspection / one-shot grep in this sweep,
**T** = merged automated test (file — title), **R** = targeted spot-run
executed first-hand in this session, **B** = read-only check against the
bleak-node contract (`/mount/bleak-node`, not edited).

---

## 1. Gate record (TZ §8.8 discipline — full gates are delta-wave-CI's job)

| Check | Result | Source |
| --- | --- | --- |
| Full `make test` re-run by this sweep | **not run** (the process runs the delta-wave CI after this landing) | this session |
| DELTA-WAVE CI (2026-11-18T13:02Z, process, dev tip `6cd64b3` post-sweep-landing) | **GREEN** — `make lint` clean · `make test` 584 passed (23 api-client + 8 helper + 553 web, 43 files) · `make build` 0 svelte-check errors (8 pre-existing warnings) | process gate run; recorded via `task.py ci` |
| Landing commits of the §11 delta wave (tasks 49–52) | **all landed 2026-11-18** — 49 leave-local-only `da299f9` (12:44:49Z); 50 chat-list-neutral-restyle `69480b0` (12:49:29Z); 51 copy-sweep-persona-to-profile `781ad4e` (12:55:47Z); 52 join-input-overflow `a7bfda9` (12:58:51Z) | dev log |
| Targeted spot-runs (6 card-anchored suites, first-hand) | **green — 92 tests / 6 files** (profile-settings + join-flow + identity + chats-page + i18n + digit-input) | `npm run test -w @bleak/web -- <files>` (§3), all passing |
| Owning tasks of the 4 items | **49, 50, 51, 52 — all merged into `dev`** (dev tip `a7bfda9` at sweep time) | `task.py list` / dev log |

No test was added or modified by this sweep.

---

## 2. Per-item checklist — Concept §11.1 items 1–4

### Item 1 — Leaving a room never deletes the persona (task 49, §11.1.1, DESIGN §4.12.1) — PASS

| Check | Result | Evidence |
| --- | --- | --- |
| `api.deleteRoomUser` absent from the attendee exit flow | PASS S/T | The only `deleteRoomUser` references in `apps/web/src` are its definition/registration in `lib/api/client.ts:85,236-238` — **zero call sites in any `.svelte`/route** (grep over the whole `src` tree); `routes/profile/settings/+page.svelte:252-257` — `leaveRoom()` is exactly `clearIdentity()` + `leaveOpen = false` + `goto(resolve('/'))` (doc-comment `:243-251` — "the attendee exit NEVER deletes the persona on the server — no hard or soft delete"); the pre-fix async `api.deleteRoomUser(id.roomAddress, id.userAddress)` body plus `pendingLeave`/`leaveError` state was removed wholesale (diff of `da299f9`); tests assert the negative: `profile-settings.test.ts:373-381` ("asks the confirmation question BEFORE leaving — local-leave copy, no server delete" — `expect(mockedApi.deleteRoomUser).not.toHaveBeenCalled()`) and `:383-399` ("purely local, NO server delete (Concept §11.1.1)" — `deleteRoomUser` NOT called while identity + mutual code are cleared) |
| Confirmation copy states local-leave + return-any-time, RU + EN | PASS S/T | `ru.ts:183-184 'profile.leave.confirm_body': 'Вы покинете событие. Токен останется на этом устройстве — вы сможете вернуться в любой момент через «Вернуться на событие».'`; `en.ts:182-183: 'You will leave the event. Your token stays on this device — you can return any time via Return to event.'`; the deletion wording is asserted GONE: `i18n.test.ts:300-311` ("the leave confirmation copy describes the local leave — no deletion wording, both dictionaries") pins both strings and asserts `not.toMatch(/удал/i)` (RU) / `not.toMatch(/remov|delet/i)` (EN) |
| Leave→return round-trip pinned by tests | PASS T/R | Vault survives the leave: `identity.test.ts:52-69` — "clearIdentity never touches `bleak.tokenVault`… the stored token survives for return-to-event" (seeded entry byte-identical after `clearIdentity`); full round-trip: `profile-settings.test.ts:401-419` — "owner round-trip (§11.1.1 + §10.1.1)": leave → identity null → vault entry intact → `verifyVaultEntry(stored[0])` succeeds with the STORED token (`getRoomUser` called with `{ token: TOKEN }`, the persona was never deleted) → `saveIdentity` restores `{roomAddress, userAddress, token}`; end-to-end through the join machine: `join-flow.test.ts:381-414` — "the owner round-trip after a local leave": `clearIdentity()` (the whole client-side leave), vault intact, the Step-1 pick validates the stored token and enters the room (`goto('/room')`, identity restored, vault unchanged); `join.ts:123` — `verifyVaultEntry` = the explicit-token `getRoomUser` read |
| Host drill-down explicit delete untouched | PASS S | The leave commit (`da299f9`) touches only the settings route, the two dictionaries and the four test files — no host file; the backend DELETE persona endpoint stays available for explicit deletion (host drill-down) — the client wrapper remains in `lib/api/client.ts:236-238` with no attendee-flow caller |

### Item 2 — Chat list — no background colors (task 50, §11.1.2, DESIGN §4.12.2) — PASS

| Check | Result | Evidence |
| --- | --- | --- |
| No Deepa background/ink pairing on ChatCard — neutral `--color-surface`, standard text hierarchy | PASS S/T | `ChatCard.svelte:131-140` — `.chat-card { background: var(--color-surface); color: var(--color-text); }` (the neutral surface, no Deepa class); the §4.12.2 comment block `:144-149` records the LIST-role amendment; no `.chat-card.deepa-*` selector exists in the file; test `chats-page.test.ts:284-302` — "§4.12.2 restyle CSS": asserts `background: var(--color-surface)` on `.chat-card`, `not.toMatch(/\.chat-card\.deepa-\d/)`, and no raw hex; DOM-level: `:258-282` — "the card drops the Deepa background": `link.className` not matching `/deepa-[1-5]/` |
| Color-coding on the avatar's own Deepa-derived art (the /people pattern) | PASS S/T | `ChatCard.svelte:101` — plain `<PixelAvatar address={counterpartAddress ?? ''} size={56} …/>` (same as `PersonCard.svelte:102` on /people — no hue wrapper on the card); test `chats-page.test.ts:269-271` — "the avatar carries the color-coding like /people: plain PixelAvatar, no extra hue wrapper" — exactly ONE `.deepa-*` element inside the link (the status mark), and the card link itself wears none |
| Status marks in the chat's Deepa message color — finished mark NOT danger-red | PASS S/T | `ChatCard.svelte:186-209` — `.status.deepa-1…5 { color: var(--color-deepa-<n>) }` (declared after the base so the hue wins); the finished «!» takes the same hue class (`:118` — `class="status {state} {hueClass}"`); **no `--color-danger` anywhere in the component** — test `chats-page.test.ts:292-295` asserts all five `.status.deepa-<n>` token mappings and `not.toMatch(/--color-danger/)`; state-level: `:393-409` (ACTIVE in the interlocutor's hue) and `:411-435` (FINISHED → the reminder mark in the chat's hue, NOT the danger red; card itself stays neutral) |
| Loading icon animated (rotating), transform-only, reduced-motion respected | PASS S/T | `ChatCard.svelte:210-223` — `.status.active { transform-origin: 50% 50%; animation: chat-status-spin 1.6s linear infinite; }` + `@keyframes chat-status-spin { to { transform: rotate(360deg); } }` (transform-only, §4.6 motion rule; the base.css global catch-all disables it under reduced motion: `base.css:57-64` — `animation-duration: 0.01ms / iteration-count: 1` for `*` under `prefers-reduced-motion: reduce`); test `chats-page.test.ts:296-299` pins the animation + keyframes on the CSS |
| Preview line intact (opacity + ellipsis + hh:mm) | PASS S/T | `ChatCard.svelte:167-181` — `.preview-line { opacity: 0.75; min-width: 0 }` + `.preview { overflow: hidden; text-overflow: ellipsis; white-space: nowrap }`; the absolute hh:mm time rides the same line (`:78-80` — `messageTime(lastMessage.created_at, $locale)`; `:106` — `<span class="time">`) — untouched by the restyle (the §4.11.6 block preserved verbatim in the diff) |
| Dialog bubbles keep Deepa colors (MessageBubble untouched) | PASS S/T | The restyle commit (`69480b0`) touches ONLY `ChatCard.svelte` + `chats-page.test.ts` (+ logs/session) — MessageBubble not in the diff; `MessageBubble.svelte:1-38` — theirs-bubbles still carry `codeHue(message.from)` → full-opacity `--color-deepa-<n>` background with the hue's ink token (AA-verified in `bubble-contrast.test.ts`); `ChatCard.svelte:25-32` — the comment records "DIALOG bubbles keep their colors" |

### Item 3 — Copy sweep: drop "Edit", "persona"→"profile" (task 51, §11.1.3, DESIGN §4.12.3) — PASS

| Check | Result | Evidence |
| --- | --- | --- |
| 'Edit' dropped from the edit titles (Profile/Greeting/Interests style) | PASS S/T | `en.ts:154-156` — `'profile.greeting.edit': 'Greeting'`, `'profile.persona.edit': 'Profile'`, `'profile.interests.edit': 'Interests'`; `ru.ts:155-162` — `'Приветствие'`, `'Профиль'`, `'Интересы'` (values only — key names intact per the sweep decision); test `i18n.test.ts:259-266` — "edit-screen titles drop the word "Edit" (values only — key names intact)" pins all six; no user-visible hardcoded "Edit"/"Редактир…" remains in any `.svelte` (grep: only code identifiers/comments) |
| Zero user-visible 'persona'/'персона' in dictionary values (guard test) | PASS S/T | `i18n.test.ts:273-279` — "no user-visible "persona" / "персона" remains in any dictionary value": `Object.values(en).filter(/\bpersonas?\b/i)` and `Object.values(ru).filter(/персона/i)` must both be `[]` (word-boundary match keeps "Personal"/«Личный QR-код»); first-hand grep over both dictionaries confirms the only remaining matches are KEY names and comments, never values; renamed values include `join.create_persona` → 'Create profile'/'Создать профиль' (`en.ts:27`, `ru.ts:28`), `scan.foreign_persona` → 'This profile is from another event.'/'Этот профиль из другого события.' (`en.ts:68`, `ru.ts:69`) |
| Settings titles 'My profile' / «Мой профиль» — both keys | PASS S/T | `en.ts:179 'profile.settings.title': 'My profile'` + `en.ts:180 'profile.settings.persona': 'My profile'`; `ru.ts:180 'profile.settings.title': 'Мой профиль'` + `ru.ts:181 'profile.settings.persona': 'Мой профиль'`; tests `i18n.test.ts:268-271` ("the persona section heading is retitled") and `:252-255` (the v2.1 settings-heading test retitled per §11.1.3) |
| RU values spot-check | PASS S | `ru.ts:180-181` — «Мой профиль» (both keys); `ru.ts:175` — `'profile.qr.alt': 'Личный QR-код'` («Personal» kept — a different word per the sweep decision) |

### Item 4 — Join form: 6-digit input stays inside the card (task 52, §11.1.4, DESIGN §4.12.4) — PASS

| Check | Result | Evidence |
| --- | --- | --- |
| Flexible cell sizing: `flex: 1 1 0`, `min-width: 0`, max 56px | PASS S/T | `DigitInput.svelte:152-156` — `input { flex: 1 1 0; min-width: 0; max-width: 56px; height: 56px; … }` (the fixed `width: 56px` replaced; comment `:146-151` — "the cells shrink to the card's content box instead of forcing a fixed 376px row"; the 56px touch-target HEIGHT preserved ≥ `--touch-target`); test `join-flow.test.ts:477-495` — "the digit row stays inside the card at ~320px and does not regress larger widths": no unbounded `width: 56px` (lookbehind skips min-/max-), pins all four declarations + the `--space-2` gap + no raw hex |
| 376px→fits diagnosis recorded | PASS T | `join-flow.test.ts:444-467,469-475` — "diagnosis: the fixed 376px row exceeded the 224px content box at ~320px": the OLD row = 6×56px cells + 5×`--space-2` (8px) gaps = **376px**, the card's content box at the narrowest supported 320px viewport = 320 − 2×`--space-5` join padding − 2×`--space-5` card padding = **224px** (both arithmetic re-derived from `tokens.css` live in the test — token lookups, not literals) — overflowing any viewport under 376 + 96 = 472px; the same diagnosis is recorded in the component's CSS comment (`DigitInput.svelte:146-151`) |
| 320px regression check pinned | PASS T | The same test `join-flow.test.ts:469-475` is the regression check: with flexible sizing nothing can force the row past the 224px content box (cells shrink equally below 56px; only the height stays fixed) — the CSS contract pins the mechanism since happy-dom runs no layout engine (documented in the test's comment `:446-455`) |
| Input behavior tests green | PASS T/R | The pre-existing digit-input suite (behavior: auto-advance, backspace-retreat, paste-fill, invalid-char rejection — `digit-input.test.ts`) and the join-flow digit-row suite all green in the spot-run (§3: 92/92); no behavior change — layout only |

---

## 3. Spot-run record (first-hand, this session)

```
npm run test -w @bleak/web -- tests/profile-settings.test.ts tests/join-flow.test.ts
  tests/identity.test.ts tests/chats-page.test.ts tests/i18n.test.ts tests/digit-input.test.ts
  → Test Files 6 passed (6) · Tests 92 passed (92)   (13:00:30Z, 9.05 s)
```

All 6 card-anchored suites: **92 tests green, 0 failures**.
No full `make test` by this sweep — the process runs the delta-wave CI on
`dev` after this landing (§1 placeholder).

---

## 4. Findings

**Verdict: items 1–4 — 4/4 PASS, 0 FAIL.** No product defect found; no
fix-up performed (verification-only constraint).

| # | Severity | Finding | Recommendation |
| --- | --- | --- | --- |
| — | none | No new findings this round. | — |

The §10.1.7 backend gap (chat lifecycle signal) carries forward unchanged —
see §6 below.

---

## 5. Pre-event manual checks carried forward (owner, real device)

The automated suites pin the logic; these need a real phone:

1. **v2.5 — join input at real phone width:** the 6-digit code row now
   shrinks into the card's content box — confirm on a real device at ~320px
   (iPhone SE class) and at the common 360–390px widths that the cells stay
   inside the card, remain legible/tappable (56px tall) and that wide
   viewports are visually unchanged (cells capped at 56px).
2. **Carried from v2.4 (unchanged, full notes in `docs/verification-v24.md`
   §5):** **chat-list preview freshness** — with the 4 s cadence each
   visible dialog's preview + hh:mm tracks the agents' latest message
   without a reload; a fresh chat shows no preview row; the owner-scoped
   cache never shows another session persona's preview; the status glyph
   (now rotating, in the chat's Deepa hue on a NEUTRAL card) still reads as
   "in progress" and does not collide with the truncated preview on narrow
   screens; the return-to-event flow; the read-only profile; the 88px radar
   center gap.
3. **Carried from v2.3 (unchanged, full notes in `docs/verification-v23.md`
   §6):** **ICU RU date/time** — the date label «8 сентября» + hh:mm times
   with no «мин»/AM-PM on a real device (the test runner's Node ICU is
   restricted; browsers ship full ICU); **Deepa violet legibility** —
   `#9B0CFF` bubbles/cards with light ink (4.74:1, the tightest AA pairing)
   must stay readable at arm's length on an OLED panel at outdoor
   brightness; **radar oversize on small screens** — the stage spans the
   larger viewport dimension, no horizontal scrollbar, center chip + nodes
   stay visible/tappable in the clipped view, rotation re-sizes without
   breaking layout.
4. **Carried pre-event (full checklists in `docs/verification-v2.md` §8,
   v2.1 §5, v2.2 §6):** HTTPS secure-context gate (camera +
   `crypto.subtle`), scanner real-device smoke (iOS Safari + Android
   Chrome: permission states, decode path, camera light off on close), PWA
   install, live polling on venue Wi-Fi, host console gate/rotation/
   clear/kickoff flows, radar motion (upright icons, ring speeds, glide),
   yellow-dot incoming marker, dialog header public bio, three profile
   stat tiles, outline-style leave button (copy now local-leave, §11.1.1).

---

## 6. Standing backend-TODO reminder (carried from v2.4, unchanged)

> **Chat lifecycle signal for the chat-list status icon (Concept
> §10.1.7).** bleak-node exposes no chat lifecycle state: `model.Chat` /
> `server.ChatResponse` carry only `address`, `room`, `scenario`,
> `language`, `phase` (a free agent-work theme string), `phase_started_at`
> and `created_at` (+`participants`), and the `chats` table stores exactly
> those columns — no `finished_at`/`state` field exists (full contract
> evidence first-hand in `docs/verification-v24.md` §2 item 7). The status
> icon therefore derives `active` for every chat (`lib/chats/view.ts`
> `chatStatus`). REQUEST: a lifecycle field on the chat (e.g.
> `finished_at` timestamp or a `state` enum) exposed through the chat
> endpoints. DERIVATION SLOT READY: `chatStatus(_chat: Chat)` already
> receives the full `Chat` (one-function client change), and the FINISHED
> icon is already shipped behind the `status` prop (ChatCard.svelte — in
> v2.5 it renders in the chat's Deepa hue per §11.1.2, not the danger red).
> Hand to the concept agent with the §11 record.

---

*End of the v2.5 verification sweep — worker c3eb6b5f, 2026-11-18, branch
`feature/c3eb6b5f-tz4-25-verify-v25` (tip = dev `a7bfda9`).*
