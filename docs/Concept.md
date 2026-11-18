# bleak-web — Concept

Status: v1 **APPROVED & DELIVERED** (owner ran it, 2026-11-15). §6 v2 scope
(ownership & credentials) **approved & delivered** (2026-11-16). §7 v2.1 UI
polish round — **delivered** (2026-11-17/18, tasks 22–29 closed, CI green).
§8 v2.2 UI polish round #2 (12 owner change requests) — **APPROVED
2026-11-18**, build loop authorized (process agent, autonomous merge mode).
§9 v2.3 addendum (6 refinements incl. Deepa palette) — **APPROVED
2026-11-18**, folded into the running §8 loop.

---

## 1. Product

### What the backend is (facts from `/mount/bleak-node/docs/swagger.json`)

bleak-node is a REST API (v0.1.0) over SQLite for a **simulated social world**:

| Domain | Facts |
| --- | --- |
| **Rooms** | Addressable entities (`0xroom123`), `name`, `description`, `language`, `max_user`; full CRUD (`GET/POST /api/room`, `GET/PUT/DELETE /api/room/{address}`). |
| **Users (agents)** | Scoped to a room; `name`, `greeting`, `public_bio`, `private_bio`, `language`. Greeting must be non-empty and **question-free** — it opens every new chat of the user. CRUD at `/api/room/{room}/user[/{address}]`. |
| **Handshakes** | Directed pairs (A→B, B→A) between users of the same room; `status ∈ {1,2,3,4}`; server-generated `tx_id`; room-scoped "income must exceed outcome" rule; idempotent per directed pair; re-request re-creates a deleted chat. `POST /api/handshake`, `GET /api/handshake/user/{address}`. |
| **Chats** | Auto-created once handshakes exist **in both directions**; carry `phase` (e.g. `networking`), `scenario` (e.g. `ai-future`), `language`, participants. `GET /api/chat/{address}`, per-user listings. |
| **Messages** | `POST /api/message` (from→to inside a chat), ≤255 symbols, server-generated `tx_id`/`created_at`. `kickoff` clears a chat's history and returns the interaction to the queue (first speaker = sender of the earliest handshake). |

Interpretation: bleak-node is a **simulation engine for autonomous agent socializing** — personas greet, handshake, and then hold unscripted conversations (see `dialogs-2026-11-10.txt`: potter ↔ tram driver small-talk).

### Proposed v1 definition (DEFAULT — rejected by owner, see decision below)

*(kept for the record)* bleak-web as an operator's console & observation deck for the simulated world.

### User decision (Topic 1) — ✅ APPROVED

The owner defined the product as a **real-world networking application for events**:

> "I want to create a web app for networking. People in some meeting or meetup scan a QR code (or enter some invite code), enter the room, then create the user or import it from another previous room. Then there is some mechanism when users can send handshakes to each other; if the handshake is mutual, the users' agents begin a conversation. After the conversation users can send a private contact (not implemented in bleak-node yet) to each other if a user likes the dialog. So this web app is for networking — agents interact with other agents in the room so that more efficient networking occurs. Also in bleak-node the mechanism for users to choose interests is not implemented yet; with interests, agents may seek another more relevant agent."

**bleak-web v1 = a live event networking app.** The flow:

1. **Join:** attendee at a meetup scans a QR code / enters an invite code → lands in the **room** for the event.
2. **Identity:** attendee creates their **user (persona)** in that room — or **imports** it from a room of a previous event.
3. **Handshake:** attendee browses other attendees and sends **handshakes**.
4. **Agent conversation:** once handshakes are **mutual** (A→B and B→A), bleak-node auto-creates a chat and the two users' **agents talk to each other** — the actual networking happens between agents.
5. **Outcome:** after reading the dialog, a user may want to **send private contact info** to the other user *(feature not yet implemented in bleak-node — future)*.

**Consequences for the concept:**

- bleak-web has (at least) **two audiences**: the **attendee** (join, persona, handshake, read dialogs) and the **event host/operator** (create room, generate QR/invite, observe the room). The console idea from the draft lives on as the host view.
- The persona/agent framing is retained — each attendee delegates a greeting-driven agent; the backend rules (question-free greeting, income>outcome, idempotent handshakes) are product rules the UI must respect and explain.
- **Gap list** (backend features the product needs but bleak-node does not implement yet — tracked here, designed around in v1, not built by us):
  - **Private contact exchange** after a good dialog.
  - **Interests** on the user profile so agents can seek more relevant counterparts. Owner's plan: a backend field with an **array of interests** (icon with short hobby + emoji). For v1 bleak-web uses a **mock interests model** (the same shape the backend field will take); it switches to the real API when the backend implements it.
- bleak-web remains a **thin, contract-driven client** of the bleak-node REST API — never touching its SQLite DB.

**Owner decisions on the details (Topic 1, clarifications):**

1. **Room creation:** only someone holding a **special token** (host token) may create rooms. Attendees can never create rooms. *(Open design point for the architect: where the token lives — server-side gate or client gate — given the API has no auth; see also Topic 2 restrictions.)*
2. **Invite code:** a **6-digit short invite code**, *not* the room address. QR encodes the code; entering the code resolves to the room. The API has no such mapping, so bleak-web needs its own small mapping layer (code → room address), hosted on our side.
3. **Interests:** mock model in v1 (array of short hobbies with icons/emoji), designed to match the future backend field shape.

**Rationale:** the owner's flow maps almost 1:1 onto the existing contract (rooms; `POST /api/room/{room}/user` for join/create; handshakes; auto-created mutual chats with agent conversations; per-chat transcripts). The invite code needs a thin host-side mapping service, and interests ship as a mock.

---

## 1c. Owner rulings on design-phase questions — ✅ APPROVED (2026-11-14)

These rulings answer the nine gaps the design phase flagged; they are binding for DESIGN/TZ and for the backend TODO ledger.

1. **Auto-matchmaking (score → auto-handshake) — backend TODO only.** Target mechanic (owner spec, to be implemented in bleak-node later): agents automatically scan the room and rank the most relevant users; every user has a **score**; an incoming handshake raises the score; each iteration every user in the room gains score by a **personal coefficient** (derived from the number of matched hobbies or matched hobby groups/topics); when a user reaches a threshold **N**, your agent automatically sends him a handshake. **V1 frontend consequence: none** — v1 ships manual handshakes only (radar + people list). No mock score loop is built client-side. When bleak-node implements the mechanic, the UI adds score/auto-handshake states from real API data.
2. **Decline = local dismissal only.** The backend knows only "send handshake"; a handshake is never "declined" — it simply stays pending until the reciprocal handshake arrives. UI copy must reflect this ("ожидает ответного рукопожатия" semantics), and a dismissed incoming request may reappear (it still exists server-side).
3. **Scan user QR → immediate mutual handshake, frontend-owned in v1.** The scanner's client sends **both** `POST /api/handshake` calls (A→B and B→A), which auto-creates the chat. Persona QR content = join-URL containing the user's address; the persona's QR is rendered client-side on the profile/badge card (this pulls the §4b "personal QR" into v1). Impersonation risk accepted (no auth exists anywhere); the helper/backend should own this later. **Deployment note: camera access requires HTTPS.**
4. **STRICT RULE — humans never send messages.** Only agents communicate in messages. A human's only actions are: **send handshakes** and (future) **access contact info**. No message composer may exist in any chat UI in any version.
5. **Persona ownership/import:** a proper token-based ownership mechanism is a **backend TODO** (release later). In v1, import works without a token: the attendee's identity (room + user address) lives in `localStorage`, and importing copies the stored persona into the new room via the API (read old user → re-create). Accepted risk: anyone with the address can copy a persona.
6. **Camera scanner is in v1**, two contexts: (a) **scan invite QR** → join room; (b) **scan a user's QR** → mutual handshake pair (per ruling 3). Manual 6-digit code entry and deep links remain as fallbacks.
7. **General rule for all backend gaps:** every missing bleak-node feature goes into the **backend TODO ledger** (kept in this document); meanwhile the frontend mocks or omits per each ruling — no invented flows.

**Backend TODO ledger (for bleak-node, maintained here):**
- [ ] Auto-matchmaking score mechanic (ruling 1: scan room, hobby/hobby-group match coefficient, threshold N auto-handshake, incoming-handshake score bump).
- [ ] Private contact exchange after a dialog.
- [ ] Interests field on the user profile (array of short hobby labels + emoji).
- [ ] Handshake status semantics documented (`status ∈ {1,2,3,4}`).
- [ ] Room-level handshake/chat listing (for richer host views).
- [ ] Settable `max_user` and user `language` via API.
- [ ] Persona ownership token mechanism (ruling 5).
- [ ] Mutual-handshake-from-QR endpoint (move ruling 3 server-side).

---

## 2. Aims & restrictions — ✅ APPROVED

**V1 scope (both audiences):**
- **Attendee flow:** enter 6-digit invite code (or scan QR) → land in room → create persona in the room or import one from a previous event's room → edit greeting/bios/interests → browse attendees → send handshakes → read agent dialogs of mutual handshakes.
- **Host view:** with the host token — create the event room, get the QR + 6-digit code to share, watch the room live (members, handshakes, dialogs).
- Kept open for later, not promised: contact exchange, real interests field (mock now), anything the API doesn't offer.

**Devices & browsers:** **mobile-first** for attendees; responsive so the host view is comfortable on desktop. Target evergreen browsers: iOS Safari and Chrome/Android (last 2 versions each), desktop Chrome/Firefox/Safari (last 2 versions each). No IE/legacy support.

**Localization:** **Russian is the primary UI language, English the second.** Locale switch in the UI from day one. The room/user `language` field governs the *agents'* conversation language (backend concern), separate from UI locale.

**Accessibility:** **WCAG 2.1 AA basics as a hard goal** — contrast, focus states, keyboard navigation, semantic HTML, adequate touch targets. No formal audit in v1.

**Explicitly out of scope in v1:**
- Private contact exchange (waits for backend).
- Real interests field (mock now, per Topic 1).
- Any auth/accounts beyond the host token and a lightweight "who am I in this room" persistence.
- Realtime push (websockets) — undecided here; treated as an architecture question (polling first unless the architect argues otherwise).
- Native mobile apps.

---

## 3. Common values (development priority) — ✅ APPROVED

**Performance-first, with a strong UI/UX mandate.**

- **Priority 1 — Performance:** fast load and frictionless joining on mobile, often over poor venue Wi-Fi; light payloads; snappy interactions. This is the metric the team optimizes first.
- **Priority 2 — UI/UX:** the interface is **minimalist but modern — light, conceptual, memorable**. Every screen must be understandable by a non-technical attendee mid-event with no instructions.
- Below that: accessibility (per Topic 2, AA basics) and code quality always apply; security effort is scoped to what matters (host token handling) rather than broad hardening.

---

## 4. Visual language — ✅ APPROVED (revised per owner: template-based dark pixel style)

**Source of truth:** the owner's reference template (`/workspace/design-template.png` — "Snifti Gallery" login). Direction: **dark retro-pixel meets modern soft UI** — a "cozy terminal" mood that makes the pixel-agent concept systemic rather than decorative.

**Palette (dark theme, v1 default — exact sampled values):**

| Role | Hex | Use |
| --- | --- | --- |
| Background | `#1A1C20` | Page background (dark, slightly cool charcoal) |
| Surface | `#101213` | Cards, inputs (near-black) |
| Elevated surface | `#292C2D` | Segmented-control tracks, disabled elements |
| **Accent** | `#FEDC5C` | Warm yellow — active tabs, handshakes, live indicators, labels, primary CTAs |
| Text primary | `#F0F0F0` | Logo, headings, primary copy |
| Text muted | `#919397` | Secondary copy, hints |
| Text disabled | `#4A4C4E` / `#606264` | Inactive elements |

**Accent discipline:** yellow only on interactive/active elements; everything else stays in the charcoal range.

**Typography (Cyrillic-safe — RU is the primary UI language):** **pixel typefaces for titles only** — **Handjet** (element-based variable pixel font, full Cyrillic) for the logo and screen titles; if a harsher arcade look is ever preferred, Press Start 2P (also Cyrillic) is the fallback. All other text (body copy, chat messages, UI labels, buttons, inputs) uses a clean, relevant sans — **Inter** (full Cyrillic) — for readability at small sizes and in long chat transcripts. No pixel fonts in body/chat text. Silkscreen (Latin-only) and Pixelify Sans (missing О/П glyphs in Cyrillic) were rejected for lack of usable Cyrillic.

**Shapes & signature detail:** large rounded corners (~20–24px) with **dithered/stepped pixel edges**; pill-shaped segmented controls; generous vertical spacing; wide letter-spacing on body; large touch targets (AA basics per Topic 2).

**Icons & agent identity:** pixel-art glyphs for icons (close, info…) **and** for agent avatars — one conceptual pixel language across logo, icons, and text.

**Theme:** dark-only in v1; a light variant (the earlier terracotta-cream palette may be revisited later) deferred.

**Prior terracotta-cream proposal (superseded, kept for the record):** light cream `#FAF1E7` / surface `#F3DFCB` / terracotta accent `#C75A1E` with Space Grotesk/Inter + JetBrains Mono — replaced by the owner's template direction above.

### 4b. Owner's reference materials (✅ provided 2026-11-13)

Three reference images kept locally at **`docs/refs/`** (gitignored by owner decision — present on this machine, not in the repo); the **design agent must treat these as the primary visual brief** — layout/pattern/avatar guidance is binding, palette follows topic 4 (dark pixel):

1. **`docs/refs/design-concept.png`** — UX patterns for the event flow (its light colorful palette is *not* adopted; patterns are):
   - **Event badge card:** name, role, company, personal QR code, stat counters ("contacts today" / "added you"), quick actions (scan/tap).
   - **Contacts list:** stacked colored cards, each tagged with a location pill (Hall A/B, Lounge) + timestamp.
   - **Incoming request:** "Added you" detail card with **Accept / Decline**.
   - Mapping to bleak-web: badge ↔ persona card (greeting, interests chips, personal QR); location pills ↔ interest/attribute chips; "Added you" ↔ incoming handshake request; stats ↔ room/handshake counters.
2. **`docs/refs/icons-personage.png`** — avatar art style: **chunky pixel-art portraits** ("pixel people": hair, glasses, beards at low resolution, solid-color backdrop). All user/agent avatars in bleak-web are generated pixel portraits in this style.
3. **`docs/refs/searching.png`** — the **room page = radar / "Around me" view**: concentric rings around the center "Me" chip ("N around you"), other attendees as pixel avatars placed on the rings with names, dark top bar, **bottom tab navigation** (the IA hint: Around me · Contacts · Requests · Activity · Settings — bleak-web's tabs will be adapted to its own flow: Room/Around, People, Chats, Profile, and Host where applicable).

---

## 5. Delivery strategy — ✅ APPROVED

**V1: lightweight JavaScript SPA + PWA-lite, with a thin server-side helper.**

- **SPA, mobile-first** — the attendee journey is interactive (join, browse, handshake, live dialog reads); pure SSR would hurt UX.
- **PWA-lite:** installable via web manifest so it feels app-like on the attendee's phone at the event; **no offline-first service-worker machinery in v1** — the core flows need the live API anyway.
- **Live data: polling** for room state, new messages and handshake status; websockets only if a later need proves polling insufficient.
- **Thin server-side helper (our only backend):** the 6-digit invite-code → room-address mapping and QR generation. Needed because the bleak-node API has no invite mechanism. Everything else talks straight to bleak-node's REST API.
- **Native path kept open, not built:** the architecture stays wrapper-friendly — if native distribution is ever wanted, **Capacitor** can wrap the same SPA. Web-only for v1.

**Signals that would trigger evolution to another option:**
- Real contact exchange / push notifications arrive in the backend → consider deeper PWA or Capacitor push integration.
- Demand for app-store presence or device-level APIs (camera improvements, contacts) → add the Capacitor wrapper.
- Offline browsing of past dialogs becomes a real need → introduce service-worker caching.
- Polling proves too heavy for large rooms → upgrade the live layer (websockets/SSE — backend permitting).

---

## 6. v2 scope — Ownership & credentials (client side) — DRAFTED 2026-11-15, pending owner approval

**Authority:** bleak-node `CONCEPT.md` §7.1–§7.4 (decided with the owner,
2026-11-15) and bleak-node `docs/PLAN-ownership-tokens.md` (the backend
implementation plan — built by the owner separately). bleak-web remains a
thin, contract-driven client: this section defines only what the client
does against the new credential model. Where it supersedes v1 rulings, the
superseded text stays in §1c as history; this section wins.

### 6.1 Identity & persona tokens

- The **identity store** gains the persona token: the client generates it
  at persona creation (≥ 32 random bytes, base64url), sends it **raw** in
  the create request (server stores only its SHA-256 hash — never
  displayed, never logged client-side beyond `localStorage`).
  `bleak.identity` = `{ roomAddress, userAddress, token }`.
- **`Authorization: Bearer <token>`** is attached by the api-client to:
  every persona mutation (edit/delete, greeting save/regenerate), every
  handshake send, token rotation, mutual-code refresh, the mutual-QR
  endpoint, and all gated reads (private data, per-user listings, chat
  reads/kickoff/clear, host chat observation with the room token).
- **Token rotation UI** in profile settings: "Regenerate access token" →
  client generates a new secret → rotation endpoint with the current
  Bearer → stored token replaced. Old token dies server-side; other
  devices holding the old token are locked out (accepted consequence).
- **Global 401 policy:** any 401 on a credentialed call means the stored
  credential is invalid or the persona predates credentials (v1 legacy).
  The app clears identity and redirects to `/` with a notice: RU «У этой
  персоны нет действительного ключа доступа — присоединитесь заново по
  коду события.» / EN "This persona has no valid access credential — join
  again with the event code." (Owner accepted: legacy attendee personas
  are unrecoverable; all current backend data is test data.)

### 6.2 Join flow changes

- Persona creation now sends `invite_code` (the already-resolved 6-digit
  code) together with the freshly generated client token. An
  invalid/expired/revoked code blocks creation with an explicit inline
  error (RU «Код приглашения недействителен или истёк.» / EN "The invite
  code is invalid or expired.").
- **Import is redefined around a device token vault.** The client keeps
  `bleak.tokenVault` (localStorage): every persona ever created on this
  device (room + user address + token). "Import from a previous event"
  lists **vault entries** (not server room listings — without the token,
  private fields are unreadable and importing someone else's persona is
  exactly the risk v1 accepted and v2 closes). Selecting a vault persona
  fetches it with its stored token (full fields incl. `private_bio`) and
  re-creates it in the new room with `invite_code` + a **new** token. The
  old persona and its token remain untouched. "Join another event" keeps
  the vault.

### 6.3 Persona badge — live QR

- The badge QR encodes `?u={userAddress}&m={mutualCode}` (binding payload
  of bleak-node §7.3.5). The client **generates** the one-time mutual
  code, renders it, and registers its **hash** via the token-authenticated
  mutual-code refresh endpoint.
- While the profile page is open, the gated persona read is polled; a
  derived `mutual_code_live = false` → the client generates a new code,
  registers it, and re-renders the QR. The badge is a live object: once
  someone scans it, the displayed QR visibly rotates.

### 6.4 Scanner (context b) — server-mediated mutual handshake

- The v1 client-side two-POST routine (`lib/scanner/mutualHandshake.ts`)
  is **deleted** — B→A from one phone is impossible under the token rule.
- The confirm card now calls `POST /api/handshake/mutual` with the
  scanner's own Bearer token + the scanned `u` + `m`. States: success →
  chat link; **410** → new error state RU «Код уже использован — попросите
  обновить QR на карточке.» / EN "Code already used — ask them to refresh
  their badge QR."; **403 (income rule)** → server text surfaced (see
  6.5); already-mutual pairs → success state (the backend still burns the
  code, per §7.3 — no client special-casing).
- Deep link `/?u={address}&m={code}` runs the same routine (full confirm
  card per TZ flag 5). `/?u=` **without** `m` degrades to a
  single-direction handshake request (own token authenticates it).

### 6.5 Handshake sending & the income rule

- All handshake sends (radar sheet, people card, scanner, deep links)
  carry the Bearer token.
- A 403 from the income>outcome rule becomes a first-class UI state, not a
  generic error: RU «Лимит исходящих хендшейков — сначала получите
  рукопожатия в ответ.» / EN "Outgoing handshake limit reached — receive
  handshakes first." (server text appended when present).

### 6.6 Host console rework

- **Token gate replaced:** the host enters the operator-granted **one-time
  creation token** (masked input) and the client generates the **room
  token**; `POST /api/room` sends the creation token in the header and the
  room token in the body. The creation token is consumed — not stored.
  `bleak.hostRoom` = `{ roomAddress, roomToken, code }`. Room-token
  rotation is available in host settings.
- **Invite management block** (new, room-token authority): list active
  codes, mint a code (settable expiry, default 24 h), revoke.
- **Share kit** unchanged visually (code display, QR, invite link, "join
  as attendee"); the QR/link now use the native code directly.
- **Member drill-down reworked** for the credential model: chats of a
  member are read with the **room token** (full room control incl. clear +
  kickoff from the drill-down). Handshake sent/received counts per member
  are **pending a small bleak-node amendment** (flag 6.9a) — the UI ships
  with chat drill-down and shows counts only if the amendment lands.
- Room settings / delete room authenticated with the room token.

### 6.7 Helper service

- The code→address mapping is **retired** (bleak-node resolves invite
  codes natively). The helper keeps only `GET /h/rooms/{code}/qr` (PNG)
  for the share kit until QR rendering moves server-side; the helper's
  `x-host-token` gate is retired (room creation is gated by bleak-node's
  one-time creation tokens).

### 6.8 i18n, a11y, errors

- Every new state above ships in RU and EN (parity test stays green).
- 401 auto-recovery, 403 income-rule states, and 410 stale-code states are
  announced via `aria-live="polite"`.

### 6.9 Flags (small bleak-node amendments to confirm during its implementation)

- **(a) Room-scoped per-user reads with the room token:** host drill-down
  handshake counts need `GET /api/room/{room}/user/{address}/chat`-style
  room-scoped listings to accept the room token. Default: **yes, amend**
  §7.1 point 4 accordingly; otherwise the host UI omits handshake counts.
- **(b) Invite-code lookup for join:** the join flow needs code → room
  resolution before persona creation (today the helper does it). Backend
  shape TBD by the owner during implementation (e.g. codes unique
  globally, resolve via room list, or a small public resolve endpoint) —
  the client adapts to whatever ships.

---

## 7. v2.1 UI polish round — owner change requests — ✅ APPROVED (2026-11-17)

Seven owner change requests (given verbatim in chat, 2026-11-17) recorded as
binding product decisions for a post-v2 polish round. All are frontend-only;
no backend TODO items. The process agent opens these as tasks
(`tz3-*` naming suggested) and runs the build loop.

### 7.1 Decisions (owner requests, verbatim intent)

1. **Remove the "bleak-web" title** from the input-code (join) form **and**
   from the `localhost:4000/` main page. Acceptance: the string
   "bleak-web" appears **zero** times as a visible title in the UI (both
   occurrences removed; page identity comes from the room/flow content, not
   an app-name title).
2. **Brighter color coding for chat items and personage icons.** Chat items
   (message bubbles) get **different colors per participant/side — yellow,
   orange, blue, violet** — while all text on them stays clearly readable
   (AA contrast on the dark theme). Personage/avatar art also gets the
   brighter treatment. This amends §4's "accent discipline" (yellow-only):
   the palette gains these four functional accent colors for chat/avatar
   color-coding; the charcoal base stays.
3. **Avatar padding:** the generated user icon gets **1 pixel of padding in
   the same color as the background** behind it (prevents the art touching
   card/surface edges).
4. **Remove the "clear chat" button** from the attendee chat UI (owner
   decision: attendees never clear chats; host drill-down clear is
   unaffected by this request).
5. **Room radar fixes:** (a) other users' icons show **no name labels** —
   only the "you" chip keeps its name; (b) the **minimal distance between
   the "you" chip and the nearest user icon is increased**; (c) verify on
   phone-size screens too; (d) user icons **rotate together with the
   rings** (they ride the rings as the radar spins, not counter-rotating
   static labels); (e) icons must **never overlap each other** — every user
   keeps its own hit area.
6. **Profile settings block:** move into a settings area of the user
   profile: **token regeneration**, **UI language switching**, and an
   **exit-room option rendered in red** — with a **confirmation question
   before exiting**.
7. **Import persona:** remove the room-address display on the import
   persona screen (it overlays/overflows the card contour).

### 7.2 Task plan (concept level; the process opens tasks with full ACs)

| # | Suggested slug | Scope | Key ACs |
| --- | --- | --- | --- |
| P1 | `bleak-title-removal` | Join/code form + main page | zero visible "bleak-web" titles; layout stays balanced |
| P2 | `bright-chat-avatar-colors` | Design tokens + chat bubbles + avatar art | 4 new accent colors defined as tokens with AA-contrast text pairs; chat items color-coded; brighter personage icons; RU/EN untouched |
| P3 | `avatar-bg-padding` | Avatar generator | 1px background-colored padding around generated icon |
| P4 | `remove-clear-chat` | Attendee chat view | clear-chat control gone; kickoff semantics untouched |
| P5 | `radar-labels-rotation` | Room radar | no name labels on others; larger min radius from center; icons rotate with rings; no overlap (distinct hit areas); verified at phone widths |
| P6 | `profile-settings-block` | Profile/settings | settings block with token regeneration, language switch, red exit-room + confirmation dialog |
| P7 | `import-address-removal` | Import persona screen | room address no longer displayed |
| P8 | `verify-v21` | Verification sweep | all P1–P7 ACs checked; RU/EN parity; lint/test/build green |

Order note: P2 defines tokens first (P3/P5 consume them); P8 last.
The process may parallelize independent tasks per its TZ-style planning.

### 7.3 Owner directive — autonomous merge mode for this round (2026-11-17)

The owner chose **autonomous merge mode for this round** in chat
(2026-11-17): `NOT_MAINTAIN_APPROVAL` is **treated as true for this round**
(even though the env var is unset) — the process **merges immediately** when
a worker hands over (`ready-for-merge`), no per-feature user gate; CI still
gates closure (red CI = bug + reopen per AGENTS.md). Standing default
remains per-feature approval unless the owner directs devops to set
`NOT_MAINTAIN_APPROVAL=true` permanently.

---

## 8. v2.2 UI polish round #2 — owner change requests — ✅ APPROVED (2026-11-18)

Twelve owner change requests (given verbatim in chat, 2026-11-18, after the
owner ran the v2.1 build) — binding decisions for a second polish round.
All frontend-only. Items 1/2/11/12 refine the v2.1 radar output; item 3
relocates the v2.1 settings block.

### 8.1 Decisions

1. **Radar upright rotation:** objects on the room/around radar maintain
   **vertical (upright) positioning while rotating** — icons travel with the
   rings but never spin on their own axis (amends §7.1.5d "rotate with the
   rings": they ride the rings, orientation stays upright).
2. **Per-ring speeds:** each ring (with its items) rotates at a **different
   speed** — owner's example: 1st ring faster, 2nd ring a bit slower, 3rd
   ring very fast (as stated; distinct speeds per ring are the requirement).
3. **Settings route:** move the settings block out of the profile page into
   a **new `/profile/settings` route**. The leave-room button renders as
   **red font + red border only** (no filled/red background).
4. **Avatar change button:** the circle button on the user change (avatar
   edit) field becomes **less round** — reduced border radius (rounded
   shape, not a full circle).
5. **Profile stats — exactly 3 metrics:** **Sent** (renamed from
   "Handshakes"), **Added you**, **Chatting**. Any other metric removed.
6. **"Only your agent see this" heading** must have a **style distinct**
   from the private ("for your agent") content below it.
7. **Chat colors:** every item in the **chats list page gets a bright
   background** (per §7.1.2 color coding). In the dialog: **interlocutor's
   messages keep the bright background**; **own messages keep the previous,
   muted color**.
8. **Dialog timestamps:** message time shows as **hh:mm**; a **date label
   (e.g. "8 September") sits centered at the top** of the chat.
9. **Remove the "Restart the dialog" button** from the dialog view.
10. **Remove the theme (phase/scenario) display from the dialog**; instead
    show the **interlocutor's public info** there.
11. **Radar "added you" indicator:** remove the yellow circle around such
    users' icons; instead show a **small yellow dot in the icon's top-right
    corner**.
12. **Ring-level transitions:** user icons move between ring levels with a
    **smoother (slick) transition**.

### 8.2 Task plan (concept level; the process opens tasks with full ACs)

| # | Suggested slug | Scope | Items |
| --- | --- | --- | --- |
| T1 | `radar-motion-upright-speeds` | Room radar | 1, 2, 12 |
| T2 | `radar-added-you-dot` | Room radar | 11 |
| T3 | `profile-settings-route` | `/profile/settings` | 3 |
| T4 | `profile-avatar-stats` | Profile page | 4, 5 |
| T5 | `dialog-layout-polish` | Dialog view | 6, 8, 9, 10 |
| T6 | `chats-bright-list` | Chats list + dialog colors | 7 |
| T7 | `verify-v22` | Verification sweep | all |

T1/T2 share the radar component — sequence or coordinate (process decides).
T5/T6 both touch dialog colors — coordinate likewise. T7 last, full
three-gate CI per wave per TZ §8.8.

### 8.3 Owner directive — autonomous merge mode continues for this round

Autonomous merge mode (per §7.3) **continues for the v2.2 round**: merges
into `dev` need no per-feature owner gate; CI gates closure. The owner may
revert to per-feature approval at any time by saying so (or make it standing
via devops: `NOT_MAINTAIN_APPROVAL=true`).

### 8.4 Ops note (not a product decision)

The owner earlier requested a live demo run (both servers, one English room,
6 seeded users, saved tokens, invite code, mutual-handshake enablement) and
then paused it ("don't run the server — see my next message"). The request
remains **on hold** until the owner re-issues it.

---

## 9. v2.3 addendum — six refinements to the in-flight v2.2 round — ✅ APPROVED (2026-11-18)

Six owner change requests (chat, 2026-11-18, while the v2.2 build loop is
running). Binding; the process folds them into the running loop — amending
pending task cards, and for any task already past its worker phase routing
the delta through the normal merge/CI flow.

### 9.1 Decisions

1. **"Only your agent sees this" heading:** keep its position/order in the
   layout; revert to the **previous typeface** (the one used before the
   v2.2 restyle); color it **red with some opacity** (muted red, not
   solid).
2. **Settings entry point:** the profile page gets a **settings button in
   its top-right corner** (leading to `/profile/settings` per §8.1.3).
3. **Radar geometry:** the ring diameter must equal
   **max(screen-width, screen-height)** — the radar spans the larger
   viewport dimension.
4. **Interests spacing:** add a **margin between the "Interests" title and
   the interests items**.
5. **Chats list items — truly bright, no opacity:** full-opacity bright
   backgrounds. The color-coding palette is replaced by the owner-provided
   **"Deepa" palette**:
   `#00B57F` (Deepa-1, green), `#E8E000` (Deepa-2, yellow),
   `#FF5000` (Deepa-3, orange), `#9B0CFF` (Deepa-4, violet),
   `#0DECFF` (Deepa-5, cyan). This palette supersedes §7.1.2's four-hue set
   for chat color-coding (list items **and** interlocutor message bubbles
   per §8.1.7); own messages stay muted (§8.1.7); text contrast on these
   backgrounds must stay readable (AA).
6. **Avatar generation palette:** generated personage icons use the **same
   Deepa palette**; the icon's **background must be darker than the
   personage's image**. The 1px background-colored padding (§7.1.3) stays.

### 9.2 Routing note

T1 (radar, running) absorbs item 3; T3 (settings route) absorbs item 2; T5
absorbs item 1 and item 4; T6 absorbs item 5; the avatar work (v2.1 P2/P3
territory) absorbs item 6. The process amends cards (`criteria`), keeps RU/EN
parity and CI gates, and reports per its standing method.

---

## 10. v2.4 addendum — eight refinements — ✅ APPROVED (2026-11-18)

Eight owner change requests (chat, 2026-11-18, during the v2.3 delta wave).
Binding; the process folds them into the loop — amending not-yet-started
delta tasks, opening new tasks for new scope, and routing anything already
past its worker phase as follow-ups.

### 10.1 Decisions

1. **Import screen redefined — "return to event" (amends §6.2 import
   semantics).** Problem (owner): after choosing **"Join Another Event"**
   from the join confirmation (e.g. "Continue to Dev Chat EN"), the user
   can no longer re-enter the previous event. Right model (owner):
   "Join another event" creates a persona in the new event; to **return to
   a previous or any other active event**, the **import screen** lists the
   user's saved personas, and selecting one **automatically enters that
   room using the token saved in storage** (identity restore — no
   re-creation), with the persona **marked as "Return / Вернуться"**.
   Interpretation recorded: the copy-persona-into-the-new-room flow is
   superseded by this return flow (flagged to the owner for confirmation —
   see the concept agent's report).
2. **Radar spacing:** the gap between the center user and the nearest ring
   becomes **smaller** (amends v2.1's enlarged center gap) — while the
   no-overlap rule stays.
3. **"Only your agent sees this" heading:** **small size** (smaller than
   the content below), **no uppercase** (sentence case), **keep red**
   (refines §9.1.1 — same previous typeface, red with opacity).
4. **No profile edit button:** remove the user-info change button from the
   profile page — **all persona changes live in `/profile/settings`**.
5. **Chat item color tied to user id:** each chat's color is **derived
   deterministically from the interlocutor's user id** (hash → one of the
   Deepa palette colors), consistent across visits (refines §9.1.5).
6. **Chat item content:** remove the dialog-theme text; show the **last
   message preview** — rendered with **opacity**, truncated with **"…"**
   when it overflows the block — plus the **time of the last message**.
   *Implementation decision (owner, 2026-11-18): the client fetches each
   chat's transcript and takes the last message — chats are capped (~26
   messages), so this is not heavy. No backend extension needed for the
   preview. The active/finished status icon (item 7) derives from whatever
   lifecycle signal the transcript/chat data provides; if none exists, the
   item defaults to the active state and the gap is recorded in the backend
   TODO ledger.*
7. **Chat item status icon:** remove the right-side time; instead show an
   **icon with the chat's status**: **active → loading icon**, **finished →
   red reminder-style mark**.
8. **Host out of the footer menu:** remove the Host entry from the bottom
   navigation. The `/host` route stays; the user path to open the host
   menu **will be designed later** (not part of this round).

### 10.2 Routing note

Pending v2.3 delta tasks are amended before spawn where possible: task 39
absorbs §10.1.3; task 40 (chats Deepa) absorbs §10.1.5–7. New scope:
§10.1.1 import-return flow, §10.1.4 profile-edit removal, §10.1.8 host-nav
removal. Radar spacing (§10.1.2) routes as a follow-up on the radar flow if
task 37 has already passed it. Verification: extend the final sweep to
cover §10.

---

## 11. v2.5 addendum — four refinements — ✅ APPROVED (2026-11-18)

Four owner change requests (chat, 2026-11-18). Binding; folded into the
running loop by the process.

### 11.1 Decisions

1. **Leaving a room never deletes the persona (bug fix).** Owner flow:
   pressed "Leave the event" → tried to return via the import screen →
   error "This persona no longer exists on the server … not found: sql: no
   rows in result set" — the exit flow was deleting the persona on the
   backend. Rule: **when leaving a room, the client must not delete the
   user on the server — no hard or soft delete.** Leaving is purely local:
   clear the active identity, keep the persona token in the vault
   (`bleak.tokenVault`), so the user **can always return** to the room
   (per §10.1.1). The backend `DELETE persona` endpoint remains for
   explicit deletion elsewhere (e.g. host drill-down) but is never called
   by the attendee exit flow.
2. **Chat list — no background colors.** Remove all background color from
   chat list items (neutral surface, like the rest of the app); use colors
   **like the /people page** (the color-coding lives on the item's
   avatar/personage, Deepa palette per §9.1.5). **Message bubbles in the
   chat keep their colors.** On the chat list item, the right-side
   status **marks are rendered as reminders in the color of that chat's
   messages** (the interlocutor's Deepa color, §10.1.5), and the
   **loading icon is animated (rotating)**.
3. **Copy sweep — drop "Edit", rename "persona" → "profile".** Remove the
   word **"Edit"** from the titles ("Edit persona / edit greeting / edit
   interests" → "Persona/Greeting/Interests" style titles). Rename
   **"persona" → "profile"** (EN) and **"персона" → "профиль"** (RU)
   throughout the UI. The settings-block title "Persona" becomes
   **"My profile"** (RU «Мой профиль»).
4. **Join form layout bug:** the **6-digit code input overflows the form
   boundaries** — fix the layout so the input stays inside the card.

### 11.2 Routing note

Item 1 amends the exit-room flow (v2.1 §7.1.6 confirmation stays; the
actual leave becomes local-only) — verify the join/identity machines and
tests reflect "leave ≠ delete". Items 2–3 are i18n/copy + component tweaks
(RU/EN parity tests must be updated with the rename). Item 4 is a layout
fix on the join form. The process sequences these as tasks per its standing
method; verification sweep extended to §11.

---

## Approval

- [x] Topics 1–5 decided (all ✅ approved above)
- [x] Owner approved the complete document — **2026-11-13** (visual language later revised same day to the owner's dark-pixel template; typography made Cyrillic-safe on 2026-11-13).
- [x] Owner rulings §1c — **2026-11-14**.
- [x] Owner approved **docs/ARCHITECTURE.md** and **docs/DESIGN.md** (rev. 2) — **2026-11-14** → TZ pass authorized.
- [x] Architect (acff3ab8) — architecture + scaffolding **done**; TZ pass done (`docs/TZ.md`).
- [x] Owner approved **docs/TZ.md** (conservative flag interpretations accepted) — **2026-11-14** → **build loop authorized** (process agent; default per-feature merge-approval mode).
- [x] Build loop → **v1 delivered** — owner ran the first version, 2026-11-15 ("awesome").
- [x] bleak-node `CONCEPT.md` §7.1–§7.4 (ownership tokens, invite codes, mutual-QR) decided with the owner — **2026-11-15** (bleak-node repo; implementation by the owner, per its `docs/PLAN-ownership-tokens.md`).
- [x] Owner approved **§6 v2 scope** (with §6.9 defaults) — **2026-11-15** → architect pass authorized (ARCHITECTURE/TZ v2, DESIGN rev. 3) → build loop for the credentials client scope.
- [x] Architect (81037a13) — **ARCHITECTURE.md §10 v2 credentials addendum** delivered & merged into `dev` (2026-11-15).
- [x] Design (bd636f23) — **DESIGN.md rev. 3** (118 ACs) delivered & merged; **owner approved** (2026-11-15) → TZ pass authorized.
- [x] Architect TZ pass v2 (81037a13) — **TZ.md Part II** delivered & merged (2026-11-15): 13 tasks (TZ2-01…TZ2-13), 118/118 ACs mapped, 5-wave plan, DoD v2.
- [x] Owner approved **TZ v2** — **2026-11-15** → **v2 build loop authorized** (process agent; default per-feature merge-approval mode, `NOT_MAINTAIN_APPROVAL` unset).
- [x] Build loop v2 → **done** (2026-11-16): 21/21 tasks closed, final wave-CI green (522 tests), `docs/verification-v2.md` records 118/118 ACs; §8.6 DoD checklist fully met. Post-loop: bleak-node WP-6 reconciliation (hash `90b95f75`), `tz2-07a` pre-authorized behind flag 6.9a, pre-event device-smoke checklist in the verification doc.
- [x] Owner approved **§7 v2.1 UI polish round** (7 change requests, verbatim chat 2026-11-17) + autonomous merge mode for the round → **build loop for §7 authorized** (process agent).
- [x] Build loop v2.1 → **done** (2026-11-18): tasks 22–29 closed, CI green; owner ran the build and filed 12 follow-up issues.
- [x] Owner approved **§8 v2.2 UI polish round #2** (12 change requests, verbatim chat 2026-11-18; autonomous merge mode continues) → **build loop for §8 authorized** (process agent).
- [x] Owner approved **§9 v2.3 addendum** (6 refinements to in-flight §8, incl. the Deepa palette, chat 2026-11-18) → folded into the running §8 loop by the process agent.
- [x] Owner approved **§10 v2.4 addendum** (8 refinements incl. import="return to event" redefinition, chat 2026-11-18) → folded into the running loop by the process agent.
- [x] Owner approved **§11 v2.5 addendum** (4 refinements: leave≠delete fix, chat-list restyle, copy sweep, join-form layout, chat 2026-11-18) → folded into the running loop by the process agent.
