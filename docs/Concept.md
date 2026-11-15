# bleak-web — Concept

Status: v1 **APPROVED & DELIVERED** (owner ran it, 2026-11-15). §6 v2 scope
(ownership & credentials) drafted 2026-11-15 — **pending owner approval**.

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
- [ ] Architect TZ pass v2 (81037a13, running) → owner review → build loop for the credentials client scope.
