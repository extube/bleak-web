# bleak-web v3 — Verification sweep (tz5-08, verification-only)

Worker instance `9e7189a9` · 2026-11-19 · branch
`feature/9e7189a9-tz5-08-verify-v3` (base = dev tip `1c73ac7` — the landing of
`feature/53eff10e-tz5-07-radar-tuning`; all six §13 feature tasks R1–R6 landed
into `dev` before this sweep, see the commit map in §2). This sweep verifies
the **six items of Concept §13.1** (v3 reconciliation round, DESIGN §4.13)
are delivered on `dev`. It adds **no product code and no test files** —
one-shot source greps, landed-code reads and targeted spot-check runs
recorded here, per the verification-only constraint of the card. It
completes the §8–§13 verification record (v2.2–v2.5 in
`docs/verification-v22.md` … `-v25.md`; §12 in `verification-v26.md`).

Method legend: **S** = source inspection / one-shot grep in this sweep,
**T** = merged automated test (file — title), **R** = targeted spot-run
executed first-hand in this session, **C** = read of the landing commit's
diff (read-only git).

Landing commits of the §13 round (dev log, all pre-sweep): tz5-01
api-v3-contract `ff0bade`, tz5-02 interests `f035091`, tz5-03 chat-done
`5159735`, tz5-04 contact-share `7cf0273`, tz5-05 chats-sort `892b600`,
tz5-06 summary-sheet `670cb96`, tz5-07 radar-tuning `1c73ac7`.

---

## 1. Gate record (TZ §8.8 discipline — full gates are delta-wave-CI's job)

| Check | Result | Source |
| --- | --- | --- |
| Full `make test` re-run by this sweep | **not run** (the process runs the delta-wave CI after this landing) | this session |
| DELTA-WAVE CI | **GREEN** (2026-11-19T17:54Z, process, dev tip `9f9e9af` — covers this sweep AND the §14 item-5 sheet-i18n bug round, same wave per owner routing): `make lint` clean · `make test` 721 passed (49 api-client + 8 helper + 664 web, 47 files) · `make build` 0 svelte-check errors (9 pre-existing warnings) | process gate run; recorded via `task.py ci` |
| Targeted spot-runs (11 card-anchored suites, first-hand) | **green — 230 tests / 11 files** (interests-store + interests-catalog + chats-view + chats-page + summary-sheet + contact-store + match-scores + profile-settings + radar-placement + room-radar + transcript-page) | `npm run test -w @bleak/web -- <files>` (§4), all passing |
| Owning tasks of the 6 items | R1–R6 all landed into `dev` (dev tip `1c73ac7` at sweep time) | dev log |

No test was added or modified by this sweep.

---

## 2. Per-item checklist — Concept §13.1 items 1–6

### Item 1 — Interests, real API (R1, tz5-02 `f035091`, DESIGN §4.13.1) — PASS

| Check | Result | Evidence |
| --- | --- | --- |
| Curated static catalog: 5 groups × 5 interests, numeric keys 1..25, emoji + RU/EN titles | PASS S/T | `lib/interests/catalog.ts:40-46` — `INTEREST_GROUPS` (groups 0..4); `:48-79` — `INTEREST_CATALOG`, exactly 25 entries keyed 1..25, each with emoji + i18n titleKey (`interests.k<n>`); test `interests-catalog.test.ts:19` "ships a compact useful set: 5 groups × 5 interests", `:32` (numeric group/key + emoji + i18n key), `:44` (keys globally unique), `:61-74` (every title/group key resolves in BOTH dictionaries with spot-check translations) |
| Picker in profile/settings | PASS S/T | `profile/settings/+page.svelte:58` (import) `:386-387` (row opens view 'interests') `:474-475` (renders `InterestsEditor`); the editor is group-sectioned emoji chips: `InterestsEditor.svelte:87-107`; tests `profile-settings.test.ts:292-419` (interests picker block) |
| Real-API writes: add → `addUserInterests`, 201 FULL list mirrored | PASS S/T | `InterestsEditor.svelte:70-73` — `api.addUserInterests(...)` then `saveInterests(list)`; client `packages/api-client/src/client.ts:410-436` — POST `/api/room/{room}/user/{address}/interest`, body `{interests}`, 201 full list; test `profile-settings.test.ts:298` "toggling a chip ON upserts via addUserInterests and mirrors the 201 FULL list" |
| Delete → `deleteUserInterests`, 200 REMAINING mirrored, idempotent | PASS S/T | `InterestsEditor.svelte:66-67`; client `client.ts:444-460` — DELETE with JSON body `{keys:[...]}`, "unknown keys ignored (idempotent). Responds 200 with the REMAINING interests"; tests `profile-settings.test.ts:326` ("mirrors the 200 REMAINING list") + `:353` (mirror takes whatever the server answers) |
| 1..50 rows cap + 1..64 title pre-flight | PASS S/T | Client pre-flight `client.ts:416-430` (`ValidationError`, `MAX_INTERESTS_PER_REQUEST` / `MAX_INTEREST_TITLE_LEN`) mirrored locally (`stores/interests.ts:30` `MAX_INTERESTS = 50`, `saveInterests` clamps `:97-107`); picker disables unselected chips at the cap (`InterestsEditor.svelte:50,97`); test `profile-settings.test.ts:397` + `interests-catalog.test.ts:49` + `client.test.ts:650` (v3 client-side validation block) |
| Write-through mirror `bleak.interests` (documented no-GET limitation) | PASS S/T | `stores/interests.ts:1-14` — the doc-comment records the limitation verbatim ("has NO interests GET, so this per-device store is the read source — a documented limitation"); scope-mapped per room+user (`:37-39,82-84`); test `interests-store.test.ts:114-115` "no-GET rule — reading/writing the mirror never issues a fetch" |
| Badge chips from the mirror | PASS S/T | `routes/profile/+page.svelte:80-83` (`displayInterests(loadInterests(...))`) `:254` (passed to `ProfileBadge`); `ProfileBadge.svelte:92-100` (interests section, chips keyed by interest.key); re-localization through the catalog `stores/interests.ts:121-130`, tests `interests-store.test.ts:96-112` |
| §1 mock retired | PASS S | Grep over `apps/web/src` for `mock`/`MOCK_`: the ONLY hit is the retirement note itself (`stores/interests.ts:7` — "the §1 mock ids store this key held is retired — same key, new scope-mapped shape"). No mock model/endpoint remains |

### Item 2 — Chat.done integration (R2, tz5-03 `5159735`, DESIGN §4.13.2) — PASS

| Check | Result | Evidence |
| --- | --- | --- |
| `chatStatus` derives from `done` — authoritative; the §10.1.7 fallback retired | PASS S/T | `lib/chats/view.ts:158-188` — the section doc-comment replaces the §10.1.7 gap ("The former §10.1.7 default-active fallback is retired", `:168`); `isChatDone` `:176-178` returns `chat.done === true`; `chatStatus` `:186-188` → 'finished' / 'active' — the sole input is the Chat; tests `chats-view.test.ts:186-222` ("done === true → FINISHED", "done false / missing / undefined → ACTIVE", "kickoff reset semantics", "isChatDone is the tz5-04 contact-share gate selector") |
| `isChatDone` exported | PASS S | `view.ts:176` (`export function isChatDone`) — consumed by the /chats route (`routes/chats/+page.svelte:47,99`), the transcript route (`routes/chats/[address]/+page.svelte:42,382`), and `ChatCard.svelte:58,88` |
| List icons per state (finished → reminder mark; active → animated loading) | PASS S/T | `ChatCard.svelte:88` (`state = status ?? chatStatus(chat)`), `:129-139` (loader on active + the status glyph `status-finished` / `status-active` in the chat's hue), `:215-266` (animated `.status.active` spin, `chat-status-spin` keyframes); tests `chats-page.test.ts:260,278` (status follows Chat.done on the page), `:443-525` (ChatCard: done → FINISHED, missing/false → ACTIVE; animated hue glyph; FINISHED reminder mark NOT the danger red) |
| Dialog finished indicator | PASS S | `routes/chats/[address]/+page.svelte:512-522` — `dialogStatus === 'finished'` renders the header finished indicator (icon + «finished» wording, `chats.status.finished`) |

### Item 3 — Share contact, swipe-right slide (R3, tz5-04 `7cf0273`, DESIGN §4.13.3) — PASS

| Check | Result | Evidence |
| --- | --- | --- |
| `ShareContactSlide` reusable (footer + embedded in the sheet) | PASS S/T | `lib/components/ShareContactSlide.svelte` — the doc-comment (`:2-22`) states reusability ("Rendered in the dialog footer … and REUSABLE inside the tz5-05 summary sheet; all copy and state come in as clean props; the component never calls the API itself"); footer usage `routes/chats/[address]/+page.svelte:602-610`; embedded in `SummarySheet.svelte:218-230` (same props forwarded); test `summary-sheet.test.ts:184` ("the tz5-04 ShareContactSlide is embedded inside the dialog (same props)") |
| Gated on `isChatDone` + non-empty contact card | PASS S/T | `routes/chats/[address]/+page.svelte:382-387` — `done = chat !== null && isChatDone(chat)`, `hasCard = card.trim() !== ''`, `slideDisabled = !done || !hasCard` with the locked / no-card hints; the comment `:356-365` records the gate; test `chats-view.test.ts:218` (the selector) |
| Local contact-card field in settings (≤255) | PASS S/T | `stores/contactCard.ts:20` (`MAX_CONTACT_CARD = 255`) + `saveContactCard` clamp `:70-78` (trimmed, clamped, per room|user under `bleak.contactCard`); `ContactCardEditor.svelte` rendered from the contact row (`routes/profile/settings/+page.svelte:59,477-478`); tests `profile-settings.test.ts:421-477` (prefill from `bleak.contactCard`, saving persists locally — NO API call, cancel) + `contact-store.test.ts:28-74` (persistence, 255 clamp, empty clears) |
| POST /api/contact — 409 AND 201 both land the shared state | PASS S/T | Client `client.ts:547-564` (1..255 pre-flight, repeat → 409 surfaces as `ApiError`); page `routes/chats/[address]/+page.svelte:389-418` — 201 (`shareContact` then `markPairShared`) and the 409 branch (`:399-403` — "the shared state, never an error (server truth over the local mark)") both `markPairShared` + `cardShared = true`; store `contactCard.ts:93-110` (the pair marks); tests `contact-store.test.ts:76-118` (marks after 201/409, idempotent ISO time) |
| Received «Shared with you» list via recipient GET | PASS S/T | Client `client.ts:566-574` — `GET /api/contact/{address}`, "ONLY the RECIPIENT has access"; settings page `routes/profile/settings/+page.svelte:233-255` (`listContactsSharedWith(id.userAddress)`) + the section `:394-415` (name, content, relative time rows); tests `profile-settings.test.ts:479-539` (empty inbox copy, newest-first rows, failure → ErrorBanner with retry) |

### Item 4 — Chats sorting, score-first (R4, tz5-05 `892b600`, DESIGN §4.13.4) — PASS

| Check | Result | Evidence |
| --- | --- | --- |
| Finished first by match/v2 score desc; unfinished after newest-first | PASS S/T | `lib/chats/view.ts:66-94` — `orderByMatchScore` (doc-comment §13.1.4): done-group first sorted by `pointsOf` DESC, unfinished group newest-`created_at` first, ties stable; tests `chats-view.test.ts:224-283` (score-desc order, unscored at the END of the finished group, stable ties, dedupe preserved) + `chats-page.test.ts:585` |
| Fetches bounded to finished pairs, caller as first | PASS S/T | `routes/chats/+page.svelte:93-107` — the score round loops `stableChats(chats)` and `if (!isChatDone(chat)) continue` (unfinished never fetched — "no N+1 over the active group"); `api.matchV2(request.room, id.userAddress, request.counterpart)` — ME as `first_user_address` with my own Bearer (client `client.ts:487-509`); tests `chats-page.test.ts:612` ("bounded to FINISHED chats: me as first_user_address, unfinished never fetched") + `:624` (a chat that flips to done enters the fetch set) |
| Session cache (owner-stamped, no persistence) | PASS S/T | `stores/matchScores.ts:1-22` (doc-comment mirrors the lastMessage cache pattern; "session-local only — no localStorage"), owner sweep `:62-76` (foreign-persona snapshots dropped), in-flight guard `:47,80` (the 4 s cadence never piles up requests); tests `match-scores.test.ts:35-98` (owner stamp, in-flight skip, stale-persona sweep) + `chats-page.test.ts` (only THIS persona's cached scores sort the list, `:146-147` read) |
| Failure-tolerant | PASS S/T | `matchScores.ts:89-90` — a failing fetch "keeps the previous entry in place and never throws"; tests `match-scores.test.ts:60,77` + `chats-page.test.ts:637,659` (a failing fetch never crashes the page; no error banner surfaces from the score round) |
| Unfinished rendering: opacity 0.6 + circular spinner | PASS S/T | `ChatCard.svelte:109` (`class:unfinished={state === 'active'}`), `:167-171` (`.chat-card.unfinished { opacity: 0.6 }`), `:127-130` (`<span class="loader">` on active) + `:253-266` (the animated circular loader, transform-only spin); tests `chats-page.test.ts:527-572` (unfinished → the muted class + loader; finished → full emphasis, no loader; the CSS contract) |

### Item 5 — Summary sheet modal (R5, tz5-06 `670cb96`, DESIGN §4.13.5) — PASS

| Check | Result | Evidence |
| --- | --- | --- |
| Once-per-open hard-match, caller as first; 201/200 both carry the Summary | PASS S/T | Page trigger `routes/chats/[address]/+page.svelte:420-474` — the doc-comment ("the caller passes ITSELF as `first` … 201 created / 200 stored, both carry the Summary", "fires on open (when the authoritative `done` lands), NEVER per poll"), the per-chat reset effect `:458-467` (`summaryRequested` reset per address) and the once-only trigger effect `:469-474`; client `client.ts:511-537` (`hardMatch` maps 201 → `created: true`, 200 → stored); test `client.test.ts:530-…` (v3 endpoint mapping block) |
| Donut score via stroke-dasharray | PASS S/T | `lib/chats/summary.ts:16-33` — `DONUT_RADIUS = 44`, `donutScoreDash` = score fraction of the 2πr circumference; `SummarySheet.svelte:181-198` (SVG donut, `style:stroke-dasharray={donutScoreDash(summary.score)}`, arc rotated to 12 o'clock); tests `summary-sheet.test.ts:72-91` (circumference, dasharray math, clamping) + `:114` (donut renders with the score) |
| 5 checkpoints closed/open | PASS S/T | `SummarySheet.svelte:204-216` — checkpoints keyed by `checkpoint.key`, `.closed` → the check glyph, open → muted (no glyph, `:380-383`); tests `summary-sheet.test.ts:127` ("checkpoints render closed (check glyph) / open (muted, no glyph), labels verbatim") |
| Fireworks + brightness pulse strictly > 80, reduced-motion respected | PASS S/T | `summary.ts:36-38` (`isCelebration` = `score > 80`); `SummarySheet.svelte:141-152` (the six CSS spark particles), `:414-448` (transform/opacity `spark-fly` keyframes) + `:449-468` (opacity-only `brightness-pulse` wash — "filter animations are out per §4.6"; the comments note the base.css reduced-motion catch-all disables both); tests `summary-sheet.test.ts:93-106` (80 NOT a celebration, 80.01/100 are; null-safe) + `:164` (celebrate class + sparks ≤/>80 in render) |
| Round corners, X top-right | PASS S/T | `SummarySheet.svelte:243-252` (`border-radius: var(--radius-lg)` — the comment records the owner change vs HandshakeSheet's pixel steps) + the close button `:153-155` positioned `top/right var(--space-3)` `:282-296`; tests `summary-sheet.test.ts:193` (X dismisses + onclose) |
| Embedded share slide | PASS S | `SummarySheet.svelte:218-230` + `:47-53` (pass-through props, "never forked"); wired from the page with the same request/shared state (`routes/chats/[address]/+page.svelte:620-635`); test `summary-sheet.test.ts:184,201` |
| Deepa-hue background with ink pairing | PASS S/T | `SummarySheet.svelte:260-281` — the sheet's background IS `--color-deepa-<n>` with `--color-deepa-ink-<n>` text (the §4.10.5 message-bubble pairing); hue from `codeHue(user.address)` `:89-90,133`; test `summary-sheet.test.ts:177` ("pairs the interlocutor Deepa hue with its ink token class") |

### Item 6 — Radar tuning (R6, tz5-07 `1c73ac7`, DESIGN §4.13.6) — PASS

| Check | Result | Evidence |
| --- | --- | --- |
| `MIN_CENTER_GAP_PX` 74, arithmetic recorded | PASS S/T | `lib/room/radar.ts:83` (`export const MIN_CENTER_GAP_PX = 74`); the doc-comment `:70-82` records the arithmetic verbatim: chip core radius 32 + node hit radius 24 = 56 where the opaque cores touch + 18px buffer = **74** ("At 74px the node's *visible* avatar (40px → 20px radius) keeps a 22px visible gap … 74 − 32 − 20"); test `radar-placement.test.ts:319` ("v3: a node clamped to the inner exclusion edge sits at the 74px gap") + `:305` (center gap guaranteed at every stage size) |
| `NODE_AVATAR_PX` 40 / hit 48 / min dist 56 | PASS S/T | `radar.ts:57` (`NODE_AVATAR_PX = 40` — "44 → 40px" v3), `:65` (`NODE_HIT_DIAMETER_PX = 48` = 40 + 2×4), `:68` (`MIN_NODE_DIST_PX = 48 + 8` → 56); consumption: `RadarNode.svelte:62` (`size={NODE_AVATAR_PX}`) `:75` (the 48px circular hit area comment); tests `radar-placement.test.ts:197-213` ("durations slowed ×1.5 … node icon a little smaller, hit areas stay ≥ the 48px touch target") + `room-radar.test.ts:288-297` ("the node hit circle is 48px — 40px avatar + 2×4px padding") |
| Durations 90/135/30 (per-ring differences kept) | PASS S/T | `radar.ts:38` — `RING_ORBIT_DURATIONS_S = [90, 135, 30]`; the doc-comment `:29-37` ("SLOWED OVERALL in v3 … every duration scaled ×1.5, preserving the per-ring differences exactly"); `RadarRings.svelte:10` (the ring lines' comment, same source); test `radar-placement.test.ts:197` (×1.5 with differences preserved exactly) + `room-radar.test.ts:244,274` (per-ring distinct durations still asserted) |
| All guarantees re-asserted | PASS S/T | The v3 constants are motion/geometry knobs only — the layout guarantees kept their tests green: `radar-placement.test.ts:305` ("guarantees center gap, no overlap and on-canvas at every stage size"), `:313` (14 same-ring nodes never overlap at 320×480), `:347,354` (deterministic layout), `room-radar.test.ts:299,318` (upright riding) — all green in the spot-run (§4) |

---

## 3. Known trivial finding (recorded, NOT fixed — verification-only constraint)

**Stale comment-only duration references in `routes/room/+page.svelte`.** Two
comments still describe the OLD §4.9.2 owner-example durations while the code
reads the v3 constant:

- `routes/room/+page.svelte:192` — "RING_ORBIT_DURATIONS_S: ring 1 60s, ring
  2 90s, ring 3 20s — one …";
- `routes/room/+page.svelte:397` — "duration (60s/90s/20s, RING_ORBIT_DURATIONS_S), phase-locked …".

The actual orbit durations are computed from `RING_ORBIT_DURATIONS_S`
(`+page.svelte:246` `durationS: RING_ORBIT_DURATIONS_S[ring]`, `:255` outer
ring) which IS the v3 `[90, 135, 30]` (`radar.ts:38`) — so this is
comment-text drift only, with zero behavior impact. **Severity: trivial;
recorded per the card, not fixed.**

---

## 4. Spot-run record (first-hand, this session)

```
npm run test -w @bleak/web -- tests/interests-store.test.ts
  tests/interests-catalog.test.ts tests/chats-view.test.ts
  tests/chats-page.test.ts tests/summary-sheet.test.ts
  tests/contact-store.test.ts tests/match-scores.test.ts
  tests/profile-settings.test.ts tests/radar-placement.test.ts
  tests/room-radar.test.ts tests/transcript-page.test.ts
  → Test Files 11 passed (11) · Tests 230 passed (230)   (17:46:50Z, 21.48 s)
```

All 11 card-anchored suites: **230 tests green, 0 failures**. The run covers
every §13 surface's evidence anchors: interests (store + catalog + settings
picker), chat.done (view + page + card), contact share (store + settings),
score sorting (view + page + cache), summary sheet, radar (placement + page +
transcript-adjacent). No full `make test` by this sweep — the process runs
the delta-wave CI on `dev` after this landing (§1 placeholder).

---

## 5. Findings

**Verdict: items 1–6 — 6/6 PASS, 0 FAIL.** No product defect found; no
fix-up performed (verification-only constraint).

| # | Severity | Finding | Recommendation |
| --- | --- | --- | --- |
| 1 | trivial | Stale comment-only references to the old 60/90/20 orbit durations remain in `routes/room/+page.svelte` (~lines 192, 397); the code reads the v3 `[90, 135, 30]` constant. Behavior unaffected. | Fold into any future comment-sweep task; do not spend a round on it. |

---

## 6. Pre-event manual checks (owner, real device)

The automated suites pin the logic; these need a real phone/API:

**New for v3:**

1. **Interests picker against the real API** — toggle chips in
   /profile/settings on a real room: a 201-backed add mirrors the full list
   into the badge immediately, a delete mirrors the remainder, a re-add of
   the same key replaces (no duplicate), and at 50 rows the unselected chips
   disable; the badge chips follow the active UI locale.
2. **Summary sheet on a real finished chat, incl. fireworks** — open a
   farewell-stamped chat: the sheet slides up over the transcript, the
   hard-match once-only call resolves (a repeat open re-shows the stored
   record without re-summarizing), the donut tracks the score, the 5
   checkpoints read closed/open, and at score > 80 the spark burst + the
   brightness pulse play; reduced-motion devices show neither.
3. **Radar feel after tuning** — on the /room stage: the nearest ring sits
   close to the «you» chip (74px center gap, the visible-avatar gap ~22px),
   icons are the smaller 40px circles inside 48px touch circles, the rings
   spin noticeably slower (90/135/30s) with the per-ring speed differences
   still distinct, and nothing overlaps at any phone width.

**Carried forward (unchanged, from the v2.x sweeps — full notes in
`docs/verification-v26.md` §5, `-v25.md` §5 and earlier):** RU date/time ICU
(«8 сентября» + hh:mm, no «мин»/AM-PM), Deepa violet legibility (`#9B0CFF`
with light ink at arm's length / outdoor brightness), join digit-row +
full-screen forms at real phone widths (~320 / 360–390px), chat-list preview
freshness on the 4 s cadence, and the standing on-device scanner smoke
(HTTPS secure-context gate, iOS Safari + Android Chrome decode path,
camera light off on close), PWA install, venue Wi-Fi polling, host-console
flows, return-to-event round-trip.

---

## 7. §13.2 backend-TODO ledger note (recorded as done)

The §1c backend-TODO items closed by this round (Concept §13.2), verified
delivered end-to-end by this sweep (backend feature + client integration):

- **Private contact exchange** — implemented in bleak-node #35; client
  feature per §13.1.3 (this sweep item 3: the slide, the 409/201 shared
  state, the local card, the received list). CLOSED.
- **Interests field on the user profile** — implemented in #34; mock
  retired per §13.1.1 (this sweep item 1: catalog + real-API picker +
  write-through mirror). CLOSED.
- **Auto-matchmaking score mechanic** — exists as the API score surface
  (#34/#35: `match`, `match/v2`, `hard-match`); client display per
  §13.1.4–5 (this sweep items 4–5). The *agent-side auto-handshake* variant
  remains a backend idea, not needed by the client. CLOSED (for the client).
- **Chat status semantics** — `Chat.done` closes the §10.1.7 gap (this sweep
  item 2: the authoritative selector, the retired fallback). CLOSED.

---

DELTA-WAVE CI: GREEN — 2026-11-19T17:54Z, dev 9f9e9af, lint clean / 721 tests / build 0 errors (covers this sweep + the §14 sheet-i18n bug round)
