# bleak-web v3.1 — Verification sweep (tz6-05, verification-only)

Worker instance `0ae3b55d` · 2026-11-19 · branch
`feature/0ae3b55d-tz6-05-verify-v31` (base = dev tip `943bfdd` — the landing of
`feature/36fb0337-tz6-04-sheet-polish`; all five §14 items landed into `dev`
before this sweep, see the commit map below). This sweep verifies the **five
items of Concept §14.1** (v3.1 addendum, DESIGN §4.14) are delivered on `dev`.
It adds **no product code and no test files** — one-shot source greps,
landed-code reads and targeted spot-check runs recorded here, per the
verification-only constraint of the card. It completes the §13+§14
verification record (the §13 record is `docs/verification-v3.md`).

Method legend: **S** = source inspection / one-shot grep in this sweep,
**T** = merged automated test (file — title), **R** = targeted spot-run
executed first-hand in this session.

Landing commits of the §14 round (dev log, all pre-sweep): tz6-00
sheet-i18n-bug `9f9e9af` (the item-5 bug round, task 67, worker `97ddd53e` —
landed first as the live-bug routing per Concept §14.2), tz6-01
share-slide-polish `5802e17`, tz6-02 contacts-footer-page `bd0c6f3`, tz6-03
creation-contact-input `438b804`, tz6-04 sheet-polish `943bfdd`.

---

## 1. Gate record (TZ §8.8 discipline — full gates are delta-wave-CI's job)

| Check | Result | Source |
| --- | --- | --- |
| Full `make test` re-run by this sweep | **not run** (the process runs the delta-wave CI after this landing) | this session |
| DELTA-WAVE CI | **[pending — process fills]** | process gate run; recorded via `task.py ci` |
| Targeted spot-runs (7 card-anchored suites, first-hand) | **green — 155 tests / 7 files** (kit + transcript-page + contacts-page + join-flow + summary-sheet + tabbar + i18n) | `npm run test -w @bleak/web -- <files>` (§4), all passing |
| Owning tasks of the 5 items | tz6-00…tz6-04 all landed into `dev` (dev tip `943bfdd` at sweep time) | dev log |

No test was added or modified by this sweep.

---

## 2. Per-item checklist — Concept §14.1 items 1–5

### Item 1 — Share-contact slide polish (tz6-01 `5802e17`, DESIGN §4.14.1) — PASS

| Check | Result | Evidence |
| --- | --- | --- |
| Candy-cane armed stripes: animated red-white band on the armed track only | PASS S/T | `ShareContactSlide.svelte:234-255` — `.candy` (armed state only, rendered `{#if armed}` at `:153-155`, `aria-hidden`) with `repeating-linear-gradient(45deg, var(--color-danger-text) 0 10px, var(--color-text) 10px 20px)`; the loop is transform-only: `@keyframes candy-move { translateX(0) → translateX(-28.284px) }` (1.2 s linear infinite — 20px gradient period ÷ sin45°, seamless), `:248-255`; tests `kit.test.ts:158-164` ("the candy-cane stripe layer renders as aria-hidden decoration"), `:166-175` ("stripes render ONLY in the armed state" — disabled/pending/shared stay plain), `:182-195` ("token-colored repeating gradient, transform-only loop" — pins the exact gradient, forbids `background-position`/`filter`/raw hex) |
| Hint-pill scrim legibility over the stripes | PASS S | `ShareContactSlide.svelte:212-227` — `.hint` sits above the candy band (`position: relative`, comment `:219-221`), `background: color-mix(in srgb, var(--color-surface) 80%, transparent)` scrim + pill radius + ellipsis; the candy ring stays visible around it |
| 12-flake Deepa confetti from the top, keyed to gesture + shared | PASS S/T | `ShareContactSlide.svelte:82-93` — `celebrated` set in `complete()` (`:107`) on a gesture made HERE; the render gate `{#if celebrated && shared}` (`:178-192`) plays `FLAKES`, exactly 12 deterministic flakes (`Array.from({length: 12})`, `:85`), each falling `top: 0` of the container (`.confetti { position:absolute; inset:0 }` `:306-311`, `.flake { top: 0 }` `:313-321`) in the Deepa family (`deepa-1..5` fills `:322-336`), transform/opacity keyframes only (`confetti-fall` `:337-350`); tests `kit.test.ts:197-212` (CSS contract: all five Deepa tokens as flake fills, translate/rotate/opacity only, `pointer-events: none`, no local reduced-motion override) |
| 201/409 both celebrate; hydration / failed never replay | PASS S/T | tests `transcript-page.test.ts:543-547` (201 → the shared transition plays the confetti, 12 flakes), `:574-576` (409 lands the shared state too — the confetti plays on it, `queryByRole('alert')` stays null), `:598-600` (a locally-marked hydration renders shared WITHOUT the confetti — no replay), `:622-625` (a failed 400 share: no confetti AND the candy stripes return with the armed state); unit-level `kit.test.ts:177-180` (an already-shared mount never replays); the embedded sheet slide stays quiet on shared mounts: `summary-sheet.test.ts:284-293` |
| Slide mechanics/props untouched | PASS S | `ShareContactSlide.svelte:30-55` — the prop surface (label/sharedLabel/disabledHint/disabled/pending/shared/oncomplete) and the four states doc (`:12-21`) are the tz5-04 contract verbatim; the pointer/keyboard mechanics (`onPointerDown/Move/Up`, `onClick` with the `dragged` double-fire guard, `:105-148`) unchanged; all four states + the accessible activation path re-asserted by `kit.test.ts:122-156` |

### Item 2 — Contacts footer page (tz6-02 `bd0c6f3`, DESIGN §4.14.2) — PASS

| Check | Result | Evidence |
| --- | --- | --- |
| 5-tab bar with the contact-card glyph | PASS S/T | `TabBar.svelte:23-29` — the tabs array is exactly `/room`, `/people`, `/contacts`, `/chats`, `/profile`; the `/contacts` entry carries `icon: TAB_ICONS['/contacts']` → `registry.ts:32` maps it to the `'contact-card'` pixel glyph (`registry.ts:201` path table); tests `tabbar.test.ts:16` (five tabs), `:80` ("resolves tab hrefs to literal routes (5 tabs, Contacts between People and Chats)") |
| `/contacts` route: 4 s poller, roster resolution, relative time | PASS S/T | `routes/contacts/+page.svelte:74-79` — one `Poller({ intervalMs: 4000, backoffMs: 12_000, tick, onStall })` (route-file only per §2.2), polling `listContactsSharedWith(me)` + cached `listRoomUsers` in parallel (`:50-62`); newest-first order preserved (the endpoint contract, doc-comment `:11-12`); roster name resolution with the raw-address fallback `sharerName()` `:105-108`; relative time via the people-view helper `ago()` `:110-113`; tests `contacts-page.test.ts:103` (newest-first rows: roster name, content, relative time), `:121` (unknown address falls back), `:130` (polls BOTH lists every 4 s), `:144` (a removed contact disappears in place) |
| Empty state + ErrorBanner | PASS S/T | `+page.svelte:145-149` (`EmptyState` with `contacts.empty` copy + the contact-card icon), `:126-132` (`ErrorBanner` with retry → `poller.refresh()`; the last-known list dims `:190-192`); tests `contacts-page.test.ts:170` (empty state with the §4.14.2 copy), `:175` (network failure → banner + dimmed last-known list), `:196` (API failure shows the server body), `:236` (the poller stops on unmount) |
| Per-persona `contactsSeen` store + unseen dot (mount-time evaluation, mark-on-visit) | PASS S/T | `lib/stores/contactsSeen.ts` — per-persona key `room|user` under `bleak.contactsSeen` (`:13,19-21`), `hasNewerContact` (`:56-65`), `evaluateContactsUnseen` sets the reactive `contactsUnseen` (`:71-79`); the layout does ONE mount-time read (`routes/+layout.svelte:19-31`, best-effort with the comment recording why there is no dedicated badge polling); mark-on-visit: `routes/contacts/+page.svelte:84-86` (`markContactsSeen` in the mount effect, dot clears immediately); `TabBar.svelte:26` subscribes to `$contactsUnseen` → the badge dot + the visually-hidden unseen clause in the accessible name (`:43-50`); tests `contacts-page.test.ts:208` (visiting writes the per-persona marker and clears the dot), `:216` (per-persona isolation), `:254-284` (store: empty=never-seen, newer⇒dot, corrupt storage, invalid timestamps, empty lists), `tabbar.test.ts:46` (the dot lights only when a contact is newer than seen), `:57` (the Chats and Contacts dots are independent), `:66` (the lit dot carries the unseen aria clause) |
| Settings list removed | PASS S/T | `routes/profile/settings/+page.svelte` — grep for `listContactsSharedWith`/`contacts.` over the file: zero matches; the doc-comment records the supersession (`:16-19` — "the minimal 'Shared with you' list lived here once — DESIGN §4.14.2 supersedes it with the /contacts footer tab … so the list was REMOVED to avoid a duplicate surface"); test `i18n.test.ts:311-316` ("the superseded §4.13.3 settings-list keys are retired from BOTH dictionaries" — `profile.shared.title`/`empty` absent) |

### Item 3 — Creation contact input (tz6-03 `438b804`, DESIGN §4.14.3) — PASS

| Check | Result | Evidence |
| --- | --- | --- |
| PersonaForm contact field (≤255, counter, hint) | PASS S/T | `PersonaForm.svelte:95-101` — the `persona-contact` input with `maxlength={MAX_CONTACT_CARD}` (=255, imported from the contactCard store `:15`), the `join.form.contact_hint` line and the `profile.greeting.counter` counter (`:37-39`); the value rides the draft only (`:34,65` — `draft.contact = contact.trim()`); tests `join-flow.test.ts:263-273` ("renders the contact field empty with the hint and the 255 cap counter" — maxlength=255, hint, counter at 0, store untouched before any typing) |
| Persist-on-create to `bleak.contactCard` (room\|user scope) AFTER the 2xx | PASS S/T | `JoinFlow.svelte:212-216` — after `createPersona` resolves and `saveIdentity` runs, `saveContactCard(room.address, user.address, draft.contact ?? '')`; the store clamps to the 255 cap again (`contactCard.ts:70-78`, the per `room|user` scope `:37-39` from tz5-04); the type is documented client-local (`lib/join.ts:65-79`); test `join-flow.test.ts:275-306` (a `'  telegram: @me  '` input persists the TRIMMED value at the `${room.address}\|0xme` key of `bleak.contactCard`) |
| NOTHING contact-bearing over the wire at creation (test-asserted) | PASS S/T | `lib/join.ts:113-121` — the comment "draft.contact is deliberately NOT sent" and the exact createRoomUser body (`name`, bios, `invite_code`, `token`); test `join-flow.test.ts:289-296` — the wire assertion: `expect(body).not.toHaveProperty('contact')` AND `expect(JSON.stringify(body)).not.toContain('telegram')` |
| Failed creation persists nothing | PASS S/T | `JoinFlow.svelte:225-234` — the catch path touches no store; test `join-flow.test.ts:308-322` ("failed creation (§2.9 invite rejection) persists NO contact card" — `bleak.contactCard` stays null, the draft value rides the form state for a retry) |

### Item 4 — Sheet polish (tz6-04 `943bfdd`, DESIGN §4.14.4) — PASS

| Check | Result | Evidence |
| --- | --- | --- |
| Sheet width mirrors the transcript column: phone calc inset + desktop cap | PASS S/T | `SummarySheet.svelte:261-277` — `.sheet { width: calc(100% - 2 * var(--space-4)); margin-inline: auto; }` (phone: the two `.scroll` inset paddings of `routes/chats/[address]/+page.svelte:768`), `:523-527` — `@media (min-width: 720px) { .sheet { max-width: 640px; } }` mirroring the transcript `.column` cap (`+page.svelte:878-881`, same breakpoint 720px, same value 640px); the drift-proof lockstep test `summary-sheet.test.ts:326-362` reads BOTH source files: `:340-349` (the sheet's width subtracts exactly the transcript's inset token, centered), `:351-362` (the sheet media query mirrors the transcript breakpoint AND cap — any drift fails) |
| Score displayed as a ceil integer (66.4 → 67), incl. aria | PASS S/T | `lib/chats/summary.ts:42-44` — `summaryScoreDisplay = Math.ceil(score)`; consumed for BOTH the donut text and the aria wording (`SummarySheet.svelte:82-89`), while the ARC keeps the raw score (`style:stroke-dasharray={donutScoreDash(summary.score)}` `:199`); tests `summary-sheet.test.ts:123-131` (pure math: 66.4→67, 0.5→1, 80.01→81, integers pass through), `:153-166` (render: the displayed number is 67, the aria embeds 67, the arc stays on 66.4) |
| Square checkboxes with green check signs (`--color-check-green` from deepa-1) | PASS S/T | `SummarySheet.svelte:214-221` — a `.box` span per checkpoint (closed: the check PixelIcon inside `:217-220`; open: empty square); the CSS `:395-413` — a bordered 16×16 SQUARE (`width === height`, no pill rounding) with the GREEN check via `color: var(--color-check-green)` on the wrapper span; the token is sourced from the approved Deepa green (`tokens.css:100-103` — `--color-check-green: var(--color-deepa-1)`, comment "no new palette hex"); tests `summary-sheet.test.ts:180-192` (every item carries a box; closed has the glyph inside, open's box stays empty), `:194-212` (CSS contract: bordered square, width===height, `var(--color-check-green)`, no raw hex, the token definition pinned in tokens.css) |
| Donut arc / fireworks / slide / Deepa bg unchanged | PASS S | The §4.13.5 delivery is intact: the arc math stays raw-scored (`:199`, test `:162-165`), the celebration stays `score > 80` transform/opacity-only (`summary.ts:46-49`, `SummarySheet.svelte:448-502` — sparks + the opacity-only brightness wash), the embedded ShareContactSlide is still the same tz5-04 control with the same props (`:230-240`, test `summary-sheet.test.ts:259`), the Deepa hue background + ink pairing unchanged (`:278-299`, test `:252`) |

### Item 5 — Sheet i18n (bug round, task 67, tz6-00 `9f9e9af`, DESIGN §4.14.5) — PASS

| Check | Result | Evidence |
| --- | --- | --- |
| All sheet copy through the i18n table | PASS S | One-shot audit grep over the landed sheet + its four i18n'd siblings for hardcoded Cyrillic (`[А-Яа-я]{4,}`): `SummarySheet.svelte`, `ShareContactSlide.svelte`, `contacts/+page.svelte`, `PersonaForm.svelte` — **zero matches**; every visible string in the sheet routes through `translate($locale, …)` (`SummarySheet.svelte:79-92,183`) with the checkpoint LABELS the only verbatim data (server-provided English data, documented `:19-21` — data, not UI copy) |
| EN-locale regression test with negative RU assertions | PASS S/T | `summary-sheet.test.ts:295-323` — "EN interface: every sheet copy renders EN from the i18n table, never RU (DESIGN §4.14.5 bug round)": `setLocale('en')` then verbatim assertions on the dialog aria-label ('Meeting summary' title, 'Networking checklist' heading, the checklist aria-label, the 'Match: 66 out of 100' donut aria), plus the NEGATIVE assertions `:317-318` (`queryByText(ru['chat.summary.title'])` and `ru['chat.summary.checklist']` both null — no RU leakage) and the checkpoint labels staying server-verbatim `:320`; locale restored for the suite `:322` |
| Parity block extended | PASS S/T | `i18n.test.ts:319-345` — the §4.13.5 summary-sheet keys block asserts all four keys (`chat.summary.title`, `chat.summary.checklist`, `chat.summary.score.aria`, `chat.summary.loading`) in BOTH dictionaries with the verbatim spot-checks incl. the reported bug strings: RU `'Итоги встречи'` / `'Сетевой чек-лист'` vs EN `'Meeting summary'` / `'Networking checklist'` and the interpolated score aria in both locales — the exact RU strings the owner saw hardcoded are now pinned as table values |

---

## 3. Known findings (recorded, NOT fixed — verification-only constraint)

**Verdict: items 1–5 — 5/5 PASS, 0 FAIL.** No product defect found; no fix-up
performed.

No findings above trivial were identified during the sweep. The §13 sweep's
standing trivial note (stale comment-only duration references in
`routes/room/+page.svelte`) remains open, unchanged — see
`docs/verification-v3.md` §3.

---

## 4. Spot-run record (first-hand, this session)

```
npm run test -w @bleak/web -- tests/kit.test.ts
  tests/transcript-page.test.ts tests/contacts-page.test.ts
  tests/join-flow.test.ts tests/summary-sheet.test.ts
  tests/tabbar.test.ts tests/i18n.test.ts
  → Test Files 7 passed (7) · Tests 155 passed (155)   (18:31:30Z, 11.25 s)
```

All 7 card-anchored suites: **155 tests green, 0 failures**. The run covers
every §14 surface's evidence anchors: the slide (kit component tests +
transcript-page celebration matrix + the sheet's embedded instance), the
contacts page + TabBar dot, the join contact field, the sheet polish +
i18n regression, and the RU/EN parity blocks. No full `make test` by this
sweep — the process runs the delta-wave CI on `dev` after this landing
(§1 placeholder).

---

## 5. Carried-forward manual checks (owner, real device)

The automated suites pin the logic; these need a real phone/API:

**New for v3.1:**

1. **Candy-cane / confetti feel** — on a real finished chat with a contact
   card: the armed slide track shows the animated red-white diagonal stripes
   looping seamlessly (a static band on a reduced-motion device), the hint
   pill stays legible over the stripes, and completing the swipe plays the
   12-flake confetti falling from the top of the slide (201 AND repeat/409
   both celebrate; re-opening an already-shared chat replays nothing).
2. **Contacts tab dot flow at real phone width** — receive a contact from
   another persona while on a different tab: the Contacts tab dot lights
   (with the «есть новые контакты» screen-reader clause); visiting /contacts
   clears it immediately and that clearance does not leak into the other
   persona on a shared device; the roster-resolved rows read correctly at
   ~320–390px width.
3. **Creation contact field end-to-end with the share slide** — create a
   fresh persona typing a contact value: nothing goes over the wire, the
   value lands in the (room|user) contact card after the 2xx, and the
   share slide in the finished dialog is immediately armed (no
   "no contact card yet" lock) with that value offered to share.
4. **Sheet width on device** — open the summary sheet on a phone: its
   left/right edges align exactly with the messages' borders; on a ≥720px
   window both cap at 640px centered, still aligned.

**Carried forward (unchanged — full notes in `docs/verification-v3.md` §6,
`-v26.md` §5 and earlier):** RU date/time ICU («8 сентября» + hh:mm, no
«мин»/AM-PM), Deepa violet legibility (`#9B0CFF` with light ink at arm's
length / outdoor brightness), radar feel after the §13 tuning (74px center
gap, 40px icons in 48px touch circles, 90/135/30s rings), summary-sheet
freshness (a repeat open re-shows the stored record without re-summarizing),
interests picker against the real API, join digit-row + full-screen forms at
real phone widths, and the standing on-device scanner smoke (HTTPS
secure-context gate, iOS Safari + Android Chrome decode path, camera light
off on close), PWA install, venue Wi-Fi polling, host-console flows,
return-to-event round-trip.

---

## 6. §13.2 backend-TODO ledger note — chat lifecycle field: IMPLEMENTED (recorded)

Concept §13.2 routed the "chat status semantics" item to the backend TODO
ledger; §13 (R2, tz5-03 `5159735`) delivered `Chat.done` end-to-end and it
remains delivered on the current dev tip — recorded here as **CLOSED /
IMPLEMENTED**, completing the §13+§14 record:

- The authoritative selector `isChatDone` reads `chat.done === true`
  (`lib/chats/view.ts:176-178`); the doc-comment at `:165-175` records that
  the former §10.1.7 default-active fallback is RETIRED and that the
  farewell turn stamps `done` server-side while a kickoff resets it.
- The field is consumed across the §13 surfaces as designed: the list-card
  status glyph + unfinished styling, the transcript finished indicator, the
  contact-share gate (tz5-04) and the score-sort grouping (tz5-05) — the
  §13 sweep verified each (see `docs/verification-v3.md` items 2, 3, 4).

No backend chat-lifecycle TODO remains on the client ledger for this item.

---

DELTA-WAVE CI: [pending — process fills]
