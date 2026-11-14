# bleak-web — Architecture

Architect instance: `acff3ab8` (2026-11-14). Foundation: `docs/Concept.md`
(owner-approved v1). API contract: `/mount/bleak-node/docs/swagger.json`
(bleak-node v0.1.0). Downstream agents (design, process, workers) must be able
to work from this document without asking the user anything.

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

| Store | File | Shape | Persistence |
| --- | --- | --- | --- |
| `identity` | `lib/stores/identity.ts` | `{ roomAddress, userAddress } \| null` | `localStorage` `bleak.identity` |
| `locale` | `lib/i18n/locale.ts` | `'ru' \| 'en'` (RU default) | `localStorage` `bleak.locale` + `<html lang>` |
| join code | session flow | validated 6-digit code | `sessionStorage` `bleak.pendingCode` (until persona creation feature lands) |
| live room data | per-page, via `Poller` | polled snapshots (users, handshakes, chats, messages) | none (always fresh) |

Rules: no global mutable singletons beyond these stores; polled page state
stays in the owning route; `Poller.stop()` must be called on route teardown.

## 4. Data layer — `@bleak/api-client`

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
