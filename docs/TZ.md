# bleak-web — TZ (Technical Task for the Build Loop)

Architect instance: `acff3ab8` (resumed 2026-11-14 for the TZ pass). Authority
chain: `docs/Concept.md` (incl. §1c owner rulings, backend TODO ledger) →
`docs/ARCHITECTURE.md` (merged) → `docs/DESIGN.md` **revision 2** (owner-
approved 2026-11-14) → **this document**.

> **Document map (dated pointer note, 2026-11-24):** Part I (§1–§7) = the v1
> build loop (delivered); Part II (§8) = the v2 credentials build loop
> (delivered); **Part III (§9, appended 2026-11-24)** = the host admin panel
> build loop (Concept §54 / DESIGN rev. 4) — the newest part at the end of the
> file is the active loop.

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

---

# Part II — v2 credentials build loop (TZ pass 2, architect `81037a13`, 2026-11-15)

> **Supersession note (2026-11-24, Part III):** the host slice of **TZ2-07
> Part B** (the rev. 3 single-page console, delivered) is **superseded by
> Part III's `tz13` route-tree round** (Concept §54 / DESIGN rev. 4
> §3.7.1–§3.7.5). Its delivered code is reworked by TZ13-02/TZ13-03/TZ13-04;
> the old host tasks (TZ-09, TZ2-11, TZ2-07's host half) are **not reopened**
> — the process opens fresh `tz13-*` cards. The pre-authorized `tz2-07a`
> follow-up (flag 6.9a, rule B) is unchanged and remains the only
> backend-gated UX piece (§9.4).

> **Status note:** Part I (§1–§7) is the v1 TZ — **all v1 tasks TZ-01…TZ-10
> are delivered and closed** (v1 shipped 2026-11-15, owner ran it). This part
> extends the document with the v2 build loop for the owner-approved
> credentials client scope. **Do not regress v1:** every v2 task touches only
> what DESIGN rev. 3 / ARCHITECTURE §10 assign to it; unmentioned v1 behavior
> must keep passing its v1 acceptance criteria.
>
> **Restructure note (2026-11-15, owner directive):** after wave 1
> (TZ2-01…TZ2-04) was delivered, the owner directed the **remaining nine
> tasks be consolidated into 3–4 larger tasks**. Done: the remaining work is
> now **TZ2-05…TZ2-08** (credential plumbing · attendee flows · profile &
> host · verification), each consolidating the absorbed `tz2-NN` tasks whose
> scope bullets and task-specific criteria are preserved **verbatim**,
> grouped under the absorbed id (§8.2). Nothing was weakened: all 118 DESIGN
> rev. 3 ACs still map to exactly one task, all §8.4 rules stand, and
> one-consolidated-task = one worker instance = one branch (its bug rounds
> carry that single hash). Wave 1 history is not renumbered — TZ2-01…TZ2-04
> stay delivered as opened.

Authority chain: `docs/Concept.md` §6 (owner-approved) →
`docs/ARCHITECTURE.md` §10 (merged) → `docs/DESIGN.md` **rev. 3** (owner-
approved 2026-11-15; 118 acceptance criteria) → **Part II**. Format follows
Part I: each task = **one worker instance = one branch `feature/<hash>-<slug>`
= one task card** (`open-feature.sh <slug>`, `tz-section` = the `tz2-NN`
reference below); inherited acceptance criteria are listed **verbatim by
number** — the worker reads the referenced DESIGN rev. 3 section for the full
criterion text.

## 8. v2 work breakdown (build order)

### 8.1 Task table

| # | Task (`tz-section`) | Slug (branch suffix) | Size | Depends on | DESIGN rev. 3 § | Inherited ACs |
| --- | --- | --- | --- | --- | --- | --- |
| TZ2-01 | i18n rev. 3 copy table (+37 keys) | `i18n-v2` | S | — | 4.7 | — |
| TZ2-02 | api-client v2: types, Bearer credentials, 9 new methods, attachment-policy test | `api-client-v2` | L | — | (endpoint tables §3.1–§3.8; ARCH §10.2) | — |
| TZ2-03 | crypto secrets module | `crypto-secrets` | S | — | (consumers §3.6/§3.7; ARCH §10.5) | — |
| TZ2-04 | stores v2: identity+token, hostSession reshape, tokenVault, mutualCode | `stores-v2` | M | — | (§2.8/§3.1/§3.7 consumers; ARCH §10.4) | — |
| TZ2-05 | **credential plumbing**: web API layer (`api`/`hostApi`/`apiRaw`, 401 gates, invite-resolve seam) + helper trim (stateless QR) — absorbs `tz2-05`, `tz2-12` | `credential-plumbing` | L | (wave 1 merged) | (consumers §2.8–§3.7; ARCH §10.3, §10.10) | — |
| TZ2-06 | **attendee flows v2**: scanner v2 + join/vault import + handshake surfaces + chats/host-view fallback — absorbs `tz2-06`, `tz2-07`, `tz2-08`, `tz2-09` | `attendee-flows-v2` | XL | TZ2-05 | 3.8, 3.1, 3.2, 3.3, 3.4, 3.5 (+2.7/2.8/2.9) | §3.8 1–17 + §3.1 1–19 + §3.2 1–15 + §3.3 1–13 + §3.4 1–8 + §3.5 1–15 (87) |
| TZ2-07 | **profile & host v2**: live badge QR + token rotation + host console (creation-token gate, invite management, room-token drill-down) — absorbs `tz2-10`, `tz2-11` | `profile-host-v2` | XL | TZ2-05 | 3.6, 3.7 (+2.8) | §3.6 1–15 + §3.7 1–16 (31) |
| TZ2-08 | verification sweep v2 — absorbs `tz2-13` (unchanged in scope) | `verify-v2` | L | TZ2-05…TZ2-07 all merged | 3.9 (all) | re-verifies all 118 |

*Wave 1 rows (TZ2-01…TZ2-04) are **✅ delivered** (merged to `dev` by owner
approval, 2026-11-15); their original per-task sections below are kept
verbatim as the delivered record — history is not renumbered.*

**Coverage: all 118 DESIGN rev. 3 §3 ACs map to exactly one implementation
task** (§3.1, §3.2, §3.3, §3.4, §3.5 → TZ2-06 Parts A–D; §3.6 → TZ2-07
Part A; §3.7 → TZ2-07 Part B; §3.8 → TZ2-06 Part A); TZ2-08 re-verifies all
118. The plumbing task (TZ2-05) carries only its own technical criteria, as
in Part I.

**i18n placement decision (unchanged):** the copy table was a **foundation
task (TZ2-01, delivered)** mirroring Part I's TZ-01 — page tasks wire their
own keys; the verification task audits usage.

### 8.2 Per-task TZ sections

### TZ2-01 — i18n rev. 3 copy table (`tz2-01`) — ✅ delivered

**Scope** (DESIGN §4.7): reconcile `apps/web/src/lib/i18n/{ru,en}.ts` against
the rev. 3 table — **add every new key verbatim in both languages** (the +37:
`host.gate.*`, `host.session_reset`, `host.invites.*` (title, hint, mint,
four presets, `expires_in`, revoke, revoked), `host.rotate_room.*`,
`host.drill.*`, `auth.401.notice`, `join.error.invite`, `join.import.*`
(title, subtitle, empty, `saved_at`, dead), `hs.income_limit`,
`scan.code_used`, `profile.qr.onetime|refreshed|aria`, `profile.rotate.*`
(row, title, body, cta, done), `chat.host_view`); **rename**
`host.token.label` → `host.gate.label` (and drop the retired key after
grepping that no source file still references it); keep all still-valid v1
keys untouched. Interpolation params (`{n}`, `{q}`, `{name}`, `{date}`,
`{room}`, `{time}`) use the existing `translate(…, params)` mechanism.

**Files:** `apps/web/src/lib/i18n/{ru,en}.ts`, `apps/web/tests/i18n.test.ts` (extended).

**Task-specific technical criteria:**
- Parity test green over the enlarged dictionaries (every key in both).
- Every §4.7 rev. 3 key present verbatim; `host.token.label` no longer
  referenced anywhere (`grep` clean) after the rename.
- No page wiring in this task (page tasks import their keys).

**Dependencies:** none. **Out of scope:** using the keys in pages.

---

### TZ2-02 — `@bleak/api-client` v2 (`tz2-02`) — ✅ delivered

**Scope** (ARCH §10.2 — the HOW is already decided there; this task implements
it):
1. `src/types.ts`: `CreateUserRequestV2` (`name`, bios, `invite_code`,
   `token`), `CreateRoomRequestV2` (+ `token`), `MutualHandshakeRequest`,
   `MutualCodeRegistration` (`mutual_code_hash`), `TokenRotationRequest`,
   `InviteMintRequest` (`expires_at?`), `Invite`, and
   `User.mutual_code_live?: boolean`.
2. `src/client.ts`: optional per-call credential on every method that must
   authenticate (final `options?: { token?: string }` or explicit argument) →
   attaches `Authorization: Bearer <token>` when present; **public reads get
   no token parameter at all** (type-level). New methods per the §10.2 table:
   `createMutualHandshake`, `registerMutualCode`, `rotateUserToken`,
   `rotateRoomToken`, `mintInvite`, `listInvites`, `revokeInvite`; updated
   `createRoom(request, createToken)` (creation token in the header) and
   `createRoomUser(room, CreateUserRequestV2)`.
3. **Attachment-policy test** (table-driven, in `packages/api-client/tests/`):
   (a) each credentialed method sends the Bearer header when a token is
   passed; (b) public reads accept no token; (c) `registerMutualCode` sends
   the **hash**, never a raw code; (d) 401/403/410 map to `ApiError.status`
   verbatim (plain-text bodies preserved).
4. **Contract-caveat reconciliation** (ARCH §10.13.1 — see §8.4): implement
   the *TBD* names per the proposed shapes (`x-create-token` header;
   `mutual_code_hash` body field; invite mint response
   `{ code, created_at, expires_at }`); if bleak-node's updated swagger.json
   (WP-6) is available at task time, reconcile against it; every TBD spot
   carries a `// TBD(WP-6): <what>` comment — all isolated in this package.

**Files:** `packages/api-client/src/{types,client}.ts`,
`packages/api-client/tests/client.test.ts`.

**Task-specific technical criteria:** policy test (a)–(d) green; each TBD
name has exactly one mapping point + a `TBD(WP-6)` marker; no new runtime
dependency introduced.

**Dependencies:** none. **Out of scope:** web-layer auto-injection/gates
(TZ2-05); page wiring.

---

### TZ2-03 — crypto secrets module (`tz2-03`) — ✅ delivered

**Scope** (ARCH §10.5): `apps/web/src/lib/crypto/secrets.ts` —
`generateTokenSecret()` (32 random bytes → base64url, no padding),
`generateMutualCode()` (16 bytes → base64url), `sha256Hex(input)` (subtle
digest → lowercase hex). Injectable source object
(`{ randomBytes(n), digestHex(data) }`) with the WebCrypto default; module
docs carry the secure-context note (HTTPS = same requirement as the camera;
no polyfill).

**Files:** `apps/web/src/lib/crypto/secrets.ts`, `apps/web/tests/crypto-secrets.test.ts`.

**Task-specific technical criteria:** fixed-fake determinism tests;
base64url charset/length/no-padding assertions; SHA-256 test vectors (NIST
examples) + a pure-JS reference cross-check; generation length asserts
(32 B → 43 chars, 16 B → 22 chars).

**Dependencies:** none. **Out of scope:** calling sites (TZ2-07/10/11).

---

### TZ2-04 — stores v2 (`tz2-04`) — ✅ delivered

**Scope** (ARCH §10.4):
1. `lib/stores/identity.ts`: `Identity { roomAddress, userAddress, token }`;
   `initIdentity()` **drops a persisted identity without `token`** (v1
   legacy — ARCH §10.4 decision); `saveIdentity` unchanged shape-wise.
2. `lib/stores/hostSession.ts`: reshape to `{ roomAddress, roomToken, code }`
   — remove the `hostToken` writable, `saveHostToken`, `forgetHostToken`,
   and the `HostRoomRef.roomName`/`inviteUrl` fields; room-token rotation
   rewrites the entry in place (`saveHostRoom`).
3. **New `lib/stores/tokenVault.ts`**: append-only
   `VaultEntry { roomAddress, userAddress, token, name?, savedAt }` under
   `bleak.tokenVault`; API = `appendVaultEntry`, `updateVaultEntryToken`
   (rotation, in place, keyed by room+user), `listVaultEntries`; **no remove
   API exists**.
4. **New `lib/stores/mutualCode.ts`**: `{ userAddress, code } | null` under
   `bleak.mutualCode`; load-time validation against `identity.userAddress`
   (mismatched/stale → null → treated as "no code"); cleared with the
   identity.
5. Drop the `bleak.pendingCode` sessionStorage key if still referenced
   (v1 TZ already superseded it).
`chatsSeen.ts` / `interests.ts` untouched.

**Files:** `apps/web/src/lib/stores/{identity,hostSession,tokenVault,mutualCode}.ts`,
tests (`host-session.test.ts` updated; new `token-vault.test.ts`,
`mutual-code.test.ts`, identity legacy-drop test).

**Task-specific technical criteria:** persistence round-trips for all four
keys; init-time legacy drop test (v1-shaped identity → null); vault
append-only invariant test (no exported mutator can delete; rotation
rewrites only the matching entry's token); mutualCode validation-on-load
test; **storage-key inventory test**: exactly `bleak.identity`,
`bleak.hostRoom`, `bleak.tokenVault`, `bleak.mutualCode` carry credentials
(no other key is written by these modules).

**Dependencies:** none. **Out of scope:** gates (TZ2-05), page consumers.

---

### TZ2-05 — credential plumbing (`credential-plumbing`) — absorbs `tz2-05`, `tz2-12`

One worker owns the transport layer end-to-end: the web API contexts/gates/
seam **and** the helper-service trim (the layer consumes the helper's QR
endpoint; retiring the mapping in the same task keeps the surface coherent —
rationale for the grouping). No inherited page ACs — technical criteria only.

#### Part A — web API layer: contexts, gates, seam (absorbed `tz2-05`)

**Scope** (ARCH §10.3):
1. Rebuild `apps/web/src/lib/api/client.ts` over the TZ2-02 client: export
   **`api`** (attendee/persona context), **`hostApi`** (host/room context),
   **`apiRaw`** (ungated underlying client — restricted, see 4).
2. Auto-injection maps: `PERSONA_TOKEN_METHODS` (persona mutations, gated
   reads, handshake sends, mutual call, rotations, chat reads in attendee
   context) reads `identity.token`; `ROOM_TOKEN_METHODS` (room
   settings/delete, invite management, room rotations, chat reads/clear/
   kickoff in host context) reads `hostSession.roomToken`. Pages never pass
   tokens manually.
3. **Explicit-token override**: `api` methods additionally accept
   `{ token }` to override auto-injection — the **only documented v2 use** is
   the vault-import read (the old persona's stored token, §3.1; DESIGN's
   state table sends a stale vault token's 401 through the global gate, so
   the override does not bypass it).
4. **401 gates:** `api` catch on `ApiError.status === 401` →
   `clearIdentity()` + clear `mutualCode` + `sessionStorage.setItem('bleak.authNotice','1')`
   → `goto('/')` → rethrow. `hostApi` catch on 401/403 → `clearHostRoom()` +
   `sessionStorage.setItem('bleak.hostReset','1')` → rethrow (the host page
   renders the §3.7 reset notice from that key — same consume-on-render
   pattern as `bleak.authNotice`).
5. **Invite-resolve seam** (ARCH §10.6, Concept §6.9b): new
   `lib/api/invite-resolve.ts` exporting `resolveInviteCode(code): Promise<{ roomAddress: string }>`
   with the concrete adapter isolated in one function (backend shape TBD);
   invalid/unknown-code errors map to the join error kinds (`malformed` /
   `not_found`).
6. Trim `lib/api/helper.ts`: **remove** `resolveInvite` + `createRoom` and
   their types; keep `inviteQrUrl` (the helper's stateless QR — Part B of
   this task).

**Files:** `apps/web/src/lib/api/{client,helper,invite-resolve}.ts`, tests
(new `api-contexts.test.ts`; `join-flow.test.ts` fixtures updated where they
reference the removed helper calls — wiring only, join UX is TZ2-06 Part B).

**Task-specific technical criteria:** injection-map unit test mirrors the
ARCH §10.2 policy table (each credentialed call carries the right token;
public reads carry none); gate tests with a mocked `goto` (identity +
mutualCode cleared, notice key set, navigation queued, error rethrown);
`hostApi` gate test: 401/403 on a room-token call clears `bleak.hostRoom` +
sets `bleak.hostReset` (DESIGN §3.7 host reset — attendee identity never
touched); `apiRaw` usage restriction enforced by a grep test (importers = the web api
module + the transcript fallback (TZ2-06 Part D) only).

#### Part B — helper trim: stateless QR (absorbed `tz2-12`)

**Scope** (ARCH §10.10 — the exact delete/keep table): delete
`POST /rooms`, `GET /rooms/:code`, the `x-host-token` gate, `src/db.ts`
(invites SQLite store), code **minting** in `codes.ts` (keep the 6-digit
validator), the `bleakFetch` dep, and env `HELPER_HOST_TOKEN` /
`HELPER_DB_PATH` / `BLEAK_NODE_URL` (helper no longer talks to bleak-node).
Rework `GET /rooms/:code/qr` to be **stateless**: validate 6 digits (no
mapping lookup — unknown codes are renderable), return the PNG of
`{INVITE_URL_BASE}?code={code}`. Keep `GET /health`. Trim
`.env.example` accordingly (`INVITE_URL_BASE` stays).

**Files:** `apps/helper/src/{app,env,codes}.ts` (delete `db.ts`),
`apps/helper/tests/{helper,codes}.test.ts` (rewrite), `.env.example`.

**Task-specific technical criteria:** helper tests cover health + stateless
QR only (QR encoder stays mocked/injectable; a 6-digit code renders its
URL; malformed rejected); no SQLite import remains; no env var for a host
token remains; `make test -w @bleak/helper` green with the shrunken suite.

**Consolidated dependencies:** merged wave 1 only (TZ2-02 + TZ2-04,
delivered). **Consolidated out of scope:** page flows (TZ2-06, TZ2-07);
scanner module.

---

### TZ2-06 — attendee flows v2 (`attendee-flows-v2`) — absorbs `tz2-06`, `tz2-07`, `tz2-08`, `tz2-09`

One worker owns the whole attendee surface: the server-mediated scanner (A),
the join/vault flow (B), the radar/people handshake surfaces (C) and the
chats/transcript viewer fallback (D). The former scanner↔join deep-link
coupling (§3.1 AC 19) becomes **intra-task sequencing** (build Part A's
module before Part B's deep-link wiring) — the grouping's main rationale.
The shared surfaces (`HandshakeSheet`, `PersonCard`) belong here, keeping
the two former owners in one pair of hands.

**Inherited acceptance criteria:** DESIGN §3.8 AC **1–17** + §3.1 AC **1–19**
+ §3.2 AC **1–15** + §3.3 AC **1–13** + §3.4 AC **1–8** + §3.5 AC **1–15**
(87 total) — all verbatim per part below.

#### Part A — scanner v2 (absorbed `tz2-06`)

**Scope** (DESIGN §3.8 rewritten + §2.7 amendment; ARCH §10.7):
1. **Replace** `lib/scanner/mutualHandshake.ts` (the v1 two-POST routine) —
   new `lib/scanner/mutual.ts`, pure + unit-tested, callable standalone (the
   `/` deep-link machine — Part B — reuses it). Input
   `{ myAddress, memberList, mutualCode, api }`; the `api` context
   auto-injects the scanner's Bearer. State machine: own-QR → info; foreign
   (not in member list) → error; **no already-mutual precheck** (the code
   burns server-side even for existing pairs); confirm → **one**
   `createMutualHandshake(token, { user_address, mutual_code })`; branches:
   success (resolve the chat from a refreshed gated `listChatsOfUser`,
   `/chats/{address}` or `/chats` fallback) / **410 stale-code** /
   **403 income-rule** / NetworkError retry / other ApiError / 404 / 401
   (surfaces to the §2.8 gate).
2. `lib/scanner/payload.ts`: parse `u` **and** optional `m`; invite `?code=`
   and the invalid-QR state unchanged.
3. `QrScanner.svelte`: result panel gains the 410 and 403 states (exact §2.9
   copy; 410 has **no Retry for the dead code** — only «Сканировать снова» +
   manual fallback; 403 copy must not imply the scanned badge burned);
   camera lifecycle, permission states, a11y, code-splitting unchanged from
   v1 (re-assert by existing tests).

**Files:** `apps/web/src/lib/scanner/{mutual,payload}.ts` (delete
`mutualHandshake.ts`), `apps/web/src/lib/components/QrScanner.svelte`,
tests (`mutual-handshake.test.ts` rewritten; `qr-payload.test.ts`,
`qr-scanner.test.ts` extended).

**Inherited acceptance criteria:** DESIGN §3.8, AC **1–17 verbatim**.

**Task-specific technical criteria:** module tests cover every §3.8 result
state with a mocked api (single mutual call — assert **one** POST, not two;
410/403/404/NetworkError branches; already-mutual success path); payload
round-trip `u`+`m`; component test: result-panel state rendering + no Retry
on 410; existing camera/a11y tests stay green (no regression).

#### Part B — join v2 + vault import (absorbed `tz2-07`)

**Scope** (DESIGN §3.1 rewritten; ARCH §10.6):
1. Code resolution via the **seam** (`resolveInviteCode`); room preview via
   public `getRoom` + `listRoomUsers`; code kept in the in-memory join state.
2. **Persona creation** (§3.1 step 3a): `generateTokenSecret()` →
   `createRoomUser(room, CreateUserRequestV2)` (no auth header) → on success
   `saveIdentity({ roomAddress, userAddress, token })` **+ `appendVaultEntry`**
   → `/room`. Invalid/expired invite-code rejection → the §2.9 inline error
   («Код приглашения недействителен или истёк.»), no identity/vault writes;
   409 keeps the v1 state.
3. **Vault import** (§3.1 step 3b): `VaultList`/`VaultRow` from
   `listVaultEntries()` — **never** `GET /api/room`; selecting an entry
   fetches the old persona **with its stored token** (explicit-token
   override via `api`, incl. `private_bio`) → prefill → submit re-creates
   with `invite_code` + a **new** token; dead-entry error state (server
   404/401/403) — the vault entry is never removed; empty-vault copy.
4. **401 notice card** (§2.8): `/` consumes `bleak.authNotice` on mount,
   renders `NoticeCard` (lock glyph, binding copy, `aria-live="polite"`),
   clears the key; no retry/reload control.
5. **Resume card**: "join another event" clears identity **and**
   `mutualCode`, keeps the vault.
6. **Deep links** (§3.1 AC 19): extend `parseJoinDeepLink` with
   `{ kind: 'user', userAddress, mutualCode? }`; with an identity,
   `?u&m` runs the Part A mutual module **including the confirm card**
   rendered in the join flow (result states reused); `?u=` alone runs the
   single-direction confirm → one `POST /api/handshake` (my Bearer,
   auto-injected) with the §2.9 income-rule state on 403; without an
   identity both are ignored.
7. Drop `sessionStorage` pending-code handling if any remnant remains.

**Files:** `apps/web/src/routes/+page.svelte`,
`apps/web/src/lib/components/join/**` (`JoinFlow`, `PersonaForm`,
`NoticeCard`; `ImportRooms`/`ImportUsers` replaced by `VaultList`/`VaultRow`),
`apps/web/src/lib/join.ts` (step machine: `'rooms'`/`'users'` → `'vault'`;
deep-link parser), tests (`join-machine.test.ts`, `join-flow.test.ts`
rewritten).

**Inherited acceptance criteria:** DESIGN §3.1, AC **1–19 verbatim**.

**Task-specific technical criteria:** creation test asserts the exact body
(`invite_code` + generated `token`, no auth header) and that identity+vault
are written **only** after 2xx; import read uses the stored token (assert
the Bearer equals the vault entry's); deep-link machine tests for both
variants incl. the no-identity ignore; the confirm card is a
focus-trapped dialog (reuse `ConfirmDialog` semantics).

#### Part C — attendee handshake surfaces v2 (absorbed `tz2-08`)

**Scope** (DESIGN §3.2 + §3.3 deltas; §2.9):
1. **Credentialed wiring** (mostly automatic via the `api` context — verify,
   don't re-implement): `POST /api/handshake` carries the persona Bearer;
   the 4 s polls of `listHandshakesOfUser` + `listChatsOfUser` are gated
   reads with the Bearer.
2. **Income-rule state (§2.9, 403)** in the shared surfaces:
   `HandshakeSheet` (inline in the sheet; button returns to active; node
   stays on its ring; no optimistic "sent") and `PersonCard` (inline below
   the name line, `aria-live="polite"`; card stays in the "none" state).
   Copy `hs.income_limit` + muted server text when present. Every other
   send-failure path keeps the v1 inline-error behavior.
3. Everything else in §3.2/§3.3 is v1 behavior **re-asserted** — the task
   proves it still passes, it does not redesign it.

**Files:** `apps/web/src/routes/room/+page.svelte`,
`apps/web/src/routes/people/+page.svelte`,
`apps/web/src/lib/components/HandshakeSheet.svelte`,
`apps/web/src/lib/components/people/PersonCard.svelte`, tests
(`room-radar.test.ts`, `people-page.test.ts`, `handshake-sheet.test.ts`
extended).

**Inherited acceptance criteria:** DESIGN §3.2, AC **1–15 verbatim** +
DESIGN §3.3, AC **1–13 verbatim**.

**Task-specific technical criteria:** mocked-fetch integration test
asserting the Bearer header on the handshake POST and on the gated polls
(through the `api` singleton, not raw fetch); 403-state tests for both
sheet and card (copy, `aria-live`, no state flip, no further request);
existing placement/relationships/poller tests stay green.

#### Part D — chats + transcript viewer fallback (absorbed `tz2-09`)

**Scope** (DESIGN §3.4 + §3.5 rewritten; ARCH §10.3 escape hatch):
1. `/chats`: gated `listChatsOfUser` poll (Bearer automatic); v1 card
   behavior re-asserted; `chatsSeen` write unchanged.
2. `/chats/[address]`: transcript reads (`getChat`, `listChatMessages`)
   with the persona Bearer; **viewer fallback** (DESIGN §3.5): on
   `ApiError` 401/403 **where `bleak.hostRoom.roomToken` exists** → retry
   **once** with the room token via `apiRaw`; on success engage **host-view
   mode** (muted chip «Наблюдение хоста» in the header) which **persists
   for the page session** — subsequent ticks go straight to the room token
   (never re-tripping the attendee gate); a host-context 401 there
   replicates the `hostApi` gate (clear `bleak.hostRoom` +
   `bleak.hostReset` flag) and renders the error state — **never** touches
   attendee identity. Without a stored room token, a 401 is **not caught**
   — the §2.8 global gate fires (AC 15). Kickoff uses the persona Bearer
   (or the room token in host-view mode).
3. No-composer invariant re-asserted (AC 13) — the existing component test
   must keep passing unchanged.

**Files:** `apps/web/src/routes/chats/+page.svelte`,
`apps/web/src/routes/chats/[address]/+page.svelte`,
`apps/web/src/lib/chats/view.ts` (viewer-mode helper if needed), tests
(`transcript-page.test.ts`, `chats-page.test.ts` extended).

**Inherited acceptance criteria:** DESIGN §3.4, AC **1–8 verbatim** +
DESIGN §3.5, AC **1–15 verbatim**.

**Task-specific technical criteria:** fallback unit tests (persona 401 +
room token → one retry, host-view chip, session persistence of the mode;
no room token → gate fires — assert identity cleared via the gate path,
not a transcript error UI); 2 s poller stopped on teardown (existing
fake-timer test stays green); no-composer test green.

**Consolidated dependencies:** TZ2-05 (layer + seam), TZ2-03 (crypto —
merged wave 1). **Consolidated out of scope:** profile (TZ2-07 Part A),
host console (TZ2-07 Part B), helper service (TZ2-05 Part B).

---

### TZ2-07 — profile & host v2 (`profile-host-v2`) — absorbs `tz2-10`, `tz2-11`

One worker owns the two credential-heavy consoles: the attendee profile
(live badge QR + persona-token rotation, Part A) and the host console
(creation-token gate + invite management + room-token drill-down, Part B).
Disjoint route files, one credential mental model (token generation,
rotation, masked entry) — the grouping's rationale.

**Inherited acceptance criteria:** DESIGN §3.6 AC **1–15** + §3.7 AC **1–16**
(31 total) — verbatim per part below.

#### Part A — profile v2: live QR + rotation (absorbed `tz2-10`)

**Scope** (DESIGN §3.6 rewritten; ARCH §10.8):
1. All profile calls persona-Bearer (auto-injected); the 4 s badge poll of
   the token-gated `getRoomUser` watches **`mutual_code_live`**.
2. **Live QR:** badge payload `{base}?u={userAddress}&m={mutualCode}` from
   the `mutualCode` store (`qr.ts` gains the `m` part); when the flag reads
   false → `generateMutualCode()` → `registerMutualCode(room, address,
   token, sha256Hex(code))` (body = **hash only**) → update the store →
   re-render with the **rotation micro-animation** (two-phase 320 ms,
   transform/opacity only; reduced-motion → instant swap) + transient
   «QR обновлён» chip (`aria-live`, auto-hide 2 s); registration failure
   keeps the last QR and retries next tick. **No code yet (first load /
   stale store):** register immediately on load; the QR block shows the
   badge skeleton until a code exists (never render a broken payload).
3. **Token rotation UI** (§3.6 settings): confirm dialog (lockout copy) →
   `rotateUserToken(room, address, identity.token, newRaw)` → replace
   `identity.token` + rewrite the matching `tokenVault` entry in place →
   «Ключ обновлён»; identity/vault written **only after 2xx**; 401 → the
   §2.8 gate; 403 → inline server text, identity kept.
4. Leave room clears identity **and** `mutualCode`; QR `role="img"` +
   `aria-label` per §3.6.

**Files:** `apps/web/src/routes/profile/+page.svelte`,
`apps/web/src/lib/components/profile/**` (`QrCodeBadge`, `qr.ts`, settings
row), tests (`profile-page.test.ts`, `profile-domain.test.ts`,
`qr-roundtrip.test.ts` extended for `u`+`m`).

**Inherited acceptance criteria:** DESIGN §3.6, AC **1–15 verbatim**.

**Task-specific technical criteria:** hash-only registration test (raw code
never in any request body; QR decode round-trip via `jsqr` yields
`u` + `m`); rotation test (Bearer = current token, body = new raw token;
identity+vault updated only after 2xx); poller stopped on teardown
(4 s); micro-animation transform/opacity-only + reduced-motion skip;
`uqr` still code-split to this route only (build-grep criterion, re-assert).

---

#### Part B — host console v2 (absorbed `tz2-11`)

**Scope** (DESIGN §3.7 rewritten; ARCH §10.9):
1. **Creation-token gate** (§3.7.2): masked input (`type="password"`,
   `autocomplete="off"`), **never persisted anywhere** (no storage key —
   enforced by test); rejected/consumed token (401/403 on create) →
   «Токен отклонён.» + server text, value stays masked, nothing stored.
   Copy per the renamed `host.gate.*` keys.
2. **Create room:** generate the room token (`generateTokenSecret()`) →
   `createRoom(CreateRoomRequestV2, createToken)` (creation token header +
   room token in body) → `bleak.hostRoom = { roomAddress, roomToken, code }`.
3. **Share kit:** restored from `bleak.hostRoom`; room `name` via public
   `getRoom`; invite link computed client-side
   (`{INVITE_URL_BASE}?code={code}`); QR `<img>` from the **stateless**
   helper endpoint (TZ2-05 Part B); «Присоединиться как участник» unchanged.
4. **Invite management block:** `listInvites` / `mintInvite` (expiry
   presets 1 h / 24 h default / 7 d + custom `datetime-local`, min = now) /
   `revokeInvite` (no confirm; reversible); `InviteRow` per active code with
   copy / QR toggle (`inviteQrUrl(code)`) / link copy / revoke; revoked and
   expired codes never render; failures inline with retry; **the mint
   response field names are a TBD(WP-6) mapping point** (§8.4).
5. **Live view:** public 5 s poll (`listRoomUsers` + `getRoom`); member
   drill-down (on-demand, room token): dialogs read via plain
   `getChat`/`listChatMessages` per chat address; **chat discovery is
   6.9a-blocked** — until the amendment the sheet renders the empty
   drill-down copy + the muted 6.9a hint («Список диалогов участника
   появится вместе с серверным обновлением (флаг 6.9a).»), **never
   invented listings**; dialog rows link to `/chats/{address}` (the
   TZ2-06 Part D host-view context) and carry «Очистить историю» (confirm →
   `clearChatHistory`, room token) and «Запустить заново» (§3.5 kickoff
   copy → `kickoffChat`, room token). **No handshake counts anywhere** (AC 11).
6. **Host settings:** `updateRoom` (room token); «Сгенерировать ключ
   комнаты» → confirm → `rotateRoomToken` → in-place
   `bleak.hostRoom.roomToken` update; danger-zone delete → confirm →
   `deleteRoom` → clear `bleak.hostRoom` → create form.
7. **Host reset state:** the `bleak.hostReset` flag (set by the `hostApi`
   gate, TZ2-05) renders the §3.7 notice («Доступ к комнате отозван…»,
   `aria-live="polite"`) above the creation-token gate, consumed on render;
   `getRoom` 404 → «Комната удалена.» reset.

**Files:** `apps/web/src/routes/host/+page.svelte`,
`apps/web/src/lib/components/host/**` (`TokenGateCard`, `CreateRoomForm`,
`ShareKit`, new `InviteManager`/`InviteRow`, `LiveRoom`,
`MemberDrillDown` rework, `hostLogic.ts`),
`apps/web/src/lib/stores/hostSession.ts` consumers, tests
(`host-console.test.ts`, `host-session.test.ts` rewritten/extended).

**Inherited acceptance criteria:** DESIGN §3.7, AC **1–16 verbatim**.

**Task-specific technical criteria:** create-flow test asserts the creation
token appears **only** in the request header (never in a body, a log call,
or any storage write — grep + mock assertions); room token generated client-
side and stored only in `bleak.hostRoom`; drill-down fetches on demand only
(no poller in sheets); 6.9a hint state test (empty + hint copy; no invented
data); rotation in-place update test; host-reset consumption test.

**Consolidated dependencies:** TZ2-05 (hostApi context + reset flag +
stateless helper QR), TZ2-03 (room-token generation — merged wave 1).
**Consolidated out of scope:** attendee surfaces (TZ2-06); transcript route
internals (TZ2-06 Part D — which this task's drill-down *links into*).

---

### TZ2-08 — verification sweep v2 (`verify-v2`) — absorbs `tz2-13` (scope amended 2026-11-16, owner directive: **verification-only**)

**Scope**: the closing task of the v2 loop. One worker; bug discoveries go
through the process bug flow, not this branch. **Token-budget amendment
(2026-11-16): this task VERIFIES — it adds no new test files and no new
product code.** Its deliverable is the recorded walk of the existing
evidence.

1. **AC sweep:** walk all **118** DESIGN rev. 3 criteria (§3.9 coverage
   table); record per-criterion pass/fail + evidence (existing test name /
   manual check note) in **`docs/verification-v2.md`** (committed). Manual
   checks against a running stack for what CI cannot cover (camera, real
   device). Where an automated check does not exist as a test, perform it
   as a **one-shot grep/script during the sweep and record the output in
   the report** — do not commit it as a test file.
2. **Credential-custody sweep (grep-based, recorded in the report, not
   committed as tests):** (a) the only localStorage keys written by
   credential-handling code are `bleak.identity`, `bleak.hostRoom`,
   `bleak.tokenVault`, `bleak.mutualCode`; (b) no `Authorization`-header
   construction outside `packages/api-client` + the web api module; (c) no
   `console.*` call receives a token/code value; (d) the creation token is
   never written to any storage.
3. **No-composer re-check:** the TZ2-06 Part D test green; grep sweep that
   no route/component renders an input/textarea/send control in any chat UI.
4. **i18n parity + copy audit:** parity over the final enlarged
   dictionaries; every visible string on every changed page against §4.7
   (incl. the §2.9 states and both gate/reset notices); locale switch
   mid-flow.
5. **Bundle budget re-check:** build + gzip sizes of route chunks; join ≤
   60 kB, any page ≤ 80 kB; `jsqr` only as the lazy scanner import; `uqr`
   only in the `/profile` chunk; **no new runtime dependency vs v1**
   (crypto = WebCrypto, built-in); record in the report.
6. **PWA validity:** manifest/icons/theme-color untouched and still valid
   (rev. 3 changes no PWA surface).
7. **Secure-context note recorded:** HTTPS is required for camera *and*
   `crypto.subtle` (ARCH §10.5) — entered into the verification doc's
   deployment checklist.
8. **Scanner real-device smoke checklist carried forward** (rev. 3 §6.5):
   iOS Safari + Android Chrome — permission states, decode path, camera
   light off, **plus the v2 dimension**: a stale/legacy device identity
   must land on the §2.8 gate (by design) during the smoke.
9. **Contract reconciliation status** recorded: each `TBD(WP-6)` marker's
   state (reconciled / still pending) listed in the report.
10. **Fix-up allowance:** cross-cutting one-liners only (e.g. a missed i18n
    key); everything else is a filed bug.

**Files:** `docs/verification-v2.md` (+ its own session/log records only).

**Task-specific technical criteria:** `docs/verification-v2.md` lists all
118 ACs with status and evidence; `make lint && make test && make build`
green on `dev` at sweep time; **`git diff dev` for this task touches only
docs/verification-v2.md** (+ its own session/log records only).

**Dependencies:** TZ2-05…TZ2-07 all merged. **Out of scope:** new features;
redesigns; real-device fixing (record only).

### 8.3 Criteria-coverage map (summary)

| Task | Inherited DESIGN rev. 3 ACs | Count |
| --- | --- | --- |
| TZ2-06 Part A | §3.8 1–17 | 17 |
| TZ2-06 Part B | §3.1 1–19 | 19 |
| TZ2-06 Part C | §3.2 1–15, §3.3 1–13 | 28 |
| TZ2-06 Part D | §3.4 1–8, §3.5 1–15 | 23 |
| TZ2-07 Part A | §3.6 1–15 | 15 |
| TZ2-07 Part B | §3.7 1–16 | 16 |
| TZ2-08 | re-verifies all of the above | 118 |
| TZ2-01…TZ2-05 | task-specific technical criteria only (wave 1 delivered; plumbing has no page ACs) | — |

**Coverage: 118/118 mapped to exactly one implementation task; TZ2-08
re-verifies all.** (§3.1+§3.2+§3.3+§3.4+§3.5+§3.6+§3.7+§3.8 =
19+15+13+8+15+15+16+17 = 118, matching DESIGN §3.9; TZ2-06 carries 87,
TZ2-07 carries 31.)

### 8.4 Contract caveats & cross-task rules for workers

1. **TBD(WP-6) reconciliation (ARCH §10.13.1):** the creation-token header
   name, the mutual-code-hash body field, and the invite mint response
   shape are fixed only by bleak-node's swagger update. TZ2-02 implements
   the proposed shapes with `// TBD(WP-6)` markers, each isolated to
   `packages/api-client/src/types.ts` + one mapping point in `client.ts`.
   **If WP-6 lands mid-loop**, the process routes a small bug-flow round on
   TZ2-02's hash to reconcile types — **never** a page/component change.
   TZ2-07 Part B's host gate and TZ2-06 Part A's mutual call consume only
   the api-client's public methods, so they are insulated. (TZ2-02 is
   delivered; the markers exist in the merged code.)
2. **Flag 6.9a (room-scoped per-user reads under the room token):**
   TZ2-07 Part B implements the **honest hint state** (empty drill-down +
   the muted 6.9a hint; DESIGN §3.7) and builds the drill-down on plain
   room-token chat reads (amendment-independent). When the amendment
   lands, enabling the member chat listing is a **follow-up task** (new
   `tz2-07a` card, S, opened off the TZ2-07 worker's hash) — not a
   redesign; no v2 task may invent chat listings client-side.
3. **Flag 6.9b (invite-resolve shape):** the seam ships in TZ2-05 Part A
   with a concrete adapter; TZ2-06 Part B consumes it. If the backend
   ships no resolve route, the only changes are the adapter function
   (TZ2-05) and, in the worst case documented by ARCH §10.13.3, the
   pre-create room preview degradation in TZ2-06 Part B — the owner picks
   the shape before wave 2.
4. **Credential-transport discipline:** tokens move only through the
   TZ2-02 per-call credential and the TZ2-05 injection map/override;
   `apiRaw` is restricted to the TZ2-06 Part D transcript fallback
   (grep-enforced). No component, store, or route may construct an
   `Authorization` header.
5. **Vault discipline:** `tokenVault` is append-only; the only in-place
   mutation is token rotation (TZ2-07: persona Part A, room Part B — the
   room token lives in `hostSession`, not the vault). No flow deletes
   vault entries.
6. **v1 regression guard:** every task runs the full existing test suite;
   v1 acceptance criteria that rev. 3 re-asserts (e.g. §3.2 AC 1–14, §3.5
   AC 1–13) must keep passing — a red v1 test is a bug, not a license to
   change v1 behavior.
7. **QA = CI** (unchanged): `make lint && make test && make build` green
   after merge; workers run the three gates locally before
   `ready-for-merge`.

### 8.5 Sequencing & parallelism plan

**Critical chain:** (wave 1 delivered: TZ2-01…TZ2-04) → (TZ2-05 ∥ TZ2-06 ∥
TZ2-07) → TZ2-08.

| Wave | Tasks running in parallel | Gate to enter |
| --- | --- | --- |
| 1 | TZ2-01, TZ2-02, TZ2-03, TZ2-04 | — (all independent) — **✅ delivered, merged** |
| 2 | TZ2-05, TZ2-06, TZ2-07 | wave 1 merged (all three depend only on TZ2-02 + TZ2-04; TZ2-06/07 also use TZ2-03) |
| 3 | TZ2-08 | TZ2-05…TZ2-07 all merged |

**Why this is safe in parallel:**
- Wave 1 tasks touched disjoint packages/files (delivered).
- Wave 2 tasks touch **disjoint file sets**: TZ2-05 = web api layer + helper
  service; TZ2-06 = attendee routes + scanner + shared sheet/card; TZ2-07 =
  profile + host routes. All consume only the delivered wave-1 contract
  (api-client methods, crypto functions, stores) plus the TZ2-05 layer —
  but TZ2-06/07 consume it through the **delivered wave-1 types** plus the
  TZ2-05 contract at merge time; no wave-2 branch edits another's files.
- **TZ2-06 internal sequencing:** Part A's `lib/scanner/mutual.ts` is built
  before Part B's deep-link wiring (§3.1 AC 19) — intra-task, no boundary.
- **TZ2-07 and the helper trim (TZ2-05 Part B) run in parallel:** the host
  share-kit QR is unit-tested via the `inviteQrUrl` URL builder (no live
  helper dependency in unit tests); the **end-to-end stateless-QR check is
  TZ2-08's sweep**, after both merge.
- **Worker sizing note:** TZ2-06 and TZ2-07 are XL — workers lean on
  OpenCode's automatic compaction within the 200-step cap (AGENTS.md
  resource limits); each consolidated task still closes via one task card,
  and its bug rounds carry the one hash.

**Merge order that keeps `dev` green:** any order within a wave (each
branch is self-contained and gates-green); TZ2-08 strictly last. No task
except TZ2-08 may edit another task's files; contract violations are bugs.

### 8.6 Definition of Done — v2

1. **All 118 DESIGN rev. 3 acceptance criteria pass** — recorded per
   criterion with evidence in `docs/verification-v2.md` (TZ2-08); any
   failure is a filed, closed bug.
2. **CI green on `dev`** after the last merge (`make lint && make test &&
   make build`).
3. **Credential custody enforced:** tokens and one-time codes exist only in
   `bleak.identity`, `bleak.hostRoom`, `bleak.tokenVault`,
   `bleak.mutualCode` — the TZ2-08 grep/unit sweep passes; no credential
   value is logged (`console.*` scan clean); the creation token is never
   persisted; the api-client never touches storage.
4. **No-composer invariant intact** (ruling 4): no input/textarea/send
   control in any chat UI; `POST /api/message` still unwired anywhere
   (TZ2-06 Part D test + TZ2-08 sweep).
5. **i18n complete:** RU/EN parity green over the enlarged dictionaries;
   §4.7 rev. 3 audit clean; locale switch works mid-flow and persists.
6. **Bundle budgets still met:** join route ≤ 60 kB gzip, any page ≤ 80 kB;
   `jsqr` lazy-only, `uqr` profile-only; **zero new runtime dependencies**
   vs v1 (crypto is built-in WebCrypto); recorded in the report.
7. **PWA-lite untouched and valid:** manifest, icons, theme-color
   unchanged (rev. 3 has no PWA surface change).
8. **401/credential-state behavior verified:** legacy v1 identities land on
   the §2.8 notice card; the host reset path clears only the host session;
   the transcript viewer fallback engages and disengages per §3.5.
9. **Contract reconciliation status recorded:** every `TBD(WP-6)` marker
   reconciled against updated swagger.json or explicitly tracked as a
   pending bug-flow item (§8.4.1).
10. **Ownership trail complete:** every task closed via the task DB with
    its criteria; bug branches attributable to their feature worker's
    hash; session records and logs committed.

### 8.7 Flags for the concept agent (unbuildable/ambiguous — flagged, not resolved)

1. **6.9b resolve shape is a build-loop dependency for two tasks:** the
   owner's answer touches **TZ2-05 Part A** (the adapter function — any
   shape slots in) and, in the worst case (no resolve route at all),
   **TZ2-06 Part B**'s pre-create room preview (degradation per ARCH
   §10.13.3: resolve after creation, preview dropped). Decide before
   wave 2 to keep TZ2-06's scope stable.
2. **WP-6 timing vs loop start:** the proposed shapes shipped **delivered**
   with `TBD(WP-6)` markers in TZ2-02; if bleak-node's swagger update is
   not merged yet, the later reconciliation round runs through the bug
   flow on TZ2-02's hash (isolated to `types.ts`). No design or page
   impact either way — but the concept agent may prefer to sequence the
   backend WP-6 before wave 2 to avoid the extra round.
3. **6.9a follow-up sizing:** TZ2-07 Part B ships the honest 6.9a hint
   state; when the amendment lands, enabling the member dialog listing is
   a new small task (suggested `tz2-07a`, size S, opened off the TZ2-07
   worker's hash). The concept agent should pre-authorize its creation so
   the process can open it without a new ruling.
4. **Invite mint response shape (TBD(WP-6)) drives the `InviteRow` expiry
   display** (DESIGN §3.7): the UI assumes `{ code, created_at,
   expires_at }`; if the backend's shape differs, the adjustment is
   confined to TZ2-07 Part B's row rendering + the delivered TZ2-02
   `Invite` type — noted so it is not mistaken for a design change.
5. **i18n key rename:** `host.token.label` → `host.gate.label` (rev. 3
   §4.7) shipped **delivered** with TZ2-01; if any page task still imports
   the old key at its merge time, parity/lint fails — the fix belongs to
   that page's task (TZ2-06/TZ2-07), not a cross-edit.
6. **Rotation-vs-gate edge (handled, noted for the record):** a 401 during
   persona-token rotation (e.g. the current token was already revoked on
   another device) fires the §2.8 global gate — identity cleared,
   half-finished rotation is simply abandoned server-side-consistent (no
   partial client writes: identity/vault update only after 2xx, the
   TZ2-07 Part A criterion). This matches DESIGN §2.8; flagged only so
   the owner is not surprised by the redirect during a rotation attempt.
7. **Host drill-down chat discovery is the one UX piece genuinely blocked
   on the backend** (6.9a): the designed hint state is honest but the
   member-dialog list is empty until the amendment. If the owner wants the
   list at launch, the backend amendment (not a client change) is the
   blocker — surfaced here per DESIGN §3.7's own wording.
8. **Restructure trade-off (owner-directed, for the record):** the
   consolidation enlarges wave-2 tasks to XL (TZ2-06 ≈ 87 ACs, TZ2-07 ≈ 31
   ACs) — the steps cap is mitigated by compaction (§8.5 note), but the
   process should watch for stalled XL cards and split bug rounds early;
   the absorbed per-part criteria remain the acceptance granularity, so a
   mid-task `ready-for-merge` is **not** possible — a card closes only
   when all its parts' ACs pass.

### 8.8 Token-budget policy (owner directive, 2026-11-16) — applies to every remaining run

**Context:** the OpenCode Go weekly quota is the binding resource. These
rules cut token burn without lowering product quality (the 118-AC coverage
and the v1 regression guard are untouched):

1. **Gate order & frequency (workers):** during a part's implementation,
   iterate with **targeted test runs** (`npm run test -w @bleak/web --
   <file>`), or the **smoke tier** (`make test-smoke` — the
   crypto/credential/contract spine only; added 2026-11-17 owner directive)
   when a wider-but-fast check is needed. The **full `make test` runs once
   per completed part** (right before its commit). **`make lint` runs only
   after the full test suite is green** — never interleaved with test
   debugging. **`make build` runs once, at handover** (after lint) — it is
   the most expensive gate and catches nothing the part-tests + lint
   missed during development. Sequence per part: targeted tests → full
   test → commit; per handover: full test → lint → build.
2. **CI batching (process):** the full three-gate CI **no longer runs
   after every merge**. The process runs the full gates **once per wave,
   after all of the wave's merges land on `dev`** — then closes every
   task of that wave (`ci green`). Red wave-CI → the existing bug flow
   against the offending feature. Full CI also runs **before any push to
   `main` / release preparation** (owner rule: release gate).
3. **Verification sweep is verification-only** (TZ2-08 as amended): no new
   test files, one-shot checks recorded in the report instead.
4. **Targeted context:** workers read only their own `tz-section` + the
   DESIGN sections their card references — not the full doc set per task
   (the process task cards carry the criteria verbatim for this reason).
   Handover reports state facts (hashes, gate results) without re-pasting
   file contents.
5. **Session-record hygiene:** one session-record commit per worker (at
   handover), not per run; log entries stay one-liners.
6. **Test-growth discipline (2026-11-17, owner directive):** new tests are
   parametrized by default (`it.each` tables for status/variant clusters) —
   one case per behavior, not per copy of the assertion pattern; every task
   card bounds its growth via its `test_cases` + `constraints` fields; the
   reported-case count of any non-test task must not grow without a named
   reason in the handover report.

*These rules supersede any earlier "run all three gates locally before
ready-for-merge" phrasing in §8.4 — the per-part test + handover sequence
above is the enforced discipline.*

---

*End of Part II — TZ pass 2, architect `81037a13`, 2026-11-15; §8.8
token-budget policy added 2026-11-16 by owner directive (recorded inline
by the concept/devops agent). The process agent owns the v2 build loop;
per-task sessions get their own hashes via `open-feature.sh` with
`tz-section` pointing at the `tz2-NN` references above.*

---

# Part III — host admin panel build loop (TZ pass 3, architect `81037a13`, 2026-11-24)

> **Status note:** Part I (§1–§7, delivered) and Part II (§8, delivered) are
> closed records. This part extends the document with the build loop for the
> owner-approved **host admin panel** (Concept **§54**, 2026-11-24; DESIGN
> **rev. 4** §3.7.1–§3.7.5, owner-approved as-is; merge mode **default
> per-feature approval** — worker `ready-for-merge` handovers wait for the
> owner's OK relayed via concept, the process merges squash-only). **Do not
> regress what v1/v2 delivered:** every task touches only what DESIGN rev. 4
> assigns to it; unmentioned behavior must keep passing its standing
> criteria. The delivered rev. 3 host console (TZ2-07 Part B) is the
> **rewritten codebase** this round replaces — see the Part II supersession
> note.
>
> **Owner ratifications encoded here (2026-11-24, stage gate cleared):**
> (a) **F9 as designed** — `language`/`max_user` render read-only with a
> hint; editable controls stay backend-dependency-gated (**no backend
> changes this round**); (b) **F11 as designed** — log-in asks room address
> + room token, with the bounded public-list address finder (concurrency 4,
> cap 25, stop on first 200); (c) **F10 stands as designed** — the room
> token is sent on `PUT /api/room/{address}` per §54.1; server-enforcement
> confirmation is a backend-dependency note (§9.4), not a client task. The
> F9/F10 swagger gaps are recorded as §8.4-style backend-dependency notes,
> referencing the §54.5 ledger (flag 6.9a / `tz2-07a` pre-authorization).

Authority chain: `docs/Concept.md` **§54** (owner-approved 2026-11-24, hard
ruling: no backend changes, rules A–D pre-decided) → `docs/ARCHITECTURE.md`
(§2.2/§5/§10.3/§10.9; rev. 4 amendments implied are DESIGN §6.15's list) →
`docs/DESIGN.md` **rev. 4** (§3.7.1–§3.7.5 = 58 acceptance criteria) →
**Part III**. Format follows Part II: each task = **one worker instance =
one branch `feature/<hash>-<slug>` = one task card** (`open-feature.sh
<slug>`, `tz-section` = the `tz13-NN` reference below); inherited
acceptance criteria are listed **verbatim by number** — the worker reads the
referenced DESIGN rev. 4 section for the full criterion text.

**Delivered plumbing (audit 2026-11-24, no new task needed):** the
api-client already carries every endpoint this round uses — `listRooms`,
`listInvites` (unwraps the `{ invites: […] }` wrapper), `mintInvite`,
`revokeInvite`, `rotateRoomToken`, `updateRoom`, `deleteRoom`,
`listChatsOfRoomUser`, `listRoomUserChatMessages`, `kickoffChat`,
`clearChatHistory`, `createRoom` (creation-token header), `getRoom`,
`listRoomUsers`, `listHandshakesOfUser` (persona-token-only — never called
by host UI, rule B). The web layer already carries `hostApi`
(auto-injection + host-context 401/403 gate) and the `bleak.hostRoom` store.
The round is **routes + components + stats engine + ledger only**.

## 9. Host admin panel work breakdown (build order)

### 9.1 Task table

| # | Task (`tz-section`) | Slug (branch suffix) | Size | Depends on | DESIGN rev. 4 § | Inherited ACs |
| --- | --- | --- | --- | --- | --- | --- |
| TZ13-01 | host-tree foundations: i18n +63 keys, rule-C invite ledger store, shared `InviteQr` (uqr extraction), notice-key rename | `host-tree-foundations` | S | — | 4.7 (rev. 4 additions) | — |
| TZ13-02 | `/host` entry: create / log-in / auto-resume probe / address finder | `host-entry` | M | TZ13-01 | 3.7.1 (+2.8) | §3.7.1 1–12 (12) |
| TZ13-03 | `/host/[room_address]` panel: members + drill-down + rule-D locked row + settings/rotation/delete, **and** the rule-A statistics engine + `BucketChart` | `host-panel-stats` | XL | TZ13-01 | 3.7.2 + 3.7.5 (+2.2) | §3.7.2 1–15 + §3.7.5 1–12 (27) |
| TZ13-04 | `/host/[room_address]/invite` (active + rule-C ledger history) + `/invite/[code]/qr` (client-side QR, link never shown) | `host-invites-qr` | M | TZ13-01 | 3.7.3 + 3.7.4 | §3.7.3 1–12 + §3.7.4 1–7 (19) |
| TZ13-05 | verification sweep `tz13` — **verification-only** | `verify-tz13` | L | TZ13-02…TZ13-04 all merged | 3.9 (§3.7 rows) | re-verifies all 58 |

**Coverage: all 58 DESIGN rev. 4 host ACs (§3.9's §3.7 row: 12 + 15 + 12 + 7
+ 12) map to exactly one implementation task** — §3.7.1 → TZ13-02; §3.7.2 +
§3.7.5 → TZ13-03 (Parts A/B); §3.7.3 + §3.7.4 → TZ13-04 (Parts A/B); TZ13-05
re-verifies all 58. TZ13-01 carries only its own technical criteria, as in
Parts I/II. **Token-budget note (per §8.8):** worker sessions are lean —
spawn prompts are self-contained and reference Concept/DESIGN sections by
number instead of restating them; the §3.7.1–§3.7.5 split maps one
DESIGN part to one task part.

**i18n placement decision (standing):** the copy table is the **foundation
task TZ13-01** (mirroring TZ2-01); page tasks wire their own keys; the
verification task audits usage.

### 9.2 Per-task TZ sections

### TZ13-01 — host-tree foundations (`tz13-01`)

**Scope** (DESIGN §4.7 rev. 4 additions + §3.7.3 ledger + §4.2 `InviteQr`):
1. **i18n +63 keys:** reconcile `apps/web/src/lib/i18n/{ru,en}.ts` against
   the rev. 4 table — **add every new key verbatim in both languages** (62
   new + the amended `host.session_reset`, whose new wording replaces the
   rev. 3 «…с токеном создания» reset copy). The retired inline string
   «Создать другую комнату» (old share kit) has no key — nothing to delete
   unless a stale reference exists (grep). Rev. 3 carryover keys
   (`host.gate.*`, `host.create`, `host.invites.*` title/hint/mint/presets/
   `expires_in`/revoke/revoked, `host.rotate_room.*`, `host.drill.*`
   clear/clear_confirm/empty, `host.empty_live`) stay untouched.
2. **Rule-C invite ledger store** (`apps/web/src/lib/stores/hostInviteLedger.ts`):
   localStorage key **`bleak.hostInvites.<room address>`** — append-only
   array of `{ code, created_at, expires_at, revoked_at? }` recording every
   mint and revoke response **of this device**. API: `recordMint(response)`,
   `recordRevoke(code, at)`, `merge(serverInvites)` → `{ active, history }`
   where history = ledger entries **missing from the server list**,
   classified expired (`expires_at` past, no `revoked_at`) or revoked;
   codes still in the server list are never double-rendered. Nothing is
   recorded on a failed mint/revoke. Unit tests with an injectable clock.
3. **Shared `InviteQr` (uqr extraction):** extract the §3.6 `uqr` SVG
   renderer out of `QrCodeBadge.svelte` into a shared module
   (`apps/web/src/lib/qr/svgQr.ts` or equivalent) and add the **`InviteQr`**
   component (DESIGN §4.2): props `code`, size, `ariaLabel`; renders the
   client-side SVG of the absolute invite deep link
   `{INVITE_URL_BASE}?code={code}` — **no network call** (no helper PNG).
   Re-point the profile badge to the shared module (behavior unchanged;
   existing profile tests stay green). `uqr` stays lazy/code-split — now a
   shared chunk of profile + host routes (bundle rule amended, §9.4.4).
4. **Notice-key rename:** the delivered `hostApi` gate sets
   `bleak.hostReset` (`HOST_RESET_KEY`, `lib/api/client.ts`); DESIGN rev. 4
   names the key `bleak.hostNotice`. **Rename the key + constant to
   `bleak.hostNotice`** across the gate and every consumer (grep-verified;
   behavior identical). Page tasks use the new name only.

**Files:** `apps/web/src/lib/i18n/{ru,en}.ts`, `apps/web/tests/i18n.test.ts`
(extended), `apps/web/src/lib/stores/hostInviteLedger.ts` (+ test),
`apps/web/src/lib/qr/svgQr.ts`, `apps/web/src/lib/components/qr/InviteQr.svelte`
(+ test), `apps/web/src/lib/components/profile/QrCodeBadge.svelte`
(mechanical re-point), `apps/web/src/lib/api/client.ts` (key rename only).

**Task-specific technical criteria:** parity test green over the enlarged
dictionaries; ledger merge tests (mint/revoke recorded, server-authoritative
active list, missing entries classified expired/revoked, failure records
nothing); `InviteQr` test asserts **zero** network requests (the SVG is
computed client-side) and decodes back to the deep link; rename grep clean
(no `bleak.hostReset` reference anywhere); no page wiring beyond the
mechanical profile re-point.

**Dependencies:** none. **Out of scope:** the four host route pages.

---

### TZ13-02 — `/host` entry (`tz13-02`)

**Scope** (DESIGN §3.7.1): rework the delivered `routes/host/+page.svelte`
into the rev. 4 **entry route** — the panel/invite/QR content moves out to
TZ13-03/TZ13-04; this page keeps only the entry forms.

1. **`HostEntryCard`** (§4.2; extends the retired single-mode gate): mode
   switch (`SegmentedControl`, «Создать комнату» / «Войти по ключу»),
   switching never loses input, both modes always reachable. **Create
   mode:** masked creation token (`type="password"`, `autocomplete="off"`)
   + room form (`name` required, `description`, `language` select ru|en) →
   client generates the room token (`generateTokenSecret()`) →
   `createRoom({ name, description, language, token }, createToken)`
   (`x-create-token` header) → store
   `bleak.hostRoom = { roomAddress, roomToken, code: response.invite_code }`
   → navigate to `/host/<room_address>`. **The creation token is consumed,
   never stored** (carried-over custody test). **Log-in mode:** room
   **address** + masked room **key** → validate the pair with the
   invite-list GET (`GET /api/room/{address}/invite`) → 200 →
   store/overwrite `bleak.hostRoom` (`code` starts unknown, fills from the
   panel's first invite-list tick) → navigate; 401/403 →
   «Ключ комнаты отклонён.» inline, value stays masked, **nothing stored**.
2. **Auto-resume probe (§54.1):** on mount with a stored `bleak.hostRoom`,
   validate the stored key with the invite-list GET **before** the entry
   card renders interactively: **200** → auto-navigate to
   `/host/<room_address>` (skeleton + «Проверяем доступ к комнате…»,
   `aria-busy`, meanwhile); **401** → clear `bleak.hostRoom`, show the reset
   notice, fall back to the entry card **Create** mode; **404** → clear +
   «Комната удалена.»; **NetworkError** → **keep** the stored entry,
   network `ErrorBanner` + retry above the card (a failed probe must not
   destroy a possibly-valid credential).
3. **Reset notice:** renders only when `sessionStorage`
   `bleak.hostNotice` is set (TZ13-01 rename); `--color-surface` notice
   card, lock glyph, binding copy (`host.session_reset`), `aria-live="polite"`,
   key removed after render (once per incident); presence pre-selects
   **Log-in** mode.
4. **Address finder (F11 as designed):** «Не помните адрес?» → fetch the
   public `GET /api/room` list → probe candidates with the **entered key**
   via the invite-list GET, **bounded: concurrency ≤ 4, cap 25 rooms, stop
   at the first 200**; «Ищем комнату…» while running; a match fills the
   address and continues normal validation; no match → «Ключ не подошёл ни
   к одной комнате.»; **the finder never writes storage** — only the
   successful validation does.
5. **No tab bar** on `/host` (or any host route); the page never redirects
   based on attendee identity.

**Pre-credential probe exception (see §9.4.2):** the resume probe, the
log-in validation and the finder run through the **raw client path with
local 401 handling** — the `hostApi` gate must not fire for expected
pre-credential 401s (it would redirect and clear on ordinary validation
failures). The gate fires only for post-credential room-token calls.

**Files:** `apps/web/src/routes/host/+page.svelte` (rewritten),
`apps/web/src/lib/components/host/HostEntryCard.svelte`,
`apps/web/src/lib/components/host/CreateRoomForm.svelte` (reused, moved),
`apps/web/src/lib/api/client.ts` (apiRaw allowlist extension only),
tests (`host-entry.test.ts` new; `host-console.test.ts`'s entry-related
cases rewritten/moved here).

**Inherited acceptance criteria:** DESIGN §3.7.1, AC **1–12 verbatim**.

**Task-specific technical criteria:** probe state tests (200 → navigate, 401
→ clear + Create fallback, 404 → deleted copy, NetworkError → entry kept +
banner); finder bound test (mock fetch counting: never more than 25
candidates, ≤ 4 in flight, stops at first 200) + never-writes-storage test;
mode-switch non-dead-end test; creation-token custody test (header only,
no body/log/storage); masked-input attribute assertions.

**Dependencies:** TZ13-01. **Out of scope:** the panel, invite and QR routes.

---

### TZ13-03 — `/host/[room_address]` panel + statistics (`tz13-03`)

One worker owns the main panel route — the live room view plus the rule-A
statistics engine — because both render on the same route and share its
Poller (DESIGN §2.2 rev. 4 row: members 5 s, stats every third tick ⇒ 15 s).

**Inherited acceptance criteria:** DESIGN §3.7.2 AC **1–15** + §3.7.5 AC
**1–12** (27 total) — verbatim per part below.

#### Part A — panel regions (absorbs §3.7.2)

**Scope** (DESIGN §3.7.2): new `routes/host/[room_address]/+page.svelte`:

1. **Guard:** stored `bleak.hostRoom.roomAddress` must equal the URL param,
   else redirect `/host`; missing entry → `/host`.
2. **Top bar:** back control (→ `/host`), live room `h1` from public
   `getRoom`, muted address chip, read-only data chips «Язык агентов…» /
   «Вместимость…» (**F9**: data display, never controls).
3. **Members region** (5 s public poll): tile «Участники {n}/{max_user}»,
   member rows (avatar, name, joined time); row tap → **member drill-down
   sheet** (on-demand, never polled): dialogs read with the **room token**
   via `listChatsOfRoomUser` — the rev. 4 **real listing** replacing the
   delivered 6.9a-hint empty state; each row links to the read-only
   `/chats/{address}` transcript (host viewer context) and carries
   «Очистить историю» (confirm → `clearChatHistory`, room token) and
   «Запустить заново» (§3.5 kickoff copy → `kickoffChat`, room token;
   `KickoffResponse` speaker line). **Kickoff is per-dialog only** — no
   room-level batch restart exists in the contract and none is faked.
   CONFIRM-LF: «У участника пока нет диалогов.»
4. **Rule-D locked row:** at the bottom of the drill-down a
   **non-interactive locked row** renders — muted lock glyph +
   «Удаление участника появится вместе с серверным обновлением.»,
   `aria-disabled`, no click handler, and **no `deleteRoomUser` call
   anywhere in the host UI** (grep-enforced; backend-dependency note
   §9.4.1-d).
5. **Share region:** big code display (Handjet 40px, digits spelled in the
   `aria-label`) + copy chip; **client-side `InviteQr`** (TZ13-01) of
   `{INVITE_URL_BASE}?code={code}` — **no helper PNG call**; «Присоединиться
   как участник» → `/?code={code}`; link row «Все коды приглашения» → the
   invite route.
6. **Settings region** (collapsible, last): room edit `name`/`description`
   → `updateRoom` (room token; body `{ name, description }` **only**) →
   transient «Сохранено», header refreshes from the PUT response; 400 →
   server-text field error; **F9 hint** «Язык и вместимость изменятся вместе
   с серверным обновлением.» under the read-only chips. «Сгенерировать ключ
   комнаты» → confirm → `rotateRoomToken` (current key as Bearer) → stored
   `bleak.hostRoom.roomToken` replaced **in place**. Danger zone: «Удалить
   комнату» → confirm → `deleteRoom` → `bleak.hostRoom` cleared → `/host`
   (entry card, Create mode).
7. **Host session reset:** `hostApi` 401/403 on any room-token call →
   `bleak.hostRoom` cleared, `bleak.hostNotice` set, lands on `/host`
   (log-in mode + notice, TZ13-02's reset card); attendee identity never
   touched. `getRoom` 404 → «Комната удалена.» full-page state → cleared +
   redirect.
8. **No handshake counts anywhere** on the panel (rule B negative AC 8).
9. **Responsive:** ≥ 900px two-column (main ≈ 58% scrolls, sticky side ≈
   42% holds share + invite shortcut; max 1080px); below 900px regions
   stack in the specified order. Drill-down sheets trap focus; per-record
   `aria-label`s.

**Files:** `apps/web/src/routes/host/[room_address]/+page.svelte`,
`apps/web/src/lib/components/host/{PanelMembers,MemberDrillDown,ShareKit,PanelSettings}.svelte`,
`apps/web/src/lib/components/host/hostPanel.ts` (guard + diff helpers),
tests (`host-panel.test.ts`, `member-drilldown.test.ts` extended/rewritten).

#### Part B — statistics: rule-A engine + `BucketChart` (absorbs §3.7.5)

**Scope** (DESIGN §3.7.5):

1. **Engine** (`apps/web/src/lib/components/host/stats/hostStats.ts`, rule
   A — client-side fan-out, bounded): one pass per stats tick, **every
   third 5 s tick of the page Poller** (⇒ 15 s), start/stop on mount/
   teardown, refresh on visibility regain. Steps: member list (reuse the
   5 s poll's latest snapshot) → per member `listChatsOfRoomUser` (room
   token, **concurrency ≤ 4**, individual branch failures tolerated) →
   **dedupe chats by chat address across members** (a mutual chat appears
   under both participants) → one message fetch per **unique** chat
   (`listRoomUserChatMessages` via one participant path segment,
   concurrency ≤ 4). Computes M1 (12 five-minute buckets over the past
   hour by `message.created_at`), M2 (`listRoomUsers.length`), M3 (deduped
   chat count), M4 (active vs finished by `Chat.done`; kickoff resets to
   active).
2. **`BucketChart`** (hand-rolled SVG, **no chart dependency**): per the
   §3.7.5 spec — `viewBox="0 0 320 120"`, `width="100%"`, 12 bar slots
   (≈ 26px, bar 18px, gap 8px, baseline y = 104); accent-tinted bars
   (`color-mix(in srgb, var(--color-accent) 70%, transparent)`), newest
   non-zero bucket at full `--color-accent`, zero buckets render a 2px
   stub in `--color-text-disabled`, 1px muted baseline; 5 relative axis
   labels only («−60 мин» … «сейчас»), muted Inter 14px; peak-bucket accent
   dot; **no per-bar value labels**; **§4.1 tokens only** (no hardcoded
   colors); static (no bar animation); `role="img"` + summary `aria-label`
   («Сообщений за последний час: {n}; пик в {bucket}.»).
3. **`StatsPanel`**: section header «Статистика»; `StatTile` row as a
   `<dl>` (M2, M3, M4 split tile) + the M1 chart card; caption
   «Сообщений за час: {n}»; the **rule-B hint line** under the section
   («Статистика рукопожатий появится вместе с серверным обновлением.»).
4. **States:** first pass skeletons; later ticks swap data in place; empty
   room → members-empty copy, engine skips the fan-out; empty hour →
   baseline + stubs + «За последний час сообщений не было.»; **partial**
   (some branches failed after retries) → subset metrics + «Часть данных не
   загрузилась — цифры могут быть занижены.» + retry; full error →
   `ErrorBanner` + dimmed last-known tiles; identical-tick diffs do **not**
   re-render (diff in the caller).
5. **GATED BLOCK — metrics 5–7 (rule B): documented gate ONLY, do not
   build.** The M5–M7 handshake panels are specified in DESIGN §3.7.5 and
   are **omitted from the UI** until the flag-6.9a backend amendment /
   pre-authorized `tz2-07a` lands — no locked rows, no zeros, no proxy
   metric (negative AC 8; when the gate lifts, M5 joins the `StatTile` row
   and M6/M7 render as two list cards under the chart per the spec,
   **without design rework**). Backend-dependency note §9.4.1-c.

**Files:** `apps/web/src/lib/components/host/stats/{hostStats.ts,StatsPanel.svelte,BucketChart.svelte}`,
tests (`host-stats.test.ts`, `bucket-chart.test.ts`), wired into Part A's
page region 2.

**Task-specific technical criteria (both parts):** engine concurrency test
(mock queue: ≤ 4 in flight at every step) + dedupe test (a mutual chat's
messages fetched exactly once); bucketing test (`created_at` → 12 buckets;
`Chat.done` split; kickoff semantics); poll cadence test (members 5 s,
stats on every third tick, both stop on teardown); identical-tick
no-re-render test; chart token test (no raw color literals in the SVG);
rule-B negative grep (no `listHandshakesOfUser` reference in host code) +
rule-D negative grep (no `deleteRoomUser` reference in host code); locked
row `aria-disabled` assertion; guard redirect test; settings/rotation/
delete happy-path + confirm tests carried from the delivered console
(rewritten in this task's files).

**Dependencies:** TZ13-01. **Out of scope:** the entry, invite and QR
routes; the transcript route internals (linked into, not edited).

---

### TZ13-04 — invites + invite QR (`tz13-04`)

One worker owns the two invite routes (§3.7.3 + §3.7.4): one data model
(server active list ⊕ device ledger), one QR artifact flow.

**Inherited acceptance criteria:** DESIGN §3.7.3 AC **1–12** + §3.7.4 AC
**1–7** (19 total) — verbatim per part below.

#### Part A — `/host/[room_address]/invite` (absorbs §3.7.3)

**Scope** (DESIGN §3.7.3): guard as §3.7.2; top bar back + h1 + hint;
single column max 720px.

1. **Active codes** (room-token `listInvites`, **15 s poll**): `InviteRow`
   per code — 6-digit code (Handjet 24px), muted expiry «истекает через
   {time}», actions: copy chip / QR link (→ the per-code QR route) /
   invite-link copy / «Отозвать» (outline-destructive, **no confirm** —
   reversible) — each with its per-code `aria-label`.
2. **Mint control:** «Выпустить код» → inline expiry chooser — presets «1
   час» / «24 часа» (**pre-selected default**) / «7 дней» + «Своё время…»
   (`datetime-local`, min = now) → `mintInvite({ expires_at? })` → the code
   appears at the top of the active list **and is recorded in the ledger**
   (rule C).
3. **Expired & revoked (rule C):** collapsed disclosure section listing
   ledger entries **missing from the server list** — expired
   («истёк {date}») / revoked («отозван {date}») as muted text badges,
   rows non-interactive (no copy/QR/revoke/navigation for dead codes);
   **ledger caveat** under the header («Коды, выпущенные с других
   устройств…»); the section is omitted when empty.
4. **Merge rule (TZ13-01's store):** the server list is authoritative for
   active codes; the ledger contributes history; mint/revoke responses are
   appended immediately and reconciled on every poll tick; entries still in
   the server list are never double-rendered; **failure records nothing**.
5. **States:** loading skeletons on first arrival (no flicker on refresh);
   empty (no active AND no ledger) → `EmptyState` + mint CTA; errors inline
   muted with retry (the ledger section still renders — it is local);
   mint/revoke failures inline near the control; room 404 →
   «Комната удалена.» + redirect (host reset semantics). Rows ≥ 48px;
   badges not color-only; the list is a real `<ul>`.

#### Part B — `/host/[room_address]/invite/[code]/qr` (absorbs §3.7.4)

**Scope** (DESIGN §3.7.4): guard as §3.7.2; **unknown `[code]`** (not in the
server list nor the ledger) still renders the page with the warning line.

1. **QR:** client-side `InviteQr` (TZ13-01) of the absolute invite deep
   link `{INVITE_URL_BASE}?code={code}` — **no network QR call**; 280px,
   pixel-cornered light frame, `aria-label` «QR-код приглашения {code}».
2. **Code row:** 6-digit code (Handjet 40px) + «Скопировать код» chip
   (clipboard receives the digits; aria-label includes the code).
3. **Share-or-copy-link:** «Скопировать ссылку» (clipboard gets the URL) +
   «Поделиться» **only where `navigator.share` exists** (same URL).
   **The link text is never rendered anywhere — no text node, no `title`,
   no tooltip; buttons only (hard AC).**
4. **No Poller** — one liveness recheck on mount (a room-token
   `listInvites` through the post-credential path), then idle; unknown-code
   warning after the recheck; loading skeleton during it; inline error with
   retry; «Скопировано» confirmations announced `aria-live="polite"`; back
   returns to the invite page.

**Files:** `apps/web/src/routes/host/[room_address]/invite/+page.svelte`,
`apps/web/src/routes/host/[room_address]/invite/[code]/qr/+page.svelte`,
`apps/web/src/lib/components/host/{InviteManager,InviteRow}.svelte`
(delivered components reworked/moved),
tests (`host-invites.test.ts`, `host-invite-qr.test.ts`,
`host-invite-ledger.test.ts`).

**Task-specific technical criteria:** merge/ledger tests (append on mint +
revoke, reconcile per tick, no double-render, **failure writes nothing**,
expired/revoked classification with injectable clock); dead-row
non-interactive test (no actions/navigation for a history code); unknown-
code test (warning renders, QR + actions still render); **link-never-
rendered assertion** (component snapshot/DOM scan: the URL appears only in
clipboard/share payloads, never as text/title/tooltip); poll cadence 15 s
+ per-tick ledger re-merge; conditional Share-button test.

**Dependencies:** TZ13-01. **Out of scope:** the entry and panel routes.

---

### TZ13-05 — verification sweep `tz13` (`verify-tz13`) — **verification-only**

**Scope**: the closing task of the round. One worker; bug discoveries go
through the process bug flow, not this branch. Per the §8.8.3 pattern: **no
new test files, no product code** — the deliverable is the recorded walk.
**Amendments over the standing sweep:** as the round's owner ratifications
direct, the sweep re-verifies the **58 host ACs** 1:1 and runs the
host-symmetric negative sweeps.

1. **AC sweep:** walk all **58** DESIGN rev. 4 host criteria (§3.7.1 1–12,
   §3.7.2 1–15, §3.7.3 1–12, §3.7.4 1–7, §3.7.5 1–12) with per-criterion
   pass/fail + evidence (test name / manual check note) in
   **`docs/verification-v40.md`** (next sequence number at task time;
   committed). One-shot grep/script checks are recorded in the report, not
   committed as test files.
2. **Round sweeps (grep/mock, recorded):** (a) **i18n parity + copy
   audit** of every host-route string against §4.7 (incl. both gate/reset
   notices, the ledger caveat, the rule-B hint); locale switch mid-flow.
   (b) **No-new-dependency check:** hand-rolled SVG chart (no chart lib in
   `package.json` vs `dev`), `uqr` reused (not re-added), no new runtime
   dependency vs the delivered tree. (c) **Host-symmetric 401 reset
   behavior end-to-end:** a room-token 401/403 clears only
   `bleak.hostRoom`, sets `bleak.hostNotice`, lands on `/host` log-in mode
   with the notice; attendee identity untouched. (d) **Rule-B negative
   sweep:** no handshake-panel rendering on any host route and no
   `listHandshakesOfUser` call in host code. (e) **Rule-D negative sweep:**
   no `deleteRoomUser` call in host code; the locked row is
   non-interactive. (f) **Link-never-rendered sweep:** every
   `INVITE_URL_BASE`/deep-link occurrence on host routes is a
   clipboard/share payload or QR payload — never rendered text/title/
   tooltip. (g) **Creation-token custody re-check** (header-only, never
   stored). (h) **Ledger/storage custody:** the only new localStorage key
   family this round is `bleak.hostInvites.*` (enumerate via grep of
   `localStorage.setItem`/storage-key constants); ledger is append-only.
   (i) **Bundle re-check:** `uqr` now a shared lazy chunk of profile +
   host routes; any-page ≤ 80 kB budget holds; record sizes.
   (j) **Contract reconciliation status:** F9/F10 gaps + rules B/D gates
   recorded as backend-dependency notes (§9.4.1) with their §54.5 ledger
   references; existing `TBD(WP-6)` markers unchanged.
3. **Fix-up allowance:** cross-cutting one-liners only (e.g. a missed i18n
   key); everything else is a filed bug.

**Files:** `docs/verification-v40.md` (+ its own session/log records only).

**Task-specific technical criteria:** the verification doc lists all 58
ACs with status and evidence; `make lint && make test && make build` green
on `dev` at sweep time; `git diff dev` for this task touches only the
verification doc (+ its own session/log records only).

**Dependencies:** TZ13-02…TZ13-04 all merged. **Out of scope:** new
features; redesigns; real-device fixing (record only).

### 9.3 Criteria-coverage map (summary)

| Task | Inherited DESIGN rev. 4 ACs | Count |
| --- | --- | --- |
| TZ13-02 | §3.7.1 1–12 | 12 |
| TZ13-03 Part A | §3.7.2 1–15 | 15 |
| TZ13-03 Part B | §3.7.5 1–12 | 12 |
| TZ13-04 Part A | §3.7.3 1–12 | 12 |
| TZ13-04 Part B | §3.7.4 1–7 | 7 |
| TZ13-05 | re-verifies all of the above | 58 |
| TZ13-01 | task-specific technical criteria only (foundations) | — |

**Coverage: 58/58 mapped to exactly one implementation task; TZ13-05
re-verifies all.** (12 + 15 + 12 + 7 + 12 = 58, matching DESIGN §3.9's
§3.7 row; rev. 4 totals 160 with the other §3 sections' 102 ACs
delivered/standing — those are re-walked only as the regression guard
demands, see §9.4.6.)

### 9.4 Contract caveats & cross-task rules for workers

1. **Backend-dependency notes (recorded, not client tasks — §54 hard
   ruling: no backend changes this round):**
   - **(a) F9 — `UpdateRoomRequest` lacks `language`/`max_user`**
     (verified swagger 2026-11-24): the panel renders both read-only with
     the server-amendment hint; the editable controls stay
     **backend-dependency-gated**. When the backend accepts the fields,
     enabling the controls is a small follow-up per the ratified F9 design
     (no redesign).
   - **(b) F10 — `PUT /api/room/{address}` declares no security scheme** in
     swagger (unlike its 401/403 responses): the client sends the room
     token as Bearer per §54.1 (the delivered `hostApi` already does).
     **Server-side enforcement confirmation is a backend-dependency note**
     — record it with the §54.5 ledger; not a client task.
   - **(c) Rule B — `GET /api/handshake/user/{address}` is
     persona-token-only:** handshake metrics 5–7 stay **omitted from the
     UI** until the flag-6.9a amendment; the pre-authorized follow-up
     **`tz2-07a`** (size S, opened off the TZ2-07 lineage hash) is the
     standing vehicle — **unchanged by this round**. No proxy metric
     anywhere (§54.2-B binding).
   - **(d) Rule D — `DELETE /api/room/{room}/user/{address}` is
     persona-token-only:** the drill-down ships the locked row only; the
     call exists nowhere in the UI (grep-enforced in TZ13-03 + TZ13-05).
     Gates (b)–(d) all reference the **§54.5 backend TODO ledger**.
2. **Pre-credential probe exception (architectural delta, for the
   record):** the auto-resume probe, the log-in validation and the address
   finder make **expected-401 room-key probes before any stored
   credential exists**. The `hostApi` gate (§2.8) must not fire for them —
   it would redirect and clear on ordinary validation failures. These
   probes run through the raw client path with **local 401 handling**
   (in-page clear/notice/entry-card states). The `apiRaw` allowed-use list
   is therefore extended: transcript fallback (existing, §10.3) **+ host
   key-validation probes** (grep rule updated in TZ13-02). Post-credential
   room-token calls always go through `hostApi`.
3. **Notice-key naming (resolved here):** the delivered gate writes
   `bleak.hostReset`; DESIGN rev. 4 names it `bleak.hostNotice`.
   **TZ13-01 renames the key + constant**; all later tasks use
   `bleak.hostNotice` only; grep-verified at merge.
4. **`uqr` chunk rule amended:** the standing "uqr profile-only" bundle
   rule (§8.6.6) becomes "**uqr shared, lazy, profile + host chunks**"
   (TZ13-01 extraction). Bundle budget re-check in TZ13-05.
5. **Ledger discipline (rule C):** `bleak.hostInvites.<room address>` is
   the **only new localStorage key family** this round; append-only; a
   failed mint/revoke records nothing; the server list is authoritative
   for active codes. Deleting the room leaves its ledger entries orphaned
   **by design** (append-only, harmless; keyed per room) — noted, not a
   bug. A server-side invite-history endpoint would retire the ledger
   entirely (DESIGN §6.14, backend TODO candidate).
6. **v1+v2 regression guard:** every task runs the full existing suite;
   the rev. 3 host-console tests the round rewrites (`host-console.test.ts`
   entry/panel cases) move into the rewriting task's file set — a red
   attendee test anywhere is a bug, not a license to change behavior.
7. **QA = CI** with the §8.8 discipline (targeted tests during
   development; full test before commit; lint after green; build at
   handover; per-wave CI batching by the process). **Merge mode: default
   per-feature approval** (owner ratification 2026-11-24) —
   `ready-for-merge` handovers wait for the owner's OK relayed via
   concept; the process merges squash-only.
8. **No new dependencies anywhere:** the chart is hand-rolled SVG; QR
   reuses the app's existing `uqr`; no mocks; existing endpoints only
   (§54).

### 9.5 Sequencing & parallelism plan

**Critical chain:** TZ13-01 → (TZ13-02 ∥ TZ13-03 ∥ TZ13-04) → TZ13-05.

| Wave | Tasks running in parallel | Gate to enter |
| --- | --- | --- |
| 1 | TZ13-01 | — |
| 2 | TZ13-02, TZ13-03, TZ13-04 | TZ13-01 merged (all three also depend only on the delivered v2 plumbing) |
| 3 | TZ13-05 | TZ13-02…TZ13-04 all merged |

**Why this is safe in parallel:**
- TZ13-01 owns every shared module (i18n keys, ledger store, `InviteQr`
  extraction, key rename) — nothing else touches those files.
- Wave-2 tasks touch **disjoint route files**: TZ13-02 = `routes/host/+page.svelte`
  + `HostEntryCard`; TZ13-03 = `routes/host/[room_address]/**` + stats
  components; TZ13-04 = the two invite routes + `InviteManager`/`InviteRow`.
  All consume only TZ13-01's contract plus the delivered api-client/hostApi.
- TZ13-03 carries the panel and its statistics together because both
  render on the same route and share its Poller — the §3.7.2/§3.7.5 split
  stays per-part within the one card (27 ACs; XL per the §8.8.6 sizing
  precedent; compaction covers the cap).
- **Merge order within wave 2 is free** (each branch is self-contained
  and gates-green); TZ13-01 must land first; TZ13-05 strictly last. No
  task except TZ13-05 may edit another task's files; violations are bugs.

### 9.6 Definition of Done — tz13 round

1. **All 58 DESIGN rev. 4 host acceptance criteria pass** — recorded
   1:1 with evidence in `docs/verification-v40.md` (TZ13-05); any failure
   is a filed, closed bug.
2. **CI green on `dev`** after the last merge (`make lint && make test &&
   make build`).
3. **Route tree live:** the rev. 3 single-page console is fully replaced
   by the four routes; no tab bar on any host route; the Host entry stays
   out of the footer nav (§10.1.8/§54.4).
4. **Rule gates honest:** no handshake metrics, no zeros, no proxy metric
   and no locked control for rule B (hint line only); the rule-D locked
   row is non-interactive; no `listHandshakesOfUser`/`deleteRoomUser`
   call anywhere in host code (grep-clean).
5. **Link text never rendered** on the QR page or anywhere on the host
   tree (test + grep).
6. **i18n complete:** RU/EN parity green over the enlarged dictionaries;
   §4.7 rev. 4 audit clean; locale switch works mid-flow.
7. **No new runtime dependencies**; `uqr` shared extraction done and
   lazy; bundle budgets hold (any page ≤ 80 kB; recorded).
8. **Credential/ledger custody:** the creation token never persisted;
   `bleak.hostRoom` untouched as the sole host credential;
   `bleak.hostInvites.*` append-only and the only new storage key family;
   `bleak.hostNotice` rename complete; attendee identity never touched by
   host flows.
9. **Backend-dependency notes recorded** (F9/F10 + rules B/D → §54.5
   ledger); `tz2-07a` remains the pre-authorized follow-up for M5–M7.
10. **Ownership trail complete:** every task closed via the task DB with
    its criteria; bug branches attributable to their feature worker's
    hash; session records and logs committed.

### 9.7 Flags for the concept agent (unbuildable/ambiguous — flagged, not resolved)

1. **`tz2-07a` (flag 6.9a) is the one backend-blocked UX piece of the
   round:** when the amendment lands, M5–M7 build per the §3.7.5
   specification without redesign (placement pre-designed in TZ13-03).
   The pre-authorization stands; the concept agent should sequence the
   backend amendment before or right after this round to unblock the full
   seven-metric panel.
2. **F9/F10 backend confirmation** (`UpdateRoomRequest` fields; PUT
   security scheme) are ledger items — no client work this round; the F9
   editable controls are pre-designed and open as a small follow-up when
   the backend accepts the fields.
3. **Pre-credential probe exception (§9.4.2)** is a documented delta vs
   ARCHITECTURE §10.3's "transcript-fallback-only" `apiRaw` wording —
   behavior matches DESIGN §3.7.1 exactly; flagged so the owner is not
   surprised by the allowlist extension (an ARCHITECTURE §10.3 amendment
   may follow per DESIGN §6.15).
4. **Notice-key rename** (`bleak.hostReset` → `bleak.hostNotice`,
   TZ13-01) is a delivered-code naming delta vs rev. 3 — resolved within
   the round; flagged for the record.
5. **Ledger scope note (rule C):** codes minted from other devices cannot
   be reconstructed as expired — they vanish from the invite page when
   they expire (DESIGN §6.14 caveat, binding copy shipped); a server-side
   invite-history endpoint would retire the ledger (backend TODO
   candidate; orphaned local entries after a room deletion are kept
   by design).
6. **XL-card watch (TZ13-03, 27 ACs):** per the §8.7.8 precedent, the
   process should watch for a stalled card and split bug rounds early;
   per-part criteria remain the acceptance granularity (no mid-task
   `ready-for-merge`).

---

*End of Part III — TZ pass 3, architect `81037a13`, 2026-11-24. The process
agent owns the `tz13` build loop; per-task sessions get their own hashes
via `open-feature.sh` with `tz-section` pointing at the `tz13-NN`
references above. Supersedes the host slice of TZ2-07 Part B (dated
pointer note in Part II); supersedes TZ-09's `/host` console (Part I,
delivered).*


