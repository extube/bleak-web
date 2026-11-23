# bleak-web v3.8 — Verification sweep (tz10-03, verification-only)

> **v3.26 ROUND NOTE (§45 hero breakpoint/width/headline + Bleak margins,
> Concept §45 — appended by the process 2026-11-23, post-round three-gate
> run GREEN: lint clean · 1022 tests total (49 api-client + 8 helper +
> 965 web, 53 files; landing suite 95) · build 0 errors, dev `092d67b`):**
> **Landing adjusted per ALL 3 §45 items** (task 135, worker `1c622991`;
> design-first — design instance `b5720895` wrote DESIGN §4.32): (1)
> **<960px open state = lead ALONE** — CSS-only, DOM unmoved: the base
> `.stage` lost `min-height: 100dvh` + centering; a `≤959.98px` media
> gives `.area-lead` the 100dvh flex-centered region — the lead centered
> ALONE in the first viewport, BLEAK strictly below the fold (reveals on
> scroll — its marker dropped `data-reveal-load` → bare `data-reveal`,
> the 13th scroll unit; at ≥960 its IO fires at the scroll origin — net
> same on-open reveal); `min-height: 100dvh` moved into the ≥960 media —
> the §37 open-state rule now scoped ≥960 only (supersedes the §44.1
> <960 stack); (2) **Bleak card wider — symmetric edges** — the 240px
> cap + auto margins DELETED; the card fills its `1fr` track
> (`width: 100%`); the container's 48px padding included on BOTH sides →
> card-right-margin == lead-left-margin == `calc(10% + 48px)` at every
> ≥960 width (card ≈288@960 / ≈407@1280 / ≈640@1920); (3) **headline
> bigger** — ≥960 clamp(28,4vw,48) → **`clamp(32px, 4.5vw, 64px)`**
> (<960 ladder byte-unchanged; agent-name 28px stays subordinate; line
> fit + open-state fit verified at 960/1280/1920 — row max ≈370/371/392px
> fits any realistic desktop height; `min-height: 100dvh` kept
> grow-allowed). i18n ZERO delta (55/55); no new deps; tokens/routes/
> income untouched; the reveal + reduced-motion mechanics unchanged.
> §4.32.H records (no blocking flags): the DOM-stays-put rationale; the
> padding-inclusive symmetry reading; the ≥960 origin-fire reveal timing;
> the clamp value = design's call (one-literal revert band 56–72px cap if
> the smoke dislikes the 1920 scale).
> Manual checks for the owner: the landing at 800/960/1280/1920 (phone/
> narrow: ONLY the lead centered on open, BLEAK below the fold; desktop:
> lead + BLEAK both visible and centered, the BLEAK card's right edge
> symmetric with the lead's left margin, the bigger headline in BOTH
> locales), Start/TALK → /income, reduced-motion.
> Housekeeping (unchanged): staged-leftover index state persists (root
> `background-img.jpg` + legacy `docs/logs/1640ba9e.log` mod) — commits
> pathspec-scoped; devops `-D` branch-cleanup list adds
> `feature/1c622991-tz12-15-hero-breakpoint-bleak` (16 branches total;
> the profile branch `f6ab8db7` still excluded — awaiting the owner's
> merge approval); owner refs stay untracked.

> **v3.25.1 ROUND NOTE (§44.4 mobile keyboard viewport fix for
> income/[income_code]/create, Concept §44.4 — appended by the process
> 2026-11-23, post-round three-gate run GREEN: lint clean · 1022 tests
> total (49 api-client + 8 helper + 965 web, 53 files; new
> keyboard-viewport suite 9) · build 0 errors, dev `fcc66be`):**
> **The creation wizard no longer gets pushed off-screen by the mobile
> keyboard** (task 134, worker `5de72e33`; NO design instance — lean
> judgment: the owner's requirements were implementation-precise; the
> worker wrote the dated DESIGN §4.31.1 owner-amendment record): (1)
> **§44.4.1 dynamic viewport units** — the four §24–§30 height gates in
> `JoinFlow.svelte` (persona main block, persona app-shell lock,
> form-step gate, form-step shell lock) keep the `height: 100vh; height:
> 100dvh;` fallback-then-dvh pair and consume the dynamic height as
> `height: var(--app-height, 100dvh)` (unset elsewhere → the dvh fallback
> stands); (2) **§44.4.2 visualViewport listener** — a creation-scoped
> `$effect` gated on the persona step (the creation wizard): on
> `window.visualViewport` resize, `--app-height: <px>` lands on the
> document root + the body gets `overflow: hidden` (document scroll-lock)
> while the creation flow runs — fully restored on teardown, SSR-safe
> (guarded inside the effect, no module-init window access). **Scope
> gate verified:** the mechanism exists only in JoinFlow (never mounted
> by /chats) — negatives assert no `--app-height`/`visualViewport`/
> scroll-lock in any chats route/component and nothing outside JoinFlow's
> sources. The §24–§30 contracts HOLD — the "visible viewport" they bind
> to is now the dynamic visualViewport height (geometry test: at a
> keyboard-shrunk 400px bound, the messages area (flex:1/min-height:0/
> overflow auto) and the input (flex:none) both stay in flow inside the
> shrunk container). Listener/var/lock fully cleaned up on unmount.
> RU/EN parity untouched; no new deps; tokens/routes/landing/profile
> untouched; the §24–§30 contract suites green.
> Manual checks for the owner: the creation wizard on a real phone
> (Safari/iOS especially): open the keyboard — the page must not be
> pushed up; the messages area and the input stay visible together;
> closing the keyboard restores the full height; /chats unaffected.
> Housekeeping (unchanged): staged-leftover index state persists (root
> `background-img.jpg` + legacy `docs/logs/1640ba9e.log` mod) — commits
> pathspec-scoped; devops `-D` branch-cleanup list adds
> `feature/5de72e33-tz12-14a-keyboard-viewport` (15 branches total; the
> profile branch `f6ab8db7` still excluded — awaiting the owner's merge
> approval); owner refs stay untracked.

> **v3.25 ROUND NOTE (§44 wider lead + unified card borders + route param
> rename, Concept §44 — appended by the process 2026-11-23, post-round
> three-gate run GREEN: lint clean · 1013 tests total (49 api-client + 8
> helper + 956 web, 55 files) · build 0 errors, dev `84e7e7f`):**
> **Landing adjusted per ALL 3 §44 items** (task 133, worker `bbf8e50d`;
> design-first — design instance `6ce29032` wrote DESIGN §4.31): (1)
> **hero rework** — ≥960px: two-column `1.2fr 1fr` (lead col 1 ≈489px
> @1280 / ≈348px @960 — the empty middle third retires; the agent card's
> 240px cap carries), <960px: ONE centered column — lead centered, BLEAK
> below (the 720px hero breakpoint superseded; the 100dvh + centering now
> live on `.stage` at every width; the §37 open-state re-verified at 800 —
> ~712px content fits); all other blocks' 720px rules stand; (2) **step
> cards 01/02/03 borders unified** — ROOT CAUSE found: no per-card
> divergence existed; the thick white bottom block on 01/03 was a
> GRID-STRETCH LEAK (the desktop grid stretched the `li`s while
> `.step-body`'s `height: auto` exposed the `pixel-frame--strong`
> near-white layer below the shorter bodies); fix = `.step-body { height:
> 100% }` + all three `li`s drop `pixel-frame--strong` → plain
> `pixel-frame` (unified 2px ring / stepped corners /
> `--color-surface-elevated`; agent + banner keep `--strong`); (3) **route
> param rename** — `income/[room]/create` → `income/[income_code]/create`
> (dir moved; `page.params.income_code`; JoinFlow resolve/prop
> `roomParam`→`incomeCodeParam` + seed; comment-only income/layout
> corrections; resolution behavior byte-identical; out-of-scope room
> surfaces untouched). i18n ZERO delta (55/55); no new deps; tokens
> untouched; §37 open state + all §31–§43 contracts green. Note: the
> Concept §42→§43 renumber (the duplicate-§42 fix) rode this landing.
> §4.31.I records (no blocking flags): the unified border color is
> `--color-surface-elevated` (a one-class `--strong` revert if the owner
> meant width/radius only); the headline clamp steps at the 960 boundary
> (48→38.4px — single-value tweak possible); the phone hero behavior
> changes by design <960 (the §37 RULE carries).
> Manual checks for the owner: the landing at 800/960/1280 (the wider
> lead, the centered stack below 960, the thirds ≥960), the three step
> cards' identical outlines (no white bottoms in EITHER locale — the leak
> was RU-height-dependent), the create deep link
> `income/<income_code>/create` still resolving via the room intro,
> Start/TALK → /income.
> Housekeeping (unchanged): staged-leftover index state persists (root
> `background-img.jpg` + legacy `docs/logs/1640ba9e.log` mod) — commits
> pathspec-scoped; devops `-D` branch-cleanup list adds
> `feature/bbf8e50d-tz12-14-wider-lead-borders-param` (15 branches total;
> the profile branch `feature/f6ab8db7-profile-redesign` is NOT on the
> list — still awaiting the owner's merge approval); owner refs stay
> untracked.

> **v3.24 ROUND NOTE (§42 scroll-triggered animations + card/width/icon
> tweaks, Concept §42 of 2026-11-23 — appended by the process 2026-11-23,
> post-round three-gate run GREEN: lint clean · 1012 tests total (49
> api-client + 8 helper + 955 web, 52 files; landing suite 94) · build 0
> errors, dev `16773a6`):**
> **Landing adjusted per ALL 5 §42 items** (task 132, worker `9626632b`;
> design-first — design instance `72f54529` wrote DESIGN **§4.30** —
> NUMBERING DEVIATION: the caller's cited §4.29 was already claimed by the
> PARALLEL profile-redesign rev, see below): (1) **scroll-reveal** — new
> native utility `landing/reveal.ts` (one shared IntersectionObserver,
> threshold 0.15 / rootMargin −48px, one-shot per unit + unobserve,
> `transitionend` + 720ms-fallback cleanup stripping the class+attribute,
> 60ms sibling stagger; hidden state ONLY under `data-reveal="armed"` in
> base.css — opacity 0 + translateY(16px), 320ms steps(4,end)/ease-out;
> reduced-motion OR missing IO ⇒ never armed ⇒ everything visible
> immediately; no-JS safe by construction); the below-fold blocks reveal
> on scroll (banner, 3 steps, sim, privacy, 4 use-case pills, join,
> footer); the §37 first-viewport pair (lead + BLEAK) animates on LOAD;
> (2) **Bleak card narrower** — desktop `max-width: 240px` centered in its
> third (phone 100%); (3) **icons +50%** in every below-first-screen
> block: flower 44/48→66/72, status dot 6→9px, step icons 32→48 (wrapper
> 72), step art 48→72, privacy 48→72, use-case 40→60, sim avatars 64→96 —
> negatives unchanged (lead/BLEAK art, join mascot, footer glyph,
> step-num, ring); (4) **step cards → the Bleak card's background** —
> `.step-body` now `var(--color-surface)` (byte-equal to the `.card`
> fill), the §38 glass rgba(15,14,22,0.65)+blur(10) SUPERSEDED on those
> cards (hover glow/lift/frame/pills/illustrations kept); (5) **phone
> banner stacking** — the flower icon + "AI Agents active nearby" caption
> moved ON TOP of the text; desktop row unchanged. i18n ZERO delta
> (55/55); no new deps; tokens untouched; all §31–§41 contracts green.
> **PARALLEL-TRACK COORDINATION (for concept):** a second process instance
> (`2a7c5e22`, parent concept) ran the profile-redesign track (task 131,
> worker `f6ab8db7`, design `0fd398c9` — DESIGN §4.29) in parallel; its
> code sits ready-for-merge on `feature/f6ab8db7-profile-redesign` (4
> commits, cut from this same dev base). Its UNCOMMITTED doc records
> (Concept's second "§42 profile redesign" + DESIGN §4.29) were folded
> into THIS landing's docs commit so they would not dangle — **Concept.md
> now contains TWO sections numbered §42** (2026-11-23 scroll-animations =
> mine; 2026-11-22 profile = theirs) — concept should renumber; and their
> landing (their process) now carries pure code (the docs are already
> in). The uncommitted §4.29 profile spec described in this file is
> theirs and lands with this commit — their code may supersede it
> operationally once merged.
> Manual checks for the owner: the landing on phone + desktop (blocks
> fade/rise in on scroll; the site still opens on lead + BLEAK only; the
> BLEAK card visibly narrower; icons notably bigger below the first
> screen; step cards match the BLEAK card's dark surface; the phone
> banner stacks icon-over-text in BOTH locales), reduced-motion
> (everything visible immediately, no reveal).
> Housekeeping (unchanged): staged-leftover index state persists (root
> `background-img.jpg` + legacy `docs/logs/1640ba9e.log` mod) — commits
> pathspec-scoped; devops `-D` branch-cleanup list adds
> `feature/9626632b-tz12-13-scroll-reveal-tweaks` (13 branches total);
> owner refs stay untracked.

> **v3.22.1 ROUND NOTE (§41 lead text color + copy changes, Concept §41 —
> appended by the process 2026-11-22, post-round three-gate run GREEN:
> lint clean · 1000 tests total (49 api-client + 8 helper + 943 web, 52
> files; landing suite 87) · build 0 errors, dev `929bb56`):**
> **Landing adjusted per ALL 3 §41 items** (task 130, worker `42ce1dbc`;
> NO design instance — lean judgment: copy + one color; the worker wrote
> the dated DESIGN §4.28.1 owner-amendment record): (1) the lead
> description `.sub` now reads **white** — `var(--color-text)` (the muted
> token retired for this element only; the headline treatment — clamp
> 28/4vw/48 + halo + accent word — unchanged); (2) **titles**: EN →
> "The right connections beside you" / RU → «Нужные знакомства рядом»
> (`landing.headline.accent` = 'BESIDE YOU' / «РЯДОМ» — the 3-line
> pixel-headline + highlighted-accent structure kept); (3) the **RU
> description** = the owner's VERBATIM string «Нетворкинг - это работа.
> Здесь ИИ-двойники работают за Вас. Собирайте контакты, проверяйте
> совместимость и вдохновляйтесь общими идеями!» (hyphen preserved as
> given); the **EN description UNCHANGED** (the §41.3 proposed translation
> stays pending the owner's decision — a negative test asserts it did not
> leak). Values only — parity stays 55/55 key-wise; no new deps; tokens
> untouched; all other muted consumers (nav etc.) untouched.
> Owner decision pending (carried): the EN description string — the
> §41.3 proposal awaits approval.
> Manual checks for the owner: the lead block (white description over the
> video, the new 3-line titles in BOTH locales with the accent line
> BESIDE YOU / «РЯДОМ»), Start/TALK → /income.
> Housekeeping (unchanged): staged-leftover index state persists (root
> `background-img.jpg` + legacy `docs/logs/1640ba9e.log` mod) — commits
> pathspec-scoped; devops `-D` branch-cleanup list adds
> `feature/42ce1dbc-tz12-12a-lead-copy-color` (14 branches total); owner
> refs stay untracked (incl. `profile-design*.png` — still no owner
> batch referencing them).

> **v3.22 ROUND NOTE (§40 bigger titles/descriptions/badges + phone widths,
> Concept §40 — appended by the process 2026-11-22, post-round three-gate
> run GREEN: lint clean · 995 tests total (49 api-client + 8 helper + 938
> web, 52 files; landing suite 77) · build 0 errors, dev `b909e40`):**
> **Landing adjusted per ALL 2 §40 items** (task 129, worker `05423c53`;
> design-first — design instance `2e2e5c6d` wrote DESIGN §4.28, a
> sizing-only pass with the full from→to ladder): (1) **font ladder** —
> headline 36/44/clamp(22,3.5vw,44) → **40 / 48 / clamp(28,4vw,48)** (the
> clamp adjustment was forced by the hierarchy — the grown agent-name
> would otherwise overtake the lead at 720px; open-state re-verified);
> agent-name 24→28 · stat-title 17→21 · step/section titles 20→24 (join
> ≥720 28) · privacy/sim/usecase labels 14→16 · descriptions 15→**17**
> (.step-desc/.privacy-desc/.stat-line/.agent-quote) · .sub 14→16 (≥720
> 18) · status captions 11→13 / sim 12→14 · pills 10→12 (≥720 13) ·
> CTAs 16→18; **negatives hold: nav stays 14 (§39), switcher untouched,
> join-input 14, footer/ring geometric sizes unchanged**; (2) **phone
> widths** — `.landing` AND `.top` both carry the identical
> `width: max(90%, 280px); margin-inline: auto` in the base (phone) rules,
> and `.landing`'s phone inline padding is DROPPED so the width-100%
> blocks span edge-to-edge aligning exactly with the header edges
> (390→351px both, 320→288px both, <311→280px floored both); ≥720px
> restores `max(80%, 280px)` content / 90% header — desktop unchanged.
> i18n ZERO delta (55/55 byte-identical); no motion; no new deps; tokens
> untouched; §37 open state + all §35–§39 contracts green.
> §4.28.K records (no ADVICE NEEDED — all six are design calls within the
> owner's §40 delegation): .sub + CTA pill family included in the ladder
> (one-line reversals if the owner disagrees); the shared-floor token
> rejected (two consumers only); the headline clamp decision; the 280px
> floor shared by both rules.
> Manual checks for the owner: the landing on phone + desktop (bigger
> titles/descriptions/badges read comfortably in BOTH locales; on phone
> the content blocks and the header edges line up exactly; desktop 80/90
> split unchanged; the first viewport still opens on lead + BLEAK
> centered), Start/TALK → /income.
> Housekeeping (unchanged): staged-leftover index state persists (root
> `background-img.jpg` + legacy `docs/logs/1640ba9e.log` mod) — commits
> pathspec-scoped; devops `-D` branch-cleanup list adds
> `feature/05423c53-tz12-12-font-scale-phone-widths` (12 branches total);
> owner refs stay untracked (now also `profile-design.png` +
> `profile-design-2.png` — appeared at the root, not yet an owner batch).

> **v3.21.1 ROUND NOTE (§39.4 amendment — native-loop swap, Concept §39.4 —
> appended by the process 2026-11-22, post-round three-gate run GREEN:
> lint clean · 991 tests total (49 api-client + 8 helper + 934 web, 52
> files; landing suite 73) · build 0 errors, dev `94a19ef`):**
> **The ping-pong video now plays via native loop** (task 128, worker
> `da60d572`; Option A per the recorded §39.4 amendment; design instance
> SKIPPED per the lean judgment — purely subtractive + asset swap; the
> worker wrote the dated DESIGN §4.27.1 owner-amendment record): the
> owner's pre-stitched yo-yo clip `background-video-loop.mp4`
> (3,058,088 bytes, forward+reverse) copied to
> `apps/web/src/lib/assets/landing/` and the superseded
> `background-video.mp4` DELETED — **the bundle emits only the new clip**
> (`background-video-loop.8oyblBBJ.mp4`, −1.3 MB vs the old file); the JS
> seek-stepper is GONE (`videoPingPong.ts` deleted + all hero wiring —
> net −124 lines in the hero); native `loop` RESTORED with the §34
> attribute set verbatim (`muted loop playsinline preload="metadata"
> disablepictureinpicture aria-hidden`), the gated one-shot mount
> `.play()` + swallowed rejection + error fallback + black bg + dissolve
> + dot mesh unchanged; §4.27.1 supersedes §4.27.E. Tests: new-asset
> emitted + old-absent negatives, `loop` present, videoPingPong-gone
> negatives, the 3 stepper tests dropped → landing 73, parity 55/55
> untouched. Everything else untouched per the §35–§39 contracts.
> Manual checks for the owner: the background video yo-yos seamlessly
> (forward→reverse→forward) on phone + desktop, reduced-motion static
> fallback, no console errors from playback.
> Housekeeping (unchanged): staged-leftover index state persists (root
> `background-img.jpg` + legacy `docs/logs/1640ba9e.log` mod) — commits
> pathspec-scoped; devops `-D` branch-cleanup list adds
> `feature/da60d572-tz12-11a-native-loop-swap` (11 branches total); owner
> refs (now incl. the root `background-video.mp4` AND
> `background-video-loop.mp4`) stay untracked.

> **v3.21 ROUND NOTE (§39 font bumps + compatibility circle + ping-pong
> video, Concept §39 — appended by the process 2026-11-22, post-round
> three-gate run GREEN: lint clean · 992 tests total (49 api-client + 8
> helper + 935 web, 52 files; landing suite 74) · build 0 errors, dev
> `6e9f0be`):**
> **Landing adjusted per ALL 4 §39 items** (task 127, worker `43e60f70`;
> design-first — design instance `bda82016` wrote DESIGN §4.27 after
> LOCATING the pattern source): (1) nav anchors 12 → **14px** (switcher
> untouched — explicit negative test); (2) one consistent description bump
> 13 → **15px** on `.step-desc`/`.privacy-desc`/`.stat-line`/
> `.agent-quote` (`.sub` + join input untouched); (3) **Section 4 center
> rework** — the 3-message chat window DELETED (4 orphaned keys removed,
> 55 keys/dict), replaced by the **compatibility circle reusing the /chats
> summary-sheet pattern verbatim**: imports `RING_RADIUS`/
> `ringCircumference`/`ringScoreOffset`/`TALLY_MS`/`tallyValue` from
> `#lib/chats/summary` (no duplicated constants — pattern-reuse test
> asserts the import; the shared `summary.js` chunk is now in the build),
> r66/160×160/stroke-12 ring, 25% ink track, 900ms ease-out ring-fill,
> `COMPAT_SCORE = 96`, Handjet 600 40px numeral, NO yellow (green stays on
> the badge), one-shot IntersectionObserver trigger (mount fallback;
> reduced-motion = static final); the ICE BROKEN badge relocated BELOW the
> circle; flanking avatars + status lines verbatim; (4) **video
> ping-pong** — the `loop` attribute REMOVED; pure seam
> `landing/videoPingPong.ts` (`stepTime` clamp+flip, unit-tested) + one
> rAF seek-stepper driving the paused element (wall-clock delta, 1×,
> direction state flips at 0/duration), idles until `loadedmetadata`,
> bails on error, cancels on unmount; reduced-motion = no play/no stepper
> (static fallback unchanged). RU invention carried: «Совместимость
> агентов: 96%» (design-invented aria — owner tone approval requested,
> §4.26.O.1 precedent). Keep: header glass recipe, transparent lead, all
> section structures, BLEAK/БЛИК, income surfaces, tokens.
> Manual checks for the owner: nav/description sizes in BOTH locales, the
> Section 4 compatibility circle count-up on scroll-into-view (matches the
> /chats summary ring), the badge below it, the video yo-yo reverse at the
> ends, reduced-motion statics.
> Housekeeping (unchanged): staged-leftover index state persists (root
> `background-img.jpg` + legacy `docs/logs/1640ba9e.log` mod) — commits
> pathspec-scoped; devops `-D` branch-cleanup list adds
> `feature/43e60f70-tz12-11-fonts-compat-pingpong` (10 branches total);
> owner refs stay untracked.

> **v3.20 ROUND NOTE (§38 glass-system polish + 4 new landing sections,
> Concept §38 — appended by the process 2026-11-22, post-round three-gate
> run GREEN: lint clean · 983 tests total (49 api-client + 8 helper + 926
> web, 52 files; landing suite 65) · build 0 errors, dev `b429e69`):**
> **Landing adjusted per ALL 7 §38 items** (task 126, worker `a729241a`;
> design-first — design instance `1a3d809d` wrote DESIGN §4.26 from the
> owner's verbatim values/copy): (1) **header** — detached floating glass
> pill: `fixed; top: 24px`, centered `width: 90% / max-width: 1200px`,
> `radius-md` 20px, `rgba(18,15,28,0.35)` + `blur(18px) saturate(180%)`,
> 1px `rgba(255,255,255,0.2)` border + `inset 0 1px 1px
> rgba(255,255,255,0.35)` (supersedes the §37 exact values + the §36 80%
> HEADER width — the content container keeps 80%, recorded as intended);
> nav → 4 smooth-scroll anchors HOW IT WORKS/PRIVACY/USE CASES/JOIN →
> `#how-it-works` (renamed from #tutorial) / `#privacy` / `#use-cases` /
> `#join`, `scroll-margin-top: 100px`, CSS smooth under
> `no-preference`; (2) **banner** — glass `rgba(20,18,30,0.55)` +
> `blur(12px)`, `[ LIVE NETWORK // IRL ]` sub-badge, glowing caption
> "AI Agents active nearby" + pulsing green dot (reduced-motion static);
> (3) **step cards** — glass `rgba(15,14,22,0.65)` + `blur(10px)`, hover
> purple glow + lift, 3 original pixel mini-illustrations (new
> `sectionArt.ts`: radar character / avatars+bubble / fist-bump+sparkles),
> the 3 EXACT micro-pills; (4) **footer** — glass pill
> `rgba(18,15,28,0.5)` + `blur(14px)` (pixel-frame box retired, content
> contract kept); (5) **four new sections** (shared recipe
> `rgba(18,15,28,0.45)` + `blur(16px)` + glossy white borders, all below
> the fold, open state intact): **#sim** live agent simulation (BLEAK 64px
> + "Status: Scanning..." blinking cursor, new 24×24 SCOUT figure +
> "Distance: 15m", opaque 3-row chat window + `[ ICE BROKEN — SAY HELLO ]`
> pulsing badge), **#privacy** 3-col (GHOST MODE / MUTUAL OPT-IN /
> EPHEMERAL GPS; ghost/padlock+key/shield+radar icons), **#use-cases** 4
> pills (CONFERENCES / PARTIES & BARS / COWORKINGS / FESTIVALS;
> badge/neon-glasses/laptop/headphones), **#join** final CTA (centered
> glass card, purple neon glow, new `BLEAK_WAVE_FIGURE` 36×32 —
> cyber-glasses + wave arm on the byte-identical BLEAK art; headline
> verbatim; dark glass input + **GET EARLY ACCESS mailto stub** →
> `mailto:extube@proton.me?subject=BLEAK%20EARLY%20ACCESS` + encoded body,
> no form/fetch/env/validation — swap-to-endpoint note recorded §4.26.I);
> (6) i18n **+35 keys → 58/dict** (EN verbatim from §38.5, RU per
> §4.26.L); (7) reduced-motion statics for all pulse/hover/glow; no new
> deps; raw-hex sweep stays green (the rgba glass family per the
> §4.25.D.7/§4.26.K.8 sanctioned exception).
> §4.26.O owner flags (advice): (1) **all 35 RU strings are design
> inventions** (the owner gave EN only) — tone approval requested; (2) the
> nav form «ВСТУПИТЬ»; (3) GET EARLY ACCESS button = the yellow accent
> (one-value flip to purple if preferred); (4) the stub record (no
> decision needed); (5) header-wider-than-content (90% vs 80%) is
> intended; (6) Section 4 has no nav anchor (by design).
> Manual checks for the owner: the landing on phone + desktop (detached
> glass header pill + the 4 anchor scrolls, banner sub-badge/caption/dot,
> step-card glass/hover/illustrations/pills, glass footer pill, the four
> new sections in BOTH locales, the JOIN mailto stub on desktop mail
> client, open state still lead+Bleak only, reduced-motion statics).
> Housekeeping (unchanged): staged-leftover index state persists (root
> `background-img.jpg` + legacy `docs/logs/1640ba9e.log` mod) — commits
> pathspec-scoped; devops `-D` branch-cleanup list adds
> `feature/a729241a-tz12-10-glass-sections` (9 branches total); owner refs
> stay untracked.

> **v3.19 ROUND NOTE (§37 owner correction — "Not, is not what I want":
> open state + transparent lead + true liquid-glass header, Concept §37 —
> appended by the process 2026-11-22, post-round three-gate run GREEN:
> lint clean · 967 tests total (49 api-client + 8 helper + 910 web, 52
> files; landing suite 52) · build 0 errors, dev `6263fb4`):**
> **Landing adjusted per ALL 3 §37 items** (task 125, worker `221c49f3`;
> design-first — design instance `2e68e6a5` wrote DESIGN §4.25; item 3
> carries the owner's EXACT css values verbatim): (1) **default open
> state** — header `position: fixed; top: 0` (video scrolls directly
> underneath; flow height zero), hero row `min-height: 100dvh` +
> `align-content/align-items: center` — desktop shows ONLY the lead
> (col 1) + BLEAK (col 3) vertically centered with the middle third empty;
> phone: `.area-lead` = the 100dvh first screen (Start block centered),
> BLEAK next in flow; stat/steps/footer below the fold (scroll-only); the
> §36 `calc(200dvh / 3)` spacer DELETED (negative AC); (2) **transparent
> borderless lead** — all pixel-frame classes dropped, transparent body,
> no border/fill/radius/shadow; legibility = token text-shadow halo on
> headline+sub (accent keeps its violet glow); Start pill unchanged →
> /income; supersedes §36 item 2 opaque+pixel-frame for this block; (3)
> **true liquid-glass header — the owner's exact values, verbatim**:
> `background: rgba(20, 20, 30, 0.25)`; `backdrop-filter: blur(16px)
> saturate(180%)` (+-webkit-); `border-top/bottom: 1px solid
> rgba(255, 255, 255, 0.15)` (sides none); `box-shadow: inset 0 1px 0
> rgba(255, 255, 255, 0.15)` inner highlight; rounding kept (radius-lg/md
> — owner silent); width `max(80%, 280px)` centered (breakout math
> retired); keep-list unchanged; the §4.24 two-tier 92/88% fill DELETED;
> `@supports not(...)` fallback `rgba(20, 20, 30, 0.85)`. i18n zero delta
> (23/23). Keep: fixed video layer + attrs/gating, dissolve + dots,
> thirds-with-empty-middle, BLEAK/БЛИК, step blocks, contact footer,
> income surfaces, RU/EN.
> **AA tradeoff recorded (§4.25.C — owner-order exception):** at 0.25 tint
> + blur, worst-case bright video frames put muted nav ≈1.1:1 / text
> ≈2.5:1 (FAIL); over the owner's near-black video ≥4.5:1 holds. The
> owner's exact values win; residual risk routed to the owner's real-
> device smoke — remedies (higher tint opacity / nav text treatment) need
> owner sign-off if smoke fails (§4.25.H flag 1). Smoke notes: the rounded
> top corners sit flush at `top: 0`; short viewports tuck content under
> the glass on scroll. §4.24.J statuses updated (1 resolved — clamp stands;
> 2 moot — 88% band replaced; 3 moot — spacer gone).
> Manual checks for the owner: the landing on phone + desktop (first
> viewport = ONLY lead + BLEAK vertically centered over the video, third
> thirds column empty, glass header with the exact blur/tint/border over
> the scrolling video, transparent borderless lead legible in BOTH
> locales, everything else below the fold), Start/TALK → /income,
> reduced-motion (static near-black + halo reads).
> Housekeeping (unchanged): staged-leftover index state persists (root
> `background-img.jpg` + legacy `docs/logs/1640ba9e.log` mod) — this round
> the worker committed code-only and the process's pathspec landing folded
> the doc amendments in (verified clean); devops `-D` branch-cleanup list
> adds `feature/221c49f3-tz12-09-open-state-glass` (8 branches total);
> owner refs stay untracked.

> **v3.18 ROUND NOTE (§36 80% widths + opaque narrower lead + thirds layout
> + phone open state, Concept §36 — appended by the process 2026-11-22,
> post-round three-gate run GREEN: lint clean · 966 tests total (49
> api-client + 8 helper + 909 web, 52 files; landing suite 51) · build 0
> errors, dev `b34465a`):**
> **Landing adjusted per ALL 4 §36 items** (task 124, worker `aef20dd9`;
> design-first — design instance `54ba0ec2` wrote DESIGN §4.24 amending
> §4.23): (1) **80% container + header** — one container rule `.landing {
> width: max(80%, 280px); margin-inline: auto }` (the 1000px canvas cap
> retired as a width rule; the 280px floor protects 320px phones), header
> spans the same 80% via the container breakout (negative-margin
> calc — no vw units); **blur VERIFIED applied and unoverridden** — the
> imperceptibility root cause was the 92% fill over the already near-black
> clip; fixed with the two-tier fill (92% `@supports`-fallback floor + 88%
> where the blur actually runs; blur-inclusive AA re-derived 5.2:1);
> (2) **opaque narrower lead** — solid `--color-surface` body, §4.20.G
> pixel-frame, SQUARE corners (the header is now the ONLY rounded
> surface), no translucency; fills its thirds column (≈288px @1280, was
> ≤560px); desktop headline `clamp(22px, 3.5vw, 44px)` (the §4.20.C 64px
> cannot hold a 288px third — flag below); (3) **thirds layout (desktop
> ≥720px)** — `repeat(3, 1fr)` grid: lead col 1 / BLEAK agent card col 3 /
> **col 2 EMPTY** (video + vignette + dots show through; negative AC: no
> col-2 element, no glass panel); the §4.23.D `1fr/360px` row + cap
> retired; (4) **phone open state** — `@media (max-width: 719.98px)
> { .canvas { padding-top: calc(200dvh / 3) } }` (dvh, URL-bar-safe; the
> owner's verbatim wording recorded in §36.4/§4.24.E) — the first content
> block starts below the two-thirds mark; the sticky glass chip floats
> over pure video; desktop no offset. i18n ZERO delta (23/23 parity, with
> the §4.23.F erratum recorded in §4.24.G). Keep-list, video layer +
> attrs/gating, dissolve, dot mesh, BLEAK/БЛИК, step blocks, contact
> footer, Start/TALK → /income, income surfaces — all untouched.
> §4.24.J owner flags (advice): (1) the desktop headline needed
> `clamp(22px, 3.5vw, 44px)` to survive the 288px third (alternative: a
> wider lead, contradicting the thirds reading); (2) the glass-visibility
> band landed at 88% — the owner may step to 85% on real-device smoke
> (≈5.05:1 blur-inclusive — the documented floor); (3) the phone first
> block lands slightly BELOW the exact 2/3 line (header + container
> padding inside the offset zone — satisfies the verbatim "no blocks in
> top 2/3"; pixel-exact placement deliberately not specced).
> Manual checks for the owner: the landing on phone + desktop (site
> "opens" on pure video for the first 2/3 of a phone viewport, 80%
> centered column, visible glass blur on the header, opaque pixel-frame
> lead in the left third, video showing through the empty middle third,
> BLEAK card right third, RU/EN over glass), Start/TALK → /income,
> reduced-motion.
> Housekeeping (unchanged): staged-leftover index state persists (root
> `background-img.jpg` + legacy `docs/logs/1640ba9e.log` mod) — the
> landing + docs commits pathspec-scoped (this round the worker also
> committed via an explicit 7-file pathspec — verified clean); devops
> `-D` branch-cleanup list adds
> `feature/aef20dd9-tz12-08-widths-thirds` (7 branches total); owner refs
> stay untracked.

> **v3.17 ROUND NOTE (§35 full-screen video background + liquid-glass header
> + reminders removed, Concept §35 — appended by the process 2026-11-22,
> post-round three-gate run GREEN: lint clean · 964 tests total (49
> api-client + 8 helper + 907 web, 52 files; landing suite 49) · build 0
> errors, dev `1100cab`):**
> **Landing adjusted per ALL 3 §35 items** (task 123, worker `9659161e`;
> design-first — design instance `1e2fd9c5` wrote DESIGN §4.23 amending
> §4.22; still no video tooling in the sandbox — defensive spec from the
> owner's text): (1) **fixed full-viewport video background** —
> `LandingVideoHero` repurposed in place as the first `.landing-page`
> child: z0 video `position: fixed; inset: 0`, cover (crops, never
> letterboxes), §34 attribute set verbatim (muted/loop/playsinline/
> preload="metadata"/disablepictureinpicture, one-shot mount .play() gated
> on prefers-reduced-motion); z1 dissolve vignette (ellipse 120%×105%,
> 55/78/100% stops) + 30% legibility wash into `--color-landing-bg`; z2
> the 12-dot purple mesh kept, ambient over the full viewport; z3 the
> content column scrolls OVER the video (desktop lead glass panel + 360px
> BLEAK card row; phone DOM-order stack); play/pause control RETIRED
> (ambient scenery — restorable, §4.23.I); error fallback unchanged (black
> tint + dots); (2) **liquid-glass header** — floating sticky chip (top
> 12px, insets 12px, canvas-aligned): `color-mix(--color-landing-bg 92%,
> transparent)` + `backdrop-filter: blur(14px) saturate(1.1)` (+-webkit-) +
> 22% Deepa hairline + ROUNDED corners (radius-lg 24px desktop / radius-md
> 20px phone — the only rounded surfaces, scoped to the glass); keep-list
> unchanged (icon + nav + switcher); AA floor ≈5:1 recorded; @supports
> near-solid fallback; (3) **agent reminders REMOVED entirely** —
> `LandingReminder.svelte` + its derivations/vars/z-rules deleted, 6 keys
> dropped from both dicts (live audit: the copy lived in
> `landing.dialog.line1/2/3` + `landing.video.aria/play/pause` — there was
> no `landing.reminder.*` family), grep-audited; i18n parity **23/23**.
> **Supersessions recorded (§4.23.E, 8 items):** §34 center-video-block
> geometry + phone no-overlay rule + §33 protected-scenario/art-block
> rules + §4.21.C/§4.22.C reminder contracts + the play control + the
> named video region all retired; the attribute set, gated mount, error
> fallback, dot mesh, header keep-list carried verbatim; §4.22.F vignette
> rationale amended (structural dissolve into the black token stays).
> Spec erratum disclosed: §4.23.F's "29 keys (35−6)" arithmetic predated
> the landed §4.22.1 chat-strip retirement (the live start was already 29);
> the 6-key removal intent was honored and lands at 23/23.
> §4.23.I owner flags (advice): (1) the play/pause control retired —
> restorable as one glass chip + 3 keys; (2) the glass LEAD panel is the
> design's legibility extension beyond the owner's header-only wording
> (raw muted text over an arbitrary bright video region cannot guarantee
> AA at any tolerable global tint; fallback = ~90% global tint so the
> video reads as faint texture); (3) the video's exact bg color remains
> unverifiable without tooling — the dissolve stays structural.
> Manual checks for the owner: the landing on phone + desktop (fixed video
> behind ALL scrolling content on both, glass header + glass lead panel
> legibility in BOTH locales, no reminders anywhere, black seamless edges,
> Start/TALK → /income), reduced-motion (static near-black, no playback),
> RU/EN switch over the glass.
> Housekeeping (unchanged): staged-leftover index state persists (root
> `background-img.jpg` + legacy `docs/logs/1640ba9e.log` mod) — pathspec-
> scoped commits again; devops `-D` branch-cleanup list adds
> `feature/9659161e-tz12-07-video-background` (6 branches total); owner
> refs stay untracked.

> **v3.16.1 ROUND NOTE (§34 owner amendment — chat-strip retirement, Concept
> §34 record — appended by the process 2026-11-22, post-round three-gate run
> GREEN: lint clean · 966 tests total (49 api-client + 8 helper + 909 web,
> 52 files; landing suite 51) · build 0 errors, dev `1b2256c`):**
> **The mascot-chat animation strip is REMOVED from the landing's center
> video block** (task 122, worker `18b096e1` — subtractive owner amendment:
> the video's own cast, the boy + robot inside the video, is the only
> animated center content). Deleted: `LandingChatStrip.svelte` +
> `chatTimeline.ts`, the `.area-chat` markup/grid CSS (`.stage` phone DOM
> order = lead → video block → agent card), the orphaned PIP/GLITCH figure
> data (`FigureName` narrowed to bleak/bloom), the 6 `landing.chat.*` keys
> from BOTH dicts (grep-audited; parity 29/29), and the strip test
> assertions (supersession AC added: files gone, no strip DOM/keyframes,
> negative render assertions). DESIGN §4.22.1 owner-amendment record added
> (supersedes §4.20.F + the §4.22.B strip-flow decision; resolves the §32
> mascot-chat requirement by owner order). Design instance SKIPPED per the
> lean judgment call (purely subtractive; the worker wrote the §4.22.1
> record). Everything else untouched: reminder contracts (bottom-fixed,
> 1:3.5, pixel font, emoji corner, bob, check), purple pixel treatment,
> Start/TALK → /income, header keep-list, BLEAK/БЛИК, step blocks, contact
> footer, black bg + dissolve; landing bundle shrank (~9 kB JS).
> Housekeeping (unchanged): staged-leftover index state persists (root
> `background-img.jpg` + legacy `docs/logs/1640ba9e.log` mod) — pathspec-
> scoped commits again; devops `-D` branch-cleanup list adds
> `feature/18b096e1-tz12-06a-chat-strip-removal` (5 branches total);
> owner refs stay untracked.

> **v3.16 ROUND NOTE (§34 video hero + header cleanup + Vector→Bleak,
> Concept §34 — appended by the process 2026-11-22, post-round three-gate
> run GREEN: lint clean · 966 tests total (49 api-client + 8 helper + 909
> web, 52 files) · build 0 errors, dev `1ada0cd`):**
> **Landing adjusted per ALL 6 §34 items** (task 121, worker `a4e2a3c6`;
> design-first — design instance `58b2d3f9` wrote DESIGN §4.22 amending
> §4.21; NO video-inspection tooling exists in the sandbox, so the spec is
> defensive from the owner's text): (1) header slimmed to web icon +
> desktop-only nav anchors + language switcher (all tagline lines, the
> GLITCH tagline glyph and the header START controls removed; `/income`
> entry points = exactly the lead CTA + card TALK); (2) hero common block
> = the VIDEO (`LandingVideoHero`, the owner's `background-video.mp4`
> copied to `apps/web/src/lib/assets/landing/background-video.mp4`,
> committed + build-emitted 4,355.62 kB), flanked left/right by the Start
> block (27%) and the BLEAK agent card (26%); (3) video full common-block
> width 16:9 cover; desktop = the side blocks OVERLAY the video (grid
> overlay, vertically centered on the video — implemented as grid
> row-span/align-center rather than §4.22.B's sketched absolute+top:50%,
> which collided with the chat strip; same visual, deviation disclosed);
> phone = NO overlay, video full-width then the exact §4.20.K stack; (4)
> Vector → **BLEAK / БЛИК** everywhere on the landing (i18n grounded in
> the live dict's existing «Блик» transliteration; grep-audit clean) AND
> the income mascot swap — `BleakMascot` re-pointed to the promoted shared
> personage (`personage/bleakFigure.ts`, byte-identical art): CodeEntry
> 96, RoomPreview 96, wizard intro 96 + steps 112, MessageBubble rows 28 —
> FormShell §30 / §23 / §24–§29 contracts green; (5) landing background =
> near-black via the derived token `--color-landing-bg` (5% Deepa over
> surface, scoped to `/`), vignette dissolve re-pointed (seamless with the
> video's near-black); (6) video attributes = `muted loop playsinline
> preload="metadata" disablepictureinpicture`, NO autoplay attr — playback
> via a one-shot mount effect gated on `prefers-reduced-motion` (paused
> under reduced motion), 48px pixel play/pause control only when paused
> (phone: lifted above the reminder band), `error` fallback = black tint +
> 12-dot purple mesh + reminder. **Supersessions recorded (§4.22.G):**
> `background.jpg` + `LandingHeroScene.svelte` DELETED, NOVA/ASTRA retired
> (the video's own boy+robot duo is the only hero cast — resolves the
> §4.21.J-1 flag), tagline keys retired; i18n parity 35/35 both dicts;
> reminder-box contracts (bottom-fixed, 1:3.5, bob, check) migrated into
> the video block verbatim; animated purple pixels kept over the video;
> mascot-chat strip below the video, right-aligned 280px.
> §4.22.K owner flags (advice): (1) header START controls removed per the
> owner's keep-list enumeration — restore is trivial if unintended; (2)
> the phone reminder covers a larger share of the short video — verbatim
> §33 geometry kept, one-token fix available; (3) the video's exact bg
> color is unverifiable without tooling — seamlessness is structural
> (vignette → token), mix ratio is a one-line tweak; (4) RU brand form =
> «Блик» (Latin "BLEAK" is a one-value change if preferred).
> Manual checks for the owner: the landing on phone + desktop (header
> slim, video playback/mute/loop + play-pause control, side overlays vs
> phone stack, BLEAK card, reminder geometry/bob/check, black seamless
> bg, RU/EN), Start/TALK → /income with the 6-digit input + the Bleak
> personage on the entry/room-intro/wizard surfaces, reduced-motion
> rendering.
> Housekeeping: the staged-leftover index state persists (untracked root
> `background-img.jpg` + 2-line legacy `docs/logs/1640ba9e.log` mod) —
> landing + docs commits were again pathspec-scoped (verified clean);
> devops `-D` branch-cleanup list: `feature/c1dc2bb0-tz12-03-landing-redesign`,
> `feature/c28f1e56-tz12-04-landing-rebuild`,
> `feature/dc61864e-tz12-05-landing-adjustments`,
> `feature/a4e2a3c6-tz12-06-video-hero`; owner refs (`real-design.png`,
> `landing-design-example.png`, root `background-img.jpg`,
> `background-video.mp4`) stay untracked.

> **v3.15 ROUND NOTE (§33 landing adjustments — owner photo review, Concept
> §33 — appended by the process 2026-11-22, post-round three-gate run GREEN:
> lint clean · 958 tests total (49 api-client + 8 helper + 901 web, 52
> files; landing suite 45) · build 0 errors, dev `01196b6`):**
> **Landing adjusted per ALL 7 §33 items** (task 120, worker `dc61864e`;
> design-first — design instance `bbe7aacb` wrote DESIGN §4.21 amending
> §4.20, grounded in `real-design.png` + `background-img.jpg`): (1) hero
> right figure = **ASTRA** — NOVA's copy with white hair + small purple
> horns (shared 16×31 body table; BYTE + handshake-node/beam retired); (2)
> **reminder box** (`LandingReminder`) — pixel (Handjet) centered text,
> 1:3.5 strip fixed at the art block's bottom (bottom 16px, min()-capped
> widths, top edge ≥81% of block height — no overlays left/right/top),
> 24px pixel emoji at the left-top corner, 24/20px pixel check mark with
> pulsing glow, 3s ease-in-out up-down bob (−6/−10px, reduced-motion
> static); (3) stat card padding minimized (12×14/16×20); (4) layout
> reorganized — desktop: header / lead+art+agent+chat section
> (`27% 1fr 26%`) / stat + steps + contact footer; **phone order
> unchanged**; footer = site contacts (extube@proton.me /
> github.com/extube, RU/EN); (5) Find/Chat/Share = three BIG blocks
> (01/02/03 pixel number + pixel title + icon + one-line description;
> desktop row, phone stack); (6) "every connection matters" + "start now"
> blocks REMOVED (keys deleted both dicts); (7) art block taller
> (500/680px) on the committed app asset
> `apps/web/src/lib/assets/landing/background.jpg` (#lib URL import,
> cover) with radial-vignette dissolve into `--color-bg` (no hard edge),
> protected central-scenario rects, animated purple pixels kept;
> mascot-chat strip re-placed under the agent card (§32 animation
> preserved); i18n 38 keys parity; entry points = Start CTA + agent TALK
> → /income.
> §4.21.J owner flags (advice): (1) the small SVG pair flanks the image's
> own boy+robot cast (outside the protected rects) — owner may prefer the
> image duo as the only cast (one-line layer removal); (2) invented names/
> descriptions (ASTRA, step descriptions) — tone/naming ratification
> welcome; (3) contact footer = extube@proton.me / github.com/extube per
> the owner's suggestion — confirm before treating as published.
> Worker-disclosed deviations: footer hover uses `--color-deepa-4` (not
> `--color-accent` — the yellow accent is unusable on the landing, per the
> ratified §4.20 deviation); §4.21.B's conservative protected rect grazes
> the flanking pair's outer ~2% at the real desktop column — the drawn
> boy+robot sit at x≈38–62%, central scene untouched.
> Manual checks for the owner: the landing vs `real-design.png` intent on
> phone + desktop (hero pair, reminder box geometry/bob/check, 3 big step
> blocks, contact footer, removed blocks gone, taller art block with the
> background image + smooth edge in BOTH locales), Start/TALK → /income,
> reduced-motion rendering.
> Housekeeping: index carries STAGED-LEFTOVER state from a worker's
> transient `git add -A` (untracked root `background-img.jpg` + a 2-line
> legacy `docs/logs/1640ba9e.log` mod) — the landing + docs commits were
> pathspec-scoped to exclude them; needs a devops `git restore --staged`
> (or equivalent) cleanup; branches `feature/c1dc2bb0-tz12-03-landing-redesign`,
> `feature/c28f1e56-tz12-04-landing-rebuild`,
> `feature/dc61864e-tz12-05-landing-adjustments` await `git branch -D`
> (squash-landing `-d` refusal, devops); owner refs (`real-design.png`,
> `landing-design-example.png`, root `background-img.jpg`) stay untracked.

> **v3.14 ROUND NOTE (§32 landing REBUILD from zero, Concept §32 — appended by
> the process 2026-11-22, post-round three-gate run GREEN: lint clean · 941
> tests total (49 api-client + 8 helper + 884 web, 52 files) · build 0 errors,
> dev `d2cbf6f`):**
> **Landing rebuilt from zero at `/`** (task 119, worker `c28f1e56`;
> design-first per the owner addition — design instance `3d00ca94` wrote
> DESIGN §4.20 from the owner's example `landing-design-example.png` before
> the build): near-black canvas + purple accent/glow (token-only;
> `--color-accent` mapped to the violet `--color-deepa-4` — the yellow accent
> token cannot give the example's purple bloom; white-on-violet CTAs pass
> AA 5.4:1), Handjet taglines + working RU/EN switch, 3-line headline with
> the glowing accent word (EN "YOU" / RU «ВАС»), NOVA-meets-BYTE hero scene
> (glowing handshake node + beam + network mesh), retro dialogue-box (3
> cycling asterisk lines + blinking caret), PIP↔GLITCH mascot-chat animation
> (4 pixel speech bubbles, typewriter 55ms/char, infinite loop, reduced-motion
> static), stat card (BLOOM) + VECTOR agent card (single TALK → /income),
> 3-step tutorial FIND→CHAT→SHARE (search → chatting → contacts sharing),
> positioning footer + START-NOW badge — six distinct original mascots, no
> background plates; mobile-first stacking, ≥720px 3-col grid; 35 `landing.*`
> i18n keys in both dicts; routes `/income` + `/income/[room]/create`
> untouched; 28 tests in `landing-page.test.ts` (incl. desktop + mobile
> viewport + RU/EN parity).
> DESIGN §4.20.O owner flags (advice): (1) the example's PASS button dropped —
> single TALK CTA (a decorative no-op would fake behavior); (2) cast names +
> copy are the design's invention (adapt-don't-copy) — owner ratification
> welcome.
> Manual checks for the owner: the landing on phone + desktop vs
> `landing-design-example.png` (mood/structure), the mascot-chat loop in both
> locales, Start/TALK/badge → /income with the 6-digit input, reduced-motion
> rendering.
> Housekeeping (dead-relay round): task 118 (worker `c1dc2bb0` — no output,
> unresumable session) superseded by task 119; branches
> `feature/c1dc2bb0-tz12-03-landing-redesign` + `feature/c28f1e56-tz12-04-landing-rebuild`
> await `git branch -D` cleanup (squash-landing artifact, devops);
> `landing-design-example.png` stays untracked at the repo root (local-only
> visual reference, per the docs/refs policy).

> **v3.14 ROUND NOTE (tz12-02 landing page + route re-homing, Concept §31 —
> appended by the process 2026-11-21, post-round three-gate run GREEN: lint
> clean · 870 tests total (49 api-client + 8 helper + 813 web, 52 files) ·
> build 0 errors, dev `12bb11b`):**
> (1) **Landing page at `/`** (task 117, worker `07e82628`): pixel mascots
> (BleakMascot reuse, no background), the AI-networking positioning story,
> labelled nav (section anchors + /host), Start → /income, the 3-step
> tutorial (search → chatting → contacts sharing); mobile-first, tokens
> only, RU/EN via the FormShell-style header switcher; 14 tests in
> `landing-page.test.ts`.
> (2) **Route re-homing:** `/income` = the room-income (entry) page (the
> previous `/` join surface moved verbatim — resume card, §2.8 notice,
> deep-link handshake, JoinFlow entry steps); `/income/[room]/create` =
> the creation process (the same JoinFlow seeded into the persona step
> via the `roomParam` prop, the invite code rides `?code=`; Room intro's
> Create-profile navigates there; wizard back returns to
> `/income?code=…`). Deep links (`?code=`/`?u=…`) forwarded from the
> landing to `/income`; the layout `isJoin` covers `/` + `/income*`
> (no tab bar on all three pre-room routes); nav links (guard
> defaultRedirect, global 401 gate, profile leave, ShareKit invite links)
> re-pointed from `/` to `/income`. No form-behavior changes;
> `creation-wizard.test.ts`/`join-machine.test.ts` needed zero changes.
> Manual checks for the owner: the landing on phone + desktop (mascots,
> tutorial figures, RU/EN switch), Start → /income with the 6-digit input,
> a persona-QR deep link round-trip, the create-profile path through
> /income/[room]/create.

> **v3.9/§23 ROUND NOTE (tz11-01/02 + §23 design-review batch + the
> fade-every-boundary extension — appended by the process 2026-11-20,
> post-round three-gate run GREEN: lint clean · 865 tests total
> (49 api-client + 8 helper + 808 web, 50 files) · build 0 errors, dev
> `e28bb62`):**
> (1) **Bleak mascot de-plated** (§23.1.1, task 102): the pixel figure sits
> directly on the page; mounted mascot-at-top on the enter-code form, the
> room form (`RoomPreview` create-profile/join choice) and the wizard intro
> (§23.1.2–3, verified).
> (2) **§23.2 wizard amendments folded** (task 101 follow-up, commit
> `7f3eeda` on dev — ratified): iOS-Messages send button + counters (no send
> on input taps), "Next" removed (fixed bottom input rising with the
> keyboard, scrollable chat, centered back below the input), example
> placeholders per input case, nickname field with `tg:@/signal:@/inst:@`
> prefixes, **themes model** (8 themes × 6 dedicated topics, slug titles
> `theme:topic_key` mapped onto the numeric server contract), interests
> creation-only (InterestsEditor deleted from settings), multi-theme loop
> returning to the badges step until "Ready", arcade-sheet loading
> animation, **fade transitions at EVERY creation boundary** (§23.2.5.9
> extended: form → intro → chat steps → loading → /room, one 200ms opacity
> treatment, leaving fade with the reduced-motion goto guard), intro bubble
> un-plated.
> **Incident disclosed:** the fold-in commit landed directly on dev (worker
> dev-commit — the process left the checkout on dev mid-handover window);
> content ratified (803/50 green pre-commit), branch copy tree-identical.
> Manual checks for the owner: the mascot un-plated on all surfaces, the
> mascot-at-top order, the wizard end-to-end (send button/counter/
> placeholders/prefixes/themes loop/Ready/loading animation/fades on a real
> invite, the leaving fade into /room).

> **v3.10 ROUND NOTE (§23 design-review amendments — tz11-01a mascot fixes +
> the tz11-02 fold, appended by the process 2026-11-20, post-round three-gate
> run GREEN: lint clean · 805 web tests, 50 files · build 0 errors, dev
> `48e3172`):**
> (1) **Mascot de-plated** (§23.1.1, task 102): BleakMascot's backdrop fill +
> §4.8.2-style frame removed — the pixel figure sits directly on the page
> (idle blink and token fills unchanged).
> (2) **Mascot-at-top ordering** (§23.1.2–3, task 102): mascot → title →
> content on the enter-code form AND the room-form surface (found in
> `RoomPreview.svelte` — the create-profile/join choice step); the wizard
> intro verified already mascot-at-top (task 102 report, item 4).
> (3) **§23.2 wizard amendments folded** (task 101 follow-up, commit
> `7f3eeda` on dev — ratified): iOS-Messages send button + counters (no send
> on input taps), "Next" removed (fixed bottom input that rises with the
> keyboard, scrollable chat, centered back below the input), example
> placeholders per input case, nickname field with `tg:@/signal:@/inst:@`
> prefixes, **themes model** (8 themes × 6 dedicated topics, slug titles
> `theme:topic_key` mapped onto the numeric server contract), interests
> creation-only (InterestsEditor deleted from settings), multi-theme loop
> returning to the badges step until "Ready", arcade-sheet loading
> animation, fade transitions, intro bubble un-plated.
> **Incident disclosed:** the fold-in commit landed directly on dev (worker
> dev-commit — the process left the checkout on dev mid-handover window);
> content ratified (803/50 green pre-commit), branch copy tree-identical.
> Manual checks for the owner: the mascot un-plated on all surfaces, the
> mascot-at-top order, the wizard end-to-end (send button/counter/
> placeholders/prefixes/themes loop/Ready/loading animation/fades).

> **v3.9 ROUND NOTE (tz11-01 + tz11-02, lean protocol — appended by the process
> 2026-11-20, post-round three-gate run GREEN: lint clean · 858 tests total
> (49 api-client + 8 helper + 801 web, 50 files) · build 0 errors, dev
> `925e913`):** §22.3 delivered — (1) **Bleak mascot** (`BleakMascot.svelte`,
> tz11-01, task 100): reusable 12×12 chunky pixel-art ghost (token fills,
> 2-frame steps() blink idle, decorative/label props, reduced-motion via the
> base.css catch-all, §4.8.2-style backdrop-frame padding) mounted on the
> enter-invite-code form between the subtitle and the digit cells (§12 phone
> contract intact); contracts in `mascot.test.ts` (6/6). (2) **Step-by-step
> creation wizard** (`CreationWizard.svelte` + `WizardBubble.svelte` +
> the `WIZARD_STEPS` machine in `lib/join.ts`, tz11-02, task 101, P1):
> intro → name → auto-chat interview (public bio → private bio → contact
> type/value → group/items multi-select) → creating-your-profile loading
> step; chat-styled (WizardBubble rows, mascot as the interviewer), smooth
> transitions, RU/EN parity (22 `join.wizard.*` keys); `createPersona` body
> UNCHANGED (name/bios/invite_code/token — no contact/interests keys on the
> wire, machine-test-pinned); interests QUEUED during the interview and
> flushed post-2xx via one bulk `addUserInterests` (failure never undoes the
> creation); contact persisted locally post-2xx (§14.1.3); `PersonaForm`
> deleted (replaced); import/return flows untouched. Tests: 15 wizard
> machine/surface tests + updated join-machine/join-flow. Manual checks for
> the owner: the wizard end-to-end on a real invite (all steps, skip/back
> paths, the loading step), mascot placement on phone full-screen.

Worker instance `95489390` · 2026-11-20 · branch
`feature/95489390-tz10-03-verify-v38` (base = dev tip `88633c6` — the landing of
`feature/794a26e9-tz10-02-chats-common-block`; both §10 landings — tz10-01 time
sort `3a2b4ef` and tz10-02 common block `88633c6` — are in `dev` before this
sweep, see the commit map below). This sweep verifies the **Concept §19
addendum** (sheet §19.1 as CANCELLED by the owner reversal, people page
§19.2+§19.3 **including the folded §19.3 tap-form addendum**), the **folded
§15.5/§15.6 owner additions** (sheet hue restore + name-caption removal /
Great-match title / X-close per-hue ink — DESIGN §4.15.4–§4.15.6), the
**Concept §20 addendum** (single time sort, score cache retired — DESIGN
§4.15.7) and the **Concept §21 addendum** (common block + thin dividers +
dimmed content — DESIGN §4.15.8) are delivered on `dev` — **completing the
§8–§21 verification record** (§13 = `docs/verification-v3.md`, §14 = `-v31.md`,
§15 = `-v32.md`, §16 = `-v33.md`, §17 = `-v34.md`, §18 = `-v35.md`, §19 =
`-v36.md`, §20 = `-v37.md`). No product code and no test files — one-shot
source reads and targeted spot-check runs recorded here, per the
verification-only constraint of the card.

Method legend: **S** = source inspection / landed-code read in this sweep,
**T** = merged automated test (file — title), **R** = targeted spot-run
executed first-hand in this session.

Landing commits of the verified scope (dev log, all pre-sweep): tz9-01 sheet
`e9edcad`, tz9-02 people-rework `5975efa`, tz9-03 sheet-hue `d68b72d`,
good-tier-pull-refix `23a4e94`, the v3.6 sweep `e145953`, §19.3 tap-form
`dfab56d` (the §19 state — carried forward, re-verified first-hand below),
tz10-01 **time sort** `3a2b4ef` (task 97, worker `913d1694` — the §20 scope)
and tz10-02 **common block** `88633c6` (task 98, worker `794a26e9` — the §21
scope, the NEW items this sweep verifies first-hand).

Spec-source note (recorded, factual): at sweep time the §19–§21 spec text
still lives in the shared checkout's **uncommitted working-copy edits** of
`docs/Concept.md` (§13–§21) and `docs/DESIGN.md` (§4.13–§4.15.8) — the
process's pending doc landing; `dev` HEAD's Concept.md still ends at §12.
`dev` HEAD carries the full §19–§21 **product** state (every source/test file
read below is committed at `88633c6`). The sweep reads the owner amendments
from that working copy and verifies the product tree, not the docs.

---

## 1. Gate record (TZ §8.8 discipline — full gates are delta-wave-CI's job)

| Check | Result | Source |
| --- | --- | --- |
| Full `make test` re-run by this sweep | **not run** (the process runs the delta-wave CI after this landing) | this session |
| Owning worker's local gates — task 98 (tz10-02, the §21 landing) | **green**: targeted chats-page 31 · full `make test` 840 · `make lint` green · `make build` green (0 errors, 9 pre-existing warnings elsewhere) | `docs/sessions/794a26e9.md` report (landed in `88633c6`) |
| Owning worker's gates — task 97 (tz10-01, the §20 landing) | **authoritative CI green**: MR #97 `merged` `ci=green` (process wave CI on `dev`); the task-97 session report itself was left empty (status still `running` in `docs/sessions/913d1694.md`) — the landing's gates are recorded by the MR CI record | `scripts/task.py show 97` (MR #97), session file read |
| Task 98 MR record | **green**: MR #98 `merged` `ci=green` | `scripts/task.py show 98` |
| Targeted spot-runs (first-hand, this session) | **green — 199 tests / 7 web files + 49 api-client**: chats-page 29 + chats-view 25 + summary-sheet 62 + people-page 24 + people-view 18 + i18n 34 + tabbar 7 = 199/199; api-client client.test.ts 49/49 (the match/matchV2/hardMatch endpoint-mapping block) | `npm run test -w @bleak/web -- <files>`, `npm run test -w @bleak/api-client -- tests/client.test.ts` (§4) |
| Owning tasks of the verified items | tasks 88 + 90 + 91 + 93 + 95 (§19 base) + **97** (§20) + **98** (§21) all landed into `dev` (dev tip `88633c6` at sweep time; 89 + 92 superseded per the v3.6 record) | dev log / task list |

No test was added or modified by this sweep. No product code touched.

DELTA-WAVE CI: [pending — process fills]

---

## 2. Per-item checklist — Concept §19 (as amended/cancelled) + §20 + §21 (DESIGN §4.15.4–§4.15.8)

### Item 1 — SHEET STATE (§19.1 as CANCELLED + the folded §15.6 owner additions / §4.15.4.1 + §4.15.6) — PASS

All checks against `apps/web/src/lib/components/SummarySheet.svelte` +
`apps/web/tests/summary-sheet.test.ts` (landed state — unchanged since the
v3.7 sweep verified it at `dfab56d`; re-verified first-hand on dev).

| Check | Result | Evidence |
| --- | --- | --- |
| §19.1 CANCELLED: converging animation by-spec in ALL tiers — no no-pull contract remains | PASS S/T | the landed doc-comment states the reversal verbatim (SummarySheet.svelte:58-59 — "across ALL tiers per the owner reversal 2026-11-20, Concept §19.1 — the §4.15.4.1 no-pull restriction is CANCELLED"); the behavioral no-pull test is GONE (summary-sheet.test.ts:892-894 — "§4.15.4.1 GOOD no-pull test REMOVED — the owner CANCELLED the no-pull …"); the landed animations sit inside the now-free surface (GREAT `avatar-approach`/`avatar-approach-left` :846-859; GOOD nod/wave :882/:894) |
| Name captions REMOVED both tiers; `chat.summary.me` retired | PASS S/T | the `.who` rule set is gone — only the removal comment remains (SummarySheet.svelte:777); no `chat.summary.me` key in either dictionary — the removal is recorded in the i18n comments (en.ts:167, ru.ts:167) and pinned by the retired-key/`.who`-free rendered tests (`summary-sheet.test.ts:717-733` — `querySelectorAll('.who')` length 0 in both tiers; `:221` element-level) |
| GREAT-match title in the COMMON ink — RU «Отличное совпадение», near the ring | PASS S/T | the `.tier-label` sits directly under the score ring (SummarySheet.svelte:486; CSS :833-838 `color: var(--sheet-ink)`); verbatim copy pinned (`summary-sheet.test.ts:787-794` — RU «Отличное совпадение» / EN "Great match"; i18n index en/ru.ts:170/169); the special-color override removed (`:809` — `.tier-label.great` absent from the source) |
| X close per-hue ink + scrim chip visible on every hue incl. yellow | PASS S/T | `.close` reads the per-hue ink over a subtle ink chip (SummarySheet.svelte:696-713 — `color: var(--sheet-ink)`, `background: color-mix(in srgb, var(--sheet-ink) 12%, transparent)`, 48px target, press scale + ink focus ring); test `summary-sheet.test.ts:650-670` (§4.15.6.3 — `not.toContain('var(--sheet-yellow)')`, the chip + focus contracts, all five `.deepa-<n>` ink pairings; the yellow hue's dark surface ink pinned `:419-423`) |

### Item 2 — PEOPLE PAGE (§19.2 + §19.3 incl. the §19.3 TAP-FORM ADDENDUM / §4.15.4.2 + §4.15.4.3) — PASS

All checks against `apps/web/src/lib/people/view.ts`,
`apps/web/src/routes/people/+page.svelte`,
`apps/web/src/lib/components/people/PersonCard.svelte` +
`apps/web/tests/people-view.test.ts`, `tests/people-page.test.ts`
(`tests/i18n.test.ts` for the copy). The §19 state is unchanged since the
v3.7 sweep (`dfab56d` was the last people-scope landing) — re-verified
first-hand on dev.

| Check | Result | Evidence |
| --- | --- | --- |
| No filter chips; deterministic 4-bucket sort | PASS S/T | the page renders only the search pill (+ reset) — no chip row (people/+page.svelte:5 doc comment "no filter chips"; markup read); `relationshipBucket` maps the four buckets (view.ts:25 — "incoming (who added you) …" §4.15.4.2) and `sortedPeople` orders bucket-first with the roster tie-break (view.ts:49-51); tests `people-page.test.ts:269` (bucket order end-to-end) + `people-view.test.ts:92-141` (comparator contracts) |
| Right icon removed (+ direct-send «+» kept for state none) | PASS S/T | the chat-open/handshake-form toggle icon is REMOVED — the only remaining right-edge icon is the direct «+» send scoped to `none` (PersonCard.svelte, v3.6 doc comments + markup; component contract `people-page.test.ts:186`, flow `:316-351`) |
| Auto-open handshake-back for the FIRST added-you user only | PASS S/T | one-shot mount effect (`autoOpenDone` flag, +page.svelte:170-178) opens the first sorted card when incoming; never re-opened after dismissal; tests `people-page.test.ts:353-413` (auto-open / ONLY-first / not-incoming / dismiss-never-reopens) |
| 'handshake!' / «Привет!» + 'Open chat' button (badge removed) | PASS S/T | `people.action.back` = EN `handshake!` / RU «Привет!» and `people.action.open_chat` = RU «Открыть чат» / EN "Open chat" (en.ts:121-122, ru.ts:121-122 — §4.15.4.3 comments :118); the chatting badge is gone, state `chat` renders the `.open-chat` pill (PersonCard.svelte; rendered in the auto-open test `people-page.test.ts:353`) |
| NEW — tapping any added-you item opens the Handshake!/Dismiss form for THAT user | PASS S/T | the incoming row IS the tap target (`role="button"` + `aria-expanded` + `ontoggle`); the route wires `ontoggle={() => toggleIncoming(user.address)}` per card (+page.svelte:299) and `toggleIncoming` opens the form for that user only (guards: non-incoming / dismissed return early, +page.svelte:216-220); tests `people-page.test.ts:211` (component: role=button + aria-expanded + ontoggle; non-incoming inert) and the addendum suite `:428-514` (tap opens ITS form — «Привет!» + dismissal side by side; dismissal stays local-only, never re-opens) |
| NEW — single-expanded move/collapse | PASS S/T | ONE `expandedAddress` state drives the list (+page.svelte:51; the toggle is `expandedAddress === address ? null : address` :220) — opening another added-you card MOVES the form, tapping the expanded card collapses it; test `people-page.test.ts:429` (move + collapse) |

### Item 3 — TIME SORT (§20 / §4.15.7, task 97 `3a2b4ef`) — PASS

All checks against `apps/web/src/lib/chats/view.ts`,
`apps/web/src/routes/chats/+page.svelte` +
`apps/web/tests/chats-view.test.ts`, `tests/chats-page.test.ts`.

| Check | Result | Evidence |
| --- | --- | --- |
| Single time sort, newest first — supersedes the score-first ordering | PASS S/T | `stableChats` is a pure `created_at`-descending comparator with address dedupe (view.ts:43-49; doc comment :36-42 pins Concept §20 / DESIGN §4.15.7 and the supersession of §4.13.4); the route feeds the cards through it (+page.svelte:118-131); unit test `chats-view.test.ts:96-111` ("newest created_at first, deduped by address" + the done/active-scrambled single-sort test — finished chats do NOT float first) |
| Finished and unfinished sort TOGETHER by the same comparator | PASS S/T | `chats-page.test.ts:745-763` (§4.15.7 block: a 2-finished + 2-unfinished fixture orders 0xu2 → 0xf2 → 0xf1 → 0xu1 — pure created_at DESCENDING across the done/active split); in-place poll update test `:778` (a newer chat takes the top without a reload) |
| Score cache RETIRED: orderByMatchScore gone; matchScores store + fetch wiring + tests removed | PASS S | `orderByMatchScore` — zero matches in the tree; `apps/web/src/lib/stores/matchScores.ts` — file REMOVED; `apps/web/tests/match-scores.test.ts` — file REMOVED; the chats page's match/v2 fetch wiring is out (the §4.15.7 doc comment records the retirement, +page.svelte:21-25); test `chats-page.test.ts:765-776` ("no score-fetch wiring: match/v2 is never called from the list (the store is retired)" — mock asserts `matchV2` never called across poll ticks) |
| match / match-v2 / hardMatch API methods STAY (summary sheet consumes them) | PASS S/T/R | `packages/api-client/src/client.ts:463-527` — `match` (POST /api/match), `matchV2` (POST /api/match/v2), `hardMatch` (POST /api/hard-match) all present with their v3 doc comments; endpoint-mapping tests inside `packages/api-client/tests/client.test.ts` (the v3 block, incl. :560-616) — all 49 tests green in the spot-run (§4) |
| Unfinished styling / dot / preview / hue coding UNAFFECTED | PASS S/T | ChatCard keeps the §4.13.4 dimmed treatment + circle loader, the §4.15.2.2 finished-only dot (14px, Deepa hue), the §4.11.6 preview line and the §4.12.2 neutral-surface/avatar coding (ChatCard.svelte:54-77 doc comments + markup/CSS; tests `chats-page.test.ts:259-409`, `:494-642` — all green) |

### Item 4 — COMMON BLOCK + DIVIDERS + DIMMED CONTENT (§21 / §4.15.8, task 98 `88633c6`) — PASS

All checks against `apps/web/src/routes/chats/+page.svelte`,
`apps/web/src/lib/components/chats/ChatCard.svelte` +
`apps/web/tests/chats-page.test.ts:645-732` (the §4.15.8 describe).

| Check | Result | Evidence |
| --- | --- | --- |
| ONE `--color-surface` block behind the list | PASS S/T | the list container itself carries the surface: `ul.cards.common-block` with `background: var(--color-surface)` (+page.svelte:174 markup, :219-229 CSS — token only, no raw hex; `gap: 0` so the dividers carry the rhythm, plus edge padding); the per-item card is transparent (ChatCard.svelte:209-216 — "the items share ONE COMMON BACKGROUND BLOCK … the item itself is transparent"); tests `chats-page.test.ts:649-664` (the container contract + the skeleton list is NOT a common block) |
| Thin dividers in `--color-bg`, centered, ≤95% width | PASS S/T | `.divider` = `width: 95%; height: 1px; margin-inline: auto; margin-block: var(--space-2); background: var(--color-bg)` (ChatCard.svelte:191-203 — token, no raw hex); source contracts pinned by `chats-page.test.ts:666-685` (bg token, 1px, 95%, centered, aria-hidden decoration) |
| n−1 dividers for n items (rides the item markup) | PASS S/T | the route sets `divider={index > 0}` on every ChatCard after the first (+page.svelte:182) — the divider spans ABOVE its item inside the `.chat-item` (ChatCard.svelte:136-141); tests `chats-page.test.ts:670-676` (2 items → exactly 1 divider; the first item has none) and `:687-709` (the `divider` prop renders only when asked) |
| Unfinished = DIMMED CONTENT (name/preview/time reduced opacity; spinner stays; NO per-item panel); finished = full emphasis | PASS S/T | the owner amendment (Concept §21, in-progress items) is landed: `.chat-card .main.dimmed-content { opacity: 0.6 }` on the CONTENT wrapper only (ChatCard.svelte:220-229 — "NOT an opacity panel behind the item … the card itself is transparent"), the card background stays `transparent` (:212), the loader stays (outside the wrapper, :175-176); `dimmed-content` renders only when `state === 'active'` (:151) — finished items get full emphasis + the dot; tests `chats-page.test.ts:595-642` (unfinished → class + loader / finished → none; the 0.6 CSS contract; token discipline) and the page-level mixed-fixture test `:712-731` |
| Per-item styling unchanged; ≥720px grid divergence (recorded design decision) | PASS S | dot/loader/preview/hue CSS untouched (ChatCard.svelte:230-322); on the ≥720px multi-column grid the items are spatially separated by the grid gap and the divider is hidden there (ChatCard.svelte:199-203; +page.svelte:246-255) — a documented single-column rule: the §21 block/dividers apply to the phone-width chats box, the desktop grid keeps its own separation |

### Item 5 — REGRESSIONS (all prior chats/people/sheet contracts) — PASS

| Check | Result | Evidence |
| --- | --- | --- |
| All prior chats contracts green on top of the §20+§21 landings | PASS T/R | chats-page (29) + chats-view (25) suites green in the spot-runs (§4) — the §3.4/§4.11.5-7/§4.12.2/§4.13.2/§4.13.4/§4.15.2.2/§4.15.3.2 contracts (cards, previews, dot↔spinner, badge, poller, states) hold; the time sort and the common block extended, not replaced, the v3.5-era blocks |
| All prior people contracts green | PASS T/R | people-view (18) + people-page (24) suites green — search, poll diffing, dismissal rule, income state, bucket order, the tap-form addendum all hold |
| All prior sheet contracts green | PASS T/R | summary-sheet (62) green — the §15/§16/§17/§18/§19 contracts (checklist choreography, slide embed + palette, layout pins, lazy fetch, dot size, loading rework, hue restore) hold |
| Copy + tab-bar anchors green | PASS T/R | i18n (34) + tabbar (7) suites green — RU/EN parity incl. the v3.6/v3.7 key blocks (`people.action.back`/`open_chat`, `chat.summary.tier.great`) and the retired-key lists (chips, right-icon copy, `chat.summary.me`); the tab bar contract unaffected |
| api-client endpoint surface intact | PASS T/R | api-client `client.test.ts` 49/49 green — the v3 endpoint mapping (interests / match / match-v2 / hard-match / contacts) unchanged by the chats landings |

---

## 3. Known findings (recorded, NOT fixed — verification-only constraint)

**Verdict: items 1–5 — PASS, 0 FAIL.** No product defect found; no fix-up
performed. Recorded notes:

1. **Trivial (comment-only, new — stale lineage references to the retired
   matchScores store):** `apps/web/src/lib/api/client.ts:392` ("fetched from
   the matchScores session cache's refresh cadence"),
   `apps/web/src/lib/stores/summaryCache.ts:6+10` ("mirrors the matchScores
   cache pattern"),
   `apps/web/tests/summary-cache.test.ts:8-9` ("the same cache semantics as
   the matchScores store"),
   `apps/web/src/routes/chats/[address]/+page.svelte:24+423` ("like the
   lastMessage/matchScores cadence pattern") — all reference
   `stores/matchScores.ts`, which tz10-01 removed. The code is correct; only
   the prose pointers are stale. Cosmetic; left untouched per the constraint.
2. **Trivial (comment-only, new):** `apps/web/src/lib/chats/view.ts:150-151`
   still says "tz5-05 keys the list ordering off `chatStatus`" — since §20
   (`stableChats`, time sort) the list ordering no longer keys off
   `chatStatus` at all. The code is correct; the lineage prose is stale.
   Cosmetic; left untouched per the constraint.
3. **Factual note (desktop divergence, recorded design decision — not a
   defect):** the §21 common block/dividers are a single-column rule; on the
   ≥720px grid the list re-enables the grid gap and hides the dividers
   (+page.svelte:246-255, ChatCard.svelte:199-203, both documented in-code).
   Worth a device/desktop look in the carried-forward manual checks.
4. **Factual note (gate-record bookkeeping, not a product defect):** the
   task-97 (tz10-01) session file was closed with an empty report
   (`docs/sessions/913d1694.md` — status still `running`, report blank), so
   its local per-worker gate numbers are unrecorded; its authoritative green
   is the process wave CI (MR #97 `ci=green`). Also, the task-98 session
   report cites "targeted chats-page 31 passed" while the landed
   `tests/chats-page.test.ts` carries 29 tests (all green in this sweep) —
   a counting discrepancy in the prose record only.
5. **Factual note (docs landing state, not a product defect):** the §19–§21
   spec text itself (Concept §13–§21, DESIGN §4.13–§4.15.8) is at sweep time
   an uncommitted working-copy edit in the shared checkout (the process's
   pending doc landing) — `dev` HEAD's Concept.md ends at §12. The verified
   §19–§21 **product** state is fully committed at dev tip `88633c6`; the
   delta-wave CI on `dev` (§1 placeholder) is the authoritative record.

The standing trivial notes from earlier sweeps remain open, unchanged
(`docs/verification-v35.md` §3 and `docs/verification-v37.md` §3: the GREAT
beam lineage comments; the ChatCard "retired marks" lineage comments; the
inert §15-era `--slide-height` slot + stale comments in the sheet slide
scope; the stale room-page duration comments; the ShareContactSlide
doc-comment's stale opening sentence; the people-page auto-open comment's
off-by-one bucket index at `apps/web/src/routes/people/+page.svelte:166`).

---

## 4. Spot-run record (first-hand, this session)

```
npm run test -w @bleak/web -- tests/chats-page.test.ts tests/chats-view.test.ts
  → Test Files 2 passed (2) · Tests 54 passed (54)    (17:35:09Z, 30.34 s)

npm run test -w @bleak/web -- tests/summary-sheet.test.ts tests/people-page.test.ts
  tests/people-view.test.ts tests/i18n.test.ts tests/tabbar.test.ts
  → Test Files 5 passed (5) · Tests 145 passed (145)  (17:35:44Z, 14.64 s)

npm run test -w @bleak/web -- tests/chats-page.test.ts
  → Test Files 1 passed (1) · Tests 29 passed (29)    (17:36:53Z, 30.07 s)

npm run test -w @bleak/web -- tests/chats-view.test.ts
  → Test Files 1 passed (1) · Tests 25 passed (25)    (17:37:27Z, 1.45 s)

npm run test -w @bleak/api-client -- tests/client.test.ts
  → Test Files 1 passed (1) · Tests 49 passed (49)    (17:37:51Z, 0.55 s)
```

All card-anchored suites green: the §4.15.7 time-sort + no-score-wiring
contracts and the §4.15.8 common-block/divider/dimmed-content contracts in
chats-view and chats-page; the §4.15.4.1/§4.15.6 sheet contracts (no-pull
removal, caption removal, Great-match title, per-hue X close) in
summary-sheet; the §4.15.4.2/§4.15.4.3 bucket-sort, item-rework and tap-form
contracts in people-view and people-page; the copy parity in i18n; the tab
bar regression anchor; the api-client match/match-v2/hardMatch surface
(the §20 "methods stay" clause). No full `make test` by this sweep — the
process runs the delta-wave CI on `dev` after this landing (§1 placeholder).

---

## 5. Carried-forward manual checks (owner, real device)

The automated suites pin the logic; these need a real phone/API:

**New for v3.8:**

1. **The common block + dividers look on device:** on a phone-width room
   with several chats the list reads as ONE surface block with thin
   page-background-colored dividers between items (each divider centered
   and ≤95% of the box width; none before the first item). Check the block's
   edge padding feel and that the dividers read on the dark background.
2. **The dimmed-content rendering on a real unfinished chat:** an
   in-progress chat shows name/preview/time at reduced opacity (0.6) INSIDE
   the shared block — the block background itself stays untouched (no
   per-item panel) and the small circle spinner keeps spinning; a finished
   chat renders at full emphasis with its hue dot; check both side by side
   in one list.
3. **The time order with mixed finished/unfinished items:** in a room with
   both finished and in-progress chats, the list is a single newest-first
   time order — a finished chat must NOT float above a newer unfinished one;
   a newer chat created after page load takes the top on the next poll
   without a reload.
4. **The common block on desktop (≥720px):** the grid re-enables spacing and
   hides the dividers there (recorded design decision, finding 3) — confirm
   the desktop list still reads well as designed.

**Carried forward (standing arcade-sheet/on-device items — full notes in
`docs/verification-v32.md` §5 through `docs/verification-v37.md` §5 and
earlier):**
the tap-form flow end-to-end on a REAL added-you item (auto-open first card,
tap-open second, move/collapse, inert non-added-you, local dismissal);
the arcade-sheet end-to-end on a real finished chat (spring-bounce rise,
cascade stagger, tally + clockwise ring, tier animations across all three
tiers — hue-driven per chat and caption-free; the GREAT tier's converging
animations now by-spec everywhere after the owner reversal; Great-match
title in the common ink; the X close legible on every Deepa hue incl.
yellow; checklist pop-flash-draw, completion confetti + victory jumps +
copy swap, re-open replays nothing);
the per-hue sheet legibility on device (dark ink on green/yellow/orange/
cyan, light ink on violet); slide v2 feel on touch AND mouse (85% snap vs
spring-back, wrapping fill, marquee seam); sheet scroll with a long summary
text (pinned top bar/stage, pinned bottom slide); slide / Summarization-
button bottom alignment on device; Summarization button states on device;
Press Start 2P RU headers on device; the lazy summary flow end-to-end
(loading dots → content swap, no double POST); the people-page sort order
end-to-end on a real mixed room (who added you → untouched → chatting →
sent); the bigger finished-dot legibility on device; and the earlier
standing items — RU date/time ICU, Deepa violet legibility, radar feel
after the §13 tuning, summary-sheet freshness (no re-summarize), contacts
tab dot flow, join digit-row/full-screen forms, the on-device scanner smoke
(HTTPS secure-context gate, iOS Safari + Android Chrome decode path, camera
light off on close), PWA install, venue Wi-Fi polling, host-console flows,
return-to-event round-trip.

---

*Verification-only sweep by worker `95489390` (task 99, tz10-03) — no product
code, no test files; the delta-wave CI record above is filled by the process
after the merge.*
