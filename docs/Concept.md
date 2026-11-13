# bleak-web — Concept

Status: **DRAFT — in interview** (topics marked ✅ are user-approved)

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

**Typography:** **pixel typefaces for titles only** — Silkscreen Bold for the logo and screen titles. All other text (body copy, chat messages, UI labels, buttons, inputs) uses a clean, relevant sans — **Inter** — for readability at small sizes and in long chat transcripts. Alternatives if Inter feels too neutral: Nunito Sans (rounder, friendlier) or Space Grotesk (more techy). No pixel fonts in body/chat text.

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

## Approval

- [x] Topics 1–5 decided (all ✅ approved above)
- [x] Owner approved the complete document (with the terracotta-cream palette revision) — **2026-11-13**.
- [ ] Architect started → **later, at the owner's go-ahead.**
