# bleak-web — Product Design (v1)

Design instance: `fd19a963` (2026-11-14). Authority chain: `docs/Concept.md`
(owner-approved v1, §1/§2/§4/§4b binding) → `docs/ARCHITECTURE.md` (routes,
tokens, polling, mocked shapes) → this document. API contract:
`/mount/bleak-node/docs/swagger.json` (bleak-node v0.1.0). Visual brief: the
three reference images in `docs/refs/` (patterns binding, re-styled into the
dark pixel palette of Concept §4).

This document is self-contained: a worker must be able to implement any page
from its section alone without reading the references.

---

## 0. Product summary (one paragraph)

bleak-web v1 is a live event-networking app. An attendee scans a QR / enters a
6-digit invite code, lands in the event **room**, creates (or imports) a
**persona** — an agent defined by a greeting and bios — browses other
attendees, sends **handshakes**; when a handshake is mutual, bleak-node
auto-creates a **chat** and the two attendees' agents hold a conversation which
both attendees read live. The event **host** creates the room with a host
token, receives the QR + invite code to share, and observes the room. The SPA
is a thin, contract-driven client of bleak-node; the only component we own
server-side is the invite-code helper (§ ARCHITECTURE 6).

---

## 1. Sitemap & navigation model

### 1.1 Routes

| Route | File (SvelteKit) | Audience | Tab bar? | Purpose |
| --- | --- | --- | --- | --- |
| `/` | `routes/+page.svelte` | attendee | no | Join by 6-digit code / deep link → persona creation (new or imported) |
| `/room` | `routes/room/+page.svelte` | attendee | yes | Radar "Around me" — live spatial view of the room |
| `/people` | `routes/people/+page.svelte` | attendee | yes | Full attendee list, search, filters, handshake actions |
| `/chats` | `routes/chats/+page.svelte` | attendee | yes | List of agent dialogs (mutual handshakes) |
| `/chats/[address]` | `routes/chats/[address]/+page.svelte` | attendee | no | Dialog transcript (read-only) + kickoff |
| `/profile` | `routes/profile/+page.svelte` | attendee | yes | Persona badge card, editing, stats, locale, leave room |
| `/host` | `routes/host/+page.svelte` | host | yes* | Host console: token, create room, QR/code share, live room view |

*The Host tab is always visible in the tab bar (an attendee may also be the
host); the host page itself never requires an attendee identity.

Parameterized routes: only `/chats/[address]` — `address` is a chat address
(`0xchat123`-style string from `ChatResponse.address`).

Deep link: `/` accepts `/?code=NNNNNN` (this is what the host's QR encodes,
via `INVITE_URL_BASE`). Unknown/absent `code` → normal manual entry state.

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
| `/profile` | none (fetch on mount + after mutations) | — |
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

---

## 3. Pages

Each section below is complete on its own. Data fields are named exactly as in
swagger.json (`User.name`, `Handshake.status`, `ChatResponse.phase`, …).

### 3.1 `/` — Join

**Purpose.** Get a non-technical attendee from "I have a code / QR" to "I am in
the room with my persona" in under 60 seconds, on a phone, over bad Wi-Fi.
This is the conversion screen; every extra field costs attendees.

**Primary jobs.**
1. Enter or deep-link a 6-digit invite code and resolve it to a room.
2. Create a persona in that room — or import one from a previous event's room.
3. Land on `/room` with identity saved.

**API endpoints used.**

| Step | Endpoint (client method) | Notes |
| --- | --- | --- |
| Resolve code | helper `GET /h/rooms/{code}` (`resolveInvite`) | 400 malformed / 404 unknown |
| Room preview | `GET /api/room/{address}` (`getRoom`) | name, description, language, max_user |
| Member count | `GET /api/room/{room}/user` (`listRoomUsers`) | length only |
| Create persona | `POST /api/room/{room}/user` (`createRoomUser`) | name, public_bio, private_bio |
| Room picker (import) | `GET /api/room` (`listRooms`) | all non-deleted rooms |
| Read old persona (import) | `GET /api/room/{room}/user/{address}` (`getRoomUser`) | client-side copy source |
| Count members of old room (import) | `GET /api/room/{room}/user` (`listRoomUsers`) | to list personas |

**Layout (mobile-first, single column, max-width 480px centered).**
No tab bar. Regions top→bottom:
1. **Header**: pixel logo mark + wordmark "bleak-web" (Handjet), centered,
   generous top spacing (`--space-7`).
2. **Step 1 — code entry card** (`--color-surface`, `.pixel-corners`):
   - Title «Войти на событие» / "Join the event" (h1, Handjet).
   - Subtitle: «Введите 6-значный код приглашения с QR-кода или из приглашения.»
     / "Enter the 6-digit invite code from the QR or the invitation."
   - `DigitInput`: six single-character cells, large (56px), Inter 24px,
     numeric `inputmode`, paste-support, auto-advance, backspace-retreat;
     invalid chars rejected silently; when 6 digits present the CTA enables.
   - CTA «Войти в комнату» / "Enter the room" (pill, accent) — disabled until
     6 digits.
   - Deep link: `?code=NNNNNN` prefills the cells and auto-submits.
   - Footer row: locale `SegmentedControl` RU | EN (bottom-left of the card).
3. **Step 2 — room card**: after resolution the card content swaps to the room
   preview: room `name` (Handjet), `description`, a meta row «Язык агентов:
   ru · Участников: 12» / "Agent language: ru · Members: 12" (`language`,
   member count vs `max_user`). Two stacked options:
   - Primary CTA «Создать персону» / "Create persona".
   - Secondary (pill outline) «Импортировать из прошлого события» / "Import
     from a previous event".
   - Small link-button «Изменить код» / "Change code" → back to Step 1.
4. **Step 3a — persona form** (replaces options, same card): `name` (required,
   ≤ 64 chars), `public_bio` (optional, «Кто вы — увидят другие» / "What others
   see"), `private_bio` (optional, «Только для вашего агента» / "For your agent
   only"). Submit CTA «Войти в комнату». After 201 → `saveIdentity`,
   navigate `/room`.
5. **Step 3b — import flow**: a room picker list (from `listRooms`, each row:
   room `name` + member count) → persona list of that room (rows: pixel
   avatar-by-address, `User.name`, `public_bio`) → tap one → prefills the
   persona form (fields from `getRoomUser`) with a notice «Персона будет
   скопирована в это событие» / "The persona will be copied into this event"
   → same submit as 3a. Import is a client-side copy (architecture §8.4) —
   it creates a NEW user in the new room.

**Interaction states.**

| State | Rendering |
| --- | --- |
| Resolving code | CTA shows inline spinner, disabled; skeleton not used (single action) |
| Code 404 (helper) | Inline field error under cells, RU «Код не найден — уточните его у организатора.» / "Code not found — check with the host." Cells shake once (120 ms) unless reduced motion |
| Code malformed (400) | Same style, copy «Код должен быть 6 цифр.» / "The code must be 6 digits." |
| `NetworkError` | `ErrorBanner` per §2.1; entered code preserved |
| Persona submit 400 (e.g. name empty) | Field-level error from server text |
| Persona submit 409 | RU «Такое имя в комнате уже занято.» / "That name is already taken in the room." (server conflict surfaced) |
| Room deleted meanwhile (404 on `getRoom`/`createRoomUser`) | Card error state: «Событие больше не доступно.» / "This event is no longer available." + back to Step 1 |

**Responsive.** Phone-first single column. ≥ 720px: card stays 480px, centered
vertically; background remains `--color-bg` (no split layout — the join is a
mobile ritual).

**Accessibility.** The six digit cells are one labelled group
(`aria-label` «Код приглашения»); each cell has `aria-label` "цифра N".
Error text is announced via `aria-live="polite"`. Focus moves to the room card
title after successful resolution.

**Acceptance criteria.**
1. With no identity, opening `/` shows the code entry card and no tab bar.
2. Entering a valid 6-digit code and submitting resolves it via
   `GET /h/rooms/{code}` and shows the room preview (room `name`,
   `description`, `language`, member count) without a full page reload.
3. Opening `/?code=NNNNNN` (valid code) auto-fills the six cells and submits
   automatically.
4. An unknown code shows the 404 copy «Код не найден — уточните его у
   организатора.» inline, keeps the digits entered, and does not navigate.
5. When the helper is unreachable, the NetworkError banner (§2.1 copy) appears
   and the entered code survives.
6. "Create persona" reveals the form; submitting with an empty `name` is
   prevented client-side and shows the field error.
7. A successful `POST /api/room/{room}/user` saves `{ roomAddress, userAddress }`
   to `localStorage` (`bleak.identity`) and navigates to `/room`.
8. "Import from a previous event" lists rooms from `GET /api/room`, then that
   room's personas, and pre-fills the persona form from the selected user;
   submitting creates a NEW user via `POST /api/room/{room}/user` (no
   `address` reuse).
9. With an existing identity, `/` shows the resume card with the room name and
   a working "join another event" action that clears identity.
10. The RU|EN segmented control switches all visible strings on this page and
    persists across reloads.
11. All six digit cells are keyboard-reachable; paste of a 6-digit string fills
    all cells.

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
| `GET /api/room/{address}` (`getRoom`) — once per mount | room `name` for header |
| `GET /api/room/{room}/user` (`listRoomUsers`) — 4 s poll | attendees: `address`, `name`, `public_bio`, `created_at` |
| `GET /api/handshake/user/{address}` (`listHandshakesOfUser`) — 4 s poll | my handshakes: `from_address`, `to_address`, `created_at`, `status` |
| `GET /api/user/{address}/chat` (`listChatsOfUser`) — with each poll tick | which counterparts already have a chat |
| `POST /api/handshake` (`createHandshake`) | on user action: `{ from_address, to_address, status: 1 }` |

**Layout (mobile-first, full-bleed).**
1. **Top bar** (fixed, `--color-surface`, 56px): left — room `name` (Handjet,
   truncated); right — a muted live-dot (pulsing accent dot while the poller is
   healthy; solid muted when in error/backoff) + member count «12».
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
    `POST /api/handshake`; on 201/200 the button morphs to «Хендшейк отправлен»
    / "Handshake sent" (accent-filled) and the avatar moves to the middle ring
    on the next poll tick (also force `refresh()` immediately).
  - outgoing only: button disabled-labeled «Хендшейк отправлен — ждём ответа» /
    "Handshake sent — waiting for theirs".
  - incoming only: pill «Добавил вас» / "Added you" + CTA «Ответить
    хендшейком» / "Handshake back" → `POST /api/handshake` (reverse direction);
    when mutual, bleak-node creates the chat — after success the sheet shows
    «Агенты уже общаются» / "Your agents are already talking" with a link
    «Открыть диалог» / "Open dialog" → the counterpart's chat.
  - mutual/chat exists: CTA «Открыть диалог» / "Open dialog" → `/chats`.
- `NetworkError` during a handshake POST → inline error in the sheet, button
  returns to active state.
- Poll diffing: a user who left (soft-deleted) disappears from the radar on the
  next tick.

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
   address and moves the node to the middle ring within one refresh.
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

---

### 3.3 `/people` — Attendee list

**Purpose.** The complete, scannable roster (reference `design-concept.png`,
middle screen): every attendee as a stacked card with their state, plus
search and status filters. The canonical, accessible list backing the radar.

**API endpoints used.** Same as `/room` (§3.2) — `listRoomUsers` +
`listHandshakesOfUser` + `listChatsOfUser` on a 4 s poll; `POST /api/handshake`
on action.

**Layout (mobile-first, single column).**
1. **Header**: h1 «Люди» / "People" (Handjet) + member count muted; below it a
   search input (surface, pill, 48px, placeholder RU «Поиск по имени или био…»
   / "Search by name or bio…") — filters client-side on `name` and
   `public_bio`, debounced 150 ms.
2. **Filter chips row** (horizontal scroll, `SegmentedControl`-style pills on
   `--color-surface-elevated` track): Все / All · Отправлены / Sent · Добавили
   вас / Added you · Общаемся / Chatting. Single-select; active pill =
   accent. (Interest filters are impossible in v1 — interests are a local-only
   mock; see §6 flags.)
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
       without opening the sheet; on success the card flips to the
       outgoing-pill state (in-place, no reorder).
     - incoming pending → the card expands in place to reveal two buttons:
       «Ответить хендшейком» / "Handshake back" (accent) and «Закрыть» /
       "Dismiss" (outline — collapses the card only; there is no API decline,
       see §6 flags). This is the reference's "Added you" Accept/Decline
       pattern adapted: **Accept = handshake back; Decline = just closing the
       card** (nothing is sent to the server).
     - mutual → icon-button ▤ with `aria-label` «Открыть диалог с Алисой» /
       "Open dialog with Alice" → `/chats/{chat.address}`.
4. Cards are keyed by `User.address`; poll updates mutate in place; **no
   reordering on poll** (order = stable: newest `created_at` first, computed
   once per data change that actually differs).

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
6. "Dismiss" only collapses the card and sends nothing to the server.
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

---

### 3.4 `/chats` — Dialog list

**Purpose.** The attendee's inbox of agent conversations (what the reference
labels "Activity"): every mutual handshake has produced a chat; this screen
lists them and leads into transcripts. It also explains the mechanic when
empty.

**API endpoints used.**

| Endpoint (client method) | Data used |
| --- | --- |
| `GET /api/user/{address}/chat` (`listChatsOfUser`) — 4 s poll | chats: `address`, `phase`, `scenario`, `language`, `created_at`, `participants` |
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
     poll — too heavy on venue Wi-Fi; flagged §6).
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
1. `/chats` renders one card per chat from `listChatsOfUser`, showing the
   counterpart's name and avatar, and verbatim `phase` and `scenario` chips.
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
(kickoff) if wanted. **Read-only for humans in v1** — the agents are the
speakers (flagged §6; `POST /api/message` exists but is out of the v1 owner
flow).

**Route parameter.** `address` — chat address; unknown/404 → full-page not-found
state (§ below).

**API endpoints used.**

| Endpoint (client method) | Cadence | Data used |
| --- | --- | --- |
| `GET /api/chat/{address}` (`getChat`) | on mount + when participants of a poll differ | `phase`, `scenario`, `language`, `participants`, `created_at` |
| `GET /api/chat/{address}/message` (`listChatMessages`) | 2 s poll | messages: `from`, `to`, `content`, `created_at`, `tx_id` |
| `POST /api/chat/{address}/kickoff` (`kickoffChat`) | on user action | response: `chat`, `cleared`, `speaker` |

**Layout (mobile-first).**
1. **Header** (fixed top, 56px, `--color-surface`, `.pixel-corners` bottom
   edge): back icon-button (48px, `aria-label` «Назад» / "Back"); counterpart
   avatar (32px) + counterpart `User.name`; second line: chips `phase` +
   `scenario` + `language` (muted, 11px).
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
   `POST /api/chat/{address}/kickoff`, after which the transcript clears and
   the «Первым говорит {name}» note is shown.
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

---

### 3.6 `/profile` — Persona badge

**Purpose.** The attendee's own persona card (reference `design-concept.png`,
left screen — the "event badge" re-styled): identity, greeting, bios,
interests (mock), stats; plus the editing surface and the locale switch, and
the exit door.

**API endpoints used.**

| Endpoint (client method) | Data / use |
| --- | --- |
| `GET /api/room/{room}/user/{address}` (`getRoomUser`) | on mount: `name`, `greeting`, `public_bio`, `private_bio`, `language`, `created_at` |
| `GET /api/room/{room}/user/{address}/greeting` (`getUserGreeting`) | canonical greeting for the editor |
| `PUT /api/room/{room}/user/{address}/greeting` (`putUserGreeting`) | save edited greeting |
| `POST /api/room/{room}/user/{address}/greeting/regenerate` (`regenerateGreeting`) | regenerate from bios |
| `PUT /api/room/{room}/user/{address}` (`updateRoomUser`) | save name / public_bio / private_bio |
| `GET /api/handshake/user/{address}` (`listHandshakesOfUser`) | stats: sent vs received counts |
| `GET /api/user/{address}/chat` (`listChatsOfUser`) | stat: dialogs count |
| `DELETE /api/room/{room}/user/{address}` (`deleteRoomUser`) | "Leave room" |

**Layout (mobile-first, single column).**
1. **Header**: h1 «Профиль» / "Profile".
2. **Badge card** (the persona badge, reference pattern; `--color-surface`,
   `.pixel-corners`, generous padding):
   - Top row: `PixelAvatar` 96px (accent backdrop — own persona) + big
     `User.name` (Handjet 28px) + muted `User.language` meta («Язык агента:
     ru» / "Agent language: ru" — **read-only**; `language` cannot be set via
     the API, flagged §6).
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
   - **Leave room**: destructive row «Выйти из комнаты» / "Leave the room" →
     `ConfirmDialog`: RU «Ваша персона будет удалена из комнаты вместе с
     хендшейками и диалогами.» / "Your persona will be removed from the room
     along with its handshakes and dialogs." Confirm → `DELETE …/user/{address}`
     → `clearIdentity()` → navigate `/`. On error (e.g. server rule blocks the
     delete): inline error with the server text, identity kept.

**States.**
- Loading: skeleton badge card (avatar circle + 3 text bars + 2 stat tiles).
- Error: `ErrorBanner`; if the initial `getRoomUser` 404s (persona deleted
  elsewhere): full-card state «Персона не найдена» / "Persona not found" +
  button «Выйти» / "Leave" that just clears identity → `/`.
- Mutation pending: the affected CTA shows a spinner; double-submit prevented.
- Success feedback: a transient inline check (no toasts system in v1; the
  edited value simply renders).

**Responsive.** ≥ 720px: badge card max-width 560px centered; stat tiles grow
into a row of three (add «Добавили вас {n}» / "Added you {n}" from the
handshake list when there is room).

**Accessibility.** Stat numerals have accessible names («Хендшейков: 7» /
"Handshakes: 7"). The greeting textarea has a permanent visible label. The
disabled Save state is `aria-disabled` with the reason in the error line
(`aria-live="polite"`).

**Acceptance criteria.**
1. `/profile` renders the badge card with the user's `name`, `greeting`,
   `public_bio`, `private_bio`, read-only `language`, mock interest chips, and
   the two stat tiles computed from the handshake and chat lists.
2. The persona editor saves all three fields via `PUT
   /api/room/{room}/user/{address}` and the card reflects the new values.
3. The greeting editor blocks saving when the text contains `?`, showing the
   specified rule copy, and saves via `PUT …/greeting` otherwise.
4. "Regenerate" calls the regenerate endpoint and replaces the editor content
   without saving until Save is pressed.
5. Interest chips come from the client-side mock store (`localStorage
   bleak.interests`) using the `Interest {id, label, emoji}` shape; editing
   them never issues a network request.
6. The RU|EN segmented control switches the UI language app-wide and
   persists.
7. "Leave the room" confirms, calls `DELETE
   /api/room/{room}/user/{address}`, clears `bleak.identity`, and navigates
   to `/`.
8. If the persona is gone (404), the card shows the not-found state and the
   exit path works.
9. Stat tiles announce full values to screen readers («Хендшейков: 7»).
10. No hardcoded colors are used; all surfaces derive from the tokens.

---

### 3.7 `/host` — Host console

**Purpose.** The event host's tool: enter the host token, create the event
room, receive the share kit (QR + 6-digit code + invite link), and watch the
room live. Desktop-comfortable (the only page designed desktop-first), but
fully usable on a phone.

**API endpoints used.**

| Endpoint (client method) | Use |
| --- | --- |
| helper `POST /h/rooms` (`createRoom`, header `x-host-token`) | create room; returns `{ room, code, invite_url }` |
| helper `GET /h/rooms/{code}/qr` (`inviteQrUrl`) | QR image (PNG 512px) for the share kit |
| `GET /api/room/{address}` (`getRoom`) | room details for the live view |
| `GET /api/room/{room}/user` (`listRoomUsers`) — 5 s poll | live member list |
| `GET /api/handshake/user/{address}` (`listHandshakesOfUser`) | per-member drill-down (on demand) |
| `GET /api/room/{room}/user/{address}/chat` (`listChatsOfRoomUser`) | per-member drill-down (on demand) |
| `PUT /api/room/{address}` (`updateRoom`) | room settings (name, description) |
| `DELETE /api/room/{address}` (`deleteRoom`) | end the event |

**Layout.**
Phone: single column. Desktop (≥ 900px): two columns — left column the share
kit, right column the live room view; max-width 1080px centered.

1. **Header**: h1 «Хост» / "Host" + subtitle RU «Создайте комнату события и
   поделитесь приглашением.» / "Create the event room and share the invite."
2. **Token gate** (shown when no token is stored): `--color-surface` card with
   a password-type input (label «Токен хоста» / "Host token", masked,
   48px) + CTA «Продолжить» / "Continue". The token is validated lazily (on
   first create; there is no validate endpoint) and persisted in `localStorage`
   (`bleak.hostToken`), clearable via a small «Забыть токен» / "Forget token"
   link. Copy note RU «Токен выдаётся владельцем развертывания.» / "The token
   is issued by the deployment owner."
3. **Create room form** (card): `name` (required), `description` (optional),
   `language` select (ru | en; this sets the agents' conversation language —
   `CreateRoomRequest.language`). CTA «Создать комнату» / "Create room".
   (`max_user` is **not** in `CreateRoomRequest` — not settable; flagged §6.)
4. **Share kit** (after creation; also restored on revisit via
   `localStorage bleak.hostRoom` = last created code + address):
   - Big code display: 6-digit `code` in Handjet 40px, letter-spaced, on a
     surface card with a «Скопировать» / "Copy" chip (writes the digits).
   - **QR block**: `inviteQrUrl(code)` `<img>` (256px on phone, 320px desktop;
     alt «QR-код приглашения» / "Invite QR code"), pixel-cornered white
     padding frame (the helper renders charcoal-on-light).
   - Invite link row: truncated `invite_url` + copy icon-button.
   - CTA «Присоединиться как участник» / "Join as attendee" → runs the `/`
     join flow with this code (navigates to `/?code={code}`).
   - Link «Создать другую комнату» / "Create another room" → back to the form.
5. **Live room view** (poll 5 s):
   - Summary tiles: «Участники {n}/{max_user}» / "Members {n}/{max_user}"
     (from `listRoomUsers.length` and `getRoom.max_user`), «Язык {language}» /
     "Language {language}".
   - **Member list**: rows (avatar, `User.name`, joined time from
     `created_at`); each row tap → **member drill-down sheet** (on-demand
     fetches, not polled): handshake counts sent/received
     (`listHandshakesOfUser` of that member — counts by `from_address`
     direction) and their dialogs (`listChatsOfRoomUser` — rows link to
     read-only `/chats/{address}`; the host may observe any transcript).
   - **Room settings** (collapsible): edit `name`/`description` →
     `PUT updateRoom`; danger zone «Удалить комнату» / "Delete room" →
     confirm → `DELETE` → clears `bleak.hostRoom`, returns to the create
     form. Copy warning RU «Комната будет удалена вместе со всеми
     участниками.» / "The room will be deleted with all its members."

**States.**
- Token wrong (helper 401/403 on create): error under the token field RU
  «Токен отклонён.» / "Token rejected." (server text appended if present).
- Create 400/409: field error from server text (e.g. duplicate name →
  «Комната с таким именем уже есть» surfaced from server body).
- Create pending: CTA spinner; form disabled.
- Live view empty (no members): «Пока никто не присоединился.» / "Nobody has
  joined yet."
- Live view error: `ErrorBanner`; stale list dimmed.
- Drill-down fetch failure: inline muted error inside the sheet with retry.
- `getRoom` 404 (room deleted elsewhere): full-section state «Комната
  удалена.» / "The room was deleted." + reset to create form.

**Responsive.** ≥ 900px two-column as above; the QR and code stay in the left
column (sticky), the live view scrolls on the right.

**Accessibility.** Token input is `type="password"` with autocomplete off; the
code display has `aria-label` with the digits spelled («Код: 1 2 3 4 5 6»).
Drill-down sheets trap focus; the danger zone is separated with a visible
warning heading.

**Acceptance criteria.**
1. Without a stored token, `/host` shows the token gate; the token persists in
   `localStorage` after entry and the gate does not reappear.
2. Creating a room calls helper `POST /h/rooms` with the `x-host-token` header
   and shows the share kit: 6-digit `code` (Handjet), QR `<img>` from
   `GET /h/rooms/{code}/qr`, and the copyable `invite_url`.
3. The QR `<img>` and invite link render for the created code, and both
   copy actions write the correct values to the clipboard.
4. Revisiting `/host` with a stored `bleak.hostRoom` restores the share kit of
   the last created room without re-creating anything.
5. "Join as attendee" navigates to `/?code={code}` (the deep-link flow of
   §3.1 takes over).
6. The live view polls members every 5 s; the members tile shows
   `listRoomUsers.length` against `getRoom.max_user`.
7. Tapping a member opens the drill-down sheet showing that member's
   sent/received handshake counts and dialogs, fetched on demand; dialog rows
   link to `/chats/{address}`.
8. Room settings save via `PUT /api/room/{address}` and reflect immediately;
   "Delete room" confirms, calls `DELETE`, clears the stored room, and returns
   to the create form.
9. A rejected token shows «Токен отклонён.» under the field and keeps the
   entered value masked.
10. When no one has joined, the live view shows the empty copy.
11. On a ≥ 900px viewport the page lays out in two columns with the share kit
    sticky on the left.
12. Deleting the room while the live view is open ends in the «Комната
    удалена.» state (either via the drill-down of a 404 or the delete action).

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
| `HandshakeSheet` | `/room`, `/people` | bottom sheet; single source of handshake actions |
| `PersonCard` | `/people` | state pill + inline actions + expandable incoming state |
| `ChatCard` | `/chats` | counterpart + `phase`/`scenario` chips |
| `MessageBubble` | `/chats/[address]` | pixel-cornered, mine/theirs variants |
| `ConfirmDialog` | kickoff, leave room, delete room | focus trap, Escape closes |
| `ContactStub` | `/chats/[address]` | disabled coming-later row |
| `Chip` | interests, `phase`/`scenario`, filters, status pills | variants: outline-muted / outline-accent / fill-accent |
| `SegmentedControl` | locale, filters | pill track on `--color-surface-elevated` |
| `DigitInput` | `/` | six-cell code entry |
| `QrBlock` | `/host` | image + frame |
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
edit (pencil), refresh. Stored as inline SVG components under
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
| `room.around` | {n} вокруг вас | {n} around you |
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
| `profile.leave` | Выйти из комнаты | Leave the room |
| `host.token.label` | Токен хоста | Host token |
| `host.token.rejected` | Токен отклонён. | Token rejected. |
| `host.create` | Создать комнату | Create room |
| `host.empty_live` | Пока никто не присоединился. | Nobody has joined yet. |
| `common.error.network` | Нет связи. Проверьте Wi-Fi — мы продолжаем попытки. | Connection lost. Check the Wi-Fi — we keep retrying. |
| `common.retry` | Повторить | Retry |

(Existing scaffold keys in `ru.ts`/`en.ts` are kept where they match; workers
extend both files.)

---

## 5. Design-decision rationale (short)

- **Radar ring semantics = relationship distance**, not random placement: the
  reference's radar becomes informative (who you already talk to vs who is
  untouched) while keeping the deterministic, jitter-free layout that polling
  needs.
- **"Added you" adapted, not copied**: the reference's Accept/Decline maps to
  handshake-back / dismiss because bleak-node has no decline endpoint — the UI
  must never fake a server effect it cannot perform (§6.2).
- **Read-only transcript**: the owner's flow delegates talking to agents;
  exposing `POST /api/message` as a human composer would blur the product
  story in v1. The API capability is noted for v2.
- **No message previews in `/chats`**: one extra request per chat per poll on
  venue Wi-Fi violates Priority 1 (performance). Revisit with websockets.
- **Accent discipline honored strictly**: the only non-interactive accent fill
  is my own avatar's backdrop — the "you are here" mark, mirroring the
  reference's center chip.
- **Interests render only on my own badge**: the mock is client-side; faking
  other attendees' interests would be a lie the backend swap couldn't fulfill.

## 6. Flagged gaps & open questions (for concept level — not resolved here)

1. **`Handshake.status` ∈ {1,2,3,4} semantics are undocumented** in
   swagger.json. v1 UI uses only *direction* (from/to) + chat existence.
   If the statuses ever encode accept/pending states, the People/radar pills
   should switch to server semantics (design is unaffected structurally).
2. **No handshake-decline endpoint** — the "Decline" of the reference pattern
   is client-side dismissal only (§3.3).
3. **No room-level handshake/chat listing** — the host's live view is limited
   to members polled live; handshakes/dialogs are on-demand per member.
   A room-level read endpoint in bleak-node would upgrade `/host`.
4. **`CreateRoomRequest` has no `max_user`** (read-only on the Room model) and
   **`CreateUserRequest` has no `language`** — so the host cannot set capacity
   and the attendee cannot pick their agent's language at creation; both
   display as read-only facts.
5. **Personal QR on the badge (Concept §4b mapping) is deferred**: bleak-node
   has no user-address resolver, so a scanned personal QR could do nothing in
   v1. The badge ships without it; it joins the contact-exchange milestone.
6. **Human-to-agent messaging** (`POST /api/message`) is unused in v1 UI —
   open question for the owner: should attendees be able to inject a turn?
7. **Import persona proof** (§3.1): with no auth, "import" lets an attendee
   pick any persona from any listed room as theirs. Accepted v1 pragmatism;
   flag if abuse matters.
8. **iOS Safari camera QR scanning** in-app is not built; the QR encodes an
   invite URL that the phone camera opens (deep link). A `BarcodeDetector`
   in-app scanner is a possible v1.1 enhancement, not designed here.
9. **`phase`/`scenario` are free server strings** — chips render them verbatim;
   if bleak-node later defines enums, add RU/EN label maps.

---

*End of DESIGN.md — design instance fd19a963.*
