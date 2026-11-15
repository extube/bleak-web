# bleak-web — Architecture

Architect instance: `acff3ab8` (2026-11-14). Foundation: `docs/Concept.md`
(owner-approved v1). API contract: `/mount/bleak-node/docs/swagger.json`
(bleak-node v0.1.0). Downstream agents (design, process, workers) must be able
to work from this document without asking the user anything.

> **v2 addendum (2026-11-15, architect `81037a13`):** §10 extends this
> document with the credentials architecture for the owner-approved v2 scope
> (Concept §6 — ownership tokens, native invite codes, mutual-QR handshake).
> §10 **amends** §3 (state stores), §4 (data layer) and §6 (helper service);
> all other v1 sections stand unchanged.

---

## 1. Stack decision

| Concern | Choice | Why (tied to Concept §3/§5) |
| --- | --- | --- |
| Framework | **SvelteKit 3 (Svelte 5) in SPA mode** (`adapter-static` + `index.html` fallback, `ssr = false`) | Concept §5 mandates a lightweight JS SPA. Svelte compiles away its runtime — the smallest JS payload of the mainstream options (no VDOM), which serves Priority 1 (performance on poor venue Wi-Fi). SvelteKit gives file-based routing, a dev server and build pipeline without being used for SSR. The SSR capability is kept available for later (progressive enhancement path) without changing the stack. |
| Build tool | **Vite 8** (bundled with SvelteKit) | Fast cold start (workers iterate quickly), native code-splitting, first-class Svelte support. |
| State | **Svelte 5 runes (`$state`, `$derived`) in components + `svelte/store` writables for cross-page state** | No state library at all — the app state surface is small (identity, locale, polled room data). Runes give fine-grained reactivity; classic writables keep cross-page stores testable without the compiler. |
| Data layer | **`@bleak/api-client` — a hand-written typed client** (see §4) | Contract is small (15 endpoints) and stable; codegen from Swagger 2.0 adds toolchain risk and runtime weight for little value. Hand-written keeps the client tree-shakeable and unit-testable with an injected `fetch`. |
| Live data | **Polling** via a tiny `Poller` primitive (§5) | Concept §5 decides polling first; websockets only if proven insufficient. |
| Styling | **Vanilla CSS with design tokens** (`tokens.css` / `base.css`), no CSS-in-JS, no Tailwind | Concept §4 is a bespoke dark-pixel visual language (dithered stepped corners, pixel icons). Custom CSS is required for the signature effects anyway; zero runtime cost; tokens give design/worker agents a single palette/typography source. |
| Typography | **Self-hosted via Fontsource**: `@fontsource-variable/handjet` (titles/logo only) + `@fontsource-variable/inter` (body/chat/labels) | Both are Cyrillic-complete (Concept §4 requires RU-primary UI). Fontsource ships unicode-range subsets — only the needed subset (e.g. cyrillic + latin) is downloaded per glyph usage; fonts are hashed assets of the build, no Google Fonts request. Pixel fonts must never be used for body/chat text (Concept §4). |
| i18n | **Hand-rolled typed dictionaries** (`lib/i18n/{ru,en}.ts`, `t(key)`, RU default, locale persisted in `localStorage`) | Two languages, ~30 keys at v1. A framework (i18next/paraglide) would cost bundle or toolchain budget for nothing. RU/EN key parity is enforced by a unit test — a missing RU key fails CI. |
| PWA | **Web app manifest + theme-color + icons only** (PWA-lite, Concept §5) | Installable, app-like on the attendee's phone. **No service worker** in v1 — core flows need the live API. |
| Helper service | **Node 24 + Hono + `node:sqlite`** (see §6) | The one server-side component we own: invite-code mapping + QR + host gate. `node:sqlite` is built into Node ≥22.5 — zero native deps, WAL persistence. Hono is a ~14 kB dependency-free router with a testable `app.request()`. |
| Unit tests | **Vitest 5** (all three workspaces) | Same Vite pipeline, fast, per-package configs. |
| Component tests | Not wired in v1 scaffold. Planned: **`@testing-library/svelte` + Vitest (happy-dom already configured)** for interactive components (join form, tab bar, handshake actions). | Scaffold scope; environment is already prepared. |
| E2E tests | Not wired in v1 scaffold. Planned: **Playwright** (Chromium + WebKit, covering iOS Safari parity) against `make build` output served statically. | Scaffold scope; documented as the CI-gate evolution path. |
| Lint | **ESLint 10 flat config** (root, one config for all workspaces) + typescript-eslint + eslint-plugin-svelte | Single `npm run lint` covers `.ts`, `.js`, `.svelte` across the monorepo; route-literal navigation checks come free from `svelte/no-navigation-without-resolve`. |
| Package management | **npm workspaces** (no pnpm/yarn) | npm 11 is present in the environment; hoisted installs are fine at this repo size; no extra tooling grant needed. |

**Explicitly not chosen:** React/Preact (heavier runtime for no benefit here),
SolidJS (smaller ecosystem for component tooling), SSR (hurts nothing to skip:
the join flow is interactive and the API is live-only), Tailwind (our bespoke
pixel CSS needs arbitrary custom properties and clip-paths; utility classes
add friction), i18next/paraglide (overkill for RU/EN v1).

### Monorepo layout

```
bleak-web/
├── Makefile                  # setup/dev/build/test/lint + coordination wrappers
├── package.json              # npm workspaces root, root scripts
├── eslint.config.js          # one flat config for the whole monorepo
├── tsconfig.base.json        # shared strict TS options
├── .env / .env.example       # app config (identity block preserved at top)
├── packages/
│   └── api-client/           # @bleak/api-client — typed bleak-node client
│       ├── src/{types,client,errors,index}.ts
│       └── tests/client.test.ts
├── apps/
│   ├── helper/               # @bleak/helper — thin service (the ONLY backend we own)
│   │   ├── src/{index,app,db,codes,env}.ts
│   │   └── tests/{codes,helper}.test.ts
│   └── web/                  # @bleak/web — the SPA
│       ├── vite.config.ts    # SvelteKit 3 plugin config + dev proxy + vitest
│       ├── src/
│       │   ├── app.html      # manifest/theme-color/viewport
│       │   ├── routes/       # /  /room  /people  /chats  /chats/[address]  /profile  /host
│       │   └── lib/
│       │       ├── api/{client.ts,helper.ts}   # bleak-node + helper clients
│       │       ├── i18n/{index,ru,en,locale.ts}
│       │       ├── stores/identity.ts          # "who am I in this room"
│       │       ├── polling/poller.ts
│       │       ├── join.ts                     # invite-code validation
│       │       ├── components/{TabBar,PagePlaceholder}.svelte
│       │       └── styles/{tokens,base}.css    # Concept §4 palette/typography
│       ├── static/{manifest.webmanifest,favicon.svg,icons/}
│       └── tests/{i18n,poller}.test.ts
```

**Module boundaries (hard rules for workers):**

- `packages/api-client` depends on **nothing** (no svelte, no DOM assumptions).
  `apps/web` may import it; `apps/helper` must NOT (helper talks to bleak-node
  through its own injected `fetch` in `app.ts`).
- `apps/web` must not import from `apps/helper` source. The two communicate
  only over the helper's HTTP surface (§6).
- Svelte components live under `apps/web/src/lib/components` or route files;
  no component may call `fetch` directly — route/page code goes through
  `#lib/api/client` (bleak-node) or `#lib/api/helper` (helper).
- Design tokens are the only source of color/typography values. Hardcoded hex
  values in components are a review error.

## 2. Routing

- File-based routing in `apps/web/src/routes` (SvelteKit), SPA fallback via
  `adapter-static({ fallback: 'index.html' })` — every path is served by the
  static host and client-routed. `ssr = false; prerender = false` in
  `+layout.ts`.
- IA (Concept §4b, adapted): `/` join-by-code (pre-room, no tab bar) →
  `/room` (radar "Around me"), `/people`, `/chats`, `/chats/[address]`
  (dialog transcript), `/profile`, `/host`. Bottom `TabBar` with
  `resolve()`-typed route literals (kit 3 enforces literal routes — keep it
  that way).
- Route-level code splitting is automatic per route file. Keep page-level
  imports lean; the api-client and i18n are tiny enough to share.

## 3. State management

> **Amended by §10.4 (v2):** `identity` gains `token`; `hostSession` is
> reshaped to `{ roomAddress, roomToken, code }` (helper host-token storage
> retired); new `tokenVault` and `mutualCode` stores. The table below is the
> v1 baseline.

| Store | File | Shape | Persistence |
| --- | --- | --- | --- |
| `identity` | `lib/stores/identity.ts` | `{ roomAddress, userAddress } \| null` | `localStorage` `bleak.identity` |
| `locale` | `lib/i18n/locale.ts` | `'ru' \| 'en'` (RU default) | `localStorage` `bleak.locale` + `<html lang>` |
| join code | session flow | validated 6-digit code | `sessionStorage` `bleak.pendingCode` (until persona creation feature lands) |
| live room data | per-page, via `Poller` | polled snapshots (users, handshakes, chats, messages) | none (always fresh) |

Rules: no global mutable singletons beyond these stores; polled page state
stays in the owning route; `Poller.stop()` must be called on route teardown.

## 4. Data layer — `@bleak/api-client`

> **Amended by §10.2–§10.3 (v2):** Bearer-attachment policy, new endpoint
> methods (mutual handshake, mutual-code registration, rotations, invite
> management, credential-carrying room/user creation) and the 401 gate live
> in the web API layer. The v1 structure below stands.

Hand-written from swagger.json; **decision: not generated**. Justification:
the Swagger 2.0 → TS codegen toolchain is shaky (most generators target
OpenAPI 3), the contract is 15 endpoints/9 schemas, and a generated client
would either drag a runtime or need its own build step. The hand-written
client is ~200 lines, fully typed, and every endpoint mapping is under test.

- `src/types.ts` — `Room`, `User`, `Handshake`, `Chat`, `Participant`,
  `Message`, `Greeting` + request shapes. When bleak-node changes
  swagger.json, update types here (contract drift is caught by tests only if
  we add a contract test later; workers should re-check swagger.json when
  touching an endpoint).
- `src/client.ts` — `BleakClient` with one method per endpoint (rooms CRUD,
  room users CRUD, greetings incl. `regenerateGreeting`, handshakes, chats,
  kickoff, clear history, messages, send message). `fetch` is injectable;
  `baseUrl` may be empty for same-origin paths (the default in the web app —
  see CORS note below).
- `src/errors.ts` — `ApiError` (status + server text; bleak-node error bodies
  are plain text) and `NetworkError` (unreachable — the venue-Wi-Fi case).
- The web app exposes the singleton `api` from `#lib/api/client.ts`.
- **Poll-first etiquette for workers:** read endpoints used by polling return
  full arrays; compute diffs in the caller, don't spam re-renders (Svelte
  keyed `{#each}`).

**Integration risk — CORS (recorded, not a deviation):** the concept says the
SPA talks straight to bleak-node. bleak-node's CORS behavior is unknown. The
scaffold therefore calls bleak-node via same-origin relative paths, proxied by
Vite in dev (`/api` → `BLEAK_NODE_URL`) and by a same-origin reverse proxy in
production (hosting-level concern, outside bleak-web's code). If a split
deployment is ever required, bake `VITE_BLEAK_NODE_URL` at build time and
enable CORS on the proxy. bleak-web code never needs to change for this.

## 5. Polling / live-data strategy

`lib/polling/poller.ts` — `Poller({ intervalMs, tick, onStall?, backoffMs? })`:
fixed interval, 3× backoff after 2 consecutive failures, `refresh()` for an
immediate tick (route mount / visibility regain). Workers instantiate it per
page:

- `/room`, `/people`: poll `listRoomUsers` (+ `listHandshakesOfUser` for
  incoming requests) — start at ~3–5 s; backoff covers dead Wi-Fi.
- `/chats`: poll `listChatsOfUser`.
- `/chats/[address]`: poll `listRoomUserChatMessages` (or `listChatMessages`)
  — fastest cadence (~2 s) while the dialog is open.
- Rule for workers: one Poller per page; stop it on unmount; never poll in
  components below page level.

## 6. The thin helper service

> **Amended by §10.10 (v2):** the code→address mapping endpoints
> (`POST /rooms`, `GET /rooms/:code`) and the `x-host-token` gate are
> **retired** (bleak-node resolves invite codes natively, §7.2); the helper
> keeps `GET /health` and a now-stateless `GET /rooms/:code/qr`. The v1
> surface below is the baseline.

**Scope (Concept §5):** 6-digit invite-code → room-address mapping + QR
generation + a pragmatic host-token gate for room creation. It is the ONLY
server-side component bleak-web owns; everything else is bleak-node's API.

**Surface** (mounted at `/h` from the SPA via proxy; direct at `:8787`):

| Endpoint | Auth | Behavior |
| --- | --- | --- |
| `GET /health` | — | liveness |
| `POST /rooms` | `x-host-token` header | validates token, calls bleak-node `POST /api/room`, mints a unique 6-digit code, persists the mapping, returns `{ room, code, invite_url }` (201) |
| `GET /rooms/:code` | — | `{ code, room_address }` for the join flow; 400 malformed / 404 unknown |
| `GET /rooms/:code/qr` | — | PNG QR (512px, charcoal-on-light) encoding the invite URL |

**Persistence:** its own SQLite file (`HELPER_DB_PATH`, default
`data/helper.db`, gitignored) via `node:sqlite` — table
`invites(code PK, room_address, created_at)`. **Never bleak-node's DB**
(bleak-node is read-only-for-us; we never touch its SQLite file). The mapping
is runtime state — an operator can wipe it between events; codes are
re-issued at room creation.

**Host-token gate (v1 pragmatic decision):** the bleak-node API has no auth,
so room creation is gated helper-side: `POST /rooms` requires
`x-host-token: HELPER_HOST_TOKEN` (env). The token is shared with the host
out-of-band (e.g. set in `.env` / injected env of the deployment). Attendees
cannot create rooms through the UI because the UI only creates rooms via the
helper. **Known accepted risk:** anyone with raw network access to bleak-node
can still call its API directly; that is an accepted v1 gap (Concept §1 left
the token location open; revisit if hostile actors appear — e.g. move to a
helper-side HMAC or reverse-proxy ACL).

**Codes:** `crypto.randomInt` over 0..999999, zero-padded to 6 digits; not
the room address (owner decision). Collision-retry against the mapping (max
10 attempts).

## 7. Configuration & environment

`.env` (gitignored; `.env.example` committed) — keys added by the architect,
existing `GITHUB_*` identity block untouched:

| Key | Default | Meaning |
| --- | --- | --- |
| `BLEAK_NODE_URL` | `http://localhost:8080` | bleak-node REST base (bleak-node's own `BLEAK_NODE_ADDR` default); used by the helper and the Vite dev proxy |
| `HELPER_PORT` | `8787` | helper listen port |
| `HELPER_HOST_TOKEN` | dev placeholder | **change per deployment**; gates `POST /rooms` |
| `HELPER_DB_PATH` | `data/helper.db` | mapping SQLite file |
| `INVITE_URL_BASE` | `http://localhost:5173/` | join-page base used in invite links/QR |
| `VITE_BLEAK_NODE_URL` | *(empty)* | bake an absolute API base only for split deployments |
| `VITE_HELPER_URL` | *(empty)* | bake an absolute helper base only for split deployments |

Local dev: `make setup` → `make dev` (helper :8787 + web :5173, concurrently;
Vite proxies `/api` and `/h`). Start bleak-node yourself when you need real
data (its own repo; we never run or modify it from bleak-web).

**CI behavior:** `make lint && make test && make build` must be green on any
branch the process merges to `dev`. All three are root-level npm scripts over
the workspaces; they need no network (deps installed by `make setup`) and no
running services (fetch is injected in tests; QR encode is mocked).

## 8. What is mocked in v1 (do not invent your own shapes)

Workers must use exactly these shapes; the design phase styles them, the
backend swap comes later:

1. **Interests (mock model)** — placeholder for the future backend field
   (owner's plan: array of short hobby labels + emoji). Mock shape:
   ```ts
   interface Interest { id: string; label: string; emoji: string; }
   type Interests = Interest[]; // user-profile extension, NOT sent to bleak-node in v1
   ```
   Where it lives: client-side only (profile store), rendered on persona
   cards/badge. When bleak-node ships the real field, replace the mock store
   with the API field — keep the `Interest` shape as the adapter target.
2. **Contact exchange hooks** — not built (backend gap, Concept §1). Chat
   detail routes must leave a clearly-marked extension point (a "share
   contact" CTA stub is allowed in the design only as an explicitly disabled
   element labeled as coming-later), no fake flows.
3. **Avatars/icons** — pixel-art assets from `docs/refs/` guidance are
   placeholders in the scaffold (`static/icons/icon.svg`). The design phase
   supplies real assets; component code should reference them by path, not
   inline mock art.
4. **Persona import** from a previous room (Concept §1): the API has no copy
   endpoint; v1 flow = read the old room's user (`getRoomUser`) and re-create
   it in the new room (`createRoomUser`). Treat "import" as this client-side
   copy — do not expect a backend feature.

## 9. Commands (canonical)

```bash
make setup          # npm install (all workspaces)
make dev            # helper :8787 + web :5173 (proxied /api, /h)
make dev-web        # only the SPA dev server
make dev-helper     # only the helper
make build          # tsc (api-client, helper) + svelte-check + vite build → apps/web/build
make test           # vitest in all workspaces (39 tests at scaffold time)
make lint           # eslint . (flat config, whole monorepo)
make preview        # serve apps/web/build statically (SPA fallback check)
```

The three CI gates are exactly `make lint`, `make test`, `make build`.

---

## 10. v2 — Credentials architecture (addendum, 2026-11-15)

Architect instance: `81037a13`. Authority chain: `docs/Concept.md` §6
(owner-approved 2026-11-15) → bleak-node `CONCEPT.md` §7.1–§7.4 and
`docs/PLAN-ownership-tokens.md` (WP-1…WP-7) → this addendum. The **owner
implements the bleak-node backend**; bleak-web ships the **client side** of
the credential model. This section is concrete enough for a DESIGN rev. 3
and a TZ pass to be derived without asking anyone anything.

**Contract status (binding caveat):** `/mount/bleak-node/docs/swagger.json`
is still v0.1.0 — the credential endpoints are decided (CONCEPT §7 / PLAN
WP-4) but not yet in swagger (WP-6 pending). Client types are written from
CONCEPT §7 / WP-4; **when WP-6 lands, `packages/api-client/src/types.ts` is
reconciled against the updated swagger.json** — field names below marked
*(TBD)* are the ones swagger will fix. Everything unmarked is decided text
from the binding sources.

### 10.1 Credential model — who holds what, where

| Credential | Generated by | Held by (client) | Storage | Server keeps |
| --- | --- | --- | --- | --- |
| **Persona token** | the client at persona creation / rotation (WebCrypto) | the persona's owner | `bleak.identity.token`, mirrored in `bleak.tokenVault` | SHA-256 hash on the user record |
| **Room token** | the client at room creation / rotation | the host | `bleak.hostRoom.roomToken` | SHA-256 hash on the room record |
| **One-time creation token** | the **operator** (bleak-node CLI, WP-4.6) | the host, transiently | typed into the masked gate input, **never stored** | hash in `create_tokens`; consumed on use |
| **One-time mutual code** | the badge owner's client | the badge owner | `bleak.mutualCode` (raw, needed to re-render the QR) | SHA-256 hash (`mutual_code_hash`; NULL = consumed) |
| **Invite code (native)** | bleak-node at room creation / host minting | attendees (public) | the code itself is not secret (stored plain server-side) | `room_invites` table |

Rules (from §7.4): all client-generated tokens are **≥ 32 random bytes,
base64url**, sent **raw** only at creation/rotation; transport is
`Authorization: Bearer`. The **mutual-code registration is the one
exception** — it carries the SHA-256 **hash**, never the raw code. Invite
codes stay 6-digit plain (hashing adds nothing against brute force; join
attempts are rate-limited server-side).

### 10.2 `@bleak/api-client` v2 extensions (amends §4)

**Bearer attachment — decision: explicit per-call credentials, enforced by
test.** Every `BleakClient` method that must authenticate gains a final
optional `options?: { token?: string }` parameter (or an explicit argument
where the call already has options); when a token is present the transport
attaches `Authorization: Bearer <token>`. The client stays pure (no store
imports, no globals) and the attachment policy is explicit at every call
site. Rationale over a client-global `setCredential(fn)`: a global injector
silently sends tokens on public reads too, and a per-call signature makes
the §10.2 policy table mechanically checkable.

**Attachment policy (mirrors Concept §6.1 / PLAN WP-3) — the contract the
web layer must satisfy:**

| Call | Credential attached |
| --- | --- |
| `PUT/DELETE /api/room/{room}/user/{address}`, `PUT …/greeting`, `POST …/greeting/regenerate` | persona token |
| `POST /api/handshake` | the `from` persona's token |
| `POST /api/handshake/mutual` | the scanner's persona token |
| `POST …/user/{address}/mutual-code` | persona token (body = the code's **hash**) |
| `POST …/user/{address}/token`, `POST /api/room/{address}/token` | the **current** persona/room token (body = the new raw token) |
| Gated reads: own persona fields incl. `private_bio` (`getRoomUser` **with** token), `GET /api/handshake/user/{address}`, `GET /api/user/{address}/chat`, room-scoped equivalents | persona token |
| `GET /api/chat/{address}`, `GET /api/chat/{address}/message`, room-scoped chat/message reads, `DELETE /api/chat/{address}/message`, `POST /api/chat/{address}/kickoff` | participant persona token **or** room token (context-dependent — §10.3) |
| `PUT/DELETE /api/room/{address}`, invite management (`POST/GET /api/room/{address}/invite`, `DELETE …/invite/{code}`) | room token |
| `POST /api/room` | one-time creation token in the **header** *(header name TBD — proposed `x-create-token`; fixed by WP-6)* + client-generated room token in the body |
| `POST /api/room/{room}/user` | **no header** (join) — body carries `invite_code` + the raw persona token |
| Public reads (`GET /api/room`, `GET /api/room/{address}`, `GET /api/room/{room}/user`, untokenized `getRoomUser`) | none — **must not** carry a token |

`private_bio` is now returned **only** on a token-matched `getRoomUser`;
the UI never assumes it in public contexts (import gets it from the vault
persona's stored token, §10.6).

**New request/response types (`src/types.ts`):**

```ts
// Persona creation (join) — supersedes the v1 CreateUserRequest body.
interface CreateUserRequestV2 {
  name: string; public_bio?: string; private_bio?: string;
  invite_code: string;      // the resolved 6-digit code (Concept §6.2)
  token: string;            // client-generated persona token, RAW (server hashes)
}

// Room creation (host) — creation token in the header, room token in the body.
interface CreateRoomRequestV2 {
  name: string; description?: string; language?: string;
  token: string;            // client-generated room token, RAW
}

interface MutualHandshakeRequest { user_address: string; mutual_code: string }
// POST /api/handshake/mutual → 201/200 { handshake… } · 410 code used ·
// 403 income rule (or wrong record) · 404 unknown user · 401

interface MutualCodeRegistration { mutual_code_hash: string }  // field name TBD (WP-6)
interface TokenRotationRequest { token: string }               // raw new secret
interface InviteMintRequest { expires_at?: string }            // ISO; default 24 h server-side
interface Invite { code: string; created_at: string; expires_at: string }  // shape TBD (WP-6)

// User model gains the derived liveness flag (§7.3.2) on token-gated reads:
// mutual_code_live?: boolean  (derived server-side from mutual_code_hash)
```

**New client methods (`src/client.ts`):**

| Method | Maps to |
| --- | --- |
| `createMutualHandshake(token, { user_address, mutual_code })` | `POST /api/handshake/mutual` |
| `registerMutualCode(room, address, token, mutual_code_hash)` | `POST /api/room/{room}/user/{address}/mutual-code` |
| `rotateUserToken(room, address, currentToken, newRawToken)` | `POST /api/room/{room}/user/{address}/token` |
| `rotateRoomToken(address, currentRoomToken, newRawToken)` | `POST /api/room/{address}/token` |
| `mintInvite(address, roomToken, { expires_at? })` | `POST /api/room/{address}/invite` |
| `listInvites(address, roomToken)` | `GET /api/room/{address}/invite` |
| `revokeInvite(address, code, roomToken)` | `DELETE /api/room/{address}/invite/{code}` |
| `createRoom(request, createToken)` | `POST /api/room` — header = creation token, body = `CreateRoomRequestV2` |
| `createRoomUser(room, requestV2)` | `POST /api/room/{room}/user` — `CreateUserRequestV2` |

Error semantics: `ApiError` already carries the status — **no new error
class**. 401 (missing/invalid token), 403 (valid token, wrong record — or
the income>outcome rule), 410 (mutual code already used) are surfaced as
`ApiError.status`; pages map them to UI states (§10.7–§10.9).

**Attachment-policy test (new, in `packages/api-client/tests/`):** a
table-driven test asserting (a) each credentialed method sends the Bearer
header when a token is passed, (b) public reads accept **no** token
parameter at the type level, (c) the mutual-code registration sends the
**hash**, never a raw code, (d) 401/403/410 responses map to `ApiError`
statuses verbatim. This test is the enforceable form of the §6.1 mirror.

### 10.3 Web API layer — credential auto-injection + global 401 gate

New shape of `apps/web/src/lib/api/client.ts` (the singleton the pages
import). **Two credential contexts, two singletons:**

| Export | Context | Auto-injected credential | 401 behavior |
| --- | --- | --- | --- |
| `api` | attendee (persona) | `identity.token` on every persona-credentialed call (policy table §10.2) | **global gate** (below) |
| `hostApi` | host (room) | `hostSession.roomToken` on room-token calls | clears the host room session (back to the create form); no identity touch |

- **Auto-injection map (per singleton):** a declared set of method names
  per credential (`PERSONA_TOKEN_METHODS`, `ROOM_TOKEN_METHODS`, chat-read
  methods configurable per call). Pages never pass tokens manually — the
  map is the single place the §10.2 policy lives in the web app, mirrored
  by a unit test against the same table.
- **Context-dependent calls** (chat reads/clear/kickoff: participant or
  room token): `api` injects the persona token; `hostApi` injects the room
  token. The host drill-down uses `hostApi` for member chats, clear and
  kickoff (§6.6 "full room control").
- **Global 401 policy hook (Concept §6.1) — where it lives:** the `api`
  singleton wraps every method: catch `ApiError` with `status === 401` →
  `clearIdentity()` → `sessionStorage.setItem('bleak.authNotice', '1')` →
  `goto('/')` → rethrow (so no stale error UI flashes under the redirect).
  The `/` route on mount checks `bleak.authNotice`, renders the §6.1
  notice — RU «У этой персоны нет действительного ключа доступа —
  присоединитесь заново по коду события.» / EN "This persona has no valid
  access credential — join again with the event code." — announced
  `aria-live="polite"`, then clears the key. sessionStorage (not a store)
  so the notice survives the navigation. **Because only credentialed calls
  carry tokens, every 401 reaching the gate is the invalid-credential
  case; there is no other 401 source.** The `hostApi` gate is symmetric:
  401/403 on room-token calls clears `bleak.hostRoom` and resets the host
  console (the room token was revoked or the room deleted).
- **Escape hatch (documented, narrow):** the transcript page's
  participant→host fallback (below) needs to *catch* a 401 before the gate
  fires. The module therefore also exports the raw, ungated client (e.g.
  `apiRaw`); its use is restricted to that fallback flow — reviewed as
  such.
- **Transcript viewer fallback:** `/chats/[address]` fetches messages with
  the persona token (participant context). On `ApiError` 401/403 **where a
  `hostSession.roomToken` exists**, it retries once with the room token
  (host observing a member's dialog, §6.6) via `apiRaw` — a host-opening
  401 there clears the host room session, not the identity. Without a room
  token the §6.1 gate applies (persona credential invalid).

**Host drill-down data (§6.6):** member chats are read with the **room
token**; in v2 the preferred call is the room-scoped
`listChatsOfRoomUser`/`listRoomUserChatMessages` — which per WP-3 requires
the *member's* token unless the **flag 6.9a amendment** (room-scoped reads
accept the room token; Concept default: **yes**) is implemented. The plain
`getChat`/`listChatMessages` with the room token always works (WP-3 allows
participant-or-room on those). **Decision: implement drill-down on the
plain chat reads with the room token** (amendment-independent), and add
room-scoped reads only when 6.9a lands. Handshake sent/received counts per
member remain conditional on 6.9a (no viable endpoint otherwise) — the UI
ships without counts, exactly per §6.6.

### 10.4 State stores (amends §3)

| Store | File | Shape | Persistence |
| --- | --- | --- | --- |
| `identity` *(amended)* | `lib/stores/identity.ts` | `{ roomAddress, userAddress, token } \| null` — `token` = the persona token | `localStorage` `bleak.identity` |
| `hostSession` *(reshaped)* | `lib/stores/hostSession.ts` | `{ roomAddress, roomToken, code }` | `localStorage` `bleak.hostRoom` |
| `tokenVault` *(new)* | `lib/stores/tokenVault.ts` | append-only array of `VaultEntry { roomAddress, userAddress, token, name?, savedAt }` | `localStorage` `bleak.tokenVault` |
| `mutualCode` *(new)* | `lib/stores/mutualCode.ts` | `{ userAddress, code } \| null` — the raw one-time code backing the badge QR | `localStorage` `bleak.mutualCode` |
| `locale`, `chatsSeen`, `interests` | — | unchanged | unchanged |

Decisions:

- **`identity` gains `token`** and the identity write happens only after a
  successful credentialed creation (the token was generated *before* the
  create call). **Init-time legacy drop:** a persisted v1 identity without
  `token` is cleared on load — v1 personas predate credentials, the owner
  accepts they are unrecoverable (all current data is test data; §6.1),
  and the operator's migration script writes raw tokens to a gitignored
  operator file that no client ever sees. Waiting for a 401 would only
  delay the inevitable redirect; dropping at init is the same outcome,
  earlier and quieter.
- **`hostSession` reshaped:** `bleak.hostRoom` = `{ roomAddress, roomToken,
  code }`. The one-time **creation token is never persisted** — it is
  consumed server-side on use (§7.1.7). `bleak.hostToken` /
  `hostToken` writable are **removed** (the helper gate is retired,
  §10.10). Room-token **rotation** (host settings, §6.1) updates the
  stored entry. Share-kit restore on revisit uses `code` + `roomAddress`;
  the room `name`/`description` come from the public `getRoom` read. The
  v1 `HostRoomRef.roomName`/`inviteUrl` fields are dropped — `invite_url`
  is computed client-side (`{INVITE_URL_BASE}?code={code}`, §10.9).
- **`tokenVault` (Concept §6.2):** every persona **created on this device**
  (join *and* import — import creates a new persona) appends
  `{ roomAddress, userAddress, token, name, savedAt }`. **Append-only list,
  rotation-updated entries:** token rotation rewrites the matching
  entry's `token` in place (keyed by room+user) so the vault never holds a
  dead credential; entries are never deleted — a persona deleted
  server-side (left room) keeps its entry, and importing it fails with the
  server's error surfaced (an honest dead-entry state, not a hidden
  mutation of the vault). Consumed by the import flow (§10.6).
- **`mutualCode`:** the badge QR must re-render after a reload, but the
  server stores only the hash — so the raw code persists client-side next
  to the identity, validated against `identity.userAddress` on load
  (mismatched/stale entry → treated as no code; the profile page
  re-registers a fresh one). Cleared with the identity.
- Join pending-code in `sessionStorage` (`bleak.pendingCode`): already
  superseded by the in-memory join state (v1 build); **drop the key** in
  v2 unless a worker finds a concrete path that needs it.

**Security invariant for all four stores:** credentials live **only** in
these localStorage keys (§10.11).

### 10.5 Crypto utilities — `apps/web/src/lib/crypto/secrets.ts` (new)

Small zero-dependency module (no external crypto lib — WebCrypto is
universal in the target evergreen browsers):

- `generateTokenSecret(): string` — 32 random bytes via
  `crypto.getRandomValues(new Uint8Array(32))`, encoded **base64url**
  (RFC 4648 §5, padding stripped). Used for persona tokens, room tokens
  (≥ 32 bytes per §7.4).
- `generateMutualCode(): string` — 16 random bytes base64url (~22 chars,
  URL-safe for the QR payload). The format is client-chosen: the server
  only ever sees its hash and compares hashes.
- `sha256Hex(input: string): Promise<string>` — `crypto.subtle.digest`
  over `TextEncoder` bytes → lowercase hex. Used **only** to hash the
  mutual code for registration (§7.4: the refresh body carries the hash).

**Secure-context note:** `crypto.subtle` (and `getRandomValues` at full
strength) require a secure context — the **same HTTPS requirement as the
camera** (DESIGN §2.7). Dev on `localhost` is secure; a plain-HTTP LAN
preview loses both camera and hashing. Documented in the join/host
deployment notes; no polyfill (degrading crypto would fake a security
property).

**Test strategy:** the module takes its randomness/digest via an injectable
source object (default = WebCrypto) — `{ randomBytes(n): Uint8Array;
digestHex(data): Promise<string> }` or equivalent. Tests use (a) a fixed
byte array / seeded PRNG fake for generation (assert base64url charset, no
padding, correct length, determinism per fake), (b) precomputed SHA-256
test vectors (NIST examples) against the real implementation when available
in the test environment, plus a tiny pure-JS SHA-256 reference in tests for
offline determinism, (c) a round-trip test that `sha256Hex` output matches
the hash the api-client test fixture computes independently.

### 10.6 Join flow v2 (`/`)

Changes to the v1 flow (DESIGN §3.1 stays the UX base; §6.2 redefines the
credential steps):

1. **Resolution via the adapter seam (Concept §6.9b).** The helper mapping
   is retired; the backend shape for code → room resolution is TBD. New
   module `apps/web/src/lib/api/invite-resolve.ts` exports the seam:
   `resolveInviteCode(code: string): Promise<{ roomAddress: string }>` — a
   single function the join flow calls; its implementation adapts to
   whatever bleak-node ships (candidate shapes named in §6.9b: a small
   public resolve endpoint; globally-unique codes resolvable another way).
   The join flow (`lib/join.ts` `JoinClients.resolveInvite`) is
   re-pointed at the seam — **no page rewrite** when the backend shape
   lands. Room preview stays `getRoom` + `listRoomUsers` (public reads).
2. **Persona creation** sends `CreateUserRequestV2`: `invite_code` (the
   already-resolved code) + the **raw client-generated token**. Sequence:
   generate token (`generateTokenSecret`) → `createRoomUser` → on success
   `saveIdentity({ roomAddress, userAddress, token })` **and append the
   vault entry** → navigate `/room`. An invalid/expired/revoked code
   blocks creation with the explicit inline error (§6.2 copy, RU/EN per
   DESIGN's copy table conventions); a 409 duplicate-name keeps the v1
   state.
3. **Import is vault-driven (§6.2):** the v1 server-room picker
   (`listRooms` → room's user list) is **replaced** by the device vault
   list: each entry renders (room address, persona name, saved date) →
   selecting one fetches the old persona **with its stored token**
   (`getRoomUser` credentialed — full fields incl. `private_bio`) →
   prefills the form → submit re-creates it in the new room with
   `invite_code` + a **new** generated token; both vault entries (old
   persona untouched, new persona appended) remain. Without a stored token
   the private fields are unreadable — which is exactly the impersonation
   risk v2 closes; there is no fallback to token-less import. Import of a
   dead persona (deleted server-side) surfaces the server error; the vault
   entry is not removed (append-only).
4. **Deep links:** `/?code=NNNNNN` unchanged (prefill + auto-submit,
   resolution via the seam). `/?u={userAddress}&m={mutualCode}` with an
   identity runs the **full scanner mutual routine including the confirm
   card** (TZ v1 flag 5 reading, kept); `/?u=` **without** `m` degrades to
   a single-direction handshake request (§10.7). Without an identity,
   `u`/`m` params are ignored (normal join card) — same as v1.
5. **401 notice on `/`:** the route consumes `bleak.authNotice` on mount
   (§10.3) and renders the §6.1 copy before the code-entry card state.

### 10.7 Scanner v2 (context b) — server-mediated mutual handshake

**Delete the v1 two-POST routine.** `lib/scanner/mutualHandshake.ts` is
rewritten (module stays, contract changes); the `classifyPersonaScan`
"already-mutual skip" precheck is **removed** — per §6.4/§7.3.2 an
already-mutual pair still burns the code, so the client never special-cases
it: it calls the endpoint and treats success as success (no second chat is
created server-side).

New routine (`lib/scanner/mutual.ts`, pure + unit-tested, component only
renders states):

- **Prechecks kept (client-side UX only):** own QR (`u === identity.userAddress`)
  → info state, no request; foreign persona (`u` not in the member list)
  → error state, no request. Both verbatim v1 semantics (DESIGN §3.8
  steps 1–2).
- **Confirm card** (unchanged copy) → single call:
  `api.createMutualHandshake(identity.token, { user_address: u, mutual_code: m })`.
- **Result states:**
  - *success* → refresh `listChatsOfUser` (token-authenticated gated read),
    locate the chat with `u`, CTA «Открыть диалог» → `/chats/{address}` (or
    `/chats` fallback on eventual-consistency miss) — v1 behavior kept;
  - **410** → new stale-code state, RU «Код уже использован — попросите
    обновить QR на карточке.» / EN "Code already used — ask them to refresh
    their badge QR." (Concept §6.4) + «Сканировать снова» / close;
  - **403** → income-rule state (§6.5): RU «Лимит исходящих хендшейков —
    сначала получите рукопожатия в ответ.» / EN "Outgoing handshake limit
    reached — receive handshakes first." + server text appended when
    present. The code is **not** consumed on a rule rejection (§7.3.4) —
    the state copy must not imply the badge burned;
  - `NetworkError` → retry state (retry re-sends `u`+`m`; a **failed**
    attempt never burned the code — only successful verification does — so
    retry is safe); other `ApiError` → server text + retry.
- **Deep link `/?u=` without `m`:** single-direction
  `POST /api/handshake` (`from` = me — the call carries my Bearer, WP-3),
  idempotent per pair; 200/201 success; 403 → the §6.5 income-rule state;
  no confirm card beyond the standard one (it is one handshake, not a
  mutual pair).
- `lib/scanner/payload.ts` parses `u` **and** `m` (binding payload
  `{base}?u={address}&m={mutual_code}`); invite-QR parsing (`?code=`) and
  the invalid-QR error state are unchanged. Detection/decode
  (`BarcodeDetector` + lazy `jsqr`), camera lifecycle, a11y: unchanged
  from v1.

### 10.8 `/profile` — live badge QR + token rotation

- **Badge QR payload (v2):** `{INVITE_URL_BASE}?u={userAddress}&m={mutualCode}`
  — `personaQrPayload` in `lib/components/profile/qr.ts` gains the `m`
  parameter, sourced from the `mutualCode` store (§10.4).
- **Live QR (§6.3):** while the profile page is open, poll the
  **token-gated** `getRoomUser` (persona Bearer — this is a gated read for
  `private_bio` and the derived flag) for `mutual_code_live`; `false`
  → generate a fresh code → `registerMutualCode(room, address, token,
  sha256Hex(code))` → update the `mutualCode` store → re-render the QR.
  Registration failure keeps the last QR; the next tick retries (the flag
  still reads false). Poller etiquette unchanged: instantiated in the
  route file, `stop()` on teardown, cadence ~3–5 s (the badge is a
  displayed page, not a background service).
- **Token rotation UI (§6.1):** profile settings gains «Regenerate access
  token» / RU equivalent → confirm dialog (old devices locked out —
  accepted consequence) → generate new secret →
  `rotateUserToken(room, address, identity.token, newRaw)` (Bearer =
  current) → replace `identity.token` + the matching `tokenVault` entry's
  token. No re-registration of the mutual code is needed (the code hash is
  bound to the user record, not the token).
- All other profile reads/writes attach the persona token per §10.2; the
  stats calls (`listHandshakesOfUser`, `listChatsOfUser`) are now gated
  reads carrying the token.

### 10.9 `/host` — console v2

- **Token gate replaced (§6.6):** the gate input now takes the
  operator-granted **one-time creation token** (masked, `type="password"`,
  autocomplete off, **never stored** — consumed server-side). On submit
  the client generates the room token (`generateTokenSecret`) and calls
  `api.createRoom(requestV2, createToken)` (creation token in the header —
  name TBD per §10.2). Wrong/consumed creation token (401/403) → RU «Токен
  отклонён.» inline state (kept v1 copy). The v1 `bleak.hostToken`
  persistence is removed with the helper gate.
- **`bleak.hostRoom` = `{ roomAddress, roomToken, code }`** (§10.4). Share
  kit restores from it; the room `name` for display comes from a public
  `getRoom`.
- **Invite management block (room-token authority):** list active codes
  (`listInvites`), mint (`mintInvite`, optional expiry — default 24 h
  server-side), revoke (`revokeInvite`). Minted codes join the share kit
  (code display + QR + link per code).
- **Share kit:** visually unchanged. The QR `<img>` stays
  `GET /h/rooms/{code}/qr` (helper, §10.10 — now stateless); the invite
  link is computed client-side as `{INVITE_URL_BASE}?code={code}` (the
  native code — no helper payload needed); «Присоединиться как участник» →
  `/?code={code}` unchanged.
- **Live view:** members poll (public `listRoomUsers` + `getRoom`) every
  5 s, unchanged. **Member drill-down reworked (§6.6):** chats of a member
  via **room-token** chat reads (plain `getChat`/`listChatMessages` with
  the room token — §10.3 rationale), with **clear + kickoff** from the
  drill-down (`clearChatHistory`, `kickoffChat` — participant-or-room per
  WP-3, host context = room token). Handshake counts per member: only if
  the 6.9a amendment lands — ship without (§6.6).
- **Room settings / delete:** `PUT`/`DELETE /api/room/{address}` with the
  room token; 401/403 there → hostApi gate (§10.3). Room-token rotation
  («Regenerate room token», host settings) → `rotateRoomToken` → update
  the stored entry.

### 10.10 Helper service (amends §6) — exactly what is deleted vs kept

| Item | v2 disposition |
| --- | --- |
| `POST /h/rooms` (creation + mapping + x-host-token gate) | **deleted** — room creation moves to the host console calling bleak-node directly (creation token + room token, §10.9) |
| `GET /h/rooms/:code` (mapping resolve) | **deleted** — resolution is the backend seam (§10.6) |
| `x-host-token` gate + `HELPER_HOST_TOKEN` env | **deleted** |
| `src/db.ts` (invites SQLite store), `HELPER_DB_PATH`, `data/helper.db` | **deleted** — the helper becomes stateless |
| `src/codes.ts` (code minting/validation) | minting **deleted**; the 6-digit validation helper **kept** (the QR route still validates input) |
| `GET /rooms/:code/qr` | **kept, reworked stateless:** validate 6 digits (no mapping lookup — unknown codes are renderable), return the PNG of `{INVITE_URL_BASE}?code={code}`. Stays until QR rendering moves server-side (§6.7) |
| `GET /health` | kept |
| `bleakFetch` dep (bleak-node calls from the helper) | **deleted** — the helper no longer talks to bleak-node at all |
| `INVITE_URL_BASE` env | kept (QR payload) |
| `BLEAK_NODE_URL` env | helper no longer needs it (web/proxy concern only) |

Tests: `apps/helper/tests/helper.test.ts` and `codes.test.ts` shrink to the
health + stateless-QR surface (QR encoder stays mocked/injectable).

### 10.11 Security rules (additions to the §1 module boundaries)

- **Token custody:** persona tokens, room tokens, the creation token and
  one-time mutual codes exist **only** in the §10.4 localStorage keys (and
  in memory for the duration of a call). Never logged (no `console.*` of
  credential values), never sent to the helper (the helper receives only
  public invite codes/URLs), never embedded in URLs beyond the binding QR
  payload of the mutual code (which is *designed* to be scanned once),
  and never rendered as text — the only visible credential is the host's
  **masked** creation-token input (`type="password"`, autocomplete off).
- The **raw mutual code** is displayed only inside the badge QR image
  (`uqr` SVG) — never as copyable text.
- **Constant-time comparison is a backend concern** (bleak-node WP-2,
  `crypto/subtle`); the client does not compare hashes and is noted, not
  implemented, here.
- `apps/helper` **never handles credentials** post-v2 (stateless QR only);
  the §1 rule "helper talks to bleak-node through its own injected fetch"
  becomes moot — the helper makes no bleak-node calls at all.
- api-client stays credential-storage-agnostic: it accepts tokens as
  arguments and never reads `localStorage` (keeps §1's "no DOM/store
  assumptions in the package" boundary intact — the injection lives in the
  web layer, §10.3).

### 10.12 Scaffold impact list (for TZ sizing; no product code touched in this pass)

| Area | Files/modules the v2 build loop will touch |
| --- | --- |
| api-client | `packages/api-client/src/types.ts` (V2 request types, `mutual_code_live`, Invite), `src/client.ts` (Bearer param + 9 new methods), `tests/client.test.ts` (+ attachment-policy test) |
| web API layer | `apps/web/src/lib/api/client.ts` (auto-injection maps, `api`/`hostApi`/`apiRaw`, 401 gates), `lib/api/helper.ts` (drop `resolveInvite`/`createRoom`; keep `inviteQrUrl`), **new** `lib/api/invite-resolve.ts` (6.9b seam) |
| stores | `lib/stores/identity.ts` (+token, legacy drop), `lib/stores/hostSession.ts` (reshape, drop hostToken), **new** `lib/stores/tokenVault.ts`, **new** `lib/stores/mutualCode.ts`; `chatsSeen.ts`, `interests.ts` untouched |
| crypto | **new** `apps/web/src/lib/crypto/secrets.ts` + tests |
| scanner | `lib/scanner/mutualHandshake.ts` → rewritten/replaced by `lib/scanner/mutual.ts` (single endpoint, 410/403 states), `lib/scanner/payload.ts` (`u`+`m`), `lib/scanner/decode.ts` untouched; deep-link join machine (`lib/join.ts`) |
| routes | `routes/+page.svelte` + `lib/components/join/**` (V2 create, vault import, notice, `?u&m`), `routes/profile/+page.svelte` + `lib/components/profile/**` (live QR, rotation), `routes/host/+page.svelte` + `lib/components/host/**` (creation token, invite mgmt, room-token drill-down), `routes/room/+page.svelte` (scanner result states), `routes/chats/**` (token on gated reads, viewer fallback) |
| helper | `apps/helper/src/{app,env}.ts` (delete rooms/gate, stateless QR), delete `db.ts`, trim `codes.ts`, tests rewrite |
| i18n | `lib/i18n/{ru,en}.ts` — keys for: 401 notice, 410 stale code, 403 income rule, rotation UI, invite management, vault import list, creation-token gate (both dictionaries, parity-enforced) |
| config | `.env.example` — drop `HELPER_HOST_TOKEN`, `HELPER_DB_PATH`; `INVITE_URL_BASE` stays (helper QR); nothing new for the web app |
| Makefile / tooling | **unchanged** — the three CI gates and dev commands are v2-neutral |

Sizing hint for the TZ pass: api-client + web API layer + crypto are one
foundation task; stores a second; then per-flow tasks (join+import,
scanner, profile live-QR/rotation, host console, helper trim) mirroring the
v1 TZ's task-per-worker-instance shape.

### 10.13 Flags & risks (for the concept agent / design rev. 3)

1. **Creation-token header name TBD** (proposed `x-create-token`) and the
   **body field names** for the mutual-code hash, room-create token and
   invite mint response are fixed only when bleak-node's WP-6 lands —
   client types marked *(TBD)* in §10.2 must be reconciled against
   swagger.json then. The api-client isolates all of them, so the impact
   is one file.
2. **Flag 6.9a dependency:** host drill-down handshake **counts** and the
   room-scoped member reads need the room-token amendment; the design
   ships counts-less drill-down on plain room-token chat reads
   (amendment-independent), per §6.6. DESIGN rev. 3 must not promise
   counts.
3. **Flag 6.9b seam:** if the backend ships **no** code→room resolution
   endpoint, the join flow's room preview needs an alternative (worst
   case: resolve *after* persona creation and drop the pre-create
   preview, or the operator documents a resolve route). The seam keeps
   this a one-function change; flagged so the owner picks a shape before
   the build loop.
4. **Legacy personas are unrecoverable in clients** (init-time identity
   drop; operator-only migration file) — owner-accepted (§6.1); the join
   page's 401 notice is the only legacy-facing UI.
5. **Secure-context coupling:** camera (scanner) *and* `crypto.subtle`
   (token/code generation) both require HTTPS — a plain-HTTP deployment
   loses join/create entirely, not just scanning. The deployment note in
   §10.5 should reach the host docs.
6. **Token rotation locks out other devices** by design (§6.1) — surface
   it in the rotation confirm copy (design rev. 3 writes it).
7. **`mutualCode` localStorage persistence** is my decision (the badge
   must re-render after reload while the server keeps only the hash);
   alternative was session-only memory with a re-register-on-load — more
   churn per visit, no security gain (the raw code is single-use and
   bounded by the server hash anyway). Reversible in one store file.
8. **Invite expiry minting UX** (settable expiry, default 24 h) exposes a
   datetime input in the host UI — DESIGN rev. 3 must specify it; nothing
   in v1 DESIGN covers it.

---

*End of §10 — v2 credentials addendum, architect `81037a13`, 2026-11-15.
DESIGN rev. 3 and the v2 TZ pass derive from Concept §6 + this section; the
TZ pass follows design rev. 3 + owner approval.*
