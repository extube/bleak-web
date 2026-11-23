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
| `/profile` | `routes/profile/+page.svelte` | attendee | yes | "My profile" screen: centered square avatar + username, 3-stat row, pill tabs (About / Interests / QR code) over the live badge QR — read-only (§4.29) |
| `/profile/settings` | `routes/profile/settings/+page.svelte` | attendee | no | App-level settings sub-page: profile-edit entry row, locale, token rotation, leave room — list-block pattern (§4.29) |
| `/profile/edit` | `routes/profile/edit/+page.svelte` | attendee | no | "Edit profile" sub-page: name/bios, greeting (+ regenerate), local contact card; full-width Save Changes (§4.29) |
| `/host` | `routes/host/+page.svelte` | host | yes* | Host console: one-time creation token, room creation, invite management, share kit, live room view |

*The Host tab is always visible in the tab bar (an attendee may also be the
host); the host page itself never requires an attendee identity.

(The `/profile` row is rewritten and the `/profile/settings` +
`/profile/edit` rows are ADDED by the §4.29 profile-redesign rev,
2026-11-22.)

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
  entry. **SUPERSEDED (Concept §47, 2026-11-23): the resume card is removed
  from the entry surface (`/` → now `/income`) — the default 6-digit form
  always shows; no stored-session resume variant.**
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
    `mutualCode` store but keeps the vault. **SUPERSEDED (Concept §47,
    2026-11-23): /income (the entry surface) ALWAYS shows the default
    6-digit form — the resume variant and its "join another event" action
    are removed; test expectation: the form renders with or without an
    existing identity.**
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

### 4.26 v3.20 feature design (2026-11-22, owner-approved Concept §38): §38 glass-system polish + 4 new landing sections

The owner reviewed the §37 result and issued the seven-item §38 batch: a
**floating liquid-glass header** with **smooth-scroll anchor nav** (HOW IT
WORKS / PRIVACY / USE CASES / JOIN), the stat card becoming a **liquid-glass
banner** with a live-network sub-badge + pulsing status caption, the three
step cards going **glass** with hover glow/lift, mini-illustrations and
micro-pills, a **dark glass footer pill**, and **FOUR new content sections**
below the steps (Live Agent Simulation / Privacy & Control / Use Cases /
Final CTA) whose GET EARLY ACCESS form is a **frontend mailto stub**. This
section amends §4.25 (→ §4.24 → … → §4.20) item by item; **where §4.26 is
silent, the earlier specs stand** except where §4.26.K explicitly supersedes
them (the video layer stack §4.23.A, the keep-list §4.22.A, the open-state
hero regions §4.25.A, the transparent lead §4.25.B, the headline copy +
Start CTA §4.20.C, behavior §4.20.L, motion/a11y baselines §4.20.L/§4.6 all
carry over unchanged unless named below). Grounded in the live code:
`apps/web/src/routes/+page.svelte`,
`lib/components/landing/{LandingVideoHero,LandingFigure}.svelte`,
`figures.ts`, `lib/components/personage/bleakFigure.ts`,
`lib/styles/tokens.css`, `lib/i18n/{en,ru}.ts`,
`tests/landing-page.test.ts`. Hard constraints unchanged: **no new
dependencies** (all effects are native CSS; the new art is hand-authored SVG
rects per §4.3), **no new color values** beyond the sanctioned raw-literal
glass family (§4.26.K.8 — the owner's exact `rgba(…)` values join the
§4.25.D.7 precedent; tokens/`color-mix` everywhere else), **no canvas, no
animation library**, **routes untouched**, **/income surfaces untouched**,
the video asset stays. **API endpoints used: none** — the landing stays
fetch-free (§4.20 preamble); the GET EARLY ACCESS control is a `mailto:`
stub, not a fetch (§4.26.I-2). Task: tz12-10
(`feature/a729241a-tz12-10-glass-sections`).

#### 4.26.A The header: detached floating glass pill + smooth-scroll anchor nav (item 1)

Owner verbatim (Concept §38.1), carried VERBATIM into the spec. The §4.25.C
exact values and the §4.24.A/§4.25.C **80% header width** are superseded
(§4.26.K.1–.2); the keep-list (§4.22.A verbatim: web icon + desktop nav +
switcher; phone icon + switcher) is UNCHANGED.

- **Position — `position: fixed`, top: 24px, decided (the owner offered
  fixed OR sticky):** fixed, because (1) the §38 width — **90% of the
  viewport, max-width 1200px** — cannot come from a sticky header inside
  `.landing`: the container is `max(80%, 280px)` (§4.24.A stands for the
  CONTENT column), so a sticky child is ≤ 80% wide and the retired
  container-breakout hack (§4.24.F.1) cannot reach 90%/1200px either (at
  1280 it yields 1120px, not the owner's 1152px); (2) `fixed` sizes against
  the viewport — the same mechanism §4.25.C already uses — with
  `top: 24px` replacing `top: 0` (detached from the top edge per the
  owner's spec; the video scrolls through the 24px gap above it).
  ```css
  .top {
    position: fixed;
    top: 24px;                     /* the owner's exact value */
    left: 0;
    right: 0;
    margin-inline: auto;           /* centers the fixed element */
    width: 90%;                    /* the owner's exact width */
    max-width: 1200px;             /* the owner's exact cap */
    z-index: 10;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--space-4);
    min-height: 52px;
    padding: 8px 10px;             /* inner chrome unchanged */
    /* --- the owner's EXACT §38.1 values, verbatim ------------------ */
    background: rgba(18, 15, 28, 0.35);
    -webkit-backdrop-filter: blur(18px) saturate(180%);
    backdrop-filter: blur(18px) saturate(180%);
    border: 1px solid rgba(255, 255, 255, 0.2);   /* full border — supersedes
                                      §4.25.C's top/bottom-only rule */
    box-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.35);
    border-radius: var(--radius-md);   /* resolves to the owner's exact
                                      20px (token value 20px) */
  }
  @supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
    .top { background: rgba(18, 15, 28, 0.85); }  /* the §4.25.C fallback
                                      re-pointed to the new tint */
  }
  @media (min-width: 720px) { .top { min-height: 56px; padding: 10px 16px; } }
  ```
  The `@media (max-width: 719.98px) { .top { border-radius: … } }` phone
  chip rule is DELETED — the radius is now 20px at every width (the
  `--radius-md` token alone). Resulting widths: 1280 → 1152px (90%), 800 →
  720px, 390 → 351px, 320 → 288px — the header is WIDER than the 80%
  content column at every viewport ≥ 350px (intended per §38; recorded so
  nobody "fixes" it — §4.26.O.5). Keep-list, inner paddings, min-heights
  and z 10 unchanged.
- **NAV LINKS → SMOOTH-SCROLL ANCHORS (the owner's final directive — the
  "match the full page" line):** the `.top-nav` anchor set is replaced.
  The old anchors (the combined `FIND → CHAT → SHARE` link → `#tutorial`
  and the `BLEAK` link → `#agents`) are SUPERSEDED (§4.26.K.3); the new
  set is exactly four, in this DOM order:
  | # | Label (EN, exact) | Label (RU) | Target | Target section |
  | --- | --- | --- | --- | --- |
  | 1 | `HOW IT WORKS` | «КАК ЭТО РАБОТАЕТ» | `#how-it-works` | the existing three step cards (§4.21.E) |
  | 2 | `PRIVACY` | «ПРИВАТНОСТЬ» | `#privacy` | new Section 5 (§4.26.G) |
  | 3 | `USE CASES` | «СЦЕНАРИИ» | `#use-cases` | new Section 6 (§4.26.H) |
  | 4 | `JOIN` | «ВСТУПИТЬ» | `#join` | new Section 7 (§4.26.I) |
  - **IDs:** the step-cards section's id RENAMES `tutorial` →
    `how-it-works`; Sections 5/6/7 carry `id="privacy"` / `id="use-cases"`
    / `id="join"`. Section 4 (the simulation) gets its own `id="sim"`
    (record) — no nav link targets it (§4.26.F). The `#agents` id STAYS on
    the BLEAK card section (nothing else consumes it) but no nav link
    points at it anymore.
  - **RU labels are design inventions** (the owner gave EN only; §38's
    RU/EN-parity preamble requires keys in both dictionaries) — flagged
    for owner tone approval (§4.26.O.1).
  - **Anchor plumbing:** each target gets `scroll-margin-top: 100px` (the
    24px top gap + ≤ 56px header row + 20px slack — the detached header no
    longer lets 80px clear it). Smooth scroll via CSS, preferred per the
    caller's brief, with the reduced-motion auto fallback:
    ```css
    @media (prefers-reduced-motion: no-preference) {
      :global(html) { scroll-behavior: smooth; }
    }
    ```
    (declared once in the landing page's styles — the global rule exists
    only while `/` is mounted; the default `auto`/instant behavior IS the
    reduced-motion fallback). The anchors keep the established nav style
    (Handjet 12px uppercase `--color-text-muted`, hover `--color-deepa-4`,
    120ms) and stay desktop-only (≥720px; phone = icon + switcher).
- **AA tradeoff (carried):** the §4.25.C owner-order exception carries —
  at a 0.35 tint + blur the same derivation applies (the higher tint
  improves on 0.25's numbers, but over a bright frame the guarantee is
  still the owner's exact-values exception, not the §2.6 baseline). The
  new white border + inset highlight are decorative non-text edges (≥3:1
  not required).

#### 4.26.B The banner: REAL PEOPLE. REAL RESULTS. becomes liquid glass (item 2)

The §4.20.G-a / §4.21.F compact stat card IS this banner — amended **in
place** (same markup slot, same copy contract, same full-width row atop the
post-hero flow, §4.25.A). Only the SURFACE and the additions below change
(§4.26.K.4).

- **Glass surface:** `.stat-body`'s `background: var(--color-surface)` is
  replaced by the owner's exact values:
  ```css
  .stat-body {
    background: rgba(20, 18, 30, 0.55);          /* dark liquid glass */
    -webkit-backdrop-filter: blur(12px);
    backdrop-filter: blur(12px);
  }
  ```
  The pixel-corners/pixel-frame construction (`pixel-corners
  pixel-frame--strong` outer + `pixel-corners` body) is KEPT over the
  glass — the stepped frame lines are the 8-bit identity (the same
  decision as the step cards, §4.26.C); the padding/typography contract
  (§4.21.F: 12px 14px / 16px 20px, 17px title) is unchanged. The pixel
  cityscape of the video blurs right through the fill.
- **Pixel sub-badge above the title** (rendered as the first child of
  `.stat-copy`, above `.stat-title`): `[ LIVE NETWORK // IRL ]` — the
  exact string, key `landing.banner.badge` (RU «[ ЖИВАЯ СЕТЬ // IRL ]» —
  invention flagged, §4.26.O.1). Style — the pixel-badge technique at chip
  scale (the §4.5 two-layer stepped-corner simulated border): an outer
  `<span class="stat-badge pixel-corners">` whose background IS the frame
  color `color-mix(in srgb, var(--color-deepa-4) 60%, transparent)`, with
  an inner `<span class="pixel-corners">` (transparent fill, `padding:
  2px 8px`), text Handjet 11px uppercase, `letter-spacing: 0.08em`,
  `color: var(--color-deepa-4)`; `margin: 0 0 var(--space-2)`.
- **Glowing status caption + pulsing green pixel dot** on the right, next
  to the BLOOM flower: `.stat-glyph` becomes a small right column (flex,
  `align-items: center`, `gap: 6px`): BLOOM unchanged (44px mobile /
  48px desktop, §4.21.F) on top; below it the status row — a **pulsing
  green pixel dot** + the caption `AI Agents active nearby` (key
  `landing.banner.status`; RU «Рядом активны ИИ-агенты»), Handjet 11px
  uppercase `--color-text` with a green glow text-shadow
  (`0 0 8px color-mix(in srgb, var(--color-deepa-1) 45%, transparent)`).
  The dot:
  ```css
  .status-dot {
    width: 6px; height: 6px; flex: none;      /* square — the pixel read */
    background: var(--color-deepa-1);          /* the palette's green */
    box-shadow: 0 0 6px color-mix(in srgb, var(--color-deepa-1) 70%, transparent);
    animation: status-pulse 1.6s steps(2) infinite alternate; /* §4.6 live-dot family */
  }
  @keyframes status-pulse { from { opacity: 1; } to { opacity: 0.4; } }
  ```
  Reduced motion: the base.css catch-all collapses the pulse — the dot is
  static at full opacity. `aria-hidden` on the dot (the caption text
  carries the meaning).

#### 4.26.C The step cards: glass fill + hover glow/lift + mini-illustrations + micro-pills (item 3)

The §4.21.E step blocks (01 FIND / 02 CHAT / 03 SHARE) keep their content
contract VERBATIM — the pixel step number (01/02/03, 40px deepa-4 glow),
the pixel-font title (`landing.tutorial.*`), the step icon
(search / dialog-lines / contact-share, 32px) and the one-line description
(`landing.steps.*.desc`) all stay; the layout (desktop equal thirds
~300px min-height, phone stacked) stays. Amended:

- **Glass surface:** `.step-body`'s `background: var(--color-surface)` is
  replaced:
  ```css
  .step-body {
    background: rgba(15, 14, 22, 0.65);          /* the owner's exact value */
    -webkit-backdrop-filter: blur(10px);
    backdrop-filter: blur(10px);
  }
  ```
- **§4.20.G frame fate — DECIDED: KEEP the pixel frame over glass.** The
  `pixel-corners pixel-frame pixel-frame--strong` outer + `pixel-corners`
  inner construction stays exactly as shipped: the stepped corner lines
  and frame strokes are the page's 8-bit neon signature, and glass only
  replaces the flat fill. `.step-body` therefore still sets NO
  `border-radius` (the existing "stays square" test assertion stays
  green). Dropping the frame was considered and rejected — frameless
  rounded glass cards would erase the pixel language exactly where it is
  most visible.
- **Hover — purple outer glow + slight lift:** the §4.21.E
  "non-interactive, no hover" rule is AMENDED by the owner's batch (the
  steps gain a hover state; they remain non-navigating display blocks —
  no click handler, no cursor change):
  ```css
  .step-block {
    transition: transform 160ms ease-out, filter 160ms ease-out;
  }
  .step-block:hover {
    transform: translateY(-4px);   /* the slight lift */
    filter:
      drop-shadow(0 0 12px color-mix(in srgb, var(--color-deepa-4) 45%, transparent))
      drop-shadow(0 0 36px color-mix(in srgb, var(--color-deepa-4) 20%, transparent));
  }
  @media (prefers-reduced-motion: reduce) {
    .step-block { transition-duration: 0s; }
    .step-block:hover { transform: none; }   /* glow applies instantly, no lift */
  }
  ```
  (No press state — the blocks are not buttons.)
- **Custom pixel mini-illustration, top-right of each card:** an
  absolutely-positioned decorative SVG (top 12px, right 12px, 48×48px,
  `aria-hidden`, `shape-rendering="crispEdges"`, `viewBox="0 0 24 24"`,
  token fills only, transparent background — NO plates, per §4.3;
  original art, no figure reuses another's parts). Each card renders one
  of these three 24×24 constructions (fill / rects `[x, y, w, h]`):
  - **01 FIND — the radar character** (a pixel figure holding a glowing
    radar/scanner):

    | Part | Fill | Rects |
    | --- | --- | --- |
    | Hair | `--color-surface` | `[5,2,10,2]`, `[4,4,2,3]`, `[16,4,2,3]` |
    | Face | `--color-art-skin-1` | `[6,4,10,7]` |
    | Dot eyes | `--color-surface` | `[8,7,2,2]`, `[13,7,2,2]` |
    | Body | `--color-surface-elevated` | `[4,12,12,8]` |
    | Arms | `--color-surface-elevated` | `[2,13,2,5]`, `[16,13,2,4]` |
    | Legs | `--color-surface-elevated` | `[5,20,4,3]`, `[11,20,4,3]` |
    | Radar body | `--color-surface` | `[18,10,5,7]` |
    | Radar ring | `--color-deepa-4` | `[19,11,3,1]`, `[19,15,3,1]`, `[18,12,1,3]`, `[22,12,1,3]` |
    | Radar blip | `--color-deepa-1` | `[20,13,1,1]` |

    the radar group carries the accent glow
    (`filter: drop-shadow(0 0 6px color-mix(in srgb, var(--color-deepa-4)
    60%, transparent))`).
  - **02 CHAT — two avatars + speech bubble** (facing each other):

    | Part | Fill | Rects |
    | --- | --- | --- |
    | Avatar L hair | `--color-surface` | `[1,6,8,3]`, `[1,9,2,4]` |
    | Avatar L face | `--color-art-skin-1` | `[2,8,6,6]` |
    | Avatar L body | `--color-surface-elevated` | `[2,15,6,5]` |
    | Avatar R hair | `--color-deepa-4` | `[15,6,8,3]`, `[21,9,2,4]` |
    | Avatar R face | `--color-art-skin-3` | `[16,8,6,6]` |
    | Avatar R body | `--color-surface-elevated` | `[16,15,6,5]` |
    | Bubble frame | `--color-deepa-4` | `[9,2,7,1]`, `[9,6,7,1]`, `[8,3,1,3]`, `[16,3,1,3]` |
    | Bubble tail | `--color-deepa-4` | `[11,7,2,1]`, `[12,8,1,1]` |
    | Bubble dots | `--color-deepa-4` | `[11,4,1,1]`, `[13,4,1,1]`, `[15,4,1,1]` |

  - **03 SHARE — fist-bump + sparkles** (two arms meeting):

    | Part | Fill | Rects |
    | --- | --- | --- |
    | Arm L | `--color-surface-elevated` | `[1,9,7,4]` |
    | Fist L | `--color-art-skin-2` | `[8,8,5,5]` |
    | Arm R | `--color-surface-elevated` | `[16,9,7,4]` |
    | Fist R | `--color-art-skin-4` | `[11,8,5,5]` |
    | Impact star | `--color-deepa-4` | `[12,3,2,2]`, `[11,5,1,1]`, `[14,5,1,1]` |
    | Sparkle a | `--color-deepa-4` | `[4,3,2,2]` |
    | Sparkle b | `--color-deepa-2` | `[19,4,2,2]` |
    | Sparkle c | `--color-text` | `[12,14,2,1]` |

  (data lives beside the step definitions in `+page.svelte` or a small
  `landing/stepArt.ts` — worker's choice; token fills only.)
- **Bottom micro-pills — EXACT strings** (pixel font, chip style), one per
  card, rendered last in `.step-body` (pushed to the bottom on desktop via
  `margin-top: auto` inside the flex column):
  | Card | EN (exact) | RU |
  | --- | --- | --- |
  | 01 FIND | `RANGE: 50M • REAL-TIME GPS` | «ДАЛЬНОСТЬ: 50М • GPS В РЕАЛЬНОМ ВРЕМЕНИ» |
  | 02 CHAT | `AUTO-INTRO • ZERO AWKWARDNESS` | «АВТО-ЗНАКОМСТВО • НОЛЬ НЕЛОВКОСТИ» |
  | 03 SHARE | `INSTANT SYNC • MUTUAL OPT-IN` | «МГНОВЕННАЯ СИНХРОНИЗАЦИЯ • ВЗАИМНОЕ СОГЛАСИЕ» |
  Style — a chip pill (§4.5: pills are NOT pixel-corners): inline-flex,
  `border: 1px solid color-mix(in srgb, var(--color-deepa-4) 40%,
  transparent)`, `border-radius: var(--radius-pill)`, `color:
  var(--color-deepa-4)`, transparent fill, Handjet 10px (11px ≥720px),
  `letter-spacing: 0.08em`, uppercase, `padding: 4px 10px`,
  `margin-top: var(--space-3)` (phone) / `auto` (desktop).

#### 4.26.D The footer: dark glass pill (item 4)

The §4.21.G contact footer's CONTENT contract carries verbatim — the
copyright row (logo glyph + brand + year) and the EMAIL
(`mailto:extube@proton.me`) / GITHUB (`github.com/extube`,
`rel="noopener noreferrer"`) links with their keys and hover/focus
behavior; the white/purple pixel text is what the footer already renders
(`--color-text` values, `--color-deepa-4` hovers). The SURFACE is
replaced (§4.26.K.6): the `pixel-corners pixel-frame pixel-frame--strong`
outer + `pixel-corners` body construction is retired from the footer and
the block becomes a **dark liquid-glass pill matching the header family**:

```css
.foot-body {
  background: rgba(18, 15, 28, 0.5);        /* the owner's exact value */
  -webkit-backdrop-filter: blur(14px);
  backdrop-filter: blur(14px);
  border: 1px solid rgba(255, 255, 255, 0.2);         /* the header family */
  box-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.35); /* the family highlight */
  border-radius: var(--radius-md);          /* 20px — the glass-surface rounding */
  padding: 16px 20px;
}
```
The footer markup drops all `pixel-corners`/`pixel-frame` classes;
`max-width: 560px` + centered (§4.21.G) stand. The white border + inset
highlight are additions beyond the owner's three named values (the family
recipe, §4.26.E) — recorded. The existing `.foot-body`-stays-square test
assertion retires (§4.26.N-18).

#### 4.26.E The four new sections — shared glass recipe, placement & ids (item 5)

**Placement:** four new sections inside `main.canvas`, in this DOM order
AFTER the step-cards section and BEFORE the footer: **sim → privacy →
use-cases → join**. The `.canvas` flex column's `gap: var(--space-6)`
rhythm spaces them automatically; the phone stack is the DOM order
(no exceptions — one order for both breakpoints).

**Shared surface recipe** (the owner's §38.5 values, applied to each
section's own class — `sim-card`, `privacy-card`, `usecase-pill`,
`join-card` — NOT a shared `.glass` class, which stays retired):

```css
.sim-card, .privacy-card, .usecase-pill, .join-card {
  background: rgba(18, 15, 28, 0.45);        /* the owner's exact fill */
  -webkit-backdrop-filter: blur(16px);
  backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.2);              /* thin white glossy */
  box-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.35);   /* the inset highlight */
  border-radius: var(--radius-md);           /* 20px — glass surfaces are rounded */
}
```

- **Rounded-corner scope amended:** glass surfaces (header, footer, these
  four sections, the join input) are the rounded family; every
  pixel-frame surface (agent card, stat/banner, step cards, sim chat
  window) stays square/stepped (§4.26.K.7).
- **Section titles:** each of the four sections opens with a centered
  Handjet 20px uppercase title, `--color-text`, with the §4.20.A deepa-4
  glow (the 8-bit neon read); keys per section below. Section headings
  are `<h2>`-level (the sections sit below the hero's `h1`); privacy/use
  case card titles are `<h3>`.
- **Inner cards of the privacy section** are NOT glass-stacked: they are
  transparent (`background: transparent`) with a hairline
  `border: 1px solid color-mix(in srgb, var(--color-text) 12%,
  transparent)` and `padding: var(--space-4)` — one backdrop-filter per
  section, no nested blur cost.
- **Neon accents:** titles/icons carry the deepa-4 (or per-icon deepa-N)
  glow recipe; the green (`--color-deepa-1`), yellow (`--color-deepa-2`),
  cyan (`--color-deepa-5`) hues are reserved to the roles specced below
  (status dot / button / scout avatar).

#### 4.26.F Section 4 — LIVE AGENT SIMULATION ("HOW YOUR AGENTS BREAK THE ICE")

`id="sim"` (own id; **no nav anchor targets it** — how-it-works is the
step cards, §4.26.A). One wide glass container (the shared recipe,
full-width row). Contents:

- **Title:** `HOW YOUR AGENTS BREAK THE ICE` (key `landing.sim.title`;
  RU «КАК ВАШИ АГЕНТЫ ЗАВОДЯТ РАЗГОВОР») — the shared title style,
  centered, top of the container.
- **Body grid (≥720px):** `display: grid; grid-template-columns: 1fr auto
  1fr; gap: var(--space-5); align-items: center` — left agent block /
  center chat window / right agent block. **Phone (<720px):** the two
  agent blocks share a 2-col row (`grid-template-columns: 1fr 1fr`) above
  the full-width chat window (a flex column, gap `var(--space-4)`).
- **Left — YOUR AGENT:** the BLEAK personage rendered via
  `LandingFigure kind="bleak" size={64}` (the shared figure — reuse, no
  new art) with the established purple portrait glow (the
  `.agent-portrait` drop-shadow recipe); label `YOUR AGENT` (key
  `landing.sim.you`; RU «ВАШ АГЕНТ»), Handjet 14px uppercase
  `--color-text`; status line `Status: Scanning...` (key
  `landing.sim.you.status`; RU «Статус: Сканирование...»), Handjet 12px
  `--color-deepa-4`. **Decided: static label + blinking pixel cursor** —
  a `6×2px` `--color-deepa-4` block appended after the status text
  (`aria-hidden`), `animation: cursor-blink 1s steps(2) infinite` (opacity
  1↔0); reduced motion → the cursor is statically visible. The label is
  static text (no simulated progress).
- **Right — NEARBY AGENT:** a NEW figure `scout` (cyan/yellow agent) —
  added to `figures.ts` as a third `FigureName` (`'bleak' | 'bloom' |
  'scout' | 'bleakWave'`), rendered via `LandingFigure kind="scout"
  size={64}` with a cyan glow (the drop-shadow recipe re-pointed to
  `--color-deepa-5`); label `NEARBY AGENT` (key `landing.sim.nearby`; RU
  «АГЕНТ РЯДОМ»); status `Distance: 15m` (key
  `landing.sim.nearby.status`; RU «Дистанция: 15м»), Handjet 12px
  `--color-deepa-5`. **SCOUT construction (24×24 grid, `viewW: 24`,
  `viewH: 24`, original art, token fills):**

  | Part | Fill | Rects |
  | --- | --- | --- |
  | Antenna | `--color-deepa-2` | `[11,1,2,3]` |
  | Head | `--color-art-skin-1` | `[8,4,8,6]` |
  | Visor | `--color-deepa-5` | `[7,6,10,2]` |
  | Visor glint | `--color-text` | `[8,6,2,1]` |
  | Body | `--color-surface-elevated` | `[7,11,10,8]` |
  | Chest stripe | `--color-deepa-2` | `[10,13,4,2]` |
  | Legs | `--color-surface-elevated` | `[8,19,3,4]`, `[13,19,3,4]` |

- **Center — the dark pixel chat window:** the established card pattern —
  outer `pixel-corners pixel-frame pixel-frame--strong` + inner
  `pixel-corners` body with `background: var(--color-surface)` (opaque —
  the chat is the "screen", it does not blur), `width: min(100%, 420px)`,
  `padding: 12px 16px`. **EXACTLY 3 rows**, top to bottom:
  1. message from `Agent 01` (key `landing.sim.who1`; RU «Агент 01») —
     text `Shared interests detected: AI, Pixel Art, Coffee.` (key
     `landing.sim.msg1`; RU «Обнаружены общие интересы: ИИ, пиксель-арт,
     кофе.»), left-aligned;
  2. message from `Agent 02` (key `landing.sim.who2`; RU «Агент 02») —
     text `High compatibility (96%). Suggesting IRL intro.` (key
     `landing.sim.msg2`; RU «Совместимость высокая (96%). Рекомендую
     знакомство вживую.»), right-aligned;
  3. the glowing green system badge `[ ICE BROKEN — SAY HELLO ]` (key
     `landing.sim.badge`; RU «[ ЛЁД РАЗБИТ — СКАЖИТЕ ПРИВЕТ ]»),
     centered.
  Row anatomy: speaker label Handjet 10px uppercase
  `--color-text-muted`, message text Inter 13px `--color-text`; rows gap
  `var(--space-2)`. The badge: inline chip, Handjet 12px uppercase,
  `color: var(--color-deepa-1)`, `border: 1px solid color-mix(in srgb,
  var(--color-deepa-1) 50%, transparent)`, glow text-shadow
  `0 0 8px color-mix(in srgb, var(--color-deepa-1) 60%, transparent)`,
  `animation: badge-pulse 1.6s steps(2) infinite alternate` (opacity
  1↔0.7 — the §4.26.B pattern); reduced motion → static. The three
  strings are static (no typewriter, no loop — this is a preview still,
  not the retired §4.20.F strip; nothing animates except the badge pulse
  and the cursor blink).

#### 4.26.G Section 5 — PRIVACY & CONTROL ("BUILT FOR REAL LIFE, NOT STALKERS")

`id="privacy"` (nav target). One glass container (the shared recipe,
full-width row): title `BUILT FOR REAL LIFE, NOT STALKERS` (key
`landing.privacy.title`; RU «СОЗДАНО ДЛЯ РЕАЛЬНОЙ ЖИЗНИ, А НЕ ДЛЯ
СТЕЛКЕРОВ»), then a **3-column grid** (`repeat(3, 1fr)`, gap
`var(--space-5)`, ≥720px) — **phone: a stack** (full-width cards). Each
card: transparent + hairline (§4.26.E), centered column, gap
`var(--space-2)` — pixel icon (48px, `aria-hidden`, 16×16 grid,
`crispEdges`, token fills, original art) → title Handjet 14px uppercase
`--color-text` → desc Inter 13px `--color-text-muted`. The three cards
and icon constructions:

| # | Title (EN, exact) / RU | Desc (EN, exact) / RU | Icon |
| --- | --- | --- | --- |
| A | `GHOST MODE` / «РЕЖИМ ПРИЗРАКА» | `Go invisible on the radar with one tap.` / «Одно касание — и вы исчезаете с радара.» | pixel ghost/hoodie character |
| B | `MUTUAL OPT-IN` / «ВЗАИМНОЕ СОГЛАСИЕ» | `Zero cold DMs. Contacts unlock only after a mutual handshake.` / «Никаких холодных сообщений. Контакты открываются только после взаимного рукопожатия.» | pixel padlock & key |
| C | `EPHEMERAL GPS` / «GPS БЕЗ СЛЕДОВ» | `Your location is processed live and never stored.` / «Ваша геопозиция обрабатывается в реальном времени и никогда не сохраняется.» | pixel shield + radar |

**Icon constructions (16×16; fill / rects `[x, y, w, h]`):**

- **A — ghost/hoodie** (a white ghost with a hood):
  | Part | Fill | Rects |
  | --- | --- | --- |
  | Hood | `--color-text` | `[4,2,8,2]`, `[3,4,2,5]`, `[11,4,2,5]` |
  | Body | `--color-text` | `[4,6,8,6]` |
  | Hem notches | `--color-surface` (cutouts) | `[5,12,1,1]`, `[7,12,1,1]`, `[9,12,1,1]` |
  | Eyes | `--color-surface` | `[6,7,1,2]`, `[9,7,1,2]` |
  | Hood shade | `color-mix(in srgb, var(--color-text) 72%, var(--color-surface))` | `[3,9,2,2]`, `[11,9,2,2]` |
- **B — padlock & key**:
  | Part | Fill | Rects |
  | --- | --- | --- |
  | Shackle | `--color-text-muted` | `[5,2,6,1]`, `[4,3,2,3]`, `[10,3,2,3]` |
  | Lock body | `--color-deepa-4` | `[4,6,8,6]` |
  | Keyhole | `--color-surface` | `[7,8,2,3]` |
  | Key | `--color-accent` | `[11,11,4,1]`, `[14,12,1,2]`, `[12,12,1,1]` |
- **C — shield + radar**:
  | Part | Fill | Rects |
  | --- | --- | --- |
  | Shield outline | `--color-deepa-1` | `[4,2,8,1]`, `[3,3,1,5]`, `[12,3,1,5]`, `[4,8,8,1]`, `[6,9,4,1]`, `[7,10,2,1]` |
  | Radar arcs | `--color-deepa-4` | `[6,4,1,1]`, `[9,4,1,1]`, `[5,5,1,1]`, `[10,5,1,1]`, `[7,6,2,1]` |
  | Radar blip | `--color-deepa-1` | `[8,5,1,1]` |

(RU card titles/descs are inventions flagged in §4.26.O.1; «GPS БЕЗ
СЛЕДОВ» renders the "ephemeral" idea idiomatically.)

#### 4.26.H Section 6 — USE CASES ("WHERE BLEAK SHINES")

`id="use-cases"` (nav target). **Decided structure:** a plain section
(no outer glass container — the glass lives on the pills themselves, per
§38.5's "a 4-column row of glass pills/mini-cards"): centered title
`WHERE BLEAK SHINES` (key `landing.usecases.title`; RU «ГДЕ БЛИК
РАСКРЫВАЕТСЯ»), then a **4-column row** of glass pills
(`repeat(4, 1fr)`, gap `var(--space-4)`, ≥720px). **Phone: a stack**
(full-width pills; a 2×2 of ~140px cells cannot hold «ВЕЧЕРИНКИ И
БАРЫ» without wrapping — the stack is the safe reading; a 2×2 grid is a
one-line change if the owner prefers). Each pill: the shared glass
recipe + `padding: var(--space-4)`, centered column, gap
`var(--space-2)`, `min-height: 112px`: pixel icon (40px, `aria-hidden`,
16×16 grid, token fills) → label Handjet 14px uppercase `--color-text`.

| # | Label (EN, exact) / RU | Icon |
| --- | --- | --- |
| 1 | `CONFERENCES` / «КОНФЕРЕНЦИИ» | pixel badge (id-card on a lanyard) |
| 2 | `PARTIES & BARS` / «ВЕЧЕРИНКИ И БАРЫ» | pixel neon glasses |
| 3 | `COWORKINGS` / «КОУОРКИНГИ» | pixel laptop |
| 4 | `FESTIVALS` / «ФЕСТИВАЛИ» | pixel headphones |

**Icon constructions (16×16; fill / rects):**

- **Badge:** lanyard `--color-text-muted` `[7,1,2,3]`, `[6,3,1,1]`,
  `[9,3,1,1]`; card body `--color-text` `[4,4,8,8]`; photo chip
  `--color-deepa-4` `[6,6,3,3]`; lines `--color-surface` `[10,6,1,1]`,
  `[10,8,1,3]`.
- **Neon glasses:** frame `--color-text` `[2,6,5,1]`, `[9,6,5,1]`,
  `[7,7,2,1]`, `[2,7,1,3]`, `[6,7,1,3]`, `[9,7,1,3]`, `[13,7,1,3]`;
  lenses `--color-deepa-5` `[3,7,3,3]`, `[10,7,3,3]` with the deepa-4
  glow drop-shadow (the neon read).
- **Laptop:** screen `--color-surface` `[3,3,10,7]`; glow rows
  `--color-deepa-4` `[5,5,3,1]`, `[5,7,2,1]`; base `--color-text`
  `[2,10,12,2]`.
- **Headphones:** band `--color-text` `[3,3,10,2]`, `[2,4,2,3]`,
  `[12,4,2,3]`; cups `--color-deepa-2` `[3,7,3,5]`, `[10,7,3,5]`;
  pad glints `--color-deepa-4` `[4,8,1,1]`, `[11,8,1,1]`.

#### 4.26.I Section 7 — FINAL CTA ("JOIN THE NETWORK") + the GET EARLY ACCESS stub (items 5–6)

`id="join"` (nav target). One **centered glass card** (the shared recipe)
+ the **vibrant purple neon glow behind it**:

```css
.join-card {
  max-width: 640px;
  margin: 0 auto;
  padding: var(--space-6) var(--space-5);
  box-shadow:
    inset 0 1px 1px rgba(255, 255, 255, 0.35),
    0 0 32px color-mix(in srgb, var(--color-deepa-4) 45%, transparent),
    0 0 96px color-mix(in srgb, var(--color-deepa-4) 22%, transparent);
}
```

Contents (centered column, gap `var(--space-4)`):

1. **The waving mascot** — `LandingFigure kind="bleakWave" size={96}`:
   the BLEAK personage art REUSED as the base, extended in
   `personage/bleakFigure.ts` with a new exported variant
   `BLEAK_WAVE_FIGURE` (also re-exported through `figures.ts` as the
   `bleakWave` entry so `LandingFigure` renders it — one source of truth,
   zero duplication). **Byte-table (36×32 grid; `viewW: 36`, `viewH:
   32`; the BLEAK parts carry over at identical coordinates except the
   two deltas below):**

   | Part | Fill | Rects |
   | --- | --- | --- |
   | Hair | `--color-surface` | `[9,3,14,3]`, `[9,6,2,3]`, `[21,6,2,3]` |
   | Face | `--color-art-skin-1` | `[10,6,12,10]` |
   | Mouth | `--color-surface` | `[14,13,4,1]` |
   | **Cyber-glasses frame** (replaces the monocle) | `--color-surface` | `[9,9,15,1]`, `[9,10,1,2]`, `[23,10,1,2]` |
   | **Cyber-glasses lenses** | `--color-deepa-5` | `[10,10,5,2]`, `[17,10,5,2]` |
   | Lens glints | `--color-text` | `[10,10,2,1]`, `[17,10,2,1]` |
   | Shoulders / torso / lapels | `--color-surface-elevated` | `[7,18,18,2]`, `[8,20,16,8]`, `[12,20,2,6]`, `[18,20,2,6]` |
   | Shirt collar + front | `--color-text` | `[14,18,4,2]`, `[15,20,2,3]` |
   | Tie | `--color-deepa-4` | `[15,21,2,5]` |
   | **Wave arm** (raised, right side) | `--color-surface-elevated` | `[24,16,3,3]`, `[25,12,3,4]` |
   | **Wave hand** | `--color-art-skin-1` | `[25,9,3,3]` |
   | Wave sparkles | `--color-deepa-4` | `[29,7,1,1]`, `[30,10,1,1]` |

   Deltas vs `BLEAK_FIGURE` exactly: (a) the monocle visor group AND the
   left dot eye are replaced by the cyber-glasses frame + lenses +
   glints; (b) the wave arm/hand/sparkle groups are added. Every other
   rect is byte-identical. Decorative (`aria-hidden` — no label prop).
2. **Headline:** `THE RIGHT CONNECTIONS ARE ALREADY NEARBY.` (key
   `landing.join.headline`; RU «НУЖНЫЕ ЗНАКОМСТВА УЖЕ РЯДОМ.») — Handjet
   20px mobile / 24px ≥720px, uppercase, `--color-text`, centered, the
   §4.20.A deepa-4 glow.
3. **Inline row (≥720px): input + button side-by-side** (input flex 1);
   **phone: stacked** (input full-width, button full-width, gap
   `var(--space-3)`).
   - **Input:** `<input type="text" inputmode="email" autocomplete="email">`
     with `placeholder` = `Enter your email or @telegram...` (key
     `landing.join.input.placeholder`; RU «Введите почту или
     @telegram...») and `aria-label` = the same key (no visible label;
     recorded a11y note). Style — dark glass: `background: rgba(15, 14,
     22, 0.65)`, `border: 1px solid rgba(255, 255, 255, 0.2)`,
     `border-radius: var(--radius-pill)`, `padding: 12px 20px`,
     `min-height: var(--touch-target)`, Inter 14px `--color-text`;
     `:focus-visible` ring per §2.6 (`2px solid var(--color-deepa-4)`,
     offset 2).
   - **Button — GET EARLY ACCESS:** DECIDED **neon yellow** — the
     §4.1 interactive-accent rule reserves `--color-accent` for exactly
     this kind of active element (purple is the ambient glow; the
     yellow pops against it): `background: var(--color-accent)`, `color:
     var(--color-accent-ink)`, Handjet 16px uppercase
     `letter-spacing: 0.08em`, `border-radius: var(--radius-pill)`,
     `padding: 12px 24px`, `min-height: var(--touch-target)`, hover
     glow (drop-shadow accent mixes), press `scale(0.98)`, focus ring.
     (One value flips it to purple if the owner prefers — §4.26.O.3.)
4. **The GET EARLY ACCESS frontend stub (§38.6) — RECORD:**
   - **No backend endpoint exists.** The control is a plain
     `<a class="cta-access">` (a link, not a form — no form element, no
     form library, no fetch, no new env vars) whose `href` is derived
     from the input value:
     `mailto:extube@proton.me?subject=BLEAK%20EARLY%20ACCESS` plus
     `&body=<encodeURIComponent(value)>` **only when the input is
     non-empty**; an empty input opens the bare mailto (empty body).
     The subject literal `BLEAK EARLY ACCESS` is locale-invariant.
   - **Client validation: NONE (lean decision).** `type="email"` would
     natively block `@telegram` handles; `type="text"` +
     `inputmode="email"` passes any handle straight into the mailto
     body. The stub sends whatever was typed, unvalidated, to the
     owner's inbox — exactly the §38.6 default.
   - **What changes when the owner wires a real endpoint:** the anchor
     becomes a `<button type="button">` with one `fetch POST` handler
     to the endpoint (loading/disabled/error states added then); the
     input, both keys, the markup and this section's layout are
     unchanged. No other surface moves.
   - The button's accessible name = `landing.join.button` (`GET EARLY
     ACCESS` / «ПОЛУЧИТЬ РАННИЙ ДОСТУП»); it navigates via the
     `mailto:` link (native behavior — no JS handler in this pass).

#### 4.26.J The open-state rule, layer stack & page-growth audit (item 7)

- **§37's open-state rule STAYS untouched (§4.25.A carries):** the first
  viewport still contains ONLY the lead block and the BLEAK agent card
  (plus the fixed header chrome), vertically centered — desktop: the
  `.stage` 100dvh thirds hero; phone: `.area-lead` as the 100dvh hero.
  ALL new content (the glass banner, the hover-glass steps, the FOUR new
  sections, the glass footer) lives in the normal flow AFTER `.stage` —
  below the fold at open, revealed on scroll. The new DOM appends
  strictly after the hero region; no spacer, no scroll-lock, no
  scroll-hijack is added. Verified geometry: at 1280×800 and 390×844 the
  hero region still occupies exactly the first viewport and the banner
  begins below it.
- **The z-order still holds as the page grows:** the new sections are
  plain z-3 content (children of `.landing`, which carries
  `position: relative; z-index: 3`) — they scroll over the fixed video
  (z 0) + vignette/30% tint (z 1) + dots (z 2), under the fixed header
  (z 10). No new stacking context escapes the content column (the
  sections use no `position: fixed/absolute` except the step-cards'
  internal illustration, which is inside its own card). The blur
  backdrops sample the fixed video through the z-1 wash — the intended
  "pixel cityscape glows behind the glass" read.
- **The video layer is untouched:** the same committed asset, the same
  attribute set, the same gated one-shot mount `.play()`, the same
  error fallback (§4.23.A/§4.23.G); the 12-dot mesh keeps twinkling in
  the gaps between the new sections (the ambient "sky").
- **Reduced motion — static fallbacks for ALL new pulse/hover/glow:**
  the banner status dot, the sim badge pulse and the cursor blink
  collapse via the established base.css catch-all (static, full
  opacity / cursor visible); the step hover lift is suppressed
  (`transform: none`) with the glow applying instantly; the hover
  glows of existing cards/CTAs are unchanged state colors. The
  scroll-behavior smooth rule is scoped under
  `prefers-reduced-motion: no-preference` (default instant otherwise).
  The video fallback itself is unchanged (§4.25.F verbatim).
- **Interaction states:** unchanged in kind — the landing still fetches
  nothing (no loading/empty/error data states, §4.20.L); the video
  media states are §4.23.G verbatim; the only new interactive element
  is the mailto stub (a native link — no JS states).

#### 4.26.K Supersessions (explicit record)

1. **§4.25.C header exact values SUPERSEDED by §38.1's:** `rgba(20, 20,
   30, 0.25)` → `rgba(18, 15, 28, 0.35)`; `blur(16px) saturate(180%)` →
   `blur(18px) saturate(180%)`; the top/bottom-only
   `1px rgba(255, 255, 255, 0.15)` borders + `inset 0 1px 0 rgba(255,
   255, 255, 0.15)` → the full `1px rgba(255, 255, 255, 0.2)` border +
   `inset 0 1px 1px rgba(255, 255, 255, 0.35)`; `top: 0` → `top: 24px`.
   Position stays FIXED (the owner's "fixed or sticky" resolved for
   fixed — §4.26.A; §4.25.C's justification carries).
2. **§4.24.A/§4.25.C 80% HEADER width SUPERSEDED:** the header now spans
   `width: 90%; max-width: 1200px` (viewport-relative, `margin-inline:
   auto`). The CONTENT container `.landing` KEEPS `max(80%, 280px)`
   (§38 is silent on it — the §36/§4.24.A container rule stands; the
   header is deliberately wider than the content, §4.26.O.5).
3. **§4.20.B/§4.22.A/§4.25.C nav anchor set SUPERSEDED:** the two old
   anchors (→ `#tutorial`, → `#agents`) are replaced by the four
   smooth-scroll anchors (HOW IT WORKS / PRIVACY / USE CASES / JOIN);
   the step section's id renames `tutorial` → `how-it-works`; `#agents`
   remains as an id with no nav link. The `landing.tutorial.*` keys
   survive as the step titles (their nav-anchor reuse dies).
4. **§4.20.G-a/§4.21.F banner surface SUPERSEDED:** the stat card's
   opaque `--color-surface` body fill becomes glass
   (`rgba(20, 18, 30, 0.55)` + blur 12px); the §4.20.G pixel frame is
   KEPT over the glass; the §4.21.F padding/typography contract stands.
5. **§4.21.E step blocks amended:** the opaque fill becomes glass
   (`rgba(15, 14, 22, 0.65)` + blur 10px); the "non-interactive, no
   hover/motion" rule gains the owner's hover glow + lift (the blocks
   still navigate nowhere); the §4.20.G frame is KEPT over the glass
   (the §4.24.F.4 "pixel frames stay square" reading holds — the test
   assertion stays green).
6. **§4.21.G footer surface SUPERSEDED:** the pixel-framed
   `--color-surface` block becomes the dark glass pill
   (`rgba(18, 15, 28, 0.5)` + blur 14px + the white border + the inset
   highlight, radius 20px); the content keys, links and centered
   max-width 560px stand.
7. **§4.24.F.4 rounded-corner scope amended:** glass surfaces (header,
   footer, the four new sections, the join input) are the rounded
   family (radius-md 20px); pixel-frame surfaces (agent card, banner,
   steps, sim chat window) stay square/stepped. The `.foot-body`
   stays-square test assertion retires; `.step-body` keeps its
   square assertion.
8. **Sanctioned palette exception (record, extends §4.25.D.7):** the
   owner's §38 `rgba(…)` literals (header 0.35/0.2/0.35, banner 0.55,
   steps 0.65, footer 0.5, sections 0.45 + the shared white
   border/highlight pair, the join input's `rgba(15, 14, 22, 0.65)`,
   the fallback `rgba(18, 15, 28, 0.85)`) are raw literals outside the
   token palette — sanctioned by the owner's exact-value spec (§38) and
   recorded here; everywhere else the token/`color-mix` rule stands.
   Suite note: the raw-hex guard (`#[0-9a-fA-F]{3,8}`) cannot match
   `rgba(…)` literals — the sweep stays green without a waiver; and no
   `.glass` class is introduced (the retired-class assertion stays
   green — per-section class names only).
9. **Superseded-but-carried (unchanged into §4.26):** the §4.23.A fixed
   layer stack (z 0–10), the decisive video attribute set, the gated
   one-shot mount `.play()`, the error fallback, the 12-dot mesh, the
   §4.22.A keep-list, the §4.25.A/B open state + transparent lead, the
   §4.20.C copy/CTA, the §4.20.L behavior + deep-link forwarding, the
   §4.20.G agent-card contract and the §4.23.G reduced-motion fallback
   all carry unchanged.

#### 4.26.L RU/EN i18n delta (35 new keys; grep-audited; both dictionaries required)

**35 new keys** — every string §38 speaks, EN verbatim from Concept §38.5,
RU as specced above (inventions flagged in §4.26.O.1). The existing 23
`landing.*` keys are unchanged; **new parity total: 58 keys per
dictionary** (`LANDING_KEYS` extends 23 → 58; `DEAD_KEYS` unchanged).

| Δ | Key | RU | EN |
| --- | --- | --- | --- |
| + | `landing.nav.how` | КАК ЭТО РАБОТАЕТ | HOW IT WORKS |
| + | `landing.nav.privacy` | ПРИВАТНОСТЬ | PRIVACY |
| + | `landing.nav.usecases` | СЦЕНАРИИ | USE CASES |
| + | `landing.nav.join` | ВСТУПИТЬ | JOIN |
| + | `landing.banner.badge` | [ ЖИВАЯ СЕТЬ // IRL ] | [ LIVE NETWORK // IRL ] |
| + | `landing.banner.status` | Рядом активны ИИ-агенты | AI Agents active nearby |
| + | `landing.steps.find.pill` | ДАЛЬНОСТЬ: 50М • GPS В РЕАЛЬНОМ ВРЕМЕНИ | RANGE: 50M • REAL-TIME GPS |
| + | `landing.steps.chat.pill` | АВТО-ЗНАКОМСТВО • НОЛЬ НЕЛОВКОСТИ | AUTO-INTRO • ZERO AWKWARDNESS |
| + | `landing.steps.share.pill` | МГНОВЕННАЯ СИНХРОНИЗАЦИЯ • ВЗАИМНОЕ СОГЛАСИЕ | INSTANT SYNC • MUTUAL OPT-IN |
| + | `landing.sim.title` | КАК ВАШИ АГЕНТЫ ЗАВОДЯТ РАЗГОВОР | HOW YOUR AGENTS BREAK THE ICE |
| + | `landing.sim.you` | ВАШ АГЕНТ | YOUR AGENT |
| + | `landing.sim.you.status` | Статус: Сканирование... | Status: Scanning... |
| + | `landing.sim.nearby` | АГЕНТ РЯДОМ | NEARBY AGENT |
| + | `landing.sim.nearby.status` | Дистанция: 15м | Distance: 15m |
| + | `landing.sim.who1` | Агент 01 | Agent 01 |
| + | `landing.sim.who2` | Агент 02 | Agent 02 |
| + | `landing.sim.msg1` | Обнаружены общие интересы: ИИ, пиксель-арт, кофе. | Shared interests detected: AI, Pixel Art, Coffee. |
| + | `landing.sim.msg2` | Совместимость высокая (96%). Рекомендую знакомство вживую. | High compatibility (96%). Suggesting IRL intro. |
| + | `landing.sim.badge` | [ ЛЁД РАЗБИТ — СКАЖИТЕ ПРИВЕТ ] | [ ICE BROKEN — SAY HELLO ] |
| + | `landing.privacy.title` | СОЗДАНО ДЛЯ РЕАЛЬНОЙ ЖИЗНИ, А НЕ ДЛЯ СТЕЛКЕРОВ | BUILT FOR REAL LIFE, NOT STALKERS |
| + | `landing.privacy.ghost.title` | РЕЖИМ ПРИЗРАКА | GHOST MODE |
| + | `landing.privacy.ghost.desc` | Одно касание — и вы исчезаете с радара. | Go invisible on the radar with one tap. |
| + | `landing.privacy.mutual.title` | ВЗАИМНОЕ СОГЛАСИЕ | MUTUAL OPT-IN |
| + | `landing.privacy.mutual.desc` | Никаких холодных сообщений. Контакты открываются только после взаимного рукопожатия. | Zero cold DMs. Contacts unlock only after a mutual handshake. |
| + | `landing.privacy.gps.title` | GPS БЕЗ СЛЕДОВ | EPHEMERAL GPS |
| + | `landing.privacy.gps.desc` | Ваша геопозиция обрабатывается в реальном времени и никогда не сохраняется. | Your location is processed live and never stored. |
| + | `landing.usecases.title` | ГДЕ БЛИК РАСКРЫВАЕТСЯ | WHERE BLEAK SHINES |
| + | `landing.usecases.conferences` | КОНФЕРЕНЦИИ | CONFERENCES |
| + | `landing.usecases.parties` | ВЕЧЕРИНКИ И БАРЫ | PARTIES & BARS |
| + | `landing.usecases.coworkings` | КОУОРКИНГИ | COWORKINGS |
| + | `landing.usecases.festivals` | ФЕСТИВАЛИ | FESTIVALS |
| + | `landing.join.title` | ВСТУПАЙТЕ В СЕТЬ | JOIN THE NETWORK |
| + | `landing.join.headline` | НУЖНЫЕ ЗНАКОМСТВА УЖЕ РЯДОМ. | THE RIGHT CONNECTIONS ARE ALREADY NEARBY. |
| + | `landing.join.input.placeholder` | Введите почту или @telegram... | Enter your email or @telegram... |
| + | `landing.join.button` | ПОЛУЧИТЬ РАННИЙ ДОСТУП | GET EARLY ACCESS |

Grep-audit instructions (worker): after landing, `landing.nav.` /
`landing.banner.` / `landing.sim.` / `landing.privacy.` /
`landing.usecases.` / `landing.join.` appear ONLY in `en.ts`, `ru.ts`,
`+page.svelte` (or their section components) and the tests — no other
route or component consumes them; the three `.pill` keys render beside
the step descriptions; `landing.join.title` renders above the
`join-card` (it doubles as the section's `<h2>`). The RU/EN switch
re-renders every new string without a reload (the parity + re-render
test pattern extends to the new keys).

#### 4.26.M Reduced motion + media states

Unchanged in kind from §4.23.G/§4.25.F: the video stays paused at frame 0
with the tint + vignette + dots as the static state; the dot mesh is
static. New elements' static fallbacks (§4.26.J): the banner status dot
static at full opacity, the sim badge static, the cursor statically
visible, hover lifts suppressed with instant glow, smooth-scroll scoped
to `no-preference`. All new keyframes (`status-pulse`, `badge-pulse`,
`cursor-blink`) are transform/opacity-only (§4.6). No loading/empty/error
data states exist (the landing fetches nothing); the video error
fallback shows every new section over the near-black treatment (the
glass still reads — blur over the static tint). No layout shift: the new
sections are normal-flow blocks; the glass surfaces have no media-load
dependency.

#### 4.26.N Acceptance criteria (checkable)

**Header (item 1):**
1. `.top` computes the owner's EXACT §38.1 values verbatim:
   `position: fixed; top: 24px`, `left/right: 0` + `margin-inline: auto`,
   `width: 90%; max-width: 1200px`, `border-radius` 20px (token),
   `background: rgba(18, 15, 28, 0.35)`, `backdrop-filter: blur(18px)
   saturate(180%)` AND `-webkit-backdrop-filter: blur(18px)
   saturate(180%)`, `border: 1px solid rgba(255, 255, 255, 0.2)` (all
   four sides — the §4.25.C top/bottom-only rule is gone),
   `box-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.35)`; the
   `@supports not (…)` fallback sets `rgba(18, 15, 28, 0.85)`; z-index
   10; the keep-list is UNCHANGED (§4.22.A: icon + desktop nav +
   switcher; phone icon + switcher) and the video scrolls beneath the
   24px gap and through the glass.
2. Widths: 1152px at 1280, 720px at 800, 351px at 390, 288px at 320 —
   wider than the 80% content column (which still measures 1024/312/280
   per §4.24.A); the content container rule is unchanged.
3. The nav renders EXACTLY four desktop-only anchors in order — HOW IT
   WORKS → `#how-it-works`, PRIVACY → `#privacy`, USE CASES →
   `#use-cases`, JOIN → `#join` (EN labels verbatim; RU «КАК ЭТО
   РАБОТАЕТ» / «ПРИВАТНОСТЬ» / «СЦЕНАРИИ» / «ВСТУПИТЬ») — and the old
   `#tutorial`/`#agents` nav links are gone (no `href="#tutorial"`, no
   `href="#agents"` anywhere on `/`).
4. The anchor targets exist and clear the header: the step-cards section
   carries `id="how-it-works"` (the `tutorial` id is gone), Sections
   5/6/7 carry `id="privacy"` / `id="use-cases"` / `id="join"`; each
   target sets `scroll-margin-top: 100px`; clicking an anchor smooth-
   scrolls (CSS `scroll-behavior: smooth` under
   `prefers-reduced-motion: no-preference`) and lands with the section
   title below the glass header at 1280×800 and 390×844.

**Banner (item 2):**
5. The stat card's body is glass: `background: rgba(20, 18, 30, 0.55)` +
   `backdrop-filter`/`-webkit-backdrop-filter: blur(12px)`; the
   pixel-corners/pixel-frame construction is KEPT (the outer
   `.stat-card` still carries `pixel-corners pixel-frame
   pixel-frame--strong`); the §4.21.F compact padding/typography and the
   stat copy (`landing.stat.*`) are unchanged.
6. The sub-badge `[ LIVE NETWORK // IRL ]` (RU «[ ЖИВАЯ СЕТЬ // IRL ]»)
   renders above the title as a pixel-badge chip (stepped-corner two-
   layer construction, deepa-4 frame at 60%, Handjet 11px uppercase).
7. The status caption `AI Agents active nearby` (RU «Рядом активны
   ИИ-агенты») renders on the right next to the BLOOM glyph with a
   square 6px `--color-deepa-1` pixel dot pulsing `steps(2)` 1.6s
   (opacity 1↔0.4, green glow); reduced motion → the dot is static at
   full opacity.

**Step cards (item 3):**
8. Each step body is glass: `background: rgba(15, 14, 22, 0.65)` +
   blur(10px) (both prefixes); `.step-body` still sets NO
   `border-radius` (the pixel frame stays square/stepped over the
   glass); the 01/02/03 numbers, pixel titles, step icons and
   descriptions are unchanged (§4.21.E content contract).
9. Hover: `translateY(-4px)` + the purple double drop-shadow glow over a
   160ms ease-out transition; under reduced motion the lift is
   suppressed (`transform: none`) and the glow applies instantly; no
   press/click state exists.
10. Each card carries a 48×48px decorative pixel-art SVG top-right
    (`aria-hidden`, `crispEdges`, 24×24 grid, token fills only): 01 =
    the radar character, 02 = two avatars + bubble, 03 = fist-bump +
    sparkles — original rect art per the §4.26.C tables, no background
    plates, no figure reusing another's parts.
11. The bottom micro-pills render EXACTLY `RANGE: 50M • REAL-TIME GPS` /
    `AUTO-INTRO • ZERO AWKWARDNESS` / `INSTANT SYNC • MUTUAL OPT-IN`
    (RU per §4.26.L) as pill chips (Handjet 10/11px uppercase, deepa-4
    text + 40% border, radius-pill), pinned to the card bottom on
    desktop (`margin-top: auto`).

**Footer (item 4):**
12. The footer is a dark glass pill: `rgba(18, 15, 28, 0.5)` +
    blur(14px) (both prefixes) + `border: 1px solid rgba(255, 255, 255,
    0.2)` + `box-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.35)` +
    `border-radius: var(--radius-md)`; NO `pixel-corners`/`pixel-frame`
    class remains on it; max-width 560px centered; the copyright row +
    EMAIL (`mailto:extube@proton.me`) / GITHUB links and their keys/
    hover/focus contracts are unchanged.

**The four new sections (item 5):**
13. DOM order after the step cards and before the footer: sim → privacy
    → use-cases → join, each as a normal-flow row of the 80% container
    (the `--space-6` gap rhythm); phone stacks in the same order; no
    horizontal scroll at 320/760/1280.
14. Each glass surface (`.sim-card`, `.privacy-card`, `.usecase-pill`,
    `.join-card`) carries the shared recipe verbatim: `rgba(18, 15, 28,
    0.45)` + blur(16px) (both prefixes) + `border: 1px solid rgba(255,
    255, 255, 0.2)` + `box-shadow: inset 0 1px 1px rgba(255, 255, 255,
    0.35)` + `border-radius: var(--radius-md)`; NO `.glass` class
    exists in the landing sources.
15. Section 4 (`#sim`): wide glass container; left block = the BLEAK
    personage (64px, purple glow) + `YOUR AGENT` + `Status:
    Scanning...` with the blinking 6×2px deepa-4 cursor (reduced motion
    → cursor statically visible); right block = the SCOUT figure (new
    cyan/yellow 24×24 art per the §4.26.F table, cyan glow) + `NEARBY
    AGENT` + `Distance: 15m`; ≥720px = 1fr/auto/1fr grid, phone =
    2-col avatar row + full-width chat window.
16. The sim chat window is the dark opaque pixel-frame card
    (`--color-surface` body, `pixel-corners` construction) with
    EXACTLY 3 rows: `Agent 01` — `Shared interests detected: AI, Pixel
    Art, Coffee.` (left), `Agent 02` — `High compatibility (96%).
    Suggesting IRL intro.` (right), and the centered glowing green
    badge `[ ICE BROKEN — SAY HELLO ]` (deepa-1, pulse 1.6s steps(2);
    reduced motion → static); no fourth row, no typewriter loop.
17. Section 5 (`#privacy`): glass container titled `BUILT FOR REAL
    LIFE, NOT STALKERS`; a 3-col grid ≥720px / a stack on phone; the
    three cards carry the ghost / padlock+key / shield+radar 48px pixel
    icons and the exact titles/descs (`GHOST MODE` / `MUTUAL OPT-IN` /
    `EPHEMERAL GPS` + their sentences, RU per §4.26.L).
18. Section 6 (`#use-cases`): title `WHERE BLEAK SHINES`; a 4-col pill
    row ≥720px / a stack on phone; the pills carry the badge /
    neon-glasses / laptop / headphones 40px pixel icons and the exact
    labels `CONFERENCES` / `PARTIES & BARS` / `COWORKINGS` /
    `FESTIVALS`.
19. Section 7 (`#join`): a centered glass card (max-width 640px) with
    the purple outer glow (`0 0 32px … 45%` + `0 0 96px … 22%` over the
    inset highlight); the waving BLEAK-WAVE mascot (96px, the wave arm
    + cyber-glasses deltas; every other rect byte-identical to
    `BLEAK_FIGURE`); the headline `THE RIGHT CONNECTIONS ARE ALREADY
    NEARBY.` (RU «НУЖНЫЕ ЗНАКОМСТВА УЖЕ РЯДОМ.»); the dark glass input
    (`rgba(15, 14, 22, 0.65)`, radius-pill, `aria-label` = placeholder
    key) with the exact placeholder; the GET EARLY ACCESS button
    (`--color-accent` bg, `--color-accent-ink` text).

**The GET EARLY ACCESS stub (item 6):**
20. Submitting = opening `mailto:extube@proton.me` with subject `BLEAK
    EARLY ACCESS` and — only when the input is non-empty — a
    URL-encoded body equal to the input value (empty input → no body
    param); it is a native `<a>` link (no form element, no fetch, no
    new env, no form library, NO client validation — `type="text"` +
    `inputmode="email"`); the mailto address matches the footer's
    published contact.

**Open state, layers, i18n, suites (item 7 + carry):**
21. Open state intact: at the scroll origin the first viewport contains
    ONLY the lead block and the BLEAK agent card (plus the fixed
    header chrome) at BOTH 1280×800 and 390×844; the banner, steps,
    the four new sections and the footer begin below the fold; no
    spacer returns (`calc(200dvh / 3)` stays absent).
22. The layer stack holds with the grown page: video z 0 / vignette +
    tint z 1 / dots z 2 / content z 3 / header z 10 — the new sections
    are z-3 content scrolling over the video; the 12-dot mesh stays
    below the content; the video attributes and gated playback are
    untouched.
23. i18n: exactly **58** `landing.*` keys in BOTH dictionaries (23
    existing + the 35 new keys above, EN strings verbatim); the
    dead-key list is unchanged; the RU/EN switch re-renders every new
    string without a reload; the parity/dead-key tests pass amended.
24. Reduced motion: the status dot, sim badge, cursor blink, step
    hover-lift and smooth-scroll all have static/instant fallbacks;
    the video fallback is unchanged (§4.25.F).
25. Suites amended and green: `landing-page.test.ts` — the §4.25.C
    header-value assertions REPLACED by ACs 1–4 (top 24px, 90%/1200px,
    radius 20px, the 0.35/0.2/0.35 glass set, the full border, the
    fallback), the `.foot-body` square assertion RETIRED, the
    `.step-body` square assertion KEPT, new banner/step/footer/section/
    stub assertions per ACs 5–20, `LANDING_KEYS` extended to 58 — plus
    `i18n.test.ts` (58-key parity), `sweep.test.ts` (token discipline;
    the rgba literals stay unmatched and unwaivered), `mascot.test.ts`
    (the two new figures render — scout + bleakWave — with the base
    BLEAK art unchanged), `join-flow.test.ts` /
    `creation-wizard.test.ts` untouched and green;
    `make lint && make test && make build` green.
26. Constraints: no new dependencies; routes untouched; `/income`
    untouched; the video asset stays; the mailto stub is frontend-only
    (no fetch on `/` — "API endpoints used: none" stands); no canvas,
    no animation library; palette tokens + the sanctioned rgba family
    only.

#### 4.26.O Flags for the owner / concept (concept report)

1. **ADVICE NEEDED — RU strings for the new copy are design
   inventions:** the owner's §38.5 gives EN only; this spec supplies RU
   for all 35 keys (nav labels, the `[ ЖИВАЯ СЕТЬ // IRL ]` badge, the
   statuses, the simulation messages, the section titles/descs, the
   placeholder, the button) per the RU/EN-parity preamble. Owner tone
   approval requested with the batch (the §4.20.O-2 precedent).
2. **Record — the nav RU label «ВСТУПИТЬ»** renders "JOIN" as a call to
   the final CTA section; if the owner prefers «ПРИСОЕДИНИТЬСЯ» or
   another form it is a one-value change.
3. **Record — GET EARLY ACCESS is neon YELLOW** (`--color-accent`, the
   §4.1 interactive-accent rule); §38.5 offered "bright neon yellow or
   purple pixel button" — yellow was decided so the button pops against
   the purple glow; a one-value flip to `--color-deepa-4` (+ ink swap)
   if the owner prefers purple.
4. **Record — the GET EARLY ACCESS stub:** mailto to
   `extube@proton.me` (the footer's published contact) with subject
   `BLEAK EARLY ACCESS` and the raw input value as the body; no
   validation by design (so `@telegram` handles pass through). When a
   real endpoint lands: anchor → button + one fetch handler; everything
   else stays.
5. **Record — the header is deliberately wider than the content:** 90%
   (max 1200px) vs the 80% content container — both are owner specs
   (§38.1 header; §36/§4.24.A container); do not "harmonize" them.
6. **Record — Section 4 has no nav anchor** (`id="sim"` only): the
   owner's anchor map names four targets; how-it-works is the step
   cards, not the simulation.

### 4.27 v3.21 feature design (2026-11-22, owner-approved Concept §39): §39 font bumps + compatibility circle + ping-pong video

The owner issued the four-item §39 follow-up batch: bigger header-nav
titles (the language switcher keeps its size), bigger block
descriptions, Section 4's center reworked to ONLY the 96% compatibility
display — an animated count-up inside a circle, reusing the /chats
summary-sheet indicator pattern — with the ICE BROKEN badge below it and
the two flanking agent avatars kept, and the background video playing
ping-pong (forward → reverse → forward, continuously) instead of
looping. This section amends §4.26 (→ §4.25 → … → §4.20) item by item;
**where §4.27 is silent, the earlier specs stand** except where
§4.27.F explicitly supersedes them. Grounded in the live code:
`apps/web/src/routes/+page.svelte`,
`lib/components/landing/LandingVideoHero.svelte`,
`lib/components/landing/{sectionArt,figures}.ts`,
`lib/components/personage/bleakFigure.ts`,
`lib/components/SummarySheet.svelte` + `lib/chats/summary.ts` (the
pattern source), `lib/i18n/{en,ru}.ts`, `tests/landing-page.test.ts`.
Hard constraints unchanged: **no new dependencies** (the ring helpers
and the ping-pong stepper are imports + hand-rolled native code; the
stepper's pure unit is a tiny local module per the `sectionArt.ts`
precedent), **no new color values** (token/`color-mix` only — the
sanctioned §38 rgba family is untouched and nothing is added to it),
**no canvas, no animation library**, **routes untouched**, **/income
surfaces untouched**, the video asset stays, all reduced-motion
fallbacks preserved. **API endpoints used: none** — the landing stays
fetch-free (§4.20 preamble); the round is presentational. Task:
tz12-11 (`feature/43e60f70-tz12-11-fonts-compat-pingpong`).

#### 4.27.A Nav font bump — the four anchor links (item 1)

The §4.26.A nav anchor set (HOW IT WORKS / PRIVACY / USE CASES / JOIN,
smooth-scroll, desktop-only ≥720px) is unchanged in every respect
except SIZE: `.top-nav a` goes **font-size: 12px → 14px** (a +2px bump
in the owner's "+2–4px" band; Handjet is condensed so 14px still reads
as chrome, not as a headline). Everything else about the anchors is
UNCHANGED and stays verbatim: `font-family: var(--font-pixel)`,
`font-weight: 600`, `letter-spacing: 0.08em`, uppercase,
`color: var(--color-text-muted)`, hover `--color-deepa-4` over 120ms,
the desktop-only `display: none → flex` media rule, and the header's
min-heights/paddings (52px/56px rows — 14px labels fit; at the 720px
viewport the four labels + icon + switcher hold one line each, no
wrap). **The language switcher size is UNCHANGED — explicit negative:**
`LocaleControl.svelte` and `SegmentedControl.svelte` are untouched
files, the switcher's buttons stay at their 14px, and NO landing style
overrides sizes inside `.locale` (the test suite asserts this
negatively — the switcher is not dragged along by the bump).

#### 4.27.B Description font bumps — one consistent +2px across blocks (item 2)

The owner leaves the exact size to the design ("a clearly visible
bump, consistent across blocks", §39.2). Decided: **every card
mini-description goes Inter 13px → 15px** — ONE value, the same
everywhere, on the four description classes that play the
"mini description inside a content block" role:

| Class | Block | From → To |
| --- | --- | --- |
| `.step-desc` | the three step cards (§4.26.C) | 13px → 15px |
| `.privacy-desc` | the three privacy cards (§4.26.G) | 13px → 15px |
| `.stat-line` | the banner's mini-lines (§4.26.B) | 13px → 15px |
| `.agent-quote` | the BLEAK agent card quote (§4.20.G) | 13px → 15px |

(`.stat-line` and `.agent-quote` are the "etc." reading — they are the
remaining card-body mini-texts at 13px; including them keeps the bump
consistent across ALL blocks, which is the owner's stated intent.
Excluding either is a one-line change — §4.27.J flag 2.) Family
(`var(--font-body)`), colors (`--color-text-muted`, `--color-text`)
and existing line-height declarations are otherwise unchanged — only
the `font-size` value moves. **Wrap sanity at the 288px desktop
thirds:** at 15px the longest RU desc («Никаких холодных сообщений.
Контакты открываются только после взаимного рукопожатия.») wraps to
~3 lines in a ~248px card interior — the privacy cards and step cards
grow naturally (normal-flow blocks), the step cards keep their
min-height 300px with the pill pinned via `margin-top: auto`
(whitespace shrinks, nothing overflows at 320/760/1280), and the
banner's three lines still fit the compact flex row. **Explicit
negatives — NOT card descriptions, unchanged:** the lead `.sub`
(stays 14px/16px ≥720px) and the join input (stays 14px); the removed
`.sim-msg` (13px) dies with the chat window (§4.27.C).

#### 4.27.C Section 4 center rework — deletions (item 3)

`#sim` keeps its title (`landing.sim.title`), its glass container and
its TWO FLANKING AGENT BLOCKS verbatim (§4.26.F, unchanged down to the
blinking cursor and the purple/cyan glows). The CENTER changes:

- **DELETED — the 3-message chat window:** the entire
  `.sim-chat` / `.sim-chat-body` / `.sim-row*` / `.sim-who` /
  `.sim-msg` markup and CSS (the opaque pixel-frame "screen", the
  Agent 01 / Agent 02 rows, the left/right alignment classes) goes
  away. The orphaned keys — grep-audited live: `landing.sim.who1`,
  `landing.sim.who2`, `landing.sim.msg1`, `landing.sim.msg2` appear
  ONLY in `en.ts`/`ru.ts` (~456–459), the sim rows of
  `+page.svelte`, and `landing-page.test.ts` (the `LANDING_KEYS` list
  + the §4.26.N-16 assertions) — are removed from BOTH dictionaries
  (§4.27.G).
- **KEPT — the badge, relocated:** the glowing green
  `[ ICE BROKEN — SAY HELLO ]` chip (`landing.sim.badge`; RU
  «[ ЛЁД РАЗБИТ — СКАЖИТЕ ПРИВЕТ ]») STAYS, now **BELOW the
  compatibility circle** in the center column. All badge styles are
  unchanged (Handjet 12px uppercase deepa-1, the 50% deepa-1 border,
  the glow text-shadow, `badge-pulse` 1.6s steps(2) infinite
  alternate; reduced motion → static at full opacity).
- **New center column `.sim-center`:** a flex column
  (`align-items: center`, gap `var(--space-3)`) holding exactly two
  children, top → bottom: (1) the compatibility circle (§4.27.D),
  (2) the badge. Grid: ≥720px keeps `grid-template-columns: 1fr auto
  1fr` with areas `'you center nearby'` (the `auto` middle column is
  the 160px ring box — the retired chat window was the previous
  `auto` occupant); phone keeps the 2-col avatar row above a
  full-width center (`'you nearby'` / `'center center'`).

#### 4.27.D The compatibility circle — the /chats summary pattern, reused (item 3)

**Pattern source (groundwork record).** The owner names "the
compatibility indicator in the summary chat on the chats page". That
implementation is:

- `apps/web/src/lib/components/SummarySheet.svelte` — the score-stage
  ring: markup (`.ring` SVG: track + arc + `<text class="score">`,
  §4.15.C-5) and CSS (`.ring`/`.track`/`.arc`/`.score` +
  `@keyframes ring-fill`), plus the tally `$effect` (the one-shot rAF
  count-up with the explicit reduced-motion guard);
- `apps/web/src/lib/chats/summary.ts` — the pure, framework-free
  home of the geometry and timing: `RING_RADIUS` (66, viewBox
  160×160), `ringCircumference`, `ringScoreOffset(score, radius)`,
  `summaryScoreDisplay`, `TALLY_MS` (700), `tallyEase` (cubic
  ease-out), `tallyValue(elapsedMs, score)` (ceil integer steps,
  lands exactly on the target);
- spec of record: DESIGN §4.15.C-5.

**What transfers VERBATIM (construction + behavior):**

- **Ring geometry:** SVG `viewBox="0 0 160 160"` rendered at
  **160×160px**; circle `r = 66` (`RING_RADIUS`); **stroke-width 12**;
  **`stroke-linecap: butt`** (square ends — the pixel aesthetic);
  **`shape-rendering: crispEdges`** on the SVG; track circle at 25%
  ink (`color-mix(in srgb, var(--color-text) 25%, transparent)` — the
  sheet's 25%-white role remapped, see ink below); the arc carries
  `stroke-dasharray: var(--ring-c) var(--ring-c)` (full circumference,
  the same `--ring-c` custom-property technique) and `rotate(-90deg)`
  (transform-origin 80px 80px) so the fill **starts at 12 o'clock and
  sweeps clockwise**.
- **Arc fill animation:** `@keyframes ring-fill` from
  `stroke-dashoffset: var(--ring-c)` (empty) to
  `stroke-dashoffset: var(--ring-target)` where
  `--ring-target = ringScoreOffset(96)` — over **900ms ease-out both**
  (the sheet's exact duration/easing; the stroke-geometry animation is
  the sanctioned §4.13.5/§4.15.C-5 exception to §4.6, carried by the
  pattern).
- **Tally count-up:** a one-shot rAF loop 0 → 96 over **`TALLY_MS`
  = 700ms** stepping through `tallyValue(elapsedMs, 96)` — cubic
  ease-out, `Math.ceil` integer steps, landing EXACTLY on 96 — a
  direct port of the sheet's tally `$effect` (same structure, same
  reset-to-0 start, same `cancelAnimationFrame` cleanup, same
  "land exactly on the final integer" branch).
- **Reduced motion (both layers):** the explicit
  `matchMedia('(prefers-reduced-motion: reduce)')` guard inside the
  effect jumps the tally straight to 96 (the base.css catch-all only
  intercepts CSS); the CSS `ring-fill` collapses via the catch-all
  (0.01ms + `both` fill) so the arc snaps to its final offset — the
  static state is the ring AT 96% with the numeral 96.
- **Accessibility shape:** `role="img"` on the SVG with an aria-label
  that embeds the final value (the sheet's `scoreAria` pattern); the
  count-up never announces intermediate values (static label, no
  aria-live). The landing's label key is new — §4.27.G.

**What adapts (landing-local):**

- **The value — a constant, not a Summary:** `COMPAT_SCORE = 96`
  (the 96 from the retired §4.26.F msg2 becomes the display value)
  declared in the landing page component. The numeral renders the
  count-up integer followed by a literal `%` in the same `<text>`
  (the sheet shows a bare integer; the owner asks for "the 96%
  compatibility") — at rest the ring reads **`96%`**.
- **Ink mapping (no `--sheet-*` scope here):** the sheet's whites map
  to the landing text ink — arc + numeral **`var(--color-text)`**,
  track at 25% of `--color-text`. The arc stays white/ink
  (structural per the pattern); the tier accent is NOT carried —
  `summaryTier(96)` = GREAT, and the sheet itself retired the yellow
  GREAT label to common ink (§4.15.6.2), so a standalone GREAT-96
  display carries no yellow: the green stays reserved to the badge
  below (the §4.26.E hue-role discipline), the numeral/arc stay ink.
- **Numeral face/size:** `var(--font-pixel)` (Handjet) weight 600,
  **40px**, `letter-spacing: 0` (the sheet's 28px Press Start 2P
  equivalent — PS2P runs large, Handjet is narrow; 40px fills the
  132px ring interior comparably), `text-anchor: middle` +
  `dominant-baseline: central` at x 80 / y 80 (the sheet's technique).
- **Start trigger — DECIDED scroll-into-view, one-shot:** the sheet
  animates on open; the landing ring sits BELOW THE FOLD, so a
  mount-triggered animation would be spent before anyone sees it. On
  mount the component sets an IntersectionObserver (threshold 0.4)
  on the ring; the FIRST intersection flips a `started` flag and the
  observer disconnects; the tally `$effect` runs off `started` exactly
  like the sheet's runs off `open`. Fallback: when
  `IntersectionObserver` is unavailable (old browsers/test DOM),
  `started` flips immediately on mount. Reduced motion needs no
  observer — the static final state renders from the start.
- **Home:** the ring markup + tally effect live in `+page.svelte`
  (the landing already owns the section markup) — or a tiny
  `landing/compatRing` module if the worker prefers; EITHER WAY the
  geometry/count-up comes from `#lib/chats/summary` by IMPORT —
  **reuse, do not copy**: no local `66`, no local 700ms constant, no
  re-derived dash math in the landing sources (the tests assert the
  import by source-scan, the suite's established technique).
- **No tier machinery, no sparkles, no avatar motion:** the sheet's
  GREAT-tier reactions (approach/hop, sparkle poppers, spark burst)
  are NOT ported — the owner asked for the count-up + circle only;
  the flanking avatars keep their static §4.26.F treatment (glow +
  status lines + cursor), which is the landing's own idle language.

#### 4.27.E Video ping-pong playback (item 4)

The §4.23.A fixed background layer keeps its z-stack, attributes (minus
one — below), gated start and error fallback; the PLAYBACK MODEL
changes from plain loop to a continuous yo-yo:

- **The `loop` attribute is REMOVED** from the `<video>` (the decisive
  set becomes `muted playsinline preload="metadata"
  disablepictureinpicture aria-hidden` — everything else verbatim; no
  autoplay attribute, no native controls, still aria-hidden
  decorative scenery).
- **State machine (owner's seek-stepping note, not a contract —
  negative `playbackRate` is browser-unreliable, so none is used):**
  a `direction: 1 | -1` state starting at `1`.
  1. **Mount:** the gated ONE-SHOT `.play()` stays exactly as shipped
     (§4.23.A — no call under reduced motion; a rejection is
     swallowed → the static tint state, and no stepper runs). When
     `.play()` RESOLVES, the component immediately calls
     `video.pause()` and takes over: the whole yo-yo — forward
     included — is driven by ONE rAF seek-stepper on the PAUSED
     element (a uniform path: no native-play vs stepping races; the
     muted + playsinline `.play()` call is what satisfies the
     autoplay policy, and pausing right after does not unsatisfy it).
  2. **Stepping:** each rAF tick computes
     `delta = (now − last) / 1000` (wall-clock, frame-rate independent
     — the smooth equivalent of the owner's per-frame delta with
     seconds-per-pass = the clip's duration, i.e. the reverse pass
     takes the SAME wall time as the forward one at 1× speed) and
     advances the candidate time `t + direction × delta`.
  3. **End handling (the pure seam):** at `t ≥ duration` → clamp
     `t = duration`, flip `direction = −1`; at `t ≤ 0` → clamp
     `t = 0`, flip `direction = +1`; write `video.currentTime = t`
     every tick. Net behavior: forward → (ended) → reverse stepping →
     (t = 0) → forward → … continuously, no dwell at the ends.
  4. **Pure/testable unit:** a tiny new module
     `apps/web/src/lib/components/landing/videoPingPong.ts` exporting
     `type PlayDirection = 1 | -1` and
     `stepTime(t, dir, delta, duration): { time, dir }` — pure, total,
     clamps and flips at both ends. Unit tests cover: forward at the
     end flips to reverse and clamps to `duration`; reverse at 0
     flips to forward; mid-range calls pass through unchanged; steady
     stepping produces a monotonic yo-yo. (Hand-rolled, zero
     dependencies — the `sectionArt.ts` local-module precedent.)
  5. **Guards:** the stepper idles until `duration` is finite and
     > 0 (`loadedmetadata`; `preload="metadata"` provides it — until
     then the element is paused at frame 0, the established pre-state);
     if the video `error` event fires (`failed`), the stepper tears
     down and the §4.23.G fallback shows unchanged (element hidden —
     tint + vignette + dots).
  6. **Teardown:** the mount effect's cleanup cancels the rAF and
     disconnects any listeners on unmount (no leak across HMR/tests).
- **Reduced motion: unchanged** — the gate wraps BOTH the `.play()`
  and the stepper: no play, no stepping, the video stays paused at
  frame 0 with the tint + vignette + dots (§4.23.G verbatim; the
  static fallback is not re-derived here).

#### 4.27.F Supersessions (explicit record)

1. **§4.26.F's center 3-message chat window SUPERSEDED** by the
   compatibility circle (§4.27.C/§4.27.D): the pixel-frame "screen",
   its exactly-3-rows anatomy, the left/right message alignment and
   the `.sim-chat*`/`.sim-row*`/`.sim-who`/`.sim-msg` CSS all cease;
   the §4.26.N-16 chat-window test assertions retire (replaced by
   §4.27.I). The badge survives (relocated below the circle) and the
   two flanking agent blocks stand verbatim.
2. **`landing.sim.who1/who2/msg1/msg2` keys SUPERSEDED** (removed from
   both dictionaries — §4.27.G).
3. **The `loop` attribute SUPERSEDED** (§4.23.A.1's decisive
   attribute set, carried through §4.26.K.9): the video no longer
   loops — ping-pong seek-stepping replaces it (§4.27.E); the
   `video?.loop).toBe(true)` + source-regex assertions retire.
4. **§4.26.B/§4.26.C/§4.20.G description typography AMENDED** (not
   superseded): the four description classes' 13px → 15px
   (§4.27.B); every other landing font size stands.
5. **Superseded-but-carried (unchanged into §4.27):** the §4.23.A
   fixed layer stack and gated one-shot `.play()`, the §4.23.G
   reduced-motion + error fallbacks, the §4.22.A keep-list, the
   §4.26.A–E header/banner/steps/footer/sections contracts (except
   the size bumps above), the §4.26.J open state + layer audit, the
   §4.20.C copy/CTA and the §4.20.L behavior + deep-link forwarding.

#### 4.27.G RU/EN i18n delta (grep-audited; both dictionaries required)

Net **−4 +1 = 55 keys per dictionary** (was 58): the four orphaned sim
message keys are removed, one accessibility key is added for the
ring's `role="img"` label (the sheet pattern requires an aria-label
embedding the value). `landing.sim.badge` STAYS in both dictionaries,
byte-unchanged.

| Δ | Key | RU | EN |
| --- | --- | --- | --- |
| − | `landing.sim.who1` | Агент 01 | Agent 01 |
| − | `landing.sim.who2` | Агент 02 | Agent 02 |
| − | `landing.sim.msg1` | Обнаружены общие интересы: ИИ, пиксель-арт, кофе. | Shared interests detected: AI, Pixel Art, Coffee. |
| − | `landing.sim.msg2` | Совместимость высокая (96%). Рекомендую знакомство вживую. | High compatibility (96%). Suggesting IRL intro. |
| + | `landing.sim.compat.aria` | Совместимость агентов: 96% | Agent compatibility: 96% |

(`landing.sim.compat.aria`'s RU is a design invention — flagged in
§4.27.J.1.) Grep-audit instructions (worker): after landing, no
`landing.sim.who*`/`landing.sim.msg*` match remains in either
dictionary, any route, any component or any test; `landing.sim.compat.aria`
appears only in `en.ts`, `ru.ts`, `+page.svelte` (the ring's
aria-label) and the tests; `LANDING_KEYS` extends/retires to the 55-key
list and `DEAD_KEYS` gains the four removed keys. The RU/EN switch
re-renders every string without a reload (the parity + re-render test
pattern extends to the new key).

#### 4.27.H Reduced motion + media states

Unchanged in kind from §4.23.G/§4.26.M, plus the two new motion
systems' static fallbacks:

- **Compatibility circle:** reduced motion → the tally renders 96
  immediately (the explicit matchMedia guard) and the arc sits at its
  final offset (the catch-all completes `ring-fill` instantly with
  `both` fill); no observer is needed and scrolling never replays
  anything.
- **Video:** reduced motion → no `.play()`, no stepper — paused at
  frame 0 with the tint + vignette + dots (§4.23.G verbatim);
  ping-pong adds no reduced-motion surface of its own (the stepper
  only exists downstream of the gated play).
- **Everything else:** the badge pulse, cursor blink, dot twinkle,
  hover glows/lifts and smooth-scroll fallbacks are unchanged
  (§4.26.M). Media states: the landing still fetches nothing — no
  loading/empty/error data states; the video media states are
  §4.23.G verbatim (the stepper bails on error); the ring has no
  data states (a constant). No layout shift: the ring is a fixed
  160×160 box replacing the chat window's slot; the font bumps grow
  normal-flow cards only.

#### 4.27.I Acceptance criteria (checkable)

**Nav font bump (item 1):**
1. `.top-nav a` computes `font-size: 14px` (was 12px); font-family
   `var(--font-pixel)`, weight 600, letter-spacing 0.08em, uppercase,
   color `--color-text-muted`, hover `--color-deepa-4` 120ms, and the
   desktop-only ≥720px visibility are ALL unchanged (source +
   computed-style assertions).
2. The language switcher is UNCHANGED: `LocaleControl.svelte` and
   `SegmentedControl.svelte` are untouched files; the switcher buttons
   stay 14px; no `.locale`-scoped size override exists in the landing
   sources (negative assertion).

**Description bumps (item 2):**
3. One consistent bump: `.step-desc`, `.privacy-desc`, `.stat-line`,
   `.agent-quote` ALL compute `font-size: 15px` (was 13px), with
   family/color/line-height declarations otherwise unchanged — the
   same value in all four (source-scan + computed assertions).
4. Negatives: the lead `.sub` stays 14px (16px ≥720px) and the join
   input stays 14px; no other landing font size changed.

**Section 4 center (item 3):**
5. Negative + cleanup: `.sim-chat`, `.sim-chat-body`, `.sim-row`,
   `.sim-who`, `.sim-msg` are ABSENT from markup and CSS; no
   `landing.sim.who1/who2/msg1/msg2` key exists in either dictionary,
   any route, any component or any test (grep-audited; DEAD_KEYS
   extended; the §4.26.N-16 chat-window assertions retired).
6. The center column `.sim-center` holds EXACTLY two children, top →
   bottom: the compatibility ring and the badge — the badge renders
   `[ ICE BROKEN — SAY HELLO ]` (RU «[ ЛЁД РАЗБИТ — СКАЖИТЕ ПРИВЕТ ]»)
   BELOW the ring with its unchanged deepa-1 chip styles + `badge-pulse`
   (reduced motion → static at full opacity).
7. Pattern reuse vs the /chats summary implementation (source-scan):
   the landing imports `RING_RADIUS`, `ringScoreOffset`, `TALLY_MS`
   and `tallyValue` from `#lib/chats/summary`; NO duplicated geometry
   or timing constants exist in the landing sources (no local radius
   66, no local 700ms count-up constant, no re-derived dash math).
8. Ring construction (§4.27.D verbatim): SVG viewBox 0 0 160 160 at
   160×160px, `r = 66`, stroke-width 12, `stroke-linecap: butt`,
   `crispEdges`, track at 25% `--color-text` mix, arc dasharray =
   full circumference + `ring-fill` 900ms ease-out from full C to
   `ringScoreOffset(96)`, `rotate(-90deg)` 12-o'clock clockwise start;
   the numeral renders `96%` at rest — `var(--font-pixel)` 600 40px,
   centered (x 80 / y 80, middle/central), fill `--color-text`; arc +
   numeral `--color-text` (no yellow, no new colors).
9. Count-up behavior: a one-shot 700ms rAF loop stepping through
   `tallyValue(elapsedMs, 96)` — integer steps, landing EXACTLY on
   96; triggered ONCE by the scroll-into-view IntersectionObserver
   (threshold 0.4, disconnects after firing; mount fallback when the
   API is missing); scrolling away and back does NOT replay; under
   reduced motion the tally is 96 and the arc is at its final offset
   with no observer and no rAF.
10. The flanking agent blocks are verbatim (§4.26.F): BLEAK 64px +
    purple glow + YOUR AGENT + `Status: Scanning...` + blinking
    cursor; SCOUT 64px + cyan glow + NEARBY AGENT + `Distance: 15m`;
    ≥720px grid `1fr auto 1fr` (areas you/center/nearby), phone =
    2-col avatar row above the full-width center; no horizontal
    scroll at 320/760/1280.
11. Accessibility: the ring SVG is `role="img"` with
    `aria-label = landing.sim.compat.aria` ('Agent compatibility:
    96%' / «Совместимость агентов: 96%»); the count-up announces
    nothing (no aria-live on the numeral).

**Video ping-pong (item 4):**
12. The `loop` attribute is GONE: `video.loop === false` and no `loop`
    token in `LandingVideoHero.svelte`; `muted`, `playsinline`,
    `preload="metadata"`, `disablepictureinpicture`, `aria-hidden`
    remain verbatim; no autoplay attribute, no native controls.
13. Ping-pong: the pure unit `landing/videoPingPong.ts` `stepTime`
    flips direction at BOTH ends with clamping (forward at `duration`
    → reverse at `duration`; reverse at 0 → forward at 0) — unit
    tests green; the component drives the PAUSED element via rAF
    seek-stepping (wall-clock delta × direction, 1× speed — the
    reverse pass takes the same wall time as the forward one) after
    the gated one-shot `.play()` resolves (then `pause()`); the
    stepper idles until `duration` is finite, bails on the video
    `error` event (the §4.23.G fallback unchanged) and its rAF is
    cancelled on unmount (teardown).
14. Reduced motion: no `.play()`, no stepper — the video stays paused
    at frame 0 with the tint + vignette + dots (§4.23.G verbatim);
    the ring renders the static final state (96% + final arc offset)
    and every §4.26 static fallback is unchanged.

**i18n + suites (carry):**
15. i18n: exactly **55** `landing.*` keys in BOTH dictionaries (58 − 4
    + 1); `landing.sim.compat.aria` present in both; the four removed
    keys exist NOWHERE (grep-audited); the RU/EN switch re-renders
    every string without a reload.
16. Suites amended and green: `landing-page.test.ts` (the 3-row chat
    window + `loop` assertions retired; ACs 1–14 asserted),
    `i18n.test.ts` (55-key parity + dead keys), new `videoPingPong`
    unit tests, `sweep.test.ts` (token discipline — no new color
    values, the sanctioned rgba family unchanged), `mascot.test.ts`
    untouched green, `summary-sheet.test.ts` untouched green (the
    pattern source is NOT modified), `join-flow.test.ts` /
    `creation-wizard.test.ts` untouched green; `make lint && make
    test && make build` green.
17. Constraints: no new dependencies; palette tokens unchanged (no
    new values anywhere); routes untouched; `/income` untouched; the
    video asset stays; no canvas, no animation library; API endpoints
    used: none (the landing stays fetch-free).

#### 4.27.J Flags for the owner / concept (concept report)

1. **ADVICE NEEDED — RU for `landing.sim.compat.aria` is a design
   invention** («Совместимость агентов: 96%»): the owner's §39 gives
   no copy for the ring's accessible label; the key is required by
   the sheet pattern's `role="img"` + value-bearing label. Owner tone
   approval requested with the batch (the §4.26.O.1 precedent).
2. **Record — the font sizes are this design's calls** (§39.1–.2
   leave them to the design): nav 12→14px (+2px, Handjet stays
   chrome-scale at 14px), descriptions 13→15px. The descriptions
   scope includes `.stat-line` + `.agent-quote` under the owner's
   "etc." for cross-block consistency; excluding either is a one-line
   change if the owner wants strictly steps + privacy.
3. **Record — the arc is ink/white** (`--color-text`, the summary
   pattern's structural white; the GREAT tier's yellow label was
   already retired in the sheet itself, §4.15.6.2). A one-value flip
   of the arc + numeral to `--color-deepa-4` gives the violet neon
   read if the owner prefers it.
4. **Record — reverse speed = 1×**: the reverse pass takes the same
   wall time as the forward one (the owner's per-frame-delta note
   with seconds-per-pass = the clip duration). A faster yo-yo is one
   speed-multiplier constant.
5. **Record — the count-up trigger is scroll-into-view** (one-shot
   IntersectionObserver, mount fallback): a below-the-fold
   mount-triggered animation would finish before the section is ever
   seen. Reduced motion renders the final state without any observer.
6. **Record — `.play()`-then-pause:** the gated one-shot `.play()`
   stays as the autoplay-policy entry (muted + playsinline), then the
   stepper drives the paused element uniformly — no negative
   `playbackRate`, no native/stepping double-driving races; the
   reduced-motion and error fallbacks are untouched.

### 4.27.1 owner amendment (2026-11-22, Concept §39.4 record): native-loop swap

The owner exported the yo-yo clip PRE-STITCHED (forward + reverse) as
`background-video-loop.mp4` and picked Option A of the §39.4 amendment: the
ping-pong is the FILE itself, so this design retires the §4.27.E seek-stepper
wholesale — `landing/videoPingPong.ts` (`stepTime`/`PlayDirection`) is deleted
with its tests and all of the hero's rAF/direction/currentTime wiring — and
NATIVE playback is restored: the decisive §34 attribute set is back verbatim
(`muted loop playsinline preload="metadata" disablepictureinpicture
aria-hidden` — no autoplay, no native controls) with the clip committed as the
app asset `apps/web/src/lib/assets/landing/background-video-loop.mp4`
(superseding and deleting the old `background-video.mp4`). The gated one-shot
`.play()` remains the whole playback wiring (no call under
prefers-reduced-motion — the static tint + vignette + dots fallback is
untouched; a rejected `.play()` is still swallowed), and the error fallback,
black bg, dissolve vignette and dot mesh are unchanged (the new clip keeps the
near-black background). §4.27.E's stepper record (and flags 4/6's
stepper-related notes) are SUPERSEDED by this paragraph; every other §4.27
contract (nav/description bumps, compatibility circle, 55-key RU/EN parity,
glass sections) stands.

### 4.28 v3.22 feature design (2026-11-22, owner-approved Concept §40): §40 bigger titles/descriptions/badges + phone widths

The owner issued the two-item §40 follow-up batch: (1) another clearly
visible font bump across the landing — section/block titles, description
texts AND the badge/pill elements (the micro-caption pills,
`[ LIVE NETWORK // IRL ]`, `[ICE BROKEN — SAY HELLO]`, status captions),
exact values left to the design under one rule — consistent hierarchy,
everything reads bigger; (2) on phone viewports the content blocks' width
equals the header's width (90%) so their edges align visually — desktop
stays as-is (content 80%, header 90%, §38). This is a **SIZING-ONLY
pass**: no copy changes, no structural/marking changes, no new
dependencies, palette tokens unchanged, routes untouched, `/income`
untouched. This section amends §4.27 (→ §4.26 → … → §4.20) item by item;
**where §4.28 is silent, the earlier specs stand** except where §4.28.G
explicitly supersedes them. Grounded in the live code:
`apps/web/src/routes/+page.svelte` (all current font sizes + the
container/header width rules), `lib/styles/tokens.css`,
`tests/landing-page.test.ts`. **API endpoints used: none** — the landing
stays fetch-free (§4.20 preamble); the round is presentational CSS-value
work. Task: tz12-12
(`feature/05423c53-tz12-12-font-scale-phone-widths`).

The bump ladder (the design's call, §40.1): **+4px on the display
titles, +2–4px on the block titles, +2px on every description, +2px on
every caption/badge/pill** — one consistent step per tier, so every
element reads bigger while every superiority relation (headline > block
titles > card captions > micro-captions) is preserved. Only
`font-size` values move; **every `font-family`, `font-weight`,
`letter-spacing`, `text-transform`, `line-height` and color declaration
is byte-unchanged**.

#### 4.28.A Titles — the master table (item 1a)

| Class (role) | Current → New | Notes |
| --- | --- | --- |
| `.headline` (the lead headline, 3 `hl-line`s) | 36px → **40px** (base/phone); ≥480px: 44px → **48px**; ≥720px: `clamp(22px, 3.5vw, 44px)` → **`clamp(28px, 4vw, 48px)`** | see the open-state re-check below |
| `.agent-name` (the BLEAK card title, §4.20.G) | 24px → **28px** | stays the largest block title |
| `.stat-title` (the banner title REAL PEOPLE. REAL RESULTS., §4.26.B) | 17px → **21px** | the compact banner row keeps its contract otherwise |
| `.step-title` (FIND / CHAT / SHARE, §4.26.C) | 20px → **24px** | |
| `.section-title` (the shared sim/privacy/use-cases/join title, §4.26.E–I) | 20px → **24px** | one class, four sections |
| `.join-headline` (the join card's inner headline, §4.26.I) | 20px → **24px**; ≥720px: 24px → **28px** | |
| `.privacy-title` (GHOST MODE / MUTUAL OPT-IN / EPHEMERAL GPS, §4.26.G) | 14px → **16px** | inner card titles sit one tier under `.section-title` |
| `.sim-agent-name` (YOUR AGENT / NEARBY AGENT, §4.26.F) | 14px → **16px** | |

**The lead-headline clamp WAS adjusted — the bump forces it** (record):
with block titles grown to 24–28px, the old `clamp(22px, 3.5vw, 44px)`
would let the 28px `.agent-name` overtake the lead at narrow desktop
widths (at 720px the old clamp computes 25.2px < 28px). The new
`clamp(28px, 4vw, 48px)` keeps the lead the dominant title at every
≥720px width — at 720px it computes 28.8px > 28px and grows from there,
capping at 48px from 1200px up (the same cap as the ≥480px phone rule —
one consistent maximum). The 28px clamp floor is inert on ≥720px (4vw ≥
28.8px there); it is a defensive minimum only.

**§37 open-state re-check (explicit):** the open-state geometry is
UNTOUCHED — no §4.28 rule modifies `.stage`, `.area-lead`, `.copy-body`
positioning or any grid/`100dvh` construction. Phone: `.area-lead` stays
`min-height: 100dvh` + `justify-content: center` — the lead grows by
≈ +4px per headline line (×3) + the `.sub` bump (§4.28.B, +2px) + the CTA
bump (§4.28.D, +2px) ≈ +20px total, comfortably inside the 100dvh hero
at every phone height ≥ 640px; the first viewport is still EXACTLY lead
+ BLEAK, vertically centered. Desktop: the thirds grid stays
`min-height: 100dvh` + `align-content/align-items: center`; the lead
third's interior at 720px is unchanged (≈ 139px column — identical to
today) and the headline there computes 28.8px (was 25.2px) with
`overflow-wrap: anywhere` carrying mid-word breaks (§4.24.C) — wrap
sanity verified at 720/760/1280, no horizontal scroll.

**Wrap sanity (desktop thirds ≈ 288px):** `.step-title`/`.section-title`
at 24px Handjet ≈ 10.8px/char → ~22 chars per ~248px card interior; the
longest RU titles («ПРИВАТНОСТЬ И КОНТРОЛЬ», «ПОДЕЛИСЬ КОНТАКТОМ»)
wrap normally in normal-flow cards (nothing overflows at 320/760/1280).
`.stat-title` at 21px in the compact banner flex row wraps to a second
line on narrow phones — the banner is a normal-flow block, the glyph
column is `flex: none`, no overflow.

#### 4.28.B Descriptions (item 1b)

One consistent +2px on every Inter body description (superseding the
§4.27.B 15px values — the SAME four classes, one tier further):

| Class | Block | From → To |
| --- | --- | --- |
| `.step-desc` | the three step cards (§4.26.C) | 15px → **17px** |
| `.privacy-desc` | the three privacy cards (§4.26.G) | 15px → **17px** |
| `.stat-line` | the banner's mini-lines (§4.26.B) | 15px → **17px** |
| `.agent-quote` | the BLEAK agent card quote (§4.20.G) | 15px → **17px** |
| `.sub` | the lead's supporting line (§4.20.C) | 14px → **16px**; ≥720px: 16px → **18px** |

`.sub` is INCLUDED this round (record: it supersedes §4.27.B's explicit
"the lead `.sub` stays 14px/16px" negative — §40.1 says ALL descriptions
bigger, and the lead's supporting line is a description text; at 16px it
still reads one tier under the 17px card descriptions' information
density because it sits alone in the transparent lead, and under the
headline at every width). The §4.27.B wrap-sanity analysis carries with
+2px: the longest RU privacy desc wraps to ~4 lines in a ~248px card
interior — normal-flow growth, the step cards keep `min-height: 300px`
with the pill pinned via `margin-top: auto`, the banner's three lines
still fit the compact row at desktop width.

#### 4.28.C Status captions (item 1c)

| Class | Caption | From → To |
| --- | --- | --- |
| `.stat-status` | the glowing `AI Agents active nearby` caption (§4.26.B) | 11px → **13px** |
| `.sim-status` | `Status: Scanning...` / `Distance: 15m` (§4.26.F) | 12px → **14px** |
| `.agent-traits` | the BLEAK card's pixel traits line (§4.20.G) | 11px → **13px** |

`.agent-traits` is included under the owner's "everything reads bigger"
(§40.1): it is a micro-caption in the same band as `.stat-status`; the
one-class +2px keeps the caption tier uniform. The `.sim-cursor` (6×2px
block) and `.status-dot` (6×6px) decorations are UNCHANGED.

#### 4.28.D Badges / pills (item 1d)

| Class | Badge / pill | From → To |
| --- | --- | --- |
| `.stat-badge > span` | `[ LIVE NETWORK // IRL ]` (§4.26.B) | 11px → **13px** |
| `.agent-badge` | the agent card's pixel badge (§4.20.G/§4.22.D) | 11px → **13px** |
| `.step-pill` | the three step micro-pills (§4.26.L) | 10px → **12px**; ≥720px: 11px → **13px** |
| `.sim-badge` | `[ICE BROKEN — SAY HELLO]` (§4.26.F/§4.27.C) | 12px → **14px** |
| `.usecase-label` | CONFERENCES / PARTIES & BARS / COWORKINGS / FESTIVALS (§4.26.H) | 14px → **16px** |
| `.cta-access` | GET EARLY ACCESS (§4.26.I-2) | 16px → **18px** |
| `.cta-main` / `.talk` | START / TALK (§4.20.C/G) | 16px → **18px** |

The CTA pill family moves TOGETHER (record): GET EARLY ACCESS is
explicitly in the owner's §40 list, and START / TALK are the same
pill-button family — leaving them at 16px while their sibling grows to
18px would break the family's consistency, so all three labels take the
same +2px. Chip geometry is otherwise unchanged: the `.stat-badge` 2px
pixel-frame padding, the pill borders, `min-height: 24px` on
`.agent-badge` (13px Handjet still fits), the `padding: 4px 10px` /
`margin-top` mechanics of `.step-pill`, the touch-target 48px minimums
and every hover/active treatment stand. The `badge-pulse` /
`status-pulse` / cursor-blink / sparkle animations are untouched.

#### 4.28.E Explicit negatives — UNCHANGED sizes

1. **The header nav stays 14px** (`.top-nav a`): §39.1 just set 12px →
   14px; the nav is chrome, not a section/block title, and 14px already
   sits above the micro-caption band — the §40 ladder does not require
   it to grow. NOT superseded (§4.27.A carries verbatim).
2. **The language switcher is UNCHANGED** (the §39 rule, restated):
   `LocaleControl.svelte` and `SegmentedControl.svelte` are untouched
   files, the switcher buttons stay 14px, and NO landing style may add a
   `.locale`-scoped size override (the negative assertion stays).
3. **The join input stays 14px** (`.join-input`) — a form control, not a
   description display (the §4.27.B negative carries).
4. **The footer contact block is UNCHANGED**: `.brand-name` 14px,
   `.foot-year` 11px, `.link-label` 12px, `.link-value` 13px — chrome-
   level contact info, outside the §40 title/description/badge scope.
5. **`.step-num` stays 40px** — a decorative `aria-hidden` pixel numeral,
   not a title/description/badge.
6. **`.compat-ring .compat-score` stays 40px** — the numeral is bound to
   the ring's 132px interior (§4.27.D verbatim); growing it would
   overflow the circle. The ring geometry (160×160, r 66, stroke 12) is
   UNTOUCHED.
7. No other landing `font-size` changed: the §4.28.A–D tables are the
   complete list of moved values.

#### 4.28.F Phone widths — the blocks match the header (item 2)

**Decision: one shared width expression, `max(90%, 280px)`, for BOTH the
content container and the header at phone; the container's phone inline
padding is dropped so the blocks' edges == the container's edges == the
header's edges (no mixed insets).** A shared token was considered and
rejected — the value is used in exactly two rules with no third consumer;
a raw shared expression is simpler and keeps the §4.24.A idiom.

**Base (phone, mobile-first) rules — CHANGED:**

```css
.landing {
  position: relative;
  z-index: 3;
  width: max(90%, 280px);       /* WAS max(80%, 280px) — the §40.2 match */
  margin-inline: auto;
  padding: 0 0 var(--space-5);  /* WAS 0 var(--space-5) var(--space-5) —
                                   the phone INLINE padding is DROPPED: the
                                   blocks (width: 100%) now span the
                                   container edge-to-edge, so their edges
                                   align EXACTLY with the header's outer
                                   edges; the bottom padding stays */
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}
.top {
  /* …every §4.26.A declaration unchanged… */
  width: max(90%, 280px);       /* WAS 90% — the SAME expression as
                                   .landing: the shared floor */
  max-width: 1200px;            /* unchanged (inert on phone) */
}
```

**Desktop ≥720px — the `.landing` override RESTORES the §38 values
(everything else about the desktop container unchanged):**

```css
@media (min-width: 720px) {
  .landing {
    width: max(80%, 280px);                    /* UNCHANGED (§4.24.A) */
    padding: 0 var(--space-7) var(--space-7);  /* UNCHANGED */
  }
  /* .top needs NO desktop override: at ≥720px the 280px floor is inert
     (90% of any ≥720px viewport ≥ 648px > 280px), so .top computes 90%
     capped at 1200px exactly as §4.26.A — the desktop 80/90 split and
     §4.26.O.5's "deliberately wider" stand verbatim. */
}
```

**Why the edges line up EXACTLY at every phone width:** both columns
carry the identical `width: max(90%, 280px)` + `margin-inline: auto`
against the same containing block (the viewport) → identical computed
boxes: **390px → both 351px; 320px → both 288px; below ~311px → both
floored at 280px** (the floor engages only where 90% < 280px, keeping
the two columns equal even on sub-320 screens). No per-element width
rules change: the cards, `.copy`, `.sim-card`, `.privacy-card`,
`.usecase-pill`, step blocks and `.stat-card` are `width: 100%` of the
container, so they align edge-to-edge with the header automatically;
`.contact` (`max-width: 560px`) and `.join-card` (`max-width: 640px`)
never bind on phone (<560px viewports) — they compute 100% of the
container too. The transparent lead's TEXT keeps its inset: `.copy-body`
retains its own 20px phone padding, so the copy floats 20px inside the
block edge even as the block edge itself aligns with the header.

**Wrap/overflow sanity:** at 320px the content column grows 280px →
288px — the gutters shrink 20px → 16px per side; the no-horizontal-scroll
invariant holds (288 < 320), and the phone header keep-list (icon +
switcher, ≈160px) fits 288px with slack. Desktop is byte-identical to
§4.24.A/§4.26.A behavior.

#### 4.28.G Supersessions (explicit record)

1. **§4.27.B's description values SUPERSEDED**: the four classes' 15px →
   17px (§4.28.B); §4.27.B's "the lead `.sub` stays 14px/16px" negative
   SUPERSEDED (`.sub` → 16px/18px, §4.28.B); §4.27.B's "the join input
   stays 14px" negative CARRIES (§4.28.E.3).
2. **§4.27.A NOT superseded**: the nav stays 14px (§4.28.E.1 — an
   explicit decision, not an omission).
3. **§4.26.B's banner compact-typography contract AMENDED**: the 17px
   title → 21px and the 11px `.stat-badge`/`.stat-status` → 13px; the
   padding contract (12px 14px / 16px 20px), the 44/48px BLOOM sizes,
   the glass fill and every other banner value stand.
4. **§4.20.G/§4.22.D agent-card typography AMENDED**: `.agent-name`
   24 → 28px, `.agent-badge` 11 → 13px, `.agent-traits` 11 → 13px,
   `.agent-quote` 15 → 17px; the card's structure, frame, portrait and
   TALK handler untouched.
5. **§4.26.C/§4.21.E step cards AMENDED**: title 20 → 24px, desc
   15 → 17px, pill 10/11 → 12/13px; glass fill, art, hover, min-height
   300px untouched.
6. **§4.26.E–I section typography AMENDED**: `.section-title` 20 → 24px
   (four sections), `.privacy-title` 14 → 16px, `.usecase-label`
   14 → 16px, `.join-headline` 20/24 → 24/28px; the shared glass recipe,
   grids, icons and the mailto stub untouched.
7. **§4.26.F sim section AMENDED**: `.sim-agent-name` 14 → 16px,
   `.sim-status` 12 → 14px, `.sim-badge` 12 → 14px; the ring (§4.27.D)
   and its 40px numeral are UNTOUCHED.
8. **§4.24.A / §4.26.O.5 phone-width reading SUPERSEDED on phone only**:
   at <720px the content column and the header share
   `max(90%, 280px)` (§4.28.F) — the header is no longer "deliberately
   wider" on phone; **the desktop 80% / 90% split STANDS** (§4.26.O.5
   carries for ≥720px verbatim). §4.24.A's phone "20px gutters at 320px"
   note → 16px gutters at 288px. The `.landing` phone INLINE padding
   (`--space-5`) is RETIRED (the blocks align edge-to-edge with the
   header); the bottom padding and the desktop `--space-7` padding
   stand.
9. **§4.26.A's header width expression AMENDED**: `width: 90%` →
   `width: max(90%, 280px)` (the shared floor; the desktop computed
   value is unchanged — the floor is inert at ≥720px, and `max-width:
   1200px` + centering + `top: 24px` + the glass recipe stand verbatim).
10. **Superseded-but-carried (unchanged into §4.28):** the §4.23.A fixed
    video layer + native-loop playback (§4.27.1), the §4.22.A keep-list,
    the §4.25.A/B open state + transparent lead, the §4.27.C/D
    compatibility circle construction, the §4.20.C copy/CTA (the STRINGS
    are byte-identical — sizes only), the §4.20.L behavior + deep-link
    forwarding, the §4.23.G/§4.26.M/§4.27.H reduced-motion and error
    fallbacks.

#### 4.28.H i18n: ZERO delta

This is a sizing-only pass: **no key is added, removed or edited** —
both dictionaries stay **byte-identical at 55 `landing.*` keys per
dictionary** (the §4.27.G net count; the caller's "23…" paraphrase
resolved: the real parity count is 55). Every rendered string —
REAL PEOPLE. REAL RESULTS., the step descriptions, all badges and
captions — is byte-unchanged in RU and EN; only the CSS boxes around
them grow. The RU/EN switch re-renders every string without a reload
(the parity + re-render pattern extends nowhere — nothing new to
assert). `i18n.test.ts` is untouched and stays green.

#### 4.28.I Reduced motion + media states

**No animated sizes — nothing motion-related changes in this pass:**
`font-size` and the width rules are static declarations; no transition,
animation or keyframe touches them. Every existing reduced-motion
fallback stands verbatim (§4.23.G video, §4.26.M hover/badge/cursor/
dot/smooth-scroll fallbacks, §4.27.H ring tally + arc). Media states:
the landing still fetches nothing — no loading/empty/error data states;
the video media states are §4.23.G verbatim; the ring has no data
states. No layout shift beyond the intended size growth: all bumped
elements are normal-flow blocks (the ring's fixed 160×160 box and the
header's fixed position are untouched).

#### 4.28.J Acceptance criteria (checkable)

**Font ladder (item 1):**
1. Titles compute: `.stat-title` 21px, `.step-title` 24px,
   `.section-title` 24px, `.privacy-title` 16px, `.join-headline` 24px
   (28px ≥720px), `.agent-name` 28px, `.sim-agent-name` 16px — with
   each class's `font-family`/`font-weight`/`letter-spacing`/
   `text-transform`/color declarations unchanged (source + computed
   assertions).
2. The lead headline computes 40px (base), 48px (≥480px) and
   `clamp(28px, 4vw, 48px)` (≥720px — 28.8px at a 720px viewport, 48px
   at ≥1200px); the open-state geometry holds unchanged: phone
   `.area-lead` is `min-height: 100dvh` + `justify-content: center`,
   desktop `.stage` is the 100dvh thirds grid with
   `align-content/align-items: center` (the existing §4.25/§4.27
   assertions stay green verbatim).
3. Descriptions compute 17px on ALL FOUR of `.step-desc`,
   `.privacy-desc`, `.stat-line`, `.agent-quote` (the same value in all
   four), and `.sub` computes 16px (18px ≥720px); family
   (`var(--font-body)`), colors and existing line-heights unchanged.
4. Captions compute: `.stat-status` 13px, `.sim-status` 14px,
   `.agent-traits` 13px.
5. Badges/pills compute: `.stat-badge > span` 13px, `.agent-badge`
   13px, `.step-pill` 12px (13px ≥720px), `.sim-badge` 14px,
   `.usecase-label` 16px, `.cta-access`/`.cta-main`/`.talk` 18px; chip
   geometry (paddings, borders, min-heights, pulse animations)
   unchanged.
6. Negatives: `.top-nav a` stays 14px; the switcher files are untouched
   with no `.locale`-scoped size override in the landing sources;
   `.join-input` stays 14px; the footer classes stay 14/11/12/13px;
   `.step-num` stays 40px; `.compat-ring .compat-score` stays 40px; no
   landing `font-size` outside the §4.28.A–D tables changed (grep-audit
   of the `<style>` block against the tables).

**Phone widths (item 2):**
7. At <720px, `.landing` and `.top` BOTH carry
   `width: max(90%, 280px)` — their computed widths are EQUAL at a
   320px viewport (288px) and at a 390px viewport (351px), and the
   content blocks' outer edges align with the header's outer edges
   (identical expression + identical `margin-inline: auto`; the
   `.landing` phone rule has NO inline horizontal padding).
8. The shared floor: below ~311px viewport both columns compute
   280px and stay equal (the identical `max(…)` expression — no
   mixed insets at any phone width).
9. Desktop ≥720px UNCHANGED: `.landing` computes `max(80%, 280px)` with
   `padding: 0 var(--space-7) var(--space-7)` and `.top` computes 90%
   capped at `max-width: 1200px` (the 80/90 split stands; the header
   floor is inert).
10. No horizontal scroll at 320/390/760/1280; at 320px the gutters are
    16px per side; `.contact`/`.join-card` compute 100% of the
    container on phone (their max-widths do not bind).

**Carry:**
11. Open-state green: the §4.25/§4.27 open-state assertions (phone 100dvh
    centered lead; desktop thirds grid; first viewport = lead + BLEAK
    only) pass unmodified.
12. i18n: exactly **55** `landing.*` keys in BOTH dictionaries,
    byte-unchanged (ZERO delta — no key added, removed or edited); the
    RU/EN switch re-renders every string without a reload.
13. Reduced motion: nothing motion-related changed — no transition,
    animation or keyframe references `font-size` or the width rules;
    every §4.23.G/§4.26.M/§4.27.H static fallback passes unmodified.
14. Suites amended and green: `landing-page.test.ts` updated — the
    superseded §4.27.A/B font assertions rewritten to the §4.28 values
    (nav 14px stays; the four descriptions 15→17px; `.sub` 16/18px;
    `.top` width → `max(90%, 280px)`; the `.landing` phone-width rule →
    `max(90%, 280px)` + no inline padding; the desktop 80% container
    assertions stay), `i18n.test.ts` untouched green (55-key parity),
    `sweep.test.ts` green (no new color values, the sanctioned rgba
    family unchanged), all other suites untouched green;
    `make lint && make test && make build` green.
15. Constraints: no new dependencies; no copy changes (every string
    byte-identical in both dictionaries); palette tokens unchanged (no
    new color values anywhere); routes untouched; `/income` untouched;
    the §37 open-state geometry holds; API endpoints used: none.

#### 4.28.K Flags for the owner / concept (concept report)

1. **Record — the ladder is this design's call** (§40.1 delegates the
   exact values): +4px display titles / +2–4px block titles / +2px
   descriptions / +2px captions-badges-pills, per the §4.28.A–D tables.
2. **Record — the lead-headline clamp WAS adjusted** (the bump forces
   it): `clamp(22px, 3.5vw, 44px)` → `clamp(28px, 4vw, 48px)` so the
   lead stays dominant over the grown 28px `.agent-name` at every
   ≥720px width (at 720px: 28.8px > 28px). The §37 open-state
   geometry is untouched and re-verified (§4.28.A).
3. **Record — the nav stays 14px** (§4.28.E.1): §39 just set it; the
   chrome band is outside the §40 ladder. Growing it later is a
   one-value change.
4. **Record — `.sub` and the CTA pill family are INCLUDED** (they
   supersede §4.27.B/§4.20.C size standstills): the owner's "ALL
   descriptions / badges bigger" reading; excluding `.sub` or any CTA
   is a one-line change each.
5. **Record — the footer, `.step-num` and the ring numeral are
   EXCLUDED** (§4.28.E): chrome / decorative numeral / geometry-bound,
   respectively — none is a §40 title/description/badge.
6. **Record — the shared floor is `max(90%, 280px)` in BOTH rules**
   (§4.28.F), not a new token: two consumers, no third; the phone
   inline padding drop is the alignment mechanism (the blocks'
   edge-to-edge span). A `.copy-body`-internal 20px inset keeps the
   transparent lead's text off the screen edge.

### 4.28.1 owner amendment (2026-11-22, Concept §41 record): lead text color + copy

The owner's small §41 batch (copy + one color, no design instance)
amends the lead block only; §4.28 stands otherwise byte-unchanged.
(1) **`.sub` reads white:** the lead description's color moves from
`var(--color-text-muted)` to the white/text-primary token
`var(--color-text)` — the muted token is retired **for this element
only** (every other muted consumer in the file keeps it); the headline
treatment (clamp(28px, 4vw, 48px) + the token-only glow + the accent
word) is unchanged. (2) **Title copy** — EN "The right connections
you" → **"The right connections beside you"**, RU «Нужные знакомства
вас» → **«Нужные знакомства рядом»**: the 3-line pixel-headline
structure is kept, the accent highlight stays on the final line
(`landing.headline.accent` = 'BESIDE YOU' / «РЯДОМ»; `headline.1`/
`headline.2` unchanged in both dictionaries). (3) **RU description
verbatim:** "Нетворкинг - это работа. Здесь ИИ-двойники работают за
Вас. Собирайте контакты, проверяйте совместимость и вдохновляйтесь
общими идеями!" (exact text incl. the hyphen — do not "fix"
punctuation); the EN description stays as-is (§41.3's EN translation
proposal is pending owner approval). No key additions/removals — RU/EN
parity stays 55/55, values only. Task: tz12-12a
(`feature/42ce1dbc-tz12-12a-lead-copy-color`).

### 4.29 v3.23 feature design (2026-11-22, owner-approved Concept §42): profile redesign — `/profile` + `/profile/settings` + new `/profile/edit`

The owner-approved §42 redesign rebuilds the profile surface on the
reference `docs/refs/profile-design.png` (three mobile screens: My profile /
Settings / Edit Profile). ADOPTION RULES (Concept §42.1, binding): the
reference contributes **layout, structure and component patterns only** —
header with QR icon + gear, centered avatar, username row, stats row, pill
tabs, settings list blocks with chevron rows, key-value edit rows, full-width
save button — rendered entirely on the app's EXISTING tokens (charcoal
`#1a1c20`/`#101213`, accent `#fedc5c`; `tokens.css` values only, §2.4). NO
lime accent, no global theme change, no new tokens. The circular avatars of
the reference are NOT followed (Concept §42.4: the owner's sharp-edged-square
text wins). `docs/refs/profile-design-2.png` and the stale
`/workspace/profile-design.png` copy are IGNORED. Content = real bleak-node
API entities only; streak counter, badges, social post card, followers and
the reference's toggles/FAQ rows are DROPPED — no placeholder or mock
elements (Concept §42.2).

This rev amends §3.6 (the /profile page), §4.9.3 (the settings route), and
§4.11.4 (the editing-location contract); the full supersession list is G.
Sitemap: the §1.1 `/profile` row is rewritten and `/profile/settings` +
`/profile/edit` rows are ADDED (marked there). **Where this rev is silent,
the superseded sections' specs stand** except where G explicitly retires
them. Grounded in the live code: `routes/profile/+page.svelte`,
`routes/profile/settings/+page.svelte`,
`lib/components/profile/{ProfileBadge,QrCodeBadge,PersonaEditor,GreetingEditor,ContactCardEditor}.svelte`,
`lib/components/{PixelAvatar,StatTile,Chip}.svelte`,
`lib/components/icons/registry.ts`, `lib/stores/{interests,contactCard,mutualCode,identity}.ts`,
`lib/styles/tokens.css`, `lib/i18n/{ru,en}.ts`.
Task: `feature/f6ab8db7-profile-redesign`.

**API endpoints used** (all credentialed calls carry the persona Bearer,
auto-injected per ARCHITECTURE §10.8; endpoints per
`/mount/bleak-node/docs/swagger.json`):

| Endpoint (client method) | Screen / use |
| --- | --- |
| `GET /api/room/{room}/user/{address}` (`getRoomUser`) — persona Bearer | `/profile`: 4 s badge poll for the derived `mutual_code_live` (§6.3); `/profile/edit`: mount prefill (no poller) |
| `GET /api/handshake/user/{address}` (`listHandshakesOfUser`) — gated read | `/profile` stats: sent count + added-you (mount + after mutations, §2.2) |
| `GET /api/user/{address}/chat` (`listChatsOfUser`) — gated read | `/profile` stats: dialogs count |
| `POST /api/room/{room}/user/{address}/mutual-code` (`registerMutualCode`) — persona Bearer; body = the code's SHA-256 hash, never the raw code | `/profile` live-QR registration (§6.3) |
| `PUT /api/room/{room}/user/{address}` (`updateRoomUser`) — persona Bearer | `/profile/edit`: save name / public_bio / private_bio (all three fields, omitted-field semantics) |
| `GET /api/room/{room}/user/{address}/greeting` (`getUserGreeting`) — persona Bearer | `/profile/edit`: canonical greeting prefill |
| `PUT /api/room/{room}/user/{address}/greeting` (`putUserGreeting`) — persona Bearer | `/profile/edit`: save the greeting |
| `POST /api/room/{room}/user/{address}/greeting/regenerate` (`regenerateGreeting`) — persona Bearer | `/profile/edit`: regenerate into the editor (not saved until Save) |
| `POST /api/room/{room}/user/{address}/token` (`rotateUserToken`) — Bearer = current persona token, body = new raw token | `/profile/settings`: token rotation (§8.1.3) |
| `DELETE /api/room/{room}/user/{address}` (`deleteRoomUser`) | NOT used on these screens — leave-room is purely local (§4.12.1); the endpoint stays for host drill-down |

#### 4.29.A `/profile` — the "My profile" screen (read-only)

**Purpose.** The attendee's own persona card, restyled to the reference's
first screen: identity header, stats, and three pill tabs over the real
content. The page stays READ-ONLY (§10.1.4's read-only half, carried through
Concept §42.3); no edit affordance exists on it (I-rec 3).

**A.1 Header.** One row: the h1 left (32px, as today) =
`profile.title` — VALUE AMENDED to «Мой профиль» / "My profile" (E.2,
matching the reference's screen title); the top-right cluster holds two
icon-only buttons (48px `--touch-target` each, muted glyph, hover/active →
`--color-text`):

1. **QR affordance** — glyph `scan` (D.3), `aria-label` =
   `profile.header.qr` (new, E.1).
2. **Settings gear** — glyph `gear` (D.2), `aria-label` = `profile.settings.title`
   («Настройки» / "Settings") → navigates to `/profile/settings` (a real link
   styled as an icon button, §2.6). This carries §4.10.2's top-right corner
   entry (amended: labeled button → icon button, G.5).

**A.2 Header QR affordance behavior — tab-switch, NOT a second QR.** The
live badge QR block lives EXACTLY ONCE on the page — inside the QR tab
panel (A.6). Tapping the header QR icon: if the active tab is not QR →
activates the QR tab; if it already is → scrolls the QR block into view
(instant under `prefers-reduced-motion`). A header sheet/modal hosting a
second `QrCodeBadge` was REJECTED: it would duplicate the QR render and the
`aria-live` rotation note, and split the §6.3 contract across two mounts
(I-rec 2).

**A.3 The §6.3 rotation flash note.** The transient «QR обновлён» note
(existing `qrRefreshed`, auto-hide 2 s, `aria-live="polite"`) renders inside
the QR panel under the QR, as today. **When the rotation fires while another
tab is active, the app switches to the QR tab first** — the rotation is
visible by design (§3.6: the swap teaches the one-time mechanic); the note
then shows in place. The underlying contract is UNTOUCHED: the 4 s Poller on
the token-gated `getRoomUser` watches `mutual_code_live`; flag false →
`decideBadgeAction` → generate a fresh code, register ONLY its hash via
`registerMutualCode`, update the `mutualCode` store, re-render with the
rotation micro-animation; a registration failure keeps the last QR and
retries on the next tick (§3.6 AC 14 verbatim).

**A.4 Identity block.** Centered column under the header:
`PixelAvatar` 96px (own persona → accent backdrop; SQUARE treatment, D.1) →
`User.name` centered (Handjet 28px, `overflow-wrap: anywhere`) → the
read-only language meta (`profile.language.meta`, muted 14px). The
reference's verified-check mark is DROPPED (no API backing).

**A.5 Stats row.** The existing 3-stat contract (§2.2, §4.9.5) as THREE
`StatTile`s in one row (grid `repeat(3, 1fr)`, gap `--space-3`), placed
under the identity block and ABOVE the pill tabs (the reference's stats
position): **Sent** (`handshakes.length`) / **Added you** (the
`to_address === me` filter) / **Chatting** (`chats.length`) — computed with
the persona Bearer on mount + after mutations, exactly as today.
**Decision: keep the StatTile component** (surface-elevated tiles, Handjet
numerals, existing `aria-label` pattern) rather than restyling to the
reference's inline "10.2k · 142" text row — the tiles are the established
app pattern and Concept §42.2 names the EXISTING stats contract (I-rec 1).

**A.6 Pill tabs — final naming + content mapping.** Three tabs over real
content (Concept §42.2); every existing `/profile` content block is mapped,
nothing is invented:

| Tab (key) | RU / EN | Panel content (all existing, re-hosted from the §3.6 badge card) |
| --- | --- | --- |
| `profile.tab.about` | «Обо мне» / "About" | The **greeting block** (accent 3px left bar, italic muted, caption `profile.greeting.caption`) + the **public bio** («О себе» / `profile.badge.about`) + the **private bio** (`profile.badge.for_agent` + the muted-red `profile.private_bio.caption` above it, §4.10.3/§4.11.3 carried) — one `--color-surface` card (`.pixel-corners`, radius-lg) |
| `profile.tab.interests` | «Интересы» / "Interests" | The local mirror chips (`stores/interests.ts` → `displayInterests`; `Chip variant="outline-muted"`, emoji + title) — **DISPLAY-ONLY**: no editor, no add affordance (I-rec 12); empty state `profile.interests.empty` — one surface card |
| `profile.tab.qr` | «QR-код» / "QR code" | The **live QR block**: `QrCodeBadge` (or the badge skeleton while no code exists) + both caption lines (`profile.qr.caption`, `profile.qr.onetime`) + the rotation note (A.3) — one surface card; the QR keeps the light `--color-qr-frame` frame and issues no network request (§3.6 carried) |

Nothing real is lost: greeting, both bios, interests, the QR block and the
stats are all mapped; identity lives in the header block (A.4).
**Handshake rows are NOT listed in a tab**: the already-fetched handshake
list feeds the stats counts only (A.5) — a handshake-row list would be a NEW
surface the reference's one-card-per-tab pattern does not require (I-rec 1).
Streak counter, badges, social post card: dropped per §42.2.

**A.7 Pill-tab component spec (on tokens).** Real `<button>`s reusing the
Chip vocabulary (§4.2): **active** tab = `fill-accent` (accent background,
`--color-accent-ink` text), **inactive** = `outline-muted` (1px
`--color-text-disabled-strong` border, `--color-text-muted` text); min-height
48px, padding `0 var(--space-4)`, `--radius-pill`, `--font-body` 14px/600;
NEVER `.pixel-corners` (§4.5: pills stay smooth). Active-state morph: 120 ms
background/color transition (§4.6). Semantics: a `role="tablist"` wrapping
`role="tab"` buttons with `aria-selected` + `aria-controls`, panels as
`role="tabpanel"` labelled by their tab; the tabs are plain tabbable buttons
in DOM order (no roving-tabindex requirement for AA). Default tab on mount:
**About** (first).

**A.8 States.** Loading: the existing skeleton adapted to the new shape
(centered avatar block + name bar + 3 stat-tile skeletons + the tab row).
Error: `ErrorBanner` + retry (existing `refresh()` carried). Persona 404:
the existing not-found card verbatim (`profile.not_found` + `profile.exit`
→ clears identity → `/`). QR: the badge skeleton until a code exists
(never a broken payload). Mutation-pending: n/a (read-only page).

**A.9 Responsive.** `<720px`: the §4.12.1 phone full-screen treatment
CARRIED verbatim from the current implementation (container drops side
padding; cards go radius 0; header keeps its own gutter; tab-bar clearance
stays). `≥720px`: content column max-width 560px centered.

**A.10 Accessibility.** Carried from §3.6: stat tiles announce
"«Отправлено»: 7"-style full pairs; the QR `<figure>` has `role="img"` with
`profile.qr.aria`; focus-visible outline never removed; icon-only header
buttons labeled (A.1). New: the tab semantics (A.7).

#### 4.29.B `/profile/settings` — the "Settings" screen (list-block pattern)

**Purpose.** App-level settings only, restyled to the reference's second
screen (grouped list blocks with icon/chevron rows). Persona editing LEAVES
this page for `/profile/edit` (C); §4.11.4 item 4's "all persona editing
lives here" is SUPERSEDED (G.3).

**B.1 Chrome (carried + one amendment).** No tab bar (the scoped-style
pattern, §4.9.3); back control top-left (history back with a `/profile`
fallback, §1.3). The h1 is **centered** per the reference: grid
`[48px 1fr 48px]`, title = `profile.settings.title` — VALUE AMENDED to
«Настройки» / "Settings" (E.2; the old value «Мой профиль» now belongs to
`/profile`'s title, A.1).

**B.2 List-block pattern.** Grouped `--color-surface` cards (`.pixel-corners`,
radius-lg, padding `--space-4`/`--space-5`) of full-width rows. Row anatomy:
min-height 48px; leading 16px `PixelIcon` (muted) when a suitable glyph
exists; label left (`--font-body` 15px/600, `--color-text`); trailing
element right — the `arrow-right` chevron (`aria-hidden`) for navigational
rows, an inline control or a spinner for actionable rows; 1px
`--color-surface-elevated` divider between rows within a block.
**No toggle rows and no FAQ/Terms/policy rows**: the app has no
toggle-backed setting and no such content — the reference's toggles/FAQ are
NOT invented (I-rec 4/7).

**B.3 Row mapping (the real rows only).**

1. **Block 1 — profile entry row** → `/profile/edit`: mini `PixelAvatar`
   40px (own, square) + `User.name` (15px/600) + the muted
   `User.address` line (single-line ellipsis) + chevron. Rendered as a real
   link; `aria-label` = `profile.edit.title`. This ONE row REPLACES the
   three persona-edit rows (persona / greeting / contact) that §4.11.4
   moved here — their content moves to `/profile/edit` (C.3, G.3).
2. **Block 2 — app settings:**
   - **Language row**: label `common.locale` + the existing `LocaleControl`
     (RU|EN segmented control) inline as the trailing control. The
     reference's "Language ›" sub-page pattern is REJECTED: the control is
     inline today and a sub-page for a two-option switch adds a route for
     nothing (I-rec 8).
   - **Token-rotation row**: `key` glyph + `profile.rotate.row` + trailing
     chevron → the existing `ConfirmDialog` (title/body/CTA copy unchanged,
     §3.6/§8.1.3). Pending: the spinner replaces the chevron. The
     `rotatedFlash` («Ключ обновлён») and `rotateError` lines render under
     the row (`aria-live="polite"` / `role="alert"`), carried verbatim.
3. **Leave room** — the reference's bottom full-width button slot: a
   STANDALONE full-width button BELOW the blocks at the page bottom,
   **outline red** per §7.1.6/§4.9.3 (carried roles verbatim): 1px border
   `--color-danger`, font `--color-danger-text`, TRANSPARENT background —
   never a filled red block; `--radius-pill`; min-height 48px. The existing
   `ConfirmDialog` carries (copy per §4.12.1's purely-local semantics:
   confirm → clear identity + mutual code, KEEP `bleak.tokenVault`, → `/`).

**B.4 Removed from settings.** The persona/greeting/contact edit rows
(their keys retire or move per E.3); the received-contacts list stays
removed (§4.14.2 carried); the internal `view = rows|persona|greeting|contact`
state machine collapses to a static page (implementation note — the editor
components re-host on `/profile/edit`).

**B.5 States.** Mount `getRoomUser` fetch (no poller, §2.2): error →
`ErrorBanner` + retry (carried); `savedFlash` carried (still fired by
nothing until /profile/edit's flow replaces it — see C.5: the flash moves
with the editors). Rotation pending/error/flash per B.3.2.

**B.6 Responsive.** `<720px`: the same phone full-screen list treatment as
A.9 (container drops side padding; blocks radius 0). `≥720px`: blocks
max-width 560px centered (carried §4.9.3).

**B.7 Accessibility.** Rows are real buttons/links (§2.6); chevrons and
icons `aria-hidden` (labeled glyphs) or decorative; the entry row's
accessible name = `profile.edit.title`; everything else carried from the
current implementation.

#### 4.29.C `/profile/edit` — the "Edit profile" screen (new route)

**Purpose.** Persona editing (name/public bio/private bio via
`updateRoomUser`; greeting incl. regenerate via the greeting endpoints; the
LOCAL contact card), moved here per the reference's third screen:
key-value rows + one full-width primary Save Changes. NO interests editor —
I-rec 12 (flagged for owner ratification).

**C.1 Chrome.** Sub-page: no tab bar (B.1 pattern); back control top-left
(history back with a `/profile` fallback); h1 CENTERED = `profile.edit.title`
(new, E.1) «Редактировать профиль» / "Edit profile". Record: §4.12.3's
drop-"Edit" copy sweep applied to editor FORM titles; this is a SCREEN title
the owner's reference names explicitly — superseded for this one title
(I-rec 9).

**C.2 Avatar.** Centered `PixelAvatar` 96px, square (D.1), DISPLAY-ONLY.
**No camera badge**: the bleak-node contract has no avatar-upload endpoint —
the reference's camera affordance is NOT invented (I-rec 6).

**C.3 Field groups (the editors surface here; the reference's key-value
rows).** The three existing editors (`PersonaEditor`, `GreetingEditor`,
`ContactCardEditor`) re-host as sections of ONE form; their individual
Save/Cancel CTAs are retired here (the route owns the single Save, C.4);
their fields, labels, validators and helper copy carry verbatim:

| Group | Rows / fields | Saved via |
| --- | --- | --- |
| **Persona** | **Name** (`profile.edit.row.name`, new) — single-line input, maxlength 64, required (empty → `join.error.name_required`, reused) · **Public bio** (`profile.edit.row.public_bio`, new) · **Private bio** (`profile.edit.row.private_bio`, new) + the muted-red `profile.private_bio.caption` under its label | `PUT updateRoomUser` — ALL THREE fields sent (omitted-field semantics, §3.6) |
| **Greeting** | Label-above block: `profile.greeting.label`; textarea max 255 + counter `profile.greeting.counter`; helper rule `profile.greeting.rule`; inline **Regenerate** outline button (`profile.greeting.regenerate`) — fills the textarea WITHOUT saving (carried §3.6) | `PUT putUserGreeting` |
| **Contact card** | Single-line row: label `profile.contact.edit` (reused — same string/role) + value input ≤255 + helper `profile.contact.note` | LOCAL ONLY — `bleak.contactCard`, no API call on save (§4.13.3) |

**Row anatomy (reference key-value pattern):** single-line fields render as
label (muted 14px) left + right-aligned borderless input (`--color-text`)
in a `--color-surface` row; 1px `--color-surface-elevated` dividers between
rows. **Recorded deviation (I-rec 10):** the multi-line fields (both bios,
the greeting) use label-ABOVE borderless input blocks — a one-line
key-value row cannot hold multi-line text; the greeting keeps its textarea,
counter and validation block.

**C.4 Save model — DECISION: ONE full-width primary Save Changes.** The
reference shows a single Save Changes button and Concept §42.3 says "Save
Changes primary button"; per-editor saves are retired on this screen
(I-rec 3). Spec: full-width button, min-height 48px, `--radius-pill`,
accent background + `--color-accent-ink` text, `--font-body` 16px/600;
pending → spinner in the button; double-submit prevented. Submit sequence:
(1) `updateRoomUser` (name + public_bio + private_bio), (2) `putUserGreeting`,
(3) the local `contactCard` save. **First failure aborts the sequence** —
the failing group shows the inline error (server text; network →
`common.error.network`; greeting 400 → `profile.greeting.no_questions`),
the already-applied steps stand, and a retry re-saves idempotently (both
PUTs send full values). The greeting question-mark rule blocks the WHOLE
save client-side: any `?`/`？` disables Save (`aria-disabled`) with the
reason inline at the greeting field (existing `GreetingEditor` validation,
carried).

**C.5 Success.** Transient «Сохранено» flash (`profile.saved`, reused,
`aria-live="polite"`, 2 s) — the page STAYS on `/profile/edit` (today's
settings flash pattern); the back control returns to `/profile`, which
re-fetches on mount so the updated values render immediately.

**C.6 Back / unsaved changes.** The back control and any navigation discard
unsaved input WITHOUT a confirm dialog — the same semantics as today's
editors' Cancel (I-rec 11).

**C.7 Mount.** Prefill from one `getRoomUser` fetch; the greeting field
additionally re-fetches the canonical greeting via `getUserGreeting`
(carried settings behavior; the `getRoomUser` value is the loading
fallback). Load error → `ErrorBanner` + retry. **No poller** — the §6.3
live-QR contract stays bound to `/profile` only (§2.2 cadence table).

**C.8 Responsive.** `<720px`: §4.12.1 phone full-screen form — the form
fills the viewport, no floating card chrome, tab bar hidden, all content in
bounds at 320/360/390px; the Save button sits in the normal flow after the
field groups. `≥720px`: centered column max-width 560px (consistent with
the other profile screens).

#### 4.29.D Square avatar treatment + icons

**D.1 Square avatars (Concept §42.4 — owner text wins over the reference's
circular avatars).** `PixelAvatar` already renders a sharp-edged square
frame. Spec for all three screens: the bare square frame — NO border-radius,
no ring, no `.pixel-corners` (§4.5 excludes avatars); the own-persona accent
backdrop stays (§4.3's "you are here" mark); the 1px same-color padding
(§4.8.2) carries. Sizes: 96px on `/profile` (A.4) and `/profile/edit`
(C.2); 40px in the settings entry row (B.3.1).

**D.2 Gear glyph (the one new glyph).** The §4.4 registry has NO gear; the
reference's settings gear is load-bearing (A.1). Spec: ONE new glyph `gear`
added to the existing `icons/registry.ts` as a trivially inline 16×16
single-color (`currentColor`) 2px-weight pixel-art SVG — consistent with
§4.4, no new file type, no dependency. Fallback if the owner rejects a new
glyph: reuse `edit` (pencil) for the settings entry (closest existing
semantic). Flagged (I-rec 13).

**D.3 Header QR glyph:** reuse the existing `scan` (viewfinder brackets) —
the scanner-set glyph reads as "show my QR". No new glyph.

**D.4 Other glyphs:** chevron = existing `arrow-right`; token-rotation =
existing `key`; no other new glyphs anywhere in this rev.

#### 4.29.E i18n delta (both dictionaries; RU/EN parity CI-enforced)

**New keys (9).** RU strings are design inventions for tone ratification
(standing precedent — flagged in I-rec 14):

| Key | RU (proposed) | EN |
| --- | --- | --- |
| `profile.header.qr` | «Показать QR-код» | "Show QR code" |
| `profile.tab.about` | «Обо мне» | "About" |
| `profile.tab.interests` | «Интересы» | "Interests" |
| `profile.tab.qr` | «QR-код» | "QR code" |
| `profile.edit.title` | «Редактировать профиль» | "Edit profile" |
| `profile.edit.row.name` | «Имя» | "Name" |
| `profile.edit.row.public_bio` | «О себе» | "About you" |
| `profile.edit.row.private_bio` | «Для агента» | "For your agent" |
| `profile.edit.save` | «Сохранить изменения» | "Save changes" |

**Value edits (2):** `profile.title` «Профиль» → **«Мой профиль»** /
"Profile" → **"My profile"**; `profile.settings.title` «Мой профиль» →
**«Настройки»** / "My profile" → **"Settings"**.

**Retired (3 — usages leave with this rev):** `profile.settings.persona`
(the settings persona-block title; the block becomes the entry row),
`profile.persona.edit` and `profile.greeting.edit` (the editors' h2s are
replaced by the field labels of C.3). Reused unchanged: `profile.contact.edit`
as the contact row's label, `profile.saved`, `profile.greeting.*`,
`profile.badge.*`, `profile.private_bio.caption`, `profile.interests.*`,
`profile.qr.*`, `profile.stats.*`, `profile.language.meta`,
`profile.rotate.*`, `profile.leave*`, `profile.not_found`, `profile.exit`,
`common.locale`, `common.back`.

Net per dictionary: +9 − 3, 2 value edits; parity maintained (the
`i18n.test.ts` per-dictionary count assertions update to the new count).

#### 4.29.F Motion, accessibility, responsive, polling

**F.1 Motion (§2.5/§4.6 — minimal, performance-first).** Tab active-state
morph 120 ms (background/color); **tab panel switch = instant content swap**
(no animation — recorded; nothing scrolls or slides); the QR rotation
micro-animation and the flash notes are UNCHANGED (§3.6). No new
transform/opacity animations; `prefers-reduced-motion: reduce` → the tab
morph and the QR swap become instant (the notes still show).

**F.2 Accessibility (§2.6 AA).** Carried: touch targets ≥ 48px, visible
focus, semantic landmarks, `aria-live` success/error lines, stat-tile and
QR accessible names, contrast on tokens. New: the A.7 tab semantics;
icon-only buttons carry `aria-label`s (A.1); Save's validation-disabled
state is `aria-disabled` with the reason inline (C.4).

**F.3 Responsive (720px breakpoint, §4.12.1).** All three screens: phone
(<720px) full-screen treatments per A.9/B.6/C.8; ≥720px centered 560px
columns; no horizontal scroll at 320/390/760/1280.

**F.4 Polling (§2.2 — cadences unchanged).** `/profile`: the 4 s
token-gated `getRoomUser` badge poll (liveness flag) + stats on mount and
after mutations. `/profile/settings` and `/profile/edit`: mount fetches
only, no pollers. The §6.3 rotation contract (Poller 4 s, `decideBadgeAction`,
register-fresh-on-scan, hash-only registration) stays intact on `/profile`.

#### 4.29.G Supersessions (explicit record)

1. **§3.6 layout (blocks 1–4) SUPERSEDED** by the three-screen structure:
   the single badge card is decomposed — identity + stats become the
   header/identity block (A.4/A.5), greeting + bios + interests
   redistribute into the pill tabs (A.6), the QR block moves into the QR
   tab, the settings block lives restyled on its own route. §3.6's API
   table, live-QR mechanics, rotation micro-animation, not-found and error
   states CARRY where not restated.
2. **§3.6 block 3 (inline editors on `/profile`) SUPERSEDED**: `/profile`
   is READ-ONLY (§10.1.4's read-only half carried through Concept §42.3);
   editing moves to `/profile/edit` (C).
3. **§4.11.4 item 4 ("no profile edit button; all persona editing lives in
   `/profile/settings`") SUPERSEDED**: persona editing lives in
   `/profile/edit`; it is entered from the `/profile/settings` entry row —
   `/profile` itself stays edit-button-free (the reference's first screen
   has none either). §4.11.4's other items carry.
4. **§4.9.3 item 3 AMENDED**: the leave-room outline-red rule CARRIES
   verbatim (border `--color-danger` / font `--color-danger-text`,
   B.3.3), but the settings page composition (plain column of pill
   buttons) is SUPERSEDED by the list-block pattern (B.2–B.3).
5. **§4.10.2 (settings corner entry) AMENDED**: position top-right
   unchanged; the labeled compact button becomes the gear ICON button
   (A.1).
6. **§4.12.1 item 5 CARRIED and extended**: the phone full-screen treatment
   now explicitly covers `/profile`, `/profile/settings` and
   `/profile/edit`.
7. **§3.6 acceptance criteria redistributed**: AC 1 (badge contents) →
   A.4–A.6; AC 2–4 (persona/greeting editors) → C (restated in H);
   AC 5 (interests editor) SUPERSEDED — no interests editor exists anywhere
   (§23.2 5.6; the tab is display-only); AC 6 (locale) → B.3.2; AC 7
   (leave) → B.3.3; AC 8–15 carry where not restated (404 state, stat
   arias, tokens, live QR, scannability, code-split, live rotation, token
   rotation).
8. **§4.12.3's drop-"Edit" sweep AMENDED for one title**: the
   `/profile/edit` screen title keeps "Edit" (C.1, the owner's reference
   names the screen).
9. **§1.1 sitemap AMENDED** (the table rows marked there).

#### 4.29.H Acceptance criteria (checkable)

`/profile`:

1. The header shows «Мой профиль»/"My profile" with two icon-only buttons
   top-right: QR (`aria-label` «Показать QR-код»/"Show QR code") and gear
   (`aria-label` «Настройки»/"Settings"); the gear navigates to
   `/profile/settings`.
2. Tapping the header QR button activates the QR tab (or scrolls the QR
   block into view when it is already active); EXACTLY ONE `QrCodeBadge`
   instance exists on the page.
3. The identity block is centered: a 96px sharp-edged SQUARE `PixelAvatar`
   (no border-radius, accent backdrop), the centered name (Handjet), and
   the muted read-only «Язык агента: {language}» line.
4. The stats row renders three `StatTile`s — Sent (`handshakes.length`),
   Added you (`to_address` filter), Chatting (`chats.length`) — every fetch
   carrying the persona Bearer, on mount + after mutations.
5. Three pill tabs with the final naming (About / Interests / QR code);
   active = fill-accent, inactive = outline-muted; `tablist`/`tab`/
   `tabpanel` semantics with `aria-selected`; the default tab on mount is
   About; the active-state morph is a 120 ms color transition and the
   panel switch is instant.
6. The About tab shows the greeting block (accent bar), the public bio and
   the private bio with its muted-red caption — and the PAGE has no edit
   affordance anywhere (read-only).
7. The Interests tab renders the mirror chips display-only (no editor, no
   add control; empty state «Интересы не выбраны»/"No interests yet"); no
   network request is issued for interests.
8. The QR tab shows the live QR block: the badge skeleton until a code
   exists; the payload `{INVITE_URL_BASE}?u={userAddress}&m={mutualCode}`;
   both caption lines; the QR is not interactive and issues no network
   request; the `uqr` encoder stays code-split into the `/profile` chunk
   only.
9. Live rotation: the 4 s token-gated `getRoomUser` poll; flag false → a
   fresh code is generated, ONLY its hash registered via
   `registerMutualCode`, the store updated, and the QR re-rendered with the
   rotation micro-animation plus the transient «QR обновлён» note
   (`aria-live`); a registration failure keeps the last QR and retries next
   tick; if another tab is active when the rotation fires, the app switches
   to the QR tab first.
10. Persona 404 → the not-found card with the working exit path; network/API
    errors → `ErrorBanner` with retry.
11. No hardcoded colors anywhere on the three screens; every surface, text
    and border derives from `tokens.css`.

`/profile/settings`:

12. Sub-page chrome: no tab bar; back control (history back with a
    `/profile` fallback); CENTERED h1 «Настройки»/"Settings".
13. The entry row (40px own avatar + name + muted address + chevron)
    navigates to `/profile/edit`; the three old persona-edit rows are gone.
14. The Language row keeps the RU|EN `LocaleControl` inline; switching
    persists and re-renders the app without a reload.
15. The token-rotation row opens the ConfirmDialog with the other-device
    lockout copy; confirming calls `rotateUserToken` (current Bearer, new
    raw token in the body) and updates `identity.token` + the matching
    `bleak.tokenVault` entry only after a 2xx; 401 → the §2.8 global gate;
    403 → inline server text with the identity kept.
16. Leave room renders as the full-width BOTTOM outline-red button — border
    `--color-danger`, font `--color-danger-text`, transparent background
    (never filled); its ConfirmDialog copy matches §4.12.1 (purely local:
    clears identity + mutual code, keeps the vault, navigates `/`).
17. Settings contains NO persona-edit rows and NO toggle rows.

`/profile/edit`:

18. Sub-page chrome: no tab bar; back control; centered h1
    «Редактировать профиль»/"Edit profile"; centered 96px square avatar,
    display-only (no camera badge).
19. All field groups render: name (required, maxlength 64), public bio,
    private bio (muted-red caption), greeting (textarea ≤255 + counter +
    rule helper + Regenerate that fills WITHOUT saving), contact card
    (≤255, local only).
20. Save Changes is ONE full-width accent button: a question mark in the
    greeting disables it (`aria-disabled` + the inline reason); the submit
    sequence is `updateRoomUser` → `putUserGreeting` → the local contact
    save; the first failure aborts with the inline error at the failing
    group and already-applied steps stand; a retry re-saves idempotently;
    double-submit is prevented; success shows the «Сохранено» flash
    (`aria-live`) and stays on the page.
21. Mount prefill comes from `getRoomUser` (+ the canonical `getUserGreeting`
    for the greeting); a load error shows `ErrorBanner` + retry; NO poller
    runs on this page.
22. Back discards unsaved input without a confirm; on phone (<720px) the
    form is full-screen with no floating card chrome and no horizontal
    scroll at 320/360/390px; at ≥720px it is a centered 560px column.

Cross-cutting:

23. i18n: exactly the E-table delta — 9 new keys, 2 value edits, 3 retired
    keys — present in BOTH dictionaries with parity green; the RU/EN switch
    re-renders every string without a reload.
24. Tests asserting the superseded §3.6/§4.9.3 layouts are updated to this
    rev; `make lint && make test && make build` stays green.

#### 4.29.I Decision records (numbered) + flagged items

1. **Tab naming + content mapping final** (A.6): About («Обо мне») /
   Interests («Интересы») / QR code («QR-код»); stats live above the tabs;
   identity in the header block. Handshake rows are NOT listed in a tab —
   the fetched list feeds the stats counts only (no invented surface).
2. **Header QR affordance = tab-switch** (A.2), not a second QR instance
   or a sheet: one live-QR mount, one `aria-live` region, the §6.3
   contract undivided.
3. **Save model on `/profile/edit` = ONE full-width Save Changes** over the
   three groups, sequential with abort-on-first-failure (C.4); per-editor
   Save/Cancel CTAs are retired on that screen (their validators and copy
   carry into the sections).
4. **Settings grouping** (B.3): two blocks (profile entry; app settings)
   + the bottom leave-room button; Language stays an INLINE control (no
   sub-page); no toggle rows and no FAQ/Terms rows (nothing invented).
5. **Leave-room placement** (B.3.3): it STAYS on `/profile/settings` as the
   bottom full-width outline-red button (§7.1.6 roles verbatim); the
   reference edit-screen's "Delete Account" is NOT reproduced on
   `/profile/edit` — one destructive surface (Concept §42.3 defers
   placement to this rev).
6. **No avatar upload / camera badge** (C.2): the API has no avatar field.
7. **No toggle rows** (B.2): no real toggle-backed setting exists.
8. **Language inline** (B.3.2): no `/profile/settings/language` route.
9. **The screen title "Edit profile"** keeps "Edit" despite §4.12.3's
   sweep (the owner's reference names the screen; G.8).
10. **Multi-line fields use label-above blocks** (C.3); the key-value
    one-line row is reserved for single-line fields (name, contact card).
11. **Unsaved-changes back = discard without confirm** (C.6), matching
    today's editors' Cancel semantics.
12. **FLAGGED for owner ratification (process decision, not
    owner-approved): NO interests editor on `/profile/edit`.** Concept
    §23.2 5.6 removed the interests editor ("set at creation only") and
    the picker component no longer exists; §42.3's parenthetical listing
    of "interests" is inherited §10.1.4 phrasing, not an explicit
    overturn. The interests TAB on `/profile` is display-only over the
    local mirror chips (`stores/interests.ts`). If the owner overturns,
    the editor returns as a fourth group on `/profile/edit` — a contained
    addition.
13. **The new `gear` glyph** (D.2, trivial inline SVG per §4.4) is flagged
    alongside item 12; the fallback is the existing `edit` glyph.
14. **RU copy in the E table is a design invention for tone ratification**
    (standing precedent): «Показать QR-код», «Обо мне», «QR-код»,
    «Редактировать профиль», «Имя», «О себе», «Для агента», «Сохранить
    изменения», and the two amended values («Мой профиль», «Настройки»).

### 4.30 v3.24 feature design (2026-11-23, owner-approved Concept §42): §42 scroll-triggered animations + card/width/icon tweaks

The owner issued the five-item §42 batch (2026-11-23): (1) scroll-triggered
reveal animations for the landing blocks, (2) a narrower Bleak agent card in
the computer view, (3) icons +50% in every block below the first screen, (4)
the 01/02/03 step cards repainted to the Bleak card's dark background, (5) on
phone the banner's flower icon + status caption stack ABOVE the text block.
This section amends §4.28 (→ §4.27 → §4.26 → … → §4.20) item by item;
**where §4.30 is silent, the earlier specs stand** except where §4.30.G
explicitly supersedes them. The parallel §4.29 profile redesign (Concept §42
profile section, task 131) is scope-disjoint — it owns `routes/profile*`;
this rev touches ONLY the landing (`/`) — and the earlier-dated §4.29 text is
not amended here. Grounded in the live code (read-only audit, 2026-11-23):
`apps/web/src/routes/+page.svelte` (the glass header, the fixed video layer,
the thirds grid, banner, step cards, sim, privacy, use-cases, join, footer),
`lib/components/landing/{LandingVideoHero,LandingFigure}.svelte`,
`landing/{sectionArt,figures}.ts`, `lib/components/icons/PixelIcon.svelte`,
`lib/styles/{tokens,base}.css`, `tests/landing-page.test.ts`. Hard
constraints unchanged: **no new dependencies** (IntersectionObserver is
native — the §4.27.D compat-circle observer is the in-repo precedent), **no
copy changes** (i18n ZERO delta, §4.30.H), **palette tokens unchanged** (the
step-card repaint reuses the existing `--color-surface` token; no new color
values anywhere), **no canvas, no animation library**, **routes untouched**,
**/income untouched**, **the §37 open-state geometry holds** (no layout rule
of §4.25.A/§4.28 is touched), **the video layer and its attribute set are
untouched** (§4.23.A/§4.27.1 verbatim). **API endpoints used: none** — the
landing stays fetch-free (§4.20 preamble); the round is presentational. Task:
tz12-13 (`feature/9626632b-tz12-13-scroll-reveal-tweaks`).

#### 4.30.A The shared scroll-reveal system (item 1)

Blocks below the fold reveal as they enter the viewport. The treatment is
the pixel-aesthetic-consistent **fade + rise**: `opacity 0 → 1` with a
**stepped** fade and `translateY(16px) → 0` with an eased settle —
transform/opacity only (the §4.6 rule).

- **The hidden-state application pattern — never permanently hidden.** The
  stylesheet hides NOTHING by default: a bare `[data-reveal]` marker
  attribute (present in the markup of every reveal unit, zero visual
  effect) carries no styles. The hidden state exists ONLY under
  `[data-reveal='armed']` — a state the JS utility applies at mount, so it
  exists only when (a) JS ran and (b) the utility decided animation is
  possible. No-JS, a utility crash, or a missing IntersectionObserver ⇒ no
  arming ⇒ every block fully visible. CSS:
  ```css
  /* base: [data-reveal] carries NO styles — the no-JS default is visible */
  [data-reveal='armed'] {
    opacity: 0;
    transform: translateY(16px);
    transition:
      opacity 320ms steps(4, end),   /* the stepped pixel fade */
      transform 320ms ease-out;      /* the eased settle */
    transition-delay: var(--reveal-delay, 0ms);
  }
  [data-reveal='armed'].is-revealed {
    opacity: 1;
    transform: translateY(0);
  }
  ```
  (The transition lives on the armed state so it runs when `.is-revealed`
  lands; both values are `var(--reveal-delay)`-delayed.)
- **The utility — one module, one observer, one-shot:** new
  `apps/web/src/lib/components/landing/reveal.ts` exporting
  `setupReveals(root: ParentNode): () => void` (returns the teardown). On
  mount (a `$effect` in `+page.svelte`) it:
  1. returns immediately (arming nothing) when
     `matchMedia('(prefers-reduced-motion: reduce)').matches` — the
     established `reducedMotion()` check, §4.27.D precedent — reduced
     motion = NO animation, every block visible immediately;
  2. returns immediately when `typeof IntersectionObserver !== 'function'`
     (old browsers/test DOM) — the §4.27.D mount-fallback reading;
  3. otherwise queries `root.querySelectorAll('[data-reveal]')`, creates
     ONE shared `IntersectionObserver` (`threshold: 0.15`,
     `rootMargin: '0px 0px -48px 0px'` — a block fires once ≈ 48px of it
     is inside the viewport; the values are this design's call, §42.1
     delegates the treatment), and for each unit: sets
     `data-reveal='armed'` (the ONLY moment anything hides), observes it;
  4. on the FIRST intersection of a unit: adds `.is-revealed`, calls
     `observer.unobserve(unit)` — one-shot, scrolling away and back does
     NOT replay (the compat-circle precedent, §4.27.D) — and schedules the
     **cleanup**: after the reveal completes (`transitionend` on the unit,
     with a 720 ms fallback timer for transition-less DOMs) BOTH the
     `is-revealed` class and the `data-reveal` attribute are REMOVED. The
     block ends in its natural state, so the hover CSS
     (`.step-block:hover`'s `translateY(-4px)`) can never fight a leftover
     attribute-selector transform (specificity tie otherwise);
  5. the teardown disconnects the shared observer (the `$effect` cleanup —
     no leak across HMR/tests).
- **Stagger:** within a sibling GROUP the units reveal with a per-index
  `--reveal-delay` (inline style): the three `.step-block`s at
  0/60/120 ms, the four `.usecase-pill`s at 0/60/120/180 ms (60 ms per
  sibling, capped at 180). Single-unit sections get no delay.
- **The §4.27.D compat ring is INDEPENDENT:** the sim section reveals as a
  block via this system; the ring's own one-shot count-up observer
  (threshold 0.4, §4.27.D) is UNTOUCHED — two one-shot observers on
  adjacent subtrees, no shared state. Both being one-shot, the count-up
  never replays either.
- **§4.6 record:** the closing line "No scroll-triggered or
  layout-triggered animation anywhere" is SUPERSEDED **for the landing
  page only** (the owner's §42.1 mandate); it stands verbatim for every
  other page. The reveal's 320 ms/16 px values are a landing-scoped
  §42.1 design call; the §4.6 transform/opacity-only and reduced-motion
  rules carry.

#### 4.30.B Which blocks reveal + the first-viewport decision (item 1, enumeration)

**Scroll-reveal units (everything below the fold), in DOM order:**
`.area-stat` (the banner) → `.step-block` ×3 (staggered) → `.area-sim` →
`.area-privacy` → `.usecase-pill` ×4 (staggered) → `.area-join` →
`.area-foot` (the footer pill). The banner, sim, privacy and join sections
reveal as ONE unit each (their glass containers are single surfaces; inner
cards need no separate reveal). The step blocks and use-case pills reveal
individually (they are separate glass surfaces in a row) with the 60 ms
stagger.

**The §37 open-state pair — DECIDED: animate on LOAD, not on scroll.** The
lead (`.copy`/`.area-lead`) and the BLEAK card (`.area-agents`) are in the
first viewport at open (§4.25.A); a scroll observer would fire immediately
anyway, so they are NOT `[data-reveal]` units. Instead the utility performs
one **load reveal**: it arms both hero sections with the same
`data-reveal='armed'` hidden state, then one animation frame later
(`requestAnimationFrame` — the initial styles must commit first) adds
`.is-revealed`, then cleans up exactly like a scroll reveal. Net: one
fade+rise on page open, then the §37 centered open state stands
permanently. The 16 px rise is transient (transform-only, no layout shift)
and settles into the exact §4.25.A geometry. Under reduced motion or
without JS/IO the hero pair is simply visible from the first paint (no
load animation). **Negative:** the hero pair's ICONS are untouched by item
3 (§4.30.D) — only the §4.28 headline/sub/CTA sizes stand there.

#### 4.30.C The Bleak card narrower on desktop (item 2)

The §4.24.D thirds grid STAYS (col 1 lead / col 2 empty / col 3 agent;
`repeat(3, 1fr)`, `--space-6` gap, `align-content/align-items: center` —
§4.25.A hero construction verbatim). The card gets a **max-width cap inside
its own column** (NOT a grid change): at 1280 the third is ≈ 288px wide
(§4.24.C math); the owner wants the card narrower.

```css
@media (min-width: 720px) {
  .agent-card {
    max-width: 240px;          /* down from the 288px full-third width */
    margin-inline: auto;       /* centered inside the third */
  }
}
```

- **The value — 240px, decided (the caller's 232–240 band):** the card
  interior after its 20px body padding is 200px — the 96px portrait,
  the 28px BLEAK name, the 13px badge/traits and the 17px quote all fit
  (the quote wraps to ~3 lines at 17px in 200px — normal-flow growth,
  `align-items: center` keeps the card balanced in the 100dvh hero row).
  240px keeps ≥ 200px of text column (readability) and is an even pixel
  value (crisp-frame alignment).
- **Phone (<720px): UNCHANGED** — the card is 100% of the container width
  (§4.28.F); the cap is desktop-only. The `#agents` id, the §4.20.G
  hover/press/focus contract and TALK → `/income` are untouched.
- **No horizontal-scroll risk:** the cap shrinks the card inside its
  column; nothing paints wider than before.

#### 4.30.D Icons +50% in all blocks below the first screen (item 3)

One rule everywhere below the fold: every icon/pixel-icon element grows
**+50%**, the pixel mini-illustrations scale proportionally with them.
Even pixel values (crispEdges alignment); the exact table, current → new:

| # | Element | Selector / prop | Current | New (+50%) |
| --- | --- | --- | --- | --- |
| 1 | Banner flower (BLOOM) | `.stat-glyph :global(svg)` | 44px phone / 48px ≥720px | **66px phone / 72px ≥720px** (the markup `size={48}` updated to 72 for consistency; the CSS override rules) |
| 2 | Banner status dot | `.status-dot` | 6×6px | **9×9px** — exact +50% (a DOM `<span>`, no crispEdges constraint; even-rounding applies to SVG art only). Its glow scales too: `box-shadow: 0 0 9px …` |
| 3 | Step-card icons | `PixelIcon size={32}` inside `.step-icon` | icon 32px, wrapper 48×48 | icon **48px**, wrapper **72×72** |
| 4 | Step mini-illustrations | `.step-art` (24×24 grid) | 48px | **72px** (integer 3× unit scale — perfectly crisp) |
| 5 | Privacy icons | `.privacy-icon` (16×16 grid) | 48px | **72px** |
| 6 | Use-case icons | `.usecase-icon` (16×16 grid) | 40px | **60px** |
| 7 | Simulation avatars | `LandingFigure size={64}` (`.sim-you` BLEAK + `.sim-nearby` SCOUT) | 64px | **96px** (the §4.26.F 64 → the §4.20.G portrait register) |

- **crispEdges note (record):** the 16-grid icons at 72px (4.5×) and 60px
  (3.75×) scale by a non-integer unit factor; with
  `shape-rendering="crispEdges"` every unit rect still snaps to whole
  device pixels (no blur); a possible 1px wobble on shared rect edges is
  accepted. Integer-scale alternatives (80px / 5× and 64px / 4×) would
  break the exact +50% — the owner's number wins (§4.30.K flag 1).
- **Layout-fit re-check:** sim avatars 96px — phone the 2-col avatar row
  gives ≈ 128px columns at a 320px viewport (96px portrait + the 16px
  name fit), desktop the 1fr side columns hold ≈ 360px; the use-case
  pills' content grows past the 112px `min-height` to ≈ 124px (content
  growth, `min-height` UNCHANGED); privacy items and step bodies grow
  naturally (normal flow). No overflow at 320/760/1280 (§4.20.K holds).
- **Explicit negatives — UNCHANGED (the first-viewport pair + chrome):**
  the lead sparkles (8px) and everything in `.copy`; the BLEAK agent-card
  portrait (`size={96}`, §4.20.G); the join card's BLEAK-WAVE mascot
  (`size={96}` — NOT in the owner's §42.3 enumeration, §4.30.K flag 2);
  the footer's 16px brand glyph (chrome); `.step-num` (40px decorative
  text, §4.28.E.5); the `.compat-ring` (geometry-bound, §4.28.E.6);
  `.sim-cursor` (6×2px). No other landing size changed.

#### 4.30.E Step cards → the Bleak-matching dark background (item 4)

Inspected in the live code: the BLEAK agent card's surface is the
§4.20.G pixel-frame OPAQUE construction — the outer
`pixel-corners pixel-frame pixel-frame--strong` ring + the inner
`pixel-corners` body whose fill comes from the base.css card rule
(`.card { background: var(--color-surface) }`, `#101213`) — while the
step cards carry the §4.26.C glass (`rgba(15, 14, 22, 0.65)` +
`backdrop-filter: blur(10px)`). Decision: the three step cards get the
SAME material as the agent card:

```css
.step-body {
  background: var(--color-surface);   /* WAS rgba(15, 14, 22, 0.65) */
  /* the two backdrop-filter / -webkit-backdrop-filter: blur(10px)
     declarations are REMOVED — an opaque surface needs no blur, and the
     per-card GPU filter cost goes with it */
  position: relative;   /* unchanged */
  padding: 16px;        /* unchanged (20px ≥720px via the existing rule) */
  /* the flex column / gap / align-items declarations unchanged */
}
```

- **What remains on the step cards (everything else of §4.26.C/§4.28):**
  the pixel-frame construction (outer strong ring + stepped body — the
  cards stay square/stepped, §4.26.K.7), the hover purple glow + 4px lift
  (§4.26.C, reduced-motion guarded), the 48px mini-illustrations (now
  72px, §4.30.D), the micro-pills (§4.26.L, 12/13px §4.28.D), the 01/02/03
  numerals, titles and descriptions (§4.21.E/§4.28.A–B), and the
  `min-height: 300px` desktop rule.
- **The shared-token assertion (the testable form of "matching"):** the
  step bodies and the agent card surface are the SAME TOKEN —
  `.step-body`'s `background` declaration is literally
  `var(--color-surface)`, byte-equal to the agent card's
  (`.card`) fill; the suite asserts the declaration equality + the ABSENCE
  of `backdrop-filter` in the `.step-body` rule. No new token, no new
  color value (palette unchanged).
- **Scope — ONLY the step cards:** the banner, sim/privacy/use-case/join
  sections, footer, header and join input keep their §4.26 glass values
  verbatim (this is not a de-glass pass).

#### 4.30.F "Real people. Real results." on phone — icon stacked on top (item 5)

The banner (`.stat-body`, currently a text-left / glyph-right ROW at every
width) stacks on phone: the flower icon + its status caption move ABOVE
the text block.

```css
/* phone (<720px) — base rule CHANGED: */
.stat-body {
  display: flex;
  flex-direction: column;     /* WAS the row */
  align-items: flex-start;    /* the stack is left-aligned */
  gap: var(--space-3);
  padding: 12px 14px;         /* unchanged */
  background: rgba(20, 18, 30, 0.55);          /* §4.26.B verbatim */
  -webkit-backdrop-filter: blur(12px); backdrop-filter: blur(12px);
}
.stat-glyph {
  order: -1;                  /* the icon+caption block FIRST */
  flex-direction: row;        /* flower left, caption beside it */
  align-items: center;
  gap: 6px;
}
@media (min-width: 720px) {
  /* desktop: the §4.21.F/§4.26.B compact row, UNCHANGED */
  .stat-body {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-4);
    padding: 16px 20px;
  }
  .stat-glyph { order: 0; flex-direction: column; align-items: center; gap: 6px; }
}
```

- **The exact phone order:** (1) the icon+caption row — the 66px BLOOM
  flower left, the pulsing 9px green dot + the `AI Agents active nearby`
  caption to its right, vertically centered against the flower; (2) the
  `[ LIVE NETWORK // IRL ]` pixel sub-badge (stays the first child of
  `.stat-copy`, glued above the title in BOTH layouts — the owner's item
  5 names only the flower+caption move); (3) the title
  `REAL PEOPLE. REAL RESULTS.` (21px, §4.28.A); (4) the three stat lines
  (17px, §4.28.B).
- **Desktop ≥720px: UNCHANGED** — the text-left / glyph-right compact row
  (the §4.26.B contract verbatim, with the §4.30.D 72px flower).

#### 4.30.G Supersessions (explicit record)

1. **§4.26.C step-card glass fill SUPERSEDED (item 4):** `.step-body`'s
   `rgba(15, 14, 22, 0.65)` + `backdrop-filter`/`-webkit-backdrop-filter:
   blur(10px)` retire for the step cards; the fill is the agent card's
   opaque `var(--color-surface)` (§4.30.E). The glass recipe survives on
   the banner, the four sections, the footer and the join input
   (unchanged). §4.28.G.5's "glass fill … untouched" clause is amended
   accordingly (hover, art, min-height 300px carry).
2. **§4.6 "No scroll-triggered or layout-triggered animation anywhere"
   SUPERSEDED for the landing page only** (§4.30.A record): §42.1
   mandates the scroll reveals; the rule stands for every other page,
   and the §4.6 transform/opacity-only + reduced-motion rules carry.
3. **§4.24.D/§4.25.A agent-card width AMENDED (item 2):** the desktop
   card fills its third no longer — `max-width: 240px` +
   `margin-inline: auto` inside the unchanged thirds grid (§4.30.C);
   phone stays 100%.
4. **§4.26.B/§4.28 banner phone layout AMENDED (item 5):** the
   text-left/glyph-right row is the ≥720px rule; the phone base becomes
   the stacked column with the glyph block first (§4.30.F). The banner's
   glass fill, badge, padding and typography contracts stand.
5. **§4.21.F/§4.26.B/§4.26.F/§4.26.G/§4.26.H icon sizes AMENDED (item 3):**
   the §4.30.D table's current values are superseded (+50%); every other
   size value (fonts, the ring, `.step-num`, the join mascot, the footer
   glyph) is byte-unchanged.
6. **Superseded-but-carried (unchanged into §4.30):** the §4.23.A/§4.27.1
   fixed video layer + native-loop playback + attribute set, the
   §4.22.A keep-list, the §4.25.A/B open state + transparent lead (the
   hero pair's LOAD reveal is an addition, not a geometry change),
   §4.26.A header, §4.27.C/D compatibility circle (its own observer
   untouched), §4.28.A–F type ladder + phone widths, §4.28.1 lead copy/
   color, the §4.20.L behavior + deep-link forwarding, the
   §4.23.G/§4.26.M/§4.27.H/§4.28.I reduced-motion + error fallbacks.

#### 4.30.H i18n: ZERO delta

No key is added, removed or edited — both dictionaries stay **byte-identical
at 55 `landing.*` keys per dictionary** (the §4.27.G count, restated green
in §4.28.H/§4.28.J-12). Every rendered string — REAL PEOPLE. REAL RESULTS.,
the status caption, the pills, the badges — is byte-unchanged in RU and EN;
§42 changes geometry, color and motion only. `i18n.test.ts` and the
`LANDING_KEYS`/parity/dead-key assertions are UNTOUCHED and stay green
(55/55); the RU/EN switch re-renders every string without a reload.

#### 4.30.I Reduced motion + media states

- **Reveal (all units + the hero load pair):** reduced motion → the
  utility arms NOTHING — every block, including the lead + BLEAK pair, is
  fully visible from the first paint; no observer is created, no class is
  ever applied. Belt-and-braces: the base.css catch-all collapses any
  transition to 0.01 ms. The one-shot rule means no replay on re-scroll
  for motion-full users either.
- **Everything already guarded stands verbatim:** the banner status dot,
  sim badge pulse, cursor blink, sparkle, dot twinkle, hover lifts/glows,
  smooth-scroll (§4.26.M/§4.27.H); the video fallback (paused frame 0 +
  tint + vignette + dots, §4.23.G); the ping-pong file plays via native
  `loop` (§4.27.1). The reveal transitions are transform/opacity-only
  (§4.6).
- **Media states:** the landing still fetches nothing — no
  loading/empty/error data states (§4.20.L); the reveal adds no data
  states and no layout shift (transform-only; the +50% icon growth is
  below-the-fold normal-flow growth; the narrower agent card shrinks
  inside its column). Video error → the §4.23.G near-black treatment with
  every block visible (the reveal fires over the static backdrop the same
  way).

#### 4.30.J Acceptance criteria (checkable)

**Scroll reveal (item 1):**
1. Every below-the-fold unit — `.area-stat`, the three `.step-block`s,
   `.area-sim`, `.area-privacy`, the four `.usecase-pill`s, `.area-join`,
   `.area-foot` — carries the `[data-reveal]` marker in the markup, and
   the stylesheet declares NO hiding outside `[data-reveal='armed']`
   (negative: no `opacity: 0`/`visibility: hidden` on a bare
   `[data-reveal]` or any landing block class) — with JS off, every block
   renders fully visible.
2. The shared utility `landing/reveal.ts` exists and is wired once in
   `+page.svelte`: ONE IntersectionObserver instance, `threshold: 0.15`,
   `rootMargin: '0px 0px -48px 0px'`, per-unit `unobserve` after the
   first intersection, observer disconnected on unmount; scrolling a
   revealed block away and back does NOT replay (one-shot).
3. The armed → revealed sequence: `data-reveal='armed'` (hidden:
   `opacity: 0`, `translateY(16px)`) → `.is-revealed` (visible) with
   `transition: opacity 320ms steps(4, end), transform 320ms ease-out`
   and the group stagger (`--reveal-delay`: step blocks 0/60/120 ms,
   use-case pills 0/60/120/180 ms); after completion BOTH the class and
   the attribute are removed (the cleanup — no leftover transform to
   fight `.step-block:hover`'s lift).
4. The hero pair (`.area-lead`, `.area-agents`) animates ON LOAD — armed
   at mount, `.is-revealed` one frame later, same treatment — and is NOT
   a scroll unit; the §37 open-state geometry holds (the first viewport
   at the scroll origin contains ONLY lead + BLEAK, vertically centered,
   at 1280×800 and 390×844 — the §4.25/§4.28 assertions stay green).
5. Reduced motion: `prefers-reduced-motion: reduce` → NO arming, NO
   observer — every block including the hero pair is visible immediately;
   with IntersectionObserver unavailable everything reveals immediately
   (the mount fallback); no block can ever remain permanently hidden.

**Bleak card narrower (item 2):**
6. At ≥720px the agent card computes `max-width: 240px` centered in its
   third (≈ 288px column at 1280 — the card is narrower than the column);
   the thirds grid (`repeat(3, 1fr)`, col 2 EMPTY) is UNCHANGED; on phone
   (<720px) the card is 100% of the container width (no cap).
7. The §4.20.G contract holds: pixel frame, hover lift + glow, press
   scale, focus rings, TALK → `/income`; no horizontal scroll at
   320/760/1280.

**Icons +50% (item 3):**
8. The table holds (computed/source assertions): `.stat-glyph :global(svg)`
   66px (72px ≥720px); `.status-dot` 9×9px with its glow at 9px; the step
   `PixelIcon` renders 48px inside a 72×72 `.step-icon`; `.step-art`
   72px; `.privacy-icon` 72px; `.usecase-icon` 60px; both sim figures
   render at 96px (BLEAK + SCOUT via `size={96}`).
9. Negatives: the lead + BLEAK pair's art is unchanged (sparkles 8px, the
   agent portrait 96px); the join BLEAK-WAVE mascot stays 96px; the
   footer glyph stays 16px; `.step-num` stays 40px; the compat ring stays
   160×160/40px numeral; no other landing size changed (grep-audit).

**Step-card background (item 4):**
10. `.step-body` computes/declares `background: var(--color-surface)` —
    byte-equal to the agent card's surface token — with NO
    `backdrop-filter`/`-webkit-backdrop-filter` in the rule (the
    rgba(15,14,22,0.65)+blur(10px) assertions are REPLACED); `.step-body`
    still sets NO `border-radius` (the pixel frame stays square/stepped);
    hover glow + lift, mini-illustrations, micro-pills, numerals/titles/
    descs and `min-height: 300px` (≥720px) are unchanged. The banner,
    sim/privacy/use-case/join, footer, header and join input keep their
    glass values verbatim (negative: those rules untouched).

**Phone banner stacking (item 5):**
11. At <720px `.stat-body` is a left-aligned flex COLUMN with
    `.stat-glyph` at `order: -1` laid out as a ROW (66px flower left, the
    dot + caption beside it): visual order = icon+caption block →
    `[ LIVE NETWORK // IRL ]` badge → title → the three stat lines.
12. At ≥720px the banner is the UNCHANGED compact row — text left, glyph
    column right (bloom above the caption), `justify-content:
    space-between`, padding 16px 20px; nothing else about the banner
    changed (glass fill, badge, copy).

**i18n + suites (carry):**
13. i18n: exactly **55** `landing.*` keys in BOTH dictionaries,
    byte-unchanged (ZERO delta); the RU/EN switch re-renders without a
    reload; `i18n.test.ts` passes UNAMENDED.
14. Suites amended and green: `landing-page.test.ts` — the superseded
    §4.26.C step-glass assertions (rgba(15,14,22,0.65) + blur(10px))
    rewritten to AC 10, the `.stat-glyph` 44/48 assertions rewritten to
    66/72, the 55-key `LANDING_KEYS` list stays; new assertions per
    ACs 1–12 (the reveal utility, marker/armed/revealed classes, reduced-
    motion no-arm, the icon table, `.agent-card` max-width 240px desktop
    only, the banner stacking rules); `sweep.test.ts` green (no new color
    values — the step repaint is the existing `--color-surface` token);
    `videoPingPong`/`mascot`/`summary-sheet`/`join-flow`/
    `creation-wizard` suites untouched green; `make lint && make test &&
    make build` green.
15. Constraints: no new dependencies (native IntersectionObserver); no
    copy changes (55/55 byte-identical); palette tokens unchanged (no new
    values anywhere); routes untouched; `/income` untouched; the §37
    open-state geometry holds; the video layer + attribute set untouched;
    API endpoints used: none.

#### 4.30.K Flags for the owner / concept (concept report)

1. **Record — the 16-grid icon scale is non-integer at the exact +50%:**
   privacy 72px (4.5×16) and use-case 60px (3.75×16) scale unit rects by a
   fractional factor; `crispEdges` keeps every edge snapped (no blur, a
   possible 1px wobble accepted). Integer-scale alternatives (80px/64px)
   would deviate from +50% — the owner's number wins; a one-value swap
   each if the smoke dislikes it.
2. **Record — the join card's BLEAK-WAVE mascot is NOT in the +50% sweep:**
   the owner's §42.3 enumeration (banner flower, step icons,
   privacy/use-case icons, sim avatars) omits it and it already renders at
   the 96px register; if the owner wants it at 144px it is a one-prop
   change.
3. **Record — the hero pair animates on LOAD** (§4.30.B decision): the
   owner's §42.1 offered load-animation for the first-viewport pair; the
   transient 16px rise settles into the exact §37 centered open state.
   Zero-animation on load (skip the hero reveal entirely) is a one-line
   utility change if the owner prefers.
4. **Record — the reveal timing values are this design's call** (§42.1
   delegates the treatment): threshold 0.15 / rootMargin −48px / 320ms /
   16px / 60ms stagger / stepped(4) fade + eased rise. All five are
   single-value tweaks.
5. **ADVICE NEEDED — none blocking:** no RU copy was invented (zero-delta
   round), no palette value added, no route touched; the five items are
   fully specified above.

### 4.31 v3.25 feature design (2026-11-23, owner-approved Concept §44): §44 wider lead + unified card borders + route param rename

The owner issued the three-item §44 batch (2026-11-23): (1) the lead block
("The right connections beside you") **wider on desktop**, and **below 960px
the hero becomes a single centered column** — the lead centered with the
BLEAK agent card stacked below it; (2) the **01/02/03 step-card borders
unified** — remove the thick white bottom border / bottom white block /
shadow from cards 01 and 03 and apply the exact same border width, radius
and subtle light border color across all three; (3) the **route param
rename** `income/<address>/create` → `income/<income_code>/create`
(aligning with the backend's income-code terminology; resolution behavior
unchanged). This section amends §4.30 (→ §4.28 → §4.27 → §4.26 → … → §4.20)
item by item; **where §4.31 is silent, the earlier specs stand** except
where §4.31.E explicitly supersedes them. The parallel §4.29 profile
redesign (task 131) is scope-disjoint — this rev touches ONLY the landing
(`/`) and the `/income/[income_code]/create` route; it does not touch or
reference the profile files. Grounded in the live code (read-only audit,
2026-11-23): `apps/web/src/routes/+page.svelte` (the hero `.stage`
constructions, the lead/agent grid, the three step cards — rendered by ONE
`{#each tutorialSteps}` loop with byte-identical class strings),
`src/routes/income/[room]/create/+page.svelte` (the param access),
`src/lib/components/join/JoinFlow.svelte` (the seeded-entry prop + the
create-route `resolve` call), `src/routes/{income,+layout}.svelte`
(comment references), `lib/styles/{tokens,base}.css` (the pixel-frame
ladder, the spacing scale),
`tests/{landing-page,join-flow,sweep}.test.ts` (the hero/thirds-grid,
step-card and route-resolution assertions). Hard constraints unchanged:
**no new dependencies**, **no copy changes** (i18n ZERO delta, §4.31.F),
**palette tokens unchanged** (the border unification reuses the existing
`--color-surface-elevated` token; no new color values), **resolution
behavior unchanged** (the rename is the route dir + references only — the
deep-link semantics are byte-identical), **/income surfaces untouched**
(the `/income` entry page's logic is not modified; only its stale comment
line is corrected), **the §37 open-state holds** (the first viewport
contains ONLY lead + BLEAK at every width — vertically centered, §4.31.A/B).
**API endpoints used: none** — the landing stays fetch-free (§4.20
preamble) and the create route's API behavior (invite resolution,
`POST /h/rooms` seeding via JoinFlow) is untouched by the rename; the round
is presentational + a route-dir rename. Task: tz12-14
(`feature/bbf8e50d-tz12-14-wider-lead-borders-param`).

#### 4.31.A The widened lead — the ≥960px two-column hero (item 1, desktop)

**Live-code finding (what "wider" widens):** today at ≥720px `.stage` is the
§4.24.D THIRDS grid — `grid-template-columns: repeat(3, 1fr)`,
`column-gap: var(--space-6)`, col 1 = the lead, col 2 = EMPTY, col 3 = the
agent card (§4.30.C `max-width: 240px` centered). The container at 1280 is
`.landing` = `max(80%, 280px)` = 1024px with `padding: 0 var(--space-7)
var(--space-7)` (48px sides) → **content 928px**; thirds with the 32px gap →
the lead column is ≈ **288px** at 1280 (the §4.24.C number). With the
§4.28.A headline capped at 48px, the lead's text column (288px − 2×28px
`.copy-body` padding = 232px) is cramped: the 40ch `.sub` (~355px at 18px)
wraps hard and the 48px Handjet headline lines are tight.

**Decision — the hero row becomes TWO asymmetric columns at ≥960px:** the
middle-empty third is retired; the lead takes the `1.2fr` share, the agent
track the `1fr` share:

```css
@media (min-width: 960px) {
  .stage {
    display: grid;
    grid-template-columns: 1.2fr 1fr;   /* WAS repeat(3, 1fr) + empty col 2 */
    column-gap: var(--space-6);          /* unchanged 32px */
    align-content: center;               /* unchanged (§4.25.A) */
    align-items: center;                 /* unchanged */
    /* min-height: 100dvh carries from the new base rule (§4.31.B) */
  }
  .area-lead   { grid-column: 1; }       /* WAS grid-column: 1 (unchanged) */
  .area-agents { grid-column: 2; }       /* WAS grid-column: 3 */
  /* §4.30.C carries verbatim, moved into the 960px media: */
  .agent-card  { max-width: 240px; margin-inline: auto; }
}
```

- **Resulting px:** at **1280** the lead track is
  (928 − 32) × 1.2/2.2 ≈ **489px** (the agent track ≈ 407px, the 240px card
  centered inside it — more symmetric air around the card, nothing paints
  wider than its track). At **960** (the breakpoint edge) the lead is
  (672 − 32) × 1.2/2.2 ≈ **348px**. The lead is wider than the retired
  288px third at EVERY ≥960 width (the `1.2fr` share grows faster than a
  third), never narrower.
- **Readability rationale (per the §4.28 font ladder):** the 489px track
  minus the 2×28px `.copy-body` padding leaves a ≈ 433px text column — the
  40ch/18px `.sub` (~355px) fits on its natural measure and the 48px
  headline lines get full-word room (`overflow-wrap: anywhere` stays as the
  emergency valve, not the norm). The agent card is width-capped at 240px,
  so giving the leftover width to the lead is the only reading of
  "wider" that adds readable measure rather than dead air.
- **Type ladder moves WITH the composition (hero-scoped):** the desktop
  headline clamp and the lead's left alignment belong to the side-by-side
  composition, so their media queries move 720 → 960:
  `.headline { font-size: clamp(28px, 4vw, 48px) }` now applies at ≥960
  (38.4px at 960 → capped 48px from 1200px up); below 960 the lead keeps
  the ≥480px ladder value 48px (40px base). `.copy-body`'s
  `align-items: flex-start; text-align: left` (and its 28px padding rule's
  ALIGNMENT half) applies at ≥960; below 960 the lead is centered
  (§4.31.B). The §4.28.B/C/D sizes are untouched.

#### 4.31.B The <960px centered hero stack (item 1, the new intermediate breakpoint)

Below 960px the hero is ONE CENTERED COLUMN — the lead centered, the BLEAK
card below it — superseding BOTH earlier hero constructions (the ≥720px
thirds grid for the 720–959 band, and the <719.98px `.area-lead` 100dvh
phone hero):

```css
/* base rule — <960px (and the fallback at every width the media does not
   cover): the centered hero stack */
.stage {
  display: flex;
  flex-direction: column;
  justify-content: center;   /* the pair centers vertically as a group */
  align-items: center;
  gap: var(--space-6);
  min-height: 100dvh;        /* the hero row = the first viewport */
  min-width: 0;
}
```

- **The <719.98px `.area-lead { min-height: 100dvh; … }` rule is DELETED** —
  the lead no longer owns a full viewport on phone; the `.stage` owns the
  100dvh at every width. The phone DOM order (lead → agents → stat → …)
  is unchanged — it IS the stack.
- **The §37 open-state holds at every width:** at the scroll origin the
  first viewport contains ONLY the lead + the BLEAK card (plus the fixed
  header chrome), vertically centered — at ≥960 side-by-side, at <960
  stacked. **"Both still in the initial viewport if they fit":** at <960
  the pair is centered as a group inside the `min-height: 100dvh` stage;
  when the combined height fits the viewport (e.g. 800×800: the lead ≈
  300px + the BLEAK card ≈ 380px + the 32px gap ≈ 712px < 800) BOTH are
  visible in the initial viewport; when it does not (short viewports) the
  stage grows and BLEAK scrolls into view — no clipping, no overflow.
- **Re-verified at 800px:** the vertically-centered behavior is the SAME
  mechanism as before (the 100dvh hero row min-height + centering), now on
  `.stage` at <960 instead of on `.area-lead` at <720 — at 800×800 the
  centered pair sits in the first screen with the banner below the fold.
- **Other blocks' 720px rules STAND:** the banner stacking (§4.30.F), the
  steps grid (≥720 thirds), the sim grid, privacy/use-case grids, the join
  row, the header nav (`.top-nav` ≥720) and the §4.28.F container widths
  (`.landing`/`.top` max(90%, 280px) phone / max(80%, 280px) ≥720) keep
  their 720px breakpoints UNCHANGED — only the HERO's breakpoint moves to
  960.

#### 4.31.C The three step cards' borders unified (item 2)

**Live-code finding (the divergence, and where it really lives):** the three
step cards are rendered by one `{#each tutorialSteps}` loop — their class
strings are byte-identical (`step-block pixel-corners pixel-frame
pixel-frame--strong` + `step-body pixel-corners`) and NO per-card CSS
exists (no `:nth-child`, no `border-bottom`, no per-card shadow anywhere in
`+page.svelte`/`base.css`). The owner's "thick white bottom border /
bottom white block / shadow on cards 01 and 03" is produced by a LAYOUT
leak, not a class difference: on desktop `.steps` is the
`repeat(3, 1fr)` grid whose items stretch to the tallest sibling's height,
but `.step-body` (`min-height: 300px` + content, `height: auto`) does NOT
stretch — on the shorter cards the outer `.pixel-frame--strong` layer's
background (`--color-text`, #f0f0f0 — near-WHITE) is exposed as a solid
white block BELOW the dark body (and reads as a thick white bottom edge).
Card 02 (CHAT) is the tallest card in the RU render, so only 01 and 03
show the block — exactly the owner's observation.

**Fix — two declarations, all three cards:**

1. **The body fills its card:** `.step-body` gains `height: 100%` — the
   dark body consumes the stretched `li`'s full content box, so the frame
   ring is a uniform 2px on all four sides on EVERY card and no frame fill
   can ever show below the body. (On phone the `.steps` are an
   auto-height flex column: a percentage height against an auto-height
   parent resolves to auto — the declaration is inert there, no regression.)
2. **The frame color drops to the SUBTLE light border:** all three step
   `li`s drop `pixel-frame--strong` → plain `pixel-frame` — the frame
   background is `var(--color-surface-elevated)` (#292c2d, the §4.5
   default frame color — the "subtle light border color") instead of the
   bright `--color-text` white ring. The bright-white reading (including
   the thicker-looking ring at the stepped corners) disappears entirely.

**The unified border values (stated from the live construction):**
border **width = 2px** (the `.pixel-frame` padding ring — the pixel-frame
construction has no CSS `border` property; unchanged), border **radius =
none** — square/stepped, the shared 8px `.pixel-corners` ladder; NO
`border-radius` (the "stays square" test assertion carries), border
**color = `var(--color-surface-elevated)`**. All three cards carry these
byte-identically ("completely consistent outlines").

- **Scope — the step cards ONLY:** the BLEAK agent card and the banner
  card KEEP `pixel-frame--strong` (their §4.20.G/§4.30.C/§4.30.E contracts
  stand; §4.30.E's shared-token claim was about the body FILL
  `var(--color-surface)`, which is unchanged here). The glass surfaces
  (header/banner/footer/four sections) are untouched.
- Everything else on the step cards carries verbatim: the hover glow +
  4px lift (reduced-motion guarded), the 72px art, the micro-pills, the
  numerals/titles/descs, `min-height: 300px` (≥720px), the
  `var(--color-surface)` body fill.

#### 4.31.D The route param rename `[room]` → `[income_code]` (item 3)

The creation route directory
`apps/web/src/routes/income/[room]/create/` is renamed to
`apps/web/src/routes/income/[income_code]/create/` and every reference to
the param on THAT route follows. **Resolution behavior is byte-identical:**
seeded = a non-empty `income_code` param + a valid `?code=` query → the
wizard opens seeded; anything else → `goto(resolve('/income'),
{ replaceState: true })`. The rename touches names only.

**The complete rename surface (grep-audited, 2026-11-23):**

1. `src/routes/income/[room]/create/+page.svelte` → the dir becomes
   `[income_code]/`; `const roomParam = $derived(page.params.room ?? null)`
   → `page.params.income_code` (the local + the JoinFlow prop rename
   together — see 2); the header comment's route paths.
2. `src/lib/components/join/JoinFlow.svelte`:
   - the navigation —
     `goto(\`${resolve('/income/[room]/create', { room: room.address })}?code=${flow.code}\`)`
     → `resolve('/income/[income_code]/create', { income_code:
     room.address })` (the VALUE carried is still the room address — only
     the param NAME changes);
   - the seeded-entry prop `roomParam` → `incomeCodeParam` (the Props
     type, the `$props()` destructure, the `seeded` derivation and the
     `address: roomParam ?? ''` seed all follow; the JSDoc blocks at
     lines ~6/41/43/86/99/225 update to the new route path + prop name).
3. Comment-only corrections (prose, no behavior):
   `src/routes/income/+page.svelte` line ~21 ("The creation wizard itself
   lives under /income/[room]/create") and `src/routes/+layout.svelte`
   line ~44 (the layout's isJoin route comment).
4. Tests:
   - `tests/landing-page.test.ts` — the `$app/paths` `resolve` mock
     (`params?: { room?: string }` / `route.replace('[room]',
     params.room)` → `income_code`), the `CreatePage` import path, and the
     `/income/[room]/create` describe block (both tests:
     `mockPage.params = { room: '0xroom123' }` → `{ income_code:
     '0xroom123' }`, the mock URLs, the describe title; the two assertions
     — seeded wizard opens / no code → `/income` replaceState — are
     semantically unchanged).
   - `tests/join-flow.test.ts` — its resolve mock (same shape as the
     landing mock) and the goto-string assertion
     `'/income/[room]/create?code=…'` → the `income_code` spelling; the
     comment-only `[room]` mentions follow.
   - `tests/sweep.test.ts` — the route path string
     `'src/routes/income/[room]/create/+page.svelte'` in the poller sweep
     → the new path.
- **SvelteKit typed helpers:** none exist in-repo (no `.d.ts`/hand-written
  route types reference the param; `.svelte-kit` types are generated) —
  the rename is the dir + the references above.
- **Out of scope (verified untouched):** the `/room` radar route and
  `lib/room/*` (a different "room" concept), the `/income` entry page's
  LOGIC (its `goto(resolve('/room'))` and the `join.resume.title`
  i18n interpolation `{ room: … }` are the room NAME/address domain, not
  this route param), `chats/[address]`, the API payloads' `room:` keys
  (`host-console`, `api-contexts`, `lib/api/*` — request-body fields, not
  route params), and all other suites.

#### 4.31.E Supersessions (explicit record)

1. **§4.24.D/§4.25.A/§4.30.C hero grid SUPERSEDED where changed (item 1):**
   the thirds grid (`repeat(3, 1fr)`, col 2 EMPTY, agent col 3) retires for
   the hero at ≥960 → the 2-col `1.2fr 1fr` grid (lead col 1, agent col 2);
   the ≥720px hero media becomes ≥960px; the §4.30.C 240px agent cap
   carries verbatim inside the new media; the lead is ≈ 489px at 1280 (the
   §4.24.C "fills its thirds column, ≈ 288px at 1280" superseded — the
   `.copy { width: 100% }` rule stands, now filling the 1.2fr track).
2. **The <719.98px `.area-lead` 100dvh phone hero SUPERSEDED (item 1):**
   the <960px hero is the centered `.stage` stack (lead + BLEAK, both in
   the first viewport when they fit); §4.25.A's "PHONE: .area-lead is the
   100dvh hero region" is retired. The §4.25.A/§37 open-state RULE (only
   lead + BLEAK in the first viewport, vertically centered) CARRIES at
   every width.
3. **§4.28.A hero-scoped media moves (item 1):** the `.headline` clamp and
   the `.copy-body` left-alignment media move 720 → 960; every other
   §4.28 value (including the ≥480px 48px step, the descriptions,
   captions, pills and the §4.28.F container widths) is byte-unchanged.
4. **§4.26.C/§4.30.E step-card frame SUPERSEDED (item 2):** the "KEEP the
   pixel frame … `pixel-frame--strong`" clause (§4.26.C) and §4.30.E's
   "outer strong ring" retire FOR THE STEP CARDS ONLY — the three li's
   carry plain `pixel-frame` (subtle `--color-surface-elevated` ring) +
   `.step-body { height: 100% }`; the §4.30.E shared-token body fill
   (`var(--color-surface)`) and everything else carry. The "cards 01/03 vs
   02 differ" premise is recorded as a layout leak (§4.31.C), not a class
   divergence.
5. **Superseded-but-carried (unchanged into §4.31):** the §4.30.A/B
   reveal system (the hero pair's LOAD reveal works identically over the
   new stack/grid — the `[data-reveal-load]` markers and the utility are
   untouched), §4.30.D icon sizes, §4.30.F banner stacking, §4.26.A
   header, §4.23.A/§4.27.1 video layer, §4.25.B transparent lead, the
   §4.20.L behavior + deep-link forwarding, §4.22.A keep-list, the
   §4.23.G/§4.28.I reduced-motion + fallbacks, and the §31–§33 route/entry
   contracts (Start/TALK → `/income`, the 6-digit input — §44's
   "All other §31–§33 contracts stay in force").

#### 4.31.F i18n: ZERO delta

No key is added, removed or edited — both dictionaries stay **byte-identical
at 55 `landing.*` keys per dictionary** (§4.27.G/§4.30.H carry); the route
rename touches no user-visible string (route params are never rendered).
The RU/EN switch re-renders without a reload; `i18n.test.ts` and the
`LANDING_KEYS`/parity/dead-key assertions are UNTOUCHED and stay green
(55/55).

#### 4.31.G Reduced motion + media states

- **Nothing new:** the batch adds no animation, no transition and no new
  motion-sensitive element — the widened lead, the 960px stack and the
  border unification are static geometry/color; the existing guards
  (§4.26.M/§4.27.H/§4.28.I/§4.30.I) stand verbatim. The base.css catch-all
  needs no change.
- **Media states:** the landing still fetches nothing and the create route's
  states are unchanged (the rename is not behavioral) — no loading/empty/
  error deltas. No layout shift beyond the intended breakpoint changes; no
  horizontal scroll at 320/800/960/1280 (the `1.2fr` tracks are
  fr-proportional; the centered stack is width: 100%-based).

#### 4.31.H Acceptance criteria (checkable)

**Lead width + the 960px hero (item 1):**
1. At ≥960px `.stage` declares `grid-template-columns: 1.2fr 1fr` with
   `column-gap: var(--space-6)`, `min-height: 100dvh`,
   `align-content: center`, `align-items: center`; `.area-lead` is
   grid-column 1 and `.area-agents` grid-column 2; NO empty middle column
   exists (the old `grid-column: 3` rule and the `repeat(3, 1fr)` hero
   grid are gone from the hero rules; the §4.30.C `max-width: 240px` +
   `margin-inline: auto` agent cap applies at ≥960).
2. At 1280 the lead track computes ≈ 489px (container 1024 − 2×48 padding
   = 928; (928 − 32) × 1.2/2.2) — wider than the retired ≈ 288px third;
   at 960 it computes ≈ 348px; the lead is never narrower than a retired
   third at any ≥960 width.
3. `.headline`'s `clamp(28px, 4vw, 48px)` applies at ≥960 (38.4px at 960,
   48px from 1200px up) and NOT between 720–959 (those widths keep the
   ≥480px 48px value); `.copy-body` is centered below 960 and
   left-aligned at ≥960.

**The <960px centered stack (item 1):**
4. Below 960px the hero is ONE centered column: `.stage` is a flex column
   with `justify-content: center`, `align-items: center`,
   `gap: var(--space-6)`, `min-height: 100dvh`; the BLEAK card renders
   BELOW the lead in DOM order; the old `@media (max-width: 719.98px)`
   `.area-lead { min-height: 100dvh … }` rule does not exist (negative).
5. At an 800×800 viewport the initial viewport shows the centered lead
   with BLEAK below it (both fit); at 800×600 (short) BLEAK may scroll —
   no clipping, no horizontal scroll; at exactly 960 and above the
   side-by-side grid applies (the `min-width: 960` boundary is exact).
6. The §37 open-state holds at 800/960/1280: the first viewport contains
   ONLY the lead + BLEAK (plus the fixed header) — the banner, steps, sim,
   privacy, use-cases, join and footer flow after the hero region; the
   vertically-centered mechanism (the 100dvh hero row min-height +
   centering) is verified at 800px.

**Step-card borders unified (item 2):**
7. All three `.step-block` `li` class lists are byte-identical and contain
   `pixel-corners pixel-frame` WITHOUT `pixel-frame--strong` (negative on
   `--strong` for every step card); `.step-body` declares
   `height: 100%` (the stretch leak is fixed — no frame fill can show
   below any body) and still sets NO `border-radius`.
8. The unified border values across all three cards: width = the 2px
   `.pixel-frame` padding ring, radius = none (the stepped
   `.pixel-corners` ladder), color = `var(--color-surface-elevated)` —
   asserted as the `.pixel-frame` rule's background in `base.css`
   (unchanged file) with the `--strong` upgrade absent from the step
   markup; the BLEAK agent card and the banner card STILL carry
   `pixel-frame--strong` (negative: those two cards' class lists
   unchanged); the `.step-body` fill stays `var(--color-surface)` and the
   hover/lift/art/pill contracts are unchanged.

**Route param rename (item 3):**
9. The route directory is `src/routes/income/[income_code]/create/` (the
   `[room]` dir is gone); the create page reads `page.params.income_code`;
   JoinFlow navigates via
   `resolve('/income/[income_code]/create', { income_code: … })`; the
   prop feeding JoinFlow is renamed (`incomeCodeParam`) with the seed
   logic unchanged.
10. Resolution behavior is unchanged: with
    `mockPage.params = { income_code: '0xroom123' }` + a valid `?code=`
    the route renders the seeded wizard (the intro → name step flow);
    without a valid code it redirects to `/income` with
    `{ replaceState: true }` — the two existing route-resolution tests
    pass with the renamed param.
11. Grep-audit: no stale `[room]`-param reference remains on the rename
    surface (`routes/income/[room]/**` gone; `JoinFlow.svelte`,
    `income/+page.svelte` + `+layout.svelte` comment lines,
    `landing-page.test.ts`, `join-flow.test.ts`, `sweep.test.ts` all
    updated); the out-of-scope `room` usages (`/room` route,
    `lib/room/*`, API `room:` payload keys, the resume-title i18n
    interpolation) are byte-untouched (negative).

**i18n + suites (carry):**
12. i18n: exactly **55** `landing.*` keys in BOTH dictionaries,
    byte-unchanged (RU/EN parity 55/55); `i18n.test.ts` passes UNAMENDED.
13. Suites amended and green: `landing-page.test.ts` — the thirds-grid /
    phone-hero / lead-narrower assertions (§4.24.C/§4.25.A/§4.30.C form)
    rewritten to ACs 1–6 (including the retired
    `expect(css).not.toMatch(/grid-column:\s*2/)` negative — the agent is
    now legitimately grid-column 2), the step-card `pixel-frame--strong`
    assertions rewritten to ACs 7–8, the route tests per ACs 9–10;
    `join-flow.test.ts` + `sweep.test.ts` route strings per AC 11; ALL
    other suites untouched green; `make lint && make test && make build`
    green.
14. Constraints: no new dependencies; no copy changes (55/55
    byte-identical); palette tokens unchanged (no new values anywhere —
    the unified frame color is the existing `--color-surface-elevated`);
    `/income` surfaces untouched (comment correction only); the §37
    open-state holds; the video layer + attribute set untouched; the
    profile redesign files (task 131) untouched; API endpoints used:
    none.

#### 4.31.I Flags for the owner / concept (concept report)

1. **Record — the border-color decision:** §44 names card 02 as the
   reference, but the live code has all three step cards byte-identical —
   the visible 01/03 divergence is the grid-stretch leak (§4.31.C), and
   card 02's live frame color is the bright `--color-text` white. §44's
   target wording "subtle light border color" was honored by unifying all
   three on `--color-surface-elevated` (the §4.5 default frame color) —
   which also retires the bright-white ring from card 02. If the owner's
   intent was width/radius-only (keep the white ring, just kill the
   bottom block), the revert is one class: `pixel-frame--strong` back on
   the three step `li`s (`height: 100%` stays).
2. **Record — the headline clamp breakpoint moved 720 → 960** (hero-
   scoped, §4.31.A): at the 960 boundary the headline steps 48px → 38.4px,
   mirroring the retired 720px step (48 → 28.8px). A single-value tweak
   (e.g. clamping from a higher floor) if the smoke dislikes the step.
3. **Record — the phone hero behavior changes by design (§44.1 applies
   below 960 wholesale):** the lead no longer owns a full 100dvh screen on
   phone; BLEAK shares the first viewport whenever it fits. §4.25.A's
   phone geometry is superseded for the hero (§4.31.E.2); the open-state
   RULE carries.
4. **ADVICE NEEDED — none blocking:** no copy invented (zero-delta round),
   no palette value added, resolution behavior unchanged; the three items
   are fully specified above.

### 4.31.1 owner amendment (2026-11-23, Concept §44.4 record): mobile keyboard viewport fix

**Mobile keyboard viewport (creation flow, esp. Safari/iOS):** on
`/income/[income_code]/create` the page is NOT pushed upward off-screen
when the on-screen keyboard opens — the creation wrapper's height binds
to the remaining VISIBLE viewport, keeping BOTH fixed areas (the top
messages area and the bottom input block) visible at the same time
(the §24–§30 contracts' "visible viewport" binding becomes the dynamic
visualViewport height; the two-fixed-areas, main-block-never-scrolls and
messenger-only-scroll rules all hold unchanged). The mechanism is
CREATION-SCOPED — the persona step IS the creation wizard, so the
behavior runs only while the creation chat is mounted; /chats never
mounts JoinFlow and is behavior-neutral (negative-tested). (1) §44.4.1 —
the wrapper/shell height gates in JoinFlow keep the fallback-then-dvh
pair (`height: 100vh; height: 100dvh;`) and consume the dynamic height
as a THIRD, later-supported declaration:
`height: var(--app-height, 100dvh)` — the geometry is otherwise
unchanged (unset variable → the dvh fallback stands). (2) §44.4.2 — a
`window.visualViewport` RESIZE listener, wired inside the creation
wrapper's mount effect (SSR-safe: no window access at module init),
writes every `visualViewport.height` change (keyboard opens/closes)
into the `--app-height` custom property on the document root, and the
DOCUMENT scroll is locked (body overflow hidden) while the creation
flow runs so the browser can never scroll the page upward; the
listener, the lock and the variable are fully restored on teardown (no
leaks). The §30 forms on the creation path (enter/room-intro/intro)
share the same dynamic height — their §30 contracts stay green. RU/EN:
zero delta (no copy changes).

#### 4.31.2 iOS correction (2026-11-23, bug round, owner-reported)

The §4.31.1 fix did not work on iOS Safari (iPhone/iPad): the keyboard
did NOT shrink the screen — the whole page panned up (sometimes stayed
panned after the keyboard closed). Deterministic root cause:
`routes/+layout.svelte` declares `.app-shell { min-height: 100dvh }`,
and the two §44.4.2 shell gates set `height: var(--app-height, 100dvh)`
but never overrode the min-height — CSS computes height =
max(min-height, height), and iOS does NOT resize the layout viewport on
keyboard (unlike Chrome/Android), so `100dvh` stayed full-height while
the listener correctly wrote a shrunk `--app-height`; the min-height
pin kept the shell un-shrunk, the composer stayed behind the keyboard
and iOS panned the document up. The fix (bug round task 136,
`feature/5de72e33-ios-keyboard-viewport`): (1) `min-height: 0` on BOTH
`.app-shell` gates (the persona-step and form-step shell gates — the
wrapper gates already carried it); (2) in the same persona-step effect
the documentElement overflow is locked TOO (the body-only lock does not
stop iOS keyboard panning) and the window is pinned during the pan — a
`visualViewport` SCROLL listener calls `window.scrollTo(0, 0)`; both
are restored on teardown (the same no-leaks contract as the resize
listener — remove/add pairs asserted). Everything else of §4.31.1 is
untouched: the `--app-height` write/restore, the
`100vh → 100dvh → var(--app-height, 100dvh)` fallback chain, the
§24–§29 two-fixed-areas layout, every other join step/surface
(behavior-neutral outside the persona step; negatives stay green).
Suites: `tests/keyboard-viewport.test.ts` updated (min-height on both
gates; the documentElement lock added/restored; the scroll-pin listener
added/restored; the dvh + var assertions unchanged). Owner verifies
manually on iOS Safari (iPhone + iPad). RU/EN: zero delta.

### 4.32 v3.26 feature design (2026-11-23, owner-approved Concept §45): §45 hero breakpoint/width/headline + Bleak margins

The owner issued the three-item §45 follow-up batch (2026-11-23):
(1) **below 960px the landing shows ONLY "The right connections beside
you" centered on the screen — the Bleak block sits BELOW THE FOLD**,
reached by scrolling (supersedes the §44.1/§4.31.B <960px stack that
showed both in the first viewport); (2) **the Bleak block is wider on
computer** — its margin from the right side of the screen EQUALS the left
margin of the lead block (symmetric edges — the card stretches toward the
content container's right edge instead of a small centered card,
superseding the §4.30.C 240px cap as carried into §4.31.A); (3) **the
headline is bigger for computer view** (design's value; keep the
open-state fit). All other §31–§33 contracts stay in force (routes,
Start → `/income` with the 6-digit input, RU/EN parity, reminder-box
retirement, three step blocks, existing suites green). This section
amends §4.31 (→ §4.30 → §4.28 → §4.27 → §4.26 → … → §4.20) item by item;
**where §4.32 is silent, the earlier specs stand** except where §4.32.D
explicitly supersedes them. Grounded in the live code (read-only audit,
2026-11-23): `apps/web/src/routes/+page.svelte` (the §4.31 hero — base
`.stage` flex stack with `min-height: 100dvh` + `justify-content:
center`, the ≥960 `1.2fr 1fr` grid, `.agent-card { max-width: 240px;
margin-inline: auto }` inside the ≥960 media, `.headline` clamp(28px,
4vw, 48px) inside the ≥960 media, the `max(80%, 280px)` container with
`padding: 0 var(--space-7)` at ≥720, and the reveal wiring —
`data-reveal-load` on BOTH `.area-lead` and `.area-agents`),
`src/lib/styles/tokens.css` (the spacing/palette tokens — untouched),
`tests/landing-page.test.ts` (the §4.31 hero/stack/clamp/reveal
assertions — amended per §4.32.G). Hard constraints unchanged: **no new
dependencies**, **no copy changes** (i18n ZERO delta, §4.32.E),
**palette tokens unchanged** (geometry/typography only — no new color
values anywhere), **routes untouched** (no route dir, param or resolution
change — §4.31.D's rename stands as delivered), **/income untouched
INCLUDING the §44.4 keyboard-viewport mechanism** (JoinFlow's
`--app-height` / `visualViewport` wiring and the document-scroll lock are
not modified — this round touches the landing page's hero CSS + reveal
markers only), **the scroll-reveal system itself is unchanged**
(`landing/reveal.ts`, the base.css armed state, the one-shot observer,
thresholds, stagger and reduced-motion guards all carry verbatim — only
ONE element's unit class changes, §4.32.A). **API endpoints used: none**
— the landing stays fetch-free (§4.20 preamble). Task: tz12-15
(`feature/1c622991-tz12-15-hero-breakpoint-bleak`).

#### 4.32.A The <960px open state — the lead ALONE owns the first viewport (item 1)

**Live-code finding:** §4.31.B made the <960px hero ONE centered stack —
the base `.stage` rule (`display: flex; flex-direction: column;
justify-content: center; align-items: center; gap: var(--space-6);
min-height: 100dvh`) puts the lead AND the BLEAK card in the first
viewport together whenever they fit (e.g. both visible at 800×800). The
owner now corrects this: **below 960px the first screen shows ONLY the
lead block, centered; the BLEAK card sits below the fold** — next in the
scroll flow. The §37 open-state RULE ("first viewport = lead + Bleak,
vertically centered") now applies **at ≥960px ONLY**.

**Construction — the lead's own region owns the 100dvh; the DOM does NOT
move (decision, recorded).** The agent card stays INSIDE `.stage` in the
markup (`.stage > .area-lead + .area-agents`, byte-unchanged markup) —
moving it out of `.stage` would make it unreachable by the ≥960px
two-column hero grid (§4.31.A) and break the ≥960 open-state. Instead the
<960px geometry is re-cut in CSS only: `.stage` stops being the 100dvh
centered region, and `.area-lead` becomes the 100dvh hero region holding
the lead ALONE — the card flows AFTER that region in the normal scroll
flow (inside `.stage`, before the banner — the visual scroll order at
<960 is: lead-100dvh region → BLEAK card → banner), exactly the owner's
"behind the screen — below the fold, reached by scrolling":

```css
/* BASE = <960px: the lead is the 100dvh hero region — centered ALONE;
 * the BLEAK card follows in the normal scroll flow (below the fold). */
.stage {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-6);   /* the 32px between the lead region and the card */
  min-width: 0;
  /* min-height + justify-content REMOVED from the base rule —
     the stage is no longer the first-viewport region at <960 */
}
@media (max-width: 959.98px) {
  /* §4.25.A's phone-hero geometry RESTORED and extended to the whole
   * <960 band — but now as a deliberate §45.1 rule: the lead centered
   * ALONE (the card is out of this region, in the scroll flow after it) */
  .area-lead {
    min-height: 100dvh;        /* the lead region = the first viewport */
    display: flex;
    flex-direction: column;
    justify-content: center;   /* the lead centers vertically, alone */
  }
}
@media (min-width: 960px) {
  .stage {
    display: grid;
    grid-template-columns: 1.2fr 1fr;   /* §4.31.A carries verbatim */
    column-gap: var(--space-6);
    min-height: 100dvh;        /* MOVED here from the base rule */
    align-content: center;
    align-items: center;
  }
  /* .area-lead grid-column 1 / .area-agents grid-column 2 — unchanged */
}
```

- **Why the offset is guaranteed:** at <960 the lead region is
  `min-height: 100dvh` and it is `.stage`'s FIRST child; the card follows
  after the stage's `var(--space-6)` gap → the `.agent-card`'s top edge at
  the scroll origin is ≥ `100dvh + 32px` > any viewport height → **the
  card is strictly below the fold at EVERY <960 width and every viewport
  height** (when the viewport is shorter than the lead's content the
  region grows — min-height — and the card is further down still; no
  clipping either way, the flex container grows with its content).
- **The negative (supersedes §4.31.B in the first viewport):** at <960
  the first viewport contains ONLY the lead (plus the fixed glass header
  chrome, §4.26.A) — the BLEAK card, the banner, the steps and everything
  else are below the fold. The §4.31.B "both visible at 800×800" reading
  is retired; §4.31.H's ACs 4–6 are superseded by §4.32.G's ACs 1–3.
- **The §37 open-state rule re-scoped:** "the first viewport contains
  ONLY lead + BLEAK, vertically centered" holds at **≥960px only**
  (side-by-side, §4.31.A construction byte-unchanged); at <960 the rule's
  first-viewport set is the lead ALONE. The ≥960 construction (the
  `1.2fr 1fr` grid, the 100dvh min-height — now declared inside the ≥960
  media — and both centerings) carries verbatim from §4.31.A.
- **The scroll-reveal interaction (the card becomes a scroll unit):**
  `.area-agents` drops `data-reveal-load` → carries the bare
  `[data-reveal]` marker (the 13th scroll unit; the lead alone keeps
  `data-reveal-load`). The §4.30.A utility arms it at mount like every
  scroll unit and reveals it on its FIRST viewport intersection
  (threshold 0.15, rootMargin −48px, one-shot, cleanup — all verbatim).
  At **<960** that intersection happens only when the user scrolls the
  card into view — the owner's "reached by scrolling" is animated by the
  established fade+rise. At **≥960** the card sits in the first viewport,
  so its observer fires on the first observation callback at the scroll
  origin — the net on-open appearance is the same fade+rise one tick
  after load as the retired load-reveal produced (record; the utility
  needs NO change — the geometry decides when the reveal fires).
- **Unchanged:** the card's content contract (§4.20.G-b), the `#agents`
  id (no nav link) + its `scroll-margin-top: 100px`, TALK → `/income`,
  the hover/press treatments, and the load-reveal + cleanup of the lead.

#### 4.32.B The Bleak card wide on desktop — the symmetric edges rule (item 2)

**Live-code finding:** at ≥960 the card is capped at `max-width: 240px;
margin-inline: auto` (§4.30.C as carried into §4.31.A's ≥960 media) — a
small centered card inside a ≈ 407px track at 1280, its right edge
≈ 550px from the viewport's right edge, while the lead's left edge sits
only `10% + 48px` from the viewport's left. The owner wants the card to
stretch toward the content container's right edge so **the card's right
margin from the screen edge EQUALS the lead's left margin**.

**The exact measurement rule (decided — tests assert THIS):** the content
container `.landing` at ≥720px is `width: max(80%, 280px);
margin-inline: auto; padding: 0 var(--space-7) var(--space-7)` — at ≥960
always the 80% (280px floor inert), centered → its box spans
[10%, 90%] of the viewport, and its 48px inline padding sits INSIDE the
80% symmetrically on both sides. The lead fills grid column 1 from the
container's CONTENT-box left edge; the card, filling column 2, ends at
the container's CONTENT-box right edge. Therefore:

> **Both margins measure `calc(10% + 48px)` at every ≥960px width** —
> the container's centered 10% gutter PLUS the container's own 48px
> inline padding, which is included in BOTH margins (the padding is
> symmetric, so including it on both sides PRESERVES the symmetry).

The card stretches to the container's content-box right edge — the
padding is NOT pierced (extending the card into the padding would make
the card's right margin bare 10% while the lead's left margin stays
10% + 48px, BREAKING the symmetry). The asserted rule: **`viewport right
edge − card right edge == lead left edge − viewport left edge`**, each
equal to `10% of the viewport + 48px` at ≥960. The construction that
produces it (and what the string-level suite asserts):

- the ≥960 media declares NO `.agent-card` max-width and NO
  `margin-inline: auto` (the §4.30.C cap is DELETED — negative);
- `.agent-card { width: 100% }` (the existing shared
  `.agent-card, .stat-card` rule) fills its `1fr` track edge-to-edge,
  exactly as `.copy { width: 100% }` fills the `1.2fr` track;
- `.landing` keeps `width: max(80%, 280px); margin-inline: auto;
  padding: 0 var(--space-7) var(--space-7)` byte-unchanged (the symmetric
  gutter + padding is what makes the two margins equal by construction).

**Resulting px:** at **1280** the card is ≈ **407px** wide
(content 928 − 32 gap = 896; × 1/2.2), its right edge 128px
(10% of 1280 = 128... precisely `calc(10% + 48px)` = 176px) from the
viewport's right edge — mirroring the lead's 176px left margin (was:
240px card centered → ≈ 550px right margin). At **960** the card is
≈ **288px**; at **1920** ≈ **640px** (content 1440 − 32 = 1408; × 1/2.2).
The wide card is the owner's explicit symmetric request; readability
holds at every width because `.agent-body` centers its content
(`align-items: center; text-align: center`) — the 17px quote wraps LESS
as the card widens (1 line from ≈ 1100px up), and nothing paints outside
its track (no horizontal-scroll risk; the cap's removal only WIDENS
inside the grid).

#### 4.32.C The desktop headline bigger — clamp(32px, 4.5vw, 64px) (item 3)

The ≥960px `.headline` clamp is raised from §4.28.A's
`clamp(28px, 4vw, 48px)` (as moved to ≥960 by §4.31.A) to
**`clamp(32px, 4.5vw, 64px)`** — declared in the SAME ≥960 media,
replacing the old declaration (the <960 ladder is UNTOUCHED: 40px base,
48px at ≥480px):

```css
@media (min-width: 960px) {
  .headline {
    font-size: clamp(32px, 4.5vw, 64px); /* WAS clamp(28px, 4vw, 48px) */
  }
}
```

- **Resulting px:** 43.2px at 960 → 57.6px at 1280 → capped **64px from
  ≈1422px up** (64 / 0.045). The 32px floor is inert on ≥960 (4.5vw ≥
  43.2px there) — a defensive minimum, same pattern as §4.28.A.
- **The §4.28 ladder hierarchy holds:** the lead stays the dominant
  title at every ≥960 width — 43.2px at 960 vs the 28px `.agent-name`
  (was 38.4 vs 28); the accent word + agent-name stay subordinate with a
  WIDER margin than before. The rest of the §4.28.A–D table is
  byte-unchanged.
- **Line-fit math (no mid-word breaks; the Handjet measure ≈ 0.45em/char
  per the §4.28 audit, checked to 0.55em for safety):** the lead's text
  column is track − 2×28px `.copy-body` padding. At **960**: column
  ≈ 292px; longest line EN "CONNECTIONS" (11ch) ≈ 214–262px ✓. At
  **1280**: column ≈ 433px; "CONNECTIONS" ≈ 285–349px ✓ (RU
  "ЗНАКОМСТВА", 10ch, narrower). At **1920**: column ≈ 711px; at the
  64px cap "CONNECTIONS" ≈ 317–387px ✓. `overflow-wrap: anywhere` stays
  as the emergency valve, not the norm.
- **Open-state fit re-verification (lead + Bleak BOTH in the first
  viewport at ≥960, vertically centered) — the math at the three
  widths:** lead `.copy-body` height = padding 2×28 (56) + headline
  3 × 1.05 × fs + gaps 2×16 (32) + `.sub` 18px budget 2 lines (54) + CTA
  min-height 48. Card `.agent-body` height = padding 40 + portrait 96 +
  5 gaps × 12 (60) + name ≈ 34 + badge 24 + traits ≈ 16 + quote
  17px × 1–2 lines (26–52) + TALK 48.
  - **960** (fs 43.2): lead ≈ 326px; card (interior ≈ 248px, quote
    2 lines) ≈ 370px → row max ≈ **370px** — fits any realistic desktop
    viewport height (≥ 480px); typical 960-wide windows are 600px+.
  - **1280** (fs 57.6): lead ≈ 371px; card (interior ≈ 367px, quote
    1–2 lines) ≈ 344–370px → row max ≈ **371px** ✓.
  - **1920** (fs 64 cap): lead ≈ 392px; card (interior ≈ 600px, quote
    1 line) ≈ 344px → row max ≈ **392px** ✓.
  - vs the OLD sizes (48px cap): the lead grows ≈ +30px at 1280 — the
    first-viewport fit is unchanged in kind, with large vertical air.
- **DECISION — the hero row keeps `min-height: 100dvh` (grow allowed),
  it does NOT lock exactly:** a fixed `height: 100dvh` would CLIP the
  centered pair on short viewports (the §4.31.B clipping concern
  carries); `min-height` lets the stage grow and scroll when the combined
  height exceeds the viewport — the established §4.25/§4.31 mechanism,
  now declared inside the ≥960 media (§4.32.A construction). At <960 the
  lead-alone region uses the same min-height semantics (grow allowed).

#### 4.32.D Supersessions (explicit record)

1. **§4.31.B (<960 centered stack) SUPERSEDED (item 1):** the <960 hero
   is no longer a two-block centered stack in the first viewport — the
   lead ALONE owns it (the `.area-lead` 100dvh region, §4.32.A); the BLEAK
   card is below the fold in the scroll flow. The base `.stage` rule
   loses `min-height: 100dvh` + `justify-content: center`.
2. **§4.31.E.2's open-state scoping AMENDED (item 1):** the §37 open-state
   RULE ("first viewport = lead + BLEAK") applies **≥960px only**; the
   §4.25.A phone-hero geometry (the lead's own 100dvh region) is
   RESTORED for <960 — but as §45.1's lead-ALONE rule (the §44.1 stack it
   was superseded by is itself superseded).
3. **§4.30.C (as carried into §4.31.A's ≥960 media) SUPERSEDED (item 2):**
   the `max-width: 240px; margin-inline: auto` agent-card cap is DELETED
   at ≥960 — the card fills its `1fr` track (symmetric
   `calc(10% + 48px)` edges, §4.32.B). The 240px value survives nowhere
   in the hero.
4. **§4.28.A's desktop headline clamp SUPERSEDED (item 3):**
   `clamp(28px, 4vw, 48px)` → `clamp(32px, 4.5vw, 64px)` at ≥960 (the
   §4.31.A media move 720 → 960 stands; the <960 ladder values stand).
5. **§4.30.B's hero-pair enumeration PARTIALLY SUPERSEDED (item 1):** the
   load-reveal pair becomes the lead ALONE; `.area-agents` joins the
   scroll-reveal units as their FIRST member in DOM order (before
   `.area-stat`) — the reveal system's mechanics are untouched.
6. **Superseded-but-carried (unchanged into §4.32):** the §4.31.A ≥960
   grid construction, §4.30.A's utility/base.css armed-state mechanics,
   §4.30.D icon sizes, §4.30.F banner stacking, §4.31.C unified
   step-card borders, §4.26.A header, §4.23.A/§4.27.1 video layer,
   §4.25.B transparent lead, §4.20.L behavior + deep-link forwarding,
   §4.31.D's `[income_code]` rename as delivered, and all §31–§33
   route/entry contracts.

#### 4.32.E i18n: ZERO delta

No key is added, removed or edited — both dictionaries stay
**byte-identical at 55 `landing.*` keys per dictionary**
(§4.27.G/§4.30.H/§4.31.F carry); the batch touches geometry, one clamp
value and two reveal markers — no user-visible string changes. The RU/EN
switch re-renders without a reload; `i18n.test.ts` and the
`LANDING_KEYS`/parity/dead-key assertions are UNTOUCHED and stay green
(RU/EN 55/55).

#### 4.32.F Reduced motion + the reveal-system delta

- **Reduced motion: UNCHANGED.** Under
  `prefers-reduced-motion: reduce` the §4.30.A utility arms NOTHING —
  every block (the lead AND the below-fold BLEAK card) is fully visible
  from the first paint; the card below the fold simply sits there visible
  until scrolled (no reveal animation). The base.css catch-all, the
  `reducedMotion()` checks and §4.26.M/§4.27.H/§4.28.I/§4.30.I/§4.31.G
  carry verbatim. The batch adds no new animation, no transition, no new
  motion-sensitive element.
- **No-JS / missing-IO fallbacks: UNCHANGED** — nothing armed ⇒
  everything visible, including the below-fold card (the bare
  `[data-reveal]` marker still carries no styles).
- **The one delta is the card's unit class** (`data-reveal-load` → bare
  `data-reveal`, §4.32.A): the armed count at mount stays **14** (13
  scroll units + 1 load unit); the stagger groups (steps 0/60/120, pills
  0/60/120/180) are untouched; the card is a single unit — no
  `--reveal-delay`.
- **Media states:** the landing still fetches nothing — no loading/
  empty/error deltas. No horizontal scroll at 320/800/960/1280/1920 (the
  tracks are fr-proportional; the card is width-bound inside its track).

#### 4.32.G Acceptance criteria (checkable)

**<960px open state — lead ALONE (item 1):**
1. The base `.stage` rule declares `display: flex; flex-direction:
   column; align-items: center; gap: var(--space-6); min-width: 0` and
   does NOT declare `min-height: 100dvh` nor `justify-content: center`
   (negative on both — the §4.31.B stack construction is gone from the
   base rule).
2. A `@media (max-width: 959.98px)` block declares `.area-lead {
   min-height: 100dvh; display: flex; flex-direction: column;
   justify-content: center }` — at an 800px-wide viewport the lead is
   centered ALONE in the first viewport (the negative: the first viewport
   does NOT contain the BLEAK card at <960 — superseding §4.31.H AC 5's
   "both fit at 800×800").
3. The BLEAK card is BELOW THE FOLD at <960: the markup keeps `.stage >
   .area-lead + .area-agents` (DOM byte-unchanged; the card is the
   stage's second child, the banner follows `.stage`), and the
   construction guarantees the offset — the card's top edge at the
   scroll origin is ≥ `100dvh + var(--space-6)`. Where layout is
   available (browser/visual pass), assert
   `card.getBoundingClientRect().top > window.innerHeight` at
   `scrollY = 0` at an 800×800 viewport; in the string-level suite the
   equivalent assertions are AC 1 + AC 2 + the DOM order (the lead region
   owns the 100dvh, the card follows the stage gap).
4. The `<719.98px` band keeps NO separate hero rule of its own beyond
   AC 2's media (the whole <960 band is ONE construction; no
   `.area-lead { min-height: 100dvh }` outside the 959.98px media —
   negative).

**≥960px open state — lead + Bleak BOTH (carry, re-asserted):**
5. The ≥960 media declares `.stage { display: grid;
   grid-template-columns: 1.2fr 1fr; column-gap: var(--space-6);
   min-height: 100dvh; align-content: center; align-items: center }` —
   `min-height: 100dvh` is declared INSIDE the ≥960 media (it moved from
   the base rule; negative: the base `.stage` rule has no min-height) —
   with `.area-lead` grid-column 1 and `.area-agents` grid-column 2.
   At 960/1280/1920 the first viewport contains ONLY the lead + the
   BLEAK card (plus the fixed header), vertically centered; the hero row
   GROWS on short viewports (min-height, never `height: 100dvh` —
   negative on a fixed height).
6. The reveal markers: `<section class="copy area-lead"
   data-reveal-load>` (the lead alone animates ON LOAD) and
   `<section class="area-agents" id="agents" data-reveal>` (the bare
   scroll marker — negative on `data-reveal-load` for the agents card);
   the armed count at mount is 14 (13 scroll units: `.area-agents` first,
   then banner + 3 steps + sim + privacy + 4 pills + join + footer; 1
   load unit: the lead). The card's reveal fires on its first viewport
   intersection — at <960 only after the user scrolls it into view (the
   one-shot + cleanup mechanics unchanged).

**The Bleak card wide on desktop — symmetric edges (item 2):**
7. The ≥960 media contains NO `.agent-card` max-width declaration and NO
   `.agent-card` `margin-inline: auto` (negative — the §4.30.C cap
   `max-width: 240px` is GONE from the hero; grep: no `240px` agent-card
   rule remains anywhere in `+page.svelte`); `.agent-card` fills its
   track via the existing `width: 100%` shared rule.
8. The symmetry construction: `.landing` keeps `width: max(80%, 280px);
   margin-inline: auto; padding: 0 var(--space-7) var(--space-7)` at
   ≥720 byte-unchanged, `.copy { width: 100% }` and
   `.agent-card { width: 100% }` both fill their tracks — therefore the
   card's right margin from the viewport equals the lead's left margin,
   each `calc(10% + 48px)` at every ≥960 width (asserted as this
   construction; where layout is available: the two margins measure
   equal at 960/1280/1920, and the card's right edge aligns with the
   container's content-box right edge — the 48px padding NOT pierced).
   Resulting widths: ≈ 288px at 960, ≈ 407px at 1280, ≈ 640px at 1920.

**The desktop headline bigger (item 3):**
9. The ≥960 media declares `.headline { font-size: clamp(32px, 4.5vw,
   64px) }` (43.2px at 960, 57.6px at 1280, capped 64px from ≈1422px up);
   the old `clamp(28px, 4vw, 48px)` is GONE from the stylesheet
   (negative — including every stale test reference); the <960 ladder is
   byte-unchanged (40px base / 48px at ≥480px) and NO headline clamp
   exists outside the ≥960 media.
10. The ladder hierarchy holds at every ≥960 width: the headline
    (≥ 43.2px) stays dominant over the 28px `.agent-name` and the
    accent word's treatment is unchanged (violet + its glow, the
    sparkles); the open-state fit math holds — the row max stays ≤
    ≈ 392px across 960/1280/1920 (§4.32.C), inside any realistic desktop
    viewport height.

**i18n + suites (carry):**
11. i18n: exactly **55** `landing.*` keys in BOTH dictionaries,
    byte-unchanged (RU/EN parity 55/55); `i18n.test.ts` passes UNAMENDED.
12. Suites amended and green: `landing-page.test.ts` — the §4.31 <960
    stack assertions (ACs 4–6 there: the centered stack, the 800×800
    both-fit reading, the §37-at-every-width scoping) rewritten to
    §4.32.G ACs 1–4; the §4.30.C 240px-cap assertions rewritten to ACs
    7–8 (the cap negative inverted); the headline clamp assertions
    (including the stale 720px-media clamp reference) updated to the new
    value per AC 9; the reveal enumerations updated per AC 6 (the AC-4
    hero-pair test becomes the lead-only load reveal + the agents scroll
    unit; the 12-units comment becomes 13; the armed count stays 14); ALL
    other suites untouched green; `make lint && make test && make build`
    green.
13. Constraints: no new dependencies; no copy changes (55/55
    byte-identical); palette tokens unchanged (no new color values —
    geometry/typography only); routes untouched (the §4.31.D rename
    stands as delivered; no route dir/param/resolution change); /income
    untouched INCLUDING the §44.4 keyboard-viewport mechanism (JoinFlow's
    `--app-height`/visualViewport wiring byte-untouched); the
    scroll-reveal + reduced-motion mechanics unchanged (only the agents
    card's unit class changes); the profile files (task 131) untouched;
    API endpoints used: none.

#### 4.32.H Flags for the owner / concept (concept report)

1. **Record — the DOM does NOT move (item 1):** the card stays inside
   `.stage` in the markup; the <960 first-viewport isolation is produced
   by CSS (the `.area-lead` 100dvh region, §4.32.A) because a literal DOM
   move out of `.stage` would make the card unreachable by the ≥960
   two-column hero grid and break the ≥960 open-state. The visual scroll
   order at <960 is exactly the owner's: lead (first viewport) → BLEAK
   card → banner.
2. **Record — the symmetry includes the container's 48px padding
   (item 2):** both margins measure `calc(10% + 48px)` at ≥960, not bare
   10% — the padding sits INSIDE the 80% symmetrically and is included
   on both sides, preserving the equality the owner asked for; piercing
   the padding on the card side only would have BROKEN the symmetry
   (§4.32.B).
3. **Record — the ≥960 card reveal fires at the scroll origin (item 1):**
   with the card a scroll unit at ≥960, its IntersectionObserver fires
   on the first observation callback (the card is in view) — net: the
   same on-open fade+rise as the retired load-reveal, one IO tick instead
   of one rAF. No utility change needed.
4. **Record — the clamp value is design's call per §45.3:**
   `clamp(32px, 4.5vw, 64px)` (43.2px at 960 → 64px from ≈1422px) —
   picked to keep the §4.28 ladder margin WIDER than before while the
   line-fit and open-state fit math stay comfortable (§4.32.C). A
   single-value tweak (cap 56–72px) is a one-literal revert if the smoke
   dislikes the 1920 scale.
5. **ADVICE NEEDED — none blocking:** no copy invented (zero-delta
   round), no palette value added, no route or /income change, no
   dependency; the three items are fully specified above.

### 4.33 v3.27 feature design (2026-11-23, owner-approved Concept §46): §46 Bleak block per-breakpoint structure + 960 step-stack + staggered text reveal

The owner issued the five-item §46 follow-up batch (2026-11-23):
(1) **screen >960px — the Bleak block as narrow as possible with its
height EQUAL to "The right connections beside you"** (the two hero
blocks end on the same bottom line; no taller, no wider than needed);
(2) **screen 720–960px — the Bleak block adopts the SAME STRUCTURE as
the "Real people. Real results." banner** (the wide banner-style glass
card — text side, mascot/icon side with the status treatment) and stays
BELOW THE FOLD (per §45.1); (3) **screen <720px — no change**;
(4) **the 01/02/03 step cards stack vertically at <960px** (the 960
boundary, not 720); (5) **the §42/§4.30 reveal system extends to the
TITLE and DESCRIPTION elements themselves** — staggered title →
description within each block, reduced-motion = visible immediately.
This section amends §4.32 (→ §4.31 → §4.30 → §4.28 → §4.27 → §4.26 →
… → §4.20) item by item; **where §4.33 is silent, the earlier specs
stand** except where §4.33.F explicitly supersedes them. All other
§31–§33 contracts stay in force (routes, Start → `/income` with the
6-digit input, RU/EN parity, three step blocks, existing suites green).
Grounded in the live code (read-only audit, 2026-11-23):
`apps/web/src/routes/+page.svelte` (the hero `.stage` — base flex stack
with the `@media (max-width: 959.98px)` `.area-lead { min-height: 100dvh }
… justify-content: center` lead-alone region and the `@media
(min-width: 960px)` `grid-template-columns: 1.2fr 1fr; min-height:
100dvh; align-content: center; align-items: center` grid; `.agent-card`
filling its track via the shared `width: 100%` rule (the §4.30.C 240px
cap deleted, §4.32.B); the banner `.stat-body` (glass
rgba(20, 18, 30, 0.55) + blur(12px), the §4.30.F phone icon-top stacking
— `order: -1` glyph row, desktop row ≥720); the step cards `.step-body`
(`background: var(--color-surface)`, `height: 100%`, §4.30.E/§4.31.C)
with `.steps` a base flex-column stack and the `repeat(3, 1fr)` grid
inside the `@media (min-width: 720px)` block; the reveal wiring —
`data-reveal-load` on `.area-lead` only, bare `data-reveal` on
`.area-agents` + banner + 3 step blocks + sim + privacy + 4 use-case
pills + join + footer),
`src/lib/components/landing/reveal.ts` (the armed-only hidden state —
`[data-reveal='armed']` in base.css — ONE shared IntersectionObserver
threshold 0.15 / rootMargin −48px, one-shot per unit with the
transitionend + 720ms-fallback cleanup, the 60ms sibling stagger
`--reveal-delay` inline on `.steps`/`.usecase-row` members capped at
180, the `data-reveal-load` rAF load reveal),
`src/lib/components/landing/sectionArt.ts` (untouched),
`src/lib/styles/tokens.css` (untouched — `--space-*`, `--color-surface`,
the glass literals are the sanctioned raw-literal family),
`src/lib/styles/base.css` (the armed-state rules — untouched, the
markers extend onto them), `tests/landing-page.test.ts` (the §4.30/
§4.31/§4.32 hero, steps, banner and reveal assertions — amended per
§4.33.I). Hard constraints unchanged: **no new dependencies**, **no copy
changes** (i18n ZERO delta, §4.33.G), **palette tokens unchanged** (the
720–960 glass reuses the banner's EXISTING rgba(20, 18, 30, 0.55) +
blur(12px) literals — no new color values anywhere), **routes
untouched**, **/income untouched INCLUDING the §44.4
keyboard-viewport mechanism**, **the §37 open-state and the reveal
mechanics EXTEND, not replaced** (the armed-only hidden state, the
one-shot observer, the thresholds, the cleanup and the load reveal all
carry verbatim; only the marker set and the utility's unit/part split
grow, §4.33.E). **API endpoints used: none** — the landing stays
fetch-free (§4.20 preamble). Task: tz12-16
(`feature/eda902cb-tz12-16-bleak-breakpoints`).

#### 4.33.A >960px — the Bleak card as narrow as possible with EQUAL heights (item 1)

**Live-code finding:** at ≥960 the card fills its `1fr` track
(≈ 288px at 960, ≈ 407px at 1280, ≈ 640px at 1920 — §4.32.B) and the
hero grid centers both blocks (`align-items: center`), so the two
blocks' BOTTOM edges align only when their content heights happen to
coincide (§4.32.C: lead ≈ 326/371/392px vs card ≈ 344–370px at
960/1280/1920 — at 1280 the card is ≈ 7–27px SHORTER than the lead and
floats centered, its bottom line ABOVE the lead's). The owner now wants
the card **as narrow as possible such that its height equals the
lead's** — the two hero blocks ending on the same bottom line.

**The heights-equal rule (decided — tests assert THIS construction):**

> The two hero blocks STRETCH to the same rendered height: the ≥960
> grid switches `align-items: center` → **`align-items: stretch`**, the
> lead and the card both fill the row track (`height: 100%` chains),
> and the row height = the TALLER natural content height (the lead's at
> 1280/1920, the card's content floor at 960). The card is capped at
> **`max-width: 240px`** — the narrowest width whose content stack
> stays within the lead's natural height — and is **RIGHT-ALIGNED in
> its track** (`margin-left: auto`), keeping the §45.2 symmetric-edge
> rule (the card's right edge at the container's content-box right
> edge). TALK pins to the card's bottom line via `margin-top: auto`.

The exact construction (all inside the existing `@media
(min-width: 960px)` block):

```css
@media (min-width: 960px) {
  .stage {
    display: grid;
    grid-template-columns: 1.2fr 1fr;   /* byte-unchanged (§4.31.A) */
    column-gap: var(--space-6);
    min-height: 100dvh;
    align-content: center;              /* byte-unchanged — §37 centering */
    align-items: stretch;               /* WAS center — the equal-height rule */
  }
  .copy          { height: 100%; }      /* the stretched section's child fills it */
  .copy-body     { height: 100%; justify-content: center; } /* the lead's
                     content stays VISUALLY centered (§37) inside the
                     stretched box — the centering is preserved by
                     construction, not by measurement */
  .agent-card    { max-width: 240px;    /* the heights-equal narrow width */
                   margin-left: auto;   /* right-aligned in its track —
                                           NOT margin-inline: auto */
                   height: 100%; }      /* fills the stretched section */
  .agent-body    { height: 100%; }      /* the §4.31.C step-body construction:
                     the body FILLS the stretched card */
  .talk          { margin-top: auto; }  /* TALK pins to the card's bottom
                                           line (the §4.26.C step-pill
                                           margin-top:auto precedent) */
}
```

- **The width value — 240px, decided (the caller's 200–220px options
  evaluated and REJECTED on the wrap math):** the card's interior after
  its 20px body padding is ≈ 200px at 240px. The quote is the only
  wrapping element; the RU string «Я начинаю разговор. Вы сохраняете
  контакт.» (44 chars, ≈ 9px/char Inter ≈ 396px) wraps to **2 lines**
  at a 200px interior (396/200 = 1.98) — the binding case over the EN
  string ("I break the ice. You keep the contact.", 41 chars ≈ 336px,
  2 lines at ≈ 168px interior). The stack height at a 2-line quote:
  body padding 40 + portrait 96 + 5 gaps × 12 (60) + name ≈ 34 + badge
  24 + traits ≈ 16 + quote 2 × 23 (46) + TALK 48 ≈ **364px** — at
  1280 that is ≤ the lead's natural ≈ 371px (the LEAD dictates the row
  — the card is "no taller than the lead" ✓) and at 1920 ≤ ≈ 392px ✓.
  At **220px** (interior ≈ 180px) the RU quote wraps to **3 lines** →
  stack ≈ 387px > the lead's 371px at 1280 — the card would dictate the
  row and read taller-than-the-lead: rejected. At **200px** it is worse
  (3 lines, ≈ 387px+, and the EN quote risks 3 lines too). Container-
  query / aspect-ratio tricks (option c) are REJECTED as overkill — a
  fixed max-width + the stretch construction is the simplest robust
  rule, needs no new at-rule support and degrades to plain CSS.
  **Estimate at 1280 (the number the caller asked for): the
  name + badge + quote + TALK stack (with the portrait) reaches the
  lead's ≈ 371px height at a card width of ≈ 240px; the rendered slack
  (≈ 7px) sits between the quote and TALK.**
- **The fit check at the three widths (stretch + cap, both locales):**
  - **960** — lead natural ≈ 326px; card content floor ≈ 364px (the
    RU 2-line quote is the card's irreducible minimum: narrower wraps
    it to 3 lines and grows the card TALLER, worse on both counts) →
    the row ≈ 364px is card-dictated; the lead's content (326px)
    centers inside its stretched 364px box via `justify-content:
    center`; both boxes are 364px → **the bottom lines align
    structurally**; the pair stays vertically centered in the 100dvh
    stage (`align-content: center`). Recorded as the band's physical
    floor (§4.33.J flag 1).
  - **1280** — lead ≈ 371px ≥ card 364px → row = 371px (lead-dictated);
    card stretched, ≈ 7px slack above TALK; bottom lines align.
  - **1920** — lead ≈ 392px ≥ 364px → row = 392px; ≈ 28px slack above
    TALK; the content cluster hugs the card's top, TALK anchors the
    bottom line; bottom lines align.
- **The bottom line is the two BLOCKS' container edges** (the lead's
  stretched `.copy` box and the card's frame bottom edge) — not the CTA
  baselines (the lead's Start button floats centered in its box; TALK
  sits 20px above the card's bottom padding edge). The owner's "the two
  hero blocks end on the same bottom line" is satisfied by the stretch
  construction at EVERY ≥960 width and every viewport height — by
  construction, not by per-width measurement.
- **The §45.2 margin symmetry CARRIES:** the card is right-aligned in
  its track (`margin-left: auto; margin-right: 0` — the §4.30.C-era
  `margin-inline: auto` centering is NOT reinstated), so the card's
  right edge stays at the container's content-box right edge and both
  margins still measure `calc(10% + 48px)` (§4.32.B's asserted rule —
  the right-edge equality — is untouched; what changes is the card's
  LEFT edge, which moves inward to the 240px width).
- **The grid is byte-unchanged:** `1.2fr 1fr` stands (the lead keeps
  its asserted ≈ 489px track at 1280, §4.31.A); the narrowing happens
  INSIDE the card's track via the max-width (a `1fr auto` re-cut was
  evaluated and rejected — it would change the lead's asserted width
  and re-open §4.31.A's assertions for no benefit).
- **Resulting rendered widths:** the card is **240px at every ≥960px
  width** (the track floor at 960 is ≈ 288px > 240 — the cap binds
  everywhere in the band); the §4.32.G AC 8's ≈ 288/407/640px track
  widths remain the TRACK sizes, not the card's.
- **Unchanged:** the card's content contract (§4.20.G-b: portrait 96,
  name, badge, traits, quote, TALK → `/income`), the hover/press
  treatments, the `#agents` id + scroll-margin, the pixel-frame--strong
  frame, the opaque `--color-surface` surface at ≥960, and the
  centered-content reading of the card (`align-items: center;
  text-align: center` on `.agent-body` carry).

#### 4.33.B 720–959.98px — the Bleak card becomes a banner-structure block (item 2)

**Live-code finding:** at 720–959.98px the card currently renders as
the §4.25-A-era flat centered column (portrait / name / badge / traits
/ quote / TALK stacked, opaque `--color-surface` body, 100% of the
container width) sitting below the fold (§4.32.A). The owner wants it
to adopt the **same structure as the "Real people. Real results."
banner** (§4.26.B as amended by §4.30.F): a WIDE GLASS card — text side
+ icon/mascot side with a status treatment — still below the fold.

**The banner-structure mapping (decided):**

| Banner element | Bleak-card counterpart | Placement |
| --- | --- | --- |
| `.stat-copy` (the text side) | name + traits + quote + TALK | the RIGHT column (`1fr`) |
| `.stat-glyph` (the icon side) | the BLEAK personage (`.agent-portrait`, 96px) | the LEFT column (`auto`) |
| the status treatment (`.stat-status` dot + caption) | **the class badge** (`.agent-badge`) acts as the status chip | UNDER the portrait, on the icon side |

- **The status-chip decision:** the class badge IS the status
  treatment — it moves (visually, via grid placement) under the
  portrait, anchoring the icon side's bottom row (mirroring TALK's
  row on the text side). Duplicating the banner's pulsing dot +
  caption pair was evaluated and REJECTED: a caption needs a new
  string (copy invention — the zero-delta constraint) and a second
  `.status-dot` animated element; the badge chip + the portrait's
  existing purple glow carry the "live agent" read without either.
- **The glass recipe — the banner's EXACT values (decided per
  consistency):** `rgba(20, 18, 30, 0.55)` + `backdrop-filter:
  blur(12px)` (+ `-webkit-`), byte-equal to `.stat-body`'s — the block
  IS the banner-structured sibling; the §4.26.E section recipe
  (rgba(18, 15, 28, 0.45) + blur(16px)) stays with the four NEW
  sections only. No new color value (the literal already exists —
  `sweep.test.ts` stays green). The construction parity is already in
  the class list: the card carries `pixel-corners pixel-frame
  pixel-frame--strong` — the banner card's EXACT frame (§4.31.C kept
  it strong on the agent + banner cards).
- **The construction (a NEW band media — the DOM does NOT move; the
  existing children are re-placed with named grid areas):**

```css
@media (min-width: 720px) and (max-width: 959.98px) {
  .agent-body {
    /* the banner's glass fill + padding, byte-equal to .stat-body ≥720 */
    background: rgba(20, 18, 30, 0.55);
    -webkit-backdrop-filter: blur(12px);
    backdrop-filter: blur(12px);
    padding: 16px 20px;
    /* the banner's text-side / icon-side split, CSS-only */
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    grid-template-rows: auto auto minmax(0, 1fr) auto;
    grid-template-areas:
      'portrait name'
      'portrait traits'
      'portrait quote'
      'status   talk';
    column-gap: var(--space-4);
    row-gap: var(--space-2);
    text-align: left;                  /* banner text-side parity */
  }
  .agent-portrait { grid-area: portrait; }  /* spans rows 1–3, LEFT */
  .agent-badge    { grid-area: status;      /* the status chip — row 4,
                                              under the portrait, mirroring
                                              TALK's row */
                    justify-self: start; }
  .agent-name     { grid-area: name; }
  .agent-traits   { grid-area: traits; }
  .agent-quote    { grid-area: quote; align-self: start; }
  .talk           { grid-area: talk; justify-self: start; }
}
```

- **The internal split:** the icon side is the `auto` column (the
  96px portrait, grown to the badge chip's width where the chip is
  wider — ≈ 110–130px); the text side takes the remainder
  (`minmax(0, 1fr)`) — at an 800px viewport (container ≈ 640px, content
  ≈ 600px after the 16/20px padding) the split lands ≈ **78% text /
  22% icon**; at 720 ≈ 75/25. The quote row is `minmax(0, 1fr)` — the
  card grows with its content, no fixed height in the band.
- **The personage size:** the portrait stays **96px** (`size={96}`,
  the §4.20.G register — markup byte-unchanged). It ALREADY sits above
  the banner flower's 72px register (the §4.30.D +50% family); no size
  change is needed or made.
- **The below-fold position:** UNCHANGED mechanism — the §4.32.A
  construction carries byte-verbatim (the base `.stage` flex stack +
  the 959.98px `.area-lead` 100dvh lead-alone region): the
  banner-structured card is **the first block after the hero region**
  (its top edge ≥ `100dvh + var(--space-6)` at the scroll origin),
  followed by the real banner. The §45.1 lead-alone open state is
  UNTOUCHED.
- **The reveal:** the card stays a SINGLE scroll unit (bare
  `data-reveal`, the 13th-units enumeration's first member) — it is NOT
  in §46.5's title/description enumeration (§4.33.E), so no part
  markers are added inside it; the whole banner-structured card fades
  + rises as one unit, exactly as today.
- **Band boundaries:** the band media's guards keep <720px and ≥960px
  byte-untouched (§4.33.C/§4.33.A); the ≥960 media's narrow-card rules
  and the band's banner rules never co-apply ( disjoint ranges,
  959.98px boundary shared with the hero media).

#### 4.33.C <720px — carried verbatim (item 3)

**No change.** The current behavior stands, restated for the record
(carried from §4.25.A → §4.28.F → §4.30.F → §4.32.A): the phone hero is
the §4.32.A lead-ALONE 100dvh region (the whole <960 band is ONE
construction — no separate <719.98px hero rule), the lead centered
vertically with the §4.28 40px/48px headline ladder, the lead
transparent + halo (§4.25.B); the BLEAK card is the next block in the
scroll flow (below the fold), rendering as TODAY: the flat centered
`.agent-body` flex column (portrait 96 / name 28 / badge / traits /
quote 17 / TALK), the opaque `--color-surface` surface, the
`pixel-frame--strong` frame, 100% of the container width, the bare
`data-reveal` scroll unit, TALK → `/income`. The banner's §4.30.F
phone stacking (glyph row first) stands; the steps are the base
flex-column stack (now formally the <960 rule, §4.33.D). The
720–959.98px band media's `min-width: 720px` guard guarantees nothing
of §4.33.B applies here; the ≥960 media's `min-width: 960px` guard
keeps §4.33.A out. Every <720px assertion in the suite carries
UNAMENDED.

#### 4.33.D The step cards stack at <960px — the 960 boundary (item 4)

**Live-code finding:** the `.steps` row collapses at 720px today (the
`repeat(3, 1fr)` grid lives inside the `@media (min-width: 720px)`
block, lines ~1460 of `+page.svelte`); the owner moves the boundary to
960 for THESE cards. The re-cut is ONE media move:

```css
/* BASE = <960px: the vertical top-to-bottom stack (unchanged values) */
.steps {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}
@media (min-width: 720px) {
  /* the card SIZING stays ≥720 (orthogonal to the row/stack question) */
  .step-block .step-body { min-height: 300px; padding: 20px; }
}
@media (min-width: 960px) {
  /* MOVED here from the ≥720 media — the row exists ≥960 ONLY */
  .steps {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: var(--space-6);
  }
}
```

- **At 800px (the checkable case):** the three cards are a
  full-width vertical stack (flex column, `--space-5` gaps), each with
  the ≥720 card sizing (20px padding, 300px min-height) and the
  §4.31.C unified frame; **at ≥960:** the equal-thirds row. The
  720–959.98px band therefore shows DESKTOP-SIZED cards STACKED — the
  owner's item 4 changes only the stack boundary, not the card sizing.
- **ALL other 720px rules STAND** (explicit enumeration): the
  container `max(80%, 280px)` + inline padding, the header nav reveal +
  56px row, the banner's desktop row + 72px flower, the `.sub` 18px,
  the copy-body 28px padding + left alignment (≥960), the
  sim/privacy/use-case/join section grids (`1fr auto 1fr`,
  `repeat(3, 1fr)`, `repeat(4, 1fr)`, the join row), the footer links
  row, the join-headline 28px, the step-pill 13px + `margin-top: auto`,
  the `.steps` gap var(--space-6) (it moves WITH the grid into the ≥960
  media — the base stack keeps var(--space-5)), and the ≥480px headline
  48px. **Only the steps row/stack boundary moves.**

#### 4.33.E The reveal extension — titles + descriptions animate (item 5)

**Live-code finding:** the §4.30.A system reveals each below-fold block
as ONE unit; the text inside appears with the block's single fade. The
owner extends the animation to the title and description ELEMENTS
themselves — title first, description following, per-block one-shot.

**The marker changes (the SAME armed-only mechanics — no new
hidden-state rule):** the title and description elements inside the
below-fold units get the SAME bare `data-reveal` marker in the markup
(a bare marker still carries NO styles — the no-JS default stays fully
visible; the hidden state still exists ONLY under
`[data-reveal='armed']`, applied by the utility — base.css is
byte-unchanged). The utility splits the marker set:

- **A UNIT** is a `[data-reveal]` element with NO `[data-reveal]`
  ancestor — observed by the shared IO exactly as today (one-shot,
  threshold 0.15, rootMargin −48px, cleanup).
- **A PART** is a `[data-reveal]` element INSIDE a unit — armed with
  the same `data-reveal='armed'` + an inline `--reveal-delay`, but
  NEVER observed: its reveal is slaved to its unit's IO entry (the
  unit's `.is-revealed` tick adds `.is-revealed` to its armed parts in
  the same frame) — **per-block one-shot** by construction. Cleanup
  strips each part independently (its own transitionend + the 720ms
  fallback; the deepest chain — the privacy block's last part at
  +360ms + the 320ms transition = 680ms — stays under the 720ms
  fallback).

**The stagger table (exact ms; the unit delay + 60ms × the part's
index within the unit, DOM order — the title is always the first part
in DOM, so "title first, description follows" falls out of the DOM
order; parts have NO cap — the deepest cascade tops at +360ms, the
180ms cap stays on the SIBLING groups only):**

| Unit (block) | Unit delay | Parts (DOM order → delay) |
| --- | --- | --- |
| `.area-stat` (banner) | 0 | `.stat-title` → 0; `.stat-line` ×3 → 60 / 120 / 180 |
| `.step-block` 01 | 0 | `.step-title` → 0; `.step-desc` → 60 |
| `.step-block` 02 | 60 | `.step-title` → 60; `.step-desc` → 120 |
| `.step-block` 03 | 120 | `.step-title` → 120; `.step-desc` → 180 |
| `.area-sim` | 0 | `.section-title` → 0 (no description paragraph — negative, recorded) |
| `.area-privacy` | 0 | `.section-title` → 0; `.privacy-title`/`.privacy-desc` ×3 → 60 / 120 / 180 / 240 / 300 / 360 |
| `.section-title` (use-cases) | 0 | — it becomes a UNIT (below) |
| `.usecase-pill` ×4 | 0 / 60 / 120 / 180 (unchanged) | — no title/desc children (negative, recorded) |
| `.area-join` | 0 | `.section-title` → 0; `.join-headline` → 60 |
| `.area-foot` (footer) | 0 | — no title/desc elements (negative, recorded) |
| `.area-lead` (LOAD) | rAF | **NO parts — decision below** |
| `.area-agents` (the BLEAK card) | its IO entry | **NO parts — not in §46.5's enumeration (negative, recorded)** |

- **The use-cases section title** ("WHERE BLEAK SHINES") sits OUTSIDE
  the pills and its section carries no marker today — it gets its OWN
  bare `data-reveal` marker and becomes the **14th scroll unit**,
  revealing on its own IO entry (it enters the viewport before the
  pills); the pills keep their independent units + 0/60/120/180
  stagger (making the SECTION a unit was evaluated and rejected — on
  phone the tall section would hide the below-fold pills until 15% of
  the whole section was visible, killing their individual reveal
  moments).
- **The lead keeps its single load-reveal — DECIDED, no parts:** the
  §4.30.B load reveal is ONE opening beat (§4.30.K flag 3); splitting
  the headline/sub into a load cascade would read as lag on the first
  paint, and the §37 geometry + the one-beat contract stand. The lead
  carries NO part markers (negative).
- **The compound rise (record):** a part rises its own 16px INSIDE the
  block's 16px rise → titles/descs travel ≈ 32px total, transform-only
  (§4.6), no layout shift; the block's other content (badges, icons,
  pills) travels 16px as today.
- **The armed count at mount changes:** **15 units** (14 scroll units
  — the agents card FIRST, then banner + 3 steps + sim + privacy + the
  use-cases title + 4 pills + join + footer — plus the lead load unit)
  **+ 20 parts** (banner 4 + steps 6 + sim 1 + privacy 7 + join 2) =
  **35 `[data-reveal='armed']` nodes** (the §4.32.G AC 6 count of 14
  is superseded). The utility's `reducedMotion()` / missing-IO
  early-returns, the ONE observer, the one-shot ledger and the teardown
  carry verbatim; the only logic additions are the unit/part
  classification and the part arming/reveal/cleanup.
- **No new CSS:** the parts reuse the base.css `[data-reveal='armed']`
  rules and the `--reveal-delay` mechanism verbatim — the stylesheet
  gains nothing; the stylesheet-level negative ("no hiding outside
  `[data-reveal='armed']`", §4.30.J AC 1) carries UNCHANGED.

#### 4.33.F Supersessions (explicit record)

1. **§4.32.B (>960 the card fills its 1fr track) SUPERSEDED (item 1):**
   the card is capped at `max-width: 240px`, right-aligned in its track
   (`margin-left: auto`) — the ≈ 288/407/640px rendered card widths are
   retired (they remain the TRACK sizes); the §45.2 symmetric
   RIGHT-edge rule + the `calc(10% + 48px)` margins CARRY; the
   `align-items: center` hero centering becomes `align-items: stretch`
   (the §37 vertical centering is preserved via `align-content: center`
   + the lead's `justify-content: center` — the rendered open state is
   unchanged).
2. **§4.30.C's 240px cap — the VALUE returns under a DIFFERENT rule
   (record, no confusion):** §4.32.B deleted the §4.30.C
   `max-width: 240px; margin-inline: auto` centered cap; §4.33.A
   reinstates a 240px max-width as the heights-equal narrow width with
   `margin-left: auto` right alignment. The centered cap stays deleted;
   no `margin-inline: auto` exists on `.agent-card` anywhere.
3. **§4.31.B's <960 two-block stack — superseded twice over (record):**
   §4.32.A already superseded it (lead-alone first viewport); §4.33.B
   additionally supersedes the 720–959.98px card PRESENTATION (the flat
   centered column → the banner-structure glass card). The <960
   below-fold position mechanism (§4.32.A) is untouched.
4. **§4.28/§4.31's 720px step stacking SUPERSEDED to 960 (item 4):**
   the `.steps` `repeat(3, 1fr)` grid moves from the ≥720 media to a
   new ≥960 media; the base flex-column stack formally covers <960.
   ALL other 720px rules stand (§4.33.D enumeration).
5. **§4.30.B's reveal enumeration EXTENDED (item 5):** the units gain
   the use-cases section title (14 scroll units); title/description
   elements become parts (20 of them) with the §4.33.E stagger table;
   the armed count 14 → 35. The §4.32.G AC 6 count and the §4.30.J AC
   1–4 enumerations are amended accordingly.
6. **Superseded-but-carried (unchanged into §4.33):** the §4.32.A
   <960 lead-alone construction + the agents-card scroll-unit class,
   §4.31.A's 1.2fr/1fr grid + the lead's ≈489px track, §4.32.C's
   headline clamp, §4.31.C's unified step borders + `.step-body`
   height:100%, §4.30.D icon sizes, §4.30.E step surface, §4.30.F
   banner stacking, §4.26.A header, §4.23.A/§4.27.1 video layer,
   §4.25.B transparent lead, §4.20.L behavior + deep-link forwarding,
   §4.31.D's `[income_code]` rename as delivered, §4.30.A's armed-only
   mechanics/one-shot/stagger-cap, and all §31–§33 route/entry
   contracts.

#### 4.33.G i18n: ZERO delta

No key is added, removed or edited — both dictionaries stay
**byte-identical at 55 `landing.*` keys per dictionary**
(§4.27.G/§4.30.H/§4.31.F/§4.32.E carry); the batch touches geometry,
one band's card structure, one media boundary and the reveal marker
set — no user-visible string changes. The RU/EN switch re-renders
without a reload; `i18n.test.ts` and the `LANDING_KEYS`/parity/dead-key
assertions are UNTOUCHED and stay green (RU/EN 55/55).

#### 4.33.H Reduced motion + media states

- **Reduced motion: UNCHANGED and static-safe for every new element.**
  Under `prefers-reduced-motion: reduce` the utility arms NOTHING —
  the units AND the new parts are never armed, every block (including
  every title/description) is fully visible from the first paint; no
  observer is created. The base.css catch-all collapses any stray
  transition. §4.33 adds no new animation, no new keyframe, no new
  transition (the band card's glass is static; the 960 stack boundary
  is geometry; the parts ride the EXISTING armed transition).
- **No-JS / missing-IO fallbacks: UNCHANGED** — nothing armed ⇒
  everything visible; the bare part markers carry no styles exactly
  like the bare unit markers.
- **Media states:** the landing still fetches nothing — no loading/
  empty/error deltas. No horizontal scroll at 320/800/960/1280/1920
  (the 240px card sits inside its fr track; the band grid's
  `minmax(0, 1fr)` text column cannot overflow; the stacked steps are
  full-width blocks). Video error → the §4.23.G static treatment, the
  reveal firing over it the same way.

#### 4.33.I Acceptance criteria (checkable)

**>960px — the heights-equal narrow card (item 1):**
1. The ≥960 media declares `.stage { … align-items: stretch }` (the
   negative: `align-items: center` is GONE from the ≥960 `.stage`
   rule; `align-content: center` + `min-height: 100dvh` +
   `grid-template-columns: 1.2fr 1fr` carry byte-unchanged) — the two
   hero blocks render at EQUAL heights at every ≥960 width (where
   layout is available: `lead.getBoundingClientRect().height ===
   card.getBoundingClientRect().height` at 960/1280/1920; in the
   string-level suite the stretch + height-chain construction is the
   assertion).
2. The ≥960 media declares `.copy { height: 100% }`,
   `.copy-body { height: 100%; justify-content: center }`,
   `.agent-card { max-width: 240px; margin-left: auto; height: 100% }`,
   `.agent-body { height: 100% }` and `.talk { margin-top: auto }` —
   the lead's content stays VISUALLY centered (§37 open state
   preserved), TALK pins to the card's bottom line, and the card is
   narrower than its track (the negative: NO `margin-inline: auto` on
   `.agent-card` anywhere; the §4.32.G AC 8's card-width values
   ≈ 288/407/640px are retired — the card renders 240px at 960/1280/
   1920).
3. The width value is 240px with the recorded wrap math: at 220px the
   RU quote wraps to 3 lines (stack ≈ 387px > the lead's ≈ 371px at
   1280) — the suite asserts the 240px literal and the §4.33.A
   construction; at 1280 the card's content stack (≈ 364px, 2-line
   RU quote) stays ≤ the lead's natural height (≈ 371px) — the LEAD
   dictates the row at 1280/1920 ("no taller than the lead"); at 960
   the row is card-dictated (≈ 364px vs the lead's ≈ 326px natural —
   the recorded floor, §4.33.J flag 1), with the bottom lines still
   aligned by the stretch.
4. The §45.2 symmetry carries: the card's right edge at the container's
   content-box right edge; both margins `calc(10% + 48px)` (the
   §4.32.B right-edge assertion stands UNAMENDED; only the left edge
   moved).

**720–959.98px — the banner-structure card (item 2):**
5. A `@media (min-width: 720px) and (max-width: 959.98px)` block
   declares `.agent-body` with the banner's EXACT glass values
   (`rgba(20, 18, 30, 0.55)` + `backdrop-filter: blur(12px)` +
   `-webkit-`, byte-equal to `.stat-body`) + `padding: 16px 20px` +
   the grid construction (`grid-template-columns: auto minmax(0, 1fr)`;
   the four-row `grid-template-areas` with 'portrait' spanning rows
   1–3 LEFT and 'status' in row 4; `text-align: left`) and the five
   grid-area assignments (`.agent-portrait` → portrait,
   `.agent-badge` → status, `.agent-name` → name, `.agent-traits` →
   traits, `.agent-quote` → quote, `.talk` → talk). The card article's
   class list is UNCHANGED (`pixel-corners pixel-frame
   pixel-frame--strong` — the banner's frame, structural parity) and
   the DOM is byte-unchanged (no wrappers added).
6. In the band the card sits BELOW THE FOLD: the §4.32.A construction
   carries (the base `.stage` + the 959.98px `.area-lead` 100dvh
   region byte-unchanged); where layout is available, the card's
   `getBoundingClientRect().top > window.innerHeight` at
   `scrollY = 0` at an 800×800 viewport — the banner-structured card
   is the first block after the hero region, followed by the real
   banner.
7. The mapping holds: the text side = name + traits + quote + TALK
   (left-aligned), the icon side = the 96px BLEAK personage + the
   class badge as the status chip under it; the portrait markup stays
   `size={96}` byte-unchanged; NO new dot/caption element exists in
   the agent card (negative — no copy invention).

**<720px — unchanged (item 3):**
8. The <720px band is byte-untouched: the base `.agent-body` flex
   column (centered), the opaque `--color-surface` surface, the card
   at 100% container width, the §4.30.F banner stacking, the §4.32.A
   lead-alone hero — every pre-existing <720 assertion passes
   UNAMENDED; the band media's `min-width: 720px` guard and the ≥960
   media's `min-width: 960px` guard keep both neighbors out
   (negatives: no `.agent-body` grid/glass declaration outside the
   band media; no `.agent-card` max-width below 960).

**Step cards stack at 960 (item 4):**
9. The `.steps` base rule is the flex-column stack (`flex-direction:
   column; gap: var(--space-5)`); the `repeat(3, 1fr)` grid +
   `gap: var(--space-6)` live in a `@media (min-width: 960px)` block
   (the negative: NO `.steps` grid declaration inside any
   `min-width: 720px` block); at an 800px viewport the three cards
   render stacked full-width (each with the ≥720 sizing: 20px padding,
   300px min-height, the §4.31.C unified frame); at ≥960 the
   equal-thirds row. ALL other 720px rules stand (the §4.33.D
   enumeration — grep-audited).

**The staggered title/description reveal (item 5):**
10. The bare `data-reveal` marker extends onto exactly the §4.33.E
    set: banner `.stat-title` + 3 `.stat-line`; per step block
    `.step-title` + `.step-desc`; sim `.section-title`; privacy
    `.section-title` + 3× (`.privacy-title` + `.privacy-desc`); the
    use-cases `.section-title` (an independent UNIT); join
    `.section-title` + `.join-headline` — and onto NOTHING else (the
    negatives: the lead, the BLEAK card, the footer, the badges/pills/
    icons carry no new markers).
11. The utility classifies `[data-reveal]` elements: no
    `[data-reveal]` ancestor ⇒ an observed UNIT (the shared IO,
    one-shot, unchanged); otherwise a PART of its nearest unit
    ancestor — armed with `data-reveal='armed'` + an inline
    `--reveal-delay` = the unit's delay + 60ms × the part's DOM-order
    index (no cap), never observed itself, revealed in the same tick
    as its unit, cleaned up independently (transitionend + the 720ms
    fallback). Per-block one-shot: re-scrolling never replays either
    the unit or its parts.
12. The stagger table holds (source + behavior assertions): banner
    0/60/120/180; steps (0,60)/(60,120)/(120,180); sim 0; privacy
    0/60/120/180/240/300/360; join 0/60; the pills 0/60/120/180
    unchanged; the title is always the first part (delay = the
    block's own delay) and the description follows (+60ms after it).
13. Reduced motion: `prefers-reduced-motion: reduce` → NO arming at
    all (units AND parts) — every title/description visible
    immediately; with IO unavailable everything reveals immediately;
    no element can remain permanently hidden (the armed-only
    mechanics carry — the stylesheet gains NO new hidden-state rule;
    base.css byte-unchanged).
14. The armed count at mount is **35**: 15 units (14 scroll units in
    DOM order — the agents card, banner, 3 steps, sim, privacy, the
    use-cases title, 4 pills, join, footer — + the lead load unit) +
    20 parts; the lead alone carries `data-reveal-load` (negative on
    the agents card).

**i18n + suites (carry):**
15. i18n: exactly **55** `landing.*` keys in BOTH dictionaries,
    byte-unchanged (RU/EN parity 55/55); `i18n.test.ts` passes
    UNAMENDED.
16. Suites amended and green: `landing-page.test.ts` — the steps-layout
    test's ≥720 grid assertion rewritten to ≥960 (AC 9); the ≥960
    hero-grid test's `align-items: center` assertion rewritten to
    `stretch` + the §4.33.A declarations (ACs 1–2); the §4.32.G AC
    7–8 card-width assertions rewritten to the 240px right-aligned cap
    (AC 2/AC 4); the §4.30/§4.32 reveal enumerations (13 units / 14
    armed) rewritten to 14 units / 35 armed with the part assertions
    (ACs 10–14); the <720 and §4.32.A assertions carry UNAMENDED;
    `sweep.test.ts` green (the band glass reuses the banner's existing
    literal — no new color values); all other suites untouched green;
    `make lint && make test && make build` green.
17. Constraints: no new dependencies; no copy changes (55/55
    byte-identical); palette tokens unchanged (no new color values —
    the band glass is the banner's existing literal family); routes
    untouched; /income untouched INCLUDING the §44.4
    keyboard-viewport mechanism; the §37 open-state geometry preserved
    (the lead's content stays centered; the stretch changes the BOX
    heights only); the reveal mechanics extend, not replaced (one
    observer, armed-only, one-shot, the 60ms stagger — the marker set
    and the unit/part split grow); the profile files (task 131)
    untouched; API endpoints used: none.

#### 4.33.J Flags for the owner / concept (concept report)

1. **Record — the 960-boundary floor (item 1):** at exactly ≥960–1279
   the lead's natural height (≈ 326px at 960) is BELOW the card's
   content floor (≈ 364px: the RU quote's 2-line wrap is irreducible —
   narrower wraps it to 3 lines and grows the card TALLER), so the ROW
   is card-dictated there and the lead's content centers inside its
   stretched box. The bottom lines align at EVERY ≥960 width by the
   stretch construction; "no taller than the lead" holds strictly at
   1280/1920 and is physically impossible below ≈ 1150px without
   shrinking the card's content (a copy or portrait change — out of
   scope). If the owner wants the lead to dictate everywhere, the
   one-value lever is the headline clamp's 960 floor (§4.32.C) — a
   design decision, not taken here.
2. **Record — the 240px value is design's call per §46.1 ("as narrow
   as that allows"):** the caller's 200–220px suggestion was computed
   and rejected (the RU 3-line quote makes the card taller than the
   lead at 1280); 240px is the narrowest width whose 2-line RU quote
   keeps the stack ≤ the lead's natural height at 1280/1920. A
   one-literal tweak (230–260px) re-balances if the smoke disagrees;
   the construction (stretch + right-align + TALK pin) is independent
   of the literal.
3. **Record — the status-chip mapping (item 2):** the class badge
   moves (visually, via grid areas) under the portrait as the icon
   side's status chip; the banner's pulsing dot + caption pair was
   rejected (a caption string would be copy invention). If the owner
   wants the literal dot+caption on the Bleak card, it needs one new
   key per dictionary (a §4.7-format i18n round, NOT this zero-delta
   batch).
4. **Record — the lead gets NO title/description parts (item 5):**
   the load reveal stays one beat (§4.30.B/§4.30.K flag 3); splitting
   it would read as first-paint lag. The BLEAK card also carries no
   parts (not in §46.5's enumeration) — its banner-structured band
   variant reveals as one unit.
5. **Record — the use-cases section title becomes a scroll unit
   (item 5):** it was never hidden before (no marker, visible
   immediately); it now reveals on its own IO entry before the pills.
   Making the whole `.area-usecases` section a unit was rejected (it
   would delay the below-fold pills' individual reveals on phone).
6. **Record — the parts' compound rise:** a part travels ≈ 32px total
   (its 16px inside the block's 16px), transform-only; the privacy
   cascade's last part starts at +360ms and finishes ≈ 680ms after the
   block's reveal — inside the 720ms cleanup fallback. A flatter
   cascade (cap parts at 180ms) is a one-constant change if the smoke
   finds the tail long.
7. **ADVICE NEEDED — none blocking:** no copy invented (zero-delta
   round), no palette value added, no route or /income change, no
   dependency; the five items are fully specified above (§4.33.A–E).

### 4.34 owner bug-batch amendment (2026-11-23, owner-approved Concept §48): entry flow — 6-digit auto-advance + room intro route + clean create redirect

Owner bug batch (Concept §48, 2026-11-23), three entry-flow changes: (1)
auto-advance on the 6-digit code, (2) the room intro gets its own route
`/income/<income-code>`, (3) the create-profile redirect is clean (no query
string). All other §31–§33 contracts stay in force (§48 binding). This
section amends §3.1 (the join page, now the `/income` entry surface),
§4.31.D (the param rename) and §4.31.H where they collide; everything not
named below carries verbatim. No code shape is mandated here — the
ARCHITECTURE pass owns the implementation plan; this section owns the UX
contract.

#### 4.34.A The entry-flow route map

The pre-room flow is three routes; the income code (the 6-digit invite code)
travels in the **path param only** on both parametrized routes — never in a
query string:

| Route | Page | Role | Source of the room context |
| --- | --- | --- | --- |
| `/income` | 6-digit entry (`CodeEntry` in the §30 FormShell) | the entry surface — §31/§47 contract intact: the default 6-digit form ALWAYS shows (no resume variant) | none — the user types / pastes / scans / deep-links the code here |
| `/income/[income_code]` | room intro (`RoomPreview` in the §30 FormShell) — **NEW route** `src/routes/income/[income_code]/+page.svelte` | the create-user / change-code choice page | the param IS the 6-digit invite code; resolved on mount (§4.34.C) |
| `/income/[income_code]/create` | creation wizard (`JoinFlow` seeded into the persona step) | the persona creation interview | the param IS the 6-digit invite code; resolved on mount (§4.34.D) — **NO query params, ever** |

Flow: `/income` (6 digits complete → auto-resolve) → `/income/[income_code]`
(intro: create profile / change code) → `/income/[income_code]/create`
(wizard) → `/room`. "Change code" anywhere goes back to `/income` (§3.1
Step-1 affordance; on the intro route it is one of the two footer actions —
§4.19/§4.22.E carry). The layout comment in §3.1 that the room-preview
"card content swaps" in place after resolution is superseded by this map:
on `/income` a successful resolve NAVIGATES to `/income/[income_code]`
(§4.34.B); the §3.1 Step-2 region relocates verbatim to the intro route.

#### 4.34.B Auto-advance on the 6-digit code (`CodeEntry`)

After the **6th digit is entered** — typed, backspace-refilled, pasted as a
6-digit string, or filled by the scanner/`?code=` deep link (§3.1, §3.8) —
the entry form **automatically performs the resolve** (exactly what the
submit button does today: the `JoinFlow.submitCode` → `resolveInviteCode`
seam, ARCHITECTURE §10.6, endpoint `GET /api/invite/{code}` — public read,
no token) and either **proceeds to the intro route** or **shows the error**
— it never waits for the submit button.

- **Trigger discipline (no double-submit):** the auto-resolve fires ONCE per
  completion. While a resolve is in flight the form is `busy`: further
  digit edits do not re-trigger, a submit-button press is a no-op, and the
  CTA shows the §3.1 inline spinner, disabled. A resolve that FAILS
  re-enables the form; it does NOT auto-retry — the next attempt is the
  user's (edit a digit, or tap submit). No debounce timing is introduced;
  the trigger is the completion event itself.
- **Error mapping — exactly the existing `codeErrorOf` treatments** (§3.1
  state table carries): malformed (400) → inline field error + 120ms shake
  (§2.6 reduced-motion aware); `NetworkError` / API error → `ErrorBanner`
  (§2.1); unknown/dead code (404) → the code-not-found inline treatment
  («Код не найден — уточните его у организатора.»). On every error the
  **entered digits survive** in the cells (the existing preservation rule),
  the CTA re-enables, and focus stays in the digit field.
- **Success:** on resolve, navigate to `/income/[income_code]` with the
  resolved code as the path param (§4.34.A). The 6-digit string resolved
  remains the `invite_code` carried into `CreateUserRequestV2` at persona
  creation (§3.1 unchanged on this point — the code itself, not the room
  address, is what creation consumes).
- **The submit button STAYS** as a redundant affordance, unchanged (disabled
  until 6 digits; pressing it with a fresh/edited code re-runs the resolve).
- **Reconciliation with §3.1 deep-link auto-submit:** the `?code=NNNNNN`
  prefill-and-auto-submit behavior on `/income` **stays untouched** — it is
  the invite-deep-link mechanism (§3.8 invite QR; the host share kit's
  `{INVITE_URL_BASE}?code=NNNNNN`), NOT the create-route seed, and it now
  shares the same completion→resolve→navigate path as typed entry. The §3.8
  scanner context (a) is likewise untouched: a scanned code enters Step 1
  exactly as if typed and then auto-advances by the same rule.

#### 4.34.C The room intro route `/income/[income_code]`

New SvelteKit route `src/routes/income/[income_code]/+page.svelte`
mounting the existing `RoomPreview` component (create profile / change
code) inside the §30 FormShell instantiation it has today (§4.22.E table:
`BleakMascot` 96 idle at top; the multi-button footer — create profile +
change code). The route param is the 6-digit invite code.

- **Resolve on mount:** the intro page resolves the param code with the
  existing resolve logic (`GET /api/invite/{income_code}` → room address →
  `GET /api/room/{address}` public read for name/description/language/
  max_user, and the member count via `GET /api/room/{room}/user` length —
  the §3.1 Step-2 data set). The resolve runs on mount and on re-entry;
  it is public (no token), rate-limited per source (swagger).
- **Resolving treatment:** consistent with the §30 shell and §3.1's
  "Resolving code" state — the shell renders normally (header/locale +
  mascot + title) and the content region shows a small inline spinner
  with no new copy (no skeleton — §3.1's "skeleton not used" rule). The
  footer actions are disabled until the room context is present.
- **Dead/invalid param:** the SAME treatments as §3.1's code errors,
  relocated to this route: unknown/dead code (404) → the code-not-found
  inline treatment (the «Код не найден…» copy — no shake, since there is
  no field here); malformed-looking param → same state; `NetworkError` /
  API error → `ErrorBanner` with a retry affordance. In all error states
  the **Change code action remains available** (or is the sole action) and
  goes back to `/income`.
- **Actions (unchanged contracts):** create profile →
  `goto(resolve('/income/[income_code]/create', { income_code }))` with
  NO query string (§4.34.D); change code → `/income`.

#### 4.34.D The clean create redirect — path-param-only create contract

`/income/[income_code]/create` takes **no query parameters, ever**. The
`?code=` append dies: `JoinFlow.chooseCreate` navigates with the income
code in the path only —
`goto(resolve('/income/[income_code]/create', { income_code: flow.code }))`.

- **Seeding (supersedes today's shortcut):** the create route can no longer
  build a `Room` directly from the path param (a 6-digit code is not a room
  address). On mount it **resolves the code with the existing resolve
  logic** — `GET /api/invite/{income_code}` → room address →
  `GET /api/room/{address}` for the `Room` object the persona submit needs
  (`room.address` in `POST /api/room/{room}/user`) — then opens the wizard
  at its step exactly as the seeded path does today (§4.31.D's resolution
  skeleton otherwise unchanged). Resolve failures route as today: anything
  that cannot resolve → `goto(resolve('/income'), { replaceState: true })`
  (the §4.31.D rule; the network case MAY show the `ErrorBanner` with
  retry instead of silently redirecting — worker's call per §2.1, but no
  dead-end blank shell).
- **Reconciliation — §3.8 deep-link handling vs the param-only create
  route:** `?code=` deep links (`{INVITE_URL_BASE}?code=NNNNNN`, scanned or
  opened) target **`/income` only** (forwarded there per §4.20.L/§4.23.G
  behavior). The create route ignores/strips no deep link — it simply never
  receives one; the §3.8 handshake deep links (`?u=`, `?u=…&m=…`) are
  room-internal and untouched. §3.1's deep-link clause is thereby SCOPED:
  `?code=` belongs to the entry surface, never to the create route.
- **Grep-audited consumers to re-wire (worker surface, not exhaustive
  code-spec):** `JoinFlow.chooseCreate` (the navigation above),
  `JoinFlow.wizardBack` — which today round-trips `/income?code=…` —
  becomes the param-only round-trip `resolve('/income/[income_code]',
  { income_code })` (back to the intro route), and the seeded-`?code=`
  assertions in `tests/landing-page.test.ts` + `tests/join-flow.test.ts`
  (and any resolve-mock shapes carrying `?code=`) follow the new contract.
  §4.31.D's item-4 test list is the baseline; the `?code=` spellings die
  from it.

#### 4.34.E Reconciliation notes

1. **§30 FormShell contracts stay:** the intro route keeps its shell
   instantiation (§4.19's multi-button footer), the 6-digit form keeps its
   shell, the wizard keeps its shell — the §4.31.1/§4.31.2 keyboard-
   viewport mechanism covers the creation path as shipped and the intro
   route rides the same shell geometry. The auto-advance changes NO shell
   geometry (the CTA spinner and the disabled state are §3.1 states).
2. **§3.1 carries with two scoping amendments:** the Step-2 in-card swap
   becomes the §4.34.A navigation; the auto-advance adds the completion
   trigger to the existing DigitInput contract ("when 6 digits present the
   CTA enables" now also means: the resolve fires). Everything else in
   §3.1 — i18n, vault, scan entry, error table, RU/EN — carries.
3. **Rate-limit note:** `GET /api/invite/{code}` is rate-limited per source
   (swagger 429). The one-shot trigger discipline (§4.34.B) keeps a single
   resolve per completion; a 429 surfaces as the banner treatment (retry by
   user action), matching the honest-error rule.

#### 4.34.F Supersessions (explicit record)

1. **§4.31.D's "the VALUE carried is still the room address" clause
   SUPERSEDED:** the `[income_code]` param now carries the **6-digit invite
   code itself** on BOTH parametrized routes; the room address is only ever
   a resolved value inside the page, never a route value.
2. **§4.31.D's seeded contract ("seeded = non-empty `income_code` param + a
   valid `?code=` query") SUPERSEDED:** the create route takes NO query
   string; seeding = param + resolve on mount (§4.34.D). Its
   "anything else → `/income` replaceState" rule carries.
3. **§4.31.D's `JoinFlow` navigation clause** (`…create` with `?code=`)
   SUPERSEDED by §4.34.D's clean redirect; `wizardBack`'s `/income?code=…`
   round-trip dies with it.
4. **§3.1's Step-2 in-card swap SUPERSEDED** by the intro route (§4.34.A);
   §3.1's `?code=` deep-link clause re-scoped to `/income` (§4.34.D).
5. **The seeded-`?code=` test assertions** (§4.31.D item 4's spellings)
   SUPERSEDED by path-param assertions.
6. Carried unchanged: §3.1's error-state table, vault flow, scan entry,
   RU/EN; §3.8 both scanner contexts; §4.19–§4.22.E FormShell/mascot
   contracts; §4.31.1/§4.31.2 keyboard-viewport mechanism; Start/TALK →
   `/income`; the §44.4 mechanism; §47's "default form always shows".

#### 4.34.G i18n: ZERO delta

No key is added, removed or edited — both dictionaries stay byte-identical
(55 `landing.*` keys per dictionary, §4.31.F carries). Route params are
never rendered; the intro route reuses the existing Step-2/RoomPreview copy
and the existing error keys («Код не найден…», the §2.1 banner keys); the
resolving treatment adds no text (spinner only).

#### 4.34.H Acceptance criteria (checkable)

1. Typing (or pasting, or scanner-filling) the 6th digit on `/income`
   triggers the resolve automatically — no submit press is needed.
2. A successful auto-resolve navigates to `/income/<the-entered-code>` (the
   code in the path, nothing in the query).
3. On resolve error the entered digits remain in the cells, the CTA
   re-enables, and the error shows the §3.1-mapped treatment (malformed →
   inline+shake; network/API → banner; 404 → code-not-found).
4. No double resolve: while in flight, digit edits and submit presses do
   not re-trigger; after an error, no auto-retry until user action.
5. The submit button is still present and functional (disabled until 6
   digits; pressing it resolves).
6. `?code=NNNNNN` on `/income` still prefills + auto-submits (§3.1
   deep-link mechanism unchanged, including after a scan).
7. `/income` always shows the default 6-digit form (§47) — no resume
   variant, with or without an existing identity.
8. `/income/<code>` exists, shows the room intro (create-profile +
   change-code actions) in the §30 FormShell, resolved from the param.
9. While resolving on the intro route: shell renders, spinner only, footer
   actions disabled; no skeleton.
10. A dead/invalid param code on the intro route shows the code-not-found
    treatment (or banner on network error) and Change code returns to
    `/income`.
11. "Create profile" navigates to `/income/<code>/create` with an EMPTY
    query string — no `?code=` anywhere in the URL.
12. `/income/<code>/create` resolves the param code on mount and opens the
    wizard with a valid `Room`; an unresolvable param redirects to
    `/income` (replaceState).
13. Wizard back returns to `/income/<code>` (param-only), never
    `/income?code=…`.
14. `?code=`, `?u=`, `?u=…&m=` deep links never target the create route;
    `?code=` forwarding lands on `/income` (§4.20.L behavior).
15. Both dictionaries byte-identical (i18n suite green); all touched
    suites (`landing-page.test.ts`, `join-flow.test.ts`, sweep) green;
    `make lint && make test && make build` green.
16. `/chats`, `/room`, the profile routes, and all §31–§33/§47 contracts
    outside the three changes are behavior-neutral.

#### 4.34.I Flags for the owner / concept (design report)

1. **DESIGN NOTE — wizardBack destination (§4.34.D):** the owner contract
   says only that `wizardBack` "currently round-trips /income?code=…"
   without naming the new target. Interpreted as the param-only
   `/income/<code>` (the intro route) since the wizard was entered from
   there; a straight `/income` would force re-entering the code. Reversible
   one-liner if the owner wants `/income` instead.
2. **DESIGN NOTE — resolve-success on /income navigates (§4.34.A):** the
   route map makes a successful auto-resolve NAVIGATE to the intro route
   rather than swap the preview card in place (the owner contract places
   the intro page on its own route, which leaves nothing for the in-card
   Step-2 to do). Recorded as the faithful reading of §48 item 2.
3. **DESIGN NOTE — create-route seeding adds one resolve round-trip
   (§4.34.D):** today the seeded shortcut builds the `Room` from the param
   without a call; the param is now a 6-digit code, so the resolve is
   unavoidable (the owner contract says so explicitly). The resolving
   treatment on the create route is the §4.34.C spinner contract applied
   to the create shell — flagged so the worker does not invent a skeleton.
4. **ADVICE NEEDED — none blocking:** no copy invented (zero-delta round),
   no new palette value, no new dependency; the three items are fully
   specified in §4.34.A–E.

### 4.35 feature amendment (2026-11-23, owner-approved Concept §49): auto-handshake opt-out (`active` flag) — `/profile` indicator + `/profile/settings` toggle

bleak-node's v2 backend added the persona field **`active`** (boolean,
`true` by default) — the server-side auto-matchmaking opt-out (backend
feature #36). Swagger facts this section reconciles against (read-only,
2026-11-23): `model.User.active` — *"Active users are matched by the
auto-matchmaking worker; the flag is true by default and togglable via the
user update endpoint."* and `server.UpdateUserRequest.active` — *"Active
opts the persona in/out of the auto-matchmaking worker (feature #36);
omitted keeps the current flag."*; the endpoint is the existing
**PUT `/api/room/{room}/user/{address}`** ("Updates name, bios and the
active flag … Omitted fields keep their value."). bleak-web exposes it as
(1) a read-only **indicator** on `/profile` and (2) the **first real
toggle-backed setting** on `/profile/settings`, labeled (adopted wording,
verbatim): EN **"Automatically send handshake"** / RU **«Отправлять
рукопожатия автоматически»**. Binding scope notes: default is `true`
(opt-out model — existing personas need NO migration), **no mocks** (real
reads and real writes through the real field only), RU/EN parity, no new
dependencies, all other §43/§4.29 contracts stay in force. Grounded in the
live code (read-only audit, 2026-11-23):
`packages/api-client/src/types.ts` (`User` lines 24–43 lacks `active`;
`UpdateUserRequest` lines 122–127 lacks `active`); the client method
`updateRoomUser` already exists; `apps/web/src/routes/profile/+page.svelte`
+ the badge component (identity block); `apps/web/src/routes/profile/settings/+page.svelte`
(Block 2 renders regardless of the entry-row load state).

#### 4.35.A api-client type reconciliation (FIRST)

1. **`User` gains `active: boolean` — REQUIRED** (no `?`), reconciled
   against swagger `model.User` (which always serializes it; `example:
   true`), positioned in the interface's field order among
   `address`/`created_at`/… (alphabetical, as generated). Doc comment
   verbatim from swagger: *"Active users are matched by the
   auto-matchmaking worker; the flag is true by default and togglable via
   the user update endpoint."* **Recorded divergence from the
   `mutual_code_live` precedent:** that flag was typed optional ONLY so
   existing web fixtures stayed source-compatible (types.ts lines 36–42);
   `active` is typed REQUIRED per this deliverable set, which makes every
   existing `User` fixture in the test suites gain `active: true` — a
   mechanical, compile-enforced sweep, and the honest shape (the server
   never omits it). No fallback "treat missing as active" client logic is
   written anywhere.
2. **`UpdateUserRequest` gains `active?: boolean`** — optional, comment
   verbatim from swagger: *"Active opts the persona in/out of the
   auto-matchmaking worker (feature #36); omitted keeps the current
   flag."* The interface's "omitted fields keep their value" contract
   (types.ts line 122) carries — this is exactly why a toggle can send
   `{ active }` alone.
3. **No client-shape changes beyond the two types.** The write path is the
   EXISTING `updateRoomUser` client method → PUT
   `/api/room/{room}/user/{address}` (Bearer auto-injected, §2.8 gate on
   401); no new method, no URL/serializer change, no version bump, no new
   dependency. Reads come from the existing `getRoomUser` (token-gated
   where the flag semantics require it — the indicator and the toggle both
   read the token-gated persona fetch).
4. **Default `true`, opt-out model, no migration:** the server defaults
   new and existing personas to active; the web app writes the flag only
   on an explicit user toggle and never "repairs" it.

#### 4.35.B `/profile` — the auto-handshake indicator (§4.29.A amendment)

**Placement — DECIDED: a muted status line in the identity block (A.4),
directly under the read-only language-meta line.** Rejected
alternatives (recorded): a fourth StatTile (the §2.2/§4.9.5 3-stat
contract is not extended by a behavior flag), and a tab-panel block (the
flag belongs to the identity, not to About/Interests/QR content). It is
an **indicator, NOT a control** — no interactive element, no edit
affordance (the page stays READ-ONLY, §4.29.A; the control lives on
`/profile/settings`, §4.35.C).

- **Component spec:** plain text line inside the existing identity column
  (the badge component's identity section) — no new component. 14px
  `--font-body` regular, `--color-text-muted`, centered with the column,
  `gap: var(--space-1)` under the meta line, `overflow-wrap: anywhere`
  (same wrap rule as the name, A.4). Leading inline `PixelIcon`
  **`status-active`** (existing glyph — NO new glyph, §4.29.D record
  stands), 16px, muted, `aria-hidden`. Copy: the composed pair
  `profile.auto_handshake.label` + ": " + `profile.auto_handshake.on|off`
  — EN "Auto-handshake: on"/"Auto-handshake: off", RU «Авто-рукопожатия:
  вкл.»/«Авто-рукопожатия: выкл.». Accent discipline (§4.3): the line is
  muted in BOTH states — the state word carries the meaning; no accent
  fill (the identity block's only accent stays the avatar backdrop).
- **Data source — server state only:** the line renders from the
  server-provided `user.active` of the EXISTING token-gated `getRoomUser`
  persona fetch (the §6.3 4 s poll already re-fetches the persona; the
  indicator re-renders with it). **Both `true` and `false` must render**
  — the line is present whenever `user` is present; there is NO
  local-only/optimistic state on this page, and no write path exists
  here. NO new fetch and NO new poller are introduced (§4.29.F.4 cadences
  unchanged).
- **States:** loading → the line is absent (the existing identity
  skeleton shape covers it; no separate skeleton node is added — the
  skeleton stays as-is); load/API error → the existing `ErrorBanner` +
  retry path (line absent); persona 404 → the existing not-found card
  verbatim.
- **Accessibility:** the line is plain readable text (both words in one
  text node order — it announces as a full pair, the stat-tile reading
  pattern); the glyph is `aria-hidden`; no live region is added (it is
  not an async status; rotation notes and the existing live regions
  carry). Focus is never involved (non-interactive).
- **Contract guards:** the A.4 identity-block composition becomes
  avatar → name → language meta → **auto-handshake line** (last); A.1
  header buttons, A.5 stats row, A.6 pill tabs, A.7 tab semantics, A.8
  states, A.9 responsive (the line wraps within the centered column at
  320/360/390px) and the §6.3 live-QR mechanics are UNTOUCHED.

#### 4.35.C `/profile/settings` — the auto-handshake toggle row (§4.29.B amendment)

**Placement — DECIDED: the FIRST row of Block 2 (app settings), above the
Language row.** Rationale: the token-rotation row stays LAST in the block
so its `rotatedFlash`/`rotateError` lines remain directly under their row
(§4.29.B.3.2) — appending the toggle after rotation would interleave a
row between the rotation row and its messages. Block 2 row order after
this rev: **(1) auto-handshake toggle, (2) Language (inline
`LocaleControl`), (3) token-rotation.** Blocks 1/3 (entry row; leave
button) untouched.

**Row anatomy (B.2 carried):** min-height 48px; leading 16px `PixelIcon`
**`status-active`** (muted — a suitable glyph exists; no new glyph);
label left (`--font-body` 15px/600, `--color-text`) =
`profile.auto_handshake.row` — EN **"Automatically send handshake"** /
RU **«Отправлять рукопожатия автоматически»** (adopted wording, verbatim
— Concept §49); trailing control = the switch; 1px
`--color-surface-elevated` divider between rows; `.pixel-corners` stays
on the Block card, never on the row's control.

**Switch control spec (the design system has no switch component —
recorded):**

- A real native **`<input type="checkbox" role="switch">`** (never a
  div-toggle — §2.6 "real buttons/controls"), visually styled as a
  ~40×24px pill track centered in a `--touch-target` (48×48px) hit area.
  Tokens only: **ON** = track `--color-accent`, knob `--color-accent-ink`;
  **OFF** = track transparent with a 1px `--color-text-disabled-strong`
  border, knob `--color-text-muted`. No new palette value, no new token;
  the pill is smooth (§4.5 — pills never `.pixel-corners`).
- The visible label is the row label, associated via `label[for]` —
  activating the label toggles too; the row itself is not a giant button
  (the divider grid and the icon stay non-interactive).
- **Keyboard & a11y (§2.6):** space toggles the focused switch (native
  checkbox behavior); `aria-checked` always mirrors the CURRENT state;
  the `:focus-visible` accent outline is never removed; hit target ≥
  48px.
- **Mount state:** seeded from the EXISTING §4.29.B.5 `getRoomUser`
  mount fetch (`user.active`) — no extra fetch, no poller. While the
  persona record loads, the control renders **disabled** (no fake
  default — the server truth is unknown until the fetch); a load error
  keeps it disabled behind the existing `ErrorBanner` + retry, and a
  successful retry seeds it.
- **Toggle semantics — optimistic update + revert-on-error (the
  acceptable pattern; no optimistic-only fake state):** on change, flip
  the visible state immediately and call
  `updateRoomUser(id.roomAddress, id.userAddress, { active: next })` —
  the body carries **ONLY `active`** (name/public_bio/private_bio
  omitted; omitted fields keep their value per the PUT contract). While
  in flight the control is disabled (double-toggle impossible; one
  toggle at a time). **Success:** the state stands and now matches the
  server — the control IS the feedback, so NO «Сохранено» flash fires
  for this row (recorded; differs from the editor flow's flash, C.5).
  **Error:** an inline error line renders UNDER the row —
  `role="alert"` (the rotation-row pattern, §4.29.B.3.2) — with the
  server text via the existing `serverText` mapping; `NetworkError` →
  the existing `common.error.network`; **401 → the §2.8 global gate**
  (never handled locally); and the switch **REVERTS to the last
  server-truth value** (the mount value, or the last successfully
  applied toggle). No silent failure, no stale fake state; a re-toggle
  after a failure re-issues the PUT.
- **Reduced motion:** the knob/track transition is the 120 ms
  color/transform pattern (§2.5/§4.6) and is INSTANT under
  `prefers-reduced-motion: reduce`.
- **Contract guards:** B.1 chrome, B.2's FAQ/Terms clause (still nothing
  invented), B.3.1 entry row, B.3.2 language + rotation rows (copy,
  dialog, vault writes), B.3.3 leave button, B.5 (the mount fetch IS the
  seed source), B.6 responsive, B.7 accessibility all carry; only B.2's
  toggle clause and B.3's Block 2 row list change (below).

#### 4.35.D Supersessions (explicit record) — dated 2026-11-23

1. **§4.29.B.2's "No toggle rows" clause SUPERSEDED** (owner-approved
   Concept §49): the app now HAS its first real toggle-backed setting —
   the §4.35.C row. The SAME sentence's "no FAQ/Terms/policy rows"
   clause CARRIES unchanged (still nothing invented there).
2. **§4.29.H item 17 ("Settings contains NO persona-edit rows and NO
   toggle rows") AMENDED:** persona-edit rows remain absent; the
   no-toggle half is superseded by the §4.35.C row.
3. **§4.29.I decision 4 — partially superseded:** the grouping record
   (two blocks + bottom leave button; Language inline, no sub-page)
   carries; its "no toggle rows" parenthetical is superseded.
4. **§4.29.I decision 7 ("No toggle rows: no real toggle-backed setting
   exists") SUPERSEDED** — it described the pre-§49 state truthfully and
   is now historical.
5. **§4.29.A.4 AMENDED:** the identity block gains the auto-handshake
   status line as its final element (§4.35.B). A.1/A.5/A.6/A.7–A.10
   carry.
6. Carried unchanged: §4.29.B otherwise, §4.29.C (/profile/edit), D–I
   otherwise; §4.29.F.4 polling cadences; §43 scope (all §43 profile
   contracts stay in force outside this flag); §2.2, §2.6, §2.8.

#### 4.35.E i18n delta (both dictionaries; RU/EN parity CI-enforced)

**New keys (4).** The row label is the ADOPTED wording (Concept §49 —
owner-owned, not a design invention); the other three are design
inventions for tone ratification (standing precedent, §4.29.I-14):

| Key | RU | EN |
| --- | --- | --- |
| `profile.auto_handshake.row` | «Отправлять рукопожатия автоматически» | "Automatically send handshake" |
| `profile.auto_handshake.label` | «Авто-рукопожатия» | "Auto-handshake" |
| `profile.auto_handshake.on` | «вкл.» | "on" |
| `profile.auto_handshake.off` | «выкл.» | "off" |

Composed strings (assembled in markup, keys above): the `/profile`
indicator reads "Auto-handshake: on" / «Авто-рукопожатия: вкл.» (and the
off pair); the settings row renders `profile.auto_handshake.row`
verbatim in both locales. **No value edits, no retired keys, zero
reuse-of-convenience:** `profile.saved`, `common.error.network`,
`common.locale` etc. are reused unchanged where named. Net per
dictionary: **+4**; the `i18n.test.ts` per-dictionary count assertions
update to the new count.

#### 4.35.F Acceptance criteria (checkable)

api-client:

1. The `User` interface declares required `active: boolean` — reconciled
   against swagger `model.User.active` with the verbatim description; a
   missing `active` in any `User` literal is a compile error.
2. `UpdateUserRequest` declares optional `active?: boolean` — reconciled
   against swagger `server.UpdateUserRequest.active`.
3. `updateRoomUser` is unchanged in signature/URL; a `{ active }` patch
   serializes a PUT `/api/room/{room}/user/{address}` body containing
   ONLY `active` (the existing omitted-field tests stay green).

web — `/profile` indicator:

4. Via the established mocked-fetch seam (`vi.mock('#lib/api/client')` —
   the API layer, NOT a UI mock): a persona fixture with `active: true`
   renders the indicator as the on-state pair ("Auto-handshake: on" /
   «Авто-рукопожатия: вкл.»); `active: false` renders the off-state
   pair; BOTH fixtures asserted in the profile-page suite.
5. The indicator is non-interactive (no button/link/input in its DOM),
   renders for both states from the server value only (no local write
   path on the page), and the existing §4.29.A contracts stay green
   (identity block, stats row, pill tabs, header buttons, live-QR
   rotation mechanics).

web — `/profile/settings` toggle row:

6. Block 2 contains the toggle row labeled exactly EN "Automatically
   send handshake" / RU «Отправлять рукопожатия автоматически» — both
   locale renderings asserted (parity), placed as the FIRST row of
   Block 2.
7. On mount the switch reflects `user.active` from the mocked
   `getRoomUser` (true and false both tested); no API call beyond the
   existing mount fetch is issued for the row (no poller).
8. Toggling issues `updateRoomUser` with the payload `{ active: bool }`
   and nothing else; while in flight the control is disabled.
9. Rejecting the toggle (mocked rejection) renders the inline error
   line with `role="alert"` and the switch state REVERTS to the
   pre-toggle server value; a subsequent toggle re-issues the PUT.
10. The control is a real checkbox with `role="switch"`: space toggles
    it, `aria-checked` mirrors the current state, the hit target is ≥
    48px, and the transition is instant under
    `prefers-reduced-motion: reduce`.

cross-cutting:

11. Exactly the four §4.35.E keys are added to BOTH dictionaries (RU/EN
    parity + per-dictionary count assertions green); `i18n.test.ts`,
    `profile-page`, `profile-settings`, `profile-edit` and `sweep`
    suites stay green; `make lint && make test && make build` green.
12. No new dependency, no new glyph (`status-active` reused in both
    surfaces), no new token/palette value; default `true` needs no
    migration — existing personas and fixtures behave unchanged apart
    from the mechanical fixture `active: true` sweep.

#### 4.35.G Flags for the owner / concept (design report)

1. **DESIGN NOTE — indicator placement (§4.35.B):** a status line under
   the language meta in the identity block was chosen over a StatTile or
   a tab-panel block; reversible one-liner if the owner prefers a
   tile/row treatment.
2. **DESIGN NOTE — Block 2 row order (§4.35.C):** the toggle is placed
   FIRST so the token-rotation row stays last with its flash/error lines
   directly beneath it; reversible.
3. **DESIGN NOTE — no «Saved» flash on the toggle:** the switch is its
   own feedback (success = the state stands); the flash stays bound to
   the editor flows. A flash could be added if the owner wants audible
   parity with the editors.
4. **RU copy ratification:** `profile.auto_handshake.row` is the owner's
   adopted wording (verbatim); «Авто-рукопожатия», «вкл.», «выкл.» are
   design inventions for tone ratification (standing precedent).
5. **ADVICE NEEDED — none blocking:** the api-client shape, both
   surfaces, the toggle semantics and the copy are fully specified in
   §4.35.A–E; no palette value, dependency or glyph decision is open.

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
