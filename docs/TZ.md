# bleak-web — TZ (Technical Task for the Build Loop)

Architect instance: `acff3ab8` (resumed 2026-11-14 for the TZ pass). Authority
chain: `docs/Concept.md` (incl. §1c owner rulings, backend TODO ledger) →
`docs/ARCHITECTURE.md` (merged) → `docs/DESIGN.md` **revision 2** (owner-
approved 2026-11-14) → **this document**.

**What TZ is:** the ordered, worker-sized implementation plan for v1. DESIGN §3
owns the *what* (per-page specs + 100 acceptance criteria); ARCHITECTURE owns
the *how* (stack, boundaries, polling, tokens); TZ owns the *in what order, by
whom, against which criteria* — without restating either.

**How to read a task:** each task below = **one worker instance = one branch
`feature/<hash>-<slug>` = one task card** (opened by the process via
`open-feature.sh <slug>`; the `tz-section` reference points back here). Scope
lines reference DESIGN section numbers; inherited acceptance criteria are
listed **verbatim by number** — the worker must read the referenced DESIGN
section for the full criterion text.

---

## 1. Work breakdown (build order)

| # | Task (`tz-section`) | Slug (branch suffix) | Size | Depends on | DESIGN § |
| --- | --- | --- | --- | --- | --- |
| TZ-01 | Foundations: i18n copy table + tokens | `i18n-tokens` | S | — | 2.3, 2.4, 4.1, 4.7 |
| TZ-02 | Shared UI kit + domain primitives | `ui-kit` | L | TZ-01 | 1.2, 2.1, 4.2–4.6 |
| TZ-03 | Join flow `/` | `join-flow` | L | TZ-02 | 1.1, 1.3, 3.1 |
| TZ-04 | `QrScanner` overlay (real) | `qr-scanner` | L | TZ-02 | 2.7, 3.8 |
| TZ-05 | `/room` radar | `room-radar` | L | TZ-02, TZ-03 | 3.2 |
| TZ-06 | `/people` list | `people-list` | M | TZ-02, TZ-03 | 3.3 |
| TZ-07 | `/chats` + `/chats/[address]` | `chats` | M | TZ-02, TZ-03 | 3.4, 3.5 |
| TZ-08 | `/profile` badge | `profile-badge` | M | TZ-02, TZ-03 | 3.6 |
| TZ-09 | `/host` console | `host-console` | M | TZ-02, TZ-03 | 3.7 |
| TZ-10 | Integration & verification sweep | `verify-v1` | M | TZ-03…TZ-09 (all) | all of §2–§4 |

Total DESIGN §3 acceptance criteria: **100** (§3.1:14, §3.2:14, §3.3:12,
§3.4:8, §3.5:13, §3.6:13, §3.7:12, §3.8:14) — every one is mapped to exactly
one implementation task below (§3 of this doc); TZ-10 verifies all 100.

**Contract-first components (belong to TZ-02, enabling parallelism):**
`HandshakeSheet` and the pure relationship-derivation module ship with the UI
kit so that TZ-05 (radar) and TZ-06 (people) never block each other; the
`QrScanner` ships in TZ-02 as a **placeholder with the final public API** so
TZ-03/TZ-05 compile and merge before TZ-04 lands (TZ-04 replaces the
placeholder implementation in place — same file path, same props).

---

## 2. Per-task TZ sections

### TZ-01 — Foundations: i18n expansion + tokens (`tz-01`)

**Scope** (DESIGN §2.3, §2.4, §4.1, §4.7):
1. Replace/extend `apps/web/src/lib/i18n/{ru,en}.ts` with the **complete
   §4.7 copy table** — every key, both languages, exact RU/EN strings from the
   table (placeholders `{n}`, `{q}`, `{name}` use the existing
   `translate(…, params)` interpolation). Keys not in §4.7 but needed by page
   tasks (e.g. field labels, editor captions) may be added — both dictionaries
   always, key parity is CI-enforced.
2. `tokens.css` additions (DESIGN §3.6 + §4.1 rules): `--color-qr-frame`
   (value = the helper QR's light background, `#F0F0F0` — the one declared
   functional exception to the dark palette); any derived alpha-variant tokens
   a later task needs must be added here (naming `--color-accent-dim` style),
   never inline.
3. `base.css`: `prefers-reduced-motion: reduce` global rule per §4.6
   (ambient rotation, pulses and entrances off; state changes instant).

**Files:** `apps/web/src/lib/i18n/{ru,en}.ts`, `apps/web/src/lib/styles/{tokens,base}.css`.

**Task-specific technical criteria:**
- `npm run test -w @bleak/web` passes with the parity test over the enlarged
  dictionaries (existing test file, extended to iterate all keys).
- No key used by DESIGN §4.7 may be missing from either dictionary.
- No component/style file outside `tokens.css` introduces a new color value.

**Dependencies:** none. **Out of scope:** using the new keys in pages (each
page task wires its own copy); the QR encoder itself (TZ-04/TZ-08).

---

### TZ-02 — Shared UI kit + domain primitives (`tz-02`)

**Scope** (DESIGN §1.2, §2.1, §4.2–§4.6). Build under
`apps/web/src/lib/components/` (+ `icons/`, `assets/avatars/`):

1. **Pixel icons set** (§4.4): 16×16 grid SVG components, `currentColor`,
   2px weight, under `lib/components/icons/`: back, close, search, plus,
   dialog-lines, lock, copy, radar-dot, star, edit, refresh, scan, and the
   five tab glyphs (replace the TabBar placeholders).
2. **`PixelAvatar`** (§4.3): 12×12 SVG (`viewBox="0 0 12 12"`,
   `shape-rendering="crispEdges"`), deterministic FNV-1a(address) trait
   selection (skin 4, hairstyle 8, hair color 5, facial hair 4, glasses 3,
   backdrop 5), trait parts as SVG files under `lib/assets/avatars/`
   (backdrop/head/hair/face/glasses layers composed by the component);
   `own` prop switches the backdrop to `--color-accent`; "pixel ghost" default
   for unparseable addresses. Pure hash/slice logic in a separate module with
   unit tests.
3. **Primitives** (§2.1, §4.2): `Chip` (outline-muted / outline-accent /
   fill-accent), `SegmentedControl`, `DigitInput` (six cells, §3.1 spec:
   56px, auto-advance, backspace-retreat, paste-fill, invalid-char reject),
   `SkeletonBlock`, `ErrorBanner` (§2.1 copy via i18n keys), `EmptyState`,
   `ConfirmDialog` (focus trap, Escape), `CopyButton`/`CopyField`
   (clipboard + transient «Скопировано»), `StatTile`, `ContactStub`
   (disabled coming-later row, §2.1).
4. **`HandshakeSheet`** (§3.2 bottom-sheet spec; §3.3 states): the single
   source of handshake actions — avatar, name, `public_bio`, relationship
   line, per-state action set (send / waiting / handshake-back+dialog /
   open-dialog), inline NetworkError recovery. Pure presentational + a
   `send` callback; relationship state passed in as data.
5. **Relationship derivation module** (pure TS, unit-tested, e.g.
   `lib/room/relationships.ts`): given my address + `User[]` +
   `Handshake[]` (from `listHandshakesOfUser`) + `Chat[]`
   (from `listChatsOfUser`), classify each other attendee into
   `chat | incoming | outgoing | none` (+ the counterpart chat address where
   applicable). Direction is derived from `from_address`/`to_address` only —
   `Handshake.status` is **not** interpreted (DESIGN §6.1). This module is the
   contract consumed by TZ-05, TZ-06 and TZ-04 (scanner's already-mutual check).
6. **`QrScanner` placeholder** (same public API as TZ-04, no camera):
   `QrScanner.svelte` with props
   `{ open: boolean; context: 'invite' | 'persona'; members?: User[]; onInviteCode(code: string): void; onPersonaScanned(userAddress: string): void; onClosed(): void }`
   — renders a static panel ("scanner arrives in a later task"), wires
   open/close callbacks. TZ-04 replaces the body in place.
7. **`chatsSeen` store + TabBar badge dot** (§1.2): store
   `lib/stores/chatsSeen.ts` (localStorage `bleak.chatsSeen`), TabBar renders
   the accent dot on Chats when a chat timestamp exceeds it. Writers: page
   tasks that poll `listChatsOfUser` (see §3 of this doc).
8. **TabBar polish** (§1.2): pixel glyphs, active accent + dot, `aria-label`
   «Основная навигация» / "Main navigation", ≥48px targets.

**Files:** `apps/web/src/lib/components/**` (new), `apps/web/src/lib/assets/avatars/**`,
`apps/web/src/lib/stores/chatsSeen.ts`, `apps/web/src/lib/room/relationships.ts`,
`apps/web/src/lib/components/TabBar.svelte`, `apps/web/tests/*` (kit tests).

**Task-specific technical criteria:**
- Unit tests: avatar hash determinism + trait mapping bounds; relationship
  classification for all four states incl. idempotent re-handshake; digit
  input validation; kit component render tests via
  `@testing-library/svelte` (happy-dom is already configured) for Chip,
  SegmentedControl, DigitInput, ConfirmDialog focus trap, ErrorBanner copy.
- No hardcoded hex (§2.4); `.pixel-corners` usage per §4.5 (never on pills).
- All animations transform/opacity only (§4.6).
- TabBar badge dot logic unit-tested (newer-than-seen ⇒ dot).

**Dependencies:** TZ-01. **Out of scope:** wiring primitives into pages
(page tasks do that); real scanner logic (TZ-04).

---

### TZ-03 — Join flow `/` (`tz-03`)

**Scope** (DESIGN §1.1, §1.3, §3.1):
1. Full Step 1→3a/3b flow on `routes/+page.svelte` (+ components under
   `lib/components/join/`): code entry (DigitInput), helper resolution
   (`resolveInvite`), room preview (`getRoom` + `listRoomUsers` count),
   persona form (`createRoomUser`), import flow (`listRooms` →
   `listRoomUsers` → `getRoomUser` prefill → re-create as a **new** user —
   architecture §8.4), «Изменить код», resume card + "join another event"
   (clears identity), locale control on the card.
2. Deep links: `?code=NNNNNN` prefill + auto-submit; `?u={userAddress}`
   handling per §3.1 AC 14 (identity present → run the §3.8 mutual-handshake
   routine via the scanner module's exported pure routine, § TZ-04; without
   identity → ignored, normal join card).
3. **Scanner mount point (context *a*)**: the «Или отсканировать QR-код»
   button mounts the kit's `QrScanner` (placeholder until TZ-04); a detected
   invite code enters Step 1 as if typed (AC 12–13). Manual fallback =
   close + focus cells.
4. **Shared identity guard** for later pages: `lib/nav/guard.ts` exporting
   `requireIdentityOrRedirect(): boolean` (reads `identity`, redirects to `/`
   when null). Every guarded page task calls it in its route script — no
   group-layout restructure.
5. All §3.1 interaction states: resolving spinner, 404/400 inline errors +
   shake, NetworkError banner (code preserved), submit 400/409, room-deleted
   card error.
6. Update `sessionStorage` pending-code handling to the §3.1 flow (code kept
   in component state between steps; sessionStorage key may be dropped if
   the in-memory state covers all paths — keep the current key only if used).

**Files:** `apps/web/src/routes/+page.svelte` (rewrite),
`apps/web/src/lib/components/join/**`, `apps/web/src/lib/nav/guard.ts`,
`apps/web/src/lib/join.ts` (extend), tests under `apps/web/tests/`.

**Inherited acceptance criteria:** DESIGN §3.1, AC **1–14 verbatim**.

**Task-specific technical criteria:**
- The scanner mount uses only the agreed `QrScanner` public API (TZ-02/TZ-04).
- Import flow performs exactly two read calls + one create call per import
  (no address reuse); no client-side ownership gates (ruling 5).
- Unit tests for code validation + step-machine transitions with mocked api
  clients (`vi.mock('#lib/api/client')` / helper); component test for the
  DigitInput→resolve→preview hand-off.
- Poller not used here (mount-time fetches only, per §2.2 — `/` is not in the
  cadence table).

**Dependencies:** TZ-02. **Out of scope:** real scanner internals (TZ-04);
`/room` content beyond navigation target.

---

### TZ-04 — `QrScanner` overlay, real implementation (`tz-04`)

**Scope** (DESIGN §2.7, §3.8). Replace the placeholder body of
`apps/web/src/lib/components/QrScanner.svelte` (same file, same props,
same callbacks — no changes needed in TZ-03/TZ-05 consumers):

1. Camera lifecycle: explicit-start only («Включить камеру» tap), state
   machine unasked → requesting → granted / denied / no-camera (exact
   §3.8 table), stream tracks stopped on close/result/unmount/navigation.
2. Detection loop: `BarcodeDetector` when available (formats
   `['qr_code']`), else lazy `import('jsqr')` (package name `jsqr`, ~14 kB)
   decoding downscaled canvas frames via `requestVideoFrameCallback`
   (rAF fallback), ≤4 decode attempts/s; loop stops on result/close/unmount.
3. Payload parsing per §3.8: URL on app origin, `?code=` → `onInviteCode`;
   `?u=` → persona routine; foreign/invalid content → invalid-QR error state.
4. **Persona (context *b*) ruling-3 routine** — implement the §3.8 steps 1–6
   as a **pure, unit-testable module** (e.g.
   `lib/scanner/mutualHandshake.ts`) that takes
   `{ myAddress, memberList, existingChatCounterparts, api }` and returns a
   state machine result: own-QR / foreign / already-mutual (skip POSTs) /
   confirm → POST A→B then B→A (`createHandshake`, status 1) → resolve the
   created chat from a refreshed `listChatsOfUser` → success CTA target
   (`/chats/{address}` or `/chats` fallback); NetworkError/ApiError → retry
   states (idempotency makes retry safe). The component only renders states
   and calls the module.
5. Overlay chrome per §3.8 layout: full-screen fixed, top bar (close +
   title), accent corner-bracket scan frame, context hint, bottom manual
   fallback («Ввести код вручную» / «Найти в списке»), flash-on-result,
   result panel states summary (§3.8).
6. Accessibility per §3.8: `role="dialog"`, `aria-modal`, focus trap,
   Escape closes (camera off), `aria-live` announcements, focus return.
7. Performance: decoder + overlay code-split; **no QR module loads until the
   overlay opens** (dynamic import only in the granted path).

**Files:** `apps/web/src/lib/components/QrScanner.svelte`,
`apps/web/src/lib/scanner/**`, `package.json` (add `jsqr` to `apps/web`),
tests under `apps/web/tests/`.

**Inherited acceptance criteria:** DESIGN §3.8, AC **1–14 verbatim**.

**Task-specific technical criteria:**
- Module tests cover all §3.8 result states with a mocked `api` (own QR,
  foreign, already-mutual skip, double-POST order + idempotent 200 handling,
  network retry).
- Component test (happy-dom): no camera start on open without the CTA tap;
  denied/no-camera states render the exact copy; fallback link closes.
- `navigator.mediaDevices` absence handled as no-camera (never a crash).
- Deps allowed: `jsqr` only (plus existing); nothing QR-related may be
  statically imported by any route chunk other than the scanner/profile.

**Dependencies:** TZ-02 (placeholder + kit). Parallel-safe with TZ-05 (the
radar consumes only the agreed props contract). **Out of scope:** `/host` QR
rendering (TZ-09, helper PNG), `/profile` badge QR encoding (TZ-08, `uqr`).

---

### TZ-05 — `/room` radar (`tz-05`)

**Scope** (DESIGN §3.2):
1. Top bar (room `name`, scan icon-button → `QrScanner` context *b* with
   current member list, live-dot + member count), radar area (Me chip with
   accent-backdrop own avatar + `{N} вокруг вас`, three dashed SVG rings with
   90 s ambient rotation, `aria-hidden`), deterministic node placement:
   ring by relationship (relationships module), angle `fnv1a(address) % 360°`,
   radius jitter ±6% by hash; >14 attendees → 14 lowest-hash nodes + «+N ещё».
2. Node tap → `HandshakeSheet` (kit component) with the per-state actions;
   send/waiting/back/mutual per §3.2; force `refresh()` after actions.
3. Scanner success → force `refresh()` so the counterpart lands on the inner
   ring (AC 14).
4. Poller: `listRoomUsers` + `listHandshakesOfUser` + `listChatsOfUser`
   at 4 s (§2.2 row), mounted in the route file, `stop()` on teardown,
   `refresh()` on `visibilitychange`.
5. States: loading skeleton dots, empty copy, ErrorBanner with dimmed
   last-known positions.
6. Write-through to `chatsSeen` store on each chats poll (badge dot,
   §1.2 — see §3 of this doc for the store contract).

**Files:** `apps/web/src/routes/room/+page.svelte` (rewrite),
`apps/web/src/lib/components/radar/**`, tests under `apps/web/tests/`.

**Inherited acceptance criteria:** DESIGN §3.2, AC **1–14 verbatim**.

**Task-specific technical criteria:**
- Placement math in a pure module with unit tests (same address ⇒ same
  position across ticks; exactly-one-ring per attendee).
- Poller stopped on unmount (test with fake timers).
- No hardcoded hex; rings/nodes per §4.5 (no `.pixel-corners` on rings).

**Dependencies:** TZ-02 (kit, sheet, relationships, scanner placeholder),
TZ-03 (identity guard). **Out of scope:** scanner internals (TZ-04);
People list (TZ-06).

---

### TZ-06 — `/people` list (`tz-06`)

**Scope** (DESIGN §3.3):
1. Header + search (client-side filter on `name`/`public_bio`, debounce
   150 ms, empty-search state with echo + «Сбросить»), filter chips row
   (Все/Отправлены/Добавили вас/Общаемся — single-select).
2. `PersonCard` stack: avatar 56px, name, one-line `public_bio`, right-column
   state pill + relative timestamp per the §3.3 mapping; card-level actions
   (send without sheet via «+»; incoming → expand-in-place with
   «Ответить хендшейком» + «Закрыть» = local dismissal per ruling 2 — in-memory
   dismissed set per page visit, copy never implies rejection; mutual → ▤ to
   the chat).
3. Same 4 s Poller trio as TZ-05 (relationships module shared); keyed
   `{#each}`, in-place updates, stable order (newest `created_at` first, no
   reorder on poll); deletions disappear.
4. States: 3 skeleton cards, empty room, empty search, ErrorBanner dimmed.
5. ≥720px: two-column CSS grid.

**Files:** `apps/web/src/routes/people/+page.svelte` (rewrite),
`apps/web/src/lib/components/people/**`, tests under `apps/web/tests/`.

**Inherited acceptance criteria:** DESIGN §3.3, AC **1–12 verbatim**.

**Task-specific technical criteria:**
- Dismissal set is component state (no persistence — a re-entry re-expands).
- Poller stopped on unmount; poll diffing unit-tested (no duplicate cards).
- Filter/search logic in a pure module with unit tests.

**Dependencies:** TZ-02 (kit incl. HandshakeSheet? — sheet use here is the
node-tap path only if implemented; the card-level actions are self-contained),
TZ-03. **Parallel-safe with TZ-05** (both consume the kit contract).

---

### TZ-07 — `/chats` + `/chats/[address]` (`tz-07`)

**Scope** (DESIGN §3.4, §3.5):
1. `/chats`: header + subtitle, `ChatCard` list (counterpart = participant
   ≠ me; «+N» when ≠2 participants; verbatim `phase`/`scenario` chips;
   relative `created_at`; **no message preview**), empty state + «Найти
   людей» → `/people`, 4 s Poller (`listChatsOfUser` + cached
   `listRoomUsers` for name resolution), ≥720px two-column grid.
2. `/chats/[address]`: fixed header (back control, counterpart avatar+name,
   `phase`/`scenario`/`language` chips), transcript via `listChatMessages`
   2 s Poller (`getChat` on mount/participant change), `MessageBubble`
   mine/theirs per `message.from` vs `identity.userAddress`, speaker name +
   relative time under each bubble, plain text `pre-wrap`, auto-scroll +
   "scroll to bottom" chip, empty/warming-up state, 404 not-found state.
3. **Kickoff flow**: outline button → `ConfirmDialog` (exact copy §3.5) →
   `POST kickoff` → transcript clears, «Первым говорит {speaker name}» note,
   «Агенты готовятся…» in-flow row until first polled message.
4. **Contact-exchange stub** (`ContactStub` from the kit) — disabled,
   `aria-disabled`, never interactive (ruling 4 extension point,
   architecture §8.2).
5. **No-composer enforcement (ruling 4, permanent):** the transcript route
   contains **no input/textarea/send control** — the only interactive
   elements are back, kickoff (+confirm), contact stub. `POST /api/message`
   is never wired into any UI.
6. Back control per §1.3 (history back → fallback `/chats`).
7. `/chats` visit writes `chatsSeen` (badge dot clears, §1.2/AC 6).

**Files:** `apps/web/src/routes/chats/+page.svelte`,
`apps/web/src/routes/chats/[address]/+page.svelte` (both rewrites),
`apps/web/src/lib/components/chats/**`, tests under `apps/web/tests/`.

**Inherited acceptance criteria:** DESIGN §3.4 AC **1–8 verbatim** + §3.5
AC **1–13 verbatim** (§3.5 AC 13 is the no-composer check — enforce in a
component test that asserts the absence of input elements).

**Task-specific technical criteria:**
- Message alignment + speaker resolution in a pure module (unit tests with
  1- and multi-participant chats).
- Auto-scroll behavior unit-tested (scrolled-up ⇒ chip, else auto-bottom).
- Poller (2 s) stopped on unmount (fake timers).
- Kickoff confirm focus-trap test.

**Dependencies:** TZ-02, TZ-03. **Out of scope:** any message sending;
scanner.

---

### TZ-08 — `/profile` badge (`tz-08`)

**Scope** (DESIGN §3.6):
1. Badge card: 96px own avatar (accent backdrop), name (Handjet 28px),
   read-only `language` meta, greeting block + edit, bio rows, interests row
   (mock), two `StatTile`s (handshakes total from `listHandshakesOfUser`,
   dialogs from `listChatsOfUser` — fetch on mount + after mutations, no
   Poller per §2.2).
2. **Personal QR** (`QrCodeBadge`): `uqr` (~3 kB, zero-dep, package `uqr`)
   **statically imported only in this route chunk**; SVG encoding
   `{INVITE_URL_BASE}?u={identity.userAddress}` (~200px, quiet zone 4),
   dark modules `#101213` value via token, light frame
   `--color-qr-frame`; caption copy; not interactive; regenerated only on
   identity change; issues **no network request**.
3. Editors: persona editor (`updateRoomUser`, send all three fields),
   greeting editor (textarea ≤255 + counter, `?`-validation with exact copy
   blocking Save, server 400 surfaced same copy; save via `putUserGreeting`),
   regenerate button (fills editor, saves only on Save), interests editor
   (preset catalog of `Interest {id, label, emoji}` with RU/EN label pairs;
   selection persisted `localStorage bleak.interests`; **no network
   requests ever** — architecture §8.1 shape).
4. Settings block: locale SegmentedControl (same control as `/`), leave room
   → `ConfirmDialog` → `deleteRoomUser` → `clearIdentity()` → `/`; error
   keeps identity with server text inline.
5. States: skeleton badge, ErrorBanner, persona-404 full-card state with
   exit path, mutation spinner + double-submit prevention, transient inline
   success (no toast system).

**Files:** `apps/web/src/routes/profile/+page.svelte` (rewrite),
`apps/web/src/lib/components/profile/**`,
`apps/web/src/lib/stores/interests.ts` (mock store + preset catalog),
`package.json` (add `uqr` to `apps/web`), tests under `apps/web/tests/`.

**Inherited acceptance criteria:** DESIGN §3.6, AC **1–13 verbatim**.

**Task-specific technical criteria:**
- Greeting validation as a pure module (`containsQuestionMark` incl.
  full-width `？`) with unit tests.
- Interests store unit tests (persist/restore, no network).
- QR encoding unit test: `uqr` output decodes (via `jsqr` in test) to
  `{base}?u={address}` (AC 12).
- `uqr` must not appear in any other route's chunk (verify via build output
  grep in a test or build script note — AC 13).

**Dependencies:** TZ-02, TZ-03. **Out of scope:** scanner (consumes the QR,
TZ-04).

---

### TZ-09 — `/host` console (`tz-09`)

**Scope** (DESIGN §3.7):
1. Token gate (masked password input, lazy validation on first create,
   persisted `bleak.hostToken`, «Забыть токен», note copy); rejected-token
   state.
2. Create room form (`name`, `description`, `language` select ru|en;
   **no `max_user`** — flag §6.3) → helper `createRoom` with
   `x-host-token`; pending spinner.
3. Share kit: Handjet 40px code + copy chip, `QrBlock`
   (`inviteQrUrl(code)` `<img>` 256/320px + frame), invite link + copy,
   «Присоединиться как участник» → `/?code={code}`, «Создать другую
   комнату»; restored from `bleak.hostRoom` on revisit.
4. Live room view (5 s Poller: `listRoomUsers` + `getRoom`): summary tiles
   (`{n}/{max_user}`, language), member rows → **drill-down sheet**
   (on-demand: `listHandshakesOfUser` of that member for sent/received
   counts by `from_address` direction + `listChatsOfRoomUser` rows linking
   to `/chats/{address}`), empty state, ErrorBanner dimmed, `getRoom` 404 →
   «Комната удалена.» reset.
5. Room settings (collapsible): `updateRoom` name/description; danger zone
   `deleteRoom` with confirm + warning copy, clears `bleak.hostRoom`.
6. Layout: desktop-first two-column ≥900px (share kit sticky left); single
   column on phone; this page never requires attendee identity (§1.3) but
   does not render attendee radar content.

**Files:** `apps/web/src/routes/host/+page.svelte` (rewrite),
`apps/web/src/lib/components/host/**`,
`apps/web/src/lib/stores/hostSession.ts` (`bleak.hostToken`,
`bleak.hostRoom`), tests under `apps/web/tests/`.

**Inherited acceptance criteria:** DESIGN §3.7, AC **1–12 verbatim**.

**Task-specific technical criteria:**
- Token/store persistence unit tests (masked input never logged/stored
  anywhere but the single key).
- Poller (5 s) stopped on unmount.
- Drill-down fetches are on-demand only (no polling in sheets).

**Dependencies:** TZ-02, TZ-03. **Out of scope:** attendee pages.

---

### TZ-10 — Integration & verification sweep (`tz-10`)

**Scope**: the closing feature before v1 is declared done. One worker runs
the full verification and records the result; bug fixes discovered here go
through the **process bug flow** (bug branches, not this feature branch).

1. **AC sweep**: walk all 100 DESIGN §3 criteria (§3 of this doc maps each to
   its task); record per-criterion pass/fail in
   `docs/verification-v1.md` (committed). Manual checks against a running
   stack (`make dev` + bleak-node running separately by the operator) for
   the flows CI cannot cover (camera, real device).
2. **Unit-testable sweep automation**: add tests that pin cross-cutting
   rules where they are not yet covered: no-composer (already TZ-07),
   i18n parity over **final** dictionaries, mock-shape adherence
   (`Interest` shape), `poller` usage lint (grep-based test: no `new Poller`
   outside route files).
3. **Accessibility pass**: keyboard-only walk of `/`, `/room`, `/people`,
   `/chats`, `/chats/[address]`, `/profile`, `/host`; focus traps (scanner,
   dialogs, sheets); live regions; contrast spot checks vs §2.6; results in
   the verification report.
4. **RU/EN parity & copy audit**: every visible string on every page against
   §4.7; locale switch mid-flow.
5. **Bundle budget check** (performance-first, architecture §1): build +
   report gzip sizes of route chunks; verify no route chunk except
   `/profile` contains the QR encoder, none contains `jsqr`, none contains
   the scanner except its lazy import; record in the report. Budget targets:
   initial route chunk (join) ≤ 60 kB gzip incl. Svelte runtime; any page
   ≤ 80 kB gzip.
6. **PWA validity**: manifest parses, icons resolve, theme-color correct
   (lighthouse/PWA checklist optional, manual check recorded).
7. **Scanner real-device smoke note**: cannot be automated in CI — record in
   the verification report a **pre-event checklist item**: manual smoke on
   iOS Safari + Android Chrome (permission states, `BarcodeDetector` vs
   `jsqr` path, camera light off on close) per DESIGN §6.5.
8. Fix-up allowance: **only** cross-cutting one-liners that span no single
   feature (e.g. a missing i18n key) may be fixed on this branch; everything
   else is filed as bugs via the process.

**Files:** `docs/verification-v1.md`, `apps/web/tests/*` (sweep tests),
minor fix-ups.

**Task-specific technical criteria:**
- `docs/verification-v1.md` lists all 100 ACs with status and evidence
  reference (test name / manual check note).
- All gates stay green (`make lint/test/build`).

**Dependencies:** TZ-03…TZ-09 all merged. **Out of scope:** new features;
redesigns; real-device fixing (record only).

---

## 3. Criteria-coverage map (summary)

| Task | Inherited DESIGN ACs | Count |
| --- | --- | --- |
| TZ-03 | §3.1 1–14 | 14 |
| TZ-04 | §3.8 1–14 | 14 |
| TZ-05 | §3.2 1–14 | 14 |
| TZ-06 | §3.3 1–12 | 12 |
| TZ-07 | §3.4 1–8, §3.5 1–13 | 21 |
| TZ-08 | §3.6 1–13 | 13 |
| TZ-09 | §3.7 1–12 | 12 |
| TZ-10 | verifies all of the above | 100 |
| TZ-01/TZ-02 | task-specific technical criteria only (foundation, no page ACs) | — |

**Coverage: 100/100 §3 criteria mapped to exactly one implementation task;
TZ-10 re-verifies all.** Cross-cutting rules (poller teardown, token-only
colors, i18n parity, no-composer, mocked shapes) are enforced per task as
technical criteria listed in each section above.

---

## 4. Technical constraints recap for workers (short)

1. **Module boundaries** (ARCHITECTURE §1): api-client has zero deps and is
   importable only by `apps/web`; the helper is HTTP-only from the web's
   perspective; no component calls `fetch` directly — use
   `#lib/api/client` / `#lib/api/helper`.
2. **Polling etiquette** (ARCHITECTURE §5, DESIGN §2.2): one `Poller` per
   page, instantiated in the route file only; `stop()` on teardown;
   `refresh()` on mount/visibility; cadences 4 s (room/people/chats), 2 s
   (transcript), 5 s (host); `/` and `/profile` fetch on mount, no poller.
3. **Colors**: tokens only (`tokens.css`); no hardcoded hex in components
   (review error); alpha variants only as derived tokens.
4. **i18n**: every string through `t()`; add to **both** dictionaries;
   parity test fails CI otherwise; RU copy from DESIGN §4.7 verbatim.
5. **Mocked shapes** (ARCHITECTURE §8): `Interest {id,label,emoji}`
   client-side only; contact exchange = disabled stub; persona import =
   client-side copy; avatars = deterministic PixelAvatar, no per-user
   uploads; **`Handshake.status` is never interpreted** (DESIGN §6.1).
6. **No composer anywhere, any version** (ruling 4): `POST /api/message`
   must never be wired into the UI; transcripts are read-only + kickoff.
7. **One instance = one branch = one hash** (AGENTS.md): worker commits only
   on its assigned `feature/<hash>-<slug>`; bug fixes via `bug/<hash>-*`
   after CI failure, per the process.
8. **QA = CI**: `make lint && make test && make build` green after merge is
   the quality gate (no tester role); workers run the three gates locally
   before `ready-for-merge`.
9. **Performance**: code-split everything heavy (scanner decoder, QR
   encoder); transform/opacity animations only; no message previews in
   `/chats`; diff polls before re-render.

---

## 5. Sequencing & parallelism plan

**Critical chain:** TZ-01 → TZ-02 → TZ-03 → (TZ-04 ∥ TZ-05 ∥ TZ-06) →
(TZ-07 ∥ TZ-08 ∥ TZ-09) → TZ-10.

| Wave | Tasks running in parallel | Gate to enter |
| --- | --- | --- |
| 1 | TZ-01 | — |
| 2 | TZ-02 | TZ-01 merged |
| 3 | TZ-03 | TZ-02 merged |
| 4 | TZ-04, TZ-05, TZ-06 | TZ-03 merged |
| 5 | TZ-07, TZ-08, TZ-09 | TZ-03 merged (may start earlier if worker capacity allows — they touch disjoint routes; coordinate with wave 4 only via the kit contract) |
| 6 | TZ-10 | TZ-04…TZ-09 all merged |

**Why this is safe in parallel:**
- TZ-02 delivers every shared contract up front (components, relationships
  module, HandshakeSheet, QrScanner placeholder with final API, chatsSeen
  store) — wave-4/5 tasks touch disjoint route files only.
- TZ-04 vs TZ-05/06: the scanner consumers (TZ-03, TZ-05) integrate against
  the placeholder's public API; TZ-04 swaps the implementation in place. The
  only joint file is `QrScanner.svelte` — owned by TZ-04 after TZ-02.
- TZ-07/08/09 have no file overlap with each other or with wave 4.

**Merge order that keeps `dev` green:** merges may happen in any order *per
wave* (each branch is self-contained and gates-green on its own); the process
merges a `ready-for-merge` task, runs CI, and reopens via the bug flow on
red. Recommended order within waves: TZ-04 after TZ-05/06 if they finish
first (fewest consumer-side surprises), TZ-10 strictly last. No task except
TZ-10 may edit another task's route files; contract violations are bugs, not
cross-edits.

**Worker sizing note:** waves 4–5 are 3-way parallel; if the process runs
more workers, TZ-07/08/09 may pull forward (they do not depend on wave 4).

---

## 6. Definition of Done — v1

v1 is done when **all** of the following hold:

1. **All 100 DESIGN §3 acceptance criteria pass** — verified by TZ-10's
   `docs/verification-v1.md` with per-criterion status (test name or manual
   check note); any failing criterion is a filed, closed bug.
2. **CI green on `dev`**: `make lint && make test && make build` after the
   last merge.
3. **Unit/component suites meaningful**: every pure module (relationships,
   placement, avatar hash, greeting validation, interests store, scanner
   routine, chatsSeen) has tests; interactive components have render tests
   (`@testing-library/svelte`); no empty test files.
4. **i18n complete**: RU/EN parity test green; every visible string on every
   page audited against DESIGN §4.7 (TZ-10 checklist); locale switch works
   mid-flow and persists.
5. **Token discipline**: zero hardcoded hex in `apps/web/src` components;
   `--color-qr-frame` is the only light-surface exception, declared in
   tokens.css.
6. **No-composer invariant**: no input/send control in any chat UI
   (TZ-07 test enforces; TZ-10 re-checks).
7. **Performance budget met** (TZ-10 report): join route chunk ≤ 60 kB gzip
   incl. runtime; any page ≤ 80 kB gzip; QR encoder only in `/profile`'s
   chunk; `jsqr` only as a lazy scanner import; fonts subset-delivered
   (Fontsource unicode-range).
8. **PWA-lite valid**: manifest parses, icons resolve, theme-color set,
   installable on Android Chrome/iOS "Add to Home Screen" (manual check
   recorded).
9. **Scanner real-device smoke recorded** (DESIGN §6.5): iOS Safari +
   Android Chrome checklist in `docs/verification-v1.md` marked as a
   **pre-event mandatory manual step** (camera permission, both contexts,
   camera light off, HTTPS requirement).
10. **a11y basics pass** (§2.6): keyboard-only walk recorded clean; focus
    traps on scanner/dialogs/sheets; live regions announce handshakes and
    poll recovery; contrast spot checks pass.
11. **Ownership trail complete**: every task closed via the task DB with its
    criteria; bug branches attributable to their feature worker; session
    records and logs committed.

---

## 7. Flags for the concept agent (unbuildable/ambiguous in DESIGN — flagged, not resolved)

1. **Chats badge dot without a global poller** (§1.2 vs §2.2): the dot needs
   chat-newness app-wide, but only `/room` and `/chats` poll chat lists.
   TZ interpretation (documented in TZ-02/05/07): the dot updates from pages
   that already poll `listChatsOfUser` (per §2.2's own cadence table) and
   clears on `/chats` visit; on `/people`/`/profile` it may be stale. If the
   owner wants an always-fresh dot, that implies a lightweight global poll —
   a §2.2 rule change the owner should approve.
2. **`/room` now polls three endpoints per 4 s tick** (§3.2 adds
   `listChatsOfUser` to the room/people cadence): heavier than the
   "light payloads" ideal on big rooms; acceptable at v1 room sizes, revisit
   with the websocket evolution trigger.
3. **"14 lowest-hash addresses"** (§3.2): ambiguous whether "lowest" means
   numeric hash value or lexicographic. TZ fixes it as **numeric hash value
   ascending** (deterministic either way; TZ-05 notes the choice).
4. **Package names**: DESIGN says `jsQR` / `uqr`; the npm packages are
   `jsqr` and `uqr` — TZ-04/TZ-08 pin those names; sizes match DESIGN's
   estimates.
5. **`?u=` deep link on `/` with an identity** runs the scanner's
   mutual-handshake routine *without* the confirm card? DESIGN §3.1 AC 14
   says "runs the §3.8 mutual-handshake routine (success or per-case
   states)" while §3.8's routine includes a confirm card — TZ interprets the
   deep link as running the **full routine including confirm** (safest
   reading; consistent with §3.8 step 3). TZ-03 implements accordingly.
6. **Host drill-down counts** (§3.7): `listHandshakesOfUser` returns all
   handshakes for a member — sent/received split is by `from_address`
   direction; no ambiguity, noted as the computation contract for TZ-09.
7. **`max_user`/`language` unsettable** (§6.3): already resolved by DESIGN as
   read-only display; no v1 impact beyond UI copy (both tasks comply).

*(Flag 5 is the only true ambiguity found; the chosen reading is conservative
and reversible. Nothing in DESIGN proved unbuildable with the current
backend contract.)*

---

*End of TZ.md — architect acff3ab8, TZ pass 2026-11-14. The process agent owns
the build loop after owner TZ approval; per-task sessions get their own
hashes via `open-feature.sh` with `tz-section` pointing back here.*
