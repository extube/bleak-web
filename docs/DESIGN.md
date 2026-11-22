# bleak-web — Product Design (rev. 3 — v2 credentials)

Design instance: `bd636f23` (2026-11-15); baseline: rev. 2 by `fd19a963`
(2026-11-14, owner-approved; **v1 delivered and running — do not regress what
v2 does not touch**). Authority chain: `docs/Concept.md` (owner-approved v1 +
**§6 v2 scope, owner-approved 2026-11-15**; §1c rulings remain binding except
where §6 supersedes them — §6 wins) → `docs/ARCHITECTURE.md` incl. **§10 v2
credentials addendum** → this document. API contract:
`/mount/bleak-node/docs/swagger.json` (still v0.1.0; credential endpoints per
bleak-node CONCEPT §7 / `docs/PLAN-ownership-tokens.md` — TBD field names are
isolated in the api-client, see §6). Visual brief: the three reference images
in `docs/refs/` (patterns binding, re-styled into the dark pixel palette of
Concept §4).

> **Revision 2 (2026-11-14):** owner rulings on the flagged gaps are applied —
> the **camera QR scanner is now in v1** (two contexts: invite-QR join and
> scan-a-person mutual handshake), the **personal QR ships on the profile
> badge**, the **no-composer rule is strict and permanent**, decline is
> confirmed as local dismissal, auto-matchmaking is a documented future
> mechanic, and the import/ownership risk is owner-accepted. §3.8 (scanner
> overlay) is new; §6 flags are renumbered after resolving 2, 5, 6, 7.
>
> **Revision 3 (2026-11-15):** the owner-approved **v2 credentials scope**
> (Concept §6 + ARCHITECTURE §10) is applied onto the delivered v1 baseline:
> personas and rooms are owned via **client-generated tokens**
> (`Authorization: Bearer` on every persona mutation and gated read); the
> badge QR becomes a **live one-time mutual code** (`?u=…&m=…`, visible
> rotation); the scanner calls the **server-mediated**
> `POST /api/handshake/mutual` (the v1 two-POST client routine and its
> already-mutual precheck are deleted); import becomes **vault-driven** (the
> device token vault replaces the server room picker); the host gate takes
> the **one-time creation token** (never stored) and the console gains an
> **invite-management block**, room-token drill-down with clear/kickoff, and
> room-token rotation; the **global 401 gate** and first-class
> **403 income-rule / 410 stale-code** states are specified (new §2.8/§2.9);
> §3.1, §3.6, §3.7, §3.8 are substantially rewritten. §4.7 copy table
> extended (+37 keys). Acceptance-criteria coverage: **118** (was 100; §3.9
> maps the deltas).

This document is self-contained: a worker must be able to implement any page
from its section alone without reading the references.

---

## 0. Product summary (one paragraph)

bleak-web v2 is a live event-networking app. An attendee scans a QR / enters a
6-digit invite code, lands in the event **room**, creates (or imports) a
**persona** — an agent defined by a greeting and bios — browses other
attendees, sends **handshakes** (or scans another attendee's personal QR for
an instant mutual handshake); when a handshake is mutual, bleak-node
auto-creates a **chat** and the two attendees' agents hold a conversation which
both attendees read live — **agents are the only speakers; humans never type
messages** (Concept §1c ruling 4). The event **host** creates the room with a
one-time creation token, receives the QR + invite codes to share, and observes
the room. **Credential model (v2, Concept §6 + ARCHITECTURE §10):** humans own
their personas via client-generated access tokens (`Authorization: Bearer` on
every persona mutation and gated read) — a persona can be edited, imported, or
used to handshake only by its token holder; QR handshakes are
**server-mediated one-time capabilities** — the badge QR carries a single-use
mutual code the backend burns on use, so one screenshot of a badge is worth
exactly one handshake. The SPA remains a thin, contract-driven client of
bleak-node; our only server-side component is the now-stateless invite-QR
image helper (ARCHITECTURE §10.10).

---

## 1. Sitemap & navigation model

### 1.1 Routes

| Route | File (SvelteKit) | Audience | Tab bar? | Purpose |
| --- | --- | --- | --- | --- |
| `/` | `routes/+page.svelte` | attendee | no | Join by 6-digit code / QR scan / deep link → persona creation (new or imported) |
| `/room` | `routes/room/+page.svelte` | attendee | yes | Radar "Around me" — live spatial view of the room; scan-a-person entry |
| `/people` | `routes/people/+page.svelte` | attendee | yes | Full attendee list, search, filters, handshake actions |
| `/chats` | `routes/chats/+page.svelte` | attendee | yes | List of agent dialogs (mutual handshakes) |
| `/chats/[address]` | `routes/chats/[address]/+page.svelte` | attendee | no | Dialog transcript (read-only) + kickoff |
| `/profile` | `routes/profile/+page.svelte` | attendee | yes | Persona badge card (with personal QR), editing, stats, locale, leave room |
| `/host` | `routes/host/+page.svelte` | host | yes* | Host console: one-time creation token, room creation, invite management, share kit, live room view |

*The Host tab is always visible in the tab bar (an attendee may also be the
host); the host page itself never requires an attendee identity.

Parameterized routes: only `/chats/[address]` — `address` is a chat address
(`0xchat123`-style string from `ChatResponse.address`).

Deep links on `/`: `/?code=NNNNNN` (what the host's invite QR encodes, via
`INVITE_URL_BASE`; unknown/absent `code` → normal manual entry state) and
`/?u={userAddress}&m={mutualCode}` (what a persona badge QR encodes, §3.6 —
with an identity it runs the §3.8 mutual-handshake routine including the
confirm card; without `m` it degrades to a single-direction handshake
request; without an identity both are ignored).

**Scanner overlay — deliberately NOT a route.** The camera scanner is the
shared `QrScanner` overlay component (§3.8), mounted on `/` (invite-QR join,
ruling 6a) and `/room` (scan-a-person, ruling 6b). Rationale: an overlay keeps
the camera lifecycle bound to a component mount/unmount (stream stopped the
moment the overlay closes, on any navigation), avoids route churn mid-flow
(join Step 1 → scanner → back to Step 1 with state intact), and there is no
scannable state worth bookmarking — a scanner URL would be a dead deep link.
The **persona QR deep link** is still honored without the scanner: `/` accepts
`/?u={userAddress}&m={mutualCode}` (what a persona badge QR encodes) and runs
the §3.8 mutual-handshake routine — full routine including the confirm card —
when an identity exists (graceful fallback if a persona QR is opened by the
phone's camera app instead of scanned in-app); `/?u=` without `m` runs the
single-direction variant (§3.8).

### 1.2 Bottom tab anatomy (adapted from `docs/refs/searching.png`)

Five tabs, fixed bottom bar (height `--bottom-tabbar-height` = 64px):

| # | Icon (pixel glyph) | Route | RU | EN |
| --- | --- | --- | --- | --- |
| 1 | ◉ concentric radar | `/room` | Рядом | Around |
| 2 | ☺ pixel face | `/people` | Люди | People |
| 3 | ▤ dialog lines | `/chats` | Диалоги | Chats |
| 4 | ☾ badge/id card | `/profile` | Профиль | Profile |
| 5 | ★ star (host) | `/host` | Хост | Host |

(The scaffold's `TabBar.svelte` already matches this set; icons are placeholders
to be replaced by pixel-art SVG glyphs per §4.4.)

- Active tab: accent yellow (`--color-accent`) icon + label + 2px accent dot
  under the label; inactive: `--color-text-muted`.
- Tab bar container: `--color-surface`, top edge stepped with `.pixel-corners`.
- Badge (notification dot): a small accent dot on the Chats tab icon when the
  newest chat in `listChatsOfUser` is newer than the last time the user visited
  `/chats` (timestamp kept in `localStorage`, key `bleak.chatsSeen`).
- Tap targets ≥ 48px, `aria-current="page"` on the active tab, `nav` has
  `aria-label` ("Основная навигация" / "Main navigation").

### 1.3 Navigation guards & transitions

- Routes `/room`, `/people`, `/chats`, `/chats/[address]`, `/profile` require
  an identity (`identity` store ≠ `null`). If missing → client-side redirect to
  `/` (never a dead screen).
- `/` when identity exists → shows a resume card ("Продолжить в «{room.name}»"
  / "Continue to {room.name}") plus a secondary "Присоединиться к другому
  событию" ("Join another event") that clears identity and reveals the code
  entry.
- `/host` never redirects on missing identity.
- Back behavior: `/chats/[address]` header has a back control (history back;
  if `history.length` makes back meaningless → `/chats`). All other navigation
  is via tabs / explicit links.
- On any navigation between tab routes, the leaving page's Poller is stopped
  (`Poller.stop()` on route teardown — architecture rule).

---

## 2. Cross-cutting UX

### 2.1 Global state patterns (used identically on every page)

**Loading (first data arrival).** On route mount, before the first successful
fetch resolves, the page shows **skeletons**: 2–4 `SkeletonBlock` shapes that
mimic the page's real card layout (surface `--color-surface-elevated`,
`.pixel-corners`, opacity pulse 1.2s, no layout shift). Poll-driven refreshes
never re-show skeletons — data swaps in place.

**Error.** Errors render as an `ErrorBanner` pinned to the top of the page
content area (below the header, above content):

- `NetworkError` (venue Wi-Fi died): copy RU «Нет связи. Проверьте Wi-Fi — мы
  продолжаем попытки.» / EN "Connection lost. Check the Wi-Fi — we keep
  retrying." The Poller keeps running with backoff (3× after 2 consecutive
  failures — architecture §5); when a tick succeeds, the banner is removed
  automatically. A "Повторить" / "Retry" button forces `poller.refresh()`.
- `ApiError`: show the server's plain-text body, muted, with the copy RU
  «Ошибка сервера» / EN "Server error" as the title. Recovery is manual
  (Retry) — 4xx responses are usually deterministic (e.g. room deleted).
- Any thrown error must never leave a blank screen; the page always renders
  header + banner + last-known data (if any) or empty state.

**Empty.** `EmptyState` component: a small pixel-art glyph (16×16 grid SVG,
drawn from the same pixel language as avatars), one sentence of copy, and —
where an action exists — one CTA. Copy per page is specified in each page
section; both languages required.

**Disabled/coming-later.** The only such element in v1 is the contact-exchange
stub on `/chats/[address]` (§ 3.5): a full-width locked row, disabled,
`aria-disabled="true"`, with the copy RU «Поделиться контактом — скоро» / EN
"Share contact — coming later". It is never enabled by any flow in v1.

### 2.2 Polling etiquette (per architecture §5)

One `Poller` per page, instantiated in the route file only; `stop()` on
teardown; `refresh()` on `visibilitychange → visible` and on route mount.
Cadences:

| Page | Endpoints polled | Interval |
| --- | --- | --- |
| `/room`, `/people` | `listRoomUsers` + `listHandshakesOfUser` | 4 s |
| `/chats` | `listChatsOfUser` (+ `listRoomUsers` for name resolution) | 4 s |
| `/chats/[address]` | `listChatMessages` | 2 s |
| `/profile` | token-gated `getRoomUser` (persona Bearer) for the badge live-QR liveness flag (`mutual_code_live`, §3.6); stats fetched on mount + after mutations | 4 s |
| `/host` | `listRoomUsers` + `getRoom` | 5 s |

Renderers use keyed `{#each}` and diff in the caller so a poll that returns
identical data does not re-render.

### 2.3 Localization (RU primary)

- Hand-rolled typed dictionaries (`lib/i18n/{ru,en}.ts`); RU is the default;
  locale persisted in `localStorage` (`bleak.locale`), sets `<html lang>`.
- Every string in this document is given as `RU / EN`. Workers must add the key
  to **both** dictionaries (parity is CI-enforced).
- The room/user `language` field (agents' conversation language) is a backend
  concern and is displayed as data, never switched by the UI locale control.

### 2.4 Design-token usage

Only `tokens.css` / `base.css` values may be used; **hardcoded hex values in
components are a review error** (architecture §1). Mapping used throughout
this document:

| Role in this doc | Token |
| --- | --- |
| Page background | `--color-bg` (#1A1C20) |
| Cards, inputs, message bubbles (others') | `--color-surface` (#101213) |
| Elevated surfaces: my message bubble, segmented tracks, skeletons, sheets | `--color-surface-elevated` (#292C2D) |
| Accent — ONLY active/interactive: active tab, CTAs, handshake sent state, incoming-request pill, live indicators, "Me" chip backdrop | `--color-accent` (#FEDC5C) with `--color-accent-ink` (#101213) text/icons on it |
| Primary text / headings | `--color-text` (#F0F0F0) |
| Secondary copy, hints, timestamps | `--color-text-muted` (#919397) — never below 14px |
| Disabled (contact stub, disabled buttons) | `--color-text-disabled` (#4A4C4E) / `--color-text-disabled-strong` (#606264) |

Type: `--font-pixel` (Handjet) for logo, page titles, the big invite code, and
stat counters only. `--font-body` (Inter) for everything else including all
chat text. No pixel font below 24px.

### 2.5 Motion (performance-first)

All animation is transform/opacity only (compositor-friendly, no layout
animations). Durations: micro 120 ms, standard 200 ms, ambient 90 s.
`prefers-reduced-motion: reduce` disables the ambient radar rotation and
skeleton pulse; state changes become instant. Full rules in §4.6.

### 2.6 Accessibility (AA basics, hard goal)

- Touch targets ≥ 48px (`--touch-target`) for all interactive elements.
- Visible focus: the base.css `:focus-visible` accent outline is never removed.
- Semantic structure per page: one `<h1>` (page title), `<nav>` for the tab
  bar, `<main>` for content, `<ul>/<li>` for lists, `<button>` for actions
  (never `<div onclick>`).
- The radar (`/room`) is decorative-enhancement: rings are `aria-hidden`;
  avatar nodes are real buttons with `aria-label`s («Алиса — открыть карточку»
  / "Alice — open card"); the People tab is the canonical accessible list.
- Live regions: `aria-live="polite"` announces "хендшейк отправлен", "новые
  сообщения" and poll-recovery after network errors.
- Icon-only controls (back, close, copy) carry `aria-label`s.
- Contrast: body text ≥ 4.5:1 (charcoal palette passes; muted text only at
  ≥ 14px), text on accent uses `--color-accent-ink` (#101213 on #FEDC5C ≈ 12:1).

### 2.7 Camera scanner — cross-cutting rules (Concept §1c rulings 3 & 6)

The camera scanner is in v1, in two contexts (§3.8 owns the full UX spec):
**(a)** scanning an **invite QR** opens the join flow on `/`; **(b)** scanning
a **persona QR** (another attendee's badge) sends BOTH handshake calls
(A→B and B→A) and ends in the mutual-chat success state. Rules that apply
wherever the scanner runs:

- **One component, two contexts:** the `QrScanner` overlay is context-aware
  (hint text, fallback action, result handling differ per context); the
  viewfinder, permission handling and detection loop are identical.
- **Manual fallback is always one tap away** (owner ruling 6): every scanner
  state — including mid-scan — offers the manual path (enter the 6-digit code
  on `/`; close the scanner and use the People/radar lists on `/room`).
- **Camera is privileged and short-lived:** the stream starts only after an
  explicit user tap (never on overlay mount), and `MediaStreamTrack.stop()`
  runs on close, on result, and on navigation — the camera light must always
  go off.
- **Deployment footnote (architecture-relevant):** camera access requires a
  **secure context (HTTPS, or localhost for dev)** — `navigator.mediaDevices`
  is undefined on plain HTTP, and the overlay must degrade to its
  no-camera state, not crash. QR detection uses the `BarcodeDetector` API
  where available (Android Chrome) and lazy-loads a JS decoder fallback
  (`jsQR`, ~14 kB gzip, dynamically imported only when needed) — iOS Safari
  and Firefox always take the fallback path. See §3.8 for the full spec.
- **Performance:** the scanner adds zero cost when unused — the fallback
  decoder and the overlay are code-split; nothing QR-related loads until the
  overlay is opened.
- **Ruling 3 is now server-mediated (v2 — supersedes the v1 client routine):**
  a scanned persona QR (`?u=…&m=…`) is confirmed with a **single**
  `POST /api/handshake/mutual` call carrying the scanner's own Bearer token
  plus the scanned `u` and the one-time mutual code `m`; the backend creates
  both directed handshakes and **burns the code** (bleak-node §7.3). The v1
  client-side two-POST routine and the client already-mutual precheck are
  deleted (§3.8); `?u=` without `m` degrades to a single-direction handshake
  request (Concept §7.3.5).

### 2.8 Global 401 gate UX (ARCHITECTURE §10.3; Concept §6.1)

Every persona-credentialed call that answers **401** means the stored
credential is invalid — or the persona predates credentials (a legacy v1
persona). The `api` singleton handles it globally; pages never render their
own 401 error state:

1. `identity` is cleared (`bleak.identity` removed; `bleak.mutualCode` is
   cleared with it); `sessionStorage` key `bleak.authNotice` is set.
2. Navigation to `/` happens immediately (the gate rethrows after the
   redirect is queued, so no stale error UI flashes under it).
3. `/` on mount consumes `bleak.authNotice` and renders, above the Step-1
   code card, the **notice card**: `--color-surface`, `.pixel-corners`, lock
   pixel glyph, the binding copy below, announced `aria-live="polite"` on
   render; the sessionStorage key is removed after rendering (the notice
   appears once per incident, not on every reload).

> **Binding notice copy (Concept §6.1):** RU «У этой персоны нет
> действительного ключа доступа — присоединитесь заново по коду события.» /
> EN "This persona has no valid access credential — join again with the
> event code."

Facts a worker must respect:

- **No retry and no reload affordance** on the notice card — the only way
  forward is the join flow itself (the credential is dead; there is nothing
  to retry against).
- **Legacy v1 personas land here by design:** a persisted identity without a
  token is dropped at app init (ARCHITECTURE §10.4); the owner accepted that
  legacy personas are unrecoverable — this notice is the only legacy-facing
  UI in the product.
- **Host-symmetric gate:** `hostApi` 401/403 on a room-token call clears
  `bleak.hostRoom` and resets the host console to the creation-token gate
  (§3.7); it never touches attendee identity.
- The transcript viewer fallback (§3.5) is the **only** code path allowed to
  catch a 401 before the gate fires (ARCHITECTURE §10.3 escape hatch).

### 2.9 Credential error-state patterns (new in v2)

Three named, first-class states; every surface that can produce them renders
the same copy (keys in §4.7). They never degrade into a generic "server
error" banner.

| State | Trigger | Copy (RU / EN) | Surfaces |
| --- | --- | --- | --- |
| **Income rule (403)** | a handshake send rejected by the room's income>outcome rule | «Лимит исходящих хендшейков — сначала получите рукопожатия в ответ.» / "Outgoing handshake limit reached — receive handshakes first." (server text appended in muted small text when present) | `HandshakeSheet` on `/room` and `/people`, People card «+» action, scanner result panel, single-direction deep-link card (§3.8) |
| **Stale mutual code (410)** | `POST /api/handshake/mutual` answered 410 | «Код уже использован — попросите обновить QR на карточке.» / "Code already used — ask them to refresh their badge QR." | scanner result panel; the `?u&m` deep-link confirm path on `/` |
| **Invalid invite code (creation rejected)** | `POST /api/room/{room}/user` rejected over the code | «Код приглашения недействителен или истёк.» / "The invite code is invalid or expired." | join Step 3a/3b inline error |

Rules for all three:

- **Retry semantics (bleak-node §7.3.4):** a **failed** attempt
  (NetworkError, 403, 410) never burns the one-time mutual code — only
  successful server verification does. Therefore NetworkError retries may
  safely re-send `u` + `m`; a 410 offers **no retry** for the dead code
  (only «Сканировать снова» / close); a 403 income-rule retry is allowed
  after the user receives handshakes — its copy must never imply that the
  scanned badge was consumed.
- **401 vs 403 split:** 401 on a credentialed call → the global gate (§2.8,
  attendee) or the host reset (§3.7); 403 with a *valid* token (wrong
  record or rule) → inline error with the server's plain-text body,
  identity kept.
- **Announcements:** all three states announce via `aria-live="polite"`
  (Concept §6.8).

---

## 3. Pages

Each section below is complete on its own. Data fields are named exactly as in
swagger.json (`User.name`, `Handshake.status`, `ChatResponse.phase`, …). v2:
every credentialed call is marked in the endpoint tables (**persona Bearer** /
**room token** / public no-token); tokens are auto-injected per context —
attendee `api` vs host `hostApi` (§2.8, ARCHITECTURE §10.3) — pages never
pass tokens manually.

### 3.1 `/` — Join

**Purpose.** Get a non-technical attendee from "I have a code / QR" to "I am in
the room with my persona" in under 60 seconds, on a phone, over bad Wi-Fi.
This is the conversion screen; every extra field costs attendees.

**Primary jobs.**
1. Enter, deep-link, or **scan (invite QR)** a 6-digit invite code and resolve
   it to a room (via the `resolveInviteCode` seam — Concept §6.9b).
2. Create a persona in that room — the creation request carries the
   `invite_code` together with a **client-generated persona token** — or
   import one from the **device vault** (a persona created on this phone at
   a previous event).
3. Land on `/room` with identity + token saved.

**API endpoints used.**

| Step | Endpoint (client method) | Notes |
| --- | --- | --- |
| Resolve code | `resolveInviteCode(code)` — the adapter seam `lib/api/invite-resolve.ts` (ARCHITECTURE §10.6; backend shape TBD per Concept §6.9b) | room address; invalid/unknown code surfaces an error state |
| Room preview | `GET /api/room/{address}` (`getRoom`) — public read, **no token** | name, description, language, max_user |
| Member count | `GET /api/room/{room}/user` (`listRoomUsers`) — public read | length only |
| Create persona | `POST /api/room/{room}/user` (`createRoomUser`, body = `CreateUserRequestV2`) — **no auth header (join)** | `name`, `public_bio?`, `private_bio?`, **`invite_code`** (the resolved 6-digit code), **`token`** (client-generated raw persona token, hashed server-side) |
| Import: read old persona | `GET /api/room/{room}/user/{address}` credentialed with the **vault entry's stored token** | full fields incl. `private_bio`; 404 = dead entry |
| Re-create persona (import) | `POST /api/room/{room}/user` (`CreateUserRequestV2`) | the new room's `invite_code` + a **new** generated token |

Deliberately **not** called for import (superseded by the vault, Concept
§6.2 / ARCHITECTURE §10.6): `GET /api/room` room listings and server-side
persona pickers — without a token, private fields are unreadable and listing
other rooms' personas is exactly the impersonation surface v2 closes.

**Layout (mobile-first, single column, max-width 480px centered).**
No tab bar. Regions top→bottom:
1. **Header**: pixel logo mark + wordmark "bleak-web" (Handjet), centered,
   generous top spacing (`--space-7`).
2. **401 notice card** (only when `bleak.authNotice` is set; §2.8): rendered
   above Step 1, consumed on render.
3. **Step 1 — code entry card** (`--color-surface`, `.pixel-corners`):
   - Title «Войти на событие» / "Join the event" (h1, Handjet).
   - Subtitle: «Введите 6-значный код приглашения с QR-кода или из
     приглашения.» / "Enter the 6-digit invite code from the QR or the
     invitation."
   - `DigitInput`: six single-character cells, large (56px), Inter 24px,
     numeric `inputmode`, paste-support, auto-advance, backspace-retreat;
     invalid chars rejected silently; when 6 digits present the CTA enables.
     The entered 6-digit string **is** the invite code carried into
     `CreateUserRequestV2.invite_code` at persona creation — no second code
     entry exists.
   - CTA «Войти в комнату» / "Enter the room" (pill, accent) — disabled until
     6 digits.
   - **Scan entry** (ruling 6a): below the CTA, a divider line and a
     secondary text-button with the scan pixel glyph — «Или отсканировать
     QR-код» / "Or scan a QR code" — that opens the `QrScanner` overlay
     (§3.8, context *a*). A detected invite code enters Step 1 exactly as if
     typed: cells filled, CTA enabled, auto-submit; the scanner closes first.
     Permission/no-camera/fallback states are owned by the overlay (§3.8);
     the manual fallback action in this context = close the scanner and
     focus the digit cells.
   - Deep link: `?code=NNNNNN` prefills the cells and auto-submits.
     `?u={userAddress}&m={mutualCode}` / `?u={userAddress}` with an existing
     identity run the §3.8 handshake routines (full confirm card; AC 19).
   - Footer row: locale `SegmentedControl` RU | EN (bottom-left of the card).
4. **Step 2 — room card**: after resolution the card content swaps to the room
   preview: room `name` (Handjet), `description`, a meta row «Язык агентов:
   ru · Участников: 12» / "Agent language: ru · Members: 12" (`language`,
   member count vs `max_user`). Two stacked options:
   - Primary CTA «Создать персону» / "Create persona".
   - Secondary (pill outline) «Импортировать с этого устройства» / "Import
     from this device" — the v2 label (the picker lists device-stored
     personas, not server rooms).
   - Small link-button «Изменить код» / "Change code" → back to Step 1.
5. **Step 3a — persona form** (replaces options, same card): `name` (required,
   ≤ 64 chars), `public_bio` (optional, «Кто вы — увидят другие» / "What others
   see"), `private_bio` (optional, «Только для вашего агента» / "For your agent
   only"). Submit CTA «Войти в комнату». Submit sequence (ARCHITECTURE
   §10.6): generate the persona token (`generateTokenSecret()`, crypto
   module) → `POST createRoomUser` with
   `{ name, public_bio, private_bio, invite_code, token }` → on success
   `saveIdentity({ roomAddress, userAddress, token })` **and append the vault
   entry** (`bleak.tokenVault`: roomAddress, userAddress, token, name,
   savedAt) → navigate `/room`.
6. **Step 3b — vault import flow** (Concept §6.2): a `VaultList` of the
   personas **created on this device** — one `VaultRow` per `bleak.tokenVault`
   entry: `PixelAvatar` by user address, persona `name`, muted meta
   «Сохранено {date} · комната {room}» / "Saved {date} · room {room}". Tap a
   row → fetch the old persona **with its stored token** (credentialed
   `getRoomUser`) → prefills the persona form (full fields incl.
   `private_bio`) with the notice «Персона будет скопирована в это событие» /
   "The persona will be copied into this event" → same submit as 3a but with
   a **newly generated token**. On success both vault entries remain: the old
   persona untouched, the new persona appended. The vault is **append-only**
   — this flow never deletes entries; a dead persona surfaces its error
   honestly (state table below). Empty vault: muted copy «На этом устройстве
   пока нет сохранённых персон.» / "No saved personas on this device yet." +
   a link back to "Create persona". There is **no token-less import
   fallback** — without the stored token the private fields are unreadable,
   which is exactly the impersonation risk v2 closes.

**Interaction states.**

| State | Rendering |
| --- | --- |
| Resolving code | CTA shows inline spinner, disabled; skeleton not used (single action) |
| Code 404 (seam) | Inline field error under cells, RU «Код не найден — уточните его у организатора.» / "Code not found — check with the host." Cells shake once (120 ms) unless reduced motion |
| Code malformed (400) | Same style, copy «Код должен быть 6 цифр.» / "The code must be 6 digits." |
| `NetworkError` | `ErrorBanner` per §2.1; entered code preserved |
| Persona submit 400 (e.g. name empty) | Field-level error from server text |
| Persona submit with invalid/expired/revoked `invite_code` (server 4xx on create) | Inline error above the submit CTA: RU «Код приглашения недействителен или истёк.» / "The invite code is invalid or expired." (Concept §6.2 copy, binding). Identity and vault unchanged; «Изменить код» re-opens Step 1 |
| Persona submit 409 | RU «Такое имя в комнате уже занято.» / "That name is already taken in the room." (server conflict surfaced) |
| Import read fails — dead persona (server 404/401/403 on the credentialed `getRoomUser`) | **Dead-entry error state** on the vault row / form card: RU «Эта персона больше не существует на сервере. Запись останется в списке, но импорт невозможен.» / "This persona no longer exists on the server. The entry stays listed, but it cannot be imported." (401/403 variant: same state with the server text appended muted). The vault entry is **not** removed (append-only) |
| Import read `NetworkError` | `ErrorBanner`; vault list preserved |
| Room deleted meanwhile (404 on `getRoom`/`createRoomUser`) | Card error state: «Событие больше не доступно.» / "This event is no longer available." + back to Step 1 |
| 401 on any credentialed join call (e.g. a stale vault token) | Global gate (§2.8): notice card on `/`, identity cleared — the vault entry itself is untouched |

**Responsive.** Phone-first single column. ≥ 720px: card stays 480px, centered
vertically; background remains `--color-bg` (no split layout — the join is a
mobile ritual).

**Accessibility.** The six digit cells are one labelled group
(`aria-label` «Код приглашения»); each cell has `aria-label` "цифра N".
Error text is announced via `aria-live="polite"`. Focus moves to the room card
title after successful resolution. The 401 notice card is announced
`aria-live="polite"` (§2.8). Vault rows are buttons with accessible names
«Импортировать персону {name}» / "Import persona {name}".

**Acceptance criteria.**
1. With no identity, opening `/` shows the code entry card and no tab bar.
2. When `bleak.authNotice` is set, `/` renders the §2.8 notice card above the
   code card with the exact Concept §6.1 copy, announces it
   `aria-live="polite"`, consumes the sessionStorage key (a reload does not
   show it again), and offers no retry/reload control on the notice itself.
3. Entering a valid 6-digit code and submitting resolves it via
   `resolveInviteCode` (the invite-resolve seam) and shows the room preview
   (room `name`, `description`, `language`, member count) without a full page
   reload.
4. Opening `/?code=NNNNNN` (valid code) auto-fills the six cells and submits
   automatically.
5. An unknown code shows the 404 copy «Код не найден — уточните его у
   организатора.» inline, keeps the digits entered, and does not navigate.
6. When the seam/network is unreachable, the NetworkError banner (§2.1 copy)
   appears and the entered code survives.
7. "Create persona" reveals the form; submitting with an empty `name` is
   prevented client-side and shows the field error.
8. A successful `POST /api/room/{room}/user` sends `name`, both bios,
   `invite_code` (the entered/resolved code) and a client-generated `token`
   in the body with no auth header, then saves
   `{ roomAddress, userAddress, token }` to `localStorage`
   (`bleak.identity`), appends an entry to `bleak.tokenVault`, and navigates
   to `/room`.
9. Persona creation rejected over the invite code shows «Код приглашения
   недействителен или истёк.» inline, saves no identity, writes no vault
   entry, and keeps the form filled.
10. A duplicate-name 409 shows «Такое имя в комнате уже занято.» and keeps
    the form state.
11. "Import from this device" opens the vault list built exclusively from
    `bleak.tokenVault` entries (room address, persona name, saved date) and
    never calls `GET /api/room` or any server-side persona picker.
12. Selecting a vault entry fetches the old persona with **its stored token**
    (credentialed `getRoomUser`, incl. `private_bio`), prefills the form, and
    on submit re-creates it in the new room with `invite_code` + a **new**
    generated token; the old entry is untouched and the new entry is
    appended.
13. Import of a dead persona (server 404 on the credentialed read) shows the
    dead-entry error state with the specified copy and does not remove the
    vault entry.
14. An empty vault shows «На этом устройстве пока нет сохранённых персон.»
    with a way back to persona creation.
15. With an existing identity, `/` shows the resume card with the room name
    and a working "join another event" action that clears identity and the
    `mutualCode` store but keeps the vault.
16. The RU|EN segmented control switches all visible strings on this page and
    persists across reloads.
17. All six digit cells are keyboard-reachable; paste of a 6-digit string
    fills all cells.
18. The "Or scan a QR code" button opens the `QrScanner` overlay (§3.8,
    context *a*); closing it (X, Escape, or the manual-fallback link) returns
    to Step 1 with the entered digits intact and focuses the cells; scanning
    an invite QR continues the normal flow identically to manual entry.
19. Opening `/?u={userAddress}&m={mutualCode}` with an existing identity runs
    the §3.8 mutual routine **including the confirm card** (success or
    per-case states); `/?u={userAddress}` without `m` shows the
    single-direction confirm card and sends one `POST /api/handshake`;
    without an identity both parameter sets are ignored and the normal join
    card renders.

---

### 3.2 `/room` — Radar "Around me"

**Purpose.** The emotional home screen (reference `searching.png`): a live
spatial map of who is around, where relationship distance = interaction state.
Also the fastest path to send a handshake.

**Primary jobs.**
1. Show me at the center and other attendees positioned on rings by
   relationship state.
2. Let me open any attendee's card and send a handshake.
3. Show incoming requests ("added you") at a glance.

**API endpoints used.**

| Endpoint (client method) | Data used |
| --- | --- |
| `GET /api/room/{address}` (`getRoom`) — once per mount — public read, **no token** | room `name` for header |
| `GET /api/room/{room}/user` (`listRoomUsers`) — 4 s poll — public read, **no token** | attendees: `address`, `name`, `public_bio`, `created_at` |
| `GET /api/handshake/user/{address}` (`listHandshakesOfUser`) — 4 s poll — **gated read, persona Bearer** | my handshakes: `from_address`, `to_address`, `created_at`, `status` |
| `GET /api/user/{address}/chat` (`listChatsOfUser`) — with each poll tick — **gated read, persona Bearer** | which counterparts already have a chat |
| `POST /api/handshake` (`createHandshake`) — **persona Bearer (the `from` persona's token, auto-injected)** | on user action: `{ from_address, to_address, status: 1 }` |

**Layout (mobile-first, full-bleed).**
1. **Top bar** (fixed, `--color-surface`, 56px): left — room `name` (Handjet,
   truncated); right — a scan icon-button (48px touch target, scan pixel
   glyph, `aria-label` «Сканировать QR персоны» / "Scan a persona QR") that
   opens the `QrScanner` overlay (§3.8, context *b*) — the single scan-a-person
   entry point in v1 (placement decision: the radar is the "who's around"
   surface and already carries the relationship context; a second entry in
   `/people` would duplicate the gesture against the People list's own
   per-card actions) — then the muted live-dot (pulsing accent dot while the
   poller is healthy; solid muted when in error/backoff) + member count «12».
2. **Radar area** (fills the viewport between top bar and tab bar,
   `--color-bg`):
   - **Center "Me" chip**: my pixel avatar (accent `#FEDC5C` backdrop — the
     only accent backdrop in the app, marking the active persona) with my
     `User.name` below; the count «{N} вокруг вас» / "{N} around you"
     (N = other attendees) either under the chip or in a small center bubble —
     implement as: chip + count text directly beneath it.
   - **Concentric rings**: 3 dashed SVG rings (1px, `--color-text-disabled-strong`
     at 40% opacity), radii ~28% / 56% / 84% of the available min-dimension.
     Slow rotation (90 s, transform-only) — `aria-hidden`, disabled under
     reduced motion.
   - **Avatar nodes**: other attendees as `PixelAvatar` (44px) + `name` label
     (12px, `--color-text-muted`) placed **deterministically**: ring by
     relationship (see below), angle by `fnv1a(address) % 360°`, radius jitter
     ±6% by hash. Placement must be stable across polls (no jumping).
   - **Ring semantics** (inner → outer):
     1. inner ring: attendees with an existing chat with me (mutual handshake);
     2. middle ring: attendees with a handshake pending (in either direction —
        outgoing marked with a small accent dot on the avatar, incoming with an
        accent ring around the avatar);
     3. outer ring: no interaction yet.
   - If more than 14 attendees, the 14 lowest-hash addresses render on the
     radar and a muted counter «+N ещё» / "+N more" sits on the outer ring;
     the full list lives in `/people`.
3. **Bottom sheet** (opened on node tap): `HandshakeSheet` — see `/people`
   §3.3 (the same component; the sheet slides over the radar, tab bar stays).

**Interaction behavior.**
- Tap an avatar node → opens `HandshakeSheet` for that user (bottom sheet:
  avatar, name, `public_bio`, relationship status line, primary action).
  Actions per state:
  - no handshake: CTA «Отправить хендшейк» / "Send handshake" →
    `POST /api/handshake` (my persona Bearer, auto-injected); on 201/200 the
    button morphs to «Хендшейк отправлен» / "Handshake sent" (accent-filled)
    and the avatar moves to the middle ring on the next poll tick (also force
    `refresh()` immediately). **On 403 (income rule):** the §2.9 income-rule
    state renders inline in the sheet — copy «Лимит исходящих хендшейков —
    сначала получите рукопожатия в ответ.» / "Outgoing handshake limit
    reached — receive handshakes first." (+ server text muted when present);
    the button returns to the active state; nothing was sent, so no
    auto-retry — the user may re-tap later (e.g. after receiving
    handshakes).
  - outgoing only: button disabled-labeled «Хендшейк отправлен — ждём ответа» /
    "Handshake sent — waiting for theirs".
  - incoming only: pill «Добавил вас» / "Added you" + CTA «Ответить
    хендшейком» / "Handshake back" → `POST /api/handshake` (reverse direction,
    my persona Bearer); when mutual, bleak-node creates the chat — after
    success the sheet shows
    «Агенты уже общаются» / "Your agents are already talking" with a link
    «Открыть диалог» / "Open dialog" → the counterpart's chat.
  - mutual/chat exists: CTA «Открыть диалог» / "Open dialog" → `/chats`.
- `NetworkError` during a handshake POST → inline error in the sheet, button
  returns to active state.
- Poll diffing: a user who left (soft-deleted) disappears from the radar on the
  next tick.
- **Scan entry (ruling 6b):** the top-bar scan button opens `QrScanner`
  (§3.8, context *b*); the overlay receives the current member list as props.
  A successful scan (server-mediated mutual handshake, §3.8) ends in the
  mutual-chat success state (link to the chat); on close, force
  `poller.refresh()` so the counterpart's node appears on the inner ring.
- **Future mechanic (owner ruling 1, NOT in v1):** bleak-node will implement
  auto-matchmaking — agents scan the room, rank users by a relevance score
  (matched interests coefficient), raise the score on incoming handshakes, and
  auto-send a handshake when a user crosses threshold N. **V1 ships manual
  handshakes only; no score UI, no mock loop.** When the backend ships the
  mechanic, the radar/people pills add score and auto-handshake states from
  real API data (design note only; no v1 acceptance criteria depend on it).

**States.**
- **Loading**: radar area shows the Me chip + 4 skeleton dots on the rings
  (no rings animation until data arrives).
- **Empty** (no other attendees): rings + Me chip remain; centered copy under
  the chip: RU «Пока никого. Попросите код приглашения у хоста — или сами
  поделитесь им.» / EN "Nobody here yet. Ask the host for the invite code — or
  share yours." (links to `/profile` badge / `/host` if the visitor is the
  host is out of scope; the sentence is static copy).
- **Error**: `ErrorBanner`; the last-known positions stay rendered dimmed
  (opacity 0.5) while retrying.

**Responsive.** Phone-first full-bleed square-ish radar. ≥ 720px: the radar
keeps the full viewport height; the Me chip area gains the room `description`
under the count (muted, one line).

**Accessibility.** As §2.6: nodes are buttons with per-user `aria-label`s
including the relationship state («Алиса — хендшейк ещё не отправлен» / "Alice
— handshake not sent yet"); the ring layer is `aria-hidden`; the count has
`aria-live="polite"` so "N around you" changes are announced. A visually-hidden
heading structure still exposes «Рядом со мной» as `h1`.

**Acceptance criteria.**
1. `/room` renders the Me chip (my avatar with accent backdrop + my name) at
   the center and one node per other room attendee, placed on exactly one of
   the three rings per the relationship semantics (chat / pending / none).
2. Node positions derive from the user `address` hash and do not move between
   poll ticks when the data is unchanged.
3. The header shows the room `name` and the live member count, which updates
   after a 4 s poll without user action.
4. Tapping a node opens the bottom sheet with the user's `name`, `public_bio`
   and the correct action for the current relationship state.
5. "Send handshake" calls `POST /api/handshake` with `from_address` = my
   address and the persona Bearer token attached, and moves the node to the
   middle ring within one refresh.
6. An incoming-only handshake shows the «Добавил вас» pill and "Handshake
   back"; after success the sheet offers "Open dialog" linking to the created
   chat.
7. Repeated "Send handshake" on the same pair is idempotent (server returns
   200) and the UI treats 200 and 201 identically.
8. When no other attendees exist, the empty copy «Пока никого…» is shown and
   no nodes are rendered.
9. When the poller fails, the error banner appears with the §2.1 NetworkError
   copy and auto-dismisses on recovery; a "Повторить" button forces an
   immediate refresh.
10. With more than 14 attendees, exactly 14 nodes render and a «+N ещё»
    counter appears.
11. All avatar nodes are focusable buttons with descriptive `aria-label`s;
    Enter/Space opens the sheet.
12. Navigating away from `/room` stops its poller (no network requests after
    teardown).
13. The top-bar scan icon-button opens the `QrScanner` overlay (§3.8, context
    *b*) with the current member list; closing it leaves the radar unchanged
    until the next poll tick.
14. A scanner success (mutual handshake created server-side via
    `POST /api/handshake/mutual`) is reflected on the radar within one
    refresh: the counterpart's node sits on the inner ring.
15. A 403 income-rule rejection on any handshake send from the sheet shows
    the §2.9 income-rule state inline (server text visible when present),
    the node stays on its ring, and no optimistic "sent" state is shown.

---

### 3.3 `/people` — Attendee list

**Purpose.** The complete, scannable roster (reference `design-concept.png`,
middle screen): every attendee as a stacked card with their state, plus
search and status filters. The canonical, accessible list backing the radar.

**API endpoints used.** Same as `/room` (§3.2) — `listRoomUsers` (public) +
`listHandshakesOfUser` + `listChatsOfUser` (both **gated reads, persona
Bearer**) on a 4 s poll; `POST /api/handshake` on action (**persona Bearer,
auto-injected**).

**Layout (mobile-first, single column).**
1. **Header**: h1 «Люди» / "People" (Handjet) + member count muted; below it a
   search input (surface, pill, 48px, placeholder RU «Поиск по имени или био…»
   / "Search by name or bio…") — filters client-side on `name` and
   `public_bio`, debounced 150 ms.
2. **Filter chips row** (horizontal scroll, `SegmentedControl`-style pills on
   `--color-surface-elevated` track): Все / All · Отправлены / Sent · Добавили
   вас / Added you · Общаемся / Chatting. Single-select; active pill =
   accent. (Interest filters are impossible in v1 by design — the mock
   interests are client-side-only, architecture §8.1.)
3. **Card list** (stacked `PersonCard`s, 12px gap):
   - Left: `PixelAvatar` (56px).
   - Main: `User.name` (16px, `--color-text`), one line `User.public_bio`
     (14px muted, truncated) — the "role · company" line of the reference.
   - Right column: state pill + timestamp:
     - none: no pill, muted relative time of `User.created_at`
       («2 мин» / "2 min" — joined);
     - outgoing pending: pill outline muted «Хендшейк отправлен» / "Handshake
       sent" + time of `Handshake.created_at`;
     - incoming pending: pill accent-filled «Добавил вас» / "Added you" + time
       of `Handshake.created_at`;
     - mutual (chat exists): pill outline accent «Общаемся» / "Chatting" +
       relative time of `Chat.created_at`.
   - Card-level action (right edge, 48px touch target):
     - none → icon-button «+» pixel glyph, `aria-label` «Отправить хендшейк
       Алисе» / "Send handshake to Alice"; tap sends `POST /api/handshake`
       (persona Bearer) without opening the sheet; on success the card flips
       to the outgoing-pill state (in-place, no reorder); on 403 the §2.9
       income-rule state renders inline inside the card (below the name
       line, `aria-live="polite"`) and the card stays in the "none" state.
     - incoming pending → the card expands in place to reveal two buttons:
       «Ответить хендшейком» / "Handshake back" (accent) and «Закрыть» /
       "Dismiss" (outline — collapses the card only; **ruling 2 confirmed**:
       there is no decline server-side and the backend never has one — a
       handshake simply stays pending until the reciprocal arrives, i.e.
       «ожидает ответного рукопожатия» semantics). This is the reference's
       "Added you" Accept/Decline pattern adapted: **Accept = handshake back;
       Decline = just closing the card** (nothing is sent to the server).
       **Copy guidance:** never imply rejection — the request still exists
       server-side and a dismissed card may reappear (it re-expands on a
       later poll tick / page re-entry). Dismissal is tracked in an
       in-memory set of addresses per page visit so a dismissed card renders
       collapsed until its state changes or the page is re-entered.
     - mutual → icon-button ▤ with `aria-label` «Открыть диалог с Алисой» /
       "Open dialog with Alice" → `/chats/{chat.address}`.
4. Cards are keyed by `User.address`; poll updates mutate in place; **no
   reordering on poll** (order = stable: newest `created_at` first, computed
   once per data change that actually differs).
5. **Future mechanic (owner ruling 1):** auto-matchmaking (relevance score →
   auto-handshake) is a backend TODO only; the People list stays
   manual-handshake-only in v1 (see the note in §3.2).

**States.**
- Loading: 3 skeleton cards.
- Empty room: `EmptyState` «Комната пока пуста.» / "The room is empty so far."
- Empty search: «Никого не найдено по «{q}»» / "Nobody matches “{q}”" + a
  «Сбросить» / "Reset" chip-link.
- Error: `ErrorBanner`, last-known list stays visible dimmed.

**Responsive.** ≥ 720px: two-column card grid (CSS grid, min card width
360px); filters and search stay full-width above.

**Accessibility.** Each card is a `<li>` with the state pill text available to
screen readers (the time is `aria-hidden` decoration but also given in a
title). The expand-on-incoming interaction is keyboard-operable: the card is
focused via its action button, Enter expands.

**Acceptance criteria.**
1. `/people` renders one card per room attendee showing `User.name`,
   `User.public_bio`, the avatar derived from `User.address`, and the correct
   relationship pill + timestamp per the mapping above.
2. The search field filters by `name` and `public_bio` (case-insensitive,
   debounced) and shows the empty-search state with the query echoed.
3. The filter chips reduce the list to the selected relationship state, and
   the active chip is visually accent-filled.
4. Tapping «+» on a no-handshake card sends `POST /api/handshake`
   (from = me, to = that user) and flips the card to «Хендшейк отправлен»
   without reordering the list.
5. An incoming-pending card, when tapped, expands to reveal "Handshake back"
   and "Dismiss"; "Handshake back" sends the reverse `POST /api/handshake`
   and the card becomes «Общаемся» with a dialog link.
6. "Dismiss" only collapses the card and sends nothing to the server; the
   request still exists server-side, so the card may re-expand on a later
   poll tick or page re-entry — no copy or state may imply it was declined.
7. A mutual card's ▤ action navigates to `/chats/{address}` of the existing
   chat with that user.
8. Cards update in place from the 4 s poll; a user deleted from the room
   disappears; no duplicate cards ever render.
9. When the room has no attendees, the «Комната пока пуста.» empty state with
   the pixel glyph is shown.
10. When the network fails mid-session, the banner appears, the list remains
    visible (dimmed), and recovery auto-dismisses the banner.
11. The list is a semantic `<ul>`; every action button has an `aria-label`
    naming the person.
12. On ≥ 720px viewports the cards lay out in two columns without horizontal
    scroll.
13. A 403 income-rule rejection on the card-level «+» action shows the §2.9
    income-rule copy inline in the card (`aria-live="polite"`), leaves the
    card in the "none" state, and sends no other request.

---

### 3.4 `/chats` — Dialog list

**Purpose.** The attendee's inbox of agent conversations (what the reference
labels "Activity"): every mutual handshake has produced a chat; this screen
lists them and leads into transcripts. It also explains the mechanic when
empty.

**API endpoints used.**

| Endpoint (client method) | Data used |
| --- | --- |
| `GET /api/user/{address}/chat` (`listChatsOfUser`) — 4 s poll — **gated read, persona Bearer** | chats: `address`, `phase`, `scenario`, `language`, `created_at`, `participants` |
| `GET /api/room/{room}/user` (`listRoomUsers`) — alongside, cached | resolve participant addresses → names/avatars |
| `POST /api/handshake` — only via empty-state CTA path (link to `/people`) | — |

**Layout (mobile-first, single column).**
1. **Header**: h1 «Диалоги» / "Chats" + muted subtitle RU «Здесь общаются ваши
   агенты» / "Where your agents talk".
2. **Chat card list** (`ChatCard`, stacked, 12px gap):
   - Left: counterpart's `PixelAvatar` (56px) — counterpart = the participant
     whose `user ≠ identity.userAddress` (chats are 1:1 in v1; if a chat ever
     has ≠ 2 participants, render the first counterpart and show «+N»).
   - Main: counterpart `User.name` (16px); below, a meta line of two chips:
     `phase` (e.g. `networking`) and `scenario` (e.g. `ai-future`) — muted
     outline chips, verbatim server values.
   - Right: relative time of `Chat.created_at` («5 мин» / "5 min"), muted.
   - No message preview in v1 (would need one messages request per chat per
     poll — too heavy on venue Wi-Fi; rationale §5).
3. Tap card → `/chats/{address}`.

**States.**
- Loading: 2 skeleton cards.
- Empty: `EmptyState`, pixel glyph of two avatars + dot, copy RU «Диалогов пока
  нет. Взаимный хендшейк запускает разговор агентов.» / "No dialogs yet. A
  mutual handshake starts the agents' conversation." + CTA «Найти людей» /
  "Find people" → `/people`.
- Error: `ErrorBanner` per §2.1.
- Deleted chat (counterpart leaves / chat removed): the chat disappears from
  the list on the next tick. A re-handshake re-creates it (server behavior) —
  no client state needed.

**Responsive.** ≥ 720px: two-column grid like `/people`.

**Accessibility.** Cards are `<a>`-wrapped list items with full accessible
names: «Диалог с Алисой · networking · ai-future» / "Dialog with Alice ·
networking · ai-future".

**Acceptance criteria.**
1. `/chats` renders one card per chat from `listChatsOfUser` (fetched with
   the persona Bearer — a gated read), showing the counterpart's name and
   avatar, and verbatim `phase` and `scenario` chips.
2. The counterpart is derived from `participants` minus my `userAddress`; a
   chat with an unexpected participant count still renders with the first
   counterpart plus «+N».
3. The relative time of `Chat.created_at` is shown and updates on polls.
4. Tapping a card navigates to `/chats/{chat.address}`.
5. With zero chats, the empty state shows the specified copy and a "Find
   people" CTA that navigates to `/people`.
6. The Chats tab shows an accent notification dot when a chat is newer than
   the stored `bleak.chatsSeen` timestamp, and the dot clears after visiting
   `/chats`.
7. The list refreshes every 4 s in place; a removed chat disappears without a
   reload.
8. Network failure shows the §2.1 banner and preserves the last-known list.

---

### 3.5 `/chats/[address]` — Dialog transcript

**Purpose.** Read the live conversation between the two agents (the actual
networking outcome), understand who is speaking, and restart the dialog
(kickoff) if wanted.

**STRICT RULE (owner ruling 4, all versions):** **humans never send messages —
only agents communicate in messages.** A human's only actions in the product
are handshakes and (future) contact access. **No message composer, no input
field, no "type a reply" affordance may exist in any chat UI, in any version**;
`POST /api/message` is never exposed to attendees in the UI. This resolves the
former §6 flag 6: the owner ruled humans interact with nothing in messages —
not even injecting a turn.

**Route parameter.** `address` — chat address; unknown/404 → full-page not-found
state (§ below).

**API endpoints used.**

| Endpoint (client method) | Cadence | Data used |
| --- | --- | --- |
| `GET /api/chat/{address}` (`getChat`) — **participant persona Bearer; on 401/403 with a stored room token → one retry with the room token (viewer fallback, below)** | on mount + when participants of a poll differ | `phase`, `scenario`, `language`, `participants`, `created_at` |
| `GET /api/chat/{address}/message` (`listChatMessages`) — same credential policy as `getChat` | 2 s poll | messages: `from`, `to`, `content`, `created_at`, `tx_id` |
| `POST /api/chat/{address}/kickoff` (`kickoffChat`) — **persona Bearer (or the room token in host-observation context)** | on user action | response: `chat`, `cleared`, `speaker` |

**Transcript viewer fallback (ARCHITECTURE §10.3 escape hatch).** The
transcript is normally read with the attendee's persona Bearer (participant
context). When that read fails with 401/403 **and** a
`bleak.hostRoom.roomToken` exists on the device, the page retries **once**
with the room token (host observing a member's dialog) via the raw ungated
client (`apiRaw`) — the only code path in the app allowed to catch a 401
before the global gate. A host-context 401 there clears `bleak.hostRoom`
(host reset, §3.7) — never the attendee identity. Without a stored room
token, the §2.8 global gate applies. When the fallback served the data, the
header shows a small muted chip «Наблюдение хоста» / "Host view" so the
viewer knows which context they are in.

**Layout (mobile-first).**
1. **Header** (fixed top, 56px, `--color-surface`, `.pixel-corners` bottom
   edge): back icon-button (48px, `aria-label` «Назад» / "Back"); counterpart
   avatar (32px) + counterpart `User.name`; second line: chips `phase` +
   `scenario` + `language` (muted, 11px) — plus, when the room-token viewer
   fallback served the data, the muted «Наблюдение хоста» / "Host view" chip.
2. **Transcript** (scrollable, newest at bottom, auto-scrolled to bottom on
   new messages; a "scroll to bottom" floating chip appears when the user has
   scrolled up):
   - `MessageBubble` per message: **mine** ( `message.from === identity.userAddress`
     — the human's persona is a speaker too when agents quote it) aligned
     right on `--color-surface-elevated`; **theirs** aligned left on
     `--color-surface`; both with `.pixel-corners`, 14px Inter, max-width 80%.
   - Under each bubble: speaker `name` (11px muted) + relative time of
     `created_at`. Sender resolution via the participants map.
   - Message text is plain text (server content ≤ 255 symbols); no markup
     rendering, `white-space: pre-wrap`.
   - Day/time grouping: no grouping in v1 (dialogs are minutes long).
3. **Footer zone** (above tab-bar area; this page has no tab bar):
   - **Kickoff button** (pill outline, full-width, 48px): «Запустить диалог
     заново» / "Restart the dialog". Tap → `ConfirmDialog` (pixel-cornered,
     surface): title «Начать разговор заново?» / "Start the conversation
     over?"; body RU «История диалога будет очищена, и агенты начнут сначала.
     Первым говорит отправитель самого раннего хендшейка.» / "The dialog
     history will be cleared and the agents will start over. The sender of the
     earliest handshake speaks first."; buttons «Отмена» / "Cancel" (outline)
     and «Запустить» / "Restart" (accent). Confirm → `POST kickoff`; on 201 the
     transcript clears and a toast/inline note shows RU «Первым говорит
     {speaker name}» / "{speaker name} speaks first" (resolve `speaker`
     address against participants; if unresolvable, show the raw address).
     While agents have not yet spoken after kickoff, show a muted in-flow
     status row «Агенты готовятся…» / "The agents are warming up…" that
     disappears with the first new message (poll detects it).
   - **Contact-exchange stub** (disabled row, lock pixel-glyph): «Поделиться
     контактом — скоро» / "Share contact — coming later", `--color-text-disabled`,
     `aria-disabled="true"`, no handler. This is the v1 extension point
     (architecture §8.2).

**States.**
- Loading: skeleton bubbles (3, alternating alignment).
- Empty (chat exists, zero messages — e.g. right after creation or kickoff):
  centered muted copy RU «Агенты готовятся…» / "The agents are warming up…"
  with a subtle pulsing pixel glyph.
- Error: `ErrorBanner`; the transcript keeps last-known messages.
- Chat not found (404 from `getChat` or first `listChatMessages`): full-page
  state in the transcript area: RU «Диалог не найден — возможно, он был
  удалён.» / "Dialog not found — it may have been deleted." + button
  «К списку диалогов» / "Back to dialogs" → `/chats`.

**Responsive.** Phone-first. ≥ 720px: transcript column max-width 640px
centered; header spans full width.

**Accessibility.** Transcript is `<ol>` reversed-safe (messages oldest→newest
in DOM); each bubble is an `<li>` whose accessible name is «{speaker}: {first
60 chars of content}». New-message announcements: `aria-live="polite"` on a
visually-hidden counter ("новое сообщение от {name}"). Kickoff confirm dialog
traps focus, closes on Escape, returns focus to the kickoff button.

**Acceptance criteria.**
1. Opening `/chats/{address}` loads the chat via `getChat` and renders all
   messages from `GET /api/chat/{address}/message` oldest-first, with mine
   right-aligned and the counterpart's left-aligned per `message.from`.
2. Each bubble shows the speaker's name and relative `created_at` time.
3. New messages appear within one 2 s poll tick without reload, and the view
   auto-scrolls to the bottom unless the user has scrolled up, in which case a
   "scroll to bottom" chip appears and works.
4. The header shows the counterpart name and verbatim `phase`, `scenario`,
   `language` chips.
5. "Restart the dialog" opens a focus-trapped confirm dialog with the specified
   copy; Cancel closes without effects; Confirm calls
   `POST /api/chat/{address}/kickoff` (persona Bearer), after which the
   transcript clears and the «Первым говорит {name}» note is shown.
6. After kickoff, until the first new message arrives, the «Агенты готовятся…»
   status row is visible and disappears with the first polled message.
7. The contact-exchange stub is always visible, disabled, non-interactive, and
   reads «Поделиться контактом — скоро» / "Share contact — coming later".
8. A 404 chat renders the not-found state with a working link back to
   `/chats`.
9. Network failure during polling shows the banner while keeping the last
   transcript visible; recovery auto-dismisses.
10. Messages render as plain text with `pre-wrap`; a 255-symbol message never
    overflows its bubble.
11. The back control returns to `/chats`.
12. Leaving the page stops the 2 s poller.
13. **No-composer check (ruling 4):** the transcript UI contains no message
    input, textarea, or send control of any kind — the only interactive
    elements are the back control, the kickoff button (+ its confirm dialog),
    and the disabled contact stub.
14. When the persona-token read fails with 401/403 and a stored room token
    exists, the page retries once with the room token and renders the
    transcript with the «Наблюдение хоста» / "Host view" chip; a
    host-context 401 there clears the host session (never the identity) and
    resets the host console.
15. Without a stored room token, a 401 on the transcript's credentialed
    reads triggers the §2.8 global gate: identity cleared, redirect to `/`
    with the notice card — no transcript error UI renders first.

---

### 3.6 `/profile` — Persona badge

**Purpose.** The attendee's own persona card (reference `design-concept.png`,
left screen — the "event badge" re-styled): identity, greeting, bios,
interests (mock), stats; plus the editing surface, the **live one-time badge
QR**, **access-token rotation**, the locale switch, and the exit door.

**API endpoints used.** (Credentialed calls carry the persona Bearer —
auto-injected per the §10.2 attachment policy; ARCHITECTURE §10.2/§10.8.)

| Endpoint (client method) | Data / use |
| --- | --- |
| `GET /api/room/{room}/user/{address}` (`getRoomUser`) — **persona Bearer** | on mount + 4 s badge poll: `name`, `greeting`, `public_bio`, `private_bio`, `language`, `created_at`, **derived `mutual_code_live`** |
| `GET /api/room/{room}/user/{address}/greeting` (`getUserGreeting`) — **persona Bearer** | canonical greeting for the editor |
| `PUT /api/room/{room}/user/{address}/greeting` (`putUserGreeting`) — **persona Bearer** | save edited greeting |
| `POST /api/room/{room}/user/{address}/greeting/regenerate` (`regenerateGreeting`) — **persona Bearer** | regenerate from bios |
| `PUT /api/room/{room}/user/{address}` (`updateRoomUser`) — **persona Bearer** | save name / public_bio / private_bio |
| `POST /api/room/{room}/user/{address}/mutual-code` (`registerMutualCode`) — **persona Bearer; body carries the SHA-256 hash of the new code, never the raw code** | badge live-QR registration (below) |
| `POST /api/room/{room}/user/{address}/token` (`rotateUserToken`) — **Bearer = the current persona token; body = the new raw token** | token rotation |
| `GET /api/handshake/user/{address}` (`listHandshakesOfUser`) — **gated read, persona Bearer** | stats: sent vs received counts |
| `GET /api/user/{address}/chat` (`listChatsOfUser`) — **gated read, persona Bearer** | stat: dialogs count |
| `DELETE /api/room/{room}/user/{address}` (`deleteRoomUser`) — **persona Bearer** | "Leave room" |

**Layout (mobile-first, single column).**
1. **Header**: h1 «Профиль» / "Profile".
2. **Badge card** (the persona badge, reference pattern; `--color-surface`,
   `.pixel-corners`, generous padding):
   - Top row: `PixelAvatar` 96px (accent backdrop — own persona) + big
     `User.name` (Handjet 28px) + muted `User.language` meta («Язык агента:
     ru» / "Agent language: ru" — **read-only**; `language` cannot be set via
     the API, flag 3).
   - **Greeting block**: quoted block (accent 3px left bar, italic muted):
     the greeting text; caption RU «Открывает каждый новый диалог агента» /
     "Opens each of your agent's new dialogs" + edit icon-button.
   - **Bio rows**: «О себе» / "About" → `public_bio`; «Для агента» / "For your
     agent" → `private_bio` (caption RU «видно только вашему агенту» / "only
     your agent sees this").
   - **Interests row**: my interest chips from the mock profile store —
     `emoji + label` pills (outline muted); edit icon-button opens the chip
     editor (see below). If empty: muted «Интересы не выбраны» / "No interests
     yet" + add chip.
   - **Stat counters** (reference's counters re-styled): two square tiles
     (surface-elevated, big Handjet numerals): «Хендшейки {n}» / "Handshakes
     {n}" (total) and «Диалоги {n}» / "Dialogs {n}".
   - **Live personal QR block** (v2 — supersedes the static v1 badge QR): a
     `QrCodeBadge` at the bottom of the badge card — a client-side-rendered
     QR SVG (~200px, quiet zone 4 modules) encoding the **binding payload**
     (bleak-node §7.3.5):
     `{INVITE_URL_BASE}?u={identity.userAddress}&m={mutualCode}` — the
     one-time mutual code from the `mutualCode` store. Caption below (muted,
     14px): «Покажите, чтобы обменяться рукопожатиями» / "Show this to trade
     handshakes"; a second muted line: «QR одноразовый — после обмена он
     обновится сам.» / "The QR is one-time — it refreshes itself after a
     handshake." The QR is **not** interactive (nothing to tap — the other
     person scans it with their in-app scanner or phone camera); it sits in
     the light frame (`--color-qr-frame`, shared token with the host
     share-kit QR) and issues **no network request by itself**.
     **Live rotation (Concept §6.3):** while the page is open, the 4 s poll
     of the token-gated `getRoomUser` watches the derived
     `mutual_code_live` flag. When it reads **false** (a scan burned the
     code): generate a fresh 16-byte code (`generateMutualCode()`),
     register its **hash** via `registerMutualCode(room, address, token,
     sha256Hex(code))`, update the `mutualCode` store, and re-render the QR
     with the rotation micro-animation (§ below). A registration failure
     keeps the last QR; the next poll tick retries (the flag still reads
     false). The raw code persists client-side (`bleak.mutualCode`,
     validated against `identity.userAddress` on load; stale/mismatched →
     treated as no code, re-registered on load) so the QR re-renders after a
     reload — the server keeps only the hash.
     **Rendering approach for workers (performance-first, unchanged from
     rev. 2):** use the tiny dependency-free QR encoder — **`uqr` (~3 kB,
     zero deps, MIT, synchronous, SVG output)** — statically imported only
     in the `/profile` route chunk (code-split; zero cost for every other
     page). Modules render the `--color-surface` value on the near-white
     `--color-qr-frame` backdrop (single token in `tokens.css`, shared with
     the host share-kit QR; the one declared functional exception to the
     dark palette). Scannability requires this light backdrop.
3. **Editor** (inline swap of the badge card content, one screen at a time):
   - **Persona editor**: `name`, `public_bio`, `private_bio` fields
     (prefilled) → `PUT updateRoomUser` (omitted-field semantics: send all
     three). Save CTA + Cancel.
   - **Greeting editor**: textarea (max 255, counter shown) + the rule text as
     helper copy RU «Приветствие открывает каждый новый диалог. Без вопросов —
     только утверждения.» / "The greeting opens every new dialog. No questions
     — statements only." Client-side validation: any `?` (or `?` full-width)
     disables Save with inline error RU «Уберите вопросительные знаки —
     приветствие не может содержать вопросов.» / "Remove the question marks —
     the greeting must not contain questions." (server 400 surfaced with the
     same copy if it slips through). Save → `PUT putUserGreeting`.
   - **Regenerate greeting** button (outline) in the greeting editor:
     «Сгенерировать заново» / "Regenerate" → `POST …/greeting/regenerate`;
     result replaces the textarea content (not saved until Save).
   - **Interests editor**: the mock model from architecture §8.1 — a preset
     catalog of `Interest {id, label, emoji}` (shipped with the app,
     RU/EN label pairs) and my selection stored client-side only
     (`localStorage bleak.interests`); add/remove chips; done button. Never
     sent to bleak-node.
4. **Settings block** (below the badge card, quiet list):
   - **Locale**: `SegmentedControl` RU | EN (same control as `/`).
   - **Regenerate access token** (v2): settings row with the key pixel
     glyph — «Сгенерировать новый ключ доступа» / "Regenerate access token"
     → `ConfirmDialog`: title «Сгенерировать новый ключ доступа?» /
     "Regenerate the access token?"; body RU «Текущий ключ перестанет
     действовать: другие устройства с этим ключом потеряют доступ к
     персоне.» / "The current credential will stop working: other devices
     holding it will lose access to this persona."; buttons «Отмена» /
     "Cancel" (outline) and «Сгенерировать» / "Regenerate" (accent).
     Confirm → generate the new secret (`generateTokenSecret()`) →
     `rotateUserToken(room, address, identity.token, newRaw)` (Bearer =
     current, body = new raw token) → replace `identity.token` and rewrite
     the matching `bleak.tokenVault` entry's token in place → transient
     inline check «Ключ обновлён» / "Credential updated". No mutual-code
     re-registration is needed (the code hash is bound to the user record,
     not the token). On 401/403: §2.8/§2.9 handling (401 → global gate;
     403 → inline server text, identity kept).
   - **Leave room**: destructive row «Выйти из комнаты» / "Leave the room" →
     `ConfirmDialog`: RU «Ваша персона будет удалена из комнаты вместе с
     хендшейками и диалогами.» / "Your persona will be removed from the room
     along with its handshakes and dialogs." Confirm → `DELETE
     …/user/{address}` (persona Bearer) → clear identity + `mutualCode` →
     navigate `/`. On error (e.g. server rule blocks the delete): inline
     error with the server text, identity kept.

**Rotation micro-animation (visible by design, Concept §6.3).** When the QR
re-renders after a burn+refresh cycle: the old module layer fades/scales out
and the new one steps in — a two-phase 320 ms effect, transform/opacity only:
modules `opacity 1→0` + `scale(0.96)` over 140 ms, SVG data swap, then
`opacity 0→1` + `scale(0.96→1)` over 180 ms ease-out; a transient inline
accent chip «QR обновлён» / "QR refreshed" (auto-hides after 2 s) announces
the swap `aria-live="polite"`. Under `prefers-reduced-motion: reduce` the
animation is skipped (instant swap; the note still shows). The effect is a
design feature, not decoration: it teaches the one-time mechanic ("show,
scan, it flips") and signals that any earlier screenshot of the badge is
worthless.

**States.**
- Loading: skeleton badge card (avatar circle + 3 text bars + 2 stat tiles).
- Error: `ErrorBanner`; if the initial `getRoomUser` 404s (persona deleted
  elsewhere): full-card state «Персона не найдена» / "Persona not found" +
  button «Выйти» / "Leave" that just clears identity → `/`.
- Mutation pending: the affected CTA shows a spinner; double-submit prevented.
- Rotation pending: the settings row shows a spinner (the dialog is closed
  first); the badge poller keeps running throughout.
- Success feedback: a transient inline check (no toasts system in v1; the
  edited value simply renders).

**Responsive.** ≥ 720px: badge card max-width 560px centered; stat tiles grow
into a row of three (add «Добавили вас {n}» / "Added you {n}" from the
handshake list when there is room).

**Accessibility.** Stat numerals have accessible names («Хендшейков: 7» /
"Handshakes: 7"). The greeting textarea has a permanent visible label. The
disabled Save state is `aria-disabled` with the reason in the error line
(`aria-live="polite"`). The QR `<svg>` has `role="img"` with
`aria-label` «Ваш одноразовый QR для обмена рукопожатиями» / "Your one-time
handshake QR".

**Acceptance criteria.**
1. `/profile` renders the badge card with the user's `name`, `greeting`,
   `public_bio`, `private_bio`, read-only `language`, mock interest chips, and
   the two stat tiles computed from the credentialed handshake and chat lists
   (every fetch carries the persona Bearer).
2. The persona editor saves all three fields via `PUT
   /api/room/{room}/user/{address}` (with the persona Bearer) and the card
   reflects the new values.
3. The greeting editor blocks saving when the text contains `?`, showing the
   specified rule copy, and saves via `PUT …/greeting` (persona Bearer)
   otherwise.
4. "Regenerate" calls the regenerate endpoint and replaces the editor content
   without saving until Save is pressed.
5. Interest chips come from the client-side mock store (`localStorage
   bleak.interests`) using the `Interest {id, label, emoji}` shape; editing
   them never issues a network request.
6. The RU|EN segmented control switches the UI language app-wide and
   persists.
7. "Leave the room" confirms, calls `DELETE /api/room/{room}/user/{address}`
   (persona Bearer), clears `bleak.identity` and `bleak.mutualCode`, and
   navigates to `/`.
8. If the persona is gone (404), the card shows the not-found state and the
   exit path works.
9. Stat tiles announce full values to screen readers («Хендшейков: 7»).
10. No hardcoded colors are used; all surfaces derive from the tokens.
11. The badge card shows the **live** personal QR: a client-side SVG encoding
    `{INVITE_URL_BASE}?u={userAddress}&m={mutualCode}` sourced from the
    `mutualCode` store, with both caption lines («Покажите, чтобы…» and the
    one-time line); the QR element itself issues no network request and is
    not interactive.
12. The badge QR is scannable: dark modules on the light `--color-qr-frame`
    backdrop (shared token with the host share-kit frame); decoding its
    payload in the §3.8 scanner yields both the user address and the mutual
    code.
13. The QR encoder is code-split into the `/profile` route only (no QR-related
    module loads on `/room`, `/people`, `/chats`).
14. **Live rotation:** while the profile page is open, the token-gated
    `getRoomUser` is polled at 4 s for `mutual_code_live`; when the flag
    reads false the app generates a fresh code, registers only its **hash**
    via `POST …/mutual-code` (persona Bearer; the raw code is never sent),
    updates `bleak.mutualCode`, and re-renders the QR with the rotation
    micro-animation plus the transient «QR обновлён» note (`aria-live`);
    a registration failure keeps the last QR and retries on the next tick.
15. **Token rotation:** the settings row opens a confirm dialog with the
    other-device lockout copy; confirming calls `rotateUserToken` with the
    **current** Bearer and the new raw token in the body, then updates
    `identity.token` and the matching `bleak.tokenVault` entry in place; a
    401 triggers the §2.8 global gate, a 403 shows inline server text with
    the identity kept.

---

### 3.7 `/host` — Host console

**Purpose.** The event host's tool: present the operator-granted **one-time
creation token**, create the event room (the client generates the **room
token**), receive the share kit (QR + 6-digit codes + invite links), manage
invite codes (mint/expiry/revoke), and watch and drill into the room live.
Desktop-comfortable (the only page designed desktop-first), but fully usable
on a phone.

**API endpoints used.** (Room-token calls carry `bleak.hostRoom.roomToken`
via the `hostApi` context — auto-injected; a host-context 401/403 resets the
console, §2.8/§3.7 states.)

| Endpoint (client method) | Use |
| --- | --- |
| `POST /api/room` (`createRoom(requestV2, createToken)`) | create room — **one-time creation token in the header** (header name TBD, ARCHITECTURE §10.13.1; proposed `x-create-token`), client-generated room token in the body (`CreateRoomRequestV2`); the creation token is consumed on use |
| `GET /h/rooms/{code}/qr` (`inviteQrUrl`) | QR image (PNG 512px) for the share kit — the helper's only remaining endpoint (now stateless, ARCHITECTURE §10.10) |
| `GET /api/room/{address}` (`getRoom`) — public read, **no token** | room details (`name`, `description`, `language`, `max_user`) |
| `GET /api/room/{room}/user` (`listRoomUsers`) — public read, **no token** — 5 s poll | live member list |
| `GET /api/room/{address}/invite` (`listInvites`) — **room token** | active invite codes |
| `POST /api/room/{address}/invite` (`mintInvite`) — **room token** | mint a code (`{ expires_at? }`; default 24 h server-side) |
| `DELETE /api/room/{address}/invite/{code}` (`revokeInvite`) — **room token** | revoke a code |
| `GET /api/chat/{address}` + `GET /api/chat/{address}/message` — **room token** | member drill-down chat reads (plain chat reads — amendment-independent, ARCHITECTURE §10.3) |
| `DELETE /api/chat/{address}/message` (`clearChatHistory`) — **room token** | clear a member's dialog from the drill-down |
| `POST /api/chat/{address}/kickoff` (`kickoffChat`) — **room token** | restart a member's dialog from the drill-down |
| `POST /api/room/{address}/token` (`rotateRoomToken`) — **Bearer = current room token; body = the new raw token** | room-token rotation |
| `PUT /api/room/{address}` (`updateRoom`) — **room token** | room settings (name, description) |
| `DELETE /api/room/{address}` (`deleteRoom`) — **room token** | end the event |

**Not built in v2 (do not promise):** per-member handshake **counts** — no
viable endpoint without the flag 6.9a amendment (Concept §6.6); the
drill-down ships counts-less (§5 rationale). The helper's `POST /h/rooms`
and `GET /h/rooms/{code}` mapping endpoints are retired (ARCHITECTURE
§10.10); the host console talks to bleak-node directly.

**Layout.**
Phone: single column. Desktop (≥ 900px): two columns — left column the share
kit, right column the live room view; max-width 1080px centered.

1. **Header**: h1 «Хост» / "Host" + subtitle RU «Создайте комнату события и
   поделитесь приглашением.» / "Create the event room and share the invite."
2. **Creation-token gate** (shown when no `bleak.hostRoom` exists — i.e. no
   active room session on this device): `--color-surface` card with a
   password-type input (label «Токен создания комнаты» / "Room creation
   token", masked, 48px, `autocomplete="off"`) + CTA «Продолжить» /
   "Continue". Copy note RU «Одноразовый токен выдаёт оператор
   развертывания. После создания комнаты он больше не нужен и не
   сохраняется.» / "A one-time token issued by the deployment operator.
   After the room is created it is never needed again and is not stored."
   **The token is never persisted anywhere** — it lives only in memory for
   the duration of the create call (it is consumed server-side on use); a
   later console visit shows the gate again unless the share kit restores
   from `bleak.hostRoom`.
3. **Create room form** (card): `name` (required), `description` (optional),
   `language` select (ru | en; this sets the agents' conversation language —
   `CreateRoomRequestV2.language`). On submit the client generates the room
   token (`generateTokenSecret()`) and calls
   `createRoom(requestV2, createToken)`. CTA «Создать комнату» / "Create
   room". (`max_user` is **not** settable — flag §6.3.)
4. **Share kit** (after creation; restored on revisit from
   `bleak.hostRoom = { roomAddress, roomToken, code }`; the room `name` for
   display comes from a public `getRoom`):
   - Big code display: the room's invite `code` in Handjet 40px,
     letter-spaced, on a surface card with a «Скопировать» / "Copy" chip
     (writes the digits).
   - **QR block**: `inviteQrUrl(code)` `<img>` (256px on phone, 320px
     desktop; alt «QR-код приглашения» / "Invite QR code"), pixel-cornered
     light frame (`--color-qr-frame`; the helper renders
     charcoal-on-light).
   - Invite link row: `{INVITE_URL_BASE}?code={code}` (computed
     client-side) + copy icon-button.
   - CTA «Присоединиться как участник» / "Join as attendee" → runs the `/`
     join flow with this code (navigates to `/?code={code}`).
   - Link «Создать другую комнату» / "Create another room" → back to the
     form (the existing room session stays in `bleak.hostRoom` until it is
     replaced or the room is deleted).
5. **Invite management block** (v2, room-token authority — new):
   - Sub-header «Коды приглашения» / "Invite codes" + muted hint RU «Код
     действует до истечения срока; отозвать можно в любой момент.» / "A code
     works until it expires; you can revoke it any time."
   - **Active-code list**: one `InviteRow` per active code (`listInvites`):
     6-digit code (Handjet 24px), muted expiry «истекает через {time}» /
     "expires in {time}", and row actions: copy chip, a QR toggle (reveals a
     small `inviteQrUrl(code)` image for that code), invite-link copy, and
     «Отозвать» / "Revoke" (outline-destructive; no confirm — revocation is
     reversible by minting again). On success the row disappears on the next
     list refresh with the transient note «Код отозван.» / "Code revoked."
     Revoked and expired codes never render in the list.
   - **Mint control**: CTA «Выпустить код» / "Mint a code" opens an inline
     **expiry chooser** — three preset pills «1 час» / "1 hour", «24 часа» /
     "24 hours" (pre-selected default), «7 дней» / "7 days" — plus a fourth
     «Своё время…» / "Custom…" that reveals a compact `datetime-local` input
     (min = now). Mint → `mintInvite(address, roomToken, { expires_at? })` →
     the new code appears at the top of the list **and joins the share kit**
     as a per-code row: each minted code carries its own QR + link copies so
     the host can share several codes side by side (e.g. one per entrance).
     Presets over free datetime by default: a host mid-event needs two taps,
     not a calendar (rationale §5; ARCHITECTURE §10.13.8).
6. **Live room view** (poll 5 s, public reads):
   - Summary tiles: «Участники {n}/{max_user}» / "Members {n}/{max_user}"
     (from `listRoomUsers.length` and `getRoom.max_user`), «Язык {language}» /
     "Language {language}".
   - **Member list**: rows (avatar, `User.name`, joined time from
     `created_at`); each row tap → **member drill-down sheet** (on-demand
     fetches, not polled): the member's dialogs read with the **room token**
     (plain `getChat` + `listChatMessages` per chat address — amendment-independent, ARCHITECTURE §10.3). **Chat discovery
      (honest handling of a contract gap):** the plain reads give no
      room-scoped per-user chat *listing* (that piece is part of the 6.9a
      amendment), so the drill-down shows the member's dialogs only when
      their chat addresses are discoverable (via a 6.9a-style room-scoped
      listing once it exists, or from chat knowledge the console already
      holds); until then the sheet renders the empty-drill-down copy plus a
      muted hint RU «Список диалогов участника появится вместе с серверным
      обновлением (флаг 6.9a).» / "The member's dialog list arrives with the
      server-side amendment (flag 6.9a)." — never invented client side.
      Dialog rows
     link to the read-only `/chats/{address}` transcript (the host observes
     any transcript — the §3.5 viewer fallback context) **and** carry two
     inline host actions per dialog: «Очистить историю» / "Clear history" →
     confirm (body RU «История диалога участников будет очищена.» / "The
     participants' dialog history will be cleared.") → `clearChatHistory`
     (room token); «Запустить заново» / "Restart" → reuses the §3.5 kickoff
     confirm copy → `kickoffChat` (room token). Empty drill-down: «У
     участника пока нет диалогов.» / "This member has no dialogs yet."
     **No handshake counts are shown anywhere in the console** (flag 6.9a).
   - **Host settings** (collapsible): edit `name`/`description` →
     `PUT updateRoom` (room token); **«Сгенерировать ключ комнаты» /
     "Regenerate room token"** → `ConfirmDialog` (title «Сгенерировать ключ
     комнаты?» / "Regenerate the room credential?"; body RU «Текущий ключ
     комнаты перестанет действовать. Продолжить?» / "The current room
     credential will stop working. Continue?") → `rotateRoomToken` → the
     stored `bleak.hostRoom.roomToken` is replaced in place; danger zone
     «Удалить комнату» / "Delete room" → confirm → `DELETE` (room token) →
     clears `bleak.hostRoom`, returns to the create form. Copy warning RU
     «Комната будет удалена вместе со всеми участниками.» / "The room will
     be deleted with all its members."

**States.**
- Creation token rejected (401/403 on create): error under the token field RU
  «Токен отклонён.» / "Token rejected." (server text appended if present);
  the entered value stays masked; nothing is stored; the gate remains.
- Create 400/409: field error from server text (e.g. duplicate name →
  «Комната с таким именем уже есть» surfaced from server body).
- Create pending: CTA spinner; form disabled.
- **Host session reset (`hostApi` 401/403 on any room-token call):**
  `bleak.hostRoom` is cleared and the console resets to the creation-token
  gate with a notice line above it: RU «Доступ к комнате отозван — войдите
  заново с токеном создания.» / "Room access was revoked — sign in again
  with a creation token." (`aria-live="polite"`; attendee identity is never
  touched.)
- Live view empty (no members): «Пока никто не присоединился.» / "Nobody has
  joined yet."
- Live view error: `ErrorBanner`; stale list dimmed.
- Drill-down fetch failure: inline muted error inside the sheet with retry.
- Invite list/mint/revoke failure: inline muted error inside the invite
  block with retry; the share kit is unaffected.
- `getRoom` 404 (room deleted elsewhere): full-section state «Комната
  удалена.» / "The room was deleted." + reset to create form.

**Responsive.** ≥ 900px two-column as above; the share kit + invite block
stay in the left column (sticky), the live view scrolls on the right.

**Accessibility.** Creation-token input is `type="password"` with
autocomplete off and **never logged, stored, or rendered elsewhere**; the
code display has `aria-label` with the digits spelled («Код: 1 2 3 4 5 6»).
Drill-down sheets trap focus; the danger zone is separated with a visible
warning heading; invite rows are list items whose actions carry per-code
`aria-label`s («Отозвать код {code}» / "Revoke code {code}").

**Acceptance criteria.**
1. Without a stored `bleak.hostRoom`, `/host` shows the creation-token gate;
   the entered creation token is never persisted (no
   localStorage/sessionStorage key exists for it) and never rendered anywhere
   except the masked input.
2. A wrong or consumed creation token (401/403 on create) shows «Токен
   отклонён.» under the field, keeps the entered value masked, and stores
   nothing.
3. A successful create generates the room token client-side, calls
   `POST /api/room` with the creation token in the header and the room token
   in the body, and stores `{ roomAddress, roomToken, code }` in
   `bleak.hostRoom`.
4. The share kit renders the 6-digit `code` (Handjet), the QR `<img>` from
   `GET /h/rooms/{code}/qr`, and the invite link
   `{INVITE_URL_BASE}?code={code}`; both copy actions write the correct
   values to the clipboard.
5. Revisiting `/host` with a stored `bleak.hostRoom` restores the share kit
   (room name via public `getRoom`) without re-creating anything.
6. "Join as attendee" navigates to `/?code={code}` (the deep-link flow of
   §3.1 takes over).
7. The invite block lists active codes via `GET …/invite` (room token);
   minting with a preset expiry (24 h pre-selected) or a custom datetime
   calls `POST …/invite` and the new code appears in the list with its own
   copy/QR/link actions.
8. "Revoke" on a code row calls `DELETE …/invite/{code}` and the row
   disappears on refresh with the «Код отозван.» note; revoked and expired
   codes never render as active.
9. The live view polls members every 5 s (public reads); the members tile
   shows `listRoomUsers.length` against `getRoom.max_user`.
10. A member drill-down opens on demand and lists that member's dialogs read
    with the **room token**; each dialog row links to the read-only
    `/chats/{address}` transcript and carries "Clear history" and "Restart"
    actions that call `clearChatHistory` / `kickoffChat` with the room token
    after their confirm dialogs.
11. The console shows **no handshake sent/received counts** anywhere.
12. Host settings save via `PUT /api/room/{address}` (room token);
    "Delete room" confirms, calls `DELETE`, clears the stored room, and
    returns to the create form.
13. "Regenerate room token" confirms with the specified copy, calls
    `rotateRoomToken` with the current Bearer, and updates the stored
    `bleak.hostRoom.roomToken` in place.
14. A host-context 401/403 on any room-token call clears `bleak.hostRoom`,
    resets the console to the creation-token gate, shows the «Доступ к
    комнате отозван…» notice (`aria-live="polite"`), and leaves attendee
    identity untouched.
15. When no one has joined, the live view shows the empty copy; when the
    room is deleted while the console is open, the «Комната удалена.» state
    resets to the create form.
16. On a ≥ 900px viewport the page lays out in two columns with the share
    kit + invite block sticky on the left.

---

### 3.8 `QrScanner` — shared camera scanner overlay (no route)

**Purpose.** The one camera-scanning surface, used in two contexts:
**(a) join** — mounted on `/`, reads an **invite QR** (URL with
`?code=NNNNNN`) and feeds the normal Step 1 flow; **(b) scan-a-person** —
mounted on `/room`, reads a **persona badge QR** (URL with
`?u={userAddress}&m={mutualCode}`, the live code rendered on the §3.6 badge)
and performs the **server-mediated** mutual handshake: the scanner's client
sends a single `POST /api/handshake/mutual` carrying its own Bearer token
plus the scanned `u` + `m`; the backend creates both directed handshakes and
**burns the one-time code** (bleak-node §7.3). The v1 client-side two-POST
routine and the client already-mutual precheck are **deleted** — an
already-mutual pair still burns the code (no second chat server-side), so the
client never special-cases it: it calls the endpoint and treats success as
success. The overlay is opened by an explicit user tap and owns its camera
lifecycle; it is not a route (§1.1).

**QR payload formats (binding).**

| QR | Content | Read by |
| --- | --- | --- |
| Invite QR (host share kit) | `{INVITE_URL_BASE}?code=NNNNNN` | context (a); also the phone's camera app (deep link) |
| Persona QR (profile badge, live) | `{INVITE_URL_BASE}?u={userAddress}&m={mutualCode}` | context (b); also the phone's camera app (deep link) |

The scanner parses the scanned text as a URL on the app's own origin
(`INVITE_URL_BASE`); it accepts any path prefix but requires `code`, or `u`
(with the optional `m`) as query parameters — unknown/foreign QR content
shows the error state «Это не QR-код bleak-web.» / "This is not a bleak-web
QR code." (with «Сканировать снова» / "Scan again" and the manual fallback),
never a silent close.

**Layout (full-screen overlay).**
`position: fixed; inset: 0;` on `--color-bg`, above everything (including the
tab bar). Top→bottom:
1. **Overlay top bar** (56px, `--color-surface`, `.pixel-corners` bottom
   edge): close icon-button (48px, `aria-label` «Закрыть сканер» /
   "Close scanner", X glyph) left; title «Сканировать QR» / "Scan QR code"
   (Handjet, 20px) centered-right.
2. **Viewfinder** (fills remaining space): live `<video>` (`playsinline`,
   `muted`, `autoplay`, `object-fit: cover`) from `getUserMedia`. Over it, a
   centered **scan frame**: a 240px square outlined by four accent-yellow
   (`--color-accent`) pixel corner brackets (8px thick steps, the signature
   detail applied to corners only — the frame interior is untouched video).
   Below the frame, a hint line (14px, `--color-text-muted`, centered):
   context (a) «Наведите камеру на QR-код приглашения» / "Point the camera at
   the invite QR"; context (b) «Наведите камеру на QR-код на карточке
   участника» / "Point the camera at the QR on an attendee's badge".
3. **Bottom row** (above safe-area): the **manual fallback link** — context
   (a): «Ввести код вручную» / "Enter code manually" → closes the overlay and
   focuses the digit cells on `/`; context (b): «Найти в списке» / "Find in
   the list" → closes the overlay (the radar/People lists are the manual
   path). One tap away from every scanner state (ruling 6).

**Permission & capability states (state machine).**

| State | Trigger | Rendering |
| --- | --- | --- |
| Unasked (idle) | overlay just opened | Panel (no camera yet): pixel scan glyph, copy «Для сканирования нужен доступ к камере.» / "The camera needs your permission to scan.", primary CTA «Включить камеру» / "Turn on camera", manual fallback link. The stream starts ONLY on this tap. |
| Requesting | CTA tapped, `getUserMedia` pending | CTA spinner; nothing else changes |
| Granted | permission allowed | Viewfinder + detection loop |
| Denied | permission error `NotAllowedError` (or stored denial) | Copy «Доступ к камере запрещён. Разрешите его в настройках браузера — или введите код вручную.» / "Camera access is denied. Allow it in the browser settings — or enter the code manually." + manual fallback. No retry of the permission prompt (browsers block it); a «Попробовать снова» / "Try again" button re-runs `getUserMedia` for users who just changed the setting. |
| No camera / insecure | `NotFoundError`/`OverconstrainedError`, `!navigator.mediaDevices`, or non-HTTPS origin | Copy «Камера недоступна на этом устройстве.» / "No camera available on this device." (append «Откройте сайт по HTTPS, чтобы включить камеру.» / "Open the site over HTTPS to enable the camera." when the origin is insecure) + manual fallback |

**Detection loop (granted state).**
- Detector: `new BarcodeDetector({ formats: ['qr_code'] })` when
  `'BarcodeDetector' in window` and the format is supported; otherwise
  **lazy-load the JS fallback `jsQR` (~14 kB gzip, dynamically imported once
  per session)** and decode from a downscaled canvas frame. Never load the
  decoder before the overlay opens (§2.7).
- Frames are pulled via `requestVideoFrameCallback` (rAF fallback), decode
  attempts throttled to ~4/s; the loop stops on result, close, or unmount.
- On a successful decode: **stop all stream tracks immediately** (camera
  light off), show a 120 ms flash state (frame brackets brighten), then
  process the payload per context.

**Processing — context (a), invite QR (`?code=`).**
The scanner closes and hands the 6-digit `code` to the `/` join flow exactly
as manual entry (§3.1 step 1): cells filled, `GET /h/rooms/{code}` resolution,
room preview. If the scanned code fails resolution (404/400/NetworkError), the
existing §3.1 inline error states apply — the scanner does not reopen.

**Processing — context (b), persona QR — v2 server-mediated routine.**
Run in the overlay, on a result panel (viewfinder stopped). Prechecks
(client-side UX only, no request):

1. **Own QR**: `u === identity.userAddress` → info state, no request:
   pixel glyph + «Это ваш собственный QR — покажите его кому-нибудь другому.»
   / "That's your own QR — show it to someone else." + buttons
   «Сканировать снова» / "Scan again" and close.
2. **Foreign persona**: `u` is not in the current room's member list
   (checked against the member data passed by the hosting page; on `/` the
   overlay fetches `listRoomUsers` once for this check) → error state, no
   request: «Эта персона из другого события.» / "This persona is from another
   event." + scan again / close.
3. **Known persona** (`u` in the member list — regardless of any existing
   handshake or chat with them; **there is no already-mutual precheck**):
   resolve `name`/avatar from the member list, show the confirm card in the
   result panel: avatar + name + copy «Отправить взаимные хендшейки и
   запустить агентов?» / "Send mutual handshakes and start the agents?" +
   CTA «Обменяться рукопожатиями» / "Trade handshakes" (accent) + «Отмена» /
   "Cancel". Confirm → one call: `POST /api/handshake/mutual` with the
   scanner's persona Bearer and body `{ user_address: u, mutual_code: m }`.
   For a `?u=` deep link **without** `m`, the single-direction variant
   applies instead: the standard confirm card → `POST /api/handshake`
   `{ from: me, to: u, status: 1 }` with my Bearer — idempotent per pair,
   no mutual code involved, 403 → the §2.9 income-rule state.
4. **Success** (mutual 200/201): refresh `listChatsOfUser` once (gated
   read), locate the chat whose participants include `u`; success state
   with a pixel glyph of two avatars: «Агенты уже общаются» / "Your agents
   are already talking" + primary CTA «Открыть диалог» / "Open dialog" →
   `/chats/{chat.address}` (if the chat is not yet in the refreshed list —
   eventual consistency — the CTA links to `/chats` instead; never a dead
   link). For an **already-mutual** pair the backend burns the code and
   returns success without creating a second chat — the same success state
   renders (the link points at the existing dialog).
5. **410 — stale code:** the scanned badge's one-time code was already
   used. Result state: RU «Код уже использован — попросите обновить QR на
   карточке.» / "Code already used — ask them to refresh their badge QR."
   (Concept §6.4 copy, binding) + «Сканировать снова» / "Scan again" +
   manual fallback. **No "Retry" control for the same code** — it is dead;
   the copy never implies that a request reached the other persona.
6. **403 — income rule:** the caller's outgoing direction violates the
   room's income>outcome rule. The code is **not** consumed on a rule
   rejection (bleak-node §7.3.4). Result state: the §2.9 income-rule copy —
   RU «Лимит исходящих хендшейков — сначала получите рукопожатия в ответ.» /
   "Outgoing handshake limit reached — receive handshakes first." (+ server
   text muted when present) + «Сканировать снова» / "Scan again" + manual
   fallback. The copy must not imply the scanned badge was burned — it
   wasn't.
7. **Failure (network / other API):** `NetworkError` → inline error «Нет
   связи. Проверьте Wi-Fi.» / "Connection lost. Check the Wi-Fi." +
   «Повторить» / "Retry" (re-sends `u` + `m`; a failed attempt never burned
   the code — only successful server verification does — so retry is safe).
   Other `ApiError` → server text + «Повторить». **401 → the §2.8 global
   gate** (the scanner's own credential is invalid). 404 (unknown user) →
   error state with the server text + scan again. No duplicate-handshake
   error may ever fire for an existing pair — 200 is success (§3.2 AC 7).

**States summary (result panel).** success / own-QR info / foreign-persona
error / **stale-code 410** / **income-rule 403** / network error with retry /
api error with retry / confirm card / processing spinner (during the mutual
call) / invalid-QR error. After any terminal state, «Сканировать снова» /
"Scan again" restarts the camera (back to Granted — permission persists
in-session).

**Responsive.** Full-viewport on phones (the primary case). ≥ 720px: the
video area is capped at 640px height, centered; the scan frame stays 240px.

**Accessibility.** `role="dialog"`, `aria-modal="true"`,
`aria-label` «Сканер QR-кодов» / "QR scanner"; focus trapped inside, moved to
the overlay title on open, returned to the invoking button on close; Escape
closes (stopping the camera). State changes (permission, result) announce via
`aria-live="polite"`. The video element is `aria-hidden`; the scan frame is
decorative (`aria-hidden`). Touch targets ≥ 48px.

**Implementation notes for workers.**
- Camera requires a **secure context (HTTPS, or localhost in dev)** — treat a
  missing `navigator.mediaDevices` as the no-camera state, not a crash
  (§2.7 footnote).
- One `BarcodeDetector`/decoder instance per overlay lifetime; `jsQR` import
  is `import('jsqr')`-style dynamic and cached.
- The overlay must stop its loop and tracks on host-route teardown (e.g.
  navigating away while scanning) — register cleanup on both overlay close
  and route unmount.
- The v1 module `lib/scanner/mutualHandshake.ts` (two-POST routine) is
  **replaced** by the server-mediated routine (pure, unit-tested; e.g.
  `lib/scanner/mutual.ts`) that takes `{ myAddress, memberList, api }` and
  returns a state machine: own-QR / foreign / confirm →
  `createMutualHandshake(token, { user_address, mutual_code })` → resolve
  the created/existing chat from a refreshed gated `listChatsOfUser` →
  success CTA target (`/chats/{address}` or `/chats` fallback), with
  **410 / 403 / NetworkError / 404 / 401 branches** per the states above.
  The component only renders states and calls the module. The deep-link
  machine on `/` (§3.1 AC 19) reuses the same module.
- The `uqr`/`jsQR` pair: `uqr` (encode, `/profile` badge) and `jsQR` (decode,
  scanner) are the only QR dependencies allowed; the helper's server-side PNG
  QR is untouched.

**Acceptance criteria.**
1. The scanner opens from `/` ("Or scan a QR code", context *a*) and from the
   `/room` top-bar icon-button (context *b*); it is the same `QrScanner`
   component with context-appropriate hint, fallback link, and result
   handling.
2. On first open (permission unasked) the camera is NOT started; it starts
   only after the «Включить камеру» / "Turn on camera" tap.
3. Granted state shows the live viewfinder with the accent corner-bracket
   scan frame and the context hint; a detected QR flashes the frame, stops
   the camera stream, and shows the result within one second.
4. Denied permission shows the specified copy with a "Try again" action and
   the manual fallback; no request is sent and the camera stays off.
5. No-camera / insecure-origin (no `navigator.mediaDevices`) shows the
   no-camera state with the HTTPS note and the manual fallback — the page
   behind the overlay is unaffected.
6. The manual fallback is reachable from every scanner state: context (a)
   closes the scanner and focuses the digit cells; context (b) closes the
   scanner.
7. Scanning an invite QR in context (a) closes the scanner and proceeds
   through invite resolution exactly like manual entry (§3.1).
8. Scanning a persona QR (`u` + `m`) shows the confirm card with the scanned
   person's avatar and name; confirming sends a single
   `POST /api/handshake/mutual` (my persona Bearer; body = scanned
   `user_address` + `mutual_code`) and ends in the success state «Агенты уже
   общаются» with a working "Open dialog" link to the created chat (or to
   `/chats` if the chat is not yet listed).
9. An already-mutual pair reaches the same success state — no client precheck
   skips the call; the backend burns the code and returns success with no
   second chat created.
10. A 410 answer renders the stale-code state «Код уже использован —
    попросите обновить QR на карточке.» with "Scan again" and the manual
    fallback — and no "Retry" control for the dead code.
11. A 403 answer renders the §2.9 income-rule state; the copy does not imply
    the scanned badge's code was consumed, and the "Scan again" path works.
12. Scanning my own persona QR shows the own-QR info state and sends no
    request; scanning an address that is not in the room's member list shows
    the foreign-persona state and sends no request; scanning a QR with
    neither `?code=` nor `?u=` on our origin shows an invalid-QR error state.
13. A network failure during the mutual call shows the retry error state;
    "Retry" re-sends `u` + `m` safely (a failed attempt never burned the
    code) and reaches success when the network recovers; a 401 during the
    call triggers the §2.8 global gate.
14. The `?u=` deep-link variants on `/` with an identity run the same
    routines: `?u=…&m=…` the full mutual confirm routine; `?u=` alone the
    single-direction confirm card ending in one `POST /api/handshake` (my
    Bearer) whose 403 renders the income-rule state; without an identity
    both are ignored (§3.1 AC 19).
15. Closing the overlay (X, Escape, fallback, or navigation) stops the
    detection loop and all camera tracks — the camera indicator light turns
    off; focus returns to the invoking button.
16. The overlay is a focus-trapped `role="dialog"` with `aria-modal`, Escape
    to close, and all state changes (including the 410/403 states)
    announced via `aria-live="polite"`.
17. The scanner adds no cost when unused: no QR-related module (decoder or
    encoder) is fetched until the overlay or the badge needs it.

---

### 3.9 Acceptance-criteria coverage (rev. 3, for the TZ pass)

| Section | ACs | Δ vs rev. 2 | New/changed subject |
| --- | --- | --- | --- |
| §3.1 Join | 19 | +5 | 401 notice card (AC 2), invite-code rejection (AC 9), vault import — list/re-dead/empty (ACs 11–14), `?u&m` / `?u=` deep links (AC 19) |
| §3.2 Room | 15 | +1 | income-rule state (AC 15); ACs 5/14 now credentialed / server-mediated |
| §3.3 People | 13 | +1 | income-rule state (AC 13) |
| §3.4 Chats | 8 | 0 | reads now credentialed (AC 1 wording) |
| §3.5 Transcript | 15 | +2 | viewer fallback (AC 14), global-gate behavior (AC 15); no-composer AC 13 unchanged and re-asserted |
| §3.6 Profile | 15 | +2 | live QR rotation (AC 14), token rotation (AC 15); QR payload ACs 11–12 rewritten |
| §3.7 Host | 16 | +4 | creation-token gate (1–3), invite management (7–8), room-token drill-down + rotation (10, 13), host reset (14) |
| §3.8 Scanner | 17 | +3 | single mutual call (8), already-mutual behavior (9), 410/403 states (10–11), `?u=`/`?u&m` deep links (14) |
| **Total** | **118** | **+18** | rev. 2 ended at 100 |

Every AC above is written to be independently checkable by a tester; the TZ
pass maps each to exactly one implementation task (foundation tasks carry
only their own technical criteria, as in rev. 2).

---

## 4. Visual system

### 4.1 Design tokens

Single source: `apps/web/src/lib/styles/tokens.css` + `base.css` (§2.4 maps
roles). The design adds **no new color values**; any tint is an alpha variant
of an existing token (e.g. `color-mix` or `rgb(from … / 40%)`). Additional
semantic tokens may be *derived* in tokens.css only if a worker needs a name
for an alpha variant (naming convention `--color-accent-dim` etc.) — values
must remain the approved palette.

### 4.2 Component inventory

| Component | Used on | Notes |
| --- | --- | --- |
| `TabBar` | all tab pages (exists) | pixel glyph icons to replace placeholders; badge dot on Chats |
| `PixelAvatar` | everywhere | §4.3 |
| `Radar` (rings + nodes + Me chip) | `/room` | SVG layer + absolutely-positioned buttons |
| `HandshakeSheet` | `/room`, `/people` | bottom sheet; single source of handshake actions; adds the §2.9 income-rule (403) inline state |
| `PersonCard` | `/people` | state pill + inline actions + expandable incoming state + income-rule (403) inline state |
| `ChatCard` | `/chats` | counterpart + `phase`/`scenario` chips |
| `MessageBubble` | `/chats/[address]` | pixel-cornered, mine/theirs variants |
| `ConfirmDialog` | kickoff, leave room, delete room | focus trap, Escape closes |
| `ContactStub` | `/chats/[address]` | disabled coming-later row |
| `Chip` | interests, `phase`/`scenario`, filters, status pills | variants: outline-muted / outline-accent / fill-accent |
| `SegmentedControl` | locale, filters | pill track on `--color-surface-elevated` |
| `DigitInput` | `/` | six-cell code entry |
| `QrScanner` | `/` (context a), `/room` (context b) | camera scanner overlay, §3.8; no route |
| `QrBlock` | `/host` | invite QR `<img>` from the helper + frame |
| `QrCodeBadge` | `/profile` | live client-side SVG persona QR (`uqr`; `u` + one-time `m`), light frame, rotation micro-animation, §3.6 |
| `NoticeCard` | `/` | global 401 gate notice (§2.8), consumed from sessionStorage |
| `TokenGateCard` | `/host` | one-time creation-token gate (masked, never stored) |
| `InviteManager` / `InviteRow` | `/host` | active invite-code rows + mint expiry chooser (presets + custom) + revoke, room-token authority |
| `VaultList` / `VaultRow` | `/` | device token-vault import picker (Concept §6.2); dead-entry error state |
| `CopyButton` / `CopyField` | `/`, `/host` | clipboard + transient «Скопировано» / "Copied" |
| `SkeletonBlock`, `ErrorBanner`, `EmptyState` | all | §2.1 patterns |
| `StatTile` | `/profile`, `/host` | Handjet numeral + caption |

### 4.3 Pixel-avatar generation rules (reference `icons-personage.png`)

All personas render as **chunky pixel portraits** in the reference style:
head on a solid-color backdrop, dot eyes, variants of hair, glasses, facial
hair. Rules:

- **Grid**: 12×12 logical pixels; rendered as SVG `<rect>`s in a
  `PixelAvatar` component (`viewBox="0 0 12 12"`, `shape-rendering="crispEdges"`,
  scales cleanly to 24/32/44/56/96px).
- **Determinism**: the user's `address` string seeds a 32-bit FNV-1a hash;
  successive 4-bit slices pick each trait. Same address ⇒ same portrait
  everywhere in the app, across sessions, no storage.
- **Trait slots**: skin tone (4 charcoal-safe warm neutrals), hairstyle (8
  variants per the reference: quiff, afro, long, bob, bun, gray mop, short,
  buzz), hair color (5), facial hair (none / mustache / beard / gray beard),
  glasses (none / round / square), backdrop (5 desaturated charcoal-family
  tones).
- **Accent exception**: the *own persona's* avatar backdrop is
  `--color-accent` (the "active element" exception — it marks *me* in radar,
  badge, and headers). Everyone else gets charcoal-family backdrops. This is
  the only place accent appears as a fill behind non-interactive content.
- **Assets**: trait parts are individual SVG part files under
  `apps/web/src/lib/assets/avatars/` (referenced by path — architecture §8.3);
  the component composes backdrop + head + hair + face + glasses layers.
- **Fallback**: an unparseable address renders the fixed "pixel ghost" default
  portrait.

### 4.4 Iconography

Pixel-art glyphs, one conceptual language with the avatars: 16×16 grids,
single color (currentColor), 2px visual weight. Required set v1: back (arrow),
close (×), search, plus, dialog-lines, lock, copy, radar-dot, star (host),
edit (pencil), refresh, **scan (viewfinder brackets)**. Stored as inline SVG
components under
`lib/components/icons/` (they use `currentColor` to inherit token colors —
this is not a "hardcoded hex" violation). The TabBar's five tab glyphs are
part of this set.

### 4.5 Dithered/stepped-corner usage rules

The `.pixel-corners` clip-path (base.css) is the signature detail. Rules:

- Applied to: cards (badge, person/chat cards, join/host cards), the tab bar
  top edge, bottom sheets, dialogs, message bubbles, the Me chip, QR frame,
  skeleton blocks.
- **Not** applied to: pill-shaped elements (CTAs, chips, segmented controls,
  filter pills), the radar rings, avatars.
- Step size stays at the base.css 4px/8px ladder; never restyle per component.
- Elements with visible borders simulate the border with a second, slightly
  larger clipped layer (border-color = `--color-surface-elevated`) — keep one
  shared utility for this, not per-component hacks.

### 4.6 Motion rules

| What | How | Duration |
| --- | --- | --- |
| Ambient radar ring rotation | CSS `transform: rotate` linear infinite | 90 s |
| Node/sheet/card entrance | `opacity` + `scale(0.6→1)` or `translateY` | 160–200 ms ease-out |
| State morph (handshake sent, pill swaps) | background/color transition | 120 ms |
| Skeleton pulse | opacity 0.4↔0.8 | 1.2 s |
| Live dot pulse | opacity + scale | 1.6 s |
| Bottom sheet | translateY 100%→0 | 200 ms ease-out; dismissal 150 ms |

Everything is transform/opacity only; `prefers-reduced-motion: reduce` removes
the ambient rotation, pulse, and entrance animations (state changes become
instant). No scroll-triggered or layout-triggered animation anywhere.

### 4.7 RU/EN key copy table (both dictionaries required)

| Key (suggested) | RU | EN |
| --- | --- | --- |
| `nav.room / people / chats / profile / host` | Рядом / Люди / Диалоги / Профиль / Хост | Around / People / Chats / Profile / Host |
| `join.title` | Войти на событие | Join the event |
| `join.enter` | Войти в комнату | Enter the room |
| `join.error.unknown` | Код не найден — уточните его у организатора. | Code not found — check with the host. |
| `join.scan.open` | Или отсканировать QR-код | Or scan a QR code |
| `scan.title` | Сканировать QR | Scan QR code |
| `scan.close` | Закрыть сканер | Close scanner |
| `scan.hint.join` | Наведите камеру на QR-код приглашения | Point the camera at the invite QR |
| `scan.hint.person` | Наведите камеру на QR-код на карточке участника | Point the camera at the QR on an attendee's badge |
| `scan.permission.intro` | Для сканирования нужен доступ к камере. | The camera needs your permission to scan. |
| `scan.turn_on` | Включить камеру | Turn on camera |
| `scan.permission.denied` | Доступ к камере запрещён. Разрешите его в настройках браузера — или введите код вручную. | Camera access is denied. Allow it in the browser settings — or enter the code manually. |
| `scan.try_again` | Попробовать снова | Try again |
| `scan.no_camera` | Камера недоступна на этом устройстве. | No camera available on this device. |
| `scan.insecure` | Откройте сайт по HTTPS, чтобы включить камеру. | Open the site over HTTPS to enable the camera. |
| `scan.fallback.enter_code` | Ввести код вручную | Enter code manually |
| `scan.fallback.find_list` | Найти в списке | Find in the list |
| `scan.again` | Сканировать снова | Scan again |
| `scan.invalid_qr` | Это не QR-код bleak-web. | This is not a bleak-web QR code. |
| `scan.own_qr` | Это ваш собственный QR — покажите его кому-нибудь другому. | That's your own QR — show it to someone else. |
| `scan.foreign_persona` | Эта персона из другого события. | This persona is from another event. |
| `scan.confirm.title` | Отправить взаимные хендшейки и запустить агентов? | Send mutual handshakes and start the agents? |
| `scan.confirm.cta` | Обменяться рукопожатиями | Trade handshakes |
| `scan.confirm.cancel` | Отмена | Cancel |
| `scan.error.network` | Нет связи. Проверьте Wi-Fi. | Connection lost. Check the Wi-Fi. |
| `room.around` | {n} вокруг вас | {n} around you |
| `room.scan.open` | Сканировать QR персоны | Scan a persona QR |
| `room.empty` | Пока никого. Попросите код приглашения у хоста — или сами поделитесь им. | Nobody here yet. Ask the host for the invite code — or share yours. |
| `hs.send` | Отправить хендшейк | Send handshake |
| `hs.sent` | Хендшейк отправлен | Handshake sent |
| `hs.waiting` | Хендшейк отправлен — ждём ответа | Handshake sent — waiting for theirs |
| `hs.back` | Ответить хендшейком | Handshake back |
| `hs.added_you` | Добавил вас | Added you |
| `hs.chatting` | Общаемся | Chatting |
| `hs.agents_talking` | Агенты уже общаются | Your agents are already talking |
| `hs.open_dialog` | Открыть диалог | Open dialog |
| `people.empty` | Комната пока пуста. | The room is empty so far. |
| `people.search.placeholder` | Поиск по имени или био… | Search by name or bio… |
| `people.filter.all/sent/added/chatting` | Все / Отправлены / Добавили вас / Общаемся | All / Sent / Added you / Chatting |
| `chats.empty` | Диалогов пока нет. Взаимный хендшейк запускает разговор агентов. | No dialogs yet. A mutual handshake starts the agents' conversation. |
| `chats.find_people` | Найти людей | Find people |
| `chat.warming_up` | Агенты готовятся… | The agents are warming up… |
| `chat.kickoff` | Запустить диалог заново | Restart the dialog |
| `chat.kickoff.confirm_body` | История диалога будет очищена, и агенты начнут сначала. Первым говорит отправитель самого раннего хендшейка. | The dialog history will be cleared and the agents will start over. The sender of the earliest handshake speaks first. |
| `chat.kickoff.speaker` | Первым говорит {name} | {name} speaks first |
| `chat.contact_stub` | Поделиться контактом — скоро | Share contact — coming later |
| `chat.not_found` | Диалог не найден — возможно, он был удалён. | Dialog not found — it may have been deleted. |
| `profile.greeting.rule` | Приветствие открывает каждый новый диалог. Без вопросов — только утверждения. | The greeting opens every new dialog. No questions — statements only. |
| `profile.greeting.no_questions` | Уберите вопросительные знаки — приветствие не может содержать вопросов. | Remove the question marks — the greeting must not contain questions. |
| `profile.private_bio.caption` | видно только вашему агенту | only your agent sees this |
| `profile.qr.caption` | Покажите, чтобы обменяться рукопожатиями | Show this to trade handshakes |
| `profile.leave` | Выйти из комнаты | Leave the room |
| `host.gate.label` | Токен создания комнаты | Room creation token |
| `host.gate.note` | Одноразовый токен выдаёт оператор развертывания. После создания комнаты он больше не нужен и не сохраняется. | A one-time token issued by the deployment operator. After the room is created it is never needed again and is not stored. |
| `host.token.rejected` | Токен отклонён. | Token rejected. |
| `host.create` | Создать комнату | Create room |
| `host.session_reset` | Доступ к комнате отозван — войдите заново с токеном создания. | Room access was revoked — sign in again with a creation token. |
| `host.invites.title` | Коды приглашения | Invite codes |
| `host.invites.hint` | Код действует до истечения срока; отозвать можно в любой момент. | A code works until it expires; you can revoke it any time. |
| `host.invites.mint` | Выпустить код | Mint a code |
| `host.invites.preset.1h` | 1 час | 1 hour |
| `host.invites.preset.24h` | 24 часа | 24 hours |
| `host.invites.preset.7d` | 7 дней | 7 days |
| `host.invites.preset.custom` | Своё время… | Custom… |
| `host.invites.expires_in` | истекает через {time} | expires in {time} |
| `host.invites.revoke` | Отозвать | Revoke |
| `host.invites.revoked` | Код отозван. | Code revoked. |
| `host.rotate_room.row` | Сгенерировать ключ комнаты | Regenerate room token |
| `host.rotate_room.title` | Сгенерировать ключ комнаты? | Regenerate the room credential? |
| `host.rotate_room.body` | Текущий ключ комнаты перестанет действовать. Продолжить? | The current room credential will stop working. Continue? |
| `host.drill.clear` | Очистить историю | Clear history |
| `host.drill.clear_confirm` | История диалога участников будет очищена. | The participants' dialog history will be cleared. |
| `host.drill.empty` | У участника пока нет диалогов. | This member has no dialogs yet. |
| `host.empty_live` | Пока никто не присоединился. | Nobody has joined yet. |
| `auth.401.notice` | У этой персоны нет действительного ключа доступа — присоединитесь заново по коду события. | This persona has no valid access credential — join again with the event code. |
| `join.error.invite` | Код приглашения недействителен или истёк. | The invite code is invalid or expired. |
| `join.import.title` | Импортировать с этого устройства | Import from this device |
| `join.import.subtitle` | Персоны, созданные на этом телефоне. | Personas created on this phone. |
| `join.import.empty` | На этом устройстве пока нет сохранённых персон. | No saved personas on this device yet. |
| `join.import.saved_at` | Сохранено {date} · комната {room} | Saved {date} · room {room} |
| `join.import.dead` | Эта персона больше не существует на сервере. Запись останется в списке, но импорт невозможен. | This persona no longer exists on the server. The entry stays listed, but it cannot be imported. |
| `hs.income_limit` | Лимит исходящих хендшейков — сначала получите рукопожатия в ответ. | Outgoing handshake limit reached — receive handshakes first. |
| `scan.code_used` | Код уже использован — попросите обновить QR на карточке. | Code already used — ask them to refresh their badge QR. |
| `profile.qr.onetime` | QR одноразовый — после обмена он обновится сам. | The QR is one-time — it refreshes itself after a handshake. |
| `profile.qr.refreshed` | QR обновлён | QR refreshed |
| `profile.qr.aria` | Ваш одноразовый QR для обмена рукопожатиями | Your one-time handshake QR |
| `profile.rotate.row` | Сгенерировать новый ключ доступа | Regenerate access token |
| `profile.rotate.title` | Сгенерировать новый ключ доступа? | Regenerate the access token? |
| `profile.rotate.body` | Текущий ключ перестанет действовать: другие устройства с этим ключом потеряют доступ к персоне. | The current credential will stop working: other devices holding it will lose access to this persona. |
| `profile.rotate.cta` | Сгенерировать | Regenerate |
| `profile.rotate.done` | Ключ обновлён | Credential updated |
| `chat.host_view` | Наблюдение хоста | Host view |
| `common.error.network` | Нет связи. Проверьте Wi-Fi — мы продолжаем попытки. | Connection lost. Check the Wi-Fi — we keep retrying. |
| `common.retry` | Повторить | Retry |

(Existing scaffold keys in `ru.ts`/`en.ts` are kept where they match; workers
extend both files.)

---

### 4.8 v2.1 UI-polish amendments (2026-11-17, owner-approved Concept §7)

These owner change requests amend the rules above for this round:

1. **Functional color-coding accents (amends §4.1 "no new color values").**
   The palette gains four bright, hash-derived accent hues for chat-bubble
   and personage-art coding, defined in `tokens.css`:
   `--color-code-yellow` (#fedc5c, = `--color-accent`), `--color-code-orange`
   (#ffa24a), `--color-code-blue` (#63a8ff), `--color-code-violet` (#b58cff).
   Assignment: `fnv1a(address) % 4` → yellow/orange/blue/violet, deterministic
   per participant. Bubble backgrounds are dark tints:
   `--color-bubble-{yellow,orange,blue,violet}` =
   `color-mix(in srgb, <hue> 18%, var(--color-surface))` (derived tokens only).
   **AA pairs:** bubble text stays `--color-text` (#f0f0f0) — verified ≥4.5:1
   against each tinted background; avatar-art hues are decorative (no text
   on them). Charcoal base and general yellow-accent discipline are
   unchanged outside chat bubbles + avatar art.
2. **Avatar padding (amends §4.3):** the generated user icon gets 1px of
   padding in its backdrop color on all sides — the art never touches the
   card/surface edge, at every rendered size.
3. **Radar (amends §3.2):** other users' icons carry no name labels (only
   the "you" chip keeps a name); the minimum distance between the "you"
   chip and the nearest user icon is increased; nodes rotate together with
   the rings (no counter-rotation); nodes never overlap — collision-avoided
   placement keeps a distinct hit area per user; verified at phone widths.
4. **Profile settings block (amends §3.6):** token regeneration, UI language
   switching and exit-room are grouped into a visible settings block;
   exit-room is rendered in red (`--color-danger` **#c53030** — amended
   2026-11-17, v2.1 round: the originally drafted #e05252 measures only
   ≈3.3:1 with `--color-text`; the delivered #c53030 measures **4.80:1**,
   AA ≥4.5 verified numerically in the danger-contrast test) behind a
   confirmation question (existing `ConfirmDialog`).
5. **Import persona row (amends §4.7 copy):** the device-vault row drops the
   room-address segment (`join.import.saved_at` no longer renders
   `{room}`) — it overflowed the card contour.

### 4.9 v2.2 UI-polish amendments (2026-11-18, owner-approved Concept §8)

Owner change requests refining v2.1 output (all frontend-only):

1. **Radar upright riding (amends §4.8.3c):** icons travel with the rings
   but never spin on their own axis — orbit position rotates, icon
   orientation stays upright (icon content counter-rotates inside the
   orbit layer).
2. **Per-ring speeds:** each ring rotates at a distinct speed per the
   owner's example — ring 1 faster, ring 2 slightly slower, ring 3 very
   fast (implemented as one rotating orbit layer per ring).
3. **Settings route:** the settings block moves from the profile page to a
   new `/profile/settings` route; the leave-room button renders as
   **red font + red border only** (no filled background). Contrast roles
   (architect consult, 2026-11-18): border keeps `--color-danger` #c53030
   (3.43:1 — WCAG 1.4.11 non-text ≥3:1 ✓); the font role uses the new
   `--color-danger-text` **#e05252** (4.92:1 on `--color-surface` — AA
   ≥4.5 ✓; the §4.8.4 originally drafted red, whose white-contrast weakness
   only mattered in the filled-button era).
4. **Avatar change button:** the circular control on the persona/avatar
   change field becomes rounded (reduced radius, not a full circle).
5. **Profile stats — exactly 3:** Sent (renamed from Handshakes),
   Added you, Chatting (renamed from Dialogs); other metrics removed.
6. **Private-bio heading:** the "only your agent sees this" caption is
   styled distinctly from the private content below it.
7. **Chat colors:** chats-list cards get bright §7.1.2 color-coding
   backgrounds; in the dialog the interlocutor's bubbles keep the bright
   background, own bubbles revert to the previous muted styling.
8. **Dialog times:** message timestamps as hh:mm; a locale-formatted date
   label (e.g. "8 September" / "8 сентября") sits centered at the top of
   the chat.
9. **Kickoff removed from the dialog view:** the "Restart the dialog"
   button (and its confirm) leave the attendee dialog; host drill-down
   kickoff unaffected.
10. **Dialog header:** phase/scenario (theme) chips removed; the
    interlocutor's public info (public bio) is shown instead.
11. **Radar "added you" marker:** the yellow ring around such icons is
    replaced by a small yellow dot at the icon's top-right corner.
12. **Ring-level transitions:** icon movement between ring levels animates
    smoothly (CSS transition on the orbit position).

### 4.10 v2.3 addendum amendments (2026-11-18, owner-approved Concept §9)

Six refinements to the v2.2 output; these supersede the parts of §4.8/§4.9
they touch:

1. **Radar geometry (amends §3.2/§4.8.3):** the ring diameter equals
   **max(screen-width, screen-height)** — the radar spans the larger
   viewport dimension (stage element sized to the larger dimension,
   centered; overflow beyond the viewport is expected; placement
   guarantees stay relative to the stage).
2. **Settings entry (amends §4.9.3):** the profile page gets a settings
   button in its **top-right corner** leading to `/profile/settings`
   (in addition to the existing affordance).
3. **Private-bio heading (amends §4.9.6):** position/order as delivered in
   v2.2 stays; typeface reverts to the **previous (Inter) font**; color =
   **muted red** (red with some opacity — derived from
   `--color-danger-text` via alpha/color-mix, tokens only).
4. **Interests spacing:** margin added between the "Interests" title and
   the interest items.
5. **Deepa palette — canonical chat color-coding (supersedes §4.8.1's
   four-hue set for chat/avatar coding per §9.1.5/§9.1.6):** tokens
   `--color-deepa-1..5`: #00B57F (green), #E8E000 (yellow), #FF5000
   (orange), #9B0CFF (violet), #0DECFF (cyan). Chats-list cards and
   interlocutor bubbles get **full-opacity** Deepa backgrounds (no more
   18% tints for these roles); own messages stay muted. Assignment becomes
   `fnv1a(address) % 5`. Per-hue ink pairings (tokens
   `--color-deepa-ink-1..5`) keep text AA ≥4.5 on every hue — dark ink on
   green/yellow/orange/cyan, light ink on violet; pairing values verified
   numerically in the contrast tests.
6. **Avatar generation (amends §4.8.2/§4.9):** personage art uses the
   Deepa palette (art tokens derived from the five hues); the icon's
   background is **darker than the personage image** (dark derivative of
   its hue, e.g. color-mix over `--color-surface`); the 1px
   background-colored padding (§7.1.3) stays.

### 4.11 v2.4 addendum amendments (2026-11-18, owner-approved Concept §10)

Eight refinements; two are **escalated (see below)**, six delivered in this
round:

1. **Import = "return to event" (amends §6.2 import semantics):** the
   import screen lists saved vault personas; selecting one **enters that
   room directly using the stored token** (identity restore, no
   re-creation), the persona is marked **"Return / Вернуться"**; the
   copy-persona-into-new-room flow is superseded and its UI removed;
   §6.2 vault storage stays.
2. **Radar center gap smaller (amends §4.8.3b/§4.10.1):** the minimum
   distance between the "you" chip and the nearest ring is reduced;
   the no-overlap rule stays.
3. **Private-bio heading (refines §9.1.1/§4.10.3):** smaller than the
   content below, sentence case (no uppercase), stays Inter + muted red.
4. **No profile edit button:** the user-info edit button leaves the
   profile page; all persona editing lives in `/profile/settings`.
5. **Chat color tied to user id (refines §4.10.5):** the Deepa hue is
   derived deterministically from the interlocutor's user id (already the
   `fnv1a(address) % 5` rule — pinned by test as the user-id contract).
6. **Chat item content — ESCALATED:** last-message preview + time need
   chat data the bleak-node `model.Chat` contract does not carry
   (no last-message fields; `phase` is a free theme string, not a
   lifecycle state). Pending owner decision (backend fields vs degraded
   frontend approximation). The deliverable part — removing the
   theme/scenario text from list items — proceeds.
7. **Chat item status icon — ESCALATED:** active/finished states are not
   exposed by the API contract (same gap as item 6). Pending the same
   owner decision.
8. **Host out of the footer:** the Host entry leaves the bottom
   navigation; the `/host` route stays reachable by URL; a new entry path
   will be designed later.

### 4.12 v2.5 addendum amendments (2026-11-18, owner-approved Concept §11)

1. **Leave ≠ delete (bug fix, amends the exit flow; §4.11.1 return
   depends on it):** the attendee exit never deletes the persona on the
   server (no hard or soft delete — the `deleteRoomUser` call leaves the
   exit flow). Leaving is purely local: clear the active identity +
   one-time mutual code; the persona token **stays in `bleak.tokenVault`**
   so return-to-event (§10.1.1) always works. The backend DELETE persona
   endpoint remains for explicit deletion elsewhere (host drill-down).
   The leave confirmation copy no longer implies deletion.
2. **Chat list — no background colors (amends §4.10.5/§4.11.5–7 for the
   LIST role):** chat list items return to the neutral surface (like the
   rest of the app); color-coding lives on the item's avatar/personage in
   the Deepa palette, the same way /people colors avatars. Dialog message
   bubbles KEEP their Deepa colors. The right-side status marks render as
   reminders in the chat's message color (the interlocutor's Deepa hue),
   and the loading icon is animated (rotating).
3. **Copy sweep (i18n values only):** drop "Edit" from edit-screen titles
   ("Edit persona/greeting/interests" → "Persona/Greeting/Interests");
   rename "persona" → "profile" (EN) and "персона" → "профиль" (RU)
   throughout the UI copy; the settings-block title becomes
   **"My profile" / «Мой профиль»**.
4. **Join form layout:** the 6-digit code input stays inside the card
   bounds at all widths (overflow fix).

### 4.12.1 v2.6 addendum amendments (2026-11-18, owner-approved Concept §12)

5. **Phone full-screen forms (refines §4.12.4):** on phone-sized viewports
   (**< 720px** — the design system's existing breakpoint; desktop
   `min-width: 720px` layouts unchanged) the following render as
   **full-screen forms** — the form fills the viewport with no floating
   card chrome competing for width, and all content stays in bounds:
   enter-code (join form incl. the 6-digit input), import profile,
   return-to-event, and the profile page.
6. **§11.1.4 reopened as a bug round:** the previous overflow fix did not
   hold at phone sizes — the join input must be verified to stay inside
   the form at **320 / 360 / 390px** widths with behavior tests (not a
   one-off style tweak), routed as `bug/5c1c6036-join-input-overflow`
   (the hash of the worker that owns the §11.1.4 fix).

### 4.13 v3 reconciliation amendments (2026-11-19, owner-approved Concept §13)

bleak-node #34/#35 client integration. New API surface (swagger-verified):
interests upsert/delete (persona Bearer; POST body `{interests:[{title
1..64, group≥0, key≥0}]}` 1..50 rows → 201 full list; DELETE body
`{keys:[...]}` 1..50 → 200 remaining; **no GET exists**); `Chat.done`
boolean (farewell stamps, kickoff resets); `POST /api/match` (+`time` ms,
mutual → 100) and `POST /api/match/v2` (no time, tanh, strictly (0,100))
→ `MatchResult{points, exact_interest_matches, shared_groups, handshake,
mutual_handshake}`; `POST /api/hard-match` (caller passes itself as
`first_user_address` + its Bearer; order-agnostic, once per pair, repeat
returns the stored Summary → 200/201) → `Summary{score (0,100),
checkpoints[5]{key,label,closed}, description, user_a/b, chat, room}`;
`POST /api/contact` (`{content ≤255, from, to}` + from-persona Bearer →
201 `Contact`, repeat 409); `GET /api/contact/{address}` (recipient-only,
newest first).

1. **Interests (R1):** a curated static catalog (group → key → title +
   emoji) ships client-side; the picker lives in profile/settings;
   writes go through the real upsert/delete endpoints (1..50 rows,
   idempotent delete); the badge displays the interests from a
   **client-side write-through mirror** (the API has no interests GET —
   documented limitation: mirror is per-device, seeded/updated from the
   endpoint responses). The §1 mock model is retired.
2. **Chat.done (R2):** `done` is the authoritative finished signal —
   chat-list status (finished → red reminder mark; active → animated
   loading), dialog UI states, and the contact-share gate. The
   §10.1.7 default-active fallback is retired.
3. **Share contact (R3):** a swipe-right slide control in the dialog
   footer (and inside the summary sheet), enabled only when `done`;
   `POST /api/contact` with content composed from a new **local
   contact-card field** in profile/settings (e.g. "telegram: @handle" —
   client-local, no backend user field); 409 → "already shared" state.
   Minimal received view: a small "shared contacts" list in
   profile/settings fed by `GET /api/contact/{me}` (the flagged open
   point resolved minimally).
4. **Chats sorting (R4):** finished chats first, sorted by their
   match/v2 score descending (client fetches `POST /api/match/v2` per
   finished pair, itself as first_user_address; only finished pairs are
   fetched); unfinished after, newest first. Unfinished items render
   darker with opacity plus an animated circular loader (standard
   spinning circle).
5. **Summary sheet (R5):** opening a finished chat triggers the
   once-only hard-match and opens a sheet modal: donut diagram with the
   score, the 5 networking checkpoints (closed/open), score > 80 →
   fireworks + brightness effect; round corners; X close top-right; the
   share-contact slide inside; background = the interlocutor's Deepa hue
   with the existing ink pairing for readable contrast.
6. **Radar tuning (R6):** center-to-nearest-ring gap closer still,
   user icons a little smaller, ring rotation slower overall — per-ring
   speed differences (§8.1.2) and all no-overlap/upright/on-canvas
   guarantees remain.

### 4.14 v3.1 addendum amendments (2026-11-19, owner-approved Concept §14)

Queued after the v3 wave; item 5 is a live bug in the shipped sheet.

1. **Share-slide polish:** the slide track/knob becomes **candy-cane
   style** (animated red-white striped bar around/behind the circle);
   on swipe completion a **confetti animation plays from the top**.
2. **Contacts footer page:** a new bottom-nav **"Contacts" tab** lists
   the contacts shared with the user (recipient GET, newest first) — the
   primary surface, superseding §4.13.3's minimal settings-side list
   (that list moves or stays at the process's discretion); the tab icon
   carries a **dot when new/unseen contacts arrive**.
3. **Creation-form contact input:** the join flow gains a contact field;
   the value is stored **only in localStorage** (the client contact card)
   until actually shared — nothing is sent at creation.
4. **Sheet polish:** the summary sheet's width matches the dialog
   content width (aligned with the message borders); the score displays
   as a **ceil integer**; checklist items render as **square checkboxes
   with green check signs**.
5. **Sheet i18n bug (bug round):** the sheet shows hardcoded Russian
   strings ("итоги встречи", "сетевой чек лист") in the EN interface —
   all sheet copy routes through the i18n table (EN in EN, RU when RU is
   chosen); the RU/EN parity test covers the sheet.

### 4.15 v3.2 arcade-sheet design (2026-11-20, owner-approved Concept §15; tier re-cut per the owner revision recorded in Concept §15.3)

The owner gave two **binding component specs** (§15.1 ShareContactSlide, §15.3
the summary-sheet redesign) plus placement changes (§15.2). This section maps
them to the implementable design. Supersessions declared here: the dialog
**footer** share slide (§4.13.3, Concept §13.1.3) is **removed** — the slide
lives only in the sheet; the sheet's **background** = the interlocutor's Deepa
hue (§4.13.5) is replaced by the locked purple (owner flag §15.4); the
**>80 fireworks-only rule** (§4.13.5, Concept §13.1.5) is replaced by the
three-tier system, and §15.3's drafted **70/40 cutoffs are re-cut to
80/50** by the owner revision (2026-11-20, recorded in Concept §15.3) —
GREAT ≥80, GOOD 50–79, LOW <50. The §4.14.4 sheet width contract, ceil score
display, and square-check checklist are **kept** (restated below where they
bind the new layout).

API surface (swagger-verified, `/mount/bleak-node/docs/swagger.json`): **no
new endpoints** — the round is presentational. The sheet still consumes
`POST /api/hard-match` (once per pair; a repeat open returns the stored
Summary, 200/201) and the slide consumes `POST /api/contact`
(`{content ≤255, from, to}` + from-persona Bearer → 201 `Contact`; repeat
→ 409 "already shared"). The chat-page button only re-opens the sheet over
the page's existing once-only hardMatch flow.

#### 4.15.A ShareContactSlide v2 (Concept §15.1)

The component is rebuilt to the owner's iOS-style "Slide to Answer" spec.
The **state machine and props semantics stay as shipped** (parent-driven
`disabled` / `pending` / `shared`, `oncomplete` fired once per completed
gesture, accessible click/Enter/Space activation on the thumb) — the redesign
changes geometry, surfaces, the trail, and the completion rule.

**Geometry (base variant).** Pill track: **height 76px**, full border-radius
(`--radius-pill`), aspect ratio **~3.8:1** → width `min(100% of container,
288px)`, centered in its slot. Thumb: **circular, 68px diameter** with **4px
internal padding** (invariant: `thumb = trackHeight − 8px`; the sheet variant
reuses the same invariant at its own height). Drag range `maxDx = innerWidth
− thumbWidth`.

**Track surface (base variant).** Dark translucent **glassmorphism**:
`background: color-mix(in srgb, var(--color-bg) 45%, transparent)` +
`backdrop-filter: blur(12px)` (with the `-webkit-` prefixed twin), 1px border
`color-mix(in srgb, var(--color-text) 18%, transparent)` (color-mix over
existing tokens only — no new raw hex, §4.1 rule). Centered placeholder text
("slide to answer" hint, 14px Inter, `--color-text-muted`) with a **shimmer
sheen**: a pseudo-element gradient stripe sweeping across the text via
transform-only keyframes (2.4s loop), and the text **fades out as the thumb
moves**: inline `opacity = 1 − progress` (progress = `dx / maxDx`), gone
before the thumb reaches the end.

**Thumb (base variant).** Crisp white circle (`--color-text` — reads as white
on the dark glass) carrying a **green phone icon**: a new `phone` PixelIcon
glyph (16×16 rect data per §4.4, colored `var(--color-check-green)`). The
sheet variant draws the existing `arrow-right` glyph instead (see variant
API below).

**Candy-cane trail.** A fill bar **from the track's inner edge up to the
thumb's near edge** (thumb's left edge → `width = 4px + dx`), full inner
height, clipped by the pill's `overflow: hidden`. Two layers: an outer
**clip layer** whose width is bound to the drag progress, and an inner
**stripe layer** that runs the continuous marquee so the pattern scrolls
even while the clip edge moves.

- Stripes: `repeating-linear-gradient(45deg, A 0 12px, B 12px 24px)` —
  **wider** than the §4.14.1 band (12px vs 10px stripes) and **brighter**
  (full opacity; the old band sat at 0.5). Base colors: **A =
  `var(--color-danger-text)` (#e05252), B = `var(--color-text)`** — the
  classic red-white candy cane, token-driven.
- **Seamless marquee math (v3.1 `candy-move` technique, re-derived for the
  wider period):** the stripe period along the gradient axis is 24px, so a
  horizontal loop shift of `period ÷ sin45° = 24 / 0.70711 ≈ 33.941px`
  tiles the pattern exactly. Keyframes `translateX(0 → −33.941px)`,
  `1.1s linear infinite`, transform-only (§4.6). The same technique carries
  the sheet variant at its own period (below); if the marching direction
  reads wrong in review, flip the shift's sign — geometry unchanged.
- The trail renders only in the armed state during/after a drag; the shared
  and disabled states keep the plain track.

**Completion rule — 85% snap vs spring-back (differs from the shipped
always-snap).** `snapPoint = 0.85 × maxDx`. On release: `dx ≥ snapPoint` →
**complete**: the thumb animates to the end (`dx = maxDx`, transition
160ms ease-out) and `oncomplete` fires immediately (the parent starts the
request; the shared state swaps the track to its terminal look — same
celebration gating as shipped). `dx < snapPoint` → **spring back**:
`dx = 0`, transition 240ms `cubic-bezier(0.34, 1.56, 0.64, 1)` (light
overshoot, transform-only). Dragging all the way to `maxDx` mid-gesture
still completes at once (as shipped). Keyboard/click activation completes
directly — it is the documented accessible equivalent of the gesture and is
NOT subject to the 85% rule.

**Drag inputs.** The shipped pointer-events approach already covers **both
touch and mouse**: one `pointerdown/move/up` path with
`setPointerCapture` + `touch-action: none` — confirmed, keep as is.

**Confetti (base variant).** The v3.1 flake system is **reused unchanged**
(12 deterministic flakes from the slide's top, Deepa hues, transform/opacity
keyframes, celebration gated on "gesture made here + shared landed" so 201
and 409 celebrate and a re-mount replays nothing). The **sheet-level**
completion burst is an extension of the same system — specified in
§4.15.C "Completion sequence".

**Variant API — decision: a `variant` prop, not parent-passed colors.**
`variant: 'base' | 'sheet'` (default `base`) maps to a scope class that
swaps the component's **internal** custom properties. The component defines
its colors only through internal tokens — `--slide-track-bg`,
`--slide-track-border`, `--slide-thumb`, `--slide-thumb-ink`,
`--slide-stripe-a/b/c`, `--slide-hint-ink`, `--slide-hint-font`,
`--slide-height` — with base defaults as above; the sheet scope overrides
them (§4.15.C-E). Parents may not pass raw colors: the locked sheet palette
(§15.3 "do not remap") stays honest and the component remains the single
source of slide visuals. The thumb glyph follows the variant (base →
`phone`, sheet → `arrow-right`). The base variant is **currently
unmounted** (the footer instance is removed, §4.15.B) but ships and is
tested as the component default per §15.1.

States rendered per the existing machine: `shared` → thumb locks right,
trail hidden, hint = `sharedLabel`; `disabled` → thumb inert at rest at
35% opacity, `disabledHint` centered (no glass shimmer motion); `pending`
→ thumb inert at 60% opacity; armed → the full v2 look.

#### 4.15.B Placement & chat-page changes (Concept §15.2)

1. **Footer slide removed (supersedes §4.13.3).** The transcript page's
   dialog-footer `ShareContactSlide` instance and its copy keys' footer-only
   usage go away; the slide lives **only inside the summary sheet**. The
   page keeps: the finished indicator, the hardMatch auto-open flow
   (finished chat → once-only `POST /api/hard-match` → sheet), and the
   share request/error plumbing — now surfaced exclusively through the
   sheet.
2. **Summarization button on the chat page.** In the dialog footer's place:
   a full-width secondary button —
   - `done` (authoritative `Chat.done` per §4.13.2) → **enabled**; pressed →
     opens the summary sheet (re-opens over a stored Summary without a new
     hard-match call — the once-per-pair rule stays; if no Summary is held,
     it runs the page's existing once-only flow first).
   - `!done` → **disabled**, showing the "dialog in progress" phrase
     (copy keys in §4.15.E). No loader on the button itself — the sheet owns
     the loading row.
   - Placement: same footer slot the slide occupied (below the transcript
     scroll, above the tab bar), the page's standard inset width; 48px
     touch target, `--radius-pill`, transparent surface + 1px
     `--color-text-disabled-strong` border when disabled, accent-soft
     treatment when enabled (the slide's yellow accent discipline holds —
     the button is interactive/active).
3. **Sheet slide ratio.** The sheet's slide is the **sheet variant at
   3.5:1–4:1** — geometry under §4.15.C-E (the §15.3 "height 64px" and the
   §15.2 ratio band are reconciled by a clamp; the interplay is flagged in
   §4.15.G).

#### 4.15.C Arcade sheet system (Concept §15.3)

**C-1. Palette scoping — the sheet does NOT remap app tokens.** The app
palette (Concept §4) is unchanged; the sheet's locked colors live in a
scope block on the sheet root (`.arcade-sheet`):

| Scoped token | Value | Use |
| --- | --- | --- |
| `--sheet-bg` | `#8A12FF` | sheet background (**locked**, owner §15.3) |
| `--sheet-charcoal` | `#18181B` | slide track fill |
| `--sheet-yellow` | `#FACC15` | slide border/stripes/thumb, X close, tier labels |
| `--sheet-white` | `#FFFFFF` | ring, text ink, avatar frames, dotted line |
| `--sheet-orange` | `#FF8A00` | trail stripe accent, sparkle accents |
| `--sheet-green` | `var(--color-check-green)` | checkmarks, phone icon (reuses the approved Deepa green — no new hex) |
| `--sheet-ink` | `var(--sheet-white)` | default text ink on purple (#FFF on #8A12FF ≈ 5.9:1, AA ✓) |
| `--sheet-font-pixel` | `'Press Start 2P', 'Handjet Variable', 'Handjet', monospace` | pixel typography (decision below) |

Contrast notes: `--sheet-yellow` on `#8A12FF` ≈ 3.8:1 (≥3:1 non-text ✓ —
the slide's 2px border and icons qualify); `#18181B` on `--sheet-yellow`
≈ 11.3:1 (thumb icon ink ✓). Components inside the sheet consume ONLY
`--sheet-*` (plus shared structural tokens — spacing, radii, touch target,
`--color-scrim` for the dark backdrop scrim, which stays as shipped). The
`.deepa-N` hue classes on the sheet are **removed** (background supersession
above; §15.4 keeps the owner's option to restore the hue).

**C-2. Container & entrance.** Same modal pattern as shipped
(HandshakeSheet dialog discipline: scrim, Escape + focus + tab-trap, X
close; fixed bottom sheet; §4.14.4 width contract kept — sheet width
matches the dialog content column, `max-width: 640px` from 720px up).
Surface: `--sheet-bg`, top corners `24px` (`var(--radius-lg)` top-only:
`border-radius: var(--radius-lg) var(--radius-lg) 0 0`). Entrance: the
200ms linear slide-up is **superseded** by a retro **spring-bounce** rise —
keyframes `arcade-rise`: `0% translateY(100%) → 62% translateY(-12px) →
82% translateY(4px) → 100% 0`, 460ms `cubic-bezier(0.22, 1, 0.36, 1)`
(transform-only; scrim keeps its 200ms fade). **Cascade:** the sheet's
sections (top bar → score stage → description → checklist → slide) each
run `cascade-in` (opacity 0→1, translateY 10px→0, 240ms ease-out) with
delay `120ms + i×50ms` — the ~50ms stagger per §15.3.

**C-3. Typography — decision: Press Start 2P for BOTH locales.** The
flagged caveat is resolved by verification, not by locale splitting:
**Press Start 2P officially ships Cyrillic** — the upstream Google Fonts
metadata (`ofl/pressstart2p/METADATA.pb`, checked 2026-11-20) lists
`subsets: "cyrillic"` and `"cyrillic-ext"`. Therefore:

- The sheet's pixel face is `--sheet-font-pixel: 'Press Start 2P',
  'Handjet Variable', 'Handjet', monospace` for EN **and** RU — one face,
  true RU/EN glyph parity, no per-locale mapping table.
- **Loading mechanism (the checked constraint):** the app loads fonts via
  npm **Fontsource** packages imported once in `routes/+layout.svelte`
  (`@fontsource-variable/handjet`, `@fontsource-variable/inter`) with
  `unicode-range` subsetting — no raw font files, no network CSS. Press
  Start 2P lands the same way: `@fontsource/press-start-2p` (static,
  single 400 weight) imported for its `latin` + `cyrillic`(+`cyrillic-ext`)
  subset CSS files. **Justification for the new font asset:** one extra
  static package in the existing mechanism; only the latin/cyrillic subset
  bytes of the used glyphs load; it is consumed only by the sheet scope;
  zero runtime JS. The alternatives were rejected on parity/asset grounds:
  per-locale mapping (EN=PS2P / RU=Handjet) breaks glyph-style parity and
  doubles the QA matrix against the mandatory RU/EN parity test;
  Handjet-for-both avoids the dependency but loses the authentic 8-bit look
  the owner explicitly asked for. **Silkscreen stays rejected** (Latin-only,
  confirmed). Fallback safety: Handjet sits second in the stack, so a
  missing PS2P glyph degrades to the approved Cyrillic pixel face, never to
  a serif.
- Sizes (PS2P runs large): pixel labels/tier labels **10px**, score number
  **28px**, all with `letter-spacing: 0`; sheet body copy (description,
  checklist labels, names, slide hint base sizing) stays **Inter**
  (`var(--font-body)`). The sheet-variant slide hint is the pixel face at
  10px (12px from 720px up).

**C-4. Top bar.** Left: the pixel label **MEETING SUMMARY** — the i18n'd
`chat.summary.title` rendered uppercase in `--sheet-font-pixel` 10px,
`--sheet-white`. Right: the **pixel X close** — the existing `PixelIcon
close` 16px on a 48px hit target (`--touch-target`), `--sheet-yellow`
glyph, press state = **pixel scale-down**: `transform: scale(0.88)` over
90ms, no opacity fade; `:focus-visible` ring in `--sheet-yellow`.

**C-5. Dual avatars + score ring (centerpiece).** Stage: a centered row —
**me avatar (56×56) — ring (≈160×160) — them avatar (56×56)**, gap
`--space-5`, names under each frame in Inter 12px semibold
(`--sheet-white`).

- **Avatars:** the app's `PixelAvatar` **is** the 8-bit pixel art (12×12
  chunky grid, §4.3) — the owner's "8-bit pixel-art avatars" are satisfied
  by **framing, not new sprites**: each avatar renders inside a **square
  56×56 frame** — `border: 2px solid var(--sheet-white)`,
  `border-radius: 0` (square pixel-art frame, unlike the rounded frames
  elsewhere), `PixelAvatar size=52` inside the border, SVG
  `shape-rendering: crispEdges` preserved (PixelAvatar is vector pixel
  art, so no raster scaling occurs; the spec still pins
  `image-rendering: pixelated` on the frame for any raster fallback). No
  new avatar assets are drawn.
- **Ring:** SVG viewBox 160×160, `r = 66`, **thick white arc**
  (`stroke-width: 12`, `--sheet-white`, `stroke-linecap: butt` — square
  caps for the pixel aesthetic; `crispEdges` on the SVG). Track circle at
  25% white (`color-mix(in srgb, var(--sheet-white) 25%, transparent)`).
  Fill **clockwise from 0 to the score** on open, starting at 12 o'clock
  (`rotate(-90deg)`): `stroke-dasharray` = full circumference,
  `stroke-dashoffset` animated `c → c × (1 − score/100)` over **900ms
  ease-out** — this follows the shipped donut precedent (§4.13.5 already
  animates SVG stroke geometry; everything else in the sheet stays
  transform/opacity per §4.6). The arc math reuses `donutScoreDash` /
  a radius parameter (lib/chats/summary.ts stays the pure-geometry home).
- **Score tally count-up:** the displayed number (ceil integer per
  §4.14.4) counts up **0 → ceil(score) in a JS rAF loop, 700ms, cubic
  ease-out, integer steps**, rendered in `--sheet-font-pixel` 28px —
  picked over a CSS-only approximation because text content cannot be
  keyframed and a stepping `counter` hack would not hit the exact final
  value. Dependency-light: a native rAF, one-shot per open, no libraries;
  a pure helper (frame→value function) lives in lib/chats/summary.ts so
  the easing is unit-testable. Under reduced-motion the count-up jumps
  straight to the final value (explicit guard — the rAF path checks the
  media query, since the base.css catch-all only intercepts CSS).

**C-6. Score tiers (owner revision 2026-11-20: 80/50 — supersedes §15.3's
drafted 70/40 and §13.1.5's ">80 fireworks").** Tiers evaluate the **raw
Summary score**; the display keeps the ceil (§4.14.4). `isCelebration`
in lib/chats/summary.ts is re-cut to `score >= 80` (was `> 80`) — GREAT is
inclusive of 80 per the revision's "80–100"; the celebration verdict
(`summaryCelebrates`) keys off the same constant.

| Tier | Raw score | Label key (EN / RU) | Avatars | Bridge |
| --- | --- | --- | --- | --- |
| GREAT | **80–100** | `chat.summary.tier.great` — "Great match" / «Отличное совпадение» | move **toward the center** on open (18px inward, 300ms ease-out, 200ms delay), then idle **2-frame bounce loops** | **pixel energy beam + sparkling hearts & stars** |
| GOOD | **50–79** | `chat.summary.tier.good` — "Good chat" / «Хороший разговор» | friendly **nod / wave** in place | **glowing pixel dotted line** |
| LOW | **0–49** | `chat.summary.tier.low` — "Different vibes" / «Разные вибрации» | **stay spaced apart**, neutral idle | **sweat drop / blink** |

The tier label renders under the ring in `--sheet-font-pixel` 10px —
`--sheet-yellow` for GREAT, `--sheet-white` otherwise. Tier labels come
from the i18n table (both dictionaries — §4.15.E).

**C-6a. Animation-system decision: hand-rolled CSS keyframes on positioned
DOM elements (+ SVG for the ring, + the two sanctioned JS one-shots).** One
system for all sheet motion — no canvas layer, no animation library:

- **Why CSS keyframes:** §4.6 already mandates transform/opacity-only CSS
  animation, and the base.css `prefers-reduced-motion` catch-all disables
  exactly CSS animations/transitions globally — a canvas or rAF-driven
  layer would bypass that guarantee and need its own manual guards; CSS
  keyframes are deterministic and SSR/test-render identical (the shipped
  FLAKES/sparks pattern); an animation/pixel lib (GSAP, PixiJS…) would add
  a dependency the delivery strategy and TZ constraints don't carry.
- **The only JS motion allowed:** the score count-up rAF (C-5) and the
  existing gesture logic — both one-shot, both explicitly reduced-motion
  guarded. No continuous JS animation loops.
- **Pixel feel:** two-state animations use `steps(2, jump-none)` timing on
  a 0%→100% two-keyframe pair (exact 2-frame pixel loops); bursts use
  staggered delays; everything is positioned with transforms only.

**C-6b. Tier animations, concretely.**

- **GREAT.** Avatars: per side, `translateX(±18px)` toward center (300ms
  ease-out, delay 200ms), then the idle loop
  `avatar-hop: 0% translateY(0) → 100% translateY(−6px)`,
  `600ms steps(2, jump-none) infinite alternate` — the joyful 2-frame
  bounce. Beam: between the two avatar frames across the ring's center —
  a 4px-high stepped strip
  (`repeating-linear-gradient(90deg, var(--sheet-yellow) 0 8px,
  transparent 8px 16px)`), marching via `translateX(0 → −16px)`,
  800ms `steps(2, jump-none)` infinite, opacity pulsing 0.7↔1.0
  (1.2s ease-in-out). Sparkles: **6 glyph poppers** (PixelIcon `star` ×3,
  `heart` ×3 — `heart` is a **new registry entry** per §4.4, 16×16 rect
  data) absolutely positioned around the bridge, each running a 1.2s loop
  (`scale(0) → scale(1) → scale(0)`, `steps(2)`, opacity 0→1→0) with
  staggered delays (0–500ms), colored `--sheet-yellow` / `--sheet-orange`
  / `--sheet-white`. The §13.1.5 fireworks fold in: the shipped spark
  burst + brightness pulse keep running on this tier, **recolored to the
  sheet scope** (sparks `--sheet-yellow/orange/white` instead of
  `currentColor`; the wash layer uses `--sheet-white` at its existing
  0.22 peak).
- **GOOD.** Nod/wave (once on open, then idle): the "me" avatar dips
  `translateY(0 → 2px → 0)` twice (400ms each, transform-only); the "them"
  avatar rocks `rotate(−6deg ↔ 6deg)` (transform-origin bottom center)
  twice. Dotted line: a 3px-high row of 6×6px square dots
  (`--sheet-white` at 60%) spanning between the frames; its **glow** is a
  static `filter: blur(6px)` duplicate layer whose **opacity pulses**
  0.4↔0.9 over 1.6s (animating opacity of a pre-blurred layer — no filter
  animation, §4.6-safe).
- **LOW.** No avatar motion toward center; the frames stay at rest. A
  **sweat drop** — an 8×10px pixel-drop element in `--sheet-white` beside
  the counterpart's frame — slides down `translateY(0 → 10px)` with
  opacity 1→0 (700ms), twice, then idles on a 4s loop. The **neutral idle
  blink** is a 120ms opacity dip to 0.65 on each avatar frame every 4s.
  (Drop color: white per the locked palette; a cyan `--color-deepa-5`
  variant is flagged as owner-optional — §4.15.G.)

**C-7. Conversation summary & checklist.** `Summary.description` renders
left-aligned in Inter 14px/1.45, `--sheet-ink` (crisp white sans per the
spec). Under the pixel header **NETWORKING CHECKLIST** (`chat.summary.checklist`,
`--sheet-font-pixel` 10px), the 5 checkpoints keep the §4.14.4 shape —
**square box** (16px, `1.5px solid var(--sheet-white)`) + **green check**
(`--sheet-green` → the `--color-check-green` token stays) for closed,
empty muted square for open (0.6 opacity). **Entrance choreography:** each
closed checkpoint pops in **sequentially** — box `scale(0 → 1)` with
`steps(2)` (150ms), a **retro flash** (a `--sheet-white` overlay on the
box flashing 100%→0 opacity over 120ms right after the pop), then the
check glyph appears (60ms later); item i's delay = `400ms + i×140ms` —
the drawn one-by-one cadence. Open checkpoints appear with the cascade
(no pop, no flash). Reduced-motion collapses all of it to the final
instant state (base.css catch-all).

**C-8. Sheet slide embed (§15.3 bottom action).** The v2 component in its
**`variant="sheet"`** scope, overriding the internal tokens:
`--slide-height: clamp(64px, calc(sheet content width ÷ 3.75), 80px)`
(the 64px floor is the §15.3 explicit height; the clamp lands the width in
the §15.2 3.5:1–4:1 band on phone widths — from 720px up the slide is
capped at 320px wide, centered, so the ratio holds); thumb = height − 8px
per the §4.15.A invariant. Colors: track `--sheet-charcoal` with a **2px
`--sheet-yellow` border**; thumb `--sheet-yellow` with the **pulsing pixel
arrow** (`PixelIcon arrow-right`, `#18181B` ink, opacity pulse 1↔0.6 over
1s — "subtly pulsing"); hint text pixel-accented (`--sheet-font-pixel`
10px, `--sheet-white`, uppercase, shimmer sheen retained, fade-on-drag
retained). Trail stripes: **3-color cycle**
`repeating-linear-gradient(45deg, var(--sheet-yellow) 0 12px,
var(--sheet-white) 12px 24px, var(--sheet-orange) 24px 36px)` — period
36px → seamless loop shift `36 / 0.70711 ≈ 50.912px`, marquee 0.9s linear
infinite ("continuously scrolling forward"); brighter/wider per the owner
note (12px segments, full opacity).

**Completion sequence (shared landing, gesture-made only — the existing
celebration gating).** (1) The slide locks: thumb snaps right, hint →
**"Contact shared!"** (new key, §4.15.E); the 409 "already shared" state
keeps its own label. (2) **8-bit square-pixel confetti across the modal** —
an extension of the v3.1 FLAKES system at sheet level: **24 deterministic
flakes** (same no-randomness pattern — SSR/test parity), **8–10px
squares** (`border-radius: 0` — the 8-bit shape change vs the 6×10 rounded
base flakes), colors from `--sheet-yellow / --sheet-white /
--sheet-orange` + the pair's Deepa hues, origins spread across the sheet's
top edge and the slide's center, fall 60–140% of the sheet height,
0.9–1.6s, 0–0.4s stagger, transform/opacity only. (3) **Both avatars do a
celebratory victory jump:** `victory-jump` keyframes (`0% 0 → 30% −10px →
45% 0 → 55% −6px → 65% 0`, 700ms, `steps(2, jump-none)`, played twice),
once per completion gesture — a re-mount with `shared` already true
replays nothing (shipped gating, restated).

**C-9. Accessibility & motion (sheet).** Dialog role/labels/focus/
tab-trap/Escape as shipped; the X and the slide thumb keep 48px targets;
the score ring's `aria-label` keeps the `chat.summary.score.aria` wording
(ceil value); tier is conveyed by the visible tier label (plain text —
no color-only meaning); decorative layers (trail, beam, sparkles, confetti,
flashes) are `aria-hidden`. All sheet animation is transform/opacity (+
the sanctioned SVG stroke geometry), collapses under
`prefers-reduced-motion`, and the two JS one-shots carry explicit
reduced-motion guards. Backdrop-filter has a solid-color fallback
(`color-mix` background without blur still meets contrast).

#### 4.15.D Task-split recommendation (for the implementation wave)

Three tasks (the process opens cards and fills criteria/tests/constraints;
TZ derives formally):

1. **`slide-v2-rebuild`** — ShareContactSlide v2 per §4.15.A: geometry +
   glass + hint fade/shimmer, white thumb + new `phone` PixelIcon registry
   entry, candy trail (clip + marquee layers, the 33.941px loop), **85%
   snap/spring-back rule**, `variant` prop with the internal-token API
   (base defaults shipped + tested even though currently unmounted),
   v3.1 confetti reused unchanged. Depends on: nothing. **Gates** the next
   two (both embed the component).
2. **`arcade-sheet-redesign`** — SummarySheet v2 per §4.15.C: `.arcade-sheet`
   scope tokens (locked hexes), arcade-rise + cascade entrance, the
   Press Start 2P asset (`@fontsource/press-start-2p` + cyrillic subsets,
   `--sheet-font-pixel`), top bar, avatar frames + ring/count-up (incl.
   the pure tally helper), **tier system at 80/50 with the
   `isCelebration ≥ 80` re-cut in lib/chats/summary.ts**, checklist
   choreography, sheet-variant slide embed + completion sequence
   (sheet-level square confetti, victory jumps). Depends on: task 1. If
   the wave needs parallelism it may split into 2a (structure, tokens,
   typography, slide embed) and 2b (tier animations, count-up, completion
   sequence) — single-owner execution is recommended (one visual system,
   one reviewer).
3. **`share-placement-cutover`** — per §4.15.B: remove the transcript
   footer slide instance (supersedes §4.13.3), add the summarization
   button with its enabled/disabled gating and copy, sweep the retired
   keys, extend the RU/EN parity + transcript/sheet test suites.
   Depends on: tasks 1 and 2 (the button opens the redesigned sheet; the
   footer cutover must not land while the sheet still needs the footer's
   shared-state plumbing).

Suggested order: 1 → 2 → 3, with 3's i18n keys landable inside 2 where
the process prefers two cards.

#### 4.15.E RU/EN parity — new copy (both dictionaries required; parity test extended per the §14.1.5 precedent)

| Key | EN | RU |
| --- | --- | --- |
| `chat.summary.open` | Meeting summary | Итоги встречи |
| `chat.summary.open.disabled` | Dialog in progress | Диалог ещё идёт |
| `chat.summary.tier.great` | Great match | Отличное совпадение |
| `chat.summary.tier.good` | Good chat | Хороший разговор |
| `chat.summary.tier.low` | Different vibes | Разные вибрации |
| `chat.contact_share.sheet_label` | Slide to share contact | Смахните, чтобы поделиться |
| `chat.contact_share.shared_done` | Contact shared! | Контакт отправлен! |

Reused unchanged (already in both dictionaries): `chat.summary.title`
(the top-bar MEETING SUMMARY label, uppercased via CSS),
`chat.summary.checklist`, `chat.summary.score.aria`, `chat.summary.loading`,
`common.close`, `common.retry`, the error pair, and the 409 label
`chat.contact_share.shared` ("Contact already shared" / «Контакт уже
отправлен»). `chat.contact_share.label` keeps serving any residual
non-sheet uses but loses its footer usage in the cutover. Every new key is
present in BOTH `en.ts` and `ru.ts` in the same commit; the i18n parity
suite enumerates the sheet's keys.

#### 4.15.F Acceptance criteria (checkable)

**Slide v2 (§4.15.A):**
- [ ] The armed slide renders a 76px-tall pill track (base), full
      border-radius, width ≤288px (≈3.8:1), glass background with
      backdrop blur, centered hint with a shimmering sheen.
- [ ] The hint's opacity decreases linearly with drag progress and is 0
      at full extension.
- [ ] The thumb is a 68px white circle with 4px internal padding and a
      green `phone` pixel glyph (base variant).
- [ ] During a drag, a candy-cane fill bar extends from the track's inner
      edge to the thumb's left edge with 45° alternating stripes
      (12px/12px) whose pattern scrolls continuously and loops seamlessly
      (33.941px shift; no visible seam at the loop point).
- [ ] Releasing the drag below 85% of the range springs the thumb back
      with an overshoot easing; releasing at ≥85% completes: the thumb
      animates to the end and `oncomplete` fires exactly once.
- [ ] Keyboard activation (Tab to the thumb, Enter/Space) and click
      complete directly, regardless of position.
- [ ] Touch and mouse drags both work (pointer capture; no scroll-jank —
      `touch-action: none`).
- [ ] `disabled` / `pending` / `shared` render the existing inert states;
      `shared` shows the shared label and locks the thumb right.
- [ ] The base confetti (12 flakes, Deepa hues, from the top) plays only
      when a completion gesture made in the component is followed by the
      shared state; a re-mount with `shared` true replays nothing.
- [ ] The sheet variant overrides track/stripes/thumb/hint via the
      component's internal tokens only — no color props exist on the API.
- [ ] Reduced motion: the marquee, sheen and transitions collapse to
      instant states (base.css catch-all).

**Placement & chat page (§4.15.B):**
- [ ] No ShareContactSlide renders in the transcript dialog footer.
- [ ] A summarization button sits in the footer slot; with `Chat.done`
      false it is disabled and shows the "dialog in progress" phrase;
      with `done` it opens the summary sheet.
- [ ] Opening the sheet via the button on an already-summarized chat does
      not re-issue `POST /api/hard-match` (once-per-pair holds).

**Arcade sheet (§4.15.C):**
- [ ] The sheet background is exactly `#8A12FF` with 24px top corners and
      a dark scrim; no Deepa-hue background classes remain on it.
- [ ] The sheet's scoped tokens are defined in the `.arcade-sheet` block;
      no `--sheet-*` token is consumed outside the sheet; the app
      `:root` tokens are unchanged by the sheet.
- [ ] The entrance plays the spring-bounce rise; the five sections
      cascade in with ~50ms stagger.
- [ ] Pixel labels/tier labels/score render in Press Start 2P with
      Handjet fallback; the font loads through a Fontsource import
      including the Cyrillic subset; Russian sheet copy renders in the
      pixel face with no missing-glyph fallback to a serif.
- [ ] The top bar shows the i18n'd MEETING SUMMARY label and a pixel X
      with a scale(0.88) press state and 48px target.
- [ ] Both avatars render as 56×56 SQUARE frames (2px white border, no
      border-radius) around PixelAvatar art with crisp pixel edges; no
      new avatar sprites were added.
- [ ] The white ring fills clockwise from 0 to the score over ~900ms; the
      displayed integer counts up over ~700ms and lands exactly on
      ceil(score); both fire once per open.
- [ ] Tier thresholds are 80/50 on the raw score: ≥80 GREAT, 50–79 GOOD,
      <50 LOW; `isCelebration` returns true for score 80 (re-cut from
      >80) and the GREAT tier triggers the recolored sparks + brightness
      pulse.
- [ ] GREAT: avatars move 18px toward center then bounce in 2-frame
      loops; a marching pixel beam plus star/heart poppers bridge the
      ring. GOOD: nod/wave plays once and a glowing dotted line pulses.
      LOW: avatars stay apart; a sweat drop plays and an idle blink runs.
- [ ] The tier label renders under the ring from the i18n table
      (yellow for GREAT, white otherwise).
- [ ] Closed checkpoints pop sequentially (140ms stagger) with a retro
      flash, and their green square-box checkmarks appear one by one;
      open checkpoints render as empty muted squares.
- [ ] The sheet slide renders in the sheet variant: charcoal `#18181B`
      track, 2px `#FACC15` border, yellow thumb with pulsing arrow,
      pixel-accented hint, yellow/white/orange 45° stripes scrolling
      forward (50.912px loop), height 64–80px per the clamp and the
      3.5:1–4:1 band.
- [ ] Completing the sheet slide locks it, swaps the hint to
      "Contact shared!" (409 keeps "already shared"), fires the 24-flake
      square-pixel confetti across the modal, and both avatars do the
      victory jump — all only for a gesture made here, none on re-mount.
- [ ] All sheet copy is RU/EN-parity tested; no hardcoded strings remain
      in the sheet components.

#### 4.15.G Flags for the owner / concept (concept report)

1. **Sheet slide height:** §15.3 says "height 64px" explicitly, §15.2 says
   "bigger" with a 3.5:1–4:1 band. The design reconciles with
   `clamp(64px, width ÷ 3.75, 80px)` (80px on typical phones, 64px floor).
   If the owner meant a literal fixed 64px, drop the clamp — one token.
2. **Trail stripe mix:** "bright yellow #FACC15 and white/orange" is
   interpreted as a 3-color cycle (yellow/white/orange, 12px segments).
   A 2-color yellow/white variant is a one-line change if preferred.
3. **`isCelebration` inclusivity:** the re-cut is `score >= 80` (per
   "80–100 = GREAT"); if the owner meant strictly above 80, it is a
   one-character change.
4. **Ceil-vs-tier edge:** tiers evaluate the raw score, the display is
   ceil (§4.14.4) — a raw 79.6 displays "80" but sits in GOOD (no
   celebration). Accepted as server-truth-first; flagged for awareness.
5. **New pixel glyphs:** `phone` (slide thumb, base variant) and `heart`
   (GREAT sparkles) join the §4.4 PixelIcon registry as 16×16 rect data —
   no new dependency.
6. **Sweat-drop color:** white per the locked palette; `--color-deepa-5`
   cyan is available if the owner wants the classic "sweat" blue.
7. **Press Start 2P Cyrillic** was verified against the upstream font
   metadata (cyrillic + cyrillic-ext subsets) before the both-locales
   decision; a render audit of the RU strings in the new face is part of
   task 2's checklist, with the Handjet fallback as the safety net.
8. **The base slide variant is unmounted** after the footer cutover (kept
   per §15.1 as the component default, with test coverage) — say the word
   if another surface should mount it.

### 4.15.1 v3.3 addendum amendments (2026-11-20, owner-approved Concept §16)

Layout/geometry-only fixes; the locked §4.15 palette is untouched.

1. **ShareContactSlide geometry:** the pill track spans **88–92% of the
   modal's width** (aligned with the checklist/summary text edges),
   **64px** high, full **9999px** pill radius; the candy-cane fill
   **wraps around the circle** — the striped container ends in a matching
   9999px pill cap hugging the thumb's right edge with uniform 4px
   padding (no flat vertical edge); the placeholder stays strictly
   centered in the full track with z-order **fill > text > thumb**
   (stripes cover/clip the text; optional fade past center); the
   completed state nests the thumb in the right end with 4px uniform
   margin.
2. **Sheet layout/scrolling:** the sheet is **88–90% of screen height**,
   bottom-anchored with its top edge just below the chat header; **pinned
   top** (header + X, avatars + name, score ring), **scrollable middle**
   (summary text + checklist only), **pinned bottom** (the slide button
   always visible); the slide button sits at the **same vertical level
   from the screen bottom** as the chat view's Summarization button
   behind the sheet.

### 4.15.2 v3.4 microchange amendments (2026-11-20, owner-approved Concept §17)

1. **Sheet:** the **dotted line between the two users** (the medium-tier
   connector from §4.15.C) is **removed** — the GOOD-tier nod/wave avatar
   animations themselves stay.
2. **Chat list:** the **right-side status marks** (loading icon / reminder
   mark, §4.11.5–7 lineage) are **removed** and replaced by a **color
   dot** in the interlocutor's user-id-derived Deepa hue; the
   **old rotated-dots loading indicator is removed** — the **newer
   loading circle** (the unfinished-dialog spinner, §4.13.4) stays.

### 4.15.3 v3.5 microchange amendments (2026-11-20, owner-approved Concept §18)

1. **GREAT-tier cleanup:** in the summary sheet's GREAT-match layout the
   **dotted line between the two users is removed** (matching the
   GOOD-tier removal, §4.15.2.1) and the **user's name renders stronger
   and centered below its avatar**, matching the GOOD-chat styling.
2. **Finished-dot size:** the chat list's finished-dot grows to the
   **same size as the round loading circle** it replaced.
3. **Summary lazy background loading:** for **finished** chats the
   summary is **lazily fetched in the background** (never blocking the
   open); if the user opens the sheet **while summarization is still in
   progress**, the sheet shows an **animated loading state** until the
   summary arrives.

### 4.15.4 v3.6 microchange amendments (2026-11-20, owner-approved Concept §19)

1. **GOOD-tier avatars stay put:** in the summary sheet's GOOD-chat tier
   the avatars must **not pull toward each other** — they stay spaced
   apart while keeping the nod/wave animation; the GREAT-match tier keeps
   its pull-to-center (verify whether the v3.2 cleanup pass introduced
   the pull in this tier and fix to this rule). **CANCELLED (2026-11-20,
   owner reversal in Concept §19.1): avatars may converge/pull together
   in the sheet animation across ALL tiers — the no-pull restriction and
   its behavior test are dropped; the converging animation is by-spec
   everywhere.** (The related owner additions below stay: name-label
   removal per the §18.1.1 amendment, GREAT-match title, X-close
   visibility.) **SUPERSEDED in part
   (2026-11-20, owner addition in Concept §18.1.1): the user-name labels
   under BOTH avatars are removed entirely (both tiers; avatars alone) —
   the "stronger and centered names" treatment below never ships.**
2. **/people — no filter chips; deterministic sort:** the filter chips
   are removed entirely; the list is simply sorted: (1) who added you
   (incoming handshakes), (2) no handshakes at all, (3) chatting with
   you (mutual/chat exists), (4) you sent a handshake (outgoing pending).
3. **/people item rework:** the right icon (chat-open / handshake-form
   toggle) is removed; for the **first user in the list (who added
   you)** the "handshake back" state **opens automatically**; the copy
   becomes **"handshake!"** (RU **«Привет!»**); the "chatting" badge is
   removed — instead a **button "Open chat"** renders (RU/EN parity).
   **ADDENDUM (2026-11-20, recorded in Concept §19.3): tapping/clicking
   ANY item with the "added you" status opens the Handshake!/Dismiss
   form for that user** (handshake-back send + local dismissal, side by
   side) — the form takes over the removed right icon's toggle role as
   the tap-target behavior for added-you items.
4. **Sheet loading state (refines §4.15.3):** **more loading items** in
   the in-progress view and the **text moves below the loading
   animation, centered** in the modal sheet.

### 4.15.5 owner amendment (2026-11-20, recorded in Concept §15.3 + §15.4)

**Sheet background restored to the interlocutor's Deepa hue** (the
§4.13.5/§4.10 rule: user-id-derived `--color-deepa-<n>` with the per-hue
ink pairing for readable contrast) — **superseding the locked #8A12FF
purple scope** (§4.15.C). Consequences: the sheet-variant slide's
charcoal/yellow palette stays (self-contained contrast); the
sweep-test hex exception tied to the locked block **dissolves** — the
sheet is token-driven again (`--sheet-bg: var(--color-deepa-<n>)` derived
per chat; the ink pairing follows §4.10). All other sheet spec details
(typography, animations, layout, slide) unchanged.

### 4.15.6 owner additions (2026-11-20, recorded in Concept §18.1.1 + §15.3 amendments)

1. **Avatar name labels removed entirely** (both tiers; avatars alone) —
   superseding §4.15.4.1's "stronger and centered" treatment.
2. **GREAT-match tier title:** a **"Great match"** heading in the
   GREAT tier, styled with the **sheet's common text color** (no special
   color), RU **«Отличное совпадение»** via the i18n table (RU/EN
   parity); placement per the sheet layout (near the score ring).
3. **X close visibility on any background:** the sheet's X close button
   takes the **per-hue ink/contrast treatment** (per §4.10 pairings —
   e.g. a scrim chip behind it or the dark-ink color for light hues like
   yellow/cyan), with a hover/press state consistent with the pixel
   press effect; visible on every Deepa hue.
4. **Fade transitions extended (2026-11-20, owner amendment in Concept
   §23.2.5.9):** the fade treatment applies to **EVERY step boundary of
   the whole creation path** — form → intro theme → chat (interview) →
   "creating your profile" loading → app main page — not just between
   the chat steps: one fade treatment used consistently across all
   wizard step boundaries, including into the loading step and from it
   into the app main page.

### 4.15.7 v3.7 addendum (2026-11-20, owner-approved Concept §20)

**Chats list time sort:** chat items are sorted **by time, newest
first** — a single time-based sort **superseding §4.13.4's score-first
ordering** (finished-by-score first). The unfinished-item styling
(opacity + spinner), the finished dot, previews, and the Deepa hue
coding are unaffected. The match/v2 score surface stays for the summary
sheet (hard-match merges it); the chats-list score fetch/cache retires
unless another surface consumes it.

### 4.15.8 v3.8 addendum (2026-11-20, owner-approved Concept §21)

**Chats list common block + thin dividers:** the items share a **common
background block** (one surface container behind the list), split by
**thin divider lines** in the **page background color**
(`--color-bg`, #1A1C20 per §4); each divider is **horizontally
centered** and **≤95% of the chats box width**. Per-item styling
(dot, spinner, preview, hue coding) is unchanged. **Owner edge-case
decision (recorded in Concept §21 amendment): an unfinished chat item
keeps its muted look as DIMMED CONTENT** — name, preview and time at
reduced opacity, the spinner stays, the common block background is
untouched, **no per-item background panel** (the old opacity-on-panel
treatment is re-expressed on the content); finished items render at full
emphasis. **Owner edge-case decision (2026-11-20, recorded in Concept
§27):** the creation chat applies the same rule **structurally** — the
two-region fixed layout (§4.17) with dimmed content on unfinished items
re-expressed in ChatCard; verified in `verification-v312.md`.

### 4.16 v3.9 feature round (2026-11-20, owner-approved Concept §22.3; lean protocol per §22.2)

1. **Bleak mascot on the enter-invite-code form (tz11-01):** a chunky
   pixel-art mascot portrait (same design system §4 register as the
   avatar art) rendered on the code-entry form; lightweight — static or
   2-frame CSS idle animation, no new dependencies; a reusable component
   so the creation wizard can mount it too.
2. **Step-by-step user creation wizard (tz11-02, P1):** the single-form
   persona creation is replaced by a **multi-step chat-style wizard**
   entered after the invite code resolves: (1) intro theme step;
   (2) "enter your name"; (3) **auto-chat interview** — the mascot/agent
   asks in chat bubbles (existing dialog bubble styling incl. Deepa
   coding) with smooth step transitions: **public bio → private bio →
   contact info** (type choice: phone / email / messenger nickname) →
   **interests** (group first, then that group's items, multi-select);
   (4) a **"creating your profile" loading step** while the persona is
   created via the EXISTING API request shape (invite_code + token +
   interests per §13.1.1 — no backend changes). RU/EN parity for all
   copy; the join machines/tests updated to the wizard flow.
   **§23 amendments (2026-11-20, owner design review — Concept §23):**
   wizard: iOS-Messages send button + counter (no send on input taps),
   no "Next" (fixed bottom input, scrollable chat, centered back below
   input), example placeholders per case, nickname field with
   `tg:@/signal:@/inst:@` prefixes, themes model (8 themes × 6 topics,
   `theme:topic_key` titles on the numeric server contract), interests
   creation-only, multi-theme loop to "Ready", arcade-sheet loading
   animation, fade transitions, intro bubble un-plated. Mascot: NO
   background (the pixel figure sits directly on the page), mascot-at-top
   ordering (mascot → title → content) on the enter-code form and the
   room/create-profile-choice form.

### 4.16.1 v3.10 second batch (2026-11-21, owner-approved Concept §24 — all items amend the creation wizard, tz11-02 lineage)

1. **No echo:** the chat never repeats the user's typed text as a message (no live echo bubble; answers snapshot into `sent*` state on forward moves only — the transcript renders snapshots).
2. **Revert arrow replaces "back":** the bottom back button is removed; a **revert arrow sits in the input form, shown when the input is empty**; when typing starts the **send button appears in its place** (arrow ⇄ send swap, identical 48px geometry).
3. **Full chat history:** everything the mascot sends AND the user's answers are kept in the chat — including **theme/interest picks rendered as the user's messages** (a monotonic `reached` cursor: back never rewinds the transcript; per-theme pick rounds render their answered summaries).
4. **Counter position:** the symbol counter is **centered below the button** (below the input row).
5. **Slower fades:** the step fade duration increases (200ms → **400ms** across stage/panel/creating/leaving).
6. **Calm intro:** the mascot intro form is **calm and friendly** — calming the user, preparing them for a simple dialog, giving the necessary context before the interview (agent role + no-rush framing).
7. **Pixel greeting:** "Hi! I'm Bleak" uses the **pixel font** (not the body font).
7b. **Desktop dimensions:** the creation chat has the **same dimensions as the room chats on /chats** (not full-width; `.persona-step` max-width 640px ≥720px).
8. **Clear button:** an **"x" on the right in the input form** quickly clears the input (clears + refocuses).
9. **Strongly fixed input height** above the keyboard/bottom (no height jitter — `height: var(--touch-target)`); **suggestions (e.g. messenger prefixes) sit ABOVE the input**, never below (source-order pinned).
10. **Footer note removed:** "stored on your device. Shared when you slide to share" is gone from the chat (`contact_hint` retired).
11. **Autofocus after send:** after Enter, the input is auto-focused again (effect on every text step).
12. **Latest message pinned:** the last message sits automatically **strictly above the input form + suggestion badges** — auto-scroll keeps it pinned right above the input area (effect reads transcript length + wizard step).
13. **Right back kept on non-standard forms** (theme choosing, contact choosing, etc.); the stage-level intro/creating back links are intentionally kept (room-preview return / navigation).

Reconciliation (owner note): the bottom back button is removed everywhere (item 2); the **right back button stays on non-standard sub-steps** (item 13); the **revert arrow in the input** replaces it on standard steps (item 2).

### 4.17 v3.11 addendum (2026-11-21, owner-approved Concept §25)

**Creation chat desktop layout** — size/proportions only; all visual
styles (colors, dark bg shades, bubble colors, fonts, borders, button
styles) untouched:

1. **Full screen height:** the chat container stretches from the very top
   edge to the very bottom edge of the browser window — no vertical
   centering, no empty space above or below the chat box.
2. **Wider desktop column:** the chat column spans the center of the
   page at roughly **750–850px** wide (supersedes the §4.16.1 7b
   room-chat-dimensions approximation with the explicit target).
3. **Pinned bottom input:** the input bar stays anchored at the bottom
   edge of the screen; the message area above it expands to fill all
   remaining vertical space.
4. Per-item and color styling unchanged — size/layout proportions only.

### 4.17.1 owner refinement (2026-11-21, owner-approved Concept §28)

**Main block never scrolls:** the creation-dialog screen structure is
refined — the **main block** = the space between the **bottom (or
keyboard)** and the **header**; it NEVER scrolls itself (no main/page
scrolling at all). Inside the main block exactly two blocks:
1. **Messenger** (messages area) — the ONLY scrollable element (its own
   internal scroll per §27).
2. **User-input-form block** — answer input, **theme choosing**,
   **contacts form**, and all step-specific form UI — CANNOT scroll,
   fixed at the bottom of the main block.
Header and keyboard area stay fixed; only the messenger block scrolls;
visual styles unchanged (§25 item 4). Implementation: the outer main
block is a fixed-height flex container (header outside it), with the
messenger as `flex:1 min-height:0` (the single scroll-port) and the form
block as `flex:none` pinned at the main block's bottom; step forms (theme
choosing, contacts) live in the form block, so switching steps never
scrolls the main. **Owner refinement follow-up (task 113, landed):** the
main block additionally clips (`overflow-x/y: hidden`) — content that
cannot shrink into the two inner regions is clipped at the main block
instead of growing the shell and handing scrolling back to the page;
the step forms were verified already inside the `.composer` form block
(the task-111 layout held), so the clip is the only code change.
**Owner refinement (task 114, landed, Concept §29):** the whole chain is
**viewport-bounded** — the persona-gated app-shell is height-locked
(`100vh` then `100dvh`, later-supported wins; dvh = the keyboard/
visualViewport handling) only while the creation chat is mounted; a tall
form grows upward content-sized from the bottom edge while the messenger
shrinks (`flex:1 min-height:0`) and scrolls internally; the form block is
never clipped at its bottom (excess cuts at the top via the main-block
clip).

### 4.17.2 owner refinement (2026-11-21, owner-approved Concept §29)

**Viewport-bounded main block:**
1. **Lock outer & main container to the viewport:** the root page
   wrapper and the MAIN BLOCK are strictly bounded by the visible
   browser window height (below the fixed header down to the bottom
   edge of the screen or virtual keyboard). The MAIN BLOCK must never
   grow taller than the visible screen space — a viewport-unit-based
   bounded height (e.g. `100dvh`-derived flex column incl. the
   keyboard/visualViewport handling), never content-driven growth.
2. **Messenger shrinks, form grows upward:** when a TALL user-input-form
   block appears (multi-button choice forms, contact forms), the form
   block sits completely inside the visible bottom area, growing upward
   from the bottom edge; the messenger block above it shrinks in height
   and scrolls internally to fit the remaining space (form block =
   flex:none / content-sized, messenger = flex:1 min-height:0 — the
   form's content sizes the form block, the messenger absorbs the
   remainder).
3. **Never clip the form block:** the form block's bottom edge is flush
   with the visible viewport bottom (or the keyboard top); every button
   and input inside it 100% visible without scrolling the outer page.
4. **Preserve styles:** colors, button designs, spacing, visual styling
   untouched.

### 4.19 v3.13 feature round (2026-11-21, owner-approved Concept §30)

**Unified form UX structure:** the non-chat forms — **"Join the Event"**
(enter-code), **"Room intro"** (create-profile / change-code choice),
and the other join-surface forms — adopt the **same three-block
structure** as the §28/§29 creation dialog:

1. **Header (NOT scrollable):** app icon on the left, language switching
   on the right.
2. **Footer (NOT scrollable):** the form's action buttons.
3. **Middle block (scrollable):** the content — title and text (text
   fills **no more than 75% of the form width**) — plus the form's main
   interactive element (6-digit input / scan-QR link / resume session).

**Viewport constraint (the §29 rule):** the form is strictly
viewport-bounded (never overlays beyond the area between the top of the
screen and the bottom/keyboard), never content-driven in height.
Implementation: a shared form-shell (component or structural pattern)
with header/footer as `flex:none` fixed regions and the middle block as
`flex:1 min-height:0` — the ONLY scrollable region — mirroring the
proven §28/§29 creation-dialog geometry; keyboard handling reuses the
existing visualViewport approach. The header language switch works on
these forms (RU/EN parity). Existing visual styles preserved; the
creation-dialog contracts (§24–§29) remain untouched and green.
**Landed (task 115, worker `29c8a30d`):** the shared shell is the
`FormShell.svelte` component (Svelte 5 snippets: default = middle,
`footer` = the 1..n action region); middle is top-anchored, paragraphs
max-width 75%; the enter-code instantiation carries mascot → title →
6-digit input → scan-QR + return links in the middle and the single
primary "Enter the room" button in the footer; the Room intro exercises
the multi-button footer (create profile + change code); the resume
surface (VaultList) mounts in the shell; the forms' own locale switch
moved into the shell header.
**Landed (task 117, worker `07e82628`):** the landing page at `/`
(pixel mascots, the AI-networking positioning, nav, Start → /income,
the 3-step tutorial: search → chatting → contacts sharing;
mobile-first); `/income` = the entry page (the previous `/` join
surface moved verbatim); `/income/[room]/create` = the wizard (the
same JoinFlow seeded into the persona step, the room context via the
route param); deep links forwarded; the tab bar hidden on all three
pre-room routes. **REJECTED + REBUILT (task 118, Concept §32):** the
owner rejected the §31 landing design ("bad") — rebuilt from zero per
the design example `landing-design-example.png` (repo root): near-black
bg + the project's purple accent/glow; large pixel headline with a
highlighted accent word; pixel-font taglines at the top corners; a
centered hero pixel-art scene (a person meeting an AI agent, glowing
focal element); a retro dialogue-box (framed, asterisk line); framed
pixel-border cards (stat/feature cards + an AI-agent character card
with actions); the bottom icon row = the tutorial (search → chatting →
contacts sharing, 3 steps); badge/footer pixel blocks; varied pixel
figures across the page (no repeated mascot); adaptive (desktop
multi-column as the example, mobile stacks); modern web polish; Start →
/income; RU/EN.

## 5. Design-decision rationale (short)
5. **Auto-scroll root cause (task 107, folded):** the wizard-chat
   "stuck at top" bug was a geometry break — `.join`'s automatic minimum
   size grew with content, so the log's flex/overflow never engaged and
   `scrollTo` was a silent no-op; fixed with the bounded persona-step
   chain (`min-height: 0`, log = scroll container, composer below in
   normal flow) — smooth scroll on open and every new message, bottom
   padding so the newest message clears the composer.

### 4.18 v3.12 owner order (2026-11-21, Concept §26): creation chat = the real main-room chat

**The wizard's hand-rolled (simulated) chat implementation is removed.**
The creation chat **reuses the real chat machinery from the main room**
(`/chats`: message-list rendering, scrolling/autoscroll, input bar,
composer — extracted/shared into a common component if needed) so the
creation dialog inherits the **proven chat behavior (including
autoscroll)** instead of a simulated replica. The wizard becomes a
**driver** over the real chat component: it feeds the mascot's messages,
the user's answers (including theme/interest picks), placeholders/
suggestions, and the step flow into it. The task-107/109 geometry work
(bounded persona-step chain, §25 desktop layout) remains as the
container infrastructure the real chat mounts into. /chats behavior
must stay unchanged (shared-component changes behavior-neutral for the
main room — its contracts stay green). No happy-dom simulation of the
chat geometry; no new dependencies.

### 4.20 v3.14 feature design (2026-11-22, owner-approved Concept §32): §32 landing rebuild from zero

The owner rejected the §31 landing (task 118, "bad") and ordered a rebuild
from zero per their visual example **`landing-design-example.png`** (repo
root) — **the visual source of truth for mood, composition and element
types**; this section adapts it to the project's story (**effective
networking with AI agents**, Concept §31.4) without copying its dating
content. Every color is an existing §4.1 token or an alpha `color-mix`
variant of one; **no new colors, no new dependencies, no canvas, no
animation library** (§4.15.C-6a decision stands). All mascots are original
SVG-rect pixel art per §4.3 — **no background plates, no raster/stock
plates** (Concept §23 / §32 rules). Mobile-first; the desktop composition
matches the example at the app's existing **720px** breakpoint. Supersedes
every §31 landing layout note; the §31 routes (`/`, `/income`,
`/income/[room]/create`) and their contracts stay untouched — **only the
`/` surface rebuilds**.

**API endpoints used: none.** The landing is presentational and nav-only —
zero fetches on `/` (no loading/empty/error data states exist; the only
async is font swap, already `font-display: swap`). Every endpoint the app
has is reached *after* Start, via `/income`, whose contract is §3.1
verbatim. Deep-link forwarding to room routes is unchanged (§3.1's guard
behavior).

#### 4.20.A Canvas, palette & glow

- **Background:** the page (and every landing surface) is the existing
  `--color-bg` (near-black — matches the example's canvas exactly; no new
  value). Content canvas: `max-width: 1000px`, centered, padding
  `--space-5` (<720px) / `--space-7` (≥720px).
- **Glow recipe (the example's purple bloom, token-only):** layered
  `box-shadow`/`filter: drop-shadow(...)` in accent alpha mixes, e.g.
  `0 0 16px color-mix(in srgb, var(--color-accent) 50%, transparent), 0 0
  48px color-mix(in srgb, var(--color-accent) 22%, transparent)`. Used on:
  the headline accent word, the hero focal element, the dialogue-box caret,
  the agent card portrait, and hovered/pressed CTAs. **Never** a new hex;
  derived named variants are allowed in tokens.css only per the §4.1 rule.
- **Frames:** all framed boxes (dialogue box, cards, chat strip, footer
  blocks) use the **shared `.pixel-corners` double-layer technique (§4.5,
  4px/8px ladder)** with one new declared modifier `--frame-strong` that
  sets the simulated-border color to `--color-text` (the example's bright
  frames) instead of `--color-surface-elevated` — one utility, one
  modifier, no per-component hacks. CTAs and chips stay pills (§4.5
  exclusion). Dithered fills are not used on the landing except as
  1-step `color-mix` shading inside SVG art.

#### 4.20.B Header/nav & taglines

Top bar (single row, mobile and desktop; not sticky): left = the top-left
tagline pair, right = the existing **locale switch** (`SegmentedControl`
locale — the established header mechanism, §2.3/§4.19 shell pattern)
working on the landing with no reload, then the Start CTA as a small pill
(mobile) / text link "START" (desktop). Minimal nav: two in-page anchors
after the switch, desktop only: "HOW IT WORKS" → `#tutorial`, "AGENTS" →
`#agents` (Handjet 12px, `--color-text-muted`, hover `--color-accent`).
**Taglines in pixel font (Handjet, uppercase, 12px mobile / 13px desktop,
`letter-spacing: 0.08em`, two stacked lines, leading 1.4):**

- **Top-left (as in the example's LOVE-IS-A-GAME corner):** EN
  "NETWORKING IS A GAME." / "THE AGENT PLAYS IT FOR YOU." — RU «ЗНАКОМСТВА —
  ЭТО ИГРА.» / «АГЕНТ ИГРАЕТ ЗА ВАС.» First word cluster tinted
  `--color-accent`, rest `--color-text`.
- **Top-center (≥720px only, as in the example):** EN "NO SMALL TALK. JUST
  REAL CONNECTIONS." — RU «БЕЗ СМОЛТОЛКА. ТОЛЬКО РЕАЛЬНЫЕ ЗНАКОМСТВА.»
  centered, `--color-accent`, 12px.
- **Top-right (≥720px, with a 24px GLITCH glyph before it, as in the
  example's BUILT-FOR corner):** EN "BUILT FOR PEOPLE." / "RUN BY AGENTS."
  — RU «СДЕЛАНО ДЛЯ ЛЮДЕЙ.» / «РАБОТАЮТ АГЕНТЫ.»

#### 4.20.C Headline block + Start CTA

- **Headline (3 lines, Handjet, uppercase, line-height 1.05):** EN
  "THE RIGHT" / "CONNECTIONS" / **"YOU"** — RU «НУЖНЫЕ» / «ЗНАКОМСТВА» /
  **«ВАС»**. Size scale: mobile 36px → 44px (≥480px) → 64px (≥720px);
  `--color-text`. Lines 1–2 left-aligned (left column on desktop, centered
  on mobile).
- **Accent word treatment (line 3 = the one highlighted word):** rendered
  in `--color-accent` with the §4.20.A double text-shadow glow
  (`0 0 8px`/`0 0 24px` accent mixes) — the example's glowing "AWAITS"
  adapted; plus two 8px pixel-sparkle glyphs (§4.4-family SVG, accent) at
  the word's top-right and bottom-left, twinkling `steps(2)` 1.6s loop.
- **Subheadline:** Inter 14px→16px, `--color-text-muted`, max-width 40ch:
  EN "An event app where AI agents break the ice for you — you arrive at
  every meeting already warmed up." RU «Приложение события, где ИИ-агенты
  заводят разговор за вас — вы приходите к знакомству уже готовым.»
- **Start CTA:** the page's primary action — pill button (§4.5), bg
  `--color-accent`, text `--color-bg`, Handjet 16px uppercase, padding
  12×28px, the §4.20.A glow on hover + `scale(0.98)` on press, `:focus`
  ring per §2.6. Label: EN "START" / RU «НАЧАТЬ». Action → `/income`
  (§4.20.L).

#### 4.20.D Hero pixel-art scene

**Centered scene (mobile 320×320; ≥720px 480×480), original art, the
example's two-figures-under-a-glow composition retold as OUR story — a
person meeting their AI agent:**

- **Construction:** one `<svg viewBox="0 0 64 64">` (scale to the sizes
  above, `shape-rendering="crispEdges"`, §4.3 technique — individual
  `<rect>`s from part files under `lib/assets/avatars/`), transparent
  background, **no background plate**; ground = a mesh of purple pixel
  "network nodes" (small accent-mix squares on 4px stems — the example's
  flower field adapted into a connection mesh), ~40 tiles in 3 accent
  alpha shades.
- **Figures:** **NOVA** (left, back three-quarter view — human attendee,
  warm-neutral palette from the §4.3 skin/charcoal slots, accent-striped
  scarf) and **BYTE** (right — the AI agent: charcoal body, single accent
  visor-eye, 2px antenna) facing each other, ~28 grid-units tall each.
- **Focal element (the glow anchor, the example's heart adapted):** a
  glowing accent **handshake-node diamond** (10×10 grid units) floating
  between/above the two figures with a vertical light beam (accent 12%
  alpha column widening upward); pulses `scale(1→1.08)` + glow-intensity
  1.8s `steps(2, jump-none)` infinite alternate (§4.6 live-dot pattern).
- **Sparkles:** 5 accent 2×2-unit rects absolutely placed, staggered
  2-frame twinkle (0.8–1.6s delays) — transform/opacity only.
- **A11y:** the whole scene `role="img"` + `aria-label` = `landing.hero.aria`
  ("Pixel scene: a person meets their AI agent under a glowing network
  node" / «Пиксельная сцена: человек встречает своего ИИ-агента под
  светящимся узлом сети»); all inner rects `aria-hidden`.

#### 4.20.E Retro dialogue-box (signature element)

- **Construction:** pixel-frame per §4.20.A (`--frame-strong`): 2px
  `--color-text` border, square corners with 4px stepped notches (the
  example's white RPG box — deliberately NOT `.pixel-corners`-rounded),
  bg `--color-surface`, min-height 72px, max-width 480px, padding 16×20px,
  centered under the hero (overlapping its bottom edge by 16px, as in the
  example).
- **Content:** one line, Inter 14px, `--color-text`, starting with an
  asterisk — the cycle (each ≥4s, cross-fade 200ms): EN `* The agent says
  hello…` / `* Your agent already found three matches.` / `* Match
  accepted. Contact exchange in a minute.` — RU `* Агент здоровается…` /
  `* Ваш агент уже нашёл три совпадения.` / `* Совпадение принято. Обмен
  контактами через минуту.`
- **Caret:** a `▼` pixel chevron (accent, 8px) at the box's bottom-center,
  blinking 800ms `steps(2)` infinite — the §4.20.A glow applies.
- **A11y:** the cycling line is decorative (`aria-hidden`); the box also
  carries one full static line in an `sr-only` paragraph so screen readers
  get the content without the cycle spamming `aria-live`.

#### 4.20.F Mascot-chat animation (owner addition, Concept §32)

**Placement:** its own `--frame-strong` pixel-frame strip — mobile:
full-width panel between the dialogue box and the agent card (height
~200px); ≥720px: right column, 280px wide, under the agent card. Header
label inside the strip (Handjet 11px muted, top-left): EN "LIVE AGENT
CHAT" / RU «ЖИВОЙ ЧАТ АГЕНТА».

**The two mascots (48px portraits, 16×16 art scaled, facing each other at
the strip's left/right edges):** **PIP** (human attendee, warm neutrals)
left; **GLITCH** (robo-cat agent — round charcoal head, accent ears, dot
eyes) right. Speech bubbles alternate between them; each bubble is a
pixel-frame box (2px border — `--color-text` for PIP, `--color-accent` for
GLITCH — 3×3px corner notches, stepped 3-rect tail pointing to its
speaker, bg `--color-surface-elevated`, text Inter 12px, max-width 60% of
the strip) that pops in `scale(0.6→1)` 160ms ease-out (§4.6 entrance).

**Exchange sequence (4 turns, alternating):**

| Turn | Speaker | Copy (EN / RU) |
| --- | --- | --- |
| 1 | GLITCH | "Hi! I'm Glitch — Dana's agent." / «Привет! Я Глитч — агент Даши.» |
| 2 | PIP | "Hey. I'm here for the AI track." / «Привет. Я здесь ради трека по ИИ.» |
| 3 | GLITCH | "Then you'll get along. Dana built the demo you starred." / «Тогда вам по пути. Даша собрала демо, которое вы лайкнули.» |
| 4 | PIP | "Send her my contacts!" / «Передайте ей мои контакты!» |

**Timing (typewriter per character):** turn = pop-in 160ms → typewriter
reveal **55ms/char** → hold **900ms** → next turn. Typewriter is a CSS
`steps(var(--chars))` clip-reveal (`clip-path: inset(0 100% 0 0)` →
`inset(0 0 0 0)`, duration `calc(var(--chars) * 55ms)`); each bubble sets
`--chars` inline from its rendered string length at mount — the only JS is
this one-shot mount computation (no continuous JS loop, §4.15.C-6a).
Long-turn cap: turn total clamped at 3.4s (hold shrinks). After turn 4:
all bubbles **fade out 600ms** → 400ms rest → restart;
`animation-iteration-count: infinite`. Loop duration is content-derived
(RU/EN differ) — ACs assert the loop behavior, not an exact ms value.

**Reduced motion:** `prefers-reduced-motion: reduce` → no typewriter, no
loop; all four bubbles render statically visible (per §4.15.C-6a / §4.6).
**A11y:** strip `role="img"` + `aria-label` = `landing.chat.aria`
("Animation: the agent Glitch and the attendee Pip exchange messages" /
«Анимация: агент Глитч и участник Пип обмениваются сообщениями»); full
bubble texts remain in the DOM (clip-reveal, not text injection) so SR
reads them completely.

#### 4.20.G Framed pixel-border cards

Both cards are `--frame-strong` pixel-frames (§4.20.A), bg
`--color-surface`, padding 20px; hover `translateY(-2px)` + frame glow
(§4.20.A recipe), press `scale(0.98)`, 120ms transitions.

**(a) Feature/stat card** (mobile: full-width below the chat strip;
desktop: left column bottom, ~300px — the example's REAL-HEARTS slot).
Left: title Handjet 18px uppercase `--color-text` — EN "REAL PEOPLE. REAL
RESULTS." / RU «РЕАЛЬНЫЕ ЛЮДИ. РЕАЛЬНЫЕ РЕЗУЛЬТАТЫ.»; under it three
lines Inter 13px muted — EN "No empty chats." / "No cold DMs." / "Only
encounters that matter." — RU «Никаких пустых чатов.» / «Никаких холодных
сообщений.» / «Только встречи, которые важны.» Right: **BLOOM** glyph
(56px — pixel flower with a signal-antenna bloom, accent center; original
art per §4.3 rules) with the 1.6s `steps(2)` idle sway.

**(b) Agent character card** (`id="agents"`; mobile: between chat strip
and stat card; desktop: right column top — the example's TORIEL slot).
Contents top→bottom, centered: **VECTOR** portrait (96px, 32×32 art —
agent in a sharp suit, monocle visor, accent tie; original), name Handjet
24px uppercase — EN "VECTOR" / RU «ВЕКТОР»; badge chip (Chip,
`outline-accent`): EN "AGENT · Lv 1" / RU «АГЕНТ · УР 1»; trait line
Handjet 11px muted, middot-separated: EN "SWIFT · SHARP · LOYAL" / RU
«БЫСТРЫЙ · ТОЧНЫЙ · НАДЁЖНЫЙ»; quote Inter 13px `--color-text` in
quotes: EN `"I break the ice. You keep the contact."` / RU «Я начинаю
разговор. Вы сохраняете контакт.»; then the **action row: one primary
pill button** — EN "TALK" / RU «ПОГОВОРИТЬ» (bg `--color-accent`, text
`--color-bg`, hover glow, press scale 0.98) → navigates to `/income` (the
chat Start flow, §4.20.L). The example's second button (PASS) is
**consciously dropped**: the landing has no pass-flow, and a decorative
no-op button would fake a behavior (flagged in §4.20.O).

#### 4.20.H Tutorial = bottom icon row (exactly 3 steps)

Full-width row (`id="tutorial"`), mobile centered 3-up, ≥720px centered
under the 3-column zone with side rules (1px `--color-surface-elevated`
lines). **Exactly three** pixel icons (§4.4 iconography: 16×16 grids,
`currentColor`, 2px weight — inline SVG components) scaled to 32px in 48px
tap targets, with pixel-step connectors between them (two 6px chevrons
`--color-text-muted`), labels Handjet 12px uppercase below:

1. **Search glyph** (existing magnifier) — EN "FIND" / RU «НАЙДИ»
2. **Chat glyph** (existing dialog-lines) — EN "CHAT" / RU «ОБЩАЙСЯ»
3. **Contacts-sharing glyph** (new in the §4.4 set: two overlapping
   squares with an outbound arrow — one added glyph, same construction
   rules, `currentColor`) — EN "SHARE" / RU «ПОДЕЛИСЬ»

Steps read left→right as the §31 tutorial: search → chatting → contacts
sharing. No animation on the row (static, per §4.6 no scroll-triggered
motion); each icon `aria-hidden` + visible label.

#### 4.20.I Badge/footer blocks

Footer region (`<footer>`), two small `--frame-strong` pixel-frame blocks
(padding 12×16px, bg `--color-surface`):

- **Positioning block** (mobile stacked; ≥720px left column bottom): 
  pixel-badge row = 16×16 logo glyph (existing mark) + "bleak-web" Handjet
  14px; under it the positioning line Handjet 12px `--color-text`: EN
  "EVERY CONNECTION MATTERS." / RU «КАЖДЫЙ КОНТАКТ ВАЖЕН.»; under it the
  copyright-style line Inter 11px muted: "bleak-web · 2026" / «bleak-web ·
  2026».
- **CTA badge block** (≥720px right column bottom — the example's
  AVAILABLE-NOW slot): 16px handshake glyph (accent) + label Handjet 12px
  uppercase `--color-accent`: EN "START NOW — 6 DIGITS TO JOIN" / RU
  «СТАРТ СЕЙЧАС — 6 ЦИФР ДЛЯ ВХОДА»; the whole block is a link →
  `/income` (focus ring, hover glow).

#### 4.20.J Mascot cast (owner's variety requirement)

**Six distinct figures; no figure appears twice on the page** (Concept
§32.3). All are §4.3-construction original art (SVG `<rect>`s,
`crispEdges`, dot eyes, chunky pixels, transparent backgrounds, no
background plates):

| Figure | Where | Art spec |
| --- | --- | --- |
| **NOVA** | hero scene, left figure | human attendee, back 3/4 view, warm-neutral skin slot, accent-striped scarf; 64-grid, ~28u tall |
| **BYTE** | hero scene, right figure | AI agent, charcoal body, accent visor-eye, 2px antenna; 64-grid, ~28u |
| **VECTOR** | agent character card portrait | agent in suit + monocle visor, accent tie; 32×32 → 96px |
| **BLOOM** | stat-card glyph | pixel flower with signal-antenna bloom, accent center; 32×32 → 56px |
| **PIP** | mascot-chat strip, left | human attendee mini-portrait; 16×16 → 48px |
| **GLITCH** | mascot-chat strip, right + top-right tagline glyph | robo-cat, accent ears, dot eyes; 16×16 → 48px / 24px |

Tutorial glyphs are §4.4 icons, not mascots. Hero figures and card
portraits each get their own part files under `lib/assets/avatars/`;
nothing reuses another figure's parts.

#### 4.20.K Adaptive layout (mobile-first → desktop at 720px)

- **<720px (single column, stacking order top→bottom):** top bar (left
  tagline pair + switch + Start pill) → headline block (centered, accent
  word) → subheadline → **Start CTA** → hero scene → dialogue box →
  mascot-chat strip → agent character card → stat card → tutorial row →
  footer blocks (stacked). Horizontal padding `--space-5`; every framed
  element full-width.
- **≥720px (the example's 3-column composition, 1000px canvas,
  `grid-template-columns: 26% 1fr 26%`, gap `--space-6`):** **left
  column:** top-left tagline pair, headline block (left-aligned),
  subheadline, Start CTA, stat card (bottom-anchored). **center column
  (widest):** top-center tagline, hero scene (480px), dialogue box
  overlapping its bottom. **right column:** top-right tagline + GLITCH
  glyph, agent character card (`#agents`), mascot-chat strip (280px), CTA
  badge block. **Tutorial row:** full-width (`#tutorial`), bottom of the
  canvas; footer blocks sit at the left/right column bottoms as placed
  above — the example's corners.
- Both layouts keep the same DOM order (source order = mobile order); the
  desktop grid is CSS-only rearrangement. No horizontal scroll at 320px
  width.

#### 4.20.L Behavior, routes & states

- **Start CTA, agent-card TALK, and the CTA badge block all navigate to
  `/income`** (the 6-digit entry, §3.1 moved verbatim) with locale
  preserved (`router.push`, no full reload). Nothing on `/` calls the
  resolve/scan APIs — those live on `/income` as shipped.
- **Routes untouched:** `/income` and `/income/[room]/create` behavior,
  contracts and suites are out of scope; only the `/` surface rebuilds.
  Deep links to room routes forward exactly as before (§3.1 guards).
- **Tab bar:** not rendered on `/` (same pre-room rule as §4.19).
- **Interaction states:** no data loading/empty/error states exist (no
  fetches); the only dynamic states are the loops above (dialogue cycle,
  chat strip) — both reduced-motion-guarded; hover/press/focus states as
  specified per element; the locale switch is the only persistent
  control.

#### 4.20.M RU/EN copy — every new landing string (§4.7 format; both dictionaries required; parity test extended per the §14.1.5 precedent)

| Key | RU | EN |
| --- | --- | --- |
| `landing.tagline.left.1` | ЗНАКОМСТВА — ЭТО ИГРА. | NETWORKING IS A GAME. |
| `landing.tagline.left.2` | АГЕНТ ИГРАЕТ ЗА ВАС. | THE AGENT PLAYS IT FOR YOU. |
| `landing.tagline.top` | БЕЗ СМОЛТОЛКА. ТОЛЬКО РЕАЛЬНЫЕ ЗНАКОМСТВА. | NO SMALL TALK. JUST REAL CONNECTIONS. |
| `landing.tagline.right.1` | СДЕЛАНО ДЛЯ ЛЮДЕЙ. | BUILT FOR PEOPLE. |
| `landing.tagline.right.2` | РАБОТАЮТ АГЕНТЫ. | RUN BY AGENTS. |
| `landing.headline.1` | НУЖНЫЕ | THE RIGHT |
| `landing.headline.2` | ЗНАКОМСТВА | CONNECTIONS |
| `landing.headline.accent` | ВАС | YOU |
| `landing.sub` | Приложение события, где ИИ-агенты заводят разговор за вас — вы приходите к знакомству уже готовым. | An event app where AI agents break the ice for you — you arrive at every meeting already warmed up. |
| `landing.cta` | НАЧАТЬ | START |
| `landing.dialog.line1` | * Агент здоровается… | * The agent says hello… |
| `landing.dialog.line2` | * Ваш агент уже нашёл три совпадения. | * Your agent already found three matches. |
| `landing.dialog.line3` | * Совпадение принято. Обмен контактами через минуту. | * Match accepted. Contact exchange in a minute. |
| `landing.hero.aria` | Пиксельная сцена: человек встречает своего ИИ-агента под светящимся узлом сети | Pixel scene: a person meets their AI agent under a glowing network node |
| `landing.stat.title` | РЕАЛЬНЫЕ ЛЮДИ. РЕАЛЬНЫЕ РЕЗУЛЬТАТЫ. | REAL PEOPLE. REAL RESULTS. |
| `landing.stat.line1` | Никаких пустых чатов. | No empty chats. |
| `landing.stat.line2` | Никаких холодных сообщений. | No cold DMs. |
| `landing.stat.line3` | Только встречи, которые важны. | Only encounters that matter. |
| `landing.agent.name` | ВЕКТОР | VECTOR |
| `landing.agent.badge` | АГЕНТ · УР 1 | AGENT · Lv 1 |
| `landing.agent.traits` | БЫСТРЫЙ · ТОЧНЫЙ · НАДЁЖНЫЙ | SWIFT · SHARP · LOYAL |
| `landing.agent.quote` | «Я начинаю разговор. Вы сохраняете контакт.» | "I break the ice. You keep the contact." |
| `landing.agent.cta` | ПОГОВОРИТЬ | TALK |
| `landing.chat.label` | ЖИВОЙ ЧАТ АГЕНТА | LIVE AGENT CHAT |
| `landing.chat.bubble1` | Привет! Я Глитч — агент Даши. | Hi! I'm Glitch — Dana's agent. |
| `landing.chat.bubble2` | Привет. Я здесь ради трека по ИИ. | Hey. I'm here for the AI track. |
| `landing.chat.bubble3` | Тогда вам по пути. Даша собрала демо, которое вы лайкнули. | Then you'll get along. Dana built the demo you starred. |
| `landing.chat.bubble4` | Передайте ей мои контакты! | Send her my contacts! |
| `landing.chat.aria` | Анимация: агент Глитч и участник Пип обмениваются сообщениями | Animation: the agent Glitch and the attendee Pip exchange messages |
| `landing.tutorial.search` | НАЙДИ | FIND |
| `landing.tutorial.chat` | ОБЩАЙСЯ | CHAT |
| `landing.tutorial.share` | ПОДЕЛИСЬ | SHARE |
| `landing.footer.line` | КАЖДЫЙ КОНТАКТ ВАЖЕН. | EVERY CONNECTION MATTERS. |
| `landing.footer.badge` | СТАРТ СЕЙЧАС — 6 ЦИФР ДЛЯ ВХОДА | START NOW — 6 DIGITS TO JOIN |
| `landing.footer.copyright` | bleak-web · 2026 | bleak-web · 2026 |

35 keys. Nav anchors ("HOW IT WORKS"/"AGENTS") reuse `landing.tutorial.*`
and `landing.agent.*` as their accessible names — no extra keys.

#### 4.20.N Acceptance criteria (checkable)

1. `/` renders the full §32 landing: header taglines + locale switch +
   Start, 3-line headline with the single accent word glowing, subheadline,
   hero scene, retro dialogue-box, mascot-chat strip, agent character
   card, stat card, 3-step tutorial row, two footer blocks.
2. Start CTA, agent-card TALK, and the CTA badge block each navigate to
   `/income`; `/income` and `/income/[room]/create` behavior unchanged
   (their existing suites stay green).
3. The bottom tab bar is not rendered on `/`.
4. Palette audit: no new color values — every landing color resolves to an
   existing §4.1 token or a `color-mix`/alpha variant; no raw hex in new
   landing files.
5. Exactly 3 tutorial icons with RU/EN labels and pixel-step connectors
   between them, in the order search → chatting → contacts sharing.
6. Mascot-chat strip: 4 alternating bubble turns (GLITCH → PIP → GLITCH →
   PIP), per-character typewriter reveal (55ms/char, CSS steps), 900ms
   hold, infinite loop with fade-out; all four bubbles render statically
   under `prefers-reduced-motion: reduce`.
7. Mascot variety: ≥6 distinct figures (NOVA, BYTE, VECTOR, BLOOM, PIP,
   GLITCH), no figure reused in two regions; all are SVG-rect original art
   with transparent backgrounds — no raster/background plates.
8. All 35 `landing.*` keys exist in BOTH dictionaries (RU and EN); the
   extended parity test is green.
9. The header locale switch changes every landing string (headline, accent
   word, taglines, dialogue lines, bubbles, card texts, tutorial labels,
   footer) without a page reload.
10. The dialogue box cycles its 3 asterisk lines with a blinking caret.
11. ≥720px viewport (test at 1280×800): three-column composition —
    headline/CTA/stat left, hero+dialogue center, agent card + chat strip
    right, tutorial full-width bottom; no horizontal scroll.
12. <720px viewport (test at 320×640 and 390×844): single column stacking
    in §4.20.K order; no horizontal scroll at 320px.
13. No new dependencies (package.json unchanged); no canvas element and no
    animation library anywhere in the landing code.
14. Hero scene and chat strip expose `role="img"` + aria-labels
    (`landing.hero.aria`, `landing.chat.aria`); focusable elements have
    visible focus rings; typewriter bubbles keep full text in the DOM.
15. Deep links to room routes still forward unchanged; `make lint && make
    test && make build` green.

#### 4.20.O Flags for the owner / concept (concept report)

1. **ADVICE NEEDED — PASS button dropped:** the example's character card
   has TALK + PASS; I specced a single TALK CTA because a second no-op
   button would fake a behavior the landing cannot perform. Confirm the
   single-CTA card is acceptable (or provide a real second action).
2. **ADVICE NEEDED — cast & copy are the design's invention:** NOVA /
   BYTE / VECTOR / BLOOM / PIP / GLITCH and all RU/EN copy adapt the
   dating example to the AI-networking story per Concept §32.1 ("adapt,
   don't copy content"). Owner tone/naming approval requested before the
   worker lands final copy.

### 4.21 v3.15 feature design (2026-11-22, owner-approved Concept §33): §33 landing adjustments — owner photo review

The owner reviewed the live landing (photo `real-design.png`, workspace
root) and issued the 7-item change batch of Concept §33. This section
amends the §4.20 landing spec item by item; **where §4.21 is silent, §4.20
stands verbatim** — header/taglines (§4.20.B), headline + subheadline +
Start CTA (§4.20.C), mascot-chat strip content and timing (§4.20.F), agent
card (§4.20.G-b), behavior/routes (§4.20.L except as amended in
§4.21.D/§4.21.G), a11y and reduced-motion baselines (§4.20.L). The live
build matches §4.20 faithfully (verified against `real-design.png`), so
every item below is an adjustment to the shipped composition, not a
re-derivation. Two new inputs: the owner's pixel scene image
**`background-img.jpg`** (workspace root — a boy and a robot in a purple
flower field before a violet city skyline, under a glowing HELLO speech
bubble) becomes the composition block's background, and the reminder box
gains the no-overlay / 1:3.5 ratio / bottom-fixed / bob rules. Hard
constraints unchanged: **no new dependencies, no new color values (§4.1 —
every value below is an existing token or a `color-mix` alpha variant),
routes `/income` + `/income/[room]/create` untouched, the §4.20.F
mascot-chat animation stays (placement re-verified in §4.21.D), and the
PHONE stacking order is exactly §4.20.K's** except where an element was
removed or merged below. **API endpoints used: none** — unchanged; the
landing stays fetch-free (§4.20 preamble), no loading/empty/error data
states exist.

#### 4.21.A Hero pair redo — ASTRA replaces BYTE (amends §4.20.D, §4.20.J)

The left figure **NOVA is unchanged** (owner: "the left personage is
good"). The right figure becomes **ASTRA**: a copy of NOVA — same body
rects, same proportions, same back-view pose, same palette discipline —
with only the head changed: **white hair** + **two small purple horns**.

- **Derivation:** ASTRA's rect data is NOVA's §4.20.D construction
  re-based to its own bounding box (origin = head top-left; the pair
  renders as two separate absolutely-positioned SVGs so each can be
  placed independently — see §4.21.B). **One shared part table serves
  both figures** (add `nova` + `astra` to `LANDING_FIGURES` in
  `lib/components/landing/figures.ts`; `Figure` gains explicit
  `viewW`/`viewH` so `LandingFigure` derives a non-square
  `viewBox="0 0 16 31"`). Both figures render through `LandingFigure`
  (idle sway kept: 1.6s `steps(2)` ±2°, §4.6 family).

  Shared 16×31 table (grid units; NOVA = same table **without** the two
  horn groups and with NOVA's current hair fills; ASTRA = full table):

  | Part | Fill | Rects [x, y, w, h] |
  | --- | --- | --- |
  | Horn L (ASTRA only) | `--color-deepa-4` | `[3,0,2,3]` |
  | Horn L glint (ASTRA only) | `--color-text` | `[3,0,2,1]` |
  | Horn R (ASTRA only) | `--color-deepa-4` | `[11,0,2,3]` |
  | Horn R glint (ASTRA only) | `--color-text` | `[11,0,2,1]` |
  | Hair top | NOVA: `color-mix(in srgb, var(--color-art-hair-3) 65%, var(--color-surface))` · ASTRA: `--color-text` | `[4,3,8,2]` |
  | Hair mid | same split as hair top | `[2,5,12,8]` |
  | Hair low (under-shade) | NOVA: current lower-shade mix · ASTRA: `color-mix(in srgb, var(--color-text) 72%, var(--color-surface-elevated))` | `[3,13,10,3]` |
  | Neck | `--color-art-skin-2` | `[6,16,4,2]` |
  | Scarf | `--color-text` | `[1,18,14,4]` |
  | Scarf stripes | `--color-deepa-4` | `[4,18,2,4]`, `[10,18,2,4]` |
  | Coat + arms + legs | `--color-surface-elevated` | `[2,22,12,5]`, `[0,23,2,5]`, `[14,23,2,5]`, `[3,27,4,4]`, `[9,27,4,4]` |
  | Shoes | `--color-text` | `[2,30,5,1]`, `[9,30,5,1]` |

- **White-hair palette (art, AA not required):** nearest-white token
  `--color-text` (#f0f0f0) for the lit rows plus the 72/28
  `--color-text`→`--color-surface-elevated` mix as the under-shade — the
  established two-shade art-shading discipline (§4.3), zero new values.
- **Horns:** two 2×3-unit `--color-deepa-4` columns rising from the hair
  top (grid y 0–3), each with a 2×1 `--color-text` glint cell — small,
  accent-token, symmetric; they read against the dark bg via the glint +
  the §4.20.A glow recipe (`drop-shadow` accent mix at 35%) on the horn
  group only.
- **BYTE is removed from the hero and retired from the landing:** the
  `<g data-figure="byte">` group is deleted from `LandingHeroScene`; the
  robot in `background-img.jpg` is scene art, not the BYTE mascot. §4.20.J
  cast table updates: BYTE → **ASTRA** (hero scene, right figure, white
  hair + horns); cast stays six distinct figures (NOVA, ASTRA, VECTOR,
  BLOOM, PIP, GLITCH).
- **Focal element amended:** the §4.20.D floating handshake-node diamond +
  light beam are **retired** — the image's glowing HELLO bubble (the
  composition's own focal bloom, §4.21.B) replaces it; the mesh/sparkle
  system stays (§4.21.B layer 3).

#### 4.21.B Pixel-art composition block — taller, image background, smooth edge (amends §4.20.D)

One block (`.art-block`, center of section 2) holds everything that used
to be the bare hero scene. **Height: 500px mobile / 680px ≥720px** (was
320/480 — the owner's "taller"). Width: full content column (mobile) /
center grid column (desktop, §4.21.D). Stacking order bottom→top:

| z | Layer | Spec |
| --- | --- | --- |
| 0 | Base | `background-color: color-mix(in srgb, var(--color-deepa-4) 6%, var(--color-bg))` (alpha-mix tint, §4.1-legal; shows only pre-load) |
| 1 | Background image | `<img>` inset 0, `object-fit: cover`, `object-position: 50% 50%`, `alt=""` + `aria-hidden="true"`, `loading="eager"`, `decoding="async"`, intrinsic 1024×1024 attrs (no CLS) |
| 2 | Edge-fade vignette | `::after` overlay, `pointer-events: none`: `background: radial-gradient(ellipse 80% 78% at 50% 46%, transparent 0 52%, color-mix(in srgb, var(--color-bg) 45%, transparent) 72%, var(--color-bg) 100%)` — the **smooth transition**: every edge dissolves into exactly `--color-bg`, no hard rectangle edge at any breakpoint |
| 3 | Animated purple pixels | the §4.20.D mesh/sparkle system **kept**, re-expressed as ~12 absolutely-positioned pixel dots (`<span>`s, 4–6px squares, the existing three `--color-deepa-4` alpha shades 18/35/60%), `steps(2)` twinkle 1.6s, staggered 0–1.2s delays: sky dots at (5%,12%), (93%,16%), (8%,55%), (90%,60%); ground-band dots at (4%,90%), (12%,95%), (88%,90%), (95%,94%) + 4 more in the bottom band outside the protected rect |
| 4 | Hero pair | NOVA + ASTRA SVGs (`LandingFigure`, 16×31 viewBox): **desktop** each 160px tall (~82px wide), NOVA anchored `left: 2%`, ASTRA `right: 2%`, feet line at `bottom: calc(var(--reminder-h) + 16px)` (~115px); **mobile** each 64px tall (~33px wide), same left/right 2% anchors, feet at `bottom: calc(var(--reminder-h) + 16px)` (~89px) — both figures stand in the image's flower band, flanking the central scene without entering it |
| 5 | Reminder box | §4.21.C — `position: absolute; bottom: 16px; left/right insets per breakpoint` |

**Asset path & import (worker instruction):** copy the owner's
`background-img.jpg` from the workspace root to
**`apps/web/src/lib/assets/landing/background.jpg`** and commit it there
(app asset; the root copy is an owner working file, not committed).
Import as a Vite **URL import** — `import backgroundUrl from
'#lib/assets/landing/background.jpg';` (the established `#lib` alias;
`?raw` is for SVG text only) — and bind it as the `<img>` `src`. No
static/ usage, no new loader, no new dependency.

**Protected central safe zone (the image's scenario — nothing may render
over it):** conservative union rect valid at both breakpoints (derived
from the cover-crop math at 288/350/472px block widths):

- **Figures band (boy + robot): x 21–83%, y 44–80% of the block.**
- **HELLO bubble: x 24–76%, y 2–22% of the block.**

The reminder box (layer 5) satisfies this by geometry: with height =
width ÷ 3.5 and bottom inset 16px, its **top edge sits at ≥81% of the
block height** at both breakpoints (500px block: (73+16)/500 = 17.8% →
top 82.2%; 680px block: (99+16)/680 = 16.9% → top 83.1%). The pair
(layer 4) satisfies it by x-anchor (±2% edges vs the 21%/83% bounds).
The pixel dots are placed outside both rects. Test at 320×640, 390×844
and 1280×800.

#### 4.21.C Agent reminder box (amends §4.20.E — the retro dialogue box becomes the reminder)

The three cycling agent lines keep their copy (`landing.dialog.line1–3`,
200ms cross-fade, sr-only static line) and move **inside the art block,
fixed at its bottom** — no longer a sibling overlapping the hero's edge.

- **Geometry (owner ratio 1 : 3.5 height:width — a wide strip):**
  `aspect-ratio: 3.5 / 1; min-height: 64px;` width capped per breakpoint
  so it can never overlay the nearest blocks left/right/top:
  - **<720px:** `width: min(100% - 32px, 256px)` → ~256×73px; side
    insets 16px each; `position: absolute; bottom: 16px;` centered via
    `left: 0; right: 0; margin-inline: auto;` (no transform centering —
    transform is reserved for the bob).
  - **≥720px:** `width: min(100% - 48px, 348px)` → ~348×99px; side
    insets 24px each; same absolute bottom anchoring.
  Expose the resolved height as `--reminder-h` on the block (the pair's
  `bottom` offset consumes it, §4.21.B). Because the box lives strictly
  inside the block's padding box with these insets, it cannot overlap
  the chat strip, agent card or headline at 320/390/1280.
- **Frame:** the §4.20.E pixel-frame stands — `--frame-strong`, 2px
  `--color-text` border, 4px stepped notches, bg `--color-surface`.
- **Font — PIXEL (owner item 2a):** the message text renders in the
  established pixel font stack **Handjet** (was Inter): 16px mobile /
  18px desktop, `letter-spacing: 0.05em`, `line-height: 1.3`,
  `--color-text`, **horizontally centered** (owner item 2c), max 2
  lines, padding 12px 20px so text clears the corner glyph.
- **Pixel emoji at the left-top corner (owner item 2c):** an original
  §4.3-construction glyph — a 16-grid **pixel sparkle-star** (arms
  `[7,2,2,2]`, `[7,12,2,2]`, `[2,7,2,2]`, `[12,7,2,2]`; diagonals
  `[4,4]`, `[5,5]`, `[10,5]`, `[11,4]`, `[4,10]`, `[5,11]`, `[10,11]`,
  `[11,10]` as 2×2 cells; center `[7,7,2,2]` with a `--color-text`
  highlight cell) — fill `--color-deepa-4`, rendered **24px**,
  absolutely positioned at the box's top-left corner at offset
  (−10px, −10px) overlapping the frame; `aria-hidden`; twinkle
  opacity 1↔0.55, 1.6s `steps(2)` infinite.
- **Check mark at the bottom — bigger and more visible (owner item 2e):
  ** the §4.20.E 8px caret is replaced by a **24px (20px mobile) pixel
  check mark**: 12-grid cell run `[(2,6),(3,7),(4,8),(5,7),(6,6),(7,5),
  (8,4),(9,3)]` as 1u rects, fill `--color-deepa-4`, plus a 1×1
  `--color-text` glint at the vertex (4,8); positioned bottom-center of
  the box, half-out over the frame edge (`translateY(50%)` via a wrapper
  so the bob transform stays free); visibility = size + the §4.20.A glow
  (`drop-shadow(0 0 6px color-mix(in srgb, var(--color-deepa-4) 60%,
  transparent))`) pulsing to the 100% mix, 1.6s `steps(2)` infinite
  alternate. Reads against both the box surface and the page bg.
- **Up-and-down movement (owner item 2e):** ambient bob on the whole
  box, transform-only: `@keyframes reminder-bob { 0%,100% {
  transform: translateY(0); } 50% { transform: translateY(calc(-1 *
  var(--bob-amp))); } }` — `--bob-amp: 6px` mobile / `10px` ≥720px;
  **duration 3s, `ease-in-out`, infinite** (smooth float — a `steps()`
  bob on a large box reads as a glitch; this is the one §4.6-table
  addition: *reminder ambient bob · translateY · 3s ease-in-out*).
  `prefers-reduced-motion: reduce` → bob, twinkle, glow pulse and the
  line cross-fade all collapse (static first line + static glyph), per
  §4.6/§4.20.L.

#### 4.21.D Layout reorganization (amends §4.20.K — desktop clarity; PHONE ORDER UNCHANGED)

**Section 1 = the header: §4.20.B unchanged entirely** (taglines, locale
switch, START control, anchors).

**≥720px — three explicit sections on the 1000px canvas:**

- **Section 2 (`grid-template-columns: 27% minmax(0,1fr) 26%`, `grid-template-areas: "lead art agent" / "lead art chat"`, `grid-template-rows: auto 1fr`, gap `--space-6`, `align-items: start`):**
  - `lead` (left column): the headline block + subheadline + **Start**
    CTA (§4.20.C verbatim).
  - `art` (center column): the §4.21.B composition block — background
    image, animated pixels, the NOVA/ASTRA pair, and the **reminder box
    fixed at the block's bottom**.
  - `agent` + `chat` (right column, two rows): the agent character card
    (`#agents`, §4.20.G-b) on top, the §4.20.F **mascot-chat strip
    unchanged** below it (280px, 4-turn typewriter loop). Placement
    re-verified against the taller art block: the strip stays in the
    right column — it never shares space with the art block or the
    reminder, no conflict; no position amendment needed.
- **Section 3 (all the other blocks):** vertical stack, gap
  `--space-6` — row 1: the **stat card full-width** (§4.21.F compact);
  row 2: `#tutorial` = the **three big step blocks** in an equal
  left-to-right row (`grid-template-columns: repeat(3, 1fr)`, gap
  `--space-6`; §4.21.E). The stat card leaves the §4.20.G-a "left column
  bottom" slot.
- **Footer:** the §4.21.G contact block, full-width centered.

**<720px — the §4.20.K stacking order stands EXACTLY, top→bottom:** top
bar → headline block (centered) → subheadline → **Start CTA** → art
block (the composition block; the reminder lives inside it at the
bottom — this is the one consolidation: §4.20.E's separate dialogue-box
slot merges into the hero slot it already followed) → mascot-chat strip
→ agent character card → stat card → the three step blocks (§4.21.E
stack) → contact footer. The removed §4.20.I footer blocks simply
disappear from the tail. Same DOM order on both breakpoints; desktop is
CSS-grid rearrangement only; no horizontal scroll at 320px.

#### 4.21.E Find >> Chat >> Share — three BIG separate blocks (REPLACES §4.20.H)

The small icon row is retired. `#tutorial` becomes three large
**non-interactive display blocks** — how the app works, one step each,
in the §31 order find → chat → share:

- **Frame & surface:** `--frame-strong` pixel-frame (§4.20.A/§4.5), bg
  `--color-surface`, **desktop each block ~300px min-height** (equal
  thirds of the row), padding 20px (mobile 16px); mobile full-width
  stacked with `--space-5` gaps, natural height.
- **Contents top→bottom:** ① **pixel step number** — "01" / "02" / "03"
  in Handjet 40px, `--color-deepa-4`, `letter-spacing: 0.1em`, the
  §4.20.A text-shadow glow (locale-invariant literals, not keys);
  ② **title** — pixel font Handjet 20px uppercase `--color-text`,
  reusing `landing.tutorial.search` / `.chat` / `.share` (FIND / CHAT /
  SHARE — «НАЙДИ» / «ОБЩАЙСЯ» / «ПОДЕЛИСЬ»); ③ **step icon** — the
  §4.4 glyphs at 32px in a 48px zone: `search`, `dialog-lines`,
  `contact-share` (the §4.20.H set incl. the contact-share glyph,
  `currentColor` tinted `--color-text-muted`); ④ **mini description** —
  one line, Inter 13px `--color-text-muted` (new keys, §4.21.H).
- **Order:** desktop left→right 01→02→03; phone top→bottom 01→02→03
  (the §4.20.K tail order with the row swapped for the stack).
- **Interaction:** none — static display blocks; no hover/press states,
  no motion (§4.6 no scroll-triggered motion); icons `aria-hidden` +
  visible text.

#### 4.21.F "Real people. Real results" — padding minimized (amends §4.20.G-a)

Stat card padding **20px → 12px 14px mobile / 16px 20px desktop**;
internal title 18px→17px, three lines keep Inter 13px with
`line-height: 1.35` and 2px inter-line gaps; BLOOM glyph 56px → **44px
mobile / 48px desktop**; the desktop layout stays title-left /
glyph-right in one compact row, full-width atop section 3. Frame, copy
and hover states (§4.20.G preamble) unchanged.

#### 4.21.G Contact footer (REPLACES §4.20.I)

Both §4.20.I footer blocks (the "bleak-web — every connection matters"
positioning block and the "start now — 6 digits to join" CTA badge) are
**removed**; their keys die (§4.21.H) and the CTA badge's /income role
dies with it — **the /income entry points are now exactly two: the Start
CTA and the agent-card TALK** (§4.20.L amended accordingly; deep-link
forwarding untouched). The footer becomes a single **site contact
block**: one `--frame-strong` pixel-frame (§4.20.A), bg
`--color-surface`, `max-width: 560px`, centered, padding `16px 20px`,
containing:

- Row 1: the existing 16px logo glyph + "bleak-web" (Handjet 14px) +
  "· 2026" (Inter 11px muted) — the kept `landing.footer.copyright`
  content.
- Row 2 (two links, side-by-side ≥720px / stacked with 8px gap on
  phone): **EMAIL → `mailto:extube@proton.me`** and **GITHUB →
  `https://github.com/extube`** (`target="_blank"` `rel="noopener
  noreferrer"`). Label in Handjet 12px `--color-text-muted`
  (`landing.footer.contact.email.label` = ПОЧТА / EMAIL;
  `landing.footer.contact.github.label` = ГИТХАБ / GITHUB), value in
  Handjet 13px `--color-text` — the address/URL are locale-invariant
  literals in markup; hover `--color-accent` + glow, `:focus` ring per
  §2.6. The block is pixel-framed and consistent with the card family.

#### 4.21.H RU/EN i18n amendments (delta on §4.20.M; §4.7 format; both dictionaries required)

| Δ | Key | RU | EN |
| --- | --- | --- | --- |
| + | `landing.steps.find.desc` | Радар показывает, кто рядом прямо сейчас. | The radar shows who is around you right now. |
| + | `landing.steps.chat.desc` | Ваши агенты заводят разговор до вашего прихода. | Your agents break the ice before you arrive. |
| + | `landing.steps.share.desc` | Одно рукопожатие — и контакты обменяны. | One handshake — and contacts are exchanged. |
| + | `landing.footer.contact.email.label` | ПОЧТА | EMAIL |
| + | `landing.footer.contact.github.label` | ГИТХАБ | GITHUB |
| ~ | `landing.hero.aria` | Пиксельная сцена: двое у фиолетового города под светящимся приветствием | Pixel scene: two figures before a violet city under a glowing hello |
| − | `landing.footer.line` | — | — |
| − | `landing.footer.badge` | — | — |

Unchanged and kept: `landing.dialog.line1–3` (now the reminder lines),
`landing.tutorial.search/chat/share` (now the step-block titles),
`landing.footer.copyright` (now inside the contact block), all
§4.20.M keys not listed above. **Deleted keys must be removed from BOTH
`ru.ts` and `en.ts`.** New parity total: **38 keys** (35 − 2 + 5); the
extended parity test asserts 38/38 in both dicts and the absence of the
two dead keys.

#### 4.21.I Acceptance criteria (checkable)

1. Hero right figure: `/` renders NOVA (left, unchanged) and ASTRA
   (right) — same body/proportions as NOVA, **white hair**
   (`--color-text` + its 72% surface-elevated shade) and **two small
   purple horns** (`--color-deepa-4` + `--color-text` glints); the BYTE
   robot appears nowhere on `/`.
2. The §4.20.D handshake-node diamond + light beam are gone from the
   hero; the composition's focal glow is the background image's HELLO
   bubble.
3. Reminder box: message text renders in **Handjet** (pixel font),
   **horizontally centered**, with a **24px pixel sparkle glyph
   overlapping the box's top-left corner** and the asterisk-prefixed
   cycling lines intact (3 lines, 200ms cross-fade).
4. Reminder box proportions = **1 : 3.5 (height:width)** at 320, 390
   and 1280 widths (measured: ~256×73px mobile, ~348×99px desktop).
5. Reminder adaptivity: at 320×640, 390×844 and 1280×800 the box never
   overlays the chat strip, agent card, headline or the art block's
   side edges (16px/24px side insets; bottom 16px; top edge ≥81% of the
   block height).
6. The reminder box is **fixed at the bottom of the art block** on both
   breakpoints (absolute within the block, not a sibling section).
7. Reminder bob: the box floats up and down continuously — translateY
   0→−6px (mobile) / −10px (desktop), 3s ease-in-out loop,
   transform-only; under `prefers-reduced-motion: reduce` it is static.
8. The check mark at the reminder's bottom is a ≥20px pixel check
   (accent violet + glint) with a visible glow, clearly larger and
   brighter than the retired 8px caret.
9. Desktop ≥720px (test 1280×800) shows the three sections: header;
   hero zone = left (headline + Start) / center (art block with the
   bottom-fixed reminder) / right (agent card above the chat strip);
   then stat card full-width + the three step blocks in one equal row;
   then the contact footer. No horizontal scroll.
10. Phone <720px (test 320×640 and 390×844) stacks in exactly the
    §4.20.K order with the two removals and the dialogue-into-art-block
    merge: top bar → headline → sub → Start → art block (reminder
    inside, bottom) → chat strip → agent card → stat card → three step
    blocks → contact footer. No horizontal scroll at 320px.
11. The three step blocks each show the pixel step number (01/02/03),
    the pixel-font title (FIND/CHAT/SHARE per locale), the step icon
    (search / dialog-lines / contact-share) and a one-line description;
    desktop = left-to-right equal row, phone = top-to-bottom stack;
    none is interactive.
12. The "bleak-web — every connection matters" block and the "start now
    — 6 digits to join" badge are absent from `/` (no DOM node, no
    rendered copy).
13. The art block's background is the committed app asset
    `apps/web/src/lib/assets/landing/background.jpg`, imported via the
    `#lib` URL import (not hotlinked, not in `static/`), rendered
    `object-fit: cover`, block height ≥500px mobile / ≥680px desktop.
14. Smooth transition: at every tested width the image dissolves into
    `--color-bg` at all four block edges (radial vignette) — no hard
    edge line where image meets page background.
15. Protected scenario: no rendered element (pair figures, pixel dots,
    reminder box, any other block) intersects the figures rect
    (x 21–83%, y 44–80%) or the bubble rect (x 24–76%, y 2–22%) of the
    art block at 320/390/1280.
16. The animated purple pixels still animate over the image (steps(2)
    twinkle loop visible; static under reduced motion).
17. Stat card padding measures ≤14px mobile / ≤20px desktop (was 20px
    uniform).
18. Footer: mailto `extube@proton.me` and `github.com/extube` links with
    RU/EN labels (ПОЧТА/EMAIL, ГИТХАБ/GITHUB) that swap with the locale
    switch without a reload; focus rings visible; external link opens
    safely (`rel="noopener noreferrer"`).
19. i18n: exactly **38** `landing.*` keys exist in BOTH dictionaries;
    `landing.footer.line` and `landing.footer.badge` exist in NEITHER;
    the extended parity test is green.
20. Start CTA and agent-card TALK navigate to `/income` (6-digit entry);
    `/income` and `/income/[room]/create` behavior unchanged (existing
    suites green); the bottom tab bar is not rendered on `/`.
21. The mascot-chat strip keeps its §4.20.F behavior (4 alternating
    typewriter turns, infinite loop, reduced-motion static) and its
    desktop slot under the agent card — no overlap with the art block
    or reminders at any tested width.
22. Palette/stack audit: no new color values (tokens or `color-mix`
    alpha variants only), no new dependencies, no canvas, no animation
    library; `make lint && make test && make build` green.

#### 4.21.J Flags for the owner / concept (concept report)

1. **ADVICE NEEDED — SVG pair vs the image's own cast:** the owner kept
   the left personage, redid the right one, AND set `background-img.jpg`
   (which contains its own boy + robot) as the block background. I
   resolved the double cast by flanking: NOVA + ASTRA stand small in the
   bottom-corner flower band, strictly outside the protected central
   scene (mobile: 64px corner figures; desktop: 160px). If the owner
   prefers the image's duo to be the ONLY cast (SVG pair dropped, or
   desktop-only), that is a one-line layer removal — confirm before the
   worker lands.
2. **ADVICE NEEDED — inventions carried over from §4.20.O-2:** the new
   figure's name **ASTRA**, BYTE's retirement, the node+beam retirement,
   and the three step-block descriptions + contact-footer labels are
   design adaptations of the owner's items (the owner specified
   structure, not copy). Owner tone/naming approval requested with the
   §4.20.O-2 batch.
3. **ADVICE NEEDED — contact footer content:** specced as
   `extube@proton.me` + `github.com/extube` per the caller's suggestion;
   confirm (or substitute) before landing — it is published contact
   information.

### 4.22 v3.16 feature design (2026-11-22, owner-approved Concept §34): §34 video hero + header cleanup + Vector→Bleak

The owner added a 16:9 `.mp4` video (workspace root: `background-video.mp4`,
~4.4 MB, the clip's own background is near-black — the owner explicitly
matches the page background to it) and issued the six-item §34 batch. This
section amends the §4.20/§4.21 landing spec item by item; **where §4.22 is
silent, §4.20/§4.21 stand verbatim** (headline block + Start CTA §4.20.C,
mascot-chat strip content/timing §4.20.F, cards §4.20.G/§4.21.F, step blocks
§4.21.E, contact footer §4.21.G, behavior §4.20.L, motion/a11y baselines
§4.20.L/§4.6). Constraint on inspection: **no video-inspection tooling exists
in this environment** (no ffmpeg/ffprobe rights; the mp4 is not readable
here) — every choice that depends on the video's exact frames is specced
DEFENSIVELY below (attribute-based fallbacks, the structural dissolve, no
frame-dependent geometry). The owner's still `background-img.jpg` (boy +
robot in a purple flower field before a violet city skyline, under a glowing
HELLO bubble, near-black purple-cast ground) is treated as the preview of the
clip's art and the tone reference. Hard constraints unchanged: **no new
dependencies, no new color values (§4.1 — tokens or `color-mix` alpha
variants only), no canvas, no animation library; routes `/income` +
`/income/[room]/create` untouched structurally (the income mascot swap is
content-only); §23 no-background-plates; §24–§29 wizard geometry contracts
untouched; PHONE stacking order preserved except the video restructure.**
**API endpoints used: none** — unchanged; the landing stays fetch-free
(§4.20 preamble), no loading/empty/error data states exist; the video adds
media states only (§4.22.B). Task: tz12-06 (`feature/a4e2a3c6-tz12-06-video-hero`).

#### 4.22.A Header slim-down (amends §4.20.B — taglines dropped, icon added)

The header keeps ONLY the **web icon + the navigation + the language
switcher**. Removed from `/` entirely:

- the §4.20.B **top-left tagline pair** (`landing.tagline.left.1/.2`);
- the **top-center line** (`landing.tagline.top`, ≥720px);
- the **top-right tagline pair + the 24px GLITCH glyph**
  (`landing.tagline.right.1/.2`) — the glyph was tagline-bound and dies with
  the taglines (GLITCH remains only in the mascot-chat strip — this restores
  §4.20.J's "no figure appears twice" cleanly);
- the **header START controls** (`.start-pill` mobile / `.start-link`
  desktop) — not in the owner's keep-list; the `/income` entry points return
  to **exactly two: the lead-block Start CTA and the agent-card TALK**
  (§4.21.G's rule, now truly exact — see §4.22.K flag 1).

What remains, one non-sticky row on both breakpoints (height ~56px):

- **Left: the web icon** — the FormShell header's exact app mark (§30
  header-left treatment: the PWA mark's graphic itself, **no background
  plate**, 40px, `aria-hidden` decorative). Token fills; its cutout cells
  use the landing page background token (`--color-landing-bg`, §4.22.F) so
  the cutouts dissolve into the new black page instead of reading as
  `--color-bg` chips.
- **Center/right: the nav anchors** — the existing two in-page anchors
  (`#tutorial`, `#agents`; accessible names reuse `landing.tutorial.*` +
  `landing.agent.name`, no new keys), **desktop-only (≥720px) as
  established**: icon · anchors · switcher left→right. On phone the header
  is icon + switcher only (the anchors were already a desktop convenience;
  phone navigates by scroll) — stated explicitly so the header is never
  empty at 320px.
- **Right: the LocaleControl** (the shared control, unchanged sizing from
  the live header).

i18n keys retired from BOTH dictionaries: `landing.tagline.left.1`,
`landing.tagline.left.2`, `landing.tagline.top`, `landing.tagline.right.1`,
`landing.tagline.right.2` (§4.22.H).

#### 4.22.B The video block — structure, stage layout, attributes

**Structure.** The hero common block is built around the **video**. The
`.stage` wrapper (new; replaces §4.21.D's three-column grid for section 2)
contains, in this DOM order (= the phone stacking order): **lead block**
(headline + subheadline + Start CTA, §4.20.C verbatim) → **video block** →
**mascot-chat strip** (§4.20.F verbatim) → **agent card** (BLEAK, §4.20.G-b
as renamed §4.22.D). Section 3 (stat card, step blocks) and the contact
footer follow below, unchanged.

- **Video block** (`LandingVideoHero.svelte` — replaces
  `LandingHeroScene.svelte`, which is deleted with its only consumer): one
  block, **full common-block width** (the 1000px canvas's content width;
  ~888px at ≥1120px viewports), `aspect-ratio: 16 / 9` (the video's own
  ratio — the block height derives from the video: ~500px desktop, ~150–200px
  phone; the fixed 500/680px art-block heights of §4.21.B are superseded).
  Layers bottom→top: ① the `<video>` (`width/height: 100%`,
  `object-fit: cover` — with the block ratio pinned to the video's 16:9,
  cover degrades to exact-fit; defensive if the true ratio drifts slightly,
  it crops minimally instead of letterboxing); ② the edge-fade vignette
  (§4.22.F); ③ the **animated purple pixels** — the §4.21.B layer-3 dot mesh
  **kept verbatim** (the same 12 `DOTS` table, three `--color-deepa-4` alpha
  shades 18/35/60%, `steps(2)` twinkle 1.6s, staggered 0–1.2s delays,
  `aria-hidden`), re-anchored over the video block (the percent positions are
  breakpoint-independent; the §4.21.B protected-scenario rects are RETIRED
  with the still image — see §4.22.G); ④ the reminder box (§4.22.C); ⑤ the
  play control (below).

- **Video attributes (decisive set):**

  ```html
  <video src={videoUrl} muted loop playsinline preload="metadata"
         disablepictureinpicture aria-hidden="true"></video>
  ```

  - **No `autoplay` attribute** (it cannot be conditional) and **no
    `controls`** (the custom control replaces it). Playback starts from a
    one-shot mount effect: `if (!matchMedia('(prefers-reduced-motion:
    reduce)').matches) video.play().catch(showControl)` — **muted + loop +
    playsinline** make this policy-compliant in every evergreen browser;
    `preload="metadata"` keeps the initial payload light (the clip streams
    progressively; ~4.4 MB is acceptable as a committed hero asset).
  - **Reduced motion:** the video stays **paused** (static first frame where
    the browser paints one; otherwise the base tint + dots show) — the
    owner's "autoplay-off under reduced motion", specced as the gated
    `.play()` above; the play control (below) lets the user opt in.
  - **Play control fallback:** a 48px-target ghost button, bottom-right of
    the video block (16px insets; never overlaps the reminder's centered
    band at any tested width), translucent scrim chip
    (`color-mix(in srgb, var(--color-landing-bg) 60%, transparent)`) with an
    inline pixel play/pause glyph (§4.4 rect construction, `currentColor`,
    `--color-text-muted`, hover `--color-text`, `:focus-visible` ring).
    Visible **only when playback is not running** (paused, failed, or
    reduced-motion); hidden while playing. `aria-label`:
    `landing.video.play` / `landing.video.pause` (§4.22.H); toggles
    playback; a rejected `.play()` (autoplay blocked) reveals it.
  - **Failure degradation:** on the video `error` event the element is
    hidden — the block degrades to the **black background + the purple pixel
    treatment**: base tint = `var(--color-landing-bg)` (seamless with the
    page), the vignette, the animated dots and the reminder all keep
    running. No broken-media glyph, never a blank box, no layout shift (the
    `aspect-ratio` box is fixed before the media arrives). **No `poster`**
    (the still image is retired; the tint IS the pre/fallback state).

- **Desktop composition (≥720px) — the owner's overlay rule.** The video is
  the full common-block width; the two side blocks **overlay the video from
  their sides**, floating over the video's dark (vignette-dissolved) edges:

  ```css
  .stage { position: relative; }                       /* ≥720px */
  .video-block { position: relative; z-index: 0; }      /* in flow, full width */
  .area-lead  { position: absolute; z-index: 2; left: 0;  top: 50%;
                transform: translateY(-50%); width: 27%; }
  .area-agents { position: absolute; z-index: 2; right: 0; top: 50%;
                transform: translateY(-50%); width: 26%; }
  ```

  Widths 27% / 26% = the established §4.21.D grid columns (~26–28% band);
  both overlays are **vertically centered** on the video. The overlays sit
  above the block (z 2 > 0); the block's internal layers stay inside its own
  stacking context. The lead overlay may run slightly taller than a short
  video at the narrow desktop edge — it floats over the page background too;
  no clipping is required. The agent-card overlay's hover/press states
  (§4.20.G) are unchanged and still work over the video.
  **The chat strip on desktop:** it cannot fit under the agent card inside
  the 26% overlay (card ≈ full overlay height), so it flows **below the
  video block, right-aligned, 280px wide** (inside `.stage`, normal flow
  after the video block: `margin-left: auto; width: 280px;`) — decided
  placement, **no conflict with the reminder box** (the reminder lives
  inside the video block's bottom; the strip is below the block entirely).
  On phone the strip keeps its §4.20.K full-width slot in the same DOM
  position. Section 3 + footer are unchanged full-width rows below
  `.stage` (§4.21.D rows 2–3 carry over as plain blocks).

- **PHONE (<720px) — NO overlay; the exact stacking order (§33's phone order
  preserved; only the art block becomes the video block):** ① slimmed header
  (icon + switcher); ② headline block (centered, accent word); ③
  subheadline; ④ **Start CTA**; ⑤ **video block** (full-width 16:9 video,
  purple dots, the reminder bottom-fixed inside it, play control when
  paused); ⑥ mascot-chat strip (full-width); ⑦ agent card (BLEAK); ⑧ stat
  card; ⑨ the three step blocks (01→03 stacked); ⑩ contact footer. Same DOM
  on both breakpoints; the desktop overlay is CSS-only re-composition; no
  horizontal scroll at 320px.

#### 4.22.C Reminder-box contract migration (amends §4.21.B layer 5 / §4.21.C)

The §33/§4.21.C reminder box now lives **inside the video block,
bottom-fixed over the video** — its geometry/animation contracts carry over
**verbatim**: the retro pixel-frame (`--frame-strong`, 2px `--color-text`
border, 4px stepped notches, bg `--color-surface`), the **1 : 3.5
height:width ratio** (`aspect-ratio: 3.5 / 1; min-height: 64px`), the
Handjet centered message (16px mobile / 18px desktop), the 24px sparkle
emoji at the top-left corner (−10, −10), the ≥20px glowing pixel check at
the bottom-center, the three cycling asterisk lines (12s loop, 200ms
cross-fade, sr-only static line), and the **3s ease-in-out bob**
(translateY 0→−6px mobile / −10px desktop, transform-only; everything
collapses under `prefers-reduced-motion`).

- **Width-cap change over a full-width video (the one amendment):** on
  desktop the reminder must keep the §33.2.2 no-overlay rule **against the
  new flanking overlays** (27% + 26% of the block). The ≥720px cap becomes
  `--reminder-w: min(calc(47% - 48px), 348px)` — 47% = 100% − 27% − 26%
  (the clear center band), 48px = two 24px gutters. Verified: 888px block →
  348px (the old cap); 608px → ~238px; the reminder's x-band never enters
  either overlay's band at 720/760/1280. **Phone cap unchanged:**
  `min(100% - 32px, 256px)` — no flanking blocks exist on phone. Bottom
  inset stays 16px; `--reminder-h` stays exposed on the block (the
  video-block consumers that used it — the retired pair — are gone, but the
  variable stays for the play-control geometry if needed).
- The §4.21.B **protected central safe zone** (figures/bubble rects) is
  **retired with the still image** — the video is a moving composition and
  no static rect contract is enforceable; the owner's standing rules that
  replace it are exactly the two above (reminder bottom-fixed inside the
  block; flanking overlays cover only the side edges).

#### 4.22.D Vector → Bleak rename (landing) — item 4a

- **Card title / i18n:** `landing.agent.name` — EN `VECTOR` → **`BLEAK`**;
  RU `ВЕКТОР` → **`БЛИК`**. **RU form decision (grounded in the live dict):**
  the income mascot is already named «Блик» / "Bleak" in
  `join.wizard.agent.name` + `join.wizard.intro.title` — RU transliteration
  is the established brand handling, so the card's RU name becomes the same
  character's name («БЛИК», uppercase per the card's styling). The header
  anchor and every consumer of the key follow automatically.
- **Component/code rename:** `figures.ts` — `FigureName` `'vector'` →
  `'bleak'`; the record key and its comments renamed; **the rect data is
  UNCHANGED** (the personage art is identical — only the name changes);
  `+page.svelte` `kind="vector"` → `kind="bleak"`; all comments updated.
- **Alt text / aria labels:** the card carries no image alt (the portrait is
  `LandingFigure`, decorative by default); the header `#agents` anchor's
  accessible name = `landing.agent.name` (follows the rename). No other
  landing label names the agent.
- **Grep-audit AC:** no `vector`/`VECTOR`/`Вектор`/`ВЕКТОР` remains in the
  landing sources (`routes/+page.svelte`, `lib/components/landing/*`, both
  i18n dicts) — case-insensitive, excluding unrelated matches outside the
  landing scope (e.g. `vector-effect` in the radar).

#### 4.22.E Income surfaces — mascot swap to the Bleak personage — item 4b

**Audit (live code):** the mascots rendered on `/income*` today are ALL
`BleakMascot.svelte` (the 12×12 ghost) at exactly these mounts:

| Surface | Component | Mount |
| --- | --- | --- |
| `/income` — 6-digit entry form | `CodeEntry.svelte` | FormShell middle, mascot-at-top: `<BleakMascot size={96} idle />` |
| `/income` — room intro (create-profile / change-code choice) | `RoomPreview.svelte` | FormShell middle, mascot-at-top: `<BleakMascot size={96} idle />` |
| `/income/[room]/create` — wizard intro + steps | `CreationWizard.svelte` | two mascot rows: `<BleakMascot size={96} />` (intro) + `<BleakMascot size={112} />` (steps) |
| `/income/[room]/create` — the interviewer's chat avatar rows | `MessageBubble.svelte` via the `mascot` prop (set only by CreationWizard) | agent-bubble row: `<BleakMascot size={28} idle />` |

No other surface mounts `BleakMascot` (the main-room transcript never sets
`mascot: true` — the swap is behavior-neutral there). The import/vault
surfaces (`VaultList`, `ImportUsers`) render no mascot.

**Swap mechanism — promote/reuse, do not duplicate.** The Bleak personage
art already exists as the agent-card portrait (the `bleak` figure,
§4.22.D). It becomes the shared mascot figure:

1. **Promote the data:** move the personage's `Figure` entry (rect data
   verbatim) out of `landing/figures.ts` into a shared module (e.g.
   `lib/components/personage/bleakFigure.ts`), re-exported into
   `landing/figures.ts` as its `bleak` entry so `LandingFigure` and the
   agent card keep rendering the SAME data — one source of truth, zero art
   duplication.
2. **Re-point `BleakMascot.svelte`:** its public API is kept EXACTLY
   (`size` px height, `idle` boolean, `label` accessible name; decorative
   by default) and its body becomes a renderer of the promoted figure (the
   §4.3 rect technique / or an internal `LandingFigure kind="bleak"`
   wrapper) — the 32×32 square personage renders identically to the old
   square ghost at every mounted size, so **no geometry moves**.
3. **Idle contract amended:** the ghost's 2-frame blink no longer exists in
   the personage; `idle` now maps to the personage's established idle — the
   §4.20.J card-portrait sway (1.6s `steps(2)` ±2°, transform-origin
   50% 100%; base.css reduced-motion catch-all governs, no local override).
   `mascot.test.ts` is amended accordingly (§4.22.J).
4. **Contracts that must stay green, untouched:** §23.1.1 **no background**
   (the personage is plate-less by construction); §23.1.2/§23.1.3
   **mascot-at-top ordering** (the swap is inside the same mount slots —
   mascot → title → content order unchanged); §30 **FormShell three-block
   geometry** (the shell is untouched; content-only swap); §24–§29 wizard
   geometry (sizes kept 96/112/28 — square for square, boxes identical);
   the «Привет! Я Блик.» / "Hi! I'm Bleak." intro copy is now literally
   accurate — **no copy change**; `join.wizard.agent.name` («Блик»/"Bleak")
   unchanged.

#### 4.22.F Black page background + dissolve — item 5

- **Resolution against §4.1 (no new colors):** the landing page background
  becomes a **near-black with the video's faint violet cast**, expressed as
  ONE derived token declared in `tokens.css` (the §4.1-sanctioned place for
  derived variants):
  `--color-landing-bg: color-mix(in srgb, var(--color-deepa-4) 5%,
  var(--color-surface))` — built from the established black-family token
  (`--color-surface` #101213, the palette's near-black) with a 5% Deepa
  violet cast (the same recipe family as the §4.21.B base tint). Plain
  `--color-bg` (#1A1C20) is too light/cool to sit seamlessly against the
  clip's purple-cast black; `--color-surface` alone is neutral — the 5%
  mix is the owner's "black matching the video clip's background" without a
  new hex. **Scoped to `/` only** — every other page keeps `--color-bg`;
  the landing route paints it full-bleed (a page wrapper, `min-height:
  100dvh`, `background: var(--color-landing-bg)`) with the 1000px canvas
  centered inside.
- **The dissolve (§4.21.B adapted):** the video block's edge-fade vignette
  is kept with its outer stop re-pointed to the page token —
  `radial-gradient(ellipse 80% 78% at 50% 46%, transparent 0 52%,
  color-mix(in srgb, var(--color-landing-bg) 45%, transparent) 72%,
  var(--color-landing-bg) 100%)` — **no hard edge** at any breakpoint. The
  block's own base/fallback tint = `var(--color-landing-bg)` (invisible
  against the page until the video paints). **Defensive note:** the clip's
  exact background value is unverifiable here (no inspection tooling), so
  seamlessness is guaranteed STRUCTURALLY (the vignette dissolves every
  edge into exactly the page color) rather than by value-matching; if the
  owner wants a closer cast match, the mix ratio is a one-line tokens.css
  tweak (§4.22.K flag 3). Header icon cutouts and the play-control scrim
  consume the same token (§4.22.A/§4.22.B).

#### 4.22.G Supersessions (explicit record)

1. **The video fully replaces the still image.** The §33 drawn-scene
   composition (§4.21.B) is superseded: **`background.jpg` is RETIRED** —
   delete `apps/web/src/lib/assets/landing/background.jpg`, its `#lib`
   import, its usages and its tests (the §4.21.B asset test re-targets the
   mp4, §4.22.J).
2. **The §33 SVG hero pair retires.** **NOVA + ASTRA are removed from the
   landing** — the video carries its own cast (the boy + robot of the
   owner's art). `figures.ts`: delete the `nova` + `astra` entries and
   their `FigureName` literals (audit: referenced only by
   `LandingHeroScene.svelte` — safe; the explicit `viewW/viewH` interface
   stays, no churn). BYTE was already retired (§4.21.A). The §4.21.J-1
   ADVICE flag (SVG pair vs the image's own cast) is **resolved by this
   supersession**: the video's duo is the only hero cast; no SVG figures
   overlay the video.
3. **`LandingHeroScene.svelte` is deleted** (its only consumer is the
   landing page); the video block is the new `LandingVideoHero.svelte`
   (§4.22.B).
4. **`landing.hero.aria` is retired** with the SVG pair; the video block
   carries `landing.video.aria` (§4.22.H).
5. **The §4.21.B protected-scenario rects and the fixed 500/680px block
   heights are retired** with the still image (§4.22.B/§4.22.C replace
   them with the owner's standing overlay rules).
6. **The header taglines + the GLITCH tagline glyph are retired**
   (§4.22.A); §4.20.B's tagline specs are dead text. §4.20.J's cast table
   is amended accordingly (§4.22.I).
7. **The income mascot (the ghost) retires from the income surfaces** —
   the Bleak personage is the mascot everywhere on `/income*` (§4.22.E);
   `BleakMascot`'s ghost art is deleted with the component's re-point.

#### 4.22.H RU/EN i18n delta (on §4.20.M + §4.21.H; both dictionaries required)

| Δ | Key | RU | EN |
| --- | --- | --- | --- |
| − | `landing.tagline.left.1` | — | — |
| − | `landing.tagline.left.2` | — | — |
| − | `landing.tagline.top` | — | — |
| − | `landing.tagline.right.1` | — | — |
| − | `landing.tagline.right.2` | — | — |
| − | `landing.hero.aria` | — | — |
| ~ | `landing.agent.name` | ВЕКТОР → **БЛИК** | VECTOR → **BLEAK** |
| + | `landing.video.aria` | Видео: двое у фиолетового города под светящимся приветствием | Video: two figures before a violet city under a glowing hello |
| + | `landing.video.play` | Запустить видео | Play video |
| + | `landing.video.pause` | Поставить на паузу | Pause video |

New parity total: **35 keys** (38 − 5 taglines − 1 hero.aria + 3 video
keys). All other landing keys unchanged. The RU form of the brand follows
the live dict's established transliteration («Блик», `join.wizard.agent.name`)
— untouched there. The wizard's own keys are untouched. Parity test
amended: 35/35 in both dicts; the six dead keys exist in NEITHER.

#### 4.22.I Mascot cast update (amends §4.20.J)

| Figure | Where | Status |
| --- | --- | --- |
| NOVA | was hero scene, left | **RETIRED** (§4.22.G) |
| ASTRA | was hero scene, right | **RETIRED** (§4.22.G) |
| BYTE | — | retired (§4.21.A) |
| **BLEAK** (ex-VECTOR) | agent-card portrait **+ the income-forms mascot** (§4.22.E — promoted shared personage) | renamed, art unchanged |
| BLOOM | stat-card glyph | unchanged |
| PIP | mascot-chat strip, left | unchanged |
| GLITCH | mascot-chat strip, right | unchanged (the header tagline-glyph slot died with the taglines — the strip is now GLITCH's only appearance) |

Landing cast = four figures (BLEAK, BLOOM, PIP, GLITCH); no figure appears
twice on the page.

#### 4.22.J Acceptance criteria (checkable)

**Header (item 1):**
1. The `/` header renders exactly: the web icon (the §30 FormShell mark,
   plate-less, cutouts in `--color-landing-bg`), the two in-page anchors
   (`#tutorial`, `#agents` — ≥720px only) and the LocaleControl; the
   LocaleControl still switches every landing string without a reload.
2. No tagline text renders anywhere on `/` (left pair, top-center line,
   right pair — no DOM nodes); the GLITCH figure appears only inside the
   mascot-chat strip; the header carries no START control.
3. At 320px the header is icon + switcher (no horizontal scroll, nothing
   clipped); the phone header is never empty.

**Video block (items 2/3/6):**
4. The committed app asset `apps/web/src/lib/assets/landing/background-video.mp4`
   exists and is imported via the `#lib` URL import (not hotlinked, not in
   `static/`); the source-level test asserts both (the §4.21.B jpg-test
   pattern re-targeted); `make build` emits the mp4 into the client build
   (CI-verified).
5. The video block spans the full common-block width with
   `aspect-ratio: 16/9` (height derives from the width — no fixed 500/680px
   height remains), `object-fit: cover`, and renders `muted loop playsinline
   preload="metadata" disablepictureinpicture` with NO `autoplay` attribute
   and NO native `controls`.
6. Autoplay is gated: with `prefers-reduced-motion: reduce` the video does
   not start (stays paused); without it, playback starts on mount via the
   one-shot gated `.play()`.
7. The play control: visible when playback is not running (reduced-motion,
   autoplay-blocked, or user-paused) with the play label
   (`landing.video.play`), hidden while playing, toggles playback, 48px
   target, focus ring, never overlapping the reminder's band at
   320/390/1280.
8. Failure degradation: with the video source failing/erroring, the block
   shows the `--color-landing-bg` base tint + the animated purple dots + the
   reminder — no broken-media glyph, no blank box, no layout shift.
9. Desktop ≥720px (test 1280×800 and 760px): the lead block overlays the
   video's LEFT edge (absolute, left 0, vertically centered, 27% width) and
   the agent card overlays the RIGHT edge (right 0, vertically centered,
   26% width); both sit above the video (z-order); the chat strip sits
   below the video block, right-aligned, 280px wide. No horizontal scroll.
10. Phone <720px (test 320×640 and 390×844): NO overlay — the exact stack
    is header → headline → sub → Start → video block → chat strip → agent
    card → stat card → three step blocks → contact footer; the video is
    full-width; no horizontal scroll at 320px.
11. The animated purple pixels animate over the video (the kept 12-dot
    mesh, steps(2) twinkle, staggered; static under reduced motion).
12. `background.jpg` is gone: the asset file, its import, its usages and
    its tests no longer exist; NOVA/ASTRA rect data and `nova`/`astra`
    literals no longer exist in `figures.ts`; `LandingHeroScene.svelte` no
    longer exists.

**Reminder contracts (item 3):**
13. The reminder box lives inside the video block, absolute, bottom 16px,
    centered; ratio 1:3.5 at 320/390/1280 (measured width per the caps:
    ~256px phone, ≤348px desktop); Handjet centered text, top-left sparkle
    emoji, ≥20px glowing check, 3s ease-in-out bob (−6px/−10px), 3-line
    cycle + sr-only line — all verbatim §4.21.C; static under reduced
    motion.
14. Desktop: the reminder never overlays the flanking lead/agent overlays
    (the 47%−48px center-band cap holds at 720/760/1280); phone: it stays
    within the block's padding box (16px side insets).

**Bleak rename + income mascot swap (item 4):**
15. The agent card renders the BLEAK personage with `landing.agent.name` =
    "BLEAK" (EN) / «БЛИК» (RU), swapping live with the locale switch; the
    personage's rect data is byte-identical to the pre-rename VECTOR art.
16. Grep-audit: no `vector`/`VECTOR`/`Вектор`/`ВЕКТОР` in
    `routes/+page.svelte`, `lib/components/landing/*`, or either i18n dict
    (landing-scope case-insensitive).
17. Every `/income*` mascot mount (CodeEntry 96, RoomPreview 96,
    CreationWizard 96 + 112, MessageBubble mascot rows 28) renders the
    Bleak personage (the promoted shared figure) — the ghost art appears
    nowhere on `/income*`.
18. The swap is content-only: FormShell three-block geometry, the §23
    mascot-at-top order, the §24–§29 wizard contracts and the no-background
    rule are unchanged; `join.wizard.agent.name`/intro copy unchanged
    («Блик»/"Bleak"); the main-room transcript is unaffected.
19. The personage data has ONE source (the promoted shared module consumed
    by both the landing card and `BleakMascot`); `BleakMascot`'s public API
    (size/idle/label, decorative default) is unchanged, with `idle` =
    the 1.6s steps(2) ±2° sway.

**Black background + dissolve (item 5):**
20. The landing page paints `--color-landing-bg`
    (`color-mix(in srgb, var(--color-deepa-4) 5%, var(--color-surface))`,
    declared in tokens.css) full-bleed on `/`; every other page keeps
    `--color-bg`; no new hex anywhere (the sweep stays green).
21. At every tested width the video's edges dissolve into
    `--color-landing-bg` (the radial vignette) — no hard edge line where
    the video meets the page background; the pre-load/fallback state is
    seamless with the page.

**Carried contracts:**
22. The three step blocks (§4.21.E), the compact stat card (§4.21.F), the
    contact footer (§4.21.G), the headline block + accent word + Start CTA
    (§4.20.C) render unchanged; Start CTA and agent-card TALK navigate to
    `/income`; the tab bar is not rendered on `/`; deep links forward
    unchanged.
23. The mascot-chat strip keeps its §4.20.F behavior (4 alternating
    typewriter turns, infinite loop, reduced-motion static) in its new
    desktop slot (below the video, right-aligned) and its unchanged phone
    slot.
24. i18n: exactly **35** `landing.*` keys in BOTH dictionaries;
    `landing.tagline.*` (5) and `landing.hero.aria` exist in NEITHER; the
    extended parity test is green.
25. Suites amended and green: `landing-page.test.ts` (header/video/supersession
    ACs above), `mascot.test.ts` (personage art + sway idle + the four
    mounts), `i18n.test.ts` (35-key parity + dead keys), `join-flow.test.ts`
    / `creation-wizard.test.ts` (mascot mounts via FormShell), `sweep.test.ts`
    (token discipline incl. the one derived tokens.css declaration);
    `make lint && make test && make build` green; no new dependencies, no
    canvas, no animation library.

#### 4.22.K Flags for the owner / concept (concept report)

1. **ADVICE NEEDED — header START control removed:** the owner's keep-list
   ("only the web icon, the navigation, and the language switcher") omits
   the header START pill/link, so §4.22.A removes them; the `/income`
   entry points become exactly the lead Start CTA + the card TALK (§4.21.G
   made exact). If the owner wanted the header START kept, it is a
   two-element restore.
2. **ADVICE NEEDED — phone reminder proportion over a short video:** a
   16:9 video at phone width is ~150–200px tall, so the verbatim §33
   reminder (256×73px + bob) covers a larger share of the frame than it
   did over the 500px art block. The verbatim geometry is kept per the
   owner's standing contract; if the owner prefers, the phone cap is a
   one-token reduction (or a taller phone block — rejected here as
   defensive: cover-cropping the unknown framing could cut the scene).
3. **ADVICE NEEDED — background value matching:** the clip's exact
   background color is unverifiable in this sandbox (no video tooling), so
   seamlessness is structural (vignette → `--color-landing-bg`), with the
   5% violet cast as the best token-only estimate of the clip's purple
   black. The mix ratio is a one-line tokens.css tweak if the owner wants
   it closer.
4. **RU brand form:** resolved from the live dict («Блик», the wizard's
   established transliteration) — recorded per the caller's "be explicit";
   a Latin "BLEAK" in RU is a one-value change if preferred.

### 4.22.1 owner amendment (2026-11-22, Concept §34 record): chat-strip retirement

Owner order (2026-11-22, recorded in Concept.md §34): the mascot-chat
animation strip — the §32 PIP↔GLITCH pixel-message exchange, placed per
§4.20.F / §4.22.B below the video block, right-aligned 280px on desktop and
full-width on phone — is **RETIRED** from the center pixel-art composition:
the video's own cast (the boy + robot inside the video) is the only animated
center content on `/`. This supersedes the §4.20.F strip spec and the
§4.22.B strip-flow placement decision (desktop grid row 2 slot included),
and resolves the §32 mascot-chat requirement by owner order; the strip
component (`LandingChatStrip.svelte`), its timeline module
(`chatTimeline.ts`), the PIP/GLITCH figure data, the `landing.chat.*` i18n
keys (both dictionaries), their tests and their style/markup hooks are
deleted — pure subtraction, nothing replaces it, no redesign; the `.stage`
DOM order shrinks to lead → video block → agent card. All other contracts
(reminder box, purple pixel treatment, Start/TALK → `/income`, header
keep-list, BLEAK/БЛИК naming, three step blocks, contact footer, black
landing-bg + dissolve, RU/EN parity) are unchanged.

### 4.23 v3.17 feature design (2026-11-22, owner-approved Concept §35): §35 full-screen video background + liquid-glass header + reminders removed

The owner reviewed the video hero and issued the three-item §35 batch: the
video becomes a **full-screen fixed background** the whole page scrolls over,
the header becomes a **liquid-glass panel** (frosted translucent, backdrop
blur, rounded corners), and the **agent reminders are removed entirely**.
This section amends §4.22 (→ §4.21 → §4.20) item by item; **where §4.23 is
silent, the earlier specs stand EXCEPT where §4.23.E explicitly supersedes
them** (cards §4.20.G/§4.21.F, step blocks §4.21.E, contact footer §4.21.G,
headline block + Start CTA §4.20.C, behavior §4.20.L, motion/a11y baselines
§4.20.L/§4.6 all carry over unchanged). Same sandbox constraint as §4.22:
**no video-inspection tooling exists** (no ffmpeg; the mp4 is not viewable
here) — every frame-dependent choice is specced defensively; the video asset
is already committed (`apps/web/src/lib/assets/landing/background-video.mp4`,
16:9, ~4.4 MB, near-black background) and **stays untouched**. Grounded in
the live code: `apps/web/src/routes/+page.svelte`,
`lib/components/landing/LandingVideoHero.svelte`,
`LandingReminder.svelte`, `figures.ts`, `lib/styles/tokens.css`,
`tests/landing-page.test.ts`. Hard constraints unchanged: **no new
dependencies** (`backdrop-filter` is native CSS — fine), **no new color
values** (§4.1 — tokens or `color-mix` alpha variants only; the black
`--color-landing-bg` token family is unchanged), **no canvas, no animation
library**, **routes untouched**, **/income surfaces untouched**, the video
asset stays. **API endpoints used: none** — the landing stays fetch-free
(§4.20 preamble); the only states are media states (§4.23.G). Task:
tz12-07 (`feature/9659161e-tz12-07-video-background`).

#### 4.23.A Fixed full-viewport video background — the layer architecture (item 1)

The video covers the **whole device screen** — full-viewport,
`object-fit: cover`, `position: fixed` (inset 0), **independent of
scrolling**; ALL landing blocks scroll over it as overlays of the video
background. The §4.22.B "center video block" (the `.stage` aspect-ratio
block with flanking absolute overlays) is **retired**; §4.23.E records the
supersessions.

**Component decision — `LandingVideoHero.svelte` is REPURPOSED, not
replaced.** It already owns the video element, the decisive §34 attribute
set, the purple-dot mesh, the vignette and the error fallback — it is
rebuilt in place as the fixed background layer (its reminder import and its
play control are deleted, §4.23.C; its `<section aria-label>` root becomes a
decorative `<div>` root, aria-hidden, with NO props — `aria`,
`playLabel`, `pauseLabel`, `lines`, `srLine` all removed). The component
moves OUT of the content flow: it renders as the **first child of
`.landing-page`**, before `.landing`, as a fixed layer.

**Fixed layer stack (bottom → top), all `position: fixed; inset: 0;`
pointer-events none except none needed:**

1. **z 0 — the `<video>`**: `width: 100%; height: 100%;
   object-fit: cover; object-position: 50% 50%;`. With `cover` the video
   fills ANY viewport aspect ratio (it crops, never letterboxes: portrait
   phone viewports crop the clip's left/right, ultrawide crops
   top/bottom — the center-anchored `object-position` keeps the scene's
   cast in frame). The §34 attribute set is kept **verbatim**: `muted loop
   playsinline preload="metadata" disablepictureinpicture aria-hidden` —
   no `autoplay` attribute, no native controls. Playback starts from the
   existing ONE-SHOT mount effect, still gated on `prefers-reduced-motion`
   (no call under reduce → the video stays paused at its first frame);
   muted + loop + playsinline keep the programmatic start
   policy-compliant. A rejected `.play()` is swallowed (the tint + vignette
   + dots state shows; there is no control to reveal — §4.23.I flag 1).
2. **z 1 — the dissolve vignette (re-specified for a fixed full-screen
   layer):** the fixed `::after` of the layer,
   `radial-gradient(ellipse 120% 105% at 50% 50%, transparent 0 55%,
   color-mix(in srgb, var(--color-landing-bg) 55%, transparent) 78%,
   var(--color-landing-bg) 100%)`. Every viewport edge dissolves into
   exactly `--color-landing-bg` — **no hard edge where the video meets the
   black page background at any viewport ratio**. The §4.22.F rationale is
   corrected for the fixed layer: with `cover` there is no letterbox edge
   to hide on any aspect ratio, so the vignette's job is the **smooth
   dissolve mood + edge darkening** (it also darkens the zone under the
   floating glass panels); seamlessness stays STRUCTURAL (dissolve into the
   page token), not value-matched — the clip's exact background value
   remains unverifiable here (§4.22.K flag 3 carries over). **The black bg
   token stays:** `.landing-page` keeps painting
   `background: var(--color-landing-bg)` full-bleed — it is what shows
   through the dissolve, under the reduced-motion state and under the
   error fallback. Plus the **global legibility tint**: the same fixed
   vignette element carries a base wash,
   `background-color: color-mix(in srgb, var(--color-landing-bg) 30%,
   transparent)` (a uniform 30% darkening over the video for mood + a
   first legibility pass; text-level legibility is guaranteed per-section,
   §4.23.D).
3. **z 2 — the animated purple pixels, KEPT as a fixed overlay layer above
   the video, below the content.** Decision: KEEP (the owner has
   consistently kept the dot treatment through §33 item 7 and §34 item 6 —
   it does not read as noise over the near-black clip; it IS the page's
   signature sparkle in the "sky" between sections). The §4.21.B mesh is
   kept verbatim (the same 12 `DOTS` table, three `--color-deepa-4` alpha
   shades 18/35/60%, `steps(2)` twinkle 1.6s, staggered 0–1.2s delays,
   `aria-hidden`, `pointer-events: none`); its percent positions now map to
   the FULL VIEWPORT (breakpoint-independent, so no table change); dots
   near the viewport edges sit over the vignette and behind content cards —
   visible only in the gaps between sections and over raw-over-video zones,
   which is the intended "ambient sky" read.
4. **z 3 — the content column** `.landing` (the scrolling page content —
   §4.23.D).
5. **z 10 — the sticky glass header** (§4.23.B), above the content.

**Scroll-over architecture.** The page content is a **normal scrolling
column above the fixed layer**: `.landing-page` keeps
`min-height: 100dvh` + the token background; `.landing` gains
`position: relative; z-index: 3` (the 1000px canvas, its `--space-5/--space-7`
padding and its `--space-6` gap rhythm are unchanged). The document scrolls;
the video layer does not move. No horizontal scroll at 320px (unchanged
§4.20.K invariant). Because the fixed layer is `pointer-events: none`
(vignette + dots) with the video beneath, all content interaction is
unaffected.

#### 4.23.B Liquid-glass header (item 2)

The header becomes a **floating rounded glass panel** — frosted translucent
glass over the video. Keep-list **UNCHANGED (§4.22.A verbatim)**: web icon +
nav anchors + language switcher only; no START control; phone = icon +
switcher only.

- **Geometry — floating chip with insets (modern liquid-glass practice),
  sticky at top:** the `<header class="top">` wrapper becomes the glass
  panel: `position: sticky; top: var(--space-3)` (12px — the video shows in
  the gap above it when scrolled), `z-index: 10` (above the content
  column's z 3, over the video),
  `width: min(100% - 24px, calc(1000px - 48px))`, `margin-inline: auto`
  (side insets 12px; on wide viewports the panel aligns to the 1000px
  canvas minus its padding). Desktop (≥720px) padding `10px 16px`,
  min-height 56px (unchanged row height); phone padding `8px 10px`,
  min-height 52px, and the panel is the smaller chip (icon + switcher only,
  §4.22.A).
- **Rounded corners — the owner explicitly orders rounded here, scoped to
  glass surfaces only:** `border-radius: var(--radius-lg)` (24px) on
  desktop, `var(--radius-md)` (20px) on the smaller phone chip — both
  existing tokens, no new value. The established pixel style's square /
  stepped corners (§4.5) remain the rule for every pixel-frame card, the
  step blocks and the footer; **the rounded corner is the glass-surface
  exception** (header panel + the lead panel, §4.23.D — the two liquid-glass
  surfaces), not a general restyle.
- **The glass recipe (exact values):**
  ```css
  .top {
    background: color-mix(in srgb, var(--color-landing-bg) 92%, transparent);
    -webkit-backdrop-filter: blur(14px) saturate(1.1);
    backdrop-filter: blur(14px) saturate(1.1);
    border: 1px solid color-mix(in srgb, var(--color-deepa-4) 22%, transparent);
    border-radius: var(--radius-lg); /* 20px on the phone chip */
  }
  ```
  — translucent fill via `color-mix` of the black token family
  (`--color-landing-bg` at 92%), blur radius 14px with a mild 1.1
  saturation lift, and a subtle violet hairline border per the pixel
  aesthetic (all token-only, §4.1).
- **AA note (the fill must stay dark enough):** header text = the nav
  anchors (`--color-text-muted`) and the LocaleControl labels. Worst-case
  bound, no blur assumed: a pure-white video pixel behind the 92% fill
  composites (in sRGB space) to ≈ #232527 — the muted text holds
  ≈ 5.0:1 (AA ≥ 4.5); with `blur(14px)` the real local average is the
  clip's near-black, well above that. The 92% ratio is therefore the floor:
  do not lower it for translucency. `@supports` fallback: where
  `backdrop-filter` is unsupported the fill alone still guarantees the same
  worst-case contrast — the panel just reads near-solid. The panel's own
  hairline is decorative (non-text, ≥3:1 not required; it also carries the
  22% violet over the dark fill visibly).
- **Stacking vs the fixed video:** the panel is above the content column
  and above the video layer (z 10 > 3 > 2 > 1 > 0) — glass over video,
  content scrolls under the stuck panel (which stays glass over the video
  at every scroll position). Anchor targets keep working: `#tutorial` and
  `#agents` gain `scroll-margin-top: 80px` so an anchored section never
  hides under the stuck glass panel.
- The header icon's cutout cells keep their `--color-landing-bg` fill —
  over the 92% glass fill they read as the panel itself (no visual glitch,
  zero churn; §4.22.A's dissolve intent is inherited by the panel).

#### 4.23.C Remove the agent reminders ENTIRELY (item 3)

The §33 item 2 reminder contracts are **RETIRED** — pixel-font message,
1:3.5 strip, emoji corner, bottom-fixed position, up-down bob, check mark:
**all go** (§4.23.E records the explicit supersessions of §4.21.C and
§4.22.C). Pure subtraction, nothing replaces it:

- **Delete the component:** `lib/components/landing/LandingReminder.svelte`
  (file, markup, styles, its `spark`/`check` glyphs, the
  `reminder-bob`/`reminder-line`/`spark-twinkle`/`check-glow` keyframes).
- **Delete its integration:** the `LandingReminder` import + mount in
  `LandingVideoHero.svelte`; the `lines`/`srLine` props (and then the whole
  Props interface — §4.23.A); the `--reminder-w`/`--reminder-h` custom
  properties and the `.video-block :global(.reminder)` z-index rule and the
  play-control phone `bottom: calc(16px + var(--reminder-h))` rule (the
  control retires too); in `+page.svelte` the `dialogLines` derivation
  (`landing.dialog.line1/2/3`) and the `videoAria`/`videoPlay`/`videoPause`
  derivations (§4.23.F).
- **Key audit (live grep, both dicts):** there is **no
  `landing.reminder.*` family** — the reminder's copy lives in
  **`landing.dialog.line1`, `landing.dialog.line2`, `landing.dialog.line3`**
  (en.ts/ru.ts ~417–419). Those three keys are the reminder family and are
  removed from BOTH dictionaries. With the play control retired and the
  video layer decorative, **`landing.video.aria`, `landing.video.play`,
  `landing.video.pause`** are also removed (§4.23.F). No other landing key
  references the reminder.
- **Delete its tests:** the `landing-page.test.ts` reminder block (the
  named-region/inside-the-block test, the 1:3.5 proportions + caps test,
  the no-overlay center-band test, the pixel-font test, the cycling-copy
  test, the sparkle-emoji test, the check-mark test, the bob test, the
  play-control-never-overlaps test) and every `landing.dialog.*` /
  `landing.video.*` assertion in the parity/dead-key/copy-verbatim/re-render
  tests — replaced by §4.23.H's negative assertions + key-cleanup
  assertions. All other suites stay green.

#### 4.23.D Content sections over the video (per-section treatment)

The content column (`.landing`, z 3) stacks, in the existing DOM order,
with the `.stage` grid retired to a plain flow container:

1. **Glass header panel** (§4.23.B) — the only chrome; glass over video.
2. **Lead section (headline + subheadline + Start CTA, §4.20.C verbatim) —
   a liquid-glass panel.** Decision: the lead text block gets the SAME
   glass treatment as the header (same fill/blur/hairline recipe,
   `border-radius: var(--radius-lg)`, padding 20px phone / 28px desktop).
   Rationale (the legibility decision §35 demands): raw muted body text
   over an arbitrary bright video region cannot be guaranteed AA at any
   tolerable global tint (a worst-case white pixel needs ≈90% darkening,
   which kills the video); a local glass panel guarantees it with the same
   92% recipe (≈5:1 muted worst-case, §4.23.B math). The panel sizes to its
   content (`width: fit-content`, max-width 560px), aligned left on desktop
   (≥720px, per §4.20.C's left alignment) and full-width-ish centered on
   phone. This is the second (and last) rounded-corner surface — rounded
   corners stay scoped to glass surfaces.
3. **BLEAK agent card (§4.20.G-b as renamed §4.22.D) — UNCHANGED pixel
   frame, floating.** Decision: NO glass on the cards — the established
   `pixel-corners pixel-frame pixel-frame--strong` + `--color-surface`
   opaque body is already self-legible over any video content and is the
   page's pixel identity; glass there would erode the pixel language. The
   card's §4.20.G contract (hover lift + glow, press scale, focus rings)
   carries over verbatim; it simply floats over the video.
4. **The three step blocks (§4.21.E) — UNCHANGED, floating.** FIND / CHAT /
   SHARE keep their §4.21.E contracts verbatim (pixel step number, pixel
   title, step icon, mini description; phone stacked top→bottom, desktop
   left→right equal thirds, ~300px min-height, no hover/press/motion);
   opaque `--color-surface` bodies (no glass) read over the video as-is.
5. **Contact footer (§4.21.G) — UNCHANGED, floating.** The pixel-framed
   site contact block keeps its §4.21.G contract verbatim (copyright row +
   EMAIL/GITHUB links, centered, max-width 560px); opaque surface body, no
   glass.
6. **Stat card (§4.21.F compact) — UNCHANGED, floating** (§4.20.G-a as
   compacted; sits between the agent card and the steps, same DOM order).

**Desktop composition (≥720px):** lead panel and agent card share one
plain-flow two-column row (`.stage` becomes
`display: grid; grid-template-columns: minmax(0, 1fr) 360px;
column-gap: var(--space-6); align-items: start` — the lead panel in column
1, the agent card capped at 360px in column 2), the stat card full-width,
then the steps grid, then the footer. **Phone (<720px):** everything
stacks in the same DOM order — header chip → lead panel → agent card →
stat card → three step blocks → contact footer (the §34 phone no-overlay
rule is moot: everything overlays the fixed video background now,
§4.23.E). The section rhythm (`--space-6` gaps) is unchanged; the video +
dots show through the gaps between sections — the scroll-over "sky".

**Unchanged behavior contracts:** BLEAK/БЛИК naming (§4.22.D), the income
mascot swap (§4.22.E), Start CTA + agent-card TALK → `/income` as the
exactly two entry points (§4.22.A/§4.20.L), the join deep-link forwarding
(`?code=` / `?u=`, §3.1 guard), the tab bar absent on `/`, RU/EN
switching without reload — all verbatim.

#### 4.23.E Supersessions (explicit record)

1. **§4.22.B "center video block" geometry superseded:** no `.stage`
   aspect-ratio video row; the 27%/1fr/26% lead/art/agents overlay grid is
   retired — blocks are now plain scroll-over sections above the fixed
   full-viewport layer (§4.23.A/§4.23.D). The 16:9 `aspect-ratio` box, its
   ~500px desktop height and the flanking absolute-overlay CSS are gone.
2. **§34 phone no-overlay rule superseded:** EVERYTHING overlays the video
   background now — there is no video "block" to stack around; the phone
   stack is the §4.23.D list, not a video-block sandwich.
3. **§33 item 7 rules MOOT:** the protected-centered-scenario rects and the
   art-block height contracts died with the still image (§4.22.G) and have
   no successor — there is no art block; the video is the background.
4. **§4.21.C/§4.22.C reminder contracts superseded** by §4.23.C's full
   retirement (§35 item 3) — the 1:3.5 strip, pixel message font, emoji
   corner, bottom-fixed position, bob, check mark and the §4.22.C width
   caps / no-overlay band all cease.
5. **§4.22.B play control superseded:** the floating play/pause ghost chip
   retires with the video-as-content model — the video is now aria-hidden
   ambient background scenery, not a content surface with playback state
   (§4.23.A; §4.23.I flag 1 records it as restorable).
6. **`landing.video.aria` named-region superseded:** the fixed layer is a
   decorative `aria-hidden` div — no region role, no accessible name
   (§4.23.F).
7. **§4.22.F vignette rationale amended** (not superseded): the dissolve is
   re-specced for the fixed full-screen layer (§4.23.A layer 2); the token,
   its declaration site and the structural-seamlessness principle stand.
8. **Superseded-but-carried:** the §4.22.B decisive video attribute set,
   the gated one-shot mount `.play()`, the error-fallback structure, the
   kept 12-dot mesh and the §4.22.A header keep-list all CARRY into
   §4.23.A/§4.23.B unchanged.

#### 4.23.F RU/EN i18n delta (grep-audited; both dictionaries required)

Pure subtraction — **no new keys** (nothing new is spoken: the header is a
landmark with existing key names; the fixed layer is `aria-hidden`;
the glass panels carry existing copy):

| Δ | Key | RU | EN |
| --- | --- | --- | --- |
| − | `landing.dialog.line1` | * Агент здоровается… | * The agent says hello… |
| − | `landing.dialog.line2` | * Ваш агент уже нашёл три совпадения. | * Your agent already found three matches. |
| − | `landing.dialog.line3` | * Совпадение принято. Обмен контактами через минуту. | * Match accepted. Contact exchange in a minute. |
| − | `landing.video.aria` | Видео: двое у фиолетового города… | Video: two figures before a violet city… |
| − | `landing.video.play` | Запустить видео | Play video |
| − | `landing.video.pause` | Поставить на паузу | Pause video |

New parity total: **29 keys** (35 − 3 dialog − 3 video). Grep audit before
removal (live): `landing.dialog.*` appears only in `en.ts`/`ru.ts`
(~417–419), `+page.svelte` (79–82) and `landing-page.test.ts`
(79–82/470–476/898); `landing.video.*` only in the dicts (~420–422),
`+page.svelte` (74–76) and the tests (82–84/274–291/588–593/863–905);
`LandingReminder` only in `LandingVideoHero.svelte` (import + mount) and
the tests; `--reminder-` only in `LandingVideoHero.svelte` +
`LandingReminder.svelte`. After the change: no `landing.dialog.` or
`landing.video.` match remains in either dict, any route, any component or
any test; the dead-key lists in `landing-page.test.ts`/`i18n.test.ts`
extend by these six. Parity test amended: 29/29 in both dicts; the six
dead keys exist in NEITHER.

#### 4.23.G Reduced motion + media states

- **Reduced motion (`prefers-reduced-motion: reduce`):** the video shows
  **NO motion** — decision: keep the video element **paused at frame 0**
  (the mount effect skips `.play()` entirely, unchanged gate) **+ the black
  tint layer** (the 30% wash + the vignette over `--color-landing-bg`;
  where the browser paints no first frame from `preload="metadata"`, the
  tint + vignette + dots ARE the static state — the same near-black the
  §35 fallback names). No opt-in control exists (§4.23.E.5). The dot
  twinkle collapses to static base opacity (the established
  base.css/§4.6 catch-all; no local override). Everything else on the page
  is already reduced-motion-safe (cards/steps/footer have no ambient
  motion).
- **Loading state:** none beyond the established pattern — `preload=
  "metadata"` keeps the payload light; before the first frame paints the
  fixed layer shows the tint + vignette + dots (seamless with the page —
  the tint IS the pre-state; no poster, no skeleton, no layout shift: a
  fixed layer cannot shift layout).
- **Error state:** on the video `error` event the element is hidden — the
  fixed layer degrades to the **static near-black + purple pixel
  treatment** (the `--color-landing-bg` page token + the vignette wash +
  the dots). No broken-media glyph, never a blank screen, no layout shift;
  the content column is unaffected. No retry UI (ambient scenery; a reload
  remounts).
- **Empty state:** not applicable — the landing fetches nothing
  (§4.20.L); no data states exist.

#### 4.23.H Acceptance criteria (checkable)

**Fixed video background (item 1):**
1. The committed asset `apps/web/src/lib/assets/landing/background-video.mp4`
   is still imported via the `#lib` URL import by the (repurposed)
   `LandingVideoHero.svelte` — not hotlinked, not in `static/`, the file
   itself untouched.
2. The video layer is `position: fixed; inset: 0` (z 0, first child of
   `.landing-page`), full-viewport with `width/height: 100%` +
   `object-fit: cover` + `object-position: 50% 50%` — verified at desktop
   (1280×800) and phone (320×640, 390×844) viewports: the video fills the
   whole screen at every ratio, no letterbox bars.
3. The video is independent of scrolling: at every scroll offset the video
   layer stays viewport-sized and unmoving while `.landing` scrolls over it
   (`position: fixed` assertion; the page scrolls normally, no horizontal
   scroll at 320px).
4. The attribute set is verbatim: `muted loop playsinline
   preload="metadata" disablepictureinpicture aria-hidden` — no `autoplay`
   attribute, no native `controls`; playback starts from the one-shot
   mount effect (no `.play()` under reduced motion — AC 15).
5. The layer stack holds: video (z 0) → vignette + 30% tint (z 1) → dots
   (z 2) → content column (z 3) → sticky header (z 10); the 12-dot mesh
   animates over the full viewport (steps(2), staggered; static under
   reduced motion) and sits below the content (never above a card).
6. The dissolve: at every tested viewport the layer's edges dissolve into
   `--color-landing-bg` (the radial vignette + the token page background) —
   no hard edge where the video meets the black page background; the
   `--color-landing-bg` token declaration in tokens.css is unchanged.
7. Error fallback: with the video source failing, the layer shows the
   near-black tint + vignette + dots — no broken-media glyph, no blank
   screen, no layout shift; the content column is unaffected.

**Liquid-glass header (item 2):**
8. The header renders as a floating glass panel: computed styles assert
   `backdrop-filter`/`-webkit-backdrop-filter` blur(14px), the fill
   `color-mix(in srgb, var(--color-landing-bg) 92%, transparent)`, the
   violet hairline `color-mix(in srgb, var(--color-deepa-4) 22%,
   transparent)`, and the rounded corners — `border-radius` resolves to
   24px (`--radius-lg`) at 1280px and 20px (`--radius-md`) at 320/390px
   (class-assertable via the panel element's computed border-radius).
9. The panel is sticky: at 12px from the viewport top with `z-index` above
   the content column; the keep-list is UNCHANGED (§4.22.A): exactly the
   web icon, the two desktop-only anchors and the LocaleControl; phone =
   icon + switcher; no START control; the LocaleControl still switches
   every landing string without a reload.
10. Rounded corners stay scoped: the glass header panel (+ the lead
    panel, AC 12) are the only rounded surfaces — every pixel-frame card,
    step block and the footer keep the square/stepped corner treatment
    (no `border-radius` on them beyond the existing pixel construction).

**Reminders removed (item 3):**
11. Negative assertions: no `.reminder` DOM node, no
    `LandingReminder.svelte` file, no `LandingReminder` import, no
    `reminder-bob`/`reminder-line`/`spark-twinkle`/`check-glow` keyframes,
    no `--reminder-w`/`--reminder-h` custom properties anywhere in the
    landing sources; no reminder copy renders anywhere on `/`.
12. The lead panel (glass, §4.23.D) carries the §4.20.C headline +
    accent word + subheadline + Start CTA verbatim; Start → `/income`.

**Content over the video (carried contracts):**
13. Desktop ≥720px: the lead panel (column 1) and the agent card
    (column 2, 360px cap) share one plain-flow row; the stat card, the
    three step blocks (equal thirds, ~300px min-height) and the contact
    footer follow as full-width rows — all scrolling over the fixed video;
    no horizontal scroll at 320/760/1280.
14. Phone <720px: the stack is header chip → lead panel → agent card →
    stat card → three step blocks (01→03) → contact footer, in DOM order,
    all over the video background.
15. Reduced motion: the video does not start (stays paused at frame 0 or
    shows the tint); the dots are static; no other motion changes.

**i18n + suites:**
16. i18n: exactly **29** `landing.*` keys in BOTH dictionaries;
    `landing.dialog.line1/2/3` and `landing.video.aria/play/pause` exist in
    NEITHER dict, no route, no component, no test (grep-audited); the
    extended parity test is green; RU/EN parity holds for every remaining
    string (switch re-renders the page without a reload).
17. Suites amended and green: `landing-page.test.ts` (reminder +
    block-geometry + play-control + video-region assertions dropped or
    updated per this section), `i18n.test.ts` (29-key parity + dead keys),
    `sweep.test.ts` (token discipline — no new hex, the color-mix recipes
    only), `join-flow.test.ts`/`creation-wizard.test.ts` (untouched —
    /income surfaces unchanged), `mascot.test.ts` (untouched);
    `make lint && make test && make build` green; no new dependencies
    (`backdrop-filter` is native CSS), no canvas, no animation library;
    routes untouched; the video asset stays.

#### 4.23.I Flags for the owner / concept (concept report)

1. **ADVICE NEEDED — the play/pause control retires:** §4.22.B's gated
   play chip existed because the video was a content block; as fixed
   aria-hidden background scenery (§35's own framing) a playback control
   over the whole page is chrome the owner did not ask for, and §35's
   reduced-motion contract ("static black/near-black, no video motion")
   no longer contemplates user-driven playback — so §4.23.E.5 retires it
   with its three i18n keys. Restoring it is one floating glass chip
   (bottom-right, the §4.22.B pattern) + the three keys back.
2. **ADVICE NEEDED — glass lead panel:** §35 orders glass for the header
   explicitly; §4.23.D extends the same glass treatment to the lead text
   block as the legibility decision (raw muted text over an arbitrary
   bright video region cannot be guaranteed AA at any tolerable global
   tint). If the owner prefers the lead raw over the video, the fallback
   is a heavier fixed tint (~90% globally — the video then reads as a
   faint ambient texture only).
3. **Background value matching (§4.22.K flag 3, carried):** the clip's
   exact background color remains unverifiable in this sandbox; the
   dissolve stays structural (vignette → `--color-landing-bg`), and the
   5% violet cast in the token stays the best token-only estimate.

### 4.24 v3.18 feature design (2026-11-22, owner-approved Concept §36): §36 80% widths + opaque narrower lead + thirds layout + phone open state

The owner reviewed the video-background landing and issued the four-item §36
batch: the header and the whole page content are constrained to **80% of the
screen width** (centered), the lead block becomes **fully opaque and
narrower**, the desktop composition becomes a **thirds row** (lead / empty /
agent), and on **phones the site opens with the top two-thirds showing no
content blocks** — pure video under the floating header. This section amends
§4.23 (→ §4.22 → §4.21 → §4.20) item by item; **where §4.24 is silent, the
earlier specs stand** except where §4.24.F explicitly supersedes them (the
video layer stack §4.23.A, the keep-list §4.22.A, cards §4.20.G/§4.21.F, step
blocks §4.21.E, contact footer §4.21.G, headline copy + Start CTA §4.20.C,
behavior §4.20.L, motion/a11y baselines §4.20.L/§4.6 all carry over unchanged
unless named below). Same sandbox constraint as §4.22/§4.23: **no
video-inspection tooling exists** — the video layer decisions carry VERBATIM
from §4.23 (fixed z 0 video + z 1 vignette/tint + z 2 dots + z 3 content +
z 10 header; the committed asset stays untouched; reduced-motion fallback
unchanged). Grounded in the live code: `apps/web/src/routes/+page.svelte`,
`lib/components/landing/LandingVideoHero.svelte`, `lib/styles/tokens.css`,
`tests/landing-page.test.ts`. Hard constraints unchanged: **no new
dependencies** (`@supports`/`clamp()` are native CSS), **no new color values**
(tokens or `color-mix` alpha variants only — the opaque lead reuses an
EXISTING surface token), **no canvas, no animation library**, **routes
untouched**, **/income surfaces untouched**, the video asset stays.
**API endpoints used: none** — the landing stays fetch-free (§4.20
preamble). Task: tz12-08 (`feature/aef20dd9-tz12-08-widths-thirds`).

#### 4.24.A The 80%-width container + the 80% header (item 1)

One container rule governs the whole page; the header rides the same width.

- **The content container (`.landing`) — exactly 80% of the screen width,
  centered:** `.landing` drops `max-width: 1000px` (the §4.20 canvas cap is
  RETIRED for width — §36's wording is unconditional: "constrained to 80% of
  the screen width"; capping at 1000px would make the content 52% wide at
  1920, contradicting the owner) and gains:
  ```css
  .landing {
    width: max(80%, 280px);
    margin-inline: auto;
    /* max-width: none — the 1000px cap retires; padding, flex column and
       the --space-6 gap rhythm are unchanged (§4.23.A) */
  }
  ```
  The internal padding stays `var(--space-5)` phone / `var(--space-7)`
  desktop; the flex-column `gap: var(--space-6)` stays. `.landing` remains
  the ONE container: header + `main.canvas` (lead thirds row, stat card,
  step blocks, footer) all live inside it — every section is constrained to
  the same 80% column. The `--color-landing-bg` full-bleed page background
  and the fixed video layer are NOT constrained (they stay full-viewport,
  §4.23.A).
- **The 280px floor (phone keep-list usability):** 80% of a 320px screen is
  256px — usable but tight; `max(80%, 280px)` floors the column at 280px.
  At 320px the column is 280px (20px gutters each side — no horizontal
  scroll, the §4.20.K invariant holds); the phone chip (icon + switcher
  only, §4.22.A) uses ≈ 40px icon + 16px gap + ≈ 84px LocaleControl +
  20px padding ≈ 160px inside 280px — the keep-list fits with ≈ 120px
  slack. At 390px the column is 312px (pure 80%). At ≥ 350px screens the
  floor never engages (pure 80%).
- **The header = the same 80%, via a container breakout:** the §4.23.B chip
  width `min(100% - 24px, calc(1000px - 48px))` is RETIRED. The sticky
  header stays the first child of `.landing` (sticky still works — its
  containing block `.landing` spans the full page height) and breaks out of
  the container's padding so it spans the container's full 80%:
  ```css
  .top {
    position: sticky;        /* top: var(--space-3), z-index: 10 unchanged */
    width: calc(100% + 2 * var(--space-5));
    margin-inline: calc(-1 * var(--space-5));
  }
  @media (min-width: 720px) {
    .top {
      width: calc(100% + 2 * var(--space-7));
      margin-inline: calc(-1 * var(--space-7));
    }
  }
  ```
  Resulting widths: **1280 → 1024px header (80%), 390 → 312px, 320 → 280px
  (the floor)** — the header is exactly as wide as the content container,
  centered with it. The header's own inner padding is unchanged
  (`8px 10px` phone / `10px 16px` desktop, min-height 52/56px); the sticky
  offset `top: var(--space-3)` and `z-index: 10` are unchanged; the
  `scroll-margin-top: 80px` anchor guard is unchanged (the header row
  height did not change). No `vw` units anywhere — the breakout is computed
  from the container's own padding, so a visible classic scrollbar can
  never make the header outgrow the viewport.

#### 4.24.B Header blur verification + the two-tier glass recipe (item 1 rider)

The owner hints the backdrop blur "may have been hard to see". The audit is
done; the fix is a fill-opacity tier, not a property change.

- **Verification outcome (live audit, 2026-11-22):** the recipe IS applied —
  `+page.svelte` renders `backdrop-filter: blur(14px) saturate(1.1)` +
  `-webkit-backdrop-filter` on `.top` (lines ~359–360), and **nothing
  overrides it** (grep over `apps/web/src`: the only other
  `backdrop-filter` is `ShareContactSlide.svelte`, a different page — no
  ancestor creates a containing block, no mask/filter interference). The
  imperceptibility is a **legibility-vs-visibility trade-off**, not a
  missing property: the 92% `--color-landing-bg` fill leaves only 8%
  show-through, and the show-through is of an already near-black clip —
  blurred near-black under a 92% dark fill reads as a flat dark chip. The
  glass cues that DO render are the hairline and the rounded corners.
- **The fix — a two-tier fill, AA floor kept (decided):** keep the 92% fill
  as the no-blur fallback floor and lower the fill to **88%** where
  `backdrop-filter` actually runs:
  ```css
  .top {
    /* tier 1 — the @supports fallback floor (§4.23.B math unchanged) */
    background: color-mix(in srgb, var(--color-landing-bg) 92%, transparent);
    -webkit-backdrop-filter: blur(14px) saturate(1.1);
    backdrop-filter: blur(14px) saturate(1.1);
    border: 1px solid color-mix(in srgb, var(--color-deepa-4) 22%, transparent);
    border-radius: var(--radius-lg); /* var(--radius-md) phone chip */
  }
  @supports (backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px)) {
    .top {
      /* tier 2 — 12% show-through: the blur becomes perceptible */
      background: color-mix(in srgb, var(--color-landing-bg) 88%, transparent);
    }
  }
  ```
  **AA re-derivation for the 88% tier:** §4.23.B's 5.0:1 worst case assumed
  a pure-white pixel with NO blur. Where the blur runs, a worst-case white
  pixel is diffused across the 14px kernel; the conservative bound is a
  kernel window ≤ 50% bright pixels → the composite is ≈ rgb(36, 31, 43)
  → muted text `#919397` holds ≈ **5.2:1** (AA ≥ 4.5 kept). Where
  `backdrop-filter` is unsupported, tier 1 (92%) keeps the original
  ≈ 5.0:1 no-blur worst case — the floor never drops. Blur radius (14px)
  and saturation lift (1.1) are unchanged; the hairline, radius tokens and
  keep-list are unchanged. **Explicit test assertions (amend the
  `landing-page.test.ts` glass-recipe test):** (a) the `backdrop-filter` /
  `-webkit-backdrop-filter` declarations are present on `.top` (the
  existing source-regex assertions stay); (b) the `@supports` 88% tier
  exists in the source CSS; (c) the 92% tier 1 declaration still exists;
  (d) no OTHER rule in the landing sources overrides
  `backdrop-filter` on `.top` (a negative grep-style assertion). The lead
  panel leaves the glass recipe entirely (§4.24.C), so the shared
  `.top, .glass` selector block reduces to `.top` alone and the `.glass`
  class retires from markup and CSS.

#### 4.24.C The lead block: fully OPAQUE + narrower (item 2)

The §4.23.D liquid-glass lead panel is RETIRED. The lead becomes a solid
panel in the established §4.20.G card language — the translucency contrast
with the glass header is intentional (one glass surface, one opaque surface).

- **Token — decided:** the lead body is solid **`--color-surface`**
  (`#101213`, the exact token every pixel-frame card body already uses —
  agent/stat/step/footer). NOT `--color-landing-bg` (the page token — a
  panel of it would melt into the page background and only the hairline
  would betray it; `--color-surface` reads as the established card
  material). Muted/body text on `--color-surface` is the established AA
  geometry (§4.20.G).
- **Construction — the §4.20.G opaque-surface pixel-frame contract keeps:**
  the lead section adopts the same card construction as the agent/stat
  cards: outer `pixel-corners pixel-frame pixel-frame--strong` + inner
  `pixel-corners` body (`background: var(--color-surface)`, the existing
  card pattern), **square/stepped corners** — with the glass gone, the
  rounded-corner exception (§4.23.B: "scoped to glass surfaces") no longer
  applies to the lead; **the header is the ONLY rounded surface left**.
  Padding stays `20px` phone / `28px` desktop (inside the body). NO
  `backdrop-filter`, no translucent fill, no hairline-glass border — the
  pixel frame IS the border.
- **Narrower — decided width:** the lead no longer sizes to content
  (`fit-content`, max-width 560px — retired); it **fills its thirds column**
  (§4.24.D): `width: 100%` of grid column 1. Exact calc at **1280** with
  the 80% container: 0.8 × 1280 = **1024px container**; minus the container
  padding 2 × 48 (`--space-7`) = 928px content; thirds grid with two
  `--space-6` (32px) gaps: (928 − 64) / 3 = **288px per third → the lead
  panel is ≈ 288px wide** (down from ≤ 560px), ≈ 232px of text width after
  its 28px padding. Phone: the lead is **100% of the container content
  width** (232px at a 320px screen, 264px at 390px).
- **Copy + alignment verbatim (§4.20.C):** headline (3 lines + accent word
  + sparkles) + subheadline + Start CTA → `/income`; left-aligned desktop,
  centered phone — all unchanged. **One size amendment (recorded in
  §4.24.J):** the desktop headline drops from the §4.20.C 64px to
  `clamp(22px, 3.5vw, 44px)` at ≥ 720px — 64px "CONNECTIONS" (≈ 300px in
  Handjet) cannot hold a 232px text column without a mid-word break
  (`overflow-wrap: anywhere`); at 1280 the clamp caps at 44px (≈ 210px —
  fits), and it scales down with the third at narrower desktops (≈ 25px at
  720px, still one line). Phone sizes unchanged (36px / 44px ≥ 480px — the
  208px phone text box holds 36px "CONNECTIONS" ≈ 170px). The sub
  (16px/40ch) and the CTA pill are unchanged.

#### 4.24.D The thirds layout (desktop ≥720px) (item 3)

The §4.23.D plain-flow two-column row (`minmax(0, 1fr) 360px`) is RETIRED.
Within the 80% container, the first content row becomes **three equal
thirds — lead / EMPTY / agent**:

```css
@media (min-width: 720px) {
  .stage {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    column-gap: var(--space-6);        /* 32px — the §4.23.D gap rhythm */
    align-items: start;                 /* carried from §4.23.D */
  }
  .area-lead   { grid-column: 1; }      /* the lead = the FIRST third */
  .area-agents { grid-column: 3; }      /* the BLEAK card = the LAST third */
  /* column 2: NO element — nothing is placed there */
}
```

- **The middle third is EMPTY:** no block, no glass panel, no spacer — the
  fixed video layer (z 0) + vignette/tint (z 1) + the dot mesh (z 2) show
  through directly (the content column paints no background). Dots falling
  in that band are visible — intended (the ambient "sky", §4.23.A layer 3).
  Negative assertion: no landing element declares `grid-column: 2`, and no
  glass panel exists in the middle third.
- **The 360px agent-card cap is RE-CUT:** the card's `width: 100%` now
  resolves against its thirds column — **288px at 1280** (the §4.23.D
  `360px` cap and the `minmax(0, 1fr) 360px` track both retire). The card's
  §4.20.G contract (pixel frame, hover lift + glow, press scale, focus
  rings, TALK → `/income`) carries verbatim; its body padding (20px) and
  inner layout are unchanged — the 248px inner width holds the 96px
  portrait, the 24px BLEAK name, the badge, the traits and the quote.
- **Below the thirds row, unchanged:** the stat card (§4.21.F compact),
  the three step blocks (§4.21.E — equal thirds, ~300px min-height, no
  hover/motion) and the contact footer (§4.21.G) keep their contracts
  verbatim, now as full-width rows of the 80% container. Phone (<720px):
  `.stage` stays the §4.23.D flex-column stack in DOM order (lead → agent
  → stat → steps → footer); the thirds grid is desktop-only.

#### 4.24.E Phone open state (item 4)

Owner verbatim (Concept §36.4, recorded as such): *"the site should opens
with 2/3 from top without blocks from content's"* — sane reading: when the
site opens on a phone, the top two-thirds of the screen show no content
blocks (the video background only, under the floating glass header); the
content blocks begin below that mark.

- **Construction — a spacer on the content wrapper (decided, robust):**
  the first content block's offset is `padding-top` on `main.canvas`
  (the content wrapper under the header), phone only:
  ```css
  @media (max-width: 719.98px) {
    .canvas {
      padding-top: calc(200dvh / 3);   /* exactly 2/3 of the viewport */
    }
  }
  ```
  Why this construction: it offsets WHATEVER the first block is (no
  coupling to the lead element), it is one declaration, and it is immune
  to the header's exact height. **Threshold — decided:** `200dvh / 3` in
  **`dvh`** units (not `vh`) — the dynamic viewport tracks the mobile URL
  bar's collapse/expand so the open state reads "two-thirds of what you
  see"; `dvh` is already the established unit on this page
  (`.landing-page { min-height: 100dvh }`). Desktop (≥720px) has **no
  offset** — the thirds row sits directly under the header.
- **What the open state shows:** the sticky glass header chip floats at
  the top (in-flow first child, sticky `top: 12px` — it never leaves) over
  PURE VIDEO for the top two-thirds; the first content block (the lead)
  begins at or below the two-thirds mark (header ≈ 56px + container
  padding 24px + the spacer ⇒ at 390×844 the first block's top is
  ≈ 639px > the 562.7px two-thirds mark; at 320×640 ≈ 483px > 426.7px).
  The header is chrome, not a content block — the owner's reading is
  "header over pure video".
- **Interactions with carried contracts:** reduced motion — the video-only
  zone shows the static tint + vignette + dots state (§4.23.G unchanged;
  the spacer is motion-free). Video error — the same zone shows the
  near-black treatment. The page scrolls normally; the spacer adds no
  horizontal scroll risk (§4.20.K); anchor jumps (`#tutorial`, `#agents`)
  are unaffected (the spacer only pads the top of the flow).

#### 4.24.F Supersessions (explicit record)

1. **§4.23.B header chip width superseded:** `width: min(100% - 24px,
   calc(1000px - 48px))` is replaced by the container breakout (§4.24.A) —
   the header spans the full 80% column (`calc(100% + 2 * padding)` +
   negative `margin-inline`), not a narrower inset chip. Sticky offset,
   z-index, padding, min-height, radius tokens and keep-list unchanged.
2. **The 1000px canvas cap superseded (width only):** `.landing` drops
   `max-width: 1000px` for `width: max(80%, 280px)` (§4.24.A) — the §4.20
   "1000px content canvas" is retired as a width rule; the container's
   padding, flex rhythm and centering stand.
3. **§4.23.D glass lead panel superseded:** the liquid-glass lead (92%
   fill + blur + rounded corners + hairline) is retired; the lead is a
   solid `--color-surface` pixel-frame panel (§4.24.C). §4.23.I flag 2
   (the glass-lead ADVICE flag) is resolved by the owner's §36 item 2.
4. **§4.23.B rounded-scope amended:** the lead was the second rounded
   surface; now **only the header** is rounded — every pixel-frame surface
   (including the lead) is square/stepped again.
5. **§4.23.D desktop two-column row superseded:** `grid-template-columns:
   minmax(0, 1fr) 360px` is replaced by the thirds grid
   `repeat(3, 1fr)` — lead col 1, agent col 3, col 2 empty; the 360px
   agent-card cap re-cuts to the column width (§4.24.D).
6. **§4.23.D phone stack top superseded:** on phones the content stack no
   longer starts near the top — the `calc(200dvh / 3)` canvas spacer puts
   the first block below the two-thirds mark (§4.24.E). DOM order below
   the spacer unchanged.
7. **§4.23.B "92% is the floor — do not lower" amended:** the 92% fill
   remains the no-blur fallback floor, and a `@supports` tier lowers the
   fill to 88% where the blur actually runs — the AA floor is kept on both
   tiers by the blur-inclusive re-derivation (§4.24.B).
8. **Superseded-but-carried:** the §4.23.A fixed layer stack (z 0–10), the
   decisive video attribute set, the gated one-shot mount `.play()`, the
   error fallback, the 12-dot mesh, the §4.22.A keep-list, the §4.20.C
   copy/CTA, the §4.21.E/F/G section contracts and the §4.20.L behavior
   all carry into §4.24 unchanged.

#### 4.24.G RU/EN i18n delta (grep-audited; both dictionaries required)

**Zero delta** — §36 adds, removes and rewords no string: the header,
lead, agent card, stat card, steps and footer keep their existing keys; the
new layout is pure geometry/CSS. Live grep audit (2026-11-22, both dicts):
exactly **23 `landing.*` keys per dictionary** (`headline.1/2/accent`,
`sub`, `cta`, `stat.title`, `stat.line1/2/3`, `agent.name/badge/traits/
quote/cta`, `tutorial.search/chat/share`, `steps.find/chat/share.desc`,
`footer.contact.email.label`, `footer.contact.github.label`,
`footer.copyright`) — the parity test asserts `toHaveLength(23)` and stays
green UNCHANGED. (Record for accuracy: §4.23.F's prose projected 29 keys
pre-build; the landed build consolidated to 23, which is what both dicts
and the test carry — §4.24 changes nothing about that count.) No dead keys
added or removed; the RU/EN switch still re-renders the page without a
reload.

#### 4.24.H Reduced motion + media states

Unchanged from §4.23.G in full — the spacer and the 80% container are
motion-free geometry. The phone open state's video-only zone shows the
same static tint + vignette + dots under reduced motion and the same
near-black treatment on video error; no loading/empty/error states exist
(the landing fetches nothing, §4.20.L).

#### 4.24.I Acceptance criteria (checkable)

**80% widths (item 1):**
1. `.landing` computes to **80% of the screen width, centered** — 1024px at
   a 1280×800 viewport, 312px at 390px, **280px (the floor) at 320px** —
   with `max-width: none` (no 1000px cap remains on `.landing`) and no
   horizontal scroll at 320/760/1280 (§4.20.K holds).
2. EVERY landing section (header, lead, agent card, stat card, three step
   blocks, contact footer) lives inside that one container — no section
   paints wider than 80% of the screen; the full-bleed layers
   (`--color-landing-bg` background, fixed video/vignette/dots) are the
   only full-width surfaces.
3. The sticky header spans the same 80% (1024px at 1280; 312px at 390;
   280px floor at 320), centered, via the container breakout
   (`calc(100% + 2 * var(--space-5|--space-7))` + matching negative
   `margin-inline`); sticky `top: 12px`, z 10, inner padding, min-heights
   and the keep-list (§4.22.A verbatim) are unchanged; the phone chip
   (icon + switcher) fits 280px with slack.

**Header blur verification (item 1 rider):**
4. The glass recipe on `.top` is applied AND verified: `backdrop-filter` +
   `-webkit-backdrop-filter: blur(14px) saturate(1.1)` present (source
   assertion, kept), the 92% tier-1 fill present, **and the
   `@supports` tier-2 `color-mix(… 88% …)` fill present**; no other landing
   rule overrides `backdrop-filter` on `.top` (negative assertion); the
   AA floor holds on both tiers (92% ≈ 5.0:1 no-blur worst case; 88%
   ≈ 5.2:1 blur-inclusive worst case, muted text ≥ 4.5:1).

**Opaque narrower lead (item 2):**
5. The lead panel is FULLY OPAQUE: body `background: var(--color-surface)`,
   pixel-corners/pixel-frame construction, square corners, **no
   `backdrop-filter` and no translucent `color-mix` fill** anywhere on it;
   the copy (headline + accent + sparkles + sub + Start CTA) is §4.20.C
   verbatim, left-aligned desktop / centered phone, Start → `/income`.
6. The lead is NARROWER: it fills its thirds column — ≈ **288px at 1280**
   (80% container − padding − gaps ÷ 3) and **100% of the container
   content width on phone** (232px at 320, 264px at 390); the desktop
   headline adapts (`clamp(22px, 3.5vw, 44px)`) with no mid-word break at
   720/760/1024/1280; phone headline sizes unchanged.

**Thirds layout (item 3, desktop ≥720px):**
7. At ≥720px the first content row is a `repeat(3, 1fr)` thirds grid with
   `--space-6` gaps and `align-items: start`: the **lead in column 1**, the
   **BLEAK agent card in column 3**, **column 2 EMPTY** — no content block
   and no glass panel occupy the middle third (negative assertion: no
   `grid-column: 2` element); the video + vignette + dots show through.
8. The agent card's width is its third's width (≈ 288px at 1280 — no
   360px cap remains); its §4.20.G contract (hover lift + glow, press
   scale, focus rings, TALK → `/income`) and the BLEAK/БЛИК naming
   (§4.22.D) are unchanged.
9. Below the thirds row the stat card (§4.21.F), the three step blocks
   (§4.21.E: 01→03, equal thirds, ~300px min-height, no hover/motion) and
   the contact footer (§4.21.G) render unchanged as full-width rows of the
   80% container; phone (<720px) stacks lead → agent → stat → steps →
   footer in DOM order (the thirds grid is desktop-only).

**Phone open state (item 4):**
10. At phone viewports (<720px) `main.canvas` carries
    `padding-top: calc(200dvh / 3)` (dvh, not vh) — the first content
    block's top lands **below the two-thirds mark** (≥ 2/3 of the dynamic
    viewport: at 390×844 > 562.7px; at 320×640 > 426.7px) with NOTHING
    between the floating glass header and that mark but the video layer;
    the ≥720px rule sets NO such offset (the thirds row starts directly
    under the header).
11. The open state holds under reduced motion (static tint + vignette +
    dots zone) and on video error (near-black treatment) — no blank screen,
    no layout shift; anchor jumps still clear the stuck header
    (`scroll-margin-top: 80px` unchanged).

**i18n + behavior + suites:**
12. i18n: **zero delta** — exactly 23 `landing.*` keys in BOTH dictionaries
    (unchanged count, unchanged copy); the parity/dead-key tests pass
    UNAMENDED; RU/EN switching re-renders without a reload.
13. Behavior (§4.20.L/§4.22.A made exact): the entry points are EXACTLY
    TWO — Start CTA and agent-card TALK, both → `/income`; the join
    deep-links (`?code=` / `?u=`) still forward to `/income` with the
    query preserved; the tab bar is absent on `/`; nothing on `/` fetches
    (API endpoints used: none).
14. Constraints: no new dependencies; palette tokens unchanged (the opaque
    lead reuses `--color-surface`; the 88% tier is a `color-mix` alpha
    variant of the existing `--color-landing-bg`); routes untouched;
    `/income` untouched; the video asset stays; reduced-motion fallback
    unchanged (§4.23.G); the video layer stack (z 0/1/2 + content z 3 +
    header z 10) is unchanged.
15. Suites amended and green: `landing-page.test.ts` (80% container +
    header breakout + @supports 88% tier + opaque-lead + thirds-grid +
    phone-spacer assertions; the `minmax(0,1fr) 360px` and
    `min(100% - 24px, calc(1000px - 48px))` source assertions replaced),
    `i18n.test.ts` / `sweep.test.ts` / `join-flow.test.ts` /
    `creation-wizard.test.ts` / `mascot.test.ts` (untouched, green);
    `make lint && make test && make build` green.

#### 4.24.J Flags for the owner / concept (concept report)

1. **ADVICE NEEDED — the desktop headline size:** §4.20.C fixed the desktop
   headline at 64px; inside a 288px third that size mid-word-breaks
   ("CONNECTIONS" ≈ 300px vs a 232px text box), so §4.24.C specs
   `clamp(22px, 3.5vw, 44px)` at ≥ 720px (44px at 1280). If the owner
   wants the 64px kept, the alternative is a wider lead (e.g. lead spanning
   columns 1–2 with a narrower empty band), which contradicts the thirds
   reading — the clamp is the recommended resolution.
2. **ADVICE NEEDED — the glass-visibility band:** the 88% tier is decided;
   on real-device smoke the owner may step it down to **85%** (still
   ≈ 5.05:1 under the same blur-inclusive worst case) if the blur remains
   imperceptible — 85% is the documented floor of the band, NOT a change
   in this pass.
3. **Record — the spacer lands the first block slightly below the exact
   two-thirds line** (the in-flow header + container padding sit inside
   the offset zone): the guarantee is "no content block within the top
   two-thirds", which satisfies the owner's verbatim reading; landing the
   block exactly AT the mark would require subtracting the header's
   rendered height (fragile across the 52–56px row) and is not specced.

### 4.25 v3.19 feature design (2026-11-22, owner-approved Concept §37): §37 owner correction — open state + transparent lead + true liquid-glass header

"Not, is not what I want" — the owner reviewed the §36/§4.24 result and
issued the three-item §37 correction batch: on open, **only the Start block
and the Bleak block are displayed, vertically centered** (everything else —
stat card, steps, footer — below the screen space initially), the lead
block becomes **TRANSPARENT and without border** (no solid panel, no pixel
frame — text and Start button sit directly over the video), and the header
becomes **true liquid glassmorphism** with the owner's EXACT css values.
This section amends §4.24 (→ §4.23 → §4.22 → §4.21 → §4.20) item by item;
**where §4.25 is silent, the earlier specs stand** except where §4.25.D
explicitly supersedes them (the video layer stack §4.23.A, the keep-list
§4.22.A, the card contracts §4.20.G/§4.21.F, step blocks §4.21.E, contact
footer §4.21.G, headline copy + Start CTA §4.20.C, behavior §4.20.L,
motion/a11y baselines §4.20.L/§4.6 all carry over unchanged unless named
below). Same sandbox constraint as §4.22–§4.24: **no video-inspection
tooling exists** — the video layer decisions carry VERBATIM from §4.23
(fixed z 0 video + z 1 vignette/tint + z 2 dots + z 3 content + z 10
header; the committed asset stays untouched; reduced-motion fallback
unchanged). Grounded in the live code: `apps/web/src/routes/+page.svelte`,
`lib/components/landing/LandingVideoHero.svelte`, `lib/styles/tokens.css`,
`tests/landing-page.test.ts`. Hard constraints unchanged: **no new
dependencies**, **no new color values** (token palette unchanged — the
owner's exact header `rgba(…)` values are the SANCTIONED EXCEPTION,
recorded in §4.25.D; token/`color-mix` values only everywhere else),
**no canvas, no animation library**, **routes untouched**, **/income
surfaces untouched**, the video asset stays. **API endpoints used: none**
— the landing stays fetch-free (§4.20 preamble). Task: tz12-09
(`feature/221c49f3-tz12-09-open-state-glass`).

#### 4.25.A The default open state — only Start + BLEAK, vertically centered (item 1)

Owner verbatim (Concept §37.1): when the site opens, only the Start block
and the Bleak block are displayed, vertically centered; all remaining
blocks are below the screen space initially and appear on scroll. The
Start block = the lead (headline + supporting text + Start button); the
Bleak block = the agent card. **The stat card is content too — it is below
the fold initially** (the owner's "ALL remaining blocks (steps, footer,
everything)" reading covers it). This SUPERSEDES the §36 item 4 /
§4.24.E phone "top 2/3 without blocks" rule — the
`padding-top: calc(200dvh / 3)` offset on `main.canvas` is **REMOVED**
(recorded in §4.25.D; no other spacer rule replaces it).

- **Construction — a 100dvh hero region, header out of the flow:** the
  header becomes `position: fixed` (§4.25.C), which removes it from the
  flow; the content column therefore starts at the page top, and the
  first content region can span **exactly the first viewport**:
  ```css
  .landing {
    /* top padding retired — the fixed header contributes no flow height,
       and the hero region must span the full first viewport from the page
       top ("100dvh minus nothing"); inline + bottom padding unchanged */
    padding: 0 var(--space-5) var(--space-5);
  }
  @media (min-width: 720px) {
    .landing { padding: 0 var(--space-7) var(--space-7); }
  }
  ```
  At the scroll origin (scrollY = 0) the hero region is fully visible —
  the initial scroll position shows it whole, nothing to scroll to reach
  the centered open state.
- **Desktop (≥720px) — the §36 thirds, vertically centered:** `.stage`
  keeps the `repeat(3, 1fr)` thirds grid (lead col 1, BLEAK col 3, the
  middle third EMPTY — the video + vignette + dots show through; §4.24.D
  stands) and becomes the hero region:
  ```css
  @media (min-width: 720px) {
    .stage {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      column-gap: var(--space-6);
      min-height: 100dvh;      /* the hero row = the whole first viewport */
      align-content: center;   /* the row centers inside the 100dvh region */
      align-items: center;     /* lead + BLEAK centered relative to each
                                  other (was `start`, §4.24.D — superseded) */
    }
    .area-lead   { grid-column: 1; }
    .area-agents { grid-column: 3; }
    /* column 2: NO element — unchanged (§4.24.D) */
  }
  ```
  Result: the lead and the agent card float vertically centered in the
  first viewport, side-by-side per the §36 thirds, with the middle third
  pure video. The stat card, the three step blocks and the contact footer
  flow in normal flow AFTER the hero region (the `.canvas` flex-column
  `gap: var(--space-6)` rhythm unchanged) — below the screen space
  initially, revealed on scroll.
- **Phone (<720px) — the START block centered in the first viewport,
  BLEAK next:** `.stage` stays the DOM-order flex column (§4.24.D), and
  the lead's own section becomes the hero region:
  ```css
  @media (max-width: 719.98px) {
    .area-lead {
      min-height: 100dvh;
      display: flex;
      flex-direction: column;
      justify-content: center; /* the START block centers in screen 1 */
    }
  }
  ```
  The copy block (transparent, §4.25.B) is centered vertically in the
  first viewport (it is already horizontally centered on phone,
  §4.24.C alignment); the BLEAK card is the NEXT block in flow —
  immediately after the first screen, visible on the first small scroll;
  stat card → steps → footer follow in the established DOM order.
- **No other spacer rules remain:** the §4.24.E `@media (max-width:
  719.98px) { .canvas { padding-top: calc(200dvh / 3) } }` rule is
  DELETED outright — nothing replaces it; the open state is produced
  entirely by the two 100dvh constructions above. Negative assertion: the
  landing sources contain no `calc(200dvh / 3)` and no `padding-top` on
  `.canvas`/`.landing`.
- **Very short viewports (landscape phones, e.g. 740×360):** the centered
  hero content may pass under the fixed glass header; the translucent
  glass keeps it visible and the page scrolls freely — no scroll-lock, no
  min-height guard specced (record; §4.25.H flag 3).
- **Interaction states:** unchanged — the landing fetches nothing, so
  there are no loading/empty/error states (§4.20.L); the video-error
  fallback (§4.23.G) shows the same hero region over the static near-black
  treatment; reduced motion shows it over the static tint + vignette +
  dots state (§4.25.F).

#### 4.25.B The lead block: TRANSPARENT, no border (item 2)

Owner verbatim (Concept §37.2): the lead is TRANSPARENT and without
border — no solid panel, no pixel frame; the text and the Start button sit
directly over the video background. This SUPERSEDES the §36 item 2 /
§4.24.C "fully opaque `--color-surface` panel + §4.20.G pixel frame +
square corners" construction FOR THIS BLOCK (recorded in §4.25.D); the
§4.20.G pixel-frame contract itself stands for the agent/stat/step/footer
surfaces — the lead is the ONLY transparent surface.

- **Markup:** `.copy` drops the `pixel-corners pixel-frame
  pixel-frame--strong` classes; `.copy-body` drops its `pixel-corners`
  class. The section/body elements stay (the flex column with its
  `gap: var(--space-4)`, centered-phone/left-desktop alignment and the
  copy structure are §4.20.C verbatim and carry).
- **CSS:** `.copy-body { background: transparent; }` — NO background
  fill, NO border, NO `backdrop-filter`, NO translucent `color-mix` fill,
  NO glass class, NO box-shadow on the lead, NO border-radius. The old
  20px/28px body padding becomes invisible (transparent) and MAY stay as
  inert spacing that keeps the copy clear of the thirds edge — it is not
  a panel. Negative assertions: the lead subtree carries no
  `pixel-corners`/`pixel-frame` class, `.copy-body` sets no
  `background` other than `transparent`/`none`, and neither `.copy` nor
  `.copy-body` declares `border`, `backdrop-filter` or `border-radius`.
- **Legibility — text treatment ONLY (token colors, exact values):** a
  soft dark halo lifts the copy off arbitrary bright video frames; the
  halo is `color-mix` over the existing near-black `--color-surface`
  token (no new colors):
  ```css
  .headline {
    text-shadow:
      0 1px 2px color-mix(in srgb, var(--color-surface) 90%, transparent),
      0 0 14px color-mix(in srgb, var(--color-surface) 55%, transparent);
  }
  .sub {
    text-shadow:
      0 1px 2px color-mix(in srgb, var(--color-surface) 90%, transparent),
      0 0 10px color-mix(in srgb, var(--color-surface) 55%, transparent);
  }
  ```
  The accent word keeps its existing violet glow declaration (its own
  `text-shadow` overrides the inherited halo — accepted: it is large
  display text in `--color-deepa-4` over the near-black video; recorded
  as a residual smoke note, not a change). The headline's near-white
  `--color-text` over the near-black video measures ≈ 15:1 typical
  (≥ 4.5 AA) and the halo covers the bright-frame edge cases the header
  tradeoff (§4.25.C) shares.
- **The Start button keeps its EXISTING style — verified panel-free:**
  `.cta-main` is an opaque `--color-deepa-4` pill (radius-pill,
  `--color-text` label, min-height 48px, glow-on-hover, scale(0.98)
  press) — it NEVER relied on the lead panel (it rendered as a
  self-contained pill inside it), so nothing changes: over the video it
  is its own opaque surface, and its label AA is the established
  `--color-deepa-ink-4` pairing, independent of the backdrop. No ring,
  no shadow added — the owner's "without border" reading covers the
  block, and the button's exact current style stands (a violet-video
  edge case is a residual smoke note, §4.25.H).
- **Desktop headline size — the clamp STANDS:** §4.24.C's
  `clamp(22px, 3.5vw, 44px)` at ≥720px (44px at 1280, scaling with the
  third) is kept unchanged — the constraint behind it was the 288px
  third's width, which §37 does not touch (the thirds layout stands);
  transparency removes the panel, not the column. Phone sizes unchanged
  (36px / 44px ≥ 480px). This RESOLVES §4.24.J flag 1 (recorded).

#### 4.25.C The header: TRUE liquid glassmorphism — the owner's EXACT values (item 3)

Owner verbatim (Concept §37.3), carried VERBATIM into the spec. The
§4.24.B two-tier fill recipe (92% / 88% `color-mix` + the `@supports`
tier-2 block) is REPLACED ENTIRELY by the owner's values.

- **Position — `position: fixed`, decided (the owner offered fixed OR
  sticky top: 0):** fixed, because (1) the §4.25.A hero region must span
  the full first viewport from the page top — a fixed header contributes
  zero flow height, so the 100dvh construction is exact and the centered
  open state is exactly viewport-centered (a sticky in-flow header would
  push the hero row down by its 52–56px row); (2) fixed pins the header
  with zero coupling to `.landing`'s layout — **the video scrolls
  directly underneath it** at every scroll position and the header never
  moves.
- **The 80% width rule STANDS (§36 item 1), mechanism re-cut:** a fixed
  element's containing block is the viewport, not `.landing`, so the
  §4.24.A container breakout (`calc(100% + 2 * padding)` + negative
  `margin-inline`) is invalid for it and RETIRES. The header now sizes
  directly against the viewport with the SAME width expression as the
  container, so the two stay pixel-identical:
  ```css
  .top {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    margin-inline: auto;         /* centers the fixed element */
    width: max(80%, 280px);      /* == .landing's width, every viewport */
    z-index: 10;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--space-4);
    min-height: 52px;
    padding: 8px 10px;
    /* --- the owner's EXACT values, verbatim ------------------------- */
    background: rgba(20, 20, 30, 0.25);          /* low-opacity dark tint */
    -webkit-backdrop-filter: blur(16px) saturate(180%);
    backdrop-filter: blur(16px) saturate(180%);
    border-top: 1px solid rgba(255, 255, 255, 0.15);   /* glossy */
    border-bottom: 1px solid rgba(255, 255, 255, 0.15); /* top/bottom
                                        only — side borders NONE */
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.15); /* soft inner
                                        highlight — the liquid-glass edge */
    border-radius: var(--radius-lg);   /* §36 rounding STANDS (owner
                                          silent on corners) */
  }
  @media (max-width: 719.98px) {
    .top { border-radius: var(--radius-md); }  /* the phone chip radius */
  }
  @media (min-width: 720px) {
    .top { min-height: 56px; padding: 10px 16px; }
  }
  ```
  Resulting widths: 1280 → 1024px (80%), 390 → 312px, 320 → 280px (the
  floor) — identical to §4.24.A's numbers; the keep-list (§4.22.A
  verbatim: web icon + desktop anchors + switcher; phone icon +
  switcher), the inner paddings, min-heights and z 10 are unchanged.
- **The two-tier recipe is DELETED:** the `color-mix(… 92% …)` tier-1
  declaration, the `@supports (backdrop-filter: blur(1px)) or …`
  tier-2 block and the violet Deepa hairline
  (`border: 1px solid color-mix(… --color-deepa-4 22% …)`) are all
  REMOVED — `saturate(1.1)`/`blur(14px)` become the owner's
  `saturate(180%)`/`blur(16px)`. The no-backdrop-filter fallback is
  re-specced as a single higher-opacity tint so text stays readable
  without blur support:
  ```css
  @supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
    .top { background: rgba(20, 20, 30, 0.85); }
  }
  ```
- **Rounded corners — KEPT:** the owner did not mention corners; the
  §36 rounding stands unless contradicted (radius-lg desktop /
  radius-md phone chip). Visual note: with `top: 0` the rounded top
  corners sit flush at the screen edge — intended per the owner's
  position spec; `top: var(--space-3)` remains the one-line alternative
  if the smoke dislikes it (§4.25.H flag 2, not a change in this pass).
- **AA TRADEOFF — recorded explicitly (owner-order exception):** at a
  0.25 tint + blur, body-text AA (4.5:1) over arbitrary bright video
  frames is NOT guaranteeable. Numbers (worst case): a white video pixel
  under the z-1 30% wash reads ≈ 184 luminance; composited with the 0.25
  tint it lands ≈ rgb(144) — muted nav text `#919397` there is ≈ 1.1:1
  and even `--color-text` ≈ 2.5:1 (fail). Over the owner's actual
  near-black video (recorded intent, §4.22.F) the composite stays near
  rgb(20–25) and the same texts hold ≥ 4.5:1 comfortably. The owner's
  exact values WIN — recorded as an owner-order exception to the §2.6 AA
  baseline. Mitigations already in place: near-white text colors (the
  large pixel headline + nav glyphs), the near-black video, the z-1
  wash + vignette that darken the backdrop the filter samples, and the
  §4.25.B lead halo. Residual risk is the owner's real-device smoke over
  bright frames; if it fails there, the remedies (a higher tint opacity
  — an owner-value change — or a localized nav text treatment) need the
  owner's sign-off and are NOT specced (§4.25.H flag 1).
- **Anchors:** `scroll-margin-top: 80px` on `#agents`/`#tutorial` stands
  (the fixed header is ≤ 56px tall at top: 0 — 80px still clears it).

#### 4.25.D Supersessions (explicit record)

1. **§36 item 4 / §4.24.E phone open state SUPERSEDED:** the
   `padding-top: calc(200dvh / 3)` spacer on `main.canvas` is REMOVED;
   the open state is now "only Start + BLEAK, vertically centered" on
   BOTH breakpoints (§4.25.A) — phone: the START block centered in the
   first 100dvh, BLEAK next in flow. No other spacer rule remains.
2. **§36 item 2 / §4.24.C opaque lead SUPERSEDED for the lead block:**
   the solid `--color-surface` panel, the §4.20.G pixel-frame
   construction and the square-corner contract are retired FOR THE LEAD
   ONLY — the lead is transparent and borderless over the video
   (§4.25.B). §4.20.G stands for the agent/stat/step/footer surfaces;
   the header remains the ONLY rounded surface (unchanged — the lead was
   square anyway).
3. **§4.24.B two-tier glass fill REPLACED:** the 92%/88% `color-mix`
   recipe, its `@supports` tier-2 block and the §4.23.B violet Deepa
   hairline are deleted; the owner's exact values
   (`rgba(20, 20, 30, 0.25)` + `blur(16px) saturate(180%)` + 1px
   `rgba(255, 255, 255, 0.15)` top/bottom borders + the inset inner
   highlight) apply verbatim, with the `rgba(20, 20, 30, 0.85)`
   no-backdrop-filter fallback (§4.25.C). §4.24.J flag 2 (the 88%/85%
   band) is MOOT.
4. **§4.24.F.1 / §4.24.A header breakout mechanism RETIRED:** the
   `calc(100% + 2 * padding)` + negative `margin-inline` breakout is
   replaced by the fixed header's viewport-relative
   `width: max(80%, 280px); margin-inline: auto` (§4.25.C) — the §36 80%
   width rule itself STANDS, and the header's width still equals the
   container's at every viewport.
5. **§4.23.B sticky header position RETIRED:** `position: sticky; top:
   var(--space-3)` becomes `position: fixed; top: 0` (§4.25.C, owner's
   spec; justification recorded there).
6. **§4.24.D `align-items: start` SUPERSEDED on the hero row:** the
   desktop thirds grid centers its items (`align-items: center`) inside
   the 100dvh hero region (`align-content: center`) — the thirds
   columns/gaps/empty-middle stand unchanged.
7. **Sanctioned palette exception (record):** the four owner `rgba(…)`
   header values are raw literals outside the token palette — sanctioned
   by the owner's exact-value spec (§37.3) and recorded here; everywhere
   else the token/`color-mix` rule (§4.1, §4.24 preamble) stands. Note
   for the suite: the raw-hex guard (`#[0-9a-fA-F]{3,8}`) does not match
   `rgba(…)` literals — the existing test stays green without a
   waiver.
8. **Superseded-but-carried (unchanged into §4.25):** the §4.23.A fixed
   layer stack (z 0–10), the decisive video attribute set, the gated
   one-shot mount `.play()`, the error fallback, the 12-dot mesh, the
   §4.22.A keep-list, the §4.20.C copy/CTA, the §4.21.E/F/G section
   contracts, the §4.20.L behavior + deep-link forwarding and the
   §4.23.G reduced-motion fallback all carry unchanged.

#### 4.25.E RU/EN i18n delta (grep-audited; both dictionaries required)

**Zero delta, verified** — §37 adds, removes and rewords no string: the
open state, the transparent lead and the header glass are pure
geometry/CSS. The live dictionaries carry exactly **23 `landing.*` keys
per dictionary** (`headline.1/2/accent`, `sub`, `cta`, `stat.title`,
`stat.line1/2/3`, `agent.name/badge/traits/quote/cta`,
`tutorial.search/chat/share`, `steps.find/chat/share.desc`,
`footer.contact.email.label`, `footer.contact.github.label`,
`footer.copyright` — the same set the parity test's `LANDING_KEYS`
asserts); the parity/dead-key tests pass UNAMENDED. No dead keys touched;
the header switch re-renders the page without a reload.

#### 4.25.F Reduced motion + media states

Unchanged from §4.23.G in full: under `prefers-reduced-motion` the video
stays paused at frame 0 and the static near-black tint + vignette + 12
static dots ARE the fallback state. The transparent lead READS on that
fallback: `--color-text`/`--color-text-muted` over the near-black static
backdrop hold ≈ 15:1 / ≈ 5:1, and the §4.25.B halo adds edge definition —
no additional treatment needed. The header's glass sits over the same
static backdrop (blur has nothing moving; the 0.85 fallback tint only
engages where backdrop-filter is unsupported). The 100dvh hero regions
are motion-free geometry. Video error: the same hero region shows over
the near-black treatment — no blank screen, no layout shift. No
loading/empty/error states exist (the landing fetches nothing, §4.20.L).

#### 4.25.G Acceptance criteria (checkable)

**Open state (item 1):**
1. At the scroll origin, the first viewport contains ONLY the lead block
   (headline + supporting text + Start button) and the BLEAK agent card
   (plus the fixed header chrome) — NO stat card, NO step block, NO
   footer and no other content block is visible in the first viewport;
   all remaining blocks start below the fold and appear on scroll — at
   BOTH 1280×800 (desktop) and 390×844 (phone).
2. Desktop ≥720px: the hero region is a `min-height: 100dvh` thirds grid
   (`repeat(3, 1fr)`, `--space-6` column gap) with `align-content:
   center` + `align-items: center` — the lead sits in column 1, the
   BLEAK card in column 3, the middle third EMPTY (no `grid-column: 2`
   element), both blocks vertically centered in the first viewport.
3. Phone <720px: `.area-lead` is `min-height: 100dvh` with the copy
   vertically centered (`justify-content: center`) in the first
   viewport; the BLEAK card is the immediately following block in flow
   (visible on the first small scroll); then stat → steps → footer in
   the established DOM order.
4. The §4.24.E spacer is GONE: no `calc(200dvh / 3)` anywhere in the
   landing sources, no `padding-top` on `.canvas`/`.landing` in any
   media query; `.landing`'s top padding is 0 (inline + bottom padding
   per breakpoint unchanged).

**Lead transparent + borderless (item 2):**
5. `.copy` carries NO `pixel-corners`/`pixel-frame`/`pixel-frame--strong`
   class and `.copy-body` carries NO `pixel-corners` class; `.copy-body`
   sets `background: transparent` (or none) — negative assertions: no
   `background: var(--color-surface)` on the lead, no `border`, no
   `backdrop-filter`, no `color-mix` fill, no `border-radius` and no
   `box-shadow` on `.copy`/`.copy-body`.
6. The lead copy is §4.20.C verbatim: the 3-line headline + accent word
   + 2 sparkles + the sub + the Start CTA; Start → `/income`; the
   desktop headline clamp `clamp(22px, 3.5vw, 44px)` STANDS (no 64px
   returns); phone sizes unchanged (36px / 44px ≥ 480px).
7. The legibility halo is present and token-only: `.headline` and `.sub`
   declare the `0 1px 2px color-mix(… --color-surface 90% …)` +
   soft-ambient `text-shadow` treatment; the accent word keeps its
   violet glow declaration; no new color values beyond the sanctioned
   header rgba set.
8. The Start button keeps its exact current style: opaque
   `--color-deepa-4` pill, `--color-text` label, `--radius-pill`,
   min-height 48px, hover glow, press scale(0.98) — unchanged markup,
   unchanged CSS.

**Header — true liquid glass (item 3):**
9. `.top` is `position: fixed; top: 0` (NOT sticky), `z-index: 10`, and
   the video scrolls directly underneath it (the header is out of the
   content flow — `.landing`'s first in-flow child is `main.canvas`).
10. The owner's EXACT values verbatim on `.top`: `background:
    rgba(20, 20, 30, 0.25)`; `backdrop-filter: blur(16px) saturate(180%)`
    AND `-webkit-backdrop-filter: blur(16px) saturate(180%)`;
    `border-top: 1px solid rgba(255, 255, 255, 0.15)` and `border-bottom:
    1px solid rgba(255, 255, 255, 0.15)` with side borders NONE;
    `box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.15)`.
11. Width/centering: `width: max(80%, 280px)` + `margin-inline: auto`
    with `left: 0; right: 0` — 1024px at 1280, 312px at 390, 280px (the
    floor) at 320, pixel-identical to `.landing`'s width; the
    §4.24.A breakout declarations (`calc(100% + 2 * var(--space-5|
    --space-7))` + matching negative margins) are GONE.
12. The two-tier recipe is GONE: no `color-mix(… 92% …)` / 88% tier, no
    violet Deepa hairline on `.top`; the `@supports not (…)` fallback
    sets `background: rgba(20, 20, 30, 0.85)`.
13. Rounded corners KEPT: `border-radius: var(--radius-lg)` desktop /
    `var(--radius-md)` in the <720px chip rule; keep-list UNCHANGED
    (§4.22.A verbatim — icon + 2 desktop anchors + switcher; phone icon
    + switcher); inner padding (8px 10px / 10px 16px) and min-heights
    (52/56px) unchanged; `scroll-margin-top: 80px` on `#agents`/
    `#tutorial` unchanged.
14. The AA tradeoff is RECORDED in this spec (§4.25.C): the owner's
    exact values intentionally supersede the §2.6 AA guarantee for the
    header over bright video frames (owner-order exception) — no test
    asserts header-text contrast over video; the existing glass-recipe
    assertions are replaced by ACs 10–12.

**i18n + behavior + below-the-fold + suites:**
15. i18n: **zero delta** — exactly 23 `landing.*` keys in BOTH
    dictionaries (unchanged count, unchanged copy); the parity/dead-key
    tests pass UNAMENDED; RU/EN switching re-renders without a reload.
16. Behavior (§4.20.L/§4.22.A): the entry points are EXACTLY TWO — the
    lead Start CTA and the agent-card TALK, both → `/income`; the join
    deep links (`?code=` / `?u=`) still forward to `/income` with the
    query preserved; the tab bar is absent on `/`; nothing on `/`
    fetches (**API endpoints used: none**).
17. Below the fold, intact: the stat card (§4.21.F compact), the three
    step blocks (§4.21.E: 01→03, equal thirds ~300px min-height desktop,
    no hover/motion) and the contact footer (§4.21.G) keep their
    contracts and render as normal-flow rows after the hero region; the
    BLEAK card keeps its §4.20.G contract (hover lift + glow, press
    scale, focus rings, TALK → `/income`) at its third's width.
18. Suites amended and green: `landing-page.test.ts` — the superseded
    §36/§4.24 assertions REPLACED (the phone-spacer
    `calc(200dvh / 3)` test, the opaque-lead/pixel-frame test, the
    sticky+breakout test, the 92%/88% two-tier test and the blur(14px)
    saturate(1.1) assertions are rewritten to ACs 1–13 above; the
    `.glass`-absent and raw-hex guards stay green) — plus
    `i18n.test.ts` / `sweep.test.ts` / `join-flow.test.ts` /
    `creation-wizard.test.ts` / `mascot.test.ts` untouched and green;
    `make lint && make test && make build` green.
19. Constraints: no new dependencies; palette tokens unchanged (the
    owner's header rgba values are the recorded sanctioned exception);
    routes untouched; `/income` untouched; the video asset stays; the
    video layer stack (z 0/1/2 + content z 3 + header z 10) unchanged.

#### 4.25.H Flags for the owner / concept (concept report)

1. **ADVICE NEEDED — header AA residual risk (recorded, not actionable
   in this pass):** at the owner's exact 0.25 tint, nav/muted text over
   an unusually bright video frame can fall below AA (derivation in
   §4.25.C). The owner's values win (owner-order exception recorded);
   the real-device smoke over bright frames decides. If it fails, the
   remedies (raise the tint opacity — an owner-value change — or a
   localized nav text treatment) come back to the owner; nothing is
   pre-specced.
2. **Smoke note — fixed `top: 0` + kept rounding:** the glass pill's
   rounded top corners sit flush at the screen edge. If the owner
   dislikes the flush look, `top: var(--space-3)` (the old 12px float)
   is the one-line alternative — owner decision, not a change here.
3. **Record — very short viewports (landscape phones):** the centered
   hero content may pass under the fixed glass header; the translucent
   glass keeps it visible; no scroll-lock or min-height guard is
   specced.
4. **Record — §4.24.J statuses:** flag 1 (desktop headline size) is
   RESOLVED — the `clamp(22px, 3.5vw, 44px)` stands (§4.25.B); flag 2
   (the 88%/85% glass-visibility band) is MOOT — the two-tier recipe is
   retired by the owner's exact values; flag 3 (the two-thirds spacer
   record) is MOOT — the spacer is removed by §37.1.

## 5. Design-decision rationale (short)

## 5. Design-decision rationale (short)

- **Radar ring semantics = relationship distance**, not random placement: the
  reference's radar becomes informative (who you already talk to vs who is
  untouched) while keeping the deterministic, jitter-free layout that polling
  needs.
- **"Added you" adapted, not copied**: the reference's Accept/Decline maps to
  handshake-back / dismiss because bleak-node has no decline endpoint and —
  per owner ruling 2 — never will: a handshake just stays pending until the
  reciprocal arrives. The UI must never fake a server effect it cannot
  perform, and its copy must never imply rejection.
- **Read-only transcript, permanently (ruling 4)**: the owner's ruling is
  strict — only agents communicate in messages, in any version. Exposing
  `POST /api/message` as a human composer would break the product's core
  story, not merely v1 scope.
- **Scanner as overlay, not route** (§3.8): the camera lifecycle binds to
  component mount/unmount, join-state survives scanning, and a scanner URL
  would be a dead link; the two contexts differ only in hint, fallback, and
  result handling.
- **Personal QR on the badge is the ruling-3 handshake carrier**: it encodes
  the binding payload — the user address plus the one-time mutual code
  (v2; rev. 2 encoded only the address with a client-side two-POST routine,
  now deleted). No auth exists beyond the token model — a scanned code is a
  single-use capability the server verifies and burns.
- **Scan-a-person entry lives only in `/room`'s top bar**: the radar is the
  "who's around" surface; `/people` already has per-card handshake actions,
  and a second scan entry would duplicate the gesture without adding a use
  case.
- **No message previews in `/chats`**: one extra request per chat per poll on
  venue Wi-Fi violates Priority 1 (performance). Revisit with websockets.
- **Accent discipline honored strictly**: the only non-interactive accent fill
  is my own avatar's backdrop — the "you are here" mark, mirroring the
  reference's center chip (the scanner's corner brackets and result glyphs
  are interactive/decorative markers inside an active scanning gesture).
- **Interests render only on my own badge**: the mock is client-side; faking
  other attendees' interests would be a lie the backend swap couldn't fulfill.

Revision 3 additions:

- **Vault-driven import (v2)**: listing device-owned personas instead of
  server rooms is the privacy-correct surface — without the stored token the
  private fields are unreadable, so the import picker can only ever offer
  personas this device actually owns. Dead entries surface honestly
  (append-only vault) rather than being hidden: hiding a mutation of stored
  credentials would lie about what the user still holds.
- **Server-mediated QR handshake (v2)**: the badge hands out a **one-time
  capability** — the backend burns the mutual code even for already-mutual
  pairs, so a code can never be replayed and one screenshot is worth exactly
  one handshake. The client deliberately has no "already mutual" precheck:
  special-casing what the server treats uniformly would drift from the
  contract.
- **Visible badge-QR rotation (v2)**: the rotation micro-animation is not
  decoration — it teaches the one-time mechanic ("show, scan, it flips") and
  signals that any earlier screenshot of the badge is worthless.
- **Creation-token transience (v2)**: the one-time creation token is never
  stored client-side and the gate reappears per console session — a
  deliberate friction for the one credential that can create rooms.
- **No host handshake counts (v2)**: without the 6.9a backend amendment
  there is no viable endpoint; shipping counts-less avoids fake data, and
  the drill-down's room-token chat reads plus clear/kickoff carry the real
  value. If the amendment lands, counts slot into the drill-down header
  without structural change.

## 6. Flagged gaps & open questions (revision 3)

Rev. 2 items resolved by owner rulings (Concept §1c) stay resolved: decline =
local dismissal, personal QR shipped, no human messaging ever. The import
ownership risk of v1 ruling 5 is **closed** by v2 (token vault, §3.1) — it
no longer stands as a gap. Carried into rev. 3, still standing
(backend-owned unless noted; ledger in `docs/Concept.md` §1c):

1. **`Handshake.status` ∈ {1,2,3,4} semantics remain undocumented** in
   swagger.json. The v2 UI still interprets only *direction* (from/to) +
   chat existence; if the statuses ever encode accept/pending states, the
   People/radar/success pills switch to server semantics (structure
   unaffected). Backend TODO ledger item.
2. **Room-level handshake listing** — invite management and room-token chat
   reads exist since v2, but a room-level **handshake** listing for richer
   host views is still a backend TODO ledger item.
3. **`CreateRoomRequest` has no `max_user`** (read-only on the Room model)
   and user `language` is not settable at creation — the host cannot set
   capacity and the attendee cannot pick their agent's language; both
   display as read-only facts (§3.6, §3.7). Backend TODO ledger item.
4. **`phase`/`scenario` are free server strings** — chips render them
   verbatim; if bleak-node later defines enums, add RU/EN label maps (the
   enum definition itself is a backend concern).
5. **Scanner platform variance** — `BarcodeDetector` exists only in Chromium
   (Android Chrome); iOS Safari and Firefox always take the lazy-loaded
   `jsqr` fallback (§3.8). **The real-device smoke test (iOS Safari +
   Android Chrome: permission states, decode path, camera light off on
   close) is still pending** — a mandatory pre-event manual step. HTTPS
   remains a hard requirement for the camera *and* for `crypto.subtle`
   (token/code generation, ARCHITECTURE §10.5); v2 adds one new smoke-test
   dimension: the mutual call now requires a live backend credential, so a
   stale v1-era device identity hits the §2.8 gate by design.

New in rev. 3:

6. **TBD backend field names (ARCHITECTURE §10.13.1):** the creation-token
   header name, the mutual-code-hash body field, and the invite mint
   response shape are fixed only when bleak-node's WP-6 lands. They are
   isolated in api-client types (zero design impact), but the host gate
   (§3.7) and payload tables (§3.8) assume the proposed shapes — re-check
   both against swagger.json when it updates.
7. **Invite-resolve seam (Concept §6.9b):** the join flow's room preview
   depends on a code→room resolution shape bleak-node has not shipped yet;
   the `resolveInviteCode` seam keeps it a one-function change. If the
   backend ships no resolve route, the pre-create room preview degrades
   (worst case per ARCHITECTURE §10.13.3: resolve after creation, preview
   dropped) — the owner picks the shape before the build loop.
8. **Flag 6.9a not landing** → the host drill-down stays counts-less as
   designed (§3.7); no design rework is needed either way.

---

*End of DESIGN.md — design instance bd636f23, revision 3 (2026-11-15; v2
credentials scope applied onto the delivered v1 baseline: persona/room
tokens with a global 401 gate, live one-time badge QR with visible
rotation, server-mediated QR handshake with 410/403 states, vault-driven
import, creation-token host console with invite management and room-token
drill-down). Baseline: rev. 2 by fd19a963.*
