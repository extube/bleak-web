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

## 12. v2.6 addendum — phone full-screen forms; join overflow re-fix — ✅ APPROVED (2026-11-18)

Owner report (chat, 2026-11-18): the §11.1.4 join-input fix did not hold —
at **phone size the join input still overflows the form**. Binding decision:

1. **Phone screens → full-screen forms.** On phone-sized viewports the
   following render as **full-screen forms** (the form fills the viewport —
   no floating card chrome competing for width; content stays inside
   bounds):
   - **Enter code** (join form, with the 6-digit input — the overflow must
     be structurally gone at every phone width);
   - **Import profile**;
   - **Return to event** (per §10.1.1);
   - **Profile page** form.
   Desktop keeps the current layout. The phone breakpoint follows the
   design system's existing breakpoints (the process/design agent fixes
   the exact value).
2. The §11.1.4 overflow is treated as **not fixed** — a bug round on the
   join flow verifies the input stays inside the form at 320px/360px/390px
   widths (behavior tests, not just a one-off style tweak).

The process routes this per its standing method (bug round + full-screen
task, verification updated, autonomous mode, RU/EN parity, suite green).

---

## 13. v3 reconciliation round — bleak-node #34/#35 client integration — ✅ APPROVED (2026-11-19)

The owner shipped bleak-node features #34 (interests + match score) and #35
(hard match, chat done, shared contacts) — see the exploration list recorded
in the concept agent's report (2026-11-19). Six owner-approved client items:

### 13.1 Decisions

1. **Interests — real API (mock retired).** Interests management switches
   from the §1 mock model to the real endpoints
   (`POST/DELETE /api/room/{room}/user/{address}/interest`, persona
   Bearer): upsert by numeric `key` (re-add replaces title/group),
   `title` 1–64 chars, 1–50 rows, idempotent delete. The client keeps an
   **interest catalog** (group → key → title + emoji, per the §1 owner
   note "icon with short hobby + emoji") so the user picks from a curated
   set; the picker lives in **profile/settings**. Interests are displayed
   on the profile badge and consumed by the score features.
2. **`Chat.done` integration.** The chat's `done` boolean (farewell turn
   stamps it; kickoff resets it) is the authoritative **finished** signal:
   chat-list status icons (finished → red reminder mark; active → animated
   loading), dialog UI states, and gating for the contact-share flow (§13.1.3).
   The §10.1.7 "default active when no signal" fallback is retired.
3. **Share contact — swipe-right slide.** In the dialog footer there is a
   **slide (swipe-right) control** that shares the user's contact
   (`POST /api/contact`, ≤255 chars, once per pair — repeat = 409 handled
   gracefully: state "already shared"). The control is **enabled only when
   the dialog is finished** (`Chat.done`). The shared **content is composed
   client-side from the persona's contact card** — a new local field in
   profile/settings (e.g. "telegram: @handle"); the backend stores only
   the share record. *Open design point (flagged): where the recipient
   sees received contacts (minimal: a small "shared contacts" surface).*
   The same slide control also appears in the summary sheet (§13.1.5).
4. **Chats list — score-first sorting.** Order: **finished chats first,
   sorted by their match/v2 score descending** (only finished chats carry
   the score — the client fetches `POST /api/match/v2` per finished pair,
   its own Bearer); **unfinished dialogs after, sorted by time (newest
   first, the existing default)**. Unfinished dialog items render
   **darker, with opacity**, plus the **animated circular loader** (spinning
   circle, standard web loading style).
5. **Summary sheet modal (finished chat).** Opening a **finished** chat
   triggers the **once-only hard-match** (`POST /api/hard-match`) and opens
   a **sheet modal** with the pair's statistics: a **round (donut) diagram
   showing the score value** and the **networking checklist** (the 5
   checkpoints, closed/open states). If **score > 80 → fireworks and a
   brightness effect**. The sheet has **round corners**, an **X close
   button top-right**, and the **share-contact slide** (§13.1.3). Its
   **background color is the interlocutor's message color** (the user-id-
   derived Deepa hue, §10.1.5) — text contrast stays readable on it.
6. **Radar tuning:** the **center-to-nearest-ring distance becomes closer
   still** (building on §10.1.2), **user icons a little smaller**, and the
   **ring rotation speed slower** overall (per-ring speed *differences*
   from §8.1.2 remain).

### 13.2 Ledger updates (§1c backend TODO ledger)

- [x] ~~Private contact exchange~~ — **implemented** in bleak-node #35; client feature per §13.1.3.
- [x] ~~Interests field on the user profile~~ — **implemented** in #34; mock retired per §13.1.1.
- [x] ~~Auto-matchmaking score mechanic~~ — exists as the API score surface (#34/#35: match, match/v2, hard-match); client display per §13.1.4–5. The *agent-side auto-handshake* variant remains a backend idea, not needed by the client.
- [x] Chat status semantics — `Chat.done` closes the §10.1.7 gap.

### 13.3 Task plan (concept level; `tz5-*`)

| # | Suggested slug | Scope | Items |
| --- | --- | --- | --- |
| R1 | `interests-api-integration` | Catalog + settings picker + badge display | 1 |
| R2 | `chat-done-integration` | done flag everywhere + gating | 2 |
| R3 | `contact-share-flow` | Slide control (footer + sheet), contact card field, 409 state, (minimal received view) | 3 |
| R4 | `chats-sort-scores` | Sorting, score fetches, unfinished styling + loader | 4 |
| R5 | `summary-sheet-modal` | Donut + checklist + fireworks + share slide | 5 |
| R6 | `radar-tuning` | Gap, icon size, speeds | 6 |
| R7 | `verify-v3` | Verification sweep | all |

Dependencies: R2 gates R3/R5 (finished states); R4/R5 consume match/v2 and
hard-match (R1's interests also feed the score inputs). The process orders
and parallelizes per its standing method.

---

## 14. v3.1 addendum — share animation, contacts page, sheet polish — ✅ APPROVED (2026-11-19)

Five owner items (chat, 2026-11-19) queued **after all §13 tasks complete**
(owner's wording). The owner has already run the summary sheet build —
item 5 is a live bug in it.

### 14.1 Decisions

1. **Share-contact slide polish.** The slide track/knob becomes **candy-cane
   style with animation** (animated red-white striped bar around/behind the
   circle). When the swipe completes, a **confetti animation plays from the
   top** (share success moment).
2. **New footer page — "Contacts".** A new bottom-nav tab showing the
   **list of contacts shared with the user** (`GET /api/contact/{address}`,
   newest first — replaces the §13 minimal settings list as the primary
   surface). The tab icon is **marked with a dot when new contacts arrive**
   (unseen-since-last-view marker).
3. **Contact input in the user-creation form.** The join flow gains a
   **contact field**; the entered contact info is stored **only in
   localStorage** (the client's contact card) until the user actually
   shares it (nothing is sent to the backend at creation).
4. **Sheet modal polish.** The summary sheet's width matches the **dialog
   content width** (aligned with the messages' left/right borders). The
   **score displays as a ceil (integer) number**. The checklist renders as
   **square checkboxes with green check signs**.
5. **Bug (i18n):** the sheet modal shows hardcoded Russian strings
   ("итоги встречи", "сетевой чек лист") while the owner is in the English
   room/interface. All sheet copy must come from the i18n table — **English
   in the EN interface, Russian when RU is chosen**; the RU/EN parity test
   covers the sheet.

### 14.2 Routing note

Item 5 routes as a **bug round** attributed to the summary-sheet worker
(`97ddd53e`). Items 1–4 open after the v3 wave (task 66 + CI) lands. The
contacts-page tab (item 2) touches the footer nav — coordinate with the
§10.1.8 Host-removal layout. Verification extended to §14.

---

## 15. v3.2 addendum — arcade sheet redesign + Slide-to-Share component — ✅ APPROVED (2026-11-20)

Owner items (chat, 2026-11-20, after running the v3.1 build), including two
**full component specifications** given verbatim by the owner. These specs
are binding; the design phase treats them as the primary brief.

### 15.1 ShareContactSlide — full component spec (owner text, structured)

Modern iOS-style "Slide to Answer" button:

- **Track:** pill-shaped, aspect ratio ~3.8:1, height ~76px, full
  border-radius. Dark translucent glassmorphism background
  (`backdrop-filter: blur`) with centered shimmering "slide to answer"
  placeholder text that fades out as the thumb moves right.
- **Thumb:** circular draggable, diameter ~68px with 4px internal padding;
  crisp white circle with a green phone icon; smooth touch **and mouse**
  drag.
- **Candy-cane trail (owner notes: brighter colors, wider stripe lines;
  the trail fills the area beside/behind the circle as it travels):**
  a dynamic fill bar revealed as the thumb drags — extending from the
  track edge up to the thumb's near edge — styled as a vibrant
  candy-cane / barber-pole pattern: **alternating diagonal stripes
  (45°)** of two contrasting shades with a **continuous smooth scrolling
  marquee animation** along the track.
- **Behavior:** release before **85%** of the track width → thumb + trail
  **spring back** smoothly; past 85% → **snap to end**, trigger the
  "answered" state, and **fire a celebratory confetti burst**.

**Sheet variant** (see 15.3): same component mechanics with the
sheet-specific palette (#FACC15 thumb, charcoal track, yellow/white-oranger
stripes, pixel-accented text, "Contact shared!" completion).

### 15.2 Placement & chat-page changes

1. **The share-contact slide lives ONLY in the summary sheet** — the
   dialog-footer instance (§13.1.3) is **removed**. The sheet's slide is
   **bigger: height ratio 3.5:1 to 4:1**.
2. **Summarization button on the chat page:** when the chat **is finished**
   (`Chat.done`), a button opens the summary sheet; when **not finished**,
   the button renders disabled with the phrase that the **dialog is still
   in progress** (RU/EN).

### 15.3 Summary sheet — full redesign spec (owner text, structured)

Interactive mobile **modal bottom sheet** styled with a **1980s
retro-arcade aesthetic** — animated pixel-art avatars, score-reactive
interactions, animated candy-cane slider.

- **Container & palette:** bottom sheet with rounded **top corners
  24px**, dark backdrop scrim. *Owner amendment (2026-11-20, supersedes
  the originally specified electric-purple #8A12FF): the **background
  color must be the same as the background color of the chat's
  interlocutor's messages** — the user-id-derived Deepa hue (§10.1.5) —
  with text/ink contrast kept readable (per-hue ink pairings per
  DESIGN §4.10). The rest of the palette accents (yellow #FACC15 slide,
  charcoal track) stay as specified.*
- **Entrance motion:** the sheet slides up with a slight **retro-arcade
  spring bounce**; content **cascades in sequentially** (staggered
  fade-and-slide-up, ~50ms per section).
- **Typography:** authentic **8-bit pixel font (Press Start 2P or
  Silkscreen)** for headers, titles and numeric scores, paired with
  clean sans-serif (**Inter**) for readable paragraphs and checklist
  text. *Cyrillic caveat (design resolves): Press Start 2P/Silkscreen are
  Latin-only — RU strings need the Cyrillic-safe pixel face (Handjet, §4)
  or per-locale font mapping; RU/EN parity is mandatory.*
- **Top bar:** small uppercase pixel label **MEETING SUMMARY** on the
  left; interactive **pixel-art X close button** on the right (subtle
  pixel scale-down press state). *Owner fix (2026-11-20): the close
  button must be **visible on any background** — the sheet bg is now the
  interlocutor's hue (yellow makes a fixed-color X invisible) — so the X
  takes the **per-hue ink/contrast color** (e.g. scrim chip or the
  dark-ink pairing for light hues) per DESIGN §4.10.*
- **Dual pixel avatars & score ring (centerpiece):** **both users'**
  8-bit pixel-art avatars (**56×56px square frames**) facing each other
  on opposite sides of the **circular Interest Matching Score gauge**
  (score example: 70 inside a **thick white animated progress ring**
  that **fills clockwise from 0 to the score** on open, numbers
  **counting up rapidly like an arcade score tally**).
- **Score-tier avatar reactions** *(thresholds revised by the owner,
  2026-11-20: **80–100 = GREAT match, 50–79 = the next tier, everything
  below follows the pattern** — amending the originally specified 70/40
  cutoffs):*
  - **High (80–100, "Great Match"):** both avatars animate **toward the
    center** on open, **bouncing joyfully** in idle 2-frame pixel loops;
    an animated **pixelated energy beam / sparkling pixel hearts & stars**
    bridges the gap between them across the ring.
  - **Medium (50–79, "Good Chat"):** avatars perform a friendly **pixel
    nod/wave** with a steady **glowing pixel dotted line** connecting
    them across the ring.
  - **Low (0–49, "Different Vibes"):** avatars **stay spaced apart** with
    a playful retro **"sweat drop"** or neutral idle blink.
  *(Supersedes §13.1.5's single ">80 fireworks" rule — celebration is now
  the high tier; the fireworks/brightness effect folds into it.)*
- **Conversation summary & checklist:** left-aligned crisp white
  sans-serif paragraph (the hard-match summary text); under the pixel
  header **NETWORKING CHECKLIST**, the 5 items render as **pixel-art
  checkboxes** that **pop in sequentially with a retro flash** and **draw
  their pixel checkmarks one by one** on open (square shape + green check
  per §14.1.4).
- **Bottom action — "Slide to share contact":** full pill-shaped **dark
  charcoal track (#18181B, height 64px)** with a **2px bright yellow
  border (#FACC15)** and shimmering pixel-accented text that fades out on
  drag. Thumb: **bright yellow circle (#FACC15)** with a **subtly pulsing
  pixel arrow icon**. Trail: candy-cane/barber-pole **45° diagonal stripes
  of bright yellow #FACC15 and white/orange**, **continuously scrolling
  forward**, expanding beside the circle while dragging. Release <85% →
  spring back; ≥85% → **lock**, **8-bit square pixel confetti explosion
  across the modal**, **both avatars do a celebratory victory jump**, and
  the text changes to **"Contact shared!"**.

### 15.4 Flags for the owner (concept report)

- Sheet background: originally switched to #8A12FF purple per spec, then
  **amended back by the owner (2026-11-20) to the interlocutor's message
  color** (Deepa hue, §13.1.5 restored) — see the §15.3 container bullet.
- Tier thresholds: originally 70/40, **revised to 80/50** (see §15.3).

---

## 16. v3.3 addendum — slide + sheet layout fixes — ✅ APPROVED (2026-11-20)

Owner fix list (chat, 2026-11-20) while the §15 wave runs. **Only the
"Slide to Share" button component and the sheet's layout/scrolling change —
the rest of the arcade sheet stays as specified in §15.3.**

### 16.1 ShareContactSlide fixes (component-only)

1. **Wider proportions:** the pill track spans **88–92% of the modal's
   width** (horizontally aligned with the checklist and summary text
   edges), **height 64px**, full **9999px** pill radius.
2. **Candy-cane fill wraps around the circle:** no abrupt vertical flat
   edge behind the thumb — the striped container extends from the left
   edge of the track **all the way around the draggable circle**, ending
   with a **matching rounded pill cap (9999px)** hugging the thumb's right
   edge, with **uniform 4px padding** between the circle and the striped
   fill's outer edge.
3. **Placeholder & layering:** the placeholder text ("Swipe right to share
   your contact") stays **strictly centered** horizontally and vertically
   in the full track width. **Z-index:** candy-cane fill renders **above**
   the placeholder (covering/clipping it as it expands — stripes never
   clash with light text), the **thumb renders on top** of the fill;
   optionally the placeholder **fades smoothly as the thumb passes
   center**.
4. **Completed state:** consistent padding/alignment when locked right —
   thumb neatly nested inside the track's right end with **4px uniform
   margin**.

### 16.2 Modal sheet layout, scrolling & positioning

1. **Fixed height & anchor:** the sheet is **88–90% of the screen height**,
   anchored to the bottom of the viewport so its **top edge sits just
   below the main chat header** (the header stays visible).
2. **Pinned top / scrollable middle / pinned bottom:**
   - **Pinned top:** MEETING SUMMARY header + X close, the user avatar(s)
     and name, and the score ring — **fixed, never scroll**.
   - **Scrollable middle:** only the **conversation summary text** and the
     **NETWORKING CHECKLIST** scroll vertically (smooth, however long the
     text).
   - **Pinned bottom:** the **slide button stays fixed** at the sheet
     bottom, always visible.
3. **Exact vertical alignment:** the slide button sits at the **exact
   same vertical level from the bottom of the screen** as the
   **Summarization button** in the chat view behind it — both occupy the
   same on-screen position.

### 16.3 Routing note

The slide-v2 scope (§15 wave task tz7-01) and sheet-core (tz7-02) are
landed; the centerpiece (tz7-03) is running. The process routes §16.1 as a
fix round attributed to the slide component's owning worker, folds
§16.2 into the running/next sheet tasks where possible, and keeps the
locked §15.3 palette untouched (these fixes are layout/geometry only).
Verification extended to §16.

---

## 17. v3.4 microchanges — sheet line, chat-list dot — ✅ APPROVED (2026-11-20)

Three owner microchanges (chat, 2026-11-20), queued **after the last
running task finishes**:

1. **Modal sheet:** remove the **dotted line between the two users**
   (the medium-tier connector from §15.3) — the tier animations themselves
   stay.
2. **Chat list:** remove the **right-side status marks** (§10.1.7 icons)
   and instead render a **color dot** in the same palette (the
   interlocutor's user-id-derived Deepa hue, §10.1.5).
   *Owner correction (2026-11-20): the dot is for **finished** chats only
   — an **unfinished** chat item shows **no dot**, only the loading
   circle (item 3).*
3. **Chat list:** remove the **old rotated-dots loading indicator** but
   **keep the newest loading circle** (the §13.1.4 spinner for unfinished
   dialogs).

Verification extended to §17; the process sequences these after the
in-flight wave per its standing method.

---

## 18. v3.5 addendum — sheet/summary & chat-dot refinements — ✅ APPROVED (2026-11-20)

Three owner items (chat, 2026-11-20), sequenced after the in-flight
recovery work (tasks 82+83):

1. **Great-match tier cleanup:** in the summary sheet's GREAT-match
   layout, **remove the dotted line between the two users** (as already
   done for the good-chat tier, §17.1) and render the **user's name
   stronger and centered below its avatar — matching the good-chat
   styling**. *Owner amendment (2026-11-20): the **avatar names are
   removed from the sheet entirely** — the name labels under both
   avatars are gone (avatars alone, both tiers).* *Owner addition
   (2026-11-20): add a **"Great match" tier title** in the GREAT-match
   tier, styled with the **same font color as the sheet's common text**
   (no special color). RU/EN parity applies — RU wording per the i18n
   table (e.g. «Отличное совпадение»); placement follows the sheet
   layout (design decides, e.g. near the score ring).*
2. **Finished-chat dot size:** the chat list's finished-dot becomes
   **bigger — the same size as the round loading circle** it replaced.
3. **Summary lazy background loading:** for **finished** chats the
   summary is **lazily fetched in the background** (not blocking the
   open). If the user opens the sheet **while summarization is still in
   progress**, the sheet shows a **loading state with animation** until
   the summary arrives.

---

## 19. v3.6 addendum — people-page rework + sheet tweaks — ✅ APPROVED (2026-11-20)

Four owner items (chat, 2026-11-20):

1. **Good-chat tier (summary sheet):** ~~the avatars must **not pull
   toward each other** in this tier — they stay spaced apart while
   **keeping the same animation**~~ *Owner reversal (2026-11-20): the
   no-pull restriction is **cancelled** — avatars may converge/pull
   together in the sheet animation (all tiers). The §19.1 regression bug
   round therefore drops its no-pull fix portion; the other folded fixes
   (names removal, GREAT-match title, X-close visibility) stay.*
2. **/people page — no filter chips; deterministic sort:** remove the
   filter chips entirely; the list is just **sorted**: first **who added
   you**, then **those without any handshakes**, then **those chatting
   with you**, then **those you sent a handshake to**.
3. **/people page item rework:** remove the **right icon** (the one that
   opened the chat or toggled the handshake form). For the **first user
   in the list (who added you)**, the **"handshake back" state is
   automatically opened**. Rename **"handshake back" → "handshake!"**
   (RU: **«Привет!»**). Remove the **"chatting" badge** — instead render
   a **button with text like "Open chat"** (RU/EN). *Owner addition
   (2026-11-20, final): tapping/clicking an item whose status is
   **"added you"** opens the **Handshake! / Dismiss form** for that user
   (the handshake-back send and the local dismissal action side by
   side).*
4. **Sheet loading state (refines §18.1.3):** add **more loading items**
   to the in-progress loading view and **move the text below the loading
   animation image, centered** in the modal sheet.

---

## 20. v3.7 addendum — chats list time sort — ✅ APPROVED (2026-11-20)

Owner change (chat, 2026-11-20): **chat items are sorted by time, from
new to old** (newest first). This **supersedes §13.1.4's score-first
ordering** (finished-by-score first, then unfinished by time) — the list
becomes a single time-based sort. The unfinished-item styling (opacity +
spinner), the finished dot, previews, and the Deepa hue coding are
unaffected.

---

## 21. v3.8 addendum — chats list common block + thin dividers — ✅ APPROVED (2026-11-20)

Owner change (chat, 2026-11-20): chat list items share a **common
background block** (one surface container behind the items), and the items
are **split by thin divider lines** in the **website background color**
(the §4 page background, `#1A1C20`). Each divider is **horizontally
centered** and **no wider than 95% of the chats box width**. Per-item
styling (dot, spinner, preview, hue coding) is unchanged.
*Owner decision (2026-11-20, in-progress items inside the block): an
**unfinished** chat item keeps its muted look **as dimmed content** —
name, preview and time render at **reduced opacity**, the **spinner
stays**, and the common block background is untouched (no per-item
background panel; the dimming applies to content, Option A).*

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
- [x] Owner approved **§12 v2.6 addendum** (phone full-screen forms for enter/import/return/profile; join overflow re-fixed as a bug round, chat 2026-11-18) → routed to the process agent.
- [x] bleak-node features **#34 (interests + match) and #35 (hard match, chat done, contacts)** explored and reported to the owner (2026-11-19).
- [x] Owner approved **§13 v3 reconciliation round** (6 items: real interests, Chat.done, share-contact swipe, score-sorted chats, summary sheet modal, radar tuning; 3 ledger gaps closed, 2026-11-19) → build loop authorized (process agent, autonomous mode).
- [x] Owner approved **§14 v3.1 addendum** (candy-cane/confetti share slide, Contacts footer page with new-dot, creation-form contact input, sheet width/score/checkbox polish, sheet i18n bug; 2026-11-19) → queued by the process agent after the §13 wave completes.
- [x] Owner approved **§15 v3.2 addendum** (ShareContactSlide component spec, share slide only in sheet, chat-page summarization button, full retro-arcade sheet redesign with locked palette, 2026-11-20) → routed to the process agent.
- [x] Owner approved **§16 v3.3 addendum** (slide wrap-around/centering/completed-state fixes, sheet 88–90% pinned-top/scrollable-middle/pinned-bottom layout, exact bottom alignment with the Summarization button, 2026-11-20) → routed to the process agent.
- [x] Owner approved **§17 v3.4 microchanges** (remove sheet dotted line, chat-list color dot instead of status marks, drop old dots loader keep circle spinner, 2026-11-20) → queued after the in-flight wave.
- [x] Owner approved **§18 v3.5 addendum** (great-match line removal + centered name, bigger finished-dot, lazy background summary loading with in-progress loading state, 2026-11-20) → queued after the recovery work.
- [x] Owner approved **§19 v3.6 addendum** (good-chat avatars stay spaced, people-page sort replaces filter chips, people-item rework with "handshake!"/«Привет!» + Open-chat button, sheet loading view polish, 2026-11-20) → queued.
- [x] Owner approved **§20 v3.7 addendum** (chats list = single time sort, newest first; supersedes §13.1.4 score-first ordering, 2026-11-20) → queued behind task 95.

---

## 22. Token-efficiency analysis & protocol — ✅ DECIDED (owner directive, 2026-11-20)

The owner asked: why did the weekly model limit burn in roughly one day,
and to fix consumption **before** starting the §22.3 todo list (no owner
questions during this task).

### 22.1 Root-cause analysis (measured on repo data)

- **106 sub-agent sessions** and **101 task cards** were created in ~5
  days — most for one-to-three-line owner tweaks.
- **Fixed injection cost dominates:** `AGENTS.md` (403 lines, ~9–10k
  tokens) plus `DOCS-INDEX.md` are auto-injected into **every** session.
  106 sessions × ~11k ≈ **~1.2M tokens of pure boilerplate** — before any
  actual work.
- **Per-task full-session overhead:** a one-line CSS change cost a full
  session boot + doc reads + handover + gates (~50–80k tokens) because
  every owner micro-item got its own worker instance.
- **Tick loops:** each process resume re-read its state (task DB, logs,
  git) and wrote long interim reports; dozens of ticks per round.
- **Full-CI output in context:** every wave re-read multi-hundred-line
  test outputs (765–830 tests) into context.
- **Verification-sweep workers:** every round spent a full session only
  to re-check what CI already proves.

### 22.2 Binding protocol (effective immediately; owner directives included)

1. **No final-checker worker (owner directive 1):** the dedicated
   verification-sweep worker role is **removed**. The process itself runs
   `make lint && make test && make build` at round end and may append a
   short note to the existing verification doc directly — no separate
   card/session for sweeps.
2. **Logs are never committed (owner directive 2):** `docs/logs/` is
   gitignored; log lines stay local. The committed audit trail = the task
   DB's `task_log` + session records. Workers/process must not stage
   `docs/logs/**`.
3. **Batch microchanges:** 2–5 related small owner items = **one** worker
   session on **one** branch (lineage resume preferred) instead of one
   session per item.
4. **Self-contained spawn prompts:** the process pastes the exact task
   brief into the spawn prompt; workers read **only** the named
   Concept/DESIGN sections, never whole documents.
5. **Concise cards:** criteria reference Concept sections; no restating.
6. **Tick discipline (concept):** no drive-by ticks; rely on wake
   notifications; one summary per wave, not per task.
7. **Targeted tests while iterating:** `make test-smoke` / named suites
   during work; the full three-gate run only at the final gate. CI output
   is summarized (tail/exit code), not re-read in full.
8. **Devops recommendations (owner directs devops; biggest lever):** slim
   the auto-injected `AGENTS.md` (the ~9k-token boilerplate × every
   session is the single largest cost); per-role minimal injection.

### 22.3 Queued feature todo list (owner, held until §22.2 is active — now active)

- [ ] **Bleak mascot** on the enter-invite-code form
- [ ] **Step-by-step user creation (entering room) (P1)**
  - [ ] intro theme
  - [ ] enter your name
  - [ ] enter information about you through **auto chat**:
    - [ ] public bio
    - [ ] private bio
    - [ ] contact info form (phone / email / nickname from a messenger — choose)
    - [ ] interests (first choose the **group**, then **generated interests by group**: sport → ice hockey, running, football…; music → jazz, rap, reggae…)
  - [ ] loading creation-user step
  - [ ] style of chat and transition

Execution note: this is a feature round (`tz11-*`) under the lean protocol
— target **2–3 worker sessions max** (mascot; creation wizard incl. the
auto-chat interview; then the process's own gates). The creation wizard is
a **P1** replacement of the current single-form persona creation; the
auto-chat interview mimics a dialog with the mascot/agent asking the
questions (public bio → private bio → contact → interests).

---

## 23. tz11 design-review amendments — ✅ APPROVED (2026-11-20)

Owner design review of the delivered tz11-01/tz11-02 state (batch of
numbered changes). Items 1–4 amend the **mascot** (tz11-01 scope, in
flight); items 5.1–5.9 amend the **creation wizard** (tz11-02 scope).
RU/EN parity applies everywhere.

### 23.1 Mascot amendments (fold into tz11-01)

1. **No background:** the mascot must **not have a background** (no
   plate/box behind it — the pixel figure sits directly on the page).
2. **Join-the-event form placement:** mascot at the **top of the page**,
   then the **title**, then the other elements. The same mascot-at-top
   pattern applies to **all other forms** (consistent header order:
   mascot → title → content).
3. **Room form:** on the room form (where you choose between
   **create profile** / join), **also add the mascot** (top, per item 2).
4. **"Hi! I'm Bleak" bubble:** its background is removed too (same
   no-background treatment as the mascot itself).

### 23.2 Creation-wizard amendments (fold into tz11-02)

- **5.1 Input send UX:** do **not** send/double-message on tapping
  something in the input. Add a **send button on the right of the input**
  (iOS Messages style). Send happens on **Enter or the button**. Also add
  a **character counter** (current/max symbols) for the input.
- **5.2 Layout:** **remove the "Next" button**. The chat **input form is
  fixed at the bottom** (rises when the keyboard opens). The **chat
  content is scrollable** when it overflows the available screen height.
  **Keep the "back" button below the input, centered.**
- **5.3 Placeholder suggestions:** each input case gets a **suggestion
  (placeholder) with an example** of what the user may write here — e.g.
  "I am a backend dev" for the **"What others see" (public bio)** input.
- **5.4 Contact field:** instead of a "Messenger" choice add a **nickname
  field** with **suggested messenger prefixes**: `tg:@…`, `signal:@…`,
  `inst:@…` (user types the nickname; prefix suggestions offered).
- **5.5 Themes model (interests rework):** rename everything — each
  **interest group is now a "theme"**. Render **6–10 theme badges** (emoji
  + text). After picking a theme, **generate dedicated topics** for that
  group (e.g. Music → composer names, rock groups, jazz bands, rap acts).
  Interests are saved as **`group: '<theme id>'`**, **`key: '<topic
  key>'`**, **`title: 'theme:topic_key'`** (e.g. `music:the_sex_pistols`).
  The same generation applies for sport, computer, science, architecture
  and the other groups.
- **5.6 Profile settings:** **remove changing interests** from the
  profile settings (interests are set at creation only).
- **5.7 Multi-theme selection:** fix the current single-theme lock — the
  user **must be able to choose several themes** and several interests
  each. After finishing one theme's interests, the flow **returns to the
  theme-badges step** (not the next wizard step) and repeats until the
  user presses a **"Ready" button**.
- **5.8 Loading step animation:** the "Creating your profile" loading
  step gets **animations like the modal sheet page** (the arcade-sheet
  loading treatment, §18.1.3/§15).
- **5.9 Transitions:** **fade transitions** between the creation-chat
  steps. *Owner amendment (2026-11-20): fades apply to **every step
  boundary of the whole creation path** — form → intro theme → chat
  (interview) → "creating your profile" loading → app main page — not
  just the chat steps.*

---

## 24. tz11 wizard review, second batch — ✅ APPROVED (2026-11-21)

Owner design review of the wizard state (batch, 2026-11-21). All items
amend the **creation wizard** scope (tz11-02 lineage). RU/EN parity
applies. The owner's numbering is preserved (their "7" appears twice —
here split into 7 and 7b).

1. **No echo of the input:** the chat must **not repeat as a message**
   what the user is writing in the input form (no live/echo bubble of
   the typed text).
2. **Revert arrow instead of "back":** remove the **"back" button**;
   add a **revert arrow in the input form** shown **when the input is
   empty** (no symbols yet); when the user **starts typing**, the current
   **send button appears** in its place (arrow swaps to send).
3. **Keep all chat history:** everything the interlocutor (mascot) sends
   is **saved in the chat**, and the user's answers are saved too —
   including the **theme/interest picks** (groups and interests appear
   in the history as the user's messages/answers).
4. **Counter position:** the symbol counter is **centered below the
   button** (below the input row).
5. **Slower fades:** the fade transition **takes more time**.
   *Owner amendment (2026-11-21): the transition duration is exactly
   **1.5 s**.*
6. **Calm intro form:** the mascot intro form must be **calm and
   friendly** — calming the user, **preparing them for a simple
   dialog**, and giving the **necessary context** before the interview.
7. **Pixel font for the greeting:** "Hi! I'm Bleak" on the intro form
   uses the **pixel font** (not the standard body font).
7b. **Desktop dimensions:** on a computer screen the creation chat has
   the **same dimensions as the room chats on the /chats page** (not
   full-width).
8. **Clear button:** add an **"x" on the right in the input form** to
   quickly clear the input block.
9. **Strongly fixed input height:** the input form must be **strongly
   fixed in height above the keyboard/bottom** (no height jitter).
   **Suggestions — e.g. the messenger prefixes — are located ABOVE the
   input** (never below it).
10. **Remove footer note:** remove "**stored on your device. Shared when
   you slide to share**" from the chat.
11. **Autofocus after send:** after **Enter** (sending the previous
    message), the input is **auto-focused** again.
12. **Latest message visibility:** the **last message must sit
    automatically strictly above the input form + suggestion badges**
    (if any) — auto-scroll keeps the newest message pinned right above
    the input area. *Owner fix report (2026-11-21): currently the
    creation dialog **keeps showing the first message** when the dialog
    is longer than the available screen height — the message list must
    **automatically scroll to the bottom** whenever a **new message is
    added** or the **chat opens**; the latest message must be **fully
    visible right above the input field**, never staying scrolled to the
    top or getting **partially cut off behind the input bar**. Use
    **smooth scrolling** and **proper bottom padding** of the chat
    container. *Owner scoping note (2026-11-21): this fix concerns the
    **creation chat ONLY** — the main-room chat (/chats page) behavior
    must not change.* *Owner recurrence report (2026-11-21, after the
    first fix landed merged+CI-green): **the creation dialog still does
    not autoscroll to the last message.** The unit tests pass while the
    real app misbehaves — the test contract does not reproduce the
    actual runtime geometry. The next fix round must diagnose against
    the real rendered app (not just jsdom assertions): verify the scroll
    fires on the actual scroll container at runtime, survives the step
    remounts and font/layout settling, and is not canceled by smooth-
    scroll interruptions; strengthen the test to a real-geometry
    contract.*
13. **Back button placement:** **keep the right back button** in
    non-standard forms (theme choosing, contact choosing, etc.).
    **Remove the bottom back button everywhere.**

---

## 25. Creation chat desktop layout — ✅ APPROVED (2026-11-21)

Owner spec (2026-11-21) for the **creation chat on desktop** — layout
and dimension changes only:

1. **Full screen height:** the chat container stretches **from the very
   top edge to the very bottom edge** of the browser window — no
   vertical centering, no empty space above or below the chat box.
2. **Wider desktop container:** the chat column spans the center of the
   page at roughly **750–850 px wide** (instead of the narrow
   mobile-sized box; this supersedes the §24 7b "same dimensions as
   room chats" approximation with the explicit target).
3. **Pinned bottom input:** the input bar stays **anchored at the bottom
   edge of the screen**, and the message area above it **expands to fill
   all remaining vertical space**.
4. **Visual styles untouched:** no changes to colors, dark background
   shades, message bubble colors, fonts, borders, or button styles —
   **size and layout proportions only**.

---

## 26. Owner order: stop the simulated chat round — reuse the main-room chat — ✅ APPROVED (2026-11-21)

Owner order (2026-11-21): the bug-round worker is "making shit" by
**simulating everything with happy-dom** — stop it.

1. **Stop the running bug round** (task 109, `c1266ebd` lineage):
   stop the worker, **delete its branch**,
   close the card as cancelled — no happy-dom-based simulation work is
   wanted.
2. **New task:** **remove the chat implementation in the creation form**
   (the wizard's hand-rolled chat). Instead make the creation chat
   **the same chat as the main room** — reuse the real chat component /
   behavior from the `/chats` main room (rendering, scrolling, input
   bar, message list) so the creation dialog inherits the proven chat
   behavior (including autoscroll) instead of a simulated replica. The
   wizard then only feeds its messages/steps/answers into the real chat
   machinery.

---

## 27. Owner order: two fixed areas for the creation chat — ✅ APPROVED (2026-11-21)

The auto-scroll is **still not working** (second recurrence after the
real-chat reuse round). Owner structural order (2026-11-21): **split the
creation-chat screen into two separate screens/areas (no visible
separation)**:

1. **Messages area** — the top region, **fixed** within the available
   screen (the area left after the keyboard).
2. **User-form area** — the bottom region (suggestion badges, input,
   counter, send/revert) — also **fixed** at the bottom of the available
   screen.
3. **Bounded scroll:** when the message list **overflows the messages
   area**, it scrolls **within that bounded area** and **autoscrolls to
   the bottom of this area** (set this as the scroll behavior/option —
   not a measured hack against the whole page). The result: the last
   message always sits **strictly above the user-input form area**.
4. No visible boundary between the two areas — they only partition the
   layout geometry. All visual styles (§25 item 4) stay untouched.

---

## 28. Owner refinement: header + main structure for the creation dialog — ✅ APPROVED (2026-11-21)

Further refinement of §27 (owner, 2026-11-21) — the creation-dialog
screen structure:

- **Main block** = the space **between the bottom (or keyboard) and the
  header**. The main block **never scrolls itself** (no page/main
  scrolling at all).
- Inside the main block exactly **two blocks**:
  1. **Messenger** (messages area) — **can be scrolled** (its own
     internal scroll, per §27).
  2. **User-input-form block** — the answer input, **theme choosing**,
     **contacts form** and the rest of the step-specific form UI —
     **cannot be scrolled** and is **fixed at the bottom of the main
     block**.
- Everything outside (header, keyboard area) stays fixed; only the
  messenger block scrolls. All visual styles unchanged (§25 item 4).

---

## 29. Owner refinement: viewport-height constraint on the MAIN BLOCK — ✅ APPROVED (2026-11-21)

Fix to the §28 contract so the **user-input-form block is always
completely visible** above the bottom edge of the screen and never gets
pushed off-screen:

1. **Lock outer & main container to the viewport:** the root page
   wrapper and the MAIN BLOCK are **strictly bounded by the visible
   browser window height** (from below the fixed header down to the
   bottom edge of the screen or virtual keyboard). The MAIN BLOCK must
   **never grow taller than the visible screen space**.
2. **Messenger shrinks, form grows upward:** when a **tall
   user-input-form block** appears (multi-button choice forms, contact
   forms), the form block sits **completely inside the visible bottom
   area**, growing **upward from the bottom edge**, while the
   **messenger block above it shrinks in height** and scrolls internally
   to fit the remaining space.
3. **Never clip the form block:** the bottom of the user-input-form
   block always aligns **flush with the bottom of the visible viewport**
   (or the top of the keyboard); **every button and input inside it is
   100% visible** without scrolling the outer page.
4. **Preserve styles:** all existing colors, button designs, spacing,
   and visual styling untouched.

---

## 30. New feature: unified form UX structure — ✅ APPROVED (2026-11-21)

New feature (owner, 2026-11-21): the forms — **"Join the Event"**,
**"Room intro"** (where the user may pick **create profile / change
code**), and the **other forms** — all share the **same three-block
structure**:

1. **Header (not scrollable):** on the left the **app icon**, on the
   right the **language switching**.
   *Owner amendment (2026-11-21, header sizing): the **EN/RU switcher
   is smaller** — its height equals the **web-app icon's height**; the
   icon is made a **little bigger**. Keep the proportions (the switcher
   visually matches the icon's height; nothing oversized).*
   *Owner amendment (2026-11-21, icon rendering): the header web-app
   icon is used **without background** (the icon graphic itself, no
   background plate/badge behind it).*
2. **Footer (not scrollable):** the footer block holds the **buttons
   for the user** to pick (the form's action buttons).
3. **Middle block (scrollable):** contains the **content** — the
   **title** and the **text**; the text fills **no more than 75% of the
   form width**; and the form's main interactive element — the
   **6-digit input**, or the **scan-QR link**, or the **resume session**
   option. The middle block **may be scrolled**.

**Viewport constraint (same rule as §29):** all these blocks live
inside the form, and the form **cannot overlay the area between the top
of the screen and the bottom of the screen** (the bottom being the
keyboard, if the keyboard is opened) — the form is strictly
viewport-bounded, never content-driven in height.

This generalizes the §28/§29 structure (fixed header, fixed non-scroll
regions at top/bottom, single internal scroll region in the middle,
viewport-bounded) to the non-chat forms.

*Owner refinement (2026-11-21): the middle block's content is centered
**only horizontally** (or not centered at all — beginning on the left);
it always **starts at the top** and flows **top-to-bottom** with some
**paddings** — never vertically centered within the middle block.*

**Concrete example — the "Enter the Room" form (owner, 2026-11-21):**

- **Header:** web-app icon on the left side, language switching on the
  right side.
- **Middle content:** the **mascot**, the **"Join the Event"** title,
  the **6-digit input**, and the **links to QR-scan** and **"Return to
  event"**.
- **Footer (from the bottom):** one button — **"Enter the room"** — with
  the same (existing primary) button styles. *Owner amendment
  (2026-11-21): the **"Return to event"** button moves out of the
  middle content into the **footer**, **below the "Enter the room"
  button**, with the same styles — so the footer of this form has two
  stacked buttons: **"Enter the room"** on top, **"Return to event"**
  below it.*

*Owner clarification (2026-11-21): the footer is **not** limited to one
button — it holds **the buttons for the user to pick** (as per §30 item
2), one or several depending on the form. "Enter the Room" was only a
concrete example where that form happens to have a single action
(e.g. the "Room intro" form's footer has both **create profile** and
**change code**).*

**Scope extension (owner, 2026-11-21):** the same §30 form structure
and styles also apply to the **"Hi! I'm Bleak" intro page** — fixed
header (app icon left, EN/RU switcher right, sized per the header
amendment), the scrollable middle with the mascot and the calm/friendly
greeting content ("Hi! I'm Bleak" in the pixel font per §24 items 6–7),
and the fixed footer with the form's action buttons, all strictly
viewport-bounded (§29 rule).

**Geometry unification (owner, 2026-11-21):** the **creation chat** and
the **mascot intro** get the **same dimensions and position** as the
**"Enter the event" form** and the **"Room intro" form** — the
unified-form shell's container geometry (width, centering, viewport
bounding) is the shared standard for all these screens. This refines
the §25 desktop approximation (750–850 px full-height column): the
exact geometry is now defined by the shared form shell, so every screen
in the join/intro/creation flow looks consistently sized and
positioned.

---


---


---


---


---


---


---

