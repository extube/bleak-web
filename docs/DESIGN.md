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
