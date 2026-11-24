# bleak-web v4.0 (TZ13) — Verification sweep (TZ13-05, verification-only)

Worker instance `5058559d` · 2026-11-24 · branch
`feature/5058559d-tz13-05-verify-tz13` (base = dev tip `d89b635` — the landing of
`feature/bc3f21eb-tz13-04-host-invites-qr`, the last of the four wave-1/2
landings). This sweep closes the **tz13 round** (Concept §54, DESIGN rev. 4
§3.7): it re-verifies all **58 DESIGN rev. 4 host acceptance criteria** 1:1 and
runs the round's **host-symmetric negative sweeps** (a)–(j) per TZ
§TZ13-05. **No product code and no test files** — one-shot source reads,
greps and spot-runs are recorded here, per the verification-only constraint of
task card 150.

Method legend: **S** = source inspection / landed-code read in this sweep,
**T** = merged automated test (file — title, first-hand re-run), **R** =
targeted spot-run executed first-hand in this session, **G** = one-shot
grep/script check recorded here (not committed as a test file).

Landing commits of the verified scope (dev log, pre-sweep, all squashed into
`dev` by the process in autonomous merge mode):

| Round task | Landing commit | Worker |
| --- | --- | --- |
| TZ13-01 foundations (`feature/449a37fc-host-tree-foundations`) | `eba89a6` | `449a37fc` |
| TZ13-02 entry (`feature/68417a9f-tz13-02-host-entry`) | `3b31a92` | `68417a9f` |
| TZ13-03 panel + stats (`feature/c938b3df-tz13-03-host-panel-stats`) | `1cc5ee1` | `c938b3df` |
| TZ13-04 invites + QR (`feature/bc3f21eb-tz13-04-host-invites-qr`) | `d89b635` | `bc3f21eb` |

The retired rev. 3 single-page console is fully replaced: the four routes
exist (`/host`, `/host/[room_address]`, `/host/[room_address]/invite`,
`/host/[room_address]/invite/[code]/qr`); the old `TokenGate.svelte` /
`LiveRoom.svelte` components remain on disk but are referenced by nothing
(see Finding F-2).

---

## 1. Gate record (TZ §8.8 discipline — the process re-runs the full gates on `dev` after landing)

| Check | Result | Source |
| --- | --- | --- |
| Full `make test` on this branch | **green — 62 files / 1178 tests** (api-client 53 + helper 8 + web 62/1117… totals 1178) | R: this session |
| `make lint` on this branch | **clean** (eslint . — no output) | R: this session |
| `make build` on this branch | **green — 0 errors** (svelte-check: 0 errors, 10 pre-existing `state_referenced_locally` warnings in `JoinFlow.svelte` + the retired `TokenGate.svelte`; vite build + adapter-static ok) | R: this session |
| Targeted host suites (first-hand, before the full run) | **green — 183/183 in 9 files**: host-entry 23 + host-panel 20 + host-stats 16 + bucket-chart 8 + member-drilldown 8 + host-invites 18 + host-invite-qr 16 + host-invite-ledger 19 + i18n 55 (55 in i18n incl. pre-round rows) | R: `npm run test -w @bleak/web -- tests/{host-entry,host-panel,host-stats,bucket-chart,member-drilldown,host-invites,host-invite-qr,host-invite-ledger,i18n}.test.ts` |
| Owning workers' gates (wave 1/2) | green, recorded in their session reports; MR records `merged` `ci=green` (autonomous merge mode) | task DB / dev log |

No test was added or modified by this sweep. No product code touched (the two
dispositioned fix-up candidates are **findings**, not patches — see §5).

---

## 2. AC sweep — all 58 DESIGN rev. 4 host criteria (§3.7.1 1–12, §3.7.2 1–15, §3.7.3 1–12, §3.7.4 1–7, §3.7.5 1–12)

**Verdict: 58/58 PASS.** Two non-AC discrepancies are recorded as findings
F-1/F-2 (§5) — neither fails a numbered criterion.

### §3.7.1 `/host` — create a room or log back in (ACs 1–12)

Evidence base: `apps/web/src/routes/host/+page.svelte` (S, 406 ln),
`HostEntryCard.svelte` (S, 350 ln), `CreateRoomForm.svelte` (S),
`tests/host-entry.test.ts` (23 contracts), `tests/sweep.test.ts`,
`tests/api-contexts.test.ts`, `tests/host-session.test.ts`,
`tests/storage-inventory.test.ts`.

| AC | Check | Result | Evidence |
| --- | --- | --- | --- |
| 1 | Without a stored `bleak.hostRoom`, `/host` shows the entry card pre-selected to **Create**; no tab bar and no footer Host entry on any host route | PASS | T: host-entry — "default boot shows the entry card pre-selected to Create with both modes reachable" — R: green. S: `+layout.svelte` 43–52 — `isJoin` now includes `pathname.startsWith('/host')` (TZ13-01 comment cites §3.7.1 AC 1) — the TabBar never renders on the host tree. G: TabBar items are exactly `/room /people /contacts /chats /profile` — **no `/host` row** (§54.4/§10.1.8; the §4.7 `nav.host` key exists but is not rendered) |
| 2 | The creation token is never persisted and never rendered outside the masked input; 401/403 shows «Токен отклонён.», keeps the value masked, stores nothing | PASS | T: host-entry — "masked inputs…type=password + autocomplete=off"; "happy path: …creation token ONLY in the header arg (custody)"; "a rejected creation token (401/403) shows «Токен отклонён.» + server text, value kept masked, nothing stored" — R: green. S: HostEntryCard `tokenValue` is plain `$state` (memory only); G: `localStorage.setItem|sessionStorage.setItem` inventory (§4 sweep h) — no creation-token key exists |
| 3 | Successful create: client-generated room token, `POST /api/room` with the creation token in `x-create-token` + `{ name, description, language, token }` in the body, stores `{ roomAddress, roomToken, code }`, navigates to `/host/<room_address>` | PASS | T: host-entry "happy path…" — R: green. T: api-contexts — "room creation authenticates with the creation token header — no Bearer, room token in the body"; "createRoomWithInvite: create (creation header) then mint (Bearer = the body room token)"; "createRoomWithInvite prefers the invite code minted at creation — no extra mint". S: `+page.svelte` `onCreate` 172–220 (`generateTokenSecret()` → `hostApi.createRoomWithInvite` → `saveHostRoom` → `goto`) |
| 4 | Log-in always offers address + masked key; a 200 probe stores/overwrites `bleak.hostRoom` and navigates; 401/403 shows «Ключ комнаты отклонён.» and stores nothing | PASS | T: host-entry — "200 validates through the probe path, stores/overwrites with an unknown code and navigates — the hostApi gate never fires" — R: green. S: `onLogin` 227–257 (401/403/404 → `loginRejected`, nothing stored). Note (in-spec): a 404 probe is mapped to the same honest inline rejection — the address names no room (TZ13-02 comment) |
| 5 | The mode switch never dead-ends: switching preserves entered values, both modes reachable from every state | PASS | T: host-entry — "switching modes never loses input (non-dead-end): values survive the round trip" — R: green. S: both forms live in HostEntryCard's own state (`draft`, `tokenValue`, `loginKey` persist across the `{#if mode}` branches) |
| 6 | On mount with a stored session, the invite-list GET probe auto-navigates on 200 without rendering the forms; skeleton + «Проверяем доступ к комнате…» during the probe | PASS | T: host-entry — "200 → skeleton + «Проверяем доступ к комнате…» while probing, then auto-navigate with no form flash" — R: green. S: `runProbe` 119–156 (`phase = 'probe'` renders the skeleton card, `aria-busy`) |
| 7 | Probe 401 clears `bleak.hostRoom`, shows the reset notice, falls back to Create; a 404 shows «Комната удалена.» and clears the entry | PASS | T: host-entry — "401 → clears the stored entry, shows the reset notice, falls back to Create"; "404 → clears the entry and shows «Комната удалена.»" — R: green. S: `runProbe` catch 136–155 (`mode = 'create'` on the dead-key fallback; `notice = 'deleted'` on 404) |
| 8 | Probe NetworkError keeps the stored entry, shows the banner + retry, leaves the card usable | PASS | T: host-entry — "NetworkError → the stored entry is KEPT, banner + retry above the usable card; retry re-probes" — R: green. S: the `else` branch keeps `hostRoom` untouched |
| 9 | The reset notice renders only when `bleak.hostNotice` is set, is announced politely, removed after render (once per incident), pre-selects Log-in | PASS | T: host-entry — "renders only when `bleak.hostNotice` is set, consumes the key once, and pre-selects Log-in"; "no flag → no notice" — R: green. S: boot effect 98–106 (`removeItem` after rendering; `mode = 'login'`); notice markup `aria-live="polite"` with the lock glyph |
| 10 | "Forgot the address?" probes the public list bounded (≤ 4 concurrent, cap 25, stop at first 200); a match fills the address + continues validation; no match shows the honest copy; the finder never writes storage | PASS | T: host-entry — "no match: probes the public list … never writes storage"; "a match fills the address and continues the normal validation → store + navigate"; "shows «Ищем комнату…» …"; "runs at most 4 probes in flight"; "stops at the first 200 — no NEW probes start after a match" — R: green. S: `findRoomByKey` (module script 23–49) + `startFind` 263–288 |
| 11 | Masked inputs are `type="password"` `autocomplete="off"`; mode switch + every button ≥ 48px with visible focus | PASS | T: host-entry masked-inputs contract — R: green. S: `.modes :global(button) { min-height: var(--touch-target) }` with the AC-11 comment (the shared SegmentedControl's 40px inline default pinned up on this page only); all inputs/buttons use `--touch-target` |
| 12 | `/host` never redirects based on attendee identity; only the host session drives behavior | PASS | T: host-entry — "an attendee identity never redirects /host — the entry card drives everything" — R: green. S: the entry page imports nothing from `stores/identity` (grep-clean) |

### §3.7.2 `/host/[room_address]` — main admin panel (ACs 1–15)

Evidence base: `routes/host/[room_address]/+page.svelte` (S, 559 ln),
`PanelMembers.svelte`, `MemberDrillDown.svelte`, `PanelSettings.svelte`,
`ShareKit.svelte`, `hostPanel.ts`, `tests/host-panel.test.ts` (20),
`tests/member-drilldown.test.ts` (8), `tests/chat-clear-guard.test.ts`.

| AC | Check | Result | Evidence |
| --- | --- | --- | --- |
| 1 | Redirects to `/host` unless the stored `bleak.hostRoom` matches the URL param | PASS | T: host-panel — "redirects to /host when no stored room session exists"; "redirects … when the stored roomAddress does not match the URL param" — R: green. S: `guardRoomAddress` (hostPanel.ts 19–24) + boot effect |
| 2 | Top bar shows the live room name (public `getRoom`), the muted address chip, the read-only «Язык агентов…»/«Вместимость…» data chips; no control mutates `language`/`max_user` | PASS | T: host-panel — "shows the live room h1, the muted address chip and the read-only data chips with the F9 hint" — R: green. S: chips are `Chip variant="outline-muted"` (data display); the PUT body carries `{ name, description }` only |
| 3 | Member list polls `listRoomUsers` every 5 s (public); the tile shows `listRoomUsers.length` against `getRoom.max_user`; the Poller stops on route teardown | PASS | T: host-panel — "polls members every 5 s; the tile shows n against max_user; rows open the drill-down with the real room-token listing"; "runs one member tick per 5 s and the stats fan-out on ticks 0 and 3; no requests after unmount" — R: green. S: `Poller({ intervalMs: 5000 … })` + the `$effect` cleanup returning `() => poller.stop()` |
| 4 | A drill-down opens on demand and lists dialogs via the room-token `GET …/user/{address}/chat`; each row links to the read-only `/chats/{address}` transcript | PASS | T: host-panel — drill-down rows open with the real room-token listing; member-drilldown — "renders dialog rows linking to /chats/{address} with clear + restart actions and per-record aria-labels" — R: green. S: `openMember` 214–242 → `hostApi.listChatsOfRoomUser`; drill rows `href={resolve('/chats/[address]', …)}` |
| 5 | "Clear history" confirms with the specified copy and calls `DELETE /api/chat/{address}/message` with the room token | PASS | T: host-panel — "clear history confirms with the specified copy and calls DELETE /api/chat/{address}/message (room token)" — R: green; T: chat-clear-guard — "host drill-down clear remains present and wired". S: `onClearChat` → `hostApi.clearChatHistory` (room-token context) |
| 6 | "Restart" confirms with the §3.5 kickoff copy and calls `POST /api/chat/{address}/kickoff` with the room token; kickoff is per-dialog only — no room-level batch control | PASS | T: host-panel — "restart confirms with the §3.5 kickoff copy, calls POST kickoff (room token)…"; "kickoff is per-dialog only — no room-level batch control exists" — R: green. S: confirm uses `chat.kickoff.confirm_title/confirm_body/confirm_run` (the §8.1.9 survivors); `onKickoffChat` → `hostApi.kickoffChat`. Speaker-line format: **Finding F-1** (non-AC) |
| 7 | The locked rule-D row renders non-interactive (`aria-disabled`), and no `DELETE /api/room/{room}/user/{address}` call exists anywhere in the UI | PASS | T: member-drilldown — "renders at the sheet bottom: non-interactive, aria-disabled, lock glyph, no click handler"; host-panel — "the rule-D locked row renders non-interactive…; no deleteRoomUser anywhere in host code" — R: green. G (sweep e): `deleteRoomUser` exists only in the attendee `api` context (client.ts 292) — the host context maps it nowhere (`ROOM_TOKEN_METHODS` excludes it; `hostApi` has no such method) |
| 8 | No handshake counts anywhere on the panel (rule B) | PASS | T: host-panel — "renders skeletons first, then the tile row as a <dl>, the chart card and the rule-B hint — no handshake metrics"; "no listHandshakesOfUser and no deleteRoomUser reference anywhere in host code (comments excluded)" — R: green. G (sweep d): `listHandshakesOfUser` calls exist only on `/room`, `/profile`, `/people` (attendee persona context) |
| 9 | Share region: 6-digit `code` (Handjet, digits spelled in the aria-label), client-side `InviteQr` of `{INVITE_URL_BASE}?code={code}` (no helper PNG), working "Join as attendee" link to `/?code={code}` | PASS | T: host-panel — "renders the big Handjet code (digits spelled in the aria-label), the client-side InviteQr (no helper PNG) and the join + invites links" — R: green. S: ShareKit (join CTA `/?code=${code}`); `InviteQr` payload = `inviteQrPayload(code)` (svgQr.ts). Legacy `inviteUrl` branch is dead code — Finding F-2 |
| 10 | Settings save `name`/`description` via `PUT /api/room/{address}` (room token); 400 → server-text field error; read-only hint shows the server-amendment copy | PASS | T: host-panel — "saves name/description via PUT updateRoom (body {name, description} ONLY), shows the transient «Сохранено» and refreshes the header from the PUT response"; "a 400 surfaces the server-text field error (AC 10)" — R: green. S: `readonly_hint` = `host.room.readonly_hint` (verbatim §4.7) |
| 11 | "Regenerate room token" confirms with the specified copy, calls `POST /api/room/{address}/token` with the current Bearer, updates the stored token in place | PASS | T: host-panel — "rotation confirms with the specified copy, calls POST token with the current Bearer and rewrites the stored roomToken IN PLACE (AC 11)" — R: green; T: api-contexts — "rotations: Bearer = the CURRENT credential, body = the new raw secret"; host-session — "room-token rotation rewrites the entry in place, preserving the other fields" |
| 12 | "Delete room" confirms, calls `DELETE /api/room/{address}`, clears the stored room, returns to `/host` (entry card, Create mode) | PASS | T: host-panel — "delete confirms, calls DELETE /api/room/{address}, clears the stored room and lands on /host (AC 12)" — R: green. S: `onDeleteRoom` 343–358 → `clearHostRoom()` → `/host` (notice flag NOT set — the Create fallback is the entry default) |
| 13 | Host-context 401/403 on any room-token call clears `bleak.hostRoom`, sets `bleak.hostNotice`, lands on `/host` (log-in mode) with the «Доступ к комнате отозван…» notice, attendee identity untouched | PASS | T (sweep c, end-to-end): api-contexts — "401/403 on a room-token call clears bleak.hostRoom + sets bleak.hostNotice; attendee identity untouched; rethrown" (identity asserted intact); host-panel — "a %i on a room-token call clears bleak.hostRoom, sets bleak.hostNotice and lands on /host — attendee identity untouched"; host-entry — "renders only when `bleak.hostNotice` is set, consumes the key once, and pre-selects Log-in" (log-in mode with the notice) — R: all green |
| 14 | `getRoom` 404 while the panel is open → «Комната удалена.» clears the stored room and redirects to `/host` | PASS | T: host-panel — "getRoom 404 (room deleted elsewhere) → full-page «Комната удалена.» state, cleared room + redirect" — R: green. S: the Poller `onStall` 404 branch |
| 15 | ≥ 900px two-column (main + sticky side share column); below, regions stack in the specified order | PASS | T: host-panel — "stacks members + statistics, share, settings in the specified order; the share column holds the invite shortcut"; "lays out two columns on ≥ 900px viewports (main ≈ 58% scrolls, sticky side ≈ 42%, max 1080px)" — R: green. S: the grid template areas `a/b/c` → `a b/c b` at 900px, `.side { position: sticky }` |

### §3.7.3 `/host/[room_address]/invite` — active + expired/revoked codes (ACs 1–12)

Evidence base: `routes/host/[room_address]/invite/+page.svelte` (S, 314 ln),
`InviteManager.svelte`, `InviteRow.svelte`, `hostInviteLedger.ts`,
`tests/host-invites.test.ts` (18), `tests/host-invite-ledger.test.ts` (19),
`tests/host-console.test.ts`.

| AC | Check | Result | Evidence |
| --- | --- | --- | --- |
| 1 | Redirects to `/host` without a matching stored session | PASS | T: host-invites — "redirects … when no stored room session exists"; "…does not match the URL param" — R: green |
| 2 | Active codes render from `GET …/invite` (room token) — only unexpired, unrevoked; the `{ invites: […] }` wrapper is handled | PASS | T: host-invites — "renders one InviteRow per active code with per-code aria-labels and the QR link…"; T: host-console — "activeInvites filters expired codes and sorts newest first (revoked/expired never render)". S: the delivered `hostApi.listInvites` unwraps the `{ invites }` wrapper (`api-client` fixes landed pre-round: `8ba8cf8` "fix-host-invites-wrapper") |
| 3 | Every mint and revoke response is appended to `bleak.hostInvites.<room address>` (rule C ledger) | PASS | T: host-invite-ledger — "appends every mint response of this device under bleak.hostInvites.<room>"; "stamps revoked_at on the minted entry"; "a revoke of an unknown code is still recorded" — R: green. S: the page records only after a successful `await` (onMint/onRevoke) |
| 4 | Minting with a preset (24 h pre-selected) or custom datetime calls `POST …/invite`; the new code appears with its own copy/QR/link/revoke actions | PASS | T: host-invites — "opens the inline chooser with the presets and 24 h pre-selected (default)"; "mints with the preselected 24 h preset…"; "mints with «Своё время…» — the custom datetime-local value becomes the ISO expiry" — R: green. S: `customExpiry` rejects a past value (hostLogic 29–36); `min={minLocal}` |
| 5 | "Revoke" calls `DELETE …/invite/{code}` with no confirm; the row leaves the active list and appears in history as revoked; transient «Код отозван.» shows | PASS | T: host-invites — "revokes with NO confirm; the row leaves the active list, appears in history as «отозван» and the ledger is stamped" — R: green. S: `revokedNote` timer (page-owned, 2 s) |
| 6 | Ledger entries missing from the server list render in "Expired & revoked" with the correct badge + date | PASS | T: host-invite-ledger — "ledger entries missing from the server list are history"; "a past expiry without revoked_at classifies as expired"; "a stamped revoked_at classifies as revoked even before expiry"; "an unexpired, unstamped code missing from the server list was revoked elsewhere" — R: green. T: host-invites — "renders ledger entries missing from the server list as expired/revoked badges with the caveat under the header" |
| 7 | The ledger caveat renders under the history header in the current locale | PASS | T: host-invites (same contract, caveat under the header) — R: green. G (sweep a): `host.invites.ledger_caveat` verbatim in both dictionaries («Коды, выпущенные с других устройств…» / "Codes minted on other devices…") |
| 8 | Dead (history) rows are non-interactive: no copy/QR/revoke actions, no navigation into a QR page | PASS | T: host-invites — "dead (history) rows are non-interactive: no copy/QR/revoke actions and no navigation (AC 8)" — R: green. S: history rows are plain `<li>` spans (InviteManager 213–224) |
| 9 | The empty state shows when there are no active codes and no ledger entries; the history section is omitted when empty | PASS | T: host-invites — "the empty state shows when there are no active codes and no ledger entries; its CTA opens the mint chooser"; "the history section is omitted when it has no entries" — R: green |
| 10 | The list polls every 15 s; each tick re-merges the ledger; errors render inline with retry and never clear the ledger | PASS | T: host-invites — "polls listInvites every 15 s, re-merges the ledger per tick, and issues no requests after unmount"; "list errors render inline with retry; the ledger section still renders (it is local)" — R: green. S: the onStall branch re-merges against `[]` so the local history survives a first-tick failure |
| 11 | Every row action carries its per-code `aria-label`; the QR action navigates to `/host/<room_address>/invite/{code}/qr` | PASS | T: host-invites (per-code aria-labels + the QR route link) — R: green. S: InviteRow 30–43 (`copy_code`/`qr_aria`/`copy_link`/`revoke_aria` with `{code}`) |
| 12 | Rows meet the ≥ 48px touch-target rule; badges are not color-only | PASS | S: InviteRow actions `min-height: var(--touch-target)`; the revoke is outline-destructive (`--color-danger` border + `--color-danger-text` font, Concept §7.1.6/§4.9.3 comment); history badges are muted TEXT with the date (never color-only). T: the empty/dead-row contracts render the badge text — R: green |

### §3.7.4 `/host/[room_address]/invite/[code]/qr` — invite QR page (ACs 1–7)

Evidence base: `routes/host/[room_address]/invite/[code]/qr/+page.svelte`
(S, 334 ln), `InviteQr.svelte`, `svgQr.ts`, `tests/host-invite-qr.test.ts`
(16), `tests/invite-qr.test.ts` (6), `tests/sweep.test.ts`.

| AC | Check | Result | Evidence |
| --- | --- | --- | --- |
| 1 | The QR encodes the absolute deep link `{INVITE_URL_BASE}?code={code}` (same payload as the helper PNG) and renders client-side (no network QR call) | PASS | T: invite-qr — "renders the client-side SVG with ZERO network requests (fetch/XHR/Image never touched)"; "encodes the absolute invite deep link {base}/?code={code} — decodes back via jsqr"; "renders EXACTLY the shared SVG of the invite deep link (same renderer, same payload)" — R: green; T: host-invite-qr — "renders the client-side QR with ZERO network requests, 280px pixel-cornered frame and the code aria-label" |
| 2 | The 6-digit code in Handjet with a copy action whose aria-label includes the code; the clipboard receives the digits | PASS | T: host-invite-qr — "shows the 6-digit code (Handjet 40px) with a copy-code chip whose clipboard receives the digits" — R: green. S: `host.qr.copy_code_aria` = «Скопировать код {code}» |
| 3 | Copy-link writes `{INVITE_URL_BASE}?code={code}` to the clipboard; native Share renders ONLY where `navigator.share` exists and shares the same URL | PASS | T: host-invite-qr — "the copy-link control writes the absolute invite deep link to the clipboard"; "renders NO native Share button where navigator.share does not exist"; "renders the native Share button ONLY where navigator.share exists and shares the SAME URL" — R: green |
| 4 | **The link text is never rendered anywhere on the page** — no text node, no `title`, no tooltip; buttons only (hard AC) | PASS | T: host-invite-qr — "the URL appears only in clipboard/share payloads — never as text, title or tooltip" — R: green. G (sweep f): the host tree's `{link}`/`{payload}` bindings resolve only to `CopyButton value=` / `navigator.share({ url })`; the only `title=` attributes on host routes carry *dates and confirm titles* (PanelMembers joined date, ConfirmDialog titles), never the URL |
| 5 | An unknown `[code]` renders the warning line but still renders the QR + code actions | PASS | T: host-invite-qr — "an unknown [code] renders the warning line but still renders the QR and the code actions"; "a code known from the server list renders NO warning"; "a code known from the device ledger (expired/revoked here) renders NO warning" — R: green |
| 6 | No Poller runs on this page (one liveness recheck on mount, then idle) | PASS | T: host-invite-qr — "runs ONE liveness recheck on mount, then idle — no further requests"; "shows the skeleton card during the recheck" — R: green. S: `recheckStarted` one-shot flag; no Poller instance in the file |
| 7 | Copy actions confirm with «Скопировано» announced politely; back returns to the invite page | PASS | T: host-invite-qr — "copy actions confirm with «Скопировано» announced aria-live=polite"; "the back control returns to the invite page" — R: green. S: `resolve('/host/[room_address]/invite', …)` on the back link |

### §3.7.5 Statistics (region 2 on the panel) (ACs 1–12)

Evidence base: `stats/hostStats.ts`, `stats/StatsPanel.svelte`,
`stats/BucketChart.svelte`, `hostPanel.ts`, `tests/host-stats.test.ts` (16),
`tests/bucket-chart.test.ts` (8), host-panel tests 12/19.

| AC | Check | Result | Evidence |
| --- | --- | --- | --- |
| 1 | The engine runs on the page Poller (15 s — every third 5 s tick), stops on teardown, refreshes on visibility regain | PASS | T: host-stats — "isStatsTick: every third 5 s Poller tick (⇒ 15 s cadence)"; host-panel — "runs one member tick per 5 s and the stats fan-out on ticks 0 and 3; no requests after unmount" — R: green. S: `onVisibilityChange` calls `runStats()` (page 192–197) |
| 2 | Fan-out order + dedupe: member list → per-member chat lists (room token) → chats deduped by address → one message fetch per unique chat via a participant segment; concurrency ≤ 4 at every step | PASS | T: host-stats — "dedupes chats by address across members and fetches each unique chat once"; "keeps fan-out concurrency ≤ 4 at every step (mock queue)"; "runs at most `limit` tasks in flight and preserves input order" — R: green. S: `runStatsPass` (hostStats.ts 107–146; `participant = chat.participants[0]?.user`) |
| 3 | M2/M3/M4 from the engine: users = `listRoomUsers.length`, chats = the deduped count, active/finished split by `Chat.done` | PASS | T: host-stats — "M1 renders from message fetches; total = the bucket sum"; "splits active vs finished by Chat.done (missing done = active)"; "kickoff resets a chat to active: the next pass re-reads done=false" — R: green |
| 4 | M1 as the hand-rolled SVG `BucketChart`: 12 buckets of 5 min over the past hour by `created_at`; no chart library, no new dependency | PASS | T: host-stats — "buckets by created_at: newest bucket = now, oldest = 60…55 min ago, outside the hour excluded" — R: green. G (sweep b): `package.json` has **no chart dependency**; the wave diff touches no package manifest — the chart is hand-rolled SVG |
| 5 | Chart visuals per spec: accent-tinted bars (newest full accent when non-zero), 2px disabled stubs, 1px muted baseline, the 5 relative axis labels at ≥ 14px | PASS | T: bucket-chart — "renders the SVG with the pinned viewBox and role=img + summary aria-label"; "renders 12 bar slots with bars for non-zero buckets and 2px stubs for zeros"; "renders the newest bucket at full accent when non-zero"; "marks exactly the 5 relative axis labels (every 3rd bucket + now); no per-bar value labels"; "carries the peak accent dot above the tallest bar" — R: green. S: `text { font-size: 14px }` |
| 6 | Empty hour → baseline + stubs + «За последний час сообщений не было.»; empty room → members-empty copy, engine skipped | PASS | T: bucket-chart — "renders baseline + stubs + the muted «За последний час сообщений не было.» line"; host-stats — "empty room: the engine skips the fan-out entirely (zero stats, zero calls)" — R: green. S: StatsPanel renders `host.empty_live` when `stats.members === 0` |
| 7 | Partial failures keep subset metrics + the «Часть данных…» warning; full failure → `ErrorBanner` with dimmed last-known tiles | PASS | T: host-stats — "a twice-failed branch is tolerated: subset metrics + partial=true"; "a branch failing once succeeds on its retry: no partial flag"; "a failed message branch marks partial; message totals become undercounts" — R: green. S: StatsPanel `.dimmed` classes on `error !== null` |
| 8 | The rule-B hint line shows; NO handshake metrics, no zeros, no locked controls, no proxy metric until the gate lifts | PASS | T: host-panel — "…the rule-B hint — no handshake metrics" — R: green. S: StatsPanel 113–114 — the hint is the ONLY handshake reference; no M5–M7 markup exists (the spec text lives in the §3.7.5 GATED BLOCK, pre-designed for `tz2-07a`) |
| 9 | When the flag-6.9a / `tz2-07a` amendment lands, M5–M7 render per the specification without design rework | PASS (as a standing spec, not built — the gate is closed) | S: StatsPanel's doc comment reserves the placement ("M5 joins the tile row and M6/M7 render as two list cards under the chart WITHOUT design rework"); the keys (`host.stats.gated.def/empty`) already exist in both dictionaries (G, sweep a). Backend dependency — recorded in sweep (j) |
| 10 | The chart carries `role="img"` + the summary aria-label; the tile row is a `<dl>`; every new string exists in RU and EN | PASS | T: bucket-chart (role/aria) — R: green; T: host-panel — "renders… the tile row as a <dl>"; i18n — "ru and en have exactly the same keys" + "every rev. 4 host key exists in BOTH dictionaries (62 rows incl. the amended session_reset)" — R: green |
| 11 | No hardcoded colors: the chart uses §4.1 tokens only (incl. the `color-mix` accent tint) | PASS | T: bucket-chart — "contains NO raw color literals — hex, rgb() or named fills" — R: green. S: fills are `color-mix(in srgb, var(--color-accent) 70%, transparent)`, `var(--color-accent)`, `var(--color-text-disabled)`, `var(--color-text-muted)` |
| 12 | Poll ticks producing identical stats do not re-render (diff in the caller) | PASS | T: host-stats — "statsEqual: identical stats compare equal (identical ticks never re-render)" — R: green. S: the page keeps the previous reference (`if (!statsEqual(stats, next)) stats = next`) |

---

## 3. Round sweeps (a)–(j) — grep/mock/script checks recorded here, not committed

### (a) i18n parity + copy audit of every host-route string against §4.7 rev. 4 — PASS

- **G (script):** 112 distinct `translate($locale, '…')` keys extracted from the
  four host route files + the ten host components (one regex false-positive
  batch excluded: `selectPreset('1h'…)`, `createElement('textarea')`). All 112
  exist in **both** `ru.ts` and `en.ts` — zero missing. Dictionary sizes:
  **ru = en = 440 keys**, `only-in-ru = []`, `only-in-en = []` (the parity
  contract is also test-enforced: i18n "ru and en have exactly the same keys").
- **Verbatim copy checks (script) against the §4.7 rev. 4 rows:** the reset
  notice (`host.session_reset` — the amended key-room wording, both
  dictionaries), both gate rejections (`host.token.rejected`,
  `host.login.rejected`), the ledger caveat (`host.invites.ledger_caveat`),
  the rule-B hint (`host.stats.gated.hint`), the rule-D locked row
  (`host.drill.delete_member_locked`), the expired/revoked badges, the axis
  labels («−60 мин» with U+2212 in RU / ASCII hyphen in EN — §4.7 verbatim),
  the summary aria-label — all verbatim. T: i18n "spot-checks verbatim rev. 4
  RU strings (entry + panel + invites + stats)" — R: green.
- **Locale switch mid-flow:** every host component resolves copy through
  `$derived(translate($locale, …))` — a `setLocale` re-render swaps every
  string in place (manual check note; the reactive pattern is uniform — G:
  no host component caches translated text outside a `$derived`).
- **The one §4.7 row not delivered:** `chat.kickoff.speaker` — **Finding F-1**
  (§5).

### (b) No-new-dependency check — PASS

- **G:** root + `apps/web` `package.json` contain **no chart library**; the
  wave diff (`eba89a6^..d89b635`) touches **no package manifest / lockfile** —
  no runtime dependency was added vs the delivered tree.
- **G:** `uqr` (^0.1.3) is a **pre-existing** dependency (the §3.6 persona
  badge); TZ13-01 only *extracted* the shared renderer into
  `lib/qr/svgQr.ts` — sweep.test.ts "uqr is imported only by the shared
  lib/qr module (TZ13-01 extraction — profile + host chunks share it)" — R:
  green (part of the full run).

### (c) Host-symmetric 401 reset end-to-end — PASS

- **Gate level:** T: api-contexts "401/403 on a room-token call clears
  `bleak.hostRoom` + sets `bleak.hostNotice`; attendee identity untouched;
  rethrown" (asserts `bleak.identity` still parses to the saved persona);
  "other statuses keep the room session"; "room creation is NOT gated: a 403
  there sets no hostNotice".
- **Landing level:** T: host-panel / host-invites / host-invite-qr — "a %i …
  clears bleak.hostRoom, sets bleak.hostNotice and lands on /host — attendee
  identity untouched" (all three room-token surfaces) — R: green.
- **Notice level:** T: host-entry "renders only when `bleak.hostNotice` is
  set, consumes the key once, and pre-selects Log-in" — the reset lands on
  `/host` in **log-in mode** with the «Доступ к комнате отозван…» notice.
- The transcript's host-view fallback (§3.5, pre-existing) replicates the same
  semantics: T: transcript-page "a host-context 401 on the retry replicates
  the hostApi gate: host room cleared + hostNotice flag, identity untouched".

### (d) Rule-B negative sweep — PASS

- **G:** `listHandshakesOfUser` appears in `src` only in the attendee persona
  context (`lib/api/client.ts` `PERSONA_TOKEN_METHODS` + the `api` method) and
  its three attendee callers (`/room`, `/profile`, `/people`). **Zero host
  route/component references** (comments aside, grep-enforced by
  host-panel test 20).
- **G:** `hostApi` maps no handshake method; `ROOM_TOKEN_METHODS` deliberately
  excludes it (api-contexts "listHandshakesOfUser is NOT a room-token method").
- **G:** no handshake-panel markup exists on any host route — the stats
  region renders the hint line only (§3.7.5 AC 8 above).

### (e) Rule-D negative sweep — PASS

- **G:** `deleteRoomUser` exists only in the attendee `api` context; **no host
  route/component calls it**; `hostApi` has no such method.
- **S/T:** the drill-down's locked row is a plain `<div aria-disabled="true">`
  with the lock glyph — no click handler, no navigation; T: member-drilldown
  "renders at the sheet bottom: non-interactive, aria-disabled, lock glyph, no
  click handler" — R: green.

### (f) Link-never-rendered sweep — PASS

- **G:** every host-tree occurrence of the invite link/deep-link payload:
  - `InviteRow.svelte` — `link` = `inviteLink(code, baseUrl)` feeds **only**
    `<CopyButton value={link} …>` (the per-code aria-label is the §4.7
    «Скопировать ссылку кода {code}» copy — the URL itself is never text);
  - the QR page — `payload` = `inviteQrPayload(code)` feeds **only**
    `copyText(payload)` / `navigator.share({ url: payload })`;
  - `ShareKit.svelte` — the QR payload lives inside `InviteQr`; the join CTA
    href is `/?code={code}` (a navigation href, not rendered link text).
- **T:** host-invite-qr "the URL appears only in clipboard/share payloads —
  never as text, title or tooltip" — R: green. The only `title=` attributes on
  host routes carry dates / confirm titles, never URLs (G).

### (g) Creation-token custody re-check — PASS

- **S/G:** the creation token lives only in `HostEntryCard`'s `$state`
  (`tokenValue`, masked `type="password"`) and the page's in-memory `Retry`
  payload; it travels **only** in the `x-create-token` header
  (`apiRaw.createRoom(request, createToken)`). No `localStorage` /
  `sessionStorage` write touches it anywhere (the full storage-write inventory
  in sweep (h) contains no creation-token key); it is not logged and never
  rendered outside the masked input (host-entry test 2/4).

### (h) Ledger/storage custody — PASS

- **G (full `localStorage.setItem` / `sessionStorage.setItem` inventory of
  `src`):** `bleak.locale` (i18n), `bleak.hostRoom` (hostSession),
  `bleak.hostInvites.<room address>` (hostInviteLedger), `bleak.identity`,
  `bleak.tokenVault`, `bleak.mutualCode`, `bleak.chatsSeen`,
  `bleak.contactsSeen`, `bleak.interests`, `bleak.contactCard.*`;
  `sessionStorage`: `bleak.authNotice`, `bleak.hostNotice`. **The only key
  family introduced by this round is `bleak.hostInvites.*`** (the file is new
  in the wave diff; every other key predates tz13).
- **Append-only:** T: host-invite-ledger "is append-only and idempotent per
  code"; "records nothing on a failed/garbage mint response"; "a revoked code
  keeps its expiry — only revoked_at is added"; "stamping twice is a no-op" —
  R: green. Deleting the room leaves the ledger entries orphaned **by design**
  (TZ §9.4 note 5 — recorded, not a bug).
- T: storage-inventory "the host room session writes only bleak.hostRoom";
  "the v1 host-token shim key bleak.hostToken is gone".

### (i) Bundle re-check — PASS (sizes recorded)

- **uqr is a shared lazy chunk of the profile + host routes:** build output
  (this session's `make build`) — the uqr + svgQr renderer compiles into ONE
  client chunk `chunks/tbxHHmrW.js` (10.6 kB raw, ≈ 4.2 kB gzip), statically
  imported by exactly three client chunks:
  `chunks/CNtb3gc-.js` (the `InviteQr` component chunk, 0.55 kB) → imported by
  `nodes/7.CSeAz7yO.js` (**/host/[room_address]** panel leaf) and
  `nodes/9.DQsmG9cz.js` (**/host/[room_address]/invite/[code]/qr** leaf);
  plus `nodes/14.CVD81tch.js` (**/profile** leaf — the persona badge). The
  route→leaf mapping is read from the server manifest (`/host` tree = leaves
  6–9, `/profile` = leaf 14). `entry/app` references the chunk only in the
  lazy deps map — uqr never loads on pages that render no QR (entry, invites
  list, join, chats…). T: sweep "uqr is imported only by the shared lib/qr
  module" — R: green.
- **Any-page ≤ 80 kB holds.** Largest client JS asset: the shared Svelte
  runtime chunk `CQ4JhYVP.js` = **47.49 kB gzip** (loaded by every page).
  Heaviest route loads (gzip): host panel ≈ 0.30 (entry/start) + 1.99
  (entry/app) + 1.26 (layout node) + 8.93 (nodes/7) + shared chunks — well
  under the budget; the heaviest attendee route (/chats/[address]) adds
  8.02 (nodes/4) + 4.25-gzip ChatTranscript chunk. All routes ≤ ~35 kB gzip
  JS excluding fonts/media. Host route server entries: entry 23.12 kB /
  panel 25.13 kB / invite 5.68 kB / QR 4.21 kB raw (SSR-only, not shipped).
- `make build`: **0 errors**, 10 pre-existing warnings (2 files — see §1).

### (j) Contract reconciliation status — RECORDED (backend dependencies, no client action)

- **F9** (`UpdateRoomRequest` stays `{ name, description }` —
  `language`/`max_user` read-only chips + the server-amendment hint) and
  **F10** (the PUT's missing security-scheme declaration; the client sends
  the room token as Bearer per §54.1) — both render honestly and are
  backend-gated. **Rules B/D gates:** `listHandshakesOfUser` /
  `deleteRoomUser` are persona-token-only (verified against the delivered
  swagger; the sweeps above prove no UI call). All four carry the §54.5
  backend-TODO-ledger references:
  `[ ] Room-token acceptance on GET /api/handshake/user/{address}` (flag 6.9a
  / pre-authorized `tz2-07a` — gates M5–M7) and
  `[ ] Room-token acceptance on DELETE /api/room/{room}/user/{address}`
  (rule D — gates the host delete-user UI).
- **G:** the existing `TBD(WP-6)` markers in `docs/TZ.md` are **unchanged** by
  this round (10 occurrences, all pre-round v2-credential mapping points;
  the tz13 wave diff touched no TZ doc section) — per the sweep spec they
  stand as-is.
- The pre-authorized `tz2-07a` follow-up remains open and untouched (Concept
  §54.5; §9.7 flag 1).

---

## 4. Test anchors (existing suites kept green; nothing added by this sweep)

| Suite | Verified scope | Status this sweep |
| --- | --- | --- |
| `tests/host-entry.test.ts` (23) | §3.7.1 ACs 1–12 (entry card, custody, probes, finder bounds, identity-neutrality) | green (spot-run + full run) |
| `tests/host-panel.test.ts` (20) | §3.7.2 ACs 1–15 (guard, chips, 5 s poll, drill-down, F9/PUT, rotation, delete, reset, layout) | green |
| `tests/host-stats.test.ts` (16) | §3.7.5 ACs 1–3/7/12 (engine, dedupe, cadence, diff) | green |
| `tests/bucket-chart.test.ts` (8) | §3.7.5 ACs 4–6/10–11 (SVG chart + tokens) | green |
| `tests/member-drilldown.test.ts` (8) | §3.7.2 ACs 4–7 (rows, confirms, locked row) | green |
| `tests/host-invites.test.ts` (18) | §3.7.3 ACs 1–12 (route + rule C UI) | green |
| `tests/host-invite-ledger.test.ts` (19) | rule C store (append-only, merge) | green |
| `tests/host-invite-qr.test.ts` (16) | §3.7.4 ACs 1–7 (client-side QR, link-never-rendered, no Poller) | green |
| `tests/invite-qr.test.ts` (6) | the shared `InviteQr`/uqr renderer | green |
| `tests/i18n.test.ts` (55) | RU/EN parity + §4.7 rev. 4 verbatim audit | green |
| `tests/api-contexts.test.ts` | credential contexts + both 401 gates (sweep c) | green |
| `tests/host-session.test.ts` / `tests/storage-inventory.test.ts` | `bleak.hostRoom` custody (sweeps g/h) | green |
| `tests/sweep.test.ts` | the uqr-import rule, poll cadences, color/token bans | green |
| `tests/host-console.test.ts` (2) | the surviving pure helpers (hostLogic) | green |

**Totals this sweep:** full `make test` 1178/1178 · targeted host walk
183/183 · no test files added/modified.

---

## 5. Fix-up candidates disposition + findings

### F-1 — Kickoff speaker line: the §4.7 `chat.kickoff.speaker` format is not applied (NOT FIXED — finding; exceeds the one-liner allowance)

- **What the panel renders:** after a successful drill-down kickoff the page
  resolves the `KickoffResponse.speaker` against the roster and
  `MemberDrillDown.svelte` (line 228) renders the **raw resolved name** as the
  transient line (`{kickoffSpeaker}`, e.g. «Борис») — not the §4.7 format
  `chat.kickoff.speaker` = «Первым говорит {name}» / "{name} speaks first".
  DESIGN §3.7.2 (region 1 bullet) says the speaker line "reuses
  `chat.kickoff.speaker`", and §4.7 rev. 4 still lists the row — but the key
  was **retired from both dictionaries** by tz4-05 under Concept §8.1.9
  (kickoff left the attendee dialog view), and that retirement is enforced by
  two **standing test contracts**: `i18n.test.ts` "kickoff button/speaker keys
  are retired from BOTH dictionaries; the confirm copy stays (Concept
  §8.1.9)" and `transcript-page.test.ts` (`expect(ru).not.toHaveProperty('chat.kickoff.speaker')`).
- **Why not fixed here:** "add the missing key" would break the two retirement
  contracts, and rendering the format would break `member-drilldown.test.ts`
  ("renders the KickoffResponse speaker line") and `host-panel.test.ts`
  ("renders the KickoffResponse speaker line") — 3 dictionaries/components +
  3 test files in conflict. That is a **contract reconciliation**, not a
  one-liner. The speaker line is part of the §3.7.2 *layout prose*, not one of
  the 15 numbered §3.7.2 ACs — the 58-AC walk is unaffected (AC 6 covers the
  confirm copy + the call + per-dialog-only, all green).
- **Resolution options for the process/design:** (i) ratify the raw-name
  render and amend DESIGN §3.7.2/§4.7 (drop the row), or (ii) re-add the key
  in both dictionaries + apply the format in `MemberDrillDown` + amend the
  retirement contracts (the §4.7 wording is already ratified there). Either
  way it is a small dedicated bug card, not a sweep patch.

### F-2 — ShareKit legacy-compat props + legacy `/income` join href + the retired console components are dead code (NOT FIXED — finding; exceeds the one-liner allowance)

- **ShareKit legacy props** (`apps/web/src/lib/components/host/ShareKit.svelte`):
  `inviteUrl` / `qrSrc` / `oncreateAnother` exist only for the *retired*
  pre-rework entry console ("Kept so the not-yet-reworked console keeps
  compiling; they disappear with TZ13-02's console rework"). TZ13-02 has
  landed: the sole remaining call site is the panel, which passes only
  `code` + `roomAddress` (S). `qrSrc`/`oncreateAnother` are declared in
  `Props` but never even destructured; `inviteUrl` survives only in the
  `joinHref` legacy branch (lines 58–60) that resolves the **legacy
  `/income?code=` href** — dead on the delivered tree, where the panel's join
  CTA must be `/?code={code}` (which the live branch does correctly).
- **Retired components:** `TokenGate.svelte` (106 ln) and `LiveRoom.svelte`
  (424 ln) are referenced by **nothing** (G: zero imports across `src` and
  `tests`; `host-console.test.ts` now exercises only the pure helpers). The
  `TokenGate` warning also accounts for 1 of the 10 build warnings.
- **Why not fixed here:** the clean removal = drop the three Props + the
  legacy `joinHref` branch + the legacy comments in ShareKit, delete two dead
  component files, and re-point nothing — a contained but multi-file cleanup
  (~10 lines + 530 deleted lines), beyond the cross-cutting one-liner
  allowance. No behavior is affected (dead code only); recorded with exact
  locations above for the process bug flow.

### Applied fix-ups: none

Both known candidates exceed the one-liner allowance once the standing test
contracts are counted; no other cross-cutting one-liner miss surfaced in the
sweeps (the i18n audit is clean apart from F-1).

---

## 6. Verdict

- **58/58 DESIGN rev. 4 host ACs PASS** with first-hand evidence.
- **Round sweeps (a)–(j): all PASS / RECORDED** (no new dependencies; rule
  B/D greps clean; link-never-rendered holds; custody holds; `uqr` shared +
  lazy; budgets hold; contract notes recorded with §54.5 references).
- **Findings:** F-1 (speaker-line format vs the §8.1.9 retirement contracts),
  F-2 (dead legacy ShareKit props + retired console components). Neither
  fails a numbered AC; both are queued for the process.
- **Three-gate on this branch: lint clean · test 1178/1178 · build 0 errors.**

DELTA-WAVE CI: [pending — process fills]
