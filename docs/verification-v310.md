# bleak-web v3.10 — Verification sweep (tz11-05, verification-only)

Worker instance `e59dea27` · 2026-11-21 · branch
`feature/e59dea27-tz11-05-verify-v310` (base = dev tip `889b6eb` — the landing of
`feature/c1266ebd-tz11-04-wizard-review-batch`). This sweep verifies the
**Concept §24 second-batch owner design review** (14 items, tz11-02 lineage)
are delivered on `dev` against **DESIGN §4.16.1** — **completing the §8–§24
verification record** (§13 = `docs/verification-v3.md`, §14 = `-v31.md`,
§15 = `-v32.md`, §16 = `-v33.md`, §17 = `-v34.md`, §18 = `-v35.md`,
§19 = `-v36.md`/`-v37.md`, §19–§21 = `-v38.md`, §22–§23 = `-v39.md`).
No product code and no test files — one-shot source reads and targeted
spot-run runs recorded here, per the verification-only constraint of the card.

Method legend: **S** = source inspection / landed-code read in this sweep,
**T** = merged automated test (file — title), **R** = targeted spot-run
executed first-hand in this session.

Landing commit of the verified scope (dev log, pre-sweep): tz11-04 wizard
second review batch `889b6eb` (task 105, worker `c1266ebd`). Task 105 is
`done` with an MR record `merged` (read first-hand via `task.py show`; the
green-CI close note sits in the task history). The prior tz11 lineage
(§22–§23) was verified by `docs/verification-v39.md` at `e28bb62`.

Spec-source note: unlike the v3.9 sweep, the §24 spec text IS committed on
`dev` at sweep time (`docs/Concept.md` §24, `docs/DESIGN.md` §4.16.1 land
with `889b6eb`'s wave) — the sweep verifies the product tree against the
committed spec, no working-copy dependency.

---

## 1. Gate record (TZ §8.8 discipline — full gates are delta-wave-CI's job)

| Check | Result | Source |
| --- | --- | --- |
| Full `make test` re-run by this sweep | **not run** (the process runs the delta-wave CI after this landing) | this session |
| Owning worker's MR gates — task 105 (tz11-04 wizard review batch) | **green**: MR #105 `merged` `ci=green` (process wave CI on `dev`), task auto-closed `done` | `scripts/task.py show 105` |
| Targeted spot-runs (first-hand, this session) | **green — 134 tests / 4 files**: creation-wizard + join-flow + join-machine + i18n = 134/134 | `npm run test -w @bleak/web -- tests/creation-wizard.test.ts tests/join-flow.test.ts tests/join-machine.test.ts tests/i18n.test.ts` (§4) |
| Owning task of the verified items | task 105 landed into `dev` (dev tip `889b6eb` at sweep time) | dev log / task list |

No test was added or modified by this sweep. No product code touched.

DELTA-WAVE CI: [pending — process fills]

---

## 2. Per-item checklist — Concept §24 (DESIGN §4.16.1)

All checks against the landed state at `889b6eb`, files:
`apps/web/src/lib/components/join/CreationWizard.svelte` (the wizard surface),
`apps/web/src/lib/components/join/JoinFlow.svelte` (the card + fades + dims),
`apps/web/src/lib/join.ts` (the machine), `apps/web/src/lib/i18n/{ru,en}.ts`,
`apps/web/src/lib/styles/tokens.css`.

### Item 1 — NO ECHO — PASS

| Check | Result | Evidence |
| --- | --- | --- |
| The transcript never derives mine-bubbles from live input state — answers are SNAPSHOTTED the moment a step is left forward (`snapshotForward` copies the trimmed value into `sentName`/`sentPublic`/`sentPrivate`/`sentKind`/`sentContactText` on a forward move only; back/lateral moves leave them untouched) | PASS | S: CreationWizard.svelte 110–117 (the `sent*` snapshot states, "§24 item 1: sent answers are SNAPSHOTTED…"), 306–356 (`dispatch` → `snapshotForward`; `if (to <= from) return` — only forward moves snapshot); 194–269 (the transcript renders ONLY the `sent*` values + machine state — no `wizard.name`/`contactValue` read anywhere in it) |
| No live echo bubble of the typed text; the mine bubble appears only after the send | PASS | T: creation-wizard.test.ts — "§24 second batch / item 1: typing never echoes into the chat — the answer lands only after the send" (`myLines` empty after `fireEvent.input`, `['Аня']` only after the send); T: "topics are multi-select…" — "the picks do not appear as a chat line while they are being toggled; the summary lands after Done" (line 492–494) |

### Item 2 — ARROW ⇄ SEND SWAP — PASS

| Check | Result | Evidence |
| --- | --- | --- |
| Bottom back button REMOVED from the chat stage (no back link below the composer anymore; the revert arrow in the input replaces it) | PASS | S: CreationWizard.svelte 606–753 (the chat stage markup has no back button in/under the composer — the only `common.back` buttons are the stage-level intro/creating ones, kept intentionally per item 13); T: creation-wizard.test.ts — "layout contract" pin "the bottom back button is GONE (no .back class…)" (279–283); T: "the revert arrow navigates BACK (the bottom back button is gone)" (236) |
| Revert arrow IN the input form, shown when the input is empty | PASS | S: CreationWizard.svelte 671–673 (`{#if inputValue === ''}` → `button.swap.revert ←` with `aria-label=common.back`, `onclick=back`) |
| Send appears in the same slot the moment typing starts | PASS | S: CreationWizard.svelte 674–678 (`{:else}` → `button[type=submit].swap.send ↑`, `aria-label=join.wizard.send`); T: "the revert arrow sits in the swap slot while the input is empty and swaps to send on typing" (216) |
| Identical 48px geometry (the swap never shifts the composer) | PASS | S: CreationWizard.svelte 905–919 (`.swap` — ONE shared class: `width: var(--touch-target); height: var(--touch-target)` + circular border-radius; `.revert`/`.send` differ only in colors); S: tokens.css 126 (`--touch-target: 48px`); T: layout-contract pin "the arrow ⇄ send swap share one slot geometry" (297) |
| Enter always submits the composer form (the arrow never blocks sending an empty step) | PASS | T: creation-wizard.test.ts — "Enter always submits the composer form" helper pin (56); join-flow.test.ts — `submitComposer()` = `fireEvent.submit('.input-row')` with the "§24 item 2" comment (192–197) |

### Item 3 — FULL HISTORY — PASS

| Check | Result | Evidence |
| --- | --- | --- |
| Monotonic `reached` cursor — back navigation never rewinds it, so every asked question stays in the log while earlier steps are revisited | PASS | S: CreationWizard.svelte 106–109 (`reached`, "monotonic — back navigation never rewinds it"), 322 (`if (to > reached) reached = to`), 199 (`asked = idx => reached >= idx` — the question stays in the log) |
| Every sent answer stays (one answer line per question — a re-sent answer replaces it in place, a Q/A transcript, not a stream) | PASS | S: CreationWizard.svelte 204–239 (each `done(idx)` question renders its `sent*` answer); T: "item 3: the whole history stays when going back (questions + sent answers)" (555–578 — `['Я', 'Писатель']` asserted before AND after re-entering) |
| Per-theme pick rounds answered as the user's summary messages: each opened theme asks its pick question (kept as the mascot's line), the finished theme logs one summary mine line `'<group>: <topic> · …'` | PASS | S: CreationWizard.svelte 120–123 (`pickRounds` "every theme the user opened stays in the history"), 246–267 (the themes transcript block: pick_question per round + the answered summary as a `who: 'me'` line), 345–347 (`interest-group` opens a round), 413–422 (finishTheme marks the round answered); T: "topics are multi-select; Done with a theme returns to the BADGES…" (483–511 — "the theme's answer stays" + the summary mine lines asserted for BOTH themes) |

### Item 4 — COUNTER POSITION — PASS

| Check | Result | Evidence |
| --- | --- | --- |
| The symbol counter is centered BELOW the input row (below the button row) | PASS | S: CreationWizard.svelte 680–684 (`.meta-row` with the counter follows the `form.input-row` in source order), 935–941 (`.meta-row { justify-content: center }` — "§24 item 4: the counter is centered below the input row"); T: layout-contract pin "the counter is centered below the input row" (284–286) |

### Item 5 — SLOWER FADES (200 → 400ms) — PASS

| Boundary | Result | Evidence |
| --- | --- | --- |
| Stage fades (the chat stage, one fading unit at intro ⇄ chat and creating ⇄ chat) | PASS | S: CreationWizard.svelte 818–826 (`.stage { animation: fade-in 400ms ease-out }`) |
| Panel fades (between the chat steps, `{#key wizard.step}`) | PASS | S: CreationWizard.svelte 835–844 (`.panel { animation: fade-in 400ms ease-out }` — "§24 item 5: 400ms") |
| Creating/intro stage fade | PASS | S: CreationWizard.svelte 769–781 (`.creating-stage { animation: fade-in 400ms ease-out }`) |
| Leaving fade (loading → /room, the card fades OUT before the route hand-off) | PASS | S: JoinFlow.svelte 100–102 (`FADE_MS = 400` — "§24 item 5: the step fades run slower"), 286 (the goto waits out `FADE_MS`, skipped under reduced motion), 432–433 (`.card.leaving { animation: fade-out 400ms ease-out forwards }`) |
| Full contract pinned | PASS | T: creation-wizard.test.ts — "EVERY wizard step boundary uses the ONE fade treatment — slower now (400ms)" (330–339); T: join-flow.test.ts fade pins incl. the 400ms treatment (846+) |

### Item 6 — CALM INTRO COPY — PASS

| Check | Result | Evidence |
| --- | --- | --- |
| `join.wizard.intro.line` carries the agent's role + the no-rush/simple-dialog framing (RU/EN parity) | PASS | S: i18n/ru.ts 47–50 ("Я ваш агент — представлю вас в комнате… Спокойно ответим на несколько коротких вопросов — необязательные можно пропустить.", the "§24 item 6" comment); S: i18n/en.ts 47–50 ("I'm your agent — I'll introduce you to the room… no rush — skip anything optional."); T: creation-wizard.test.ts — "item 6 + 7: the calm intro copy is in place" (609–615) |

### Item 7 — PIXEL GREETING — PASS

| Check | Result | Evidence |
| --- | --- | --- |
| "Hi! I'm Bleak" (`join.wizard.intro.title` → `.intro-title`) renders in `--font-pixel` (the h1/h2/h3 treatment — Handjet, not the body font) | PASS | S: CreationWizard.svelte 786–794 (`.intro-title { font-family: var(--font-pixel) }` — "§24 item 7"); T: creation-wizard.test.ts — "§24 item 7: the intro greeting renders in the pixel font (not the body font)" (314) |

### Item 7b — DESKTOP DIMS — PASS

| Check | Result | Evidence |
| --- | --- | --- |
| `>=720px`: the persona step is capped at the 640px room-chat column (the /chats room-chat column — chats/[address]/+page.svelte `.column { max-width: 640px }` at the same breakpoint), not the 480px join card, never full-width | PASS | S: JoinFlow.svelte 317 (`class:persona-step={flow.step === 'persona'}`), 487–497 (`@media (min-width: 720px)` → `.join.persona-step { max-width: 640px }` — "§24 item 7b", the 480px default kept for the non-persona steps); S: chats/[address]/+page.svelte 952–961 (the 640px column at min-width 720px) |
| Phone (<720px) full-screen unchanged (the §12 treatment untouched) | PASS | S: JoinFlow.svelte 499–515 (the `max-width: 719px` query keeps the phone full-screen card — `max-width: none`, no rounded chrome); T: creation-wizard.test.ts — "§24 item 7b (DESIGN §4.16.1): the persona card is scoped for the desktop 640px room-chat width in JoinFlow" (307) |

### Item 8 — CLEAR "X" — PASS

| Check | Result | Evidence |
| --- | --- | --- |
| An "x" INSIDE the pill's right (absolutely positioned over the right padding — the pill box never changes size) clears the input quickly | PASS | S: CreationWizard.svelte 661–669 (`{#if inputValue !== ''}` → `button.clear ×` inside `.field`), 851–859 + 874–877 (the `.field` pill is `position: relative`; the x overlays the right padding via `.with-clear` extra right padding); S: 884–904 (`.clear { position: absolute; right: … }`) |
| Clears AND refocuses the input | PASS | S: CreationWizard.svelte 537–560 (`clearInput` dispatches the empty value and re-focuses `inputId`); T: "§24 item 8: the 'x' inside the pill clears the input quickly" (244) |
| Accessible name | PASS | S: CreationWizard.svelte 666 (`aria-label={t('join.wizard.clear')}`); S: i18n/ru.ts 74–75 (`'join.wizard.clear': 'Очистить'`), en.ts 75 (`'Clear'`) |

### Item 9 — STRONGLY FIXED INPUT HEIGHT + PREFIXES ABOVE — PASS

| Check | Result | Evidence |
| --- | --- | --- |
| The composer input height is strongly fixed: `height: var(--touch-target)` (48px — was a min-height treatment), never grows/shrinks with content | PASS | S: CreationWizard.svelte 860–873 (`.input-row input { height: var(--touch-target) }` — "§24 item 9: strongly fixed height"); S: tokens.css 126 (48px) |
| Prefix suggestions (tg:@/signal:@/inst:@) sit ABOVE the input row (source-order pin: the `.prefixes` block precedes the `form.input-row`) | PASS | S: CreationWizard.svelte 624–646 (the `contact_value`/nickname branch renders `.prefixes` BEFORE the input-row form — "§24 item 9" comment), 947–951; T: layout-contract pin "suggestions ABOVE the input" (287–293) |

### Item 10 — FOOTER NOTE REMOVED — PASS

| Check | Result | Evidence |
| --- | --- | --- |
| `join.form.contact_hint` ("stored on your device. Shared when you slide to share") deleted from BOTH dictionaries — only the deletion note remains | PASS | S: grep `contact_hint` across apps/web → the ONLY matches are the deletion comments at ru.ts 39–41 and en.ts 39–41 (no key, no usage); T: creation-wizard.test.ts — "§24 item 10: the device-storage footer note is gone from the chat (both dictionaries)" (319); T: join-flow.test.ts — "§4.14.3; §24 item 10 — the hint is gone" (305–316) |

### Item 11 — AUTOFOCUS AFTER SEND — PASS

| Check | Result | Evidence |
| --- | --- | --- |
| The fresh composer input is focused after every send into a text step (the keyed remount creates the new input; the effect focuses `inputId` on every text step) | PASS | S: CreationWizard.svelte 375–387 (the autofocus `$effect` — "§24 item 11: the active composer input is auto-focused… after a send", SSR/test-safe), 469–477 (`inputId` per step); T: creation-wizard.test.ts — "§24 item 11: after a send the next input is auto-focused again" (262) |

### Item 12 — PINNED LAST MESSAGE — PASS

| Check | Result | Evidence |
| --- | --- | --- |
| The auto-scroll effect depends on `wizard.step` TOO (re-pins the newest message above the composer when the composer height changes), in addition to every new transcript line | PASS | S: CreationWizard.svelte 271–282 (`$effect` — "§24 item 12", `void transcript.length; void wizard.step; scrollTo(logEl.scrollHeight)`); T: creation-wizard.test.ts — "item 12: auto-scroll re-pins the newest message above the composer on every line AND step swap (source pin)" (601–607) |

### Item 13 — RIGHT BACK KEPT, BOTTOM BACK GONE — PASS

| Check | Result | Evidence |
| --- | --- | --- |
| `.link.back-right` (right-aligned, `align-self: flex-end`) on the non-standard panels ONLY: contact_type, themes, topics | PASS | S: CreationWizard.svelte 703–704 (contact_type), 725–726 (themes), 747–748 (topics — each "§24 item 13" commented); S: 1065–1069 (`.back-right { align-self: flex-end }`) |
| Text steps have NO back button (the revert arrow replaces them — item 2); the stage-level back links are intentionally KEPT on the intro stage (the room-preview return) and the creating stage | PASS | S: CreationWizard.svelte 592 + 604 (the intro/creating `.link` back buttons remain, the machine `back()` routes them — 389–397); T: "item 13: non-standard sub-steps keep the RIGHT back button; text steps have none (the revert arrow replaces it)" (580–599 — `.back-right` count 0 on a text step, 1 on each of contact_type/themes/topics) |

---

## 3. Findings

**No missing delivery.** All 14 §24 items (1, 2, 3, 4, 5, 6, 7, 7b, 8, 9, 10,
11, 12, 13) are delivered on `dev` at `889b6eb` against DESIGN §4.16.1,
with merged test anchors for every behavior-claimed item (source pins for
the layout/fade contracts). The §8–§24 verification record is complete.

---

## 4. First-hand spot-run record (this session)

| Run | Files | Result |
| --- | --- | --- |
| `npm run test -w @bleak/web -- tests/creation-wizard.test.ts tests/join-flow.test.ts tests/join-machine.test.ts tests/i18n.test.ts` | 4 files | **134 passed / 134, 0 failures** |

Total: **134/134 green, 4 files, 0 failures** — no test added or modified.

---

## 5. Carried-forward manual checks for the owner

**NEW this round:**

1. **The wizard end-to-end on a REAL invite, incl. the arrow ⇄ send swap
   and the multi-theme loop:** enter a real code → room preview → intro
   (mascot, "Hi! I'm Bleak" in the pixel font, the calm role/no-rush line)
   → name (typing swaps the revert arrow to the accent send button, "x"
   clears mid-typing, the counter sits centered under the row) → public →
   private → contact type (the RIGHT back button) → value with the
   tg:@/signal:@/inst:@ prefixes ABOVE the input → theme badges → topics →
   Done (the summary lands as MY message) → badges again (both themes'
   questions + summaries stay in the log) → Ready → the dots beat → the
   leaving fade into /room. Every boundary should fade at the SLOWER 400ms
   now, the history should never repeat what is being typed, and going
   back should never remove an asked question.
2. **The desktop dims on a real screen:** on a computer (>=720px wide) the
   creation chat occupies the same 640px column as the /chats room-chat
   dialog — not the narrow 480px join card and not full-width; on a phone
   (<720px) the wizard stays full-screen exactly as before.
3. **Autofocus behavior on device:** after every send (Enter or the ↑
   button) the next question's input must already hold focus — no extra
   tap before typing; the keyboard rise must not push the composer up
   (the height is fixed at 48px) and the newest bubble must stay pinned
   right above the composer/badges.

**Carried forward (standing arcade-sheet/on-device items — full notes in
`docs/verification-v32.md` §5 through `docs/verification-v39.md` §5 and
earlier):** the wizard's send button/counter/placeholders feel on a real
keyboard and on the soft keyboard (the visual-viewport rise), the skip/back
paths on a real invite (skip contact, skip themes, back out of the loading
step re-opens the badges), the bulk-interests flush surviving a slow
backend; the tap-form flow end-to-end on a REAL added-you item; the
arcade-sheet end-to-end on a real finished chat (spring-bounce rise,
cascade stagger, tally + clockwise ring, tier animations across all three
tiers, Great-match title in the common ink, the X close legible on every
Deepa hue incl. yellow, checklist pop-flash-draw, completion confetti +
victory jumps + copy swap, re-open replays nothing); the per-hue sheet
legibility on device; slide v2 feel on touch AND mouse; sheet scroll with
a long summary text; slide / Summarization-button bottom alignment on
device; Summarization button states on device; Press Start 2P RU headers
on device; the lazy summary flow end-to-end; the people-page sort order
end-to-end on a real mixed room; the bigger finished-dot legibility on
device; the chats-list common block + dividers and the dimmed-content
unfinished item on device; the single newest-first time order with mixed
items; and the earlier standing items — RU date/time ICU, Deepa violet
legibility, radar feel after the §13 tuning, summary-sheet freshness,
contacts tab dot flow, join digit-row/full-screen forms, the on-device
scanner smoke (HTTPS secure-context gate, iOS Safari + Android Chrome
decode path, camera light off on close), PWA install, venue Wi-Fi
polling, host-console flows, return-to-event round-trip.

---

*Verification-only sweep by worker `e59dea27` (task 106, tz11-05) — no
product code, no test files; the delta-wave CI record above is filled by
the process after the merge.*
