# bleak-web v3.9 — Verification sweep (tz11-03, verification-only)

Worker instance `afca6a38` · 2026-11-20 · branch
`feature/afca6a38-tz11-03-verify-v39` (base = dev tip `e28bb62` — the landing of
`feature/434efe53-fade-every-boundary`). This sweep verifies the **Concept
§22.3 queued feature round** (mascot + creation wizard) and the **§23
design-review batch** (23.1 mascot amendments + 23.2 wizard amendments incl.
the fade-every-boundary owner amendment) are delivered on `dev` against
**DESIGN §4.16 + §4.15.6.4** — **completing the §8–§23 verification record**
(§13 = `docs/verification-v3.md`, §14 = `-v31.md`, … §20 = `-v37.md`,
§19–§21 = `-v38.md`). No product code and no test files — one-shot source
reads and targeted spot-run runs recorded here, per the verification-only
constraint of the card.

Method legend: **S** = source inspection / landed-code read in this sweep,
**T** = merged automated test (file — title), **R** = targeted spot-run
executed first-hand in this session.

Landing commits of the verified scope (dev log, all pre-sweep): tz11-01
mascot `3ca9307` (task 100, worker `0cc45a6b`), tz11-02 creation wizard
`925e913` (task 101, worker `434efe53`), tz11-01a mascot amendments
`48e3172` (task 102, worker `0cc45a6b`), tz11-02a fade-every-boundary
`e28bb62` (task 103, worker `434efe53`). Tasks 100/101/102/103 all `done`
with MR records `merged` `ci=green` (read first-hand via `task.py show`).

Spec-source note (recorded, factual): at sweep time the §22–§23 spec text
still lives in the shared checkout's **uncommitted working-copy edits** of
`docs/Concept.md` (§22–§23, +550 lines) and `docs/DESIGN.md` (§4.15.6/§4.16,
+38 lines) — the process's pending doc landing; `dev` HEAD carries the full
§22.3/§23 **product** state (every source/test file read below is committed
at `e28bb62`). The sweep reads the owner amendments from that working copy
and verifies the product tree, not the docs.

---

## 1. Gate record (TZ §8.8 discipline — full gates are delta-wave-CI's job)

| Check | Result | Source |
| --- | --- | --- |
| Full `make test` re-run by this sweep | **not run** (the process runs the delta-wave CI after this landing) | this session |
| Owning worker's MR gates — task 100 (tz11-01 mascot) | **green**: MR #100 `merged` `ci=green` (process wave CI on `dev`) | `scripts/task.py show 100` |
| Owning worker's MR gates — task 101 (tz11-02 wizard) | **green**: MR #101 `merged` `ci=green` | `scripts/task.py show 101` |
| Owning worker's MR gates — task 102 (tz11-01a mascot amendments) | **green**: MR #102 `merged` `ci=green` | `scripts/task.py show 102` |
| Owning worker's MR gates — task 103 (tz11-02a fade-every-boundary) | **green**: MR #103 `merged` `ci=green` | `scripts/task.py show 103` |
| Targeted spot-runs (first-hand, this session) | **green — 218 tests / 9 web files**: mascot 8 + creation-wizard 19 + join-machine 38 + join-flow 31 + interests-catalog/interests-store/kit/i18n 94 + token-vault/profile-settings 28 = 218/218 | `npm run test -w @bleak/web -- <files>` (§4) |
| Owning tasks of the verified items | tasks 100 + 101 + 102 + 103 all landed into `dev` (dev tip `e28bb62` at sweep time) | dev log / task list |

No test was added or modified by this sweep. No product code touched.

DELTA-WAVE CI: [pending — process fills]

---

## 2. Per-item checklist — Concept §22.3 + §23 (DESIGN §4.16 + §4.15.6.4)

### Item 1 — MASCOT (§22.3 item 1 + §23.1.1, tz11-01 + tz11-01a) — PASS

All checks against `apps/web/src/lib/components/BleakMascot.svelte` (landed
state at `e28bb62`).

| Check | Result | Evidence |
| --- | --- | --- |
| Chunky 12×12 pixel-art portrait, crispEdges rect art, token fills only (`--color-text-muted` body, `--color-surface` face, `--color-art-skin-4` Deepa blush — decorative register, never the accent) | PASS | S: BleakMascot.svelte 3–17, 40–74 (header doc: "§23.1 item 1: NO BACKGROUND"); T: mascot.test.ts — "renders a crispEdges 12×12 svg with rect pixel art"; "§4.16.1 CSS contract: 2-frame steps(1) blink, token fills only" |
| De-plated: NO background — no backdrop fill, no §4.8.2-style frame padding; `.mascot` is a transparent inline box reserving exactly `size`; the figure sits directly on the page | PASS | S: BleakMascot.svelte 77–87 (".mascot { display:inline-block; flex:none }" + "no plate" comment); T: mascot.test.ts — "§23.1 item 1 NO BACKGROUND: no backdrop fill, no frame padding — the figure sits directly on the page"; "applies the declared size to the svg (§23.1 item 1: no plate — the frame reserves nothing)" |
| Idle blink respected: 2-frame `steps(1)` CSS loop (`mascot-blink 4.2s` — open ~3.6s, closed ~170ms); no local reduced-motion override — the base.css catch-all (`@media (prefers-reduced-motion: reduce)` collapse, base.css 57–68) governs | PASS | S: BleakMascot.svelte 88–106; S: base.css 57–68; T: mascot.test.ts — "idle adds the idle class wiring the 2-frame blink"; "no local reduced-motion override (base.css catch-all governs)" |
| Reusable component (tz11-02 mounts it in 4 surfaces); a11y: decorative by default (aria-hidden), `label` promotes to role img | PASS | S: BleakMascot.svelte 18–27, 36–38; S: mounts at CodeEntry 71, RoomPreview 29, WizardBubble 43, CreationWizard 413+439; T: mascot.test.ts — "is decorative by default (aria-hidden); `label` promotes it to role img" |
| Lightweight: no image assets, no new dependencies (hand-rolled inline SVG) | PASS | S: file inventory — component only; package.json untouched by the tz11 landings (no dep commits in 3ca9307/48e3172) |

### Item 2 — MASCOT-AT-TOP ORDER (§23.1.2–3) — PASS

| Check | Result | Evidence |
| --- | --- | --- |
| Enter-invite-code form: mascot at the TOP of the page → title (`join.title` h1) → the other elements (subtitle → digit cells → CTA) | PASS | S: CodeEntry.svelte 66–74 (`.mascot-row` first child, then `<h1>`, then `.subtitle`; "§23.1 item 2: mascot-at-top header order — mascot → title → content"); T: mascot.test.ts — "§23.1 item 2 mount: the code-entry form carries mascot-at-top — mascot, then the title, then the rest" |
| Room form (the create-profile/join choice — found in `RoomPreview.svelte`): mascot added at top, same order (mascot → `room.name` → content) | PASS | S: RoomPreview.svelte 25–31 ("§23.1 item 3: the room form … carries the same mascot-at-top header order"); T: mascot.test.ts — "§23.1 item 3 mount: the room form (create-profile / join choice) carries the same mascot-at-top order" |
| Wizard intro: mascot-at-top order (mascot 112px → intro title → intro line → start) | PASS | S: CreationWizard.svelte 434–445 (`.creating-stage`: `.mascot-row` first, then `.intro-title`, `.intro-line`); T: creation-wizard.test.ts — "the intro theme step: the mascot, the plain-text intro copy (§23.1 item 4 — no bubble background) and the start affordance" |
| §23.1.4 — "Hi! I'm Bleak" bubble background removed: the intro copy is PLAIN PAGE TEXT (no WizardBubble/background plate on the intro step) | PASS | S: CreationWizard.svelte 434–442 ("§23.1 item 4: the intro copy is plain page text — no bubble background") — intro uses bare `<p>` elements, not WizardBubble rows (WizardBubble renders only transcript lines, CreationWizard.svelte 453–457) |

### Item 3 — CREATION WIZARD (§22.3 item 2 + §23.2 5.1–5.9 as folded, tz11-02 + tz11-02a) — PASS

Machine: `apps/web/src/lib/join.ts` (`WIZARD_STEPS`, `reduceWizard`,
`wizardPersonaDraft`); surface:
`apps/web/src/lib/components/join/CreationWizard.svelte` +
`WizardBubble.svelte`; flush: `JoinFlow.svelte` `submitPersona`.

| Check | Result | Evidence |
| --- | --- | --- |
| Chat-style steps in order: intro theme → name → auto-chat interview (public bio → private bio → contact type → contact value) → themes → loading | PASS | S: join.ts 102–111 (`WIZARD_STEPS = ['intro','name','public_bio','private_bio','contact_type','contact_value','themes','topics']`), 194–271 (reduceWizard); CreationWizard.svelte 409–573 (intro stage → chat stage with the transcript + composer → creating stage); T: creation-wizard.test.ts — "asks every question in the specified order (name → public → private → contact → themes)"; join-machine.test.ts wizard suite (38 green) |
| Auto-chat: the mascot asks in chat bubbles, answers land as mine bubbles (existing bubble styling incl. Deepa hue coding), role=log announcements | PASS | S: CreationWizard.svelte 130–222 (transcript derivation: every reached question as an agent bubble, each answer as a mine bubble), 453–457 (`<ul role="log">` + WizardBubble); WizardBubble.svelte (agent rows carry the small BleakMascot, MessageBubble styling); T: creation-wizard.test.ts — "answers land as mine bubbles; a skipped contact logs the skip copy"; "the mascot bubbles carry the Deepa hue coding (the MessageBubble pattern, deterministic per mascot id)" |
| Contact: TYPE choice (phone/email/nickname) first, then the value — §23.2 5.4 nickname field with `tg:@`/`signal:@`/`inst:@` suggested prefixes (tapping replaces the known prefix in front of the typed nickname) | PASS | S: join.ts 96 (ContactKind), 239–244 (contact-kind); CreationWizard.svelte 233–244 (`NICK_PREFIXES`, applyNickPrefix), 490–505 (prefix chips), 509–523 (radiogroup type choice); T: creation-wizard.test.ts — "§23.2 5.4: the nickname kind offers the tg:/signal:/inst:@ prefixes, appendable over the typed nickname"; "choosing the type advances to the value question, interpolated with the kind" |
| Themes model (§23.2 5.5): 8 theme badges (emoji + text) × 6 dedicated topics = 48 catalog rows; stored title `'<theme slug>:<topic slug>'` (e.g. `music:rock`) riding the free 1..64 title string; the NUMERIC (group, key) pair keeps the server contract; badge re-localizes through the catalog by numeric key | PASS | S: interests/catalog.ts 45–113 (8 INTEREST_GROUPS slugs music/sport/food/art/computer/science/architecture/travel; 48 entries), 134–142 (`interestApiTitle`); JoinFlow.svelte 254–272 (rows `{ title: interestApiTitle(entry), group, key }`); T: creation-wizard.test.ts — "renders 8 theme badges (emoji + text)"; interests-catalog.test.ts (in the 94-test spot run) |
| Multi-theme loop (§23.2 5.7): several themes + several interests each; finishing a theme's topics returns to the theme-badges step (not forward) and repeats until "Ready"; keys accumulate across themes (deduped, ≤ MAX_INTERESTS) | PASS | S: join.ts 257–265 (`theme-done` → back to `themes`; `ready` → `creating`), 222–225 (topics 'next' never advances forward); CreationWizard.svelte 278–294 (finishTheme logs the finished theme, ready ends the phase); T: creation-wizard.test.ts — "topics are multi-select; Done with a theme returns to the BADGES (not forward) and repeats until Ready"; "Ready submits ONCE with the accumulated topic KEYS across all themes" |
| iOS-Messages send + counters (§23.2 5.1): send button right of the input; send happens ONLY on Enter or the button (never on input taps/suggestion chips); per-input current/max counter (name 64, bios 255, contact MAX_CONTACT_CARD) | PASS | S: CreationWizard.svelte 468–489 (composer form submit + `.send` button + counter row), 108–128 (INPUT_MAX), 254–262 (send = form submit; the name step keeps its required gate); 681–700 (send-button styling, accent while interactive); T: creation-wizard.test.ts — "every text step carries the send button, the example placeholder and the current/max counter (§23.2 5.1/5.3)"; "send happens on Enter (the composer form) OR the button — both advance"; "the empty-name submit is blocked client-side … sending never fires on input taps" |
| No "Next" (§23.2 5.2): fixed bottom input (sticky composer), scrollable chat log, centered back button below the input | PASS | S: CreationWizard.svelte 459–466 + 640–656 (`.composer` sticky bottom-0, `.log` flex:1 overflow-y:auto), 569–570 (back `.link` below the input); T: creation-wizard.test.ts — "§23.2 5.2 layout contract: the composer is sticky at the bottom, the log scrolls, back sits below the input (source pins)"; no `join.wizard.next` key exists in ru.ts/en.ts |
| Example placeholders (§23.2 5.3): every text input case carries one (name "e.g. Ann", public bio "I am a backend dev" / RU «Я бэкенд-разработчик», private bio, contact value, contact nickname) — RU/EN parity | PASS | S: CreationWizard.svelte 370–383 (inputPlaceholder switch); i18n/ru.ts 71–75 + en.ts 71–75 (placeholder keys, RU/EN side by side); T: creation-wizard.test.ts composer test above; i18n.test.ts (in the 94-test spot run) |
| Interests creation-only (§23.2 5.6): InterestsEditor DELETED (no reference anywhere in the tree); the /profile/settings page has no interests row; the interests store stays as the badge display source only | PASS | S: grep `InterestsEditor` across apps/web → 0 matches; profile/settings/+page.svelte 15–17 + 340 ("§23.2 5.6: no interests row — interests are set at creation"); PersonaEditor.svelte (no interest references); profile badge still renders chips (ProfileBadge.svelte 92–100, read-only); T: profile-settings.test.ts (in the 28-test spot run) |
| Arcade-sheet loading animation (§23.2 5.8): the creating step animates the SummarySheet pixel-dots beat — five 6px dots, `steps(2, jump-none)` 1.2s loop, 120ms stagger, transform/opacity only | PASS | S: CreationWizard.svelte 415–425 (`.loading-dots` + status text), 786–820 (dot CSS, "§23.2 5.8: FIVE square pixel dots … the SummarySheet §4.15.3.3 arcade beat"); T: creation-wizard.test.ts — "animates the SummarySheet pixel-dots beat: five staggered steps(2) dots over the status text"; "pending keeps the dots in the loading copy with no retry affordance" |
| API shape UNCHANGED (machine-test-pinned): the createPersona body stays exactly `name/public_bio/private_bio/invite_code/token` (`CreateUserRequestV2`) — NO contact and NO interests keys on the wire | PASS | S: join.ts 173–184 (wizardPersonaDraft carries contact/interests as local-only fields), 297–310 (createPersona → createRoomUser); packages/api-client/src/types.ts 173–181 (CreateUserRequestV2 — no contact/interests fields); T: join-machine.test.ts — "the composed draft keeps the createPersona body UNCHANGED (no contact, no interests on the wire)" (exact body toEqual + `'contact' in body === false` + `'interests' in body === false`); join-flow.test.ts — "success persists the composed contact ONLY to bleak.contactCard — the API body carries no contact (§4.14.3)"; "the createPersona body stays unchanged (interests ride separately)" |
| Interests flushed post-2xx via ONE bulk call (§13.1.1 + §23.2 5.5): identity saved first (Bearer auto-injected), then one `addUserInterests` with the theme titles; a flush failure does NOT undo the creation (flow still enters /room, no mirror row) | PASS | S: JoinFlow.svelte 254–277 (post-2xx sequence: saveIdentity → saveContactCard → appendVaultEntry → bulk addUserInterests → saveInterests mirror; flush errors swallowed), 28–30 (header doc); T: join-flow.test.ts flush assertions (in the 31-test run, incl. lines 411–445) |
| Contact persisted locally post-2xx (§14.1.3): `"<kind label>: <value>"` composed text, contactCard store only, never sent | PASS | S: JoinFlow.svelte 242–246 (saveContactCard after 2xx); join.ts 173–184; T: join-flow.test.ts — "success persists the composed contact ONLY to bleak.contactCard" |
| Draft submitted exactly once per loading-step entry; back out of the loading step re-opens the theme badges and re-arms the submit | PASS | S: CreationWizard.svelte 79–83 (submitted flag), 301–309 (auto-submit effect), 264–272 (back re-arms); join.ts 162–171 (back from `creating` → `themes`) |

### Item 4 — FADES EVERYWHERE (§23.2 5.9 extended, DESIGN §4.15.6.4, tz11-02a) — PASS

One fade treatment (200ms opacity-only `fade-in`/`fade-out`; the sheets'
established fade) at EVERY creation-path boundary; reduced-motion guard in
base.css + the goto delay skip.

| Boundary | Result | Evidence |
| --- | --- | --- |
| Join-form step swaps (code ⇄ preview ⇄ wizard ⇄ vault) — form → intro included | PASS | S: JoinFlow.svelte 344–384 (`{#key flow.step}` remounts `.stage` per swap) + 416–423 (`.stage { animation: fade-in 200ms ease-out }`); T: join-flow.test.ts — "the card content fades in on every join-step swap (form → wizard intro included)" (CSS pins incl. keyframes opacity 0→1) |
| Wizard intro ⇄ chat stage boundary | PASS | S: CreationWizard.svelte 587–598 (`.creating-stage` fade-in), 626–639 (`.stage` fade-in — "mounts fresh at every branch boundary (intro ⇄ chat, creating ⇄ chat) and replays the fade there"); T: creation-wizard.test.ts — "§23.2 5.9 (owner amendment, DESIGN §4.15.6.4): EVERY wizard step boundary uses the ONE fade treatment" |
| Between the chat steps | PASS | S: CreationWizard.svelte 462–566 (`{#key wizard.step}` remounts `.panel` per step) + 648–656 (`.panel` fade-in, "§23.2 5.9: fade transitions between the creation-chat steps"); T: creation-wizard.test.ts fade-contract test (source pins) |
| Into the loading step | PASS | S: CreationWizard.svelte 587–598 (the creating stage uses the same `.creating-stage` fade-in); T: creation-wizard.test.ts fade-contract test (all boundaries) |
| Loading → /room (the leaving fade): the card takes `fade-out 200ms forwards`, the goto waits out the fade duration | PASS | S: JoinFlow.svelte 278–284 (`enteringRoom = true` → `if (!reducedMotion) await … FADE_MS` → goto('/room')), 342 (`class:leaving={enteringRoom}`), 424–439 (`.card.leaving` fade-out + keyframes); T: join-flow.test.ts — "the loading → /room boundary: the card fades OUT (same treatment) before the route hand-off, skipped under reduced motion"; "behavior: after the creation 2xx the card takes the leaving fade, then the flow enters /room" |
| Reduced-motion guard: base.css catch-all collapses every fade/blink/beat to 0.01ms; JoinFlow's `reducedMotion` matchMedia skips the 200ms goto delay | PASS | S: base.css 57–68 (`animation-duration: 0.01ms !important`); JoinFlow.svelte 101–104 (matchMedia); T: join-flow.test.ts — "skipped under reduced motion" (matchMedia + `if (!reducedMotion) await … FADE_MS` pins); T: mascot.test.ts — "no local reduced-motion override (base.css catch-all governs)" |

### Item 5 — REGRESSIONS — PASS

| Check | Result | Evidence |
| --- | --- | --- |
| Join machine: code/preview/persona-wizard/vault flow green | PASS | R: join-machine.test.ts 38/38 green (step machine transitions incl. the return-to-event vault screen, choose-create → persona (wizard), back navigation, change-code reset; services against the mocked clients) |
| Join flow surface green (wizard flow, §2.9 invite rejection, §4.14.3 contact, fades, phone contracts) | PASS | R: join-flow.test.ts 31/31 green |
| Import/return (vault) flow untouched and green | PASS | S: JoinFlow.svelte vault step wired (374–381) + pickVaultEntry credentialed verify (§4.11.1, lines 210–226); CodeEntry `onreturn` (§4.11.1, lines 99–105); R: token-vault.test.ts green (in the 28-test spot run); join-machine vault-transition tests green |
| PersonaForm replaced (deleted), PersonaEditor/settings flows intact | PASS | S: no `PersonaForm` component in the tree (join/ inventory); /profile/settings persona editing (§4.16) green in profile-settings.test.ts |
| Interests catalog/store contracts intact | PASS | R: interests-catalog.test.ts + interests-store.test.ts + kit.test.ts + i18n.test.ts — 94/94 green |
| All prior contracts intact (api shape, §12 digit cells, §4.14.3, §2.9, §13.1.1) | PASS | T: join-machine.test.ts exact-body pin + join-flow.test.ts wire/no-contact pins; CodeEntry digit-row tests (in join-flow run, "Wide screens unchanged: the cells cap at the 56px design size"); S: packages/api-client/src/types.ts CreateUserRequestV2 unchanged |

**Findings: none.** Every verified item is delivered on `dev` at `e28bb62`;
no missing delivery to record.

---

## 3. Commit map (verified scope)

| Commit | Landing | Task / worker |
| --- | --- | --- |
| `3ca9307` | merge: squash feature/0cc45a6b-tz11-01-bleak-mascot | 100 · 0cc45a6b |
| `925e913` | merge: squash feature/434efe53-tz11-02-creation-wizard | 101 · 434efe53 |
| `48e3172` | merge: squash feature/0cc45a6b-mascot-amendments | 102 · 0cc45a6b |
| `e28bb62` | merge: squash feature/434efe53-fade-every-boundary | 103 · 434efe53 |
| `7f3eeda` | feat(tz11-02): fold the owner design-review amendments §23.2 into the creation wizard | 101 follow-up (ratified in the v3.10 round note, verification-v38) |
| `410f6c6` / `28993fa` | docs(verification-v38) v3.9 + v3.10 round notes | process |

---

## 4. First-hand spot-run record (this session)

| Run | Files | Result |
| --- | --- | --- |
| `npm run test -w @bleak/web -- mascot.test.ts` | 1 file | 8 passed / 8 |
| `npm run test -w @bleak/web -- creation-wizard.test.ts` | 1 file | 19 passed / 19 |
| `npm run test -w @bleak/web -- join-machine.test.ts` | 1 file | 38 passed / 38 |
| `npm run test -w @bleak/web -- join-flow.test.ts` | 1 file | 31 passed / 31 |
| `npm run test -w @bleak/web -- interests-catalog.test.ts interests-store.test.ts kit.test.ts i18n.test.ts` | 4 files | 94 passed / 94 |
| `npm run test -w @bleak/web -- token-vault.test.ts profile-settings.test.ts` | 2 files | 28 passed / 28 |

Total: **218/218 green, 10 files, 0 failures** — no test added or modified.

---

## 5. Carried-forward manual checks for the owner

**NEW this round:**

1. **The wizard end-to-end on a REAL invite, with fades at every
   boundary:** enter a real code → room preview (mascot-at-top) → wizard
   intro (mascot + "Hi! I'm Bleak" plain text, no plate) → name → public
   bio → private bio → contact type/value (the tg:@/signal:@/inst:@
   prefixes append over the nickname) → theme badges → topics → Done →
   badges again (the loop) → Ready → "Creating your profile" (dots beat)
   → the leaving fade into /room. Every swap should show the same 200ms
   fade — form ⇄ intro ⇄ chat steps ⇄ loading — and the keyboard rising
   should keep the composer pinned to the bottom.
2. **The mascot on phone full-screen:** the enter-code form, the room
   preview and the wizard intro carry the un-plated pixel figure at
   320/360/390 widths — no backdrop, no frame, the §12 full-screen
   contract intact (nothing pushed past the card, the digit cells still
   centered).
3. **The leaving fade into /room:** after a real creation the join card
   fades out before the route hands off into the room radar; with
   prefers-reduced-motion on, the navigation is immediate (no 200ms wait).

**Carried forward (standing arcade-sheet/on-device items — full notes in
`docs/verification-v32.md` §5 through `docs/verification-v38.md` §5 and
earlier):**
the wizard's send button/counter/placeholders feel on a real keyboard and
on the soft keyboard (the visual-viewport rise), the wizard skip/back
paths on a real invite (skip contact, skip themes, back out of the loading
step re-opens the badges), the bulk-interests flush surviving a slow
backend (room entered even if the flush fails);
the tap-form flow end-to-end on a REAL added-you item; the arcade-sheet
end-to-end on a real finished chat (spring-bounce rise, cascade stagger,
tally + clockwise ring, tier animations across all three tiers, Great-match
title in the common ink, the X close legible on every Deepa hue incl.
yellow, checklist pop-flash-draw, completion confetti + victory jumps +
copy swap, re-open replays nothing);
the per-hue sheet legibility on device; slide v2 feel on touch AND mouse;
sheet scroll with a long summary text; slide / Summarization-button bottom
alignment on device; Summarization button states on device; Press Start 2P
RU headers on device; the lazy summary flow end-to-end; the people-page
sort order end-to-end on a real mixed room; the bigger finished-dot
legibility on device; the chats-list common block + dividers and the
dimmed-content unfinished item on device; the single newest-first time
order with mixed items; and the earlier standing items — RU date/time ICU,
Deepa violet legibility, radar feel after the §13 tuning, summary-sheet
freshness, contacts tab dot flow, join digit-row/full-screen forms, the
on-device scanner smoke (HTTPS secure-context gate, iOS Safari + Android
Chrome decode path, camera light off on close), PWA install, venue Wi-Fi
polling, host-console flows, return-to-event round-trip.

---

*Verification-only sweep by worker `afca6a38` (task 104, tz11-03) — no
product code, no test files; the delta-wave CI record above is filled by
the process after the merge.*
