# bleak-web v2 — Verification sweep (TZ2-08, verification-only)

Worker instance `5f1ba636` · 2026-11-16 · branch `feature/5f1ba636-verify-v2`
(worktree `/tmp/opencode/wt-5f1ba636`, tip = post-wave-2 `dev` with all of
TZ2-01…TZ2-07 merged; branch verified via the worktree gitdir HEAD — see the
environment note below).

**Environment note (affects what this sweep could run):** the `shell` tool is
permission-denied for this session (tool-level; tested with `git`, `make`, and
plain commands) and the Code Mode catalog exposes no shell/process substitute.
Consequently:

- **No gate command was executed by this sweep.** `make test` / `make build`
  were **not re-run**. The suite state and bundle numbers below are recorded
  from (a) static inspection, (b) the committed worker logs of the wave-2
  handovers, and (c) one-shot `grep` runs performed with the read-only grep
  tool. The process wave-CI (`make lint && make test && make build` on `dev`)
  is the authoritative gate for this task.
- **No git command was executed.** Branch identity was verified by reading
  `.git` → `/workspace/.git/worktrees/wt-5f1ba636/HEAD` →
  `ref: refs/heads/feature/5f1ba636-verify-v2`. **The files of this report are
  written in the worktree but could not be committed** (git commit is shell).
  The process must commit `docs/verification-v2.md` +
  `docs/logs/5f1ba636.log` (or grant shell to a resumed session) before merge.
- One-shot greps/scripts were run during the sweep and their outputs are
  recorded inline below — no new test files, no product code (the
  verification-only amendment of TZ2-08 is honored).

Delivered test map (committed suites at sweep time):
`apps/web/tests/` — 40 `*.test.ts` files (i18n, join-machine/join-flow,
nav-guard, mutual-handshake/qr-payload/qr-scanner, room-radar/people-page/
handshake-sheet, chats-page/chats-view/chats-seen, transcript-page,
profile-page/profile-domain/qr-roundtrip, host-console/host-session/
member-drilldown, storage-inventory/identity/token-vault/mutual-code/
crypto-secrets, api-contexts, sweep, poller, kit/confirm-dialog/digit-input/
code-input/avatar/relationships/radar-placement/tabbar/interests-store/
qr-decode/kit) + `packages/api-client/tests/client.test.ts` +
`apps/helper/tests/{helper,codes}.test.ts`.

---

## 1. Suite state (TZ2-08 discipline: one `make test` — NOT executable here)

| Check | Result | Source |
| --- | --- | --- |
| `make test` re-run | **not run** (shell denied) | this session |
| Named `it(` tests, grep count | web **484** · api-client **23** · helper **8** | one-shot grep `^\s*(it|test)\(` over `apps/web/tests/*.test.ts`, `packages/api-client/tests`, `apps/helper/tests` |
| Last recorded full-suite run | **green — "full make test, 491 passing"** (after the TZ2-07 bug-1 fixture fix) | `docs/logs/3bcc70ed.log` 2026-11-16T18:34:35Z |
| Wave-2 handover gates | lint/test/build green per worker logs (`3bcc70ed` "Final gates re-verified… make lint green … make build green", `79be6839` "Gates green after Part B: make lint OK … make test OK (461), make build OK (svelte-check 0 errors)") | committed logs |
| Wave-CI on `dev` | green (stated by the handover; the process re-runs the full three gates at wave-CI — authoritative) | handover record |

The grep count (484 web) vs the expected 491 web differs by ~7; the delta is
attributable to grep not catching parametrized/nested registrations and
setup-file helpers — the recorded runner totals (491 passing on the last full
run) are the numbers of record. **No test was added or modified by this
sweep.**

---

## 2. Credential-custody sweep (one-shot greps, recorded — nothing committed)

**(a) localStorage keys written by credential-handling code — PASS.**
One-shot grep `setItem|removeItem` over `apps/web/src` (17 hits, all
accounted for):

| Writing module | Key(s) |
| --- | --- |
| `lib/stores/identity.ts` | `bleak.identity` (set + remove) |
| `lib/stores/hostSession.ts` | `bleak.hostRoom` (set + remove ×2) |
| `lib/stores/tokenVault.ts` | `bleak.tokenVault` |
| `lib/stores/mutualCode.ts` | `bleak.mutualCode` (set + remove) |
| `lib/stores/chatsSeen.ts` | `bleak.chatsSeen` (non-credential UI state) |
| `lib/stores/interests.ts` | `bleak.interests` (mock store, §3.6 AC 5) |
| `lib/i18n/index.ts` | `bleak.locale` |
| `lib/api/client.ts` | `sessionStorage` flag `bleak.authNotice` (set on 401 gate) |
| `routes/+page.svelte`, `routes/host/+page.svelte` | `sessionStorage` flag removes (`bleak.authNotice`, `bleak.hostReset`) |
| `routes/chats/[address]/+page.svelte` | `sessionStorage` flag `bleak.hostReset` (host-view 401 path) |

The four credential keys are written only by their own store modules; the
`STORAGE_KEY` constants grep-confirm the exact names (`bleak.identity`,
`bleak.hostRoom`, `bleak.tokenVault`, `bleak.mutualCode`). Automated pins:
`storage-inventory.test.ts` ("the identity store writes only bleak.identity",
"…hostRoom…", "…tokenVault…", "…mutualCode…", "clearing writes no keys at
all", "the v1 host-token shim key bleak.hostToken is gone").

**(b) No `Authorization`-header construction outside `packages/api-client` +
the web api module — PASS.** One-shot grep `Authorization` (repo-wide,
excl. docs/tests): the only construction site is
`packages/api-client/src/client.ts:418`
(`headers['Authorization'] = \`Bearer ${credential.token}\``). In
`apps/web/src` the single hit is a doc comment in `lib/api/client.ts` (the
injection seam); zero header construction. Pinned by
`api-contexts.test.ts` — "persona mutations and gated reads carry
identity.token", "host room-token calls carry bleak.hostRoom.roomToken",
"public reads and the join create carry NO token at all", "apiRaw is the
ungated underlying client: no injection, no gate"; `client.test.ts` — "each
credentialed method sends exactly one Bearer header…", "omitting the optional
token sends no Authorization header at all".

**(c) No `console.*` receives a token/code value — PASS.** One-shot grep
`console\.(log|debug|info|warn|error)` over `apps/` + `packages/`: exactly one
hit, `apps/helper/src/index.ts:20`, printing only the listen port — no token,
code, or credential value ever reaches `console.*` (the one web hit for a
naive `console\.` grep is the word "console" inside a test-file doc comment).

**(d) The creation token is never written to any storage — PASS.**
Evidence: (i) `host-session.test.ts` — "no hostToken writable or
saveHostToken/forgetHostToken exports exist", "the deprecated
bleak.hostToken key is never written by the store module", "a persisted
v1-era reference WITHOUT a room token is unusable: no session, blob dropped";
(ii) `host-console.test.ts` — "shows the masked gate without a stored room;
the token is NEVER persisted (AC 1)", "a rejected/consumed token…nothing
stored (AC 2)"; (iii) the storage writers grep above shows no gate-token
write path; the host store persists only `{ roomAddress, roomToken, code }`
(`host-console.test.ts` "(AC 3)").

---

## 3. No-composer re-check (TZ2-06 Part D + grep)

- **Part D test green:** `transcript-page.test.ts` — "the transcript UI
  contains no input/textarea/send control; only back, kickoff (+confirm),
  contact stub" (DOM-level, on the last recorded full run green — §1).
- **One-shot grep sweep** `textarea|<input|type="text"|sendMessage|
  sendUserChatMessage|/api/message` over `apps/web/src/routes/chats/**` and
  `apps/web/src/lib/components/chats/**`: the **only** hit is an explanatory
  comment in `routes/chats/[address]/+page.svelte` ("…`POST /api/message` is
  never wired"). **PASS.**
- Source-level pins: `sweep.test.ts` — "the transcript route and its
  components contain no composer markup", "POST /api/message is never wired
  into any UI source (comments excluded)".

---

## 4. i18n parity + copy audit (item 4)

- **Parity over the final enlarged dictionaries**
  (`apps/web/src/lib/i18n/{ru,en}.ts`): `i18n.test.ts` — "ru and en have
  exactly the same keys", "every entry is a non-empty string in both
  languages" (green on the last recorded full run).
- **§4.7 copy table:** the binding checklist in `i18n.test.ts`
  (`DESIGN_4_7_KEYS`) now covers the rev. 3 table **including** the §2.8 gate
  notice (`auth.401.notice`), all §2.9 states (`hs.income_limit`,
  `scan.code_used`, `join.error.invite`), the host reset notice
  (`host.session_reset`) and the host creation-token gate copy
  (`host.gate.label`, `host.gate.note`) — "every §4.7 key exists in both
  dictionaries". Verbatim RU spot-checks: "spot-checks verbatim rev. 3 RU
  strings (v2 credentials scope)" (green), incl.
  `ru['auth.401.notice']` asserted against the binding Concept §6.1 copy.
- **Own one-shot grep of the v2-critical keys in both dictionaries** — every
  checked value matches DESIGN §4.7 verbatim (RU): `join.error.invite` «Код
  приглашения недействителен или истёк.», `scan.code_used` «Код уже
  использован — попросите обновить QR на карточке.», `hs.income_limit` «Лимит
  исходящих хендшейков — сначала получите рукопожатия в ответ.»,
  `chat.host_view` «Наблюдение хоста», `profile.qr.onetime` «QR одноразовый —
  после обмена он обновится сам.», `host.session_reset` «Доступ к комнате
  отозван — войдите заново с токеном создания.», `auth.401.notice` (binding
  Concept §6.1 copy, multi-line string asserted in the test). **No missing or
  deviating key found.**
- **Locale switch mid-flow:** `i18n.test.ts` locale store (persist/restore/
  corrupt-ignore), `profile-page.test.ts` — "the settings segmented control
  switches and persists app-wide" (same `LocaleControl` on `/` and
  `/profile`); `<html lang>` follows the store. Mid-flow switching while a
  flow is open (e.g. scanner overlay) re-renders through `translate($locale,…)`
  reactive bindings — recorded as a pending-owner visual confirmation
  (§8), no automated mid-flow-switch test exists (noted, not a gap against
  any AC wording).

---

## 5. Bundle budget re-check (item 5) — BUILD NOT RE-RUN (shell denied)

`make build` could not be executed in this session, so **no v2 gzip numbers
were produced first-hand**. Recorded instead:

- **Static import-boundary checks (automated, green on the last full run):**
  `sweep.test.ts` — "jsqr is only ever DYNAMICALLY imported (no static
  from-jsqr import anywhere)"; "uqr is imported only inside the /profile
  component tree"; `profile-domain.test.ts` — "no file outside the /profile
  route tree statically imports 'uqr'" + non-vacuity test ("the profile badge
  really does import uqr"). These pin **`jsqr` lazy-only** and **`uqr`
  profile-only** independent of the build output.
- **Carried-forward v1 build evidence** (worker `7ce1aafd`,
  `docs/verification-v1.md` §2): join route node 5.60 kB gzip; jsqr in
  exactly one dynamic-only chunk 47.49 kB; uqr only in the `/profile` node;
  heaviest page ≈ 68 kB gzip < 80. v2 added only code in already-split route
  trees and one new lazy scanner chunk — no budget-breaking surface is
  plausible, but the re-measurement is **pending** (process runs `make build`
  at wave-CI; if the owner wants recorded v2 numbers, a build run on
  `dev` post-merge should append them to this doc).
- **Zero new runtime dependencies vs v1 — PASS (static).** `apps/web/package.json`
  `dependencies` = `@bleak/api-client`, the two Fontsource variable fonts,
  `jsqr ^1.4.0` (v1), `uqr ^0.1.3` (v1 profile badge) — **no entry was added
  in the v2 loop**; secrets are WebCrypto built-in
  (`lib/crypto/secrets.ts`, `crypto-secrets.test.ts` — "default path yields
  the same shape with real WebCrypto randomness").

**Budget verdict (provisional):** join ≤ 60 kB and any-page ≤ 80 kB —
**presumed PASS**, pending the wave-CI build re-measurement; jsqr/uqr
placement **PASS (tests)**; zero new deps **PASS**.

---

## 6. PWA validity (item 6)

`apps/web/static/manifest.webmanifest` — valid JSON, unchanged surface:
`name "bleak-web"`, `short_name "bleak"`, `start_url "/"`, `scope "/"`,
`display "standalone"`, `theme_color`/`background_color` `#1A1C20`,
`lang "ru"`, two icon entries `/icons/icon.svg` (purposes `any` + `maskable`).
`apps/web/static/icons/icon.svg` + `favicon.svg` exist;
`apps/web/src/app.html` wires `theme-color` `#1A1C20`. Rev. 3 changes no PWA
surface (no v2 worker touched `static/` or `app.html`; the manifest keys and
files inspected directly in the worktree). Real-device installability stays
on the owner checklist (§8).

---

## 7. Contract reconciliation status — `TBD(WP-6)` (item 9)

One-shot grep of `packages/api-client`: **9 markers, all STILL PENDING.**
The backend contract deliverable (`/mount/bleak-node/docs/swagger.json`,
rev. 0.1.0) contains **none** of the v2 credential endpoints — no
`/api/handshake/mutual`, no `…/mutual-code`, no `…/token` rotation, no
`…/invite`, no `x-create-token` header, no `mutual_code_live` field — so
every front-end TBD remains open against swagger:

| # | Marker (file:line) | Open question | Status |
| --- | --- | --- | --- |
| 1 | `types.ts:39` | `mutual_code_live` field name on gated reads | **pending** |
| 2 | `types.ts:177` | room-creation header name + body field names | **pending** |
| 3 | `types.ts:200` | mutual-code registration body field name (`mutual_code_hash`) | **pending** |
| 4 | `types.ts:212` | invite-mint expiry field (`expires_at`, default 24 h) | **pending** |
| 5 | `types.ts:218` | invite response shape | **pending** |
| 6 | `client.ts:70` | creation-token header name (proposed `x-create-token`, sent today) | **pending** |
| 7 | `client.ts:308` | mutual-code registration body field name | **pending** |
| 8 | `client.ts:330` | user-token rotation body field name (`token`) + response shape | **pending** |
| 9 | `client.ts:348` | room-token rotation body field name (`token`) + response shape | **pending** |

All 9 are implemented against the agreed CONCEPT §7 wording and covered by
tests (`client.test.ts` — "createRoom carries the creation token in its own
header, not as Bearer", "registerMutualCode sends the HASH of the code,
never the raw code", "rotation bodies carry the new RAW token, Bearer
carries the current one"), so a backend rename is a mechanical follow-up,
not a design risk. Recorded for the process; no fix-up performed here.

---

## 8. Deployment checklist (secure context + device smoke)

### 8.1 Secure-context requirement (item 7, ARCHITECTURE §10.5)

**HTTPS is required for BOTH the camera AND `crypto.subtle`.** Deployed
URLs must be HTTPS: `navigator.mediaDevices` exists only in secure contexts
(the scanner has a dedicated no-camera/insecure state with the HTTPS note —
`qr-scanner.test.ts` "no navigator.mediaDevices (insecure origin) →
no-camera state + HTTPS note"), and all v2 secret generation/hashing
(`lib/crypto/secrets.ts` → `crypto.getRandomValues` + `crypto.subtle.digest`)
also assumes a secure context. `localhost` is exempt for dev only. Plain-HTTP
deployments degrade to the scanner's no-camera state and must be treated as
mis-deployments.

### 8.2 Scanner real-device smoke checklist — MANDATORY pre-event (item 8, carried forward from v1 §8 + the v2 dimension)

**Devices:** iPhone (Safari, iOS ≥ last-2), Android phone (Chrome, last-2).
**Deploy:** HTTPS (§8.1). Record results per device.

1. **HTTPS gate:** open the deployed URL — no camera/secure-context errors;
   persona QR generation (`crypto.subtle`) works.
2. **PWA install:** Android Chrome → Install; iOS Safari → Add to Home
   Screen; standalone launch, icon/title, dark theme.
3. **Join by code:** 6-digit cells, auto-advance, paste, auto-submit;
   `?code=` deep link auto-fills + submits.
4. **Scanner — permission states:** first open shows the unasked panel
   (camera NOT started); «Включить камеру» prompts; Denied + Try again;
   no-camera/insecure copy on plain-HTTP.
5. **Context (a) invite QR:** scan the host share-kit QR → flash → cells
   filled → room preview; manual fallback closes + refocuses cells from
   every state.
6. **Context (b) persona QR:** scan another attendee's **live profile
   badge** → confirm card → ONE mutual POST → «Агенты уже общаются» → Open
   dialog. Re-scanning the same badge (already-mutual) reaches the same
   success — no second chat.
7. **410 stale-code state:** scan a badge whose QR was already consumed →
   «Код уже использован…» with Scan again and NO retry for the dead code.
8. **403 income-rule state:** on a rule-limited account → §2.9 copy inline;
   copy never implies the scanned badge was consumed; Scan again works.
9. **v2 dimension — stale/legacy identity:** sign in a v1-era persona (or
   clear the token from `bleak.identity`) and open any gated page → the
   §2.8 global gate fires: identity cleared, redirect to `/` with the notice
   card «У этой персоны нет действительного ключа доступа…» (by design —
   legacy personas are unrecoverable); also confirm a token-rotation on
   device A locks out device B (other-device copy).
10. **Decoder path:** Android Chrome uses `BarcodeDetector` (no jsqr chunk
    fetch in devtools network); iOS Safari fetches the lazy jsqr chunk on
    first scan only.
11. **Camera light off:** close (X), Escape, fallback link, navigation —
    the indicator must turn off each time; focus returns to the invoker.
12. **Live polling on venue Wi-Fi:** 4 s room/people/chats, 2 s transcript,
    5 s host; airplane-mode banner + backoff recovery.
13. **Radar correctness:** ring placement vs state; positions stable;
    «+N ещё» over 14 attendees.
14. **Host console:** creation-token gate (masked, value gone after
    create/reject), invite mint 24 h preset + custom + revoke, room-token
    rotation locks out the old tab, drill-down read-only transcripts with
    «Наблюдение хоста» chip on the transcript page.

### 8.3 Other pending-owner checks (carried from v1)

Interactive a11y keyboard/screen-reader walk; responsive screenshots
(`/people` ≥720px two-column, `/host` ≥900px two-column); real-stack E2E
(create room → join → handshake → dialog → kickoff → rotate).

---

## 9. AC sweep — 118/118 DESIGN rev. 3 criteria

Legend: **T** = merged automated test (file — title), **S** = source/one-shot
grep inspection in this sweep, **M** = manual pending-owner (§8), **V-F#** =
finding in §10.

### 9.1 §3.1 `/` — Join (19)

| # | Criterion (short) | Status | Evidence |
| --- | --- | --- | --- |
| 1 | no identity → code card, no tab bar | PASS T | `join-flow.test.ts` render tests; route renders no TabBar; `nav-guard.test.ts` (guarded routes redirect) |
| 2 | §2.8 notice card above code card; aria-live; consume-once; no retry | PASS S / **V-F1** | `api-contexts.test.ts` "401 clears identity + mutualCode, sets bleak.authNotice, queues goto(/)…"; route consumption `routes/+page.svelte:33-51,147-149`; `NoticeCard.svelte` (role=alert, aria-live, lock glyph, binding copy, no affordance — read in this sweep); copy key tested verbatim (`i18n.test.ts`); **no component/route test** → V-F1 |
| 3 | valid code → preview (name/description/language/count), no reload | PASS T | `join-flow.test.ts` "resolves a typed code and shows the room preview without a reload" |
| 4 | `?code=` prefills + auto-submits | PASS T | `join-flow.test.ts` "(AC 4)"; `join-machine.test.ts` "parses a valid ?code=…" |
| 5 | unknown code → 404 copy inline, digits kept, no navigate | PASS T | `join-flow.test.ts` "(AC 5)"; `join-machine.test.ts` "maps the seam not_found kind…" |
| 6 | unreachable → NetworkError banner, code survives | PASS T | `join-flow.test.ts` "(AC 6)" |
| 7 | empty `name` blocked client-side + field error | PASS T | `join-flow.test.ts` "(AC 7)"; `join-machine.test.ts` "maps 400 to a field-level server-text error" |
| 8 | create: exact v2 body (invite_code + generated token, no auth header); saves `bleak.identity` + appends `bleak.tokenVault`; navigates | PASS T | `join-flow.test.ts` "(AC 8)"; `join-machine.test.ts` "createPersona generates a client token and sends the exact CreateUserRequestV2 body (invite_code + token, trimmed)"; `api-contexts.test.ts` "public reads and the join create carry NO token at all" |
| 9 | invite-code rejection copy inline; no identity/vault writes; form kept | PASS T | `join-flow.test.ts` "(AC 9)" |
| 10 | 409 name-taken copy; form kept | PASS T | `join-flow.test.ts` "(AC 10)" |
| 11 | vault list exclusively from `bleak.tokenVault`; no server picker | PASS T | `join-flow.test.ts` "(AC 11)"; `token-vault.test.ts` (list/append/coexist tests) |
| 12 | credentialed read with the STORED token; prefill; re-create with a NEW token; entry kept + appended | PASS T | `join-flow.test.ts` "(AC 12)"; `join-machine.test.ts` "readVaultPersona fetches the old persona with ITS STORED token (vault import override)"; `api-contexts.test.ts` "the explicit-token override wins — the documented vault-import read"; `token-vault.test.ts` "appends without removing: two entries coexist" |
| 13 | dead persona (404) → dead-entry state; entry kept | PASS T | `join-flow.test.ts` "(AC 13)"; `join-machine.test.ts` "maps 404/403 to the dead-entry state…" |
| 14 | empty vault copy + way back | PASS T | `join-flow.test.ts` "(AC 14)" |
| 15 | resume card; "join another event" clears identity + mutualCode, keeps vault | PASS S / **V-F2** | route source `routes/+page.svelte:103-131` (`joinAnother → clearIdentity`; `mutual-code.test.ts` "clearIdentity clears the one-time code too"; vault untouched — `identity.test.ts`/`token-vault.test.ts`); **no route-level render test** → V-F2 |
| 16 | RU\|EN switch on page, persists | PASS T | `profile-page.test.ts` "the settings segmented control switches and persists app-wide"; `i18n.test.ts` persistence tests |
| 17 | six cells keyboard-reachable; paste fills | PASS T | `digit-input.test.ts` (8 tests incl. "paste of a 6-digit string fills…"); `code-input.test.ts` |
| 18 | scan button opens overlay; close returns to Step 1, digits intact, cells focused; invite QR continues like manual entry | PASS T | `join-flow.test.ts` "(AC 18)" ×2; `qr-scanner.test.ts` "the manual fallback closes from every state (invite: enter code manually)", "an invite QR hands the code to the join flow…" |
| 19 | `?u&m` runs the mutual routine incl. confirm card; `?u=` alone → one `POST /api/handshake`; without identity both ignored | PASS T + S | `join-machine.test.ts` parse tests ×3 ("parses ?u= without m…", "parses ?u=…&m=…", "ignores invalid or absent params"); `qr-scanner.test.ts` "a `?u=` payload WITHOUT `m` runs the single-direction variant: ONE idempotent handshake POST"; `mutual-handshake.test.ts` (confirm/410/403/401 paths); route wiring read in this sweep (`DeepLinkHandshake` delegates to the tested `lib/scanner/mutual.ts`; no-identity case guarded at `routes/+page.svelte:74-80`) — component render itself untested (noted in V-F3) |

### 9.2 §3.2 `/room` — Radar (15)

| # | Criterion (short) | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Me chip (accent) + one node per attendee on exactly one ring | PASS T | `room-radar.test.ts` "renders the Me chip, header room name + count, and one node per other attendee"; `radar-placement.test.ts` "chat → inner ring (0)", "incoming and outgoing → middle ring (1)", "none → outer ring (2)" |
| 2 | hash-derived positions stable across ticks | PASS T | `radar-placement.test.ts` "same address + state ⇒ identical placement", "angle is fnv1a(address) % 360…", "radius stays within the ring base ±6% jitter" |
| 3 | name + live member count after 4 s poll | PASS T | `room-radar.test.ts` "(AC 3)" |
| 4 | node tap → sheet: name, public_bio, correct action | PASS T | `room-radar.test.ts` "no handshake: tapping a node opens the sheet…"; `handshake-sheet.test.ts` per-state tests ("shows name and public_bio", closed/no-handshake/outgoing/incoming/mutual) |
| 5 | send POSTs from=me with persona Bearer; node → middle ring within one refresh | PASS T | `room-radar.test.ts` send test; `api-contexts.test.ts` "persona mutations and gated reads carry identity.token"; `radar-placement.test.ts` "ring follows the relationship state for the same address" |
| 6 | incoming: «Добавил вас» + Handshake back; success → Open dialog | PASS T | `room-radar.test.ts` "(AC 6)"; `handshake-sheet.test.ts` "incoming pending: added-you pill + handshake-back CTA", "mutual: open-dialog link to the counterpart chat" |
| 7 | idempotent re-send; 200 and 201 identical | PASS T | `room-radar.test.ts` "(AC 7)"; `client.test.ts` "accepts both 200 and 201 for the idempotent handshake endpoint" |
| 8 | no other attendees → «Пока никого…», no nodes | PASS T | `room-radar.test.ts` "(AC 8)" |
| 9 | poll failure → banner + Retry; auto-dismiss on recovery | PASS T | `room-radar.test.ts` "poll failure shows the NetworkError banner with retry; recovery dismisses it"; `kit.test.ts` ErrorBanner "renders a Retry button…", "network kind shows the §2.1 NetworkError copy" |
| 10 | >14 attendees → exactly 14 nodes + «+N ещё» | PASS T | `room-radar.test.ts` cap test; `radar-placement.test.ts` "caps at 14 nodes sorted by numeric hash ascending, extra counted", "is a pure cap — it never mutates the input" |
| 11 | nodes focusable buttons, descriptive labels, Enter/Space | PASS T | `room-radar.test.ts` node-button label assertions |
| 12 | leaving stops the poller | PASS T | `room-radar.test.ts` "stops polling after unmount — no network requests afterwards" |
| 13 | top-bar scan icon → overlay context (b) with member list; close leaves radar consistent | PASS T | `room-radar.test.ts` "the top-bar scan button opens the QrScanner overlay; closing forces a refresh" |
| 14 | scanner success (mutual) reflected within one refresh | PASS T | same + `radar-placement.test.ts` ring-by-state; `mutual-handshake.test.ts` "sends ONE createMutualHandshake call with the scanned u + m (not two POSTs)"; `qr-scanner.test.ts` "a known persona → confirm card…confirming sends ONE mutual POST (u + m) → success" |
| 15 | 403 income-rule on sheet send → §2.9 inline state; node stays; no optimistic state | PASS T | `room-radar.test.ts` "(AC 15)"; `handshake-sheet.test.ts` "income-rule error (§2.9, 403): renders hs.income_limit inline + muted server text, announced polite" |

### 9.3 §3.3 `/people` (13)

| # | Criterion (short) | Status | Evidence |
| --- | --- | --- | --- |
| 1 | one card per attendee; name/bio/avatar + pill + timestamp | PASS T | `people-page.test.ts` "renders one card per attendee (excluding me), newest first, correct pills" + the four pill tests ("none…", "outgoing…", "incoming…", "chat…") |
| 2 | search name+bio, case-insensitive, debounced; empty-search echo | PASS T | `people-page.test.ts` "search filters by name and bio, echo + reset restore the list"; `people-view.test.ts` matcher tests |
| 3 | filter chips; active chip accent-filled | PASS T | `people-page.test.ts` "filter chips reduce the list…active chip is accent-filled"; `people-view.test.ts` chip↔state tests |
| 4 | «+» sends POST (from=me), flips in place, no reorder | PASS T | `people-page.test.ts` "(AC 4)"; `people-view.test.ts` "orders newest created_at first and is deterministic" |
| 5 | incoming expand → Handshake back + Dismiss; back → «Общаемся» + dialog link | PASS T | `people-page.test.ts` "(AC 5)" (keyboard via aria-expanded asserted) |
| 6 | Dismiss collapses only, sends nothing; may re-expand; never implies decline | PASS T | `people-page.test.ts` "dismiss collapses the card and sends NOTHING to the server (ruling 2, AC 6)"; `people-view.test.ts` "stays dismissed for the SAME incoming request…", "re-expands when a NEWER incoming handshake arrives…" |
| 7 | mutual ▤ → `/chats/{address}` | PASS T | `people-page.test.ts` "chat: outline-accent «Общаемся» + chat time, ▤ opens the dialog" |
| 8 | in-place poll updates; deletions disappear; no duplicates | PASS T | `people-page.test.ts` "(AC 8)"; `people-view.test.ts` "deduplicates by address — no duplicate cards ever render (AC 8)", "recomputes when a user is deleted from the room (AC 8)" |
| 9 | empty room → «Комната пока пуста.» + glyph | PASS T | `people-page.test.ts` "(AC 9)" |
| 10 | network failure → banner, dimmed list, auto-dismiss | PASS T | `people-page.test.ts` "(AC 10)"; ApiError variant test |
| 11 | semantic `<ul>`; person-named aria-labels | PASS T | `people-page.test.ts` "none: «+» action with a person-named aria-label…"; list markup assertions |
| 12 | ≥720px two columns, no horizontal scroll | PASS S / M | grid media-query CSS in `routes/people/+page.svelte` (read in this sweep); visual confirmation pending-owner (§8.3) — unchanged from v1 verdict |
| 13 | 403 income-rule on «+» → §2.9 inline in card, `aria-live`, card stays "none", no extra request | PASS T | `people-page.test.ts` "(AC 13)" |

### 9.4 §3.4 `/chats` (8)

| # | Criterion (short) | Status | Evidence |
| --- | --- | --- | --- |
| 1 | one card per chat (credentialed read): counterpart + avatar + verbatim chips, no preview | PASS T | `chats-page.test.ts` "renders one card per chat…"; `api-contexts.test.ts` "attendee-context chat reads/actions carry the persona token" (gated read) |
| 2 | counterpart = participants − me; ≠2 → first + «+N» | PASS T | `chats-page.test.ts` "(AC 2)"; `chats-view.test.ts` "counterpart = participants minus my address (1:1)", "≠2 participants → first counterpart + «+N» extras" |
| 3 | relative created_at time shown, updates on polls | PASS T | `chats-page.test.ts` "(AC 3)" |
| 4 | tap navigates to `/chats/{address}` | PASS T | `chats-page.test.ts` card `<a>` href assertion |
| 5 | zero chats → copy + Find-people CTA → `/people` | PASS T | `chats-page.test.ts` "(AC 5)" |
| 6 | accent dot when newer than `bleak.chatsSeen`; clears on visit | PASS T | `chats-page.test.ts` "(AC 6)"; `chats-seen.test.ts` (6 tests); `tabbar.test.ts` "shows the badge dot on Chats only when a chat is newer than seen" |
| 7 | 4 s in-place refresh; removed chat disappears | PASS T | `chats-page.test.ts` "(AC 7)" |
| 8 | network failure → banner, last list preserved | PASS T | `chats-page.test.ts` "(AC 8)"; ApiError variant |

### 9.5 §3.5 `/chats/[address]` (15)

| # | Criterion (short) | Status | Evidence |
| --- | --- | --- | --- |
| 1 | getChat + messages oldest-first; mine right / theirs left | PASS T | `transcript-page.test.ts` "renders all messages oldest-first; mine right, theirs left per message.from"; `chats-view.test.ts` "mine ⇔ message.from === my address" |
| 2 | speaker name + relative time per bubble | PASS T | render test + `chats-view.test.ts` "speaker resolves from the roster; unknown address falls back to raw" |
| 3 | new messages within one 2 s tick; auto-scroll; scrolled-up chip works | PASS T | `transcript-page.test.ts` "(AC 3)", "auto-scrolls to the bottom by default; scrolling up shows a working chip"; `chats-view.test.ts` stick/chip tests |
| 4 | header: counterpart + verbatim phase/scenario/language chips | PASS T | `transcript-page.test.ts` "(AC 4)" |
| 5 | kickoff: focus-trapped confirm, exact copy; Cancel no-op; Confirm POSTs → clears + «Первым говорит {name}» | PASS T | `transcript-page.test.ts` "(AC 5)" + confirm-dialog tests; `confirm-dialog.test.ts` focus trap/Escape |
| 6 | «Агенты готовятся…» until first polled message | PASS T | `transcript-page.test.ts` "(AC 6)" + empty-chat warming test |
| 7 | contact stub visible, disabled, non-interactive, exact copy | PASS T | `transcript-page.test.ts` "(AC 7)"; `kit.test.ts` ContactStub tests |
| 8 | 404 chat → not-found + working link to `/chats` | PASS T | `transcript-page.test.ts` "(AC 8)" |
| 9 | network failure → banner, transcript kept; recovery auto-dismisses | PASS T | `transcript-page.test.ts` "(AC 9)" |
| 10 | plain text `pre-wrap`; 255-symbol message never overflows | PASS T/S | `chats-view.test.ts` verbatim/truncation; CSS pre-wrap + max-width in `MessageBubble.svelte` (v1 verdict carried; overflow visual pending-owner) |
| 11 | back control → `/chats` (history fallback) | PASS T | `transcript-page.test.ts` "(AC 11)"; `chats-view.test.ts` back-decision tests |
| 12 | leaving stops the 2 s poller | PASS T | `transcript-page.test.ts` "(AC 12)" |
| 13 | **no-composer**: no input/textarea/send; only back + kickoff(+confirm) + stub | PASS T | `transcript-page.test.ts` no-composer DOM test; `sweep.test.ts` source-level ×2; grep sweep §3 of this report |
| 14 | persona 401/403 read + stored room token → ONE room-token retry via apiRaw; «Наблюдение хоста» chip; host-context 401 clears host session only | PASS T | `transcript-page.test.ts` "persona read 403 + a stored room token → ONE retry with the room token via apiRaw; the host-view chip shows", "host-view mode persists for the page session…", "a host-context 401 on the retry replicates the hostApi gate: host room cleared + hostReset flag, identity untouched"; `api-contexts.test.ts` "apiRaw is the ungated underlying client…", "only the web api module and the transcript host-view fallback may reference apiRaw in src" |
| 15 | no stored room token + 401 → §2.8 global gate (no transcript error UI first) | PASS T | `transcript-page.test.ts` "without a stored room token a 401 renders NO transcript error UI (the §2.8 global gate owns it — AC 15)"; `api-contexts.test.ts` 401-gate test |

### 9.6 §3.6 `/profile` (15)

| # | Criterion (short) | Status | Evidence |
| --- | --- | --- | --- |
| 1 | badge card fields + stat tiles; every fetch persona Bearer | PASS T | `profile-page.test.ts` "renders name, greeting, bios, read-only language, interests and stats"; `api-contexts.test.ts` "persona mutations and gated reads carry identity.token" |
| 2 | editor PUTs all three fields; card reflects | PASS T | `profile-page.test.ts` "saves all three fields via PUT updateRoomUser and reflects them" (+ cancel-no-PUT) |
| 3 | greeting blocks `?` (and `？`) with exact copy; saves via PUT greeting | PASS T | `profile-page.test.ts` "blocks saving when the text contains ?, with the exact rule copy", "blocks the full-width ？ too", "(AC 3)", server-400 variant; `profile-domain.test.ts` validator tests |
| 4 | regenerate fills editor without saving until Save | PASS T | `profile-page.test.ts` "(AC 4)" |
| 5 | interests from `bleak.interests` mock; never a network request | PASS T | `interests-store.test.ts` "never issues a fetch while reading/writing interests" + 9 more; `profile-page.test.ts` "toggling chips persists locally and NEVER issues a network request"; `sweep.test.ts` exact-shape tests |
| 6 | RU\|EN app-wide + persists | PASS T | `profile-page.test.ts` settings control test; `i18n.test.ts` |
| 7 | leave: confirm → DELETE → clears `bleak.identity` + `bleak.mutualCode` → `/` | PASS T | `profile-page.test.ts` "confirms, DELETEs, clears identity AND the one-time mutual code, and navigates to /"; `mutual-code.test.ts` "clearIdentity clears the one-time code too" |
| 8 | 404 persona → not-found card + working exit | PASS T | `profile-page.test.ts` "renders the not-found card and the exit clears identity" |
| 9 | stat tiles announce full values | PASS T | `profile-page.test.ts` "(AC 9)" («Хендшейки: 7») |
| 10 | no hardcoded colors; tokens only | PASS T | `sweep.test.ts` "no .svelte file contains a raw color literal", "the only light-surface exception (--color-qr-frame) is declared in tokens.css" |
| 11 | live QR encodes `{base}?u={addr}&m={code}` from the mutualCode store; both captions; no request; non-interactive | PASS T | `profile-page.test.ts` "(AC 11)", "first load with no code: registers a fresh code sending the HASH only, never the raw"; `profile-domain.test.ts` payload-encode tests; `qr-payload.test.ts` "parses a persona QR…with and without the one-time code"; `api-contexts.test.ts` "registerMutualCode sends the HASH only — never the raw code" |
| 12 | QR scannable: dark on `--color-qr-frame`; decode yields u + m | PASS T | `qr-roundtrip.test.ts` ×3 ("decodes the persona payload back to {base}?u={address}&m={code}", "decodes an escaped address AND mutual code intact (the scanner reads u + m)", "the SVG rendering carries the token colors (dark on light frame)") |
| 13 | uqr code-split into `/profile` only | PASS T + S | `profile-domain.test.ts` non-vacuous import tests ×2; `sweep.test.ts` "uqr is imported only inside the /profile component tree"; v1 build grep carried forward (§5 — build not re-run here) |
| 14 | live rotation: 4 s token-gated poll; `mutual_code_live=false` → fresh code, hash-only registration, store update, re-render + «QR обновлён» (`aria-live`); failure keeps last QR and retries | PASS T | `profile-page.test.ts` "a burned flag (mutual_code_live=false) rotates: fresh code, hash-only body, «QR обновлён» note auto-hides after 2 s", "a live flag keeps the stored QR — no registration call", "registration failure keeps the last QR and retries on the next 4 s tick", "the token-gated getRoomUser poll runs at 4 s and stops on teardown"; `profile-domain.test.ts` decision tests ("no stored code → register", "live=false → rotate", "live/unknown → keep"); `mutual-code.test.ts` store ownership tests |
| 15 | token rotation: confirm with other-device copy; `rotateUserToken` (current Bearer, new raw in body); updates identity + vault entry in place; 401 → §2.8 gate; 403 → inline server text, identity kept | PASS T | `profile-page.test.ts` "confirm dialog carries the other-device lockout copy; rotate updates identity + the matching vault entry IN PLACE", "a 403 keeps the identity and shows the inline server text (no client writes)"; `api-contexts.test.ts` "rotations: Bearer = the CURRENT credential, body = the new raw secret", 401-gate test; `token-vault.test.ts` "rewrites only the matching entry token, preserving every other field"; `identity.test.ts` v2 identity round-trip |

### 9.7 §3.7 `/host` (16)

| # | Criterion (short) | Status | Evidence |
| --- | --- | --- | --- |
| 1 | no `bleak.hostRoom` → creation-token gate; token never persisted; masked only | PASS T | `host-console.test.ts` "(AC 1)"; `host-session.test.ts` "no hostToken writable or saveHostToken/forgetHostToken exports exist", "the deprecated bleak.hostToken key is never written by the store module"; `storage-inventory.test.ts` host-room single-key test |
| 2 | wrong/consumed token (401/403) → «Токен отклонён.»; value kept masked; nothing stored | PASS T | `host-console.test.ts` "(AC 2)" |
| 3 | create: client-generated room token; creation token in header, room token in body; stores `{roomAddress, roomToken, code}` | PASS T | `host-console.test.ts` "(AC 3)"; `api-contexts.test.ts` "room creation authenticates with the creation token header — no Bearer, room token in the body", "createRoomWithInvite: create (creation header) then mint (Bearer = the body room token)"; `client.test.ts` "creates a room via POST /api/room with a JSON body and the creation token header", "createRoom carries the creation token in its own header, not as Bearer" |
| 4 | share kit: code (Handjet), QR `<img>` from `GET /h/rooms/{code}/qr`, invite link; both copies correct | PASS T | `host-console.test.ts` "(AC 4)"; `helper.test.ts` (QR URL for any well-formed code, invite deep-link payload, 400 for malformed); `host-console.test.ts` `inviteLink` + copy-kit tests (`kit.test.ts` CopyButton/CopyField) |
| 5 | revisit restores share kit via public getRoom; nothing re-created | PASS T | `host-console.test.ts` "(AC 5)"; `host-session.test.ts` "init restores a persisted room reference (round-trip)" |
| 6 | "Join as attendee" → `/?code={code}` (§3.1 flow takes over) | PASS T | `host-console.test.ts` attendee-link href assertion (share-kit tests); `join-flow.test.ts` "(AC 4)" deep-link entry |
| 7 | active codes via room-token `GET …/invite`; mint preset (24 h preselected) or custom → POST, new code listed with own actions | PASS T | `host-console.test.ts` "lists active codes via room-token listInvites with expiry display (AC 7)", "minting with the 24 h preset calls mintInvite…", "the custom expiry chooser reveals a datetime-local input…", "an empty custom value blocks the mint inline"; `hostLogic` preset/custom expiry tests |
| 8 | revoke → DELETE, row disappears on refresh + «Код отозван.»; revoked/expired never active | PASS T | `host-console.test.ts` "(AC 8)"; `hostLogic` "activeInvites filters expired codes and sorts newest first (revoked/expired never render)" |
| 9 | live view 5 s poll (public reads); members tile vs `getRoom.max_user` | PASS T | `host-console.test.ts` "renders member rows and the members tile against max_user", "runs the 5 s cadence while mounted and stops the poller on unmount…" |
| 10 | drill-down: dialogs read with the ROOM token; rows link read-only transcript; Clear history + Restart via room token after confirms | PASS T | `member-drilldown.test.ts` (4 tests: empty hint, dialog rows + actions, cancel, inline error retry); `host-console.test.ts` "opens on demand with NO counts…(AC 10, 11)"; `api-contexts.test.ts` "host room-token calls carry bleak.hostRoom.roomToken"; `transcript-page.test.ts` host-view kickoff via room token |
| 11 | no handshake sent/received counts anywhere | PASS T | `host-console.test.ts` "(AC 10, 11)" ("no counts"); `api-contexts.test.ts` "listHandshakesOfUser is NOT a room-token method (flag 6.9a — counts dropped)" |
| 12 | settings PUT; delete confirms → DELETE → clears stored room → create form | PASS T | `host-console.test.ts` "settings save via PUT updateRoom and reflect immediately (AC 12)", "danger zone is separated by a warning heading; delete confirms…(AC 12)" |
| 13 | room-token rotation: confirm copy; `rotateRoomToken` with current Bearer; `bleak.hostRoom.roomToken` updated in place | PASS T | `host-console.test.ts` "«Сгенерировать ключ комнаты» confirms and rewrites the stored roomToken IN PLACE (AC 13)"; `host-session.test.ts` "room-token rotation rewrites the entry in place, preserving the other fields", "…is a no-op when no room session is stored"; `client.test.ts` rotation-body test |
| 14 | host-context 401/403 → clears `bleak.hostRoom`, resets to gate, «Доступ к комнате отозван…» (`aria-live`), identity untouched | PASS T | `host-console.test.ts` reset-notice tests ×2 ("announced politely and the flag is consumed"); `api-contexts.test.ts` host-gate tests ("other statuses keep the room session", "room creation is NOT gated: a 403 there sets no hostReset"); `transcript-page.test.ts` host-context 401 replication |
| 15 | empty live copy; room deleted while open → «Комната удалена.» + reset | PASS T | `host-console.test.ts` "(AC 15)" ×2 |
| 16 | ≥900px two columns, share kit + invites sticky left | PASS T + M | `host-console.test.ts` "renders the two-column shell; the sticky-left rule is a ≥900px media query (spot-checked in DOM)"; visual pending-owner (§8.3) |

### 9.8 §3.8 `QrScanner` (17)

| # | Criterion (short) | Status | Evidence |
| --- | --- | --- | --- |
| 1 | same component from `/` (a) and `/room` (b); per-context hint/fallback/results | PASS T | `join-flow.test.ts` "(AC 18)" ×2; `room-radar.test.ts` scan-button test; `qr-scanner.test.ts` "persona context shows the find-in-the-list fallback" + context-mismatch tests ("a persona QR scanned in invite context is invalid content" etc.) |
| 2 | camera NOT started on open; only after «Включить камеру» | PASS T | `qr-scanner.test.ts` "renders the dialog when open; the camera is NOT started without the CTA tap", "the «Включить камеру» tap starts the stream…" |
| 3 | granted: viewfinder + accent corner-bracket frame + hint; flash; stream stops; result ≤1 s | PASS T / M | `qr-scanner.test.ts` granted-state test; `qr-decode.test.ts` lazy-decoder loop tests; frame-flash 120 ms + ≤1 s latency → device checklist (§8.2 item 6) |
| 4 | denied → exact copy + Try again + fallback; no request; camera off | PASS T | `qr-scanner.test.ts` "denied permission shows the exact copy with a Try again action; the camera stays off" |
| 5 | no-camera / insecure origin → state + HTTPS note; page behind unaffected | PASS T | `qr-scanner.test.ts` "no navigator.mediaDevices (insecure origin) → no-camera state + HTTPS note", "secure context without mediaDevices → no-camera state without the HTTPS note" |
| 6 | manual fallback reachable from every state; (a) refocuses cells, (b) closes | PASS T | `qr-scanner.test.ts` fallback tests ×2; `join-flow.test.ts` "(AC 18)" refocus |
| 7 | invite QR → closes, proceeds like manual entry | PASS T | `qr-scanner.test.ts` "an invite QR hands the code to the join flow and closes the scanner"; `qr-payload.test.ts` parse tests (any path prefix, malformed reject) |
| 8 | persona QR → confirm card (avatar+name); ONE `POST /api/handshake/mutual` (persona Bearer; u+m); success «Агенты уже общаются» + Open dialog (or `/chats` fallback) | PASS T | `qr-scanner.test.ts` "a known persona → confirm card with name; confirming sends ONE mutual POST (u + m) → success", "a chat not yet listed after the call (eventual consistency) → the /chats fallback link"; `mutual-handshake.test.ts` "sends ONE createMutualHandshake call with the scanned u + m (not two POSTs)" |
| 9 | already-mutual → same success; no client precheck skips the call; code burns server-side | PASS T | `qr-scanner.test.ts` "an already-mutual pair reaches the same success state — NO client precheck skips the call"; `mutual-handshake.test.ts` "already-mutual pair: the call still happens (the code burns server-side) and success resolves the existing chat", "known persona → confirm card — even when a chat already exists (NO already-mutual precheck)" |
| 10 | 410 → stale-code state; Scan again + fallback; NO retry for the dead code | PASS T | `qr-scanner.test.ts` "a 410 renders the stale-code state with Scan again and NO Retry for the dead code"; `mutual-handshake.test.ts` "a 410 → the stale-code state (no retry is offered for the dead code)" |
| 11 | 403 → §2.9 income-rule state; copy never implies the badge burned; Scan again works | PASS T | `qr-scanner.test.ts` "a 403 renders the §2.9 income-rule state; the copy never implies the badge burned"; `mutual-handshake.test.ts` "a 403 → the §2.9 income-rule state with the server text (the code was NOT consumed)" |
| 12 | own QR → info, no request; foreign persona → error, no request; neither `?code=` nor `?u=` → invalid-QR state | PASS T | `qr-scanner.test.ts` "my own QR shows the info state and sends no request", "a foreign persona shows the error state and sends no request", "foreign/invalid QR content shows the invalid-QR state (never a silent close)" + cross-context invalid tests; `mutual-handshake.test.ts` "own QR → info state, no request", "foreign persona (not in the member list) → error state, no request", "a soft-deleted member is foreign", "an EMPTY member list means membership is unknown → confirm" |
| 13 | network failure during mutual → retry state; Retry re-sends safely; 401 → §2.8 gate | PASS T | `qr-scanner.test.ts` "a NetworkError shows the retry state; Retry re-sends u + m safely to success", "a 401 during the mutual call closes the scanner — the §2.8 global gate owns the redirect"; `mutual-handshake.test.ts` "a NetworkError → retry state; retry re-sends u + m safely (a failed attempt never burns the code)", "a 401 → the auth state (the §2.8 global gate owns the redirect)" |
| 14 | `?u=…&m=…` full mutual routine; `?u=` alone → single-direction confirm → one handshake POST (403 → income-rule); no identity → ignored | PASS T + S | `qr-scanner.test.ts` "a `?u=` payload WITHOUT `m` runs the single-direction variant: ONE idempotent handshake POST"; `mutual-handshake.test.ts` single-direction tests ("sends ONE idempotent POST /api/handshake (from = me, status 1)…", "a 403 → the §2.9 income-rule state", "an existing chat resolves to the mutual success state"); `join-machine.test.ts` parse tests; route wiring S (§9.1 AC 19) |
| 15 | close (X/Escape/fallback/nav) stops detection + all tracks (light off); focus returns | PASS T / M | `qr-scanner.test.ts` "Escape closes and stops all camera tracks (light off)", "focus returns to the invoking button on close"; indicator-light on real hardware → §8.2 item 11 |
| 16 | focus-trapped `role="dialog"` + `aria-modal`; Escape closes; all state changes (incl. 410/403) `aria-live="polite"` | PASS T | `qr-scanner.test.ts` "states are announced via aria-live", dialog-role assertions, Escape test |
| 17 | no QR module fetched until overlay/badge needs it | PASS T + S | `sweep.test.ts` "jsqr is only ever DYNAMICALLY imported", "uqr is imported only inside the /profile component tree"; v1 build grep carried forward (§5) |

---

## 10. AC sweep verdict + findings

**Verdict: 118/118 evaluated — 0 FAIL.** 115 PASS on merged automated
evidence; §3.3 AC 12 (people two-column) + the visual sub-aspects noted
inline (frame flash, hardware light, mid-flow locale switch) are recorded as
pending-owner manual checks (§8); three low-severity test-coverage gaps are
filed below (implementation is source-verified correct; no product-code
defect found).

| # | Severity | Finding | Recommendation |
| --- | --- | --- | --- |
| **V-F1** | low | **§3.1 AC 2 (notice card) has no component/route test.** `NoticeCard.svelte` + the `bleak.authNotice` mount-consumption are implemented per §2.8 (read in this sweep) and the gate behavior + copy are tested (`api-contexts`, `i18n`), but nothing renders the card in a test (no `NoticeCard` reference in `apps/web/tests/**`). | Bug card (test-only): render `/` with the flag set — card above the code card, binding copy, `role="alert"`/`aria-live`, key removed (reload shows nothing), no retry control. |
| **V-F2** | low | **§3.1 AC 15 (resume card) has no route-level test** (v1 F1 carried into rev. 3 numbering). Implementation source-verified (`routes/+page.svelte:103-131`; `join.resume.*` keys exist and the underlying `clearIdentity` behavior is tested). | Bug card (test-only): with a stored identity, `/` renders the resume card with the room name; "join another event" clears identity + mutualCode, keeps the vault. |
| **V-F3** | low | **`DeepLinkHandshake` (§3.1 AC 19 / §3.8 AC 14 panel) has no direct component test** — the routine it delegates to is fully tested (`mutual-handshake.test.ts`, 19 tests) and the deep-link parsing + single-direction variant are tested (`join-machine`, `qr-scanner`), but the panel's own render/confirm wiring is not. | Bug card (test-only): component test mirroring the `qr-scanner` persona-path assertions. |
| **V-F4** | note | **`make test` / `make build` were not executable in this session** (shell tool denied); suite state and bundle numbers rest on committed logs + static checks (§1, §5). Wave-CI remains the authoritative gate; v2 gzip re-measurement is pending. | Process runs the three gates at wave-CI (as planned); optionally append measured v2 sizes to this doc post-merge. |
| **V-F5** | note | **All 9 `TBD(WP-6)` markers remain pending** (§7) — the backend swagger has not absorbed the v2 credential endpoints yet. Front-end is implemented per CONCEPT §7 and fully tested; a backend rename is mechanical. | Owner/process: track the WP-6 contract reconciliation separately; no front-end action. |

**Fix-up allowance (item 10):** no cross-cutting one-liner was needed — no
missing i18n key, no custody violation, no composer regression. The three
V-F gaps are test-only additions, which the verification-only amendment
forbids here → filed above for the process bug flow.

---

## 11. Summary for hand-over

- **Deliverable:** this document — the recorded walk of the existing
  evidence. **No new test files, no product code** (verification-only
  amendment honored). One-shot greps recorded inline, never committed as
  tests.
- **AC sweep: 118/118 evaluated, 0 FAIL** (per §9.x: §3.1 19 · §3.2 15 ·
  §3.3 13 · §3.4 8 · §3.5 15 · §3.6 15 · §3.7 16 · §3.8 17).
- **Credential custody: PASS** on all four checks (§2) — keys, header
  construction, console hygiene, creation-token non-persistence.
- **No-composer: PASS** (Part D test + grep, §3). **i18n: PASS** (parity +
  §4.7 incl. §2.8/§2.9 notices, §4). **PWA: PASS** (§6). **Zero new runtime
  deps vs v1: PASS** (§5).
- **Bundle budgets:** static placement checks PASS; gzip re-measurement
  pending the wave-CI build (V-F4, §5).
- **TBD(WP-6): 9/9 still pending** (§7, V-F5).
- **Findings:** V-F1…V-F5 (three low test-only gaps + two environment/contract
  notes) — none blocks the merge; the gaps go to the process bug flow.
- **Git status of this deliverable:** written in the worktree, **not
  committed** (shell denied — see the environment note at the top). The
  process must commit `docs/verification-v2.md` + `docs/logs/5f1ba636.log`
  on `feature/5f1ba636-verify-v2` (or resume the session with shell granted),
  then proceed to `ready-for-merge`.

*Verification report by worker 5f1ba636, TZ2-08 (amended), 2026-11-16.*

---

## Continuation addendum (b3dff1a6, 2026-11-16)

The blocker recorded above (shell/`npm install` denial, broken partial
`node_modules` in the worktree and `/workspace`) was cleared: the process ran
`make setup`, replacing the partial install with a full one (261 packages;
`vitest`/`vite` present). This continuation then executed the one-shot gate
the sweep could not:

**`make test` — first-hand, GREEN (run once, vitest 5.1.0):**

| Workspace | Test files | Tests |
| --- | --- | --- |
| `@bleak/api-client` | 1 passed (1) | **23 passed (23)** |
| `@bleak/helper` | 2 passed (2) | **8 passed (8)** |
| `@bleak/web` | 39 passed (39) | **491 passed (491)** |
| **Total** | **42 passed** | **522 passed, 0 failed** |

The web total (491 passing) matches §1's recorded last full-suite run
("full make test, 491 passing", `docs/logs/3bcc70ed.log` after the TZ2-07
bug-1 fixture fix) — the grep-count caveat there is resolved: the runner
total stands at 491. This **confirms the suite-state line of this report and
retires the "not run" half of V-F4** (V-F4's build half — the v2 gzip
re-measurement — remains pending the wave-CI `make build`; §5 unchanged).
Non-failing compiler notes only: 11 `state_referenced_locally` warnings
(vite-plugin-svelte) in `JoinFlow`/`TokenGate`/`PersonaEditor`/
`GreetingEditor`/`PersonaForm` — pre-existing, informational. No test was
added or modified by the sweep or this continuation. Both deliverables
(`docs/verification-v2.md` + `docs/logs/5f1ba636.log`, which carries the
honest blocker trail) are committed by this continuation on
`feature/5f1ba636-verify-v2`.
