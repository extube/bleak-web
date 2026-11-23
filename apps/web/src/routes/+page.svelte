<script lang="ts">
  /**
   * `/` — the landing page (tz12-12, Concept §40 owner batch + the §39
   * follow-up, DESIGN §4.28 amending §4.27 item by item):
   *
   * - Canvas: the §4.22.F page background stays — `--color-landing-bg`
   *   painted full-bleed by the page wrapper; §4.24.A: ONE container rule
   *   — §4.28.F: on PHONE `.landing` shares the header's EXACT width
   *   expression `max(90%, 280px)` (the blocks' edges align with the
   *   header's edges; the phone inline padding is dropped) and desktop
   *   (≥720px) keeps the 80% column / 90% header split (§4.26.O.5).
   * - §4.23.A fixed background: `LandingVideoHero` stays the FIRST child
   *   of `.landing-page` — a fixed full-viewport video layer (z 0) +
   *   dissolve vignette + 30% tint (z 1) + the 12-dot purple mesh (z 2);
   *   ALL landing blocks scroll OVER it as overlays.
   * - Header (§4.26.A — the owner's EXACT §38.1 values verbatim,
   *   superseding §4.25.C): the DETACHED floating glass pill —
   *   `position: fixed; top: 24px`, centered `width: max(90%, 280px)`
   *   (the §4.28.F shared floor; `max-width: 1200px` + centering stand),
   *   `border-radius: var(--radius-md)` (20px),
   *   `rgba(18, 15, 28, 0.35)` + `backdrop-filter: blur(18px)
   *   saturate(180%)`, full 1px `rgba(255, 255, 255, 0.2)` border + the
   *   inset white highlight; the no-backdrop fallback is
   *   `rgba(18, 15, 28, 0.85)`. Keep-list UNCHANGED (§4.22.A).
   *   The nav anchors are FOUR smooth-scroll links (§4.26.K.3): HOW IT
   *   WORKS → #how-it-works (the step cards; the `tutorial` id is
   *   renamed), PRIVACY → #privacy, USE CASES → #use-cases, JOIN →
   *   #join (`#agents` stays as an id with no nav link); CSS smooth
   *   scroll under `prefers-reduced-motion: no-preference`.
   * - Open state (§4.25.A — §37.1 CARRIES, §4.26.J; re-scoped by
   *   §4.32.A/Concept §45): at ≥960px ONLY the lead (Start block) and the
   *   BLEAK agent card are visible, VERTICALLY CENTERED in the first
   *   viewport; below 960px the lead ALONE owns the first viewport
   *   (centered) and the BLEAK card sits BELOW THE FOLD, reached by
   *   scrolling; everything else flows AFTER the hero region — below the
   *   fold, revealed on scroll.
   * - Lead section (§4.25.B): TRANSPARENT and borderless — unchanged.
   * - Banner (§4.26.B — the stat card amended in place): the
   *   pixel-framed card goes liquid glass (`rgba(20, 18, 30, 0.55)` +
   *   blur 12px), the `[ LIVE NETWORK // IRL ]` pixel sub-badge above
   *   the title, and the glowing `AI Agents active nearby` caption with
   *   a pulsing green pixel dot next to the BLOOM glyph. §4.30.F: on
   *   PHONE the glyph block (icon + caption) stacks ON TOP of the text
   *   (a left-aligned column); desktop keeps the compact row.
   * - Step cards (§4.26.C as superseded by §4.30.E): the §38 glass
   *   rgba(15,14,22,0.65)+blur(10px) is RETIRED — the body fill is the
   *   BLEAK agent card's SAME opaque surface (`var(--color-surface)`),
   *   hover purple glow + slight lift (reduced motion: instant glow, no
   *   lift), a decorative pixel mini-illustration top-right per card
   *   (§4.3 art in `landing/sectionArt.ts`) and the bottom micro-pills
   *   (§4.26.L exact strings).
   * - §4.30 (Concept §42, 2026-11-23) — the scroll-animation batch: the
   *   below-fold blocks reveal on scroll (the shared utility
   *   `landing/reveal.ts` + the base.css armed state, one-shot, 60ms
   *   sibling stagger; the lead + BLEAK pair animates ON LOAD —
   *   §4.30.B), the agent card is capped at 240px on desktop (§4.30.C)
   *   and every icon below the first screen grows +50% (§4.30.D:
   *   flower 66/72, dot 9, step icons 48/72, step art 72, privacy 72,
   *   use-cases 60, sim avatars 96 — the first-viewport pair UNCHANGED).
   * - §4.32 (Concept §45, 2026-11-23) — the hero breakpoint/width/
   *   headline batch: <960px the lead ALONE owns the first viewport (the
   *   `.area-lead` 100dvh region; the BLEAK card below the fold —
   *   §4.32.A), the 240px desktop cap is DELETED and the card fills its
   *   1fr track (symmetric `calc(10% + 48px)` edges — §4.32.B), and the
   *   desktop headline grows to clamp(32px, 4.5vw, 64px) (§4.32.C).
   * - Footer (§4.26.D): the dark liquid-glass pill — the pixel-frame
   *   construction is retired from it; content contract verbatim.
   * - The FOUR new sections (§4.26.E–I, after the steps, before the
   *   footer): sim (#sim, no nav link) → privacy (#privacy) →
   *   use-cases (#use-cases) → join (#join) — the shared glass recipe
   *   (`rgba(18, 15, 28, 0.45)` + blur 16px + the white border +
   *   inset highlight + radius-md), the SCOUT + BLEAK-WAVE figures, the
   *   compatibility circle (§4.27.C/§4.27.D — the summary-sheet ring
   *   pattern reused, the chat window removed) and the GET EARLY ACCESS
   *   mailto stub (§4.26.I-2: a plain `<a>` — no form, no fetch, no
   *   validation; the stub swaps to a button + handler when a real
   *   endpoint lands).
   * - Reminders REMOVED (§4.23.C) — stays removed.
   * - Behavior (§4.20.L + §4.22.A): the /income entry points are
   *   EXACTLY TWO — the Start CTA and the agent-card TALK; nothing on /
   *   fetches; the join deep links still forward to /income.
   * - RU/EN parity: 55 landing keys (§4.27.G — 58 − 4 orphaned sim chat
   *   keys + 1 ring aria key); the header switch re-renders the page
   *   without a reload.
   */
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { page } from '$app/state';
  import { locale, translate } from '#lib/i18n/locale';
  import LocaleControl from '#lib/components/join/LocaleControl.svelte';
  import PixelIcon from '#lib/components/icons/PixelIcon.svelte';
  import LandingVideoHero from '#lib/components/landing/LandingVideoHero.svelte';
  import LandingFigure from '#lib/components/landing/LandingFigure.svelte';
  /* §4.30.A — the shared scroll-reveal system (Concept §42 item 1): one
   * utility, ONE IntersectionObserver, one-shot per unit, wired ONCE for
   * the whole page below (no dependency — IO is native). */
  import { setupReveals } from '#lib/components/landing/reveal';
  /* §4.27.D — the compatibility circle is the /chats summary-sheet
   * indicator pattern REUSED, not re-derived: the ring geometry and the
   * arcade tally come from lib/chats/summary.ts by IMPORT (no local
   * radius 66, no local 700ms constant, no re-derived dash math). */
  import {
    RING_RADIUS,
    ringCircumference,
    ringScoreOffset,
    TALLY_MS,
    tallyValue
  } from '#lib/chats/summary';
  import {
    STEP_ART,
    PRIVACY_ICONS,
    USECASE_ICONS,
    type StepArtName,
    type PrivacyIconName,
    type UsecaseIconName
  } from '#lib/components/landing/sectionArt';

  // Deep-link forwarding: any recognized join query param rides along to
  // the entry page (the landing itself never consumes join state).
  $effect(() => {
    const params = page.url.searchParams;
    if (params.get('code') !== null || params.get('u') !== null) {
      // eslint-disable-next-line svelte/no-navigation-without-resolve
      void goto(`${resolve('/income')}${page.url.search}`, { replaceState: true });
    }
  });

  function start(): void {
    void goto(resolve('/income'));
  }

  function talk(): void {
    void goto(resolve('/income'));
  }

  /* The §4.21.E step blocks (content contract §4.26.C verbatim): number/
   * title/icon/description unchanged; each card adds its decorative
   * mini-illustration (STEP_ART) and the §4.26.L bottom micro-pill. */
  const tutorialSteps = $derived([
    {
      num: '01',
      icon: 'search',
      art: 'find' as StepArtName,
      label: translate($locale, 'landing.tutorial.search'),
      desc: translate($locale, 'landing.steps.find.desc'),
      pill: translate($locale, 'landing.steps.find.pill')
    },
    {
      num: '02',
      icon: 'dialog-lines',
      art: 'chat' as StepArtName,
      label: translate($locale, 'landing.tutorial.chat'),
      desc: translate($locale, 'landing.steps.chat.desc'),
      pill: translate($locale, 'landing.steps.chat.pill')
    },
    {
      num: '03',
      icon: 'contact-share',
      art: 'share' as StepArtName,
      label: translate($locale, 'landing.tutorial.share'),
      desc: translate($locale, 'landing.steps.share.desc'),
      pill: translate($locale, 'landing.steps.share.pill')
    }
  ] as const);

  /* §4.26.G privacy cards: title + desc keys + the 16×16 icon data. */
  const privacyCards = $derived([
    {
      icon: 'ghost' as PrivacyIconName,
      title: translate($locale, 'landing.privacy.ghost.title'),
      desc: translate($locale, 'landing.privacy.ghost.desc')
    },
    {
      icon: 'mutual' as PrivacyIconName,
      title: translate($locale, 'landing.privacy.mutual.title'),
      desc: translate($locale, 'landing.privacy.mutual.desc')
    },
    {
      icon: 'gps' as PrivacyIconName,
      title: translate($locale, 'landing.privacy.gps.title'),
      desc: translate($locale, 'landing.privacy.gps.desc')
    }
  ] as const);

  /* §4.26.H use-case pills: label keys + the 16×16 icon data. */
  const usecasePills = $derived([
    { icon: 'conferences' as UsecaseIconName, label: translate($locale, 'landing.usecases.conferences') },
    { icon: 'parties' as UsecaseIconName, label: translate($locale, 'landing.usecases.parties') },
    { icon: 'coworkings' as UsecaseIconName, label: translate($locale, 'landing.usecases.coworkings') },
    { icon: 'festivals' as UsecaseIconName, label: translate($locale, 'landing.usecases.festivals') }
  ] as const);

  /* §4.26.I-2: the GET EARLY ACCESS frontend stub — a plain `<a>` whose
   * href is derived from the input: the bare mailto (subject only) when
   * the input is empty, subject + URL-encoded body when it is not. No
   * form element, no fetch, no env, NO validation (type="text" +
   * inputmode="email" passes @telegram handles straight through). When a
   * real endpoint lands the anchor becomes a <button> + one fetch
   * handler — everything else stays. */
  const MAILTO_SUBJECT = 'mailto:extube@proton.me?subject=BLEAK%20EARLY%20ACCESS';
  let joinValue = $state('');
  const joinHref = $derived(
    joinValue.length > 0
      ? `${MAILTO_SUBJECT}&body=${encodeURIComponent(joinValue)}`
      : MAILTO_SUBJECT
  );

  /* §4.21.G: the kept copyright line splits into the Handjet brand name +
   * the Inter muted year (the contact block's row 1). */
  const copyright = $derived(translate($locale, 'landing.footer.copyright'));
  const copyrightBrand = $derived(copyright.split(' · ')[0] ?? '');
  const copyrightYear = $derived(copyright.split(' · ')[1] ?? '');

  /* --- §4.30.A/B THE SCROLL-REVEAL WIRING (Concept §42 item 1) ------------
   * One mount effect, one utility call for the WHOLE page (the root div
   * below): the utility arms every `[data-reveal]` scroll unit + the
   * `[data-reveal-load]` hero pair, watches the units with ONE shared
   * IntersectionObserver and returns the teardown (the observer's
   * disconnect + the pending cleanups — no leak across HMR/tests). */
  let revealRoot = $state<HTMLElement | null>(null);

  $effect(() => {
    if (!revealRoot) return;
    return setupReveals(revealRoot);
  });

  /* --- §4.27.D THE COMPATIBILITY CIRCLE (Section 4 center) ----------------
   * The /chats summary-sheet score-ring pattern, reused: the geometry and
   * the tally timing are IMPORTED from #lib/chats/summary (no duplicated
   * constants). The value is a constant, not a Summary — the 96 from the
   * retired §4.26.F msg2 becomes the display value; the numeral renders
   * the count-up integer followed by a literal `%`. The arc + numeral stay
   * the landing text ink (--color-text) — no yellow (the green stays on
   * the badge below). */
  const COMPAT_SCORE = 96;

  /** The ring's full circumference — the dasharray + the fill's from-value. */
  const RING_C = ringCircumference();

  /** The arc's final dashoffset — the 96% fill (ringScoreOffset). */
  const RING_TARGET = ringScoreOffset(COMPAT_SCORE);

  const compatAria = $derived(translate($locale, 'landing.sim.compat.aria'));

  /** The arcade tally's live integer (0 → 96), the sheet's tally port. */
  let tally = $state(0);

  /** One-shot start flag: the first scroll-into-view flips it. */
  let compatStarted = $state(false);

  /** The ring element — the IntersectionObserver's observe target. */
  let compatRingEl = $state<SVGSVGElement | null>(null);

  /** The §4.27.D reduced-motion guard (the explicit matchMedia check —
   * the base.css catch-all only intercepts CSS). */
  function reducedMotion(): boolean {
    return (
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
  }

  /**
   * §4.27.D start trigger — one-shot scroll-into-view: on mount an
   * IntersectionObserver (threshold 0.4) watches the ring; the FIRST
   * intersection flips `compatStarted` and disconnects; the tally effect
   * runs off `compatStarted` exactly like the sheet's runs off `open`.
   * Fallback: no IntersectionObserver (old browsers/test DOM) → started
   * flips immediately on mount. Reduced motion needs no observer — the
   * static final state renders from the start.
   */
  $effect(() => {
    if (reducedMotion()) {
      tally = COMPAT_SCORE;
      return;
    }
    if (!compatStarted) {
      if (typeof IntersectionObserver !== 'function') {
        compatStarted = true;
        return;
      }
      const el = compatRingEl;
      if (!el) return;
      const observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) {
            compatStarted = true;
            observer.disconnect();
          }
        },
        { threshold: 0.4 }
      );
      observer.observe(el);
      return () => observer.disconnect();
    }
    /* The tally count-up — the SummarySheet $effect ported verbatim:
     * one-shot rAF loop 0 → COMPAT_SCORE over TALLY_MS, integer steps via
     * tallyValue (cubic ease-out), landing EXACTLY on 96. */
    tally = 0;
    if (typeof requestAnimationFrame !== 'function') {
      tally = COMPAT_SCORE;
      return;
    }
    let raf = 0;
    const start = performance.now();
    const step = (now: number): void => {
      tally = tallyValue(now - start, COMPAT_SCORE);
      if (tally < COMPAT_SCORE && now - start < TALLY_MS) {
        raf = requestAnimationFrame(step);
      } else {
        tally = COMPAT_SCORE; // land EXACTLY on the final integer
      }
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  });
</script>

<!-- §4.22.F: the full-bleed landing page background — --color-landing-bg
     (scoped to /; every other page keeps --color-bg); §4.24.A: the single
     80%-width content container is centered inside. -->
<div class="landing-page" bind:this={revealRoot}>
  <!-- §4.23.A: the fixed full-viewport video background — the FIRST child
       of .landing-page, before .landing; the page content scrolls over it. -->
  <LandingVideoHero />
  <div class="landing">
    <!-- SECTION 1 — HEADER (§4.26.A — the owner's EXACT §38.1 values
         verbatim, superseding §4.25.C): the DETACHED floating liquid-glass
         pill — position: fixed at top: 24px (out of the flow; the video
         scrolls through the 24px gap above it and directly underneath),
         rgba(18, 15, 28, 0.35) + backdrop blur(18px) saturate(180%), the
         FULL glossy 1px rgba(255, 255, 255, 0.2) border + the inset white
         highlight, radius-md (20px) at every width, viewport-sized
         width: 90% / max-width: 1200px centered. Keep-list (§4.22.A
         verbatim): the web icon + the navigation + the language switcher
         ONLY; on phone icon + switcher. The anchors are the FOUR
         smooth-scroll links (§4.26.K.3). -->
    <header class="top">
      <!-- the §30 FormShell app mark, plate-less; the cutout cells are the
           landing page background token so the mark dissolves into the new
           black page (§4.22.A; token fills, no hex). -->
      <svg
        class="app-icon"
        viewBox="0 0 64 64"
        width="40"
        height="40"
        shape-rendering="crispEdges"
        aria-hidden="true"
      >
        <g fill="var(--color-deepa-4)">
          <rect x="16" y="14" width="32" height="8" />
          <rect x="12" y="22" width="40" height="16" />
          <rect x="16" y="38" width="32" height="8" />
        </g>
        <g fill="var(--color-landing-bg)">
          <rect x="20" y="26" width="8" height="8" />
          <rect x="36" y="26" width="8" height="8" />
          <rect x="28" y="30" width="8" height="4" />
        </g>
      </svg>
      <!-- desktop-only smooth-scroll anchors (§4.26.A): HOW IT WORKS /
           PRIVACY / USE CASES / JOIN — the old #tutorial/#agents links
           are SUPERSEDED (§4.26.K.3). -->
      <div class="top-nav">
        <a href="#how-it-works">{translate($locale, 'landing.nav.how')}</a>
        <a href="#privacy">{translate($locale, 'landing.nav.privacy')}</a>
        <a href="#use-cases">{translate($locale, 'landing.nav.usecases')}</a>
        <a href="#join">{translate($locale, 'landing.nav.join')}</a>
      </div>
      <div class="locale"><LocaleControl /></div>
    </header>

    <main class="canvas">
      <!-- §4.25.A as amended by §4.31.A/B: the hero region — .stage IS the
           100dvh hero at EVERY width (the 100dvh + centering live on
           .stage): ≥960px it is the two-column grid (lead 1.2fr, BLEAK
           1fr, side by side); <960px it is ONE CENTERED COLUMN — the lead
           centered with the BLEAK card stacked below it. -->
      <div class="stage">
        <!-- the lead — HEADLINE BLOCK + START CTA (§4.20.C verbatim),
             TRANSPARENT and BORDERLESS (§4.25.B — §37.2): NO pixel frame,
             NO panel, NO border — the copy sits directly over the video
             background; legibility = the token-only text halo. -->
        <section class="copy area-lead" data-reveal-load>
          <div class="copy-body">
            <h1 class="headline">
              <span class="hl-line">{translate($locale, 'landing.headline.1')}</span>
              <span class="hl-line">{translate($locale, 'landing.headline.2')}</span>
              <span class="hl-line accent-line">
                <span class="accent-word">
                  {translate($locale, 'landing.headline.accent')}
                  <svg
                    class="sparkle spark-a"
                    viewBox="0 0 8 8"
                    aria-hidden="true"
                    shape-rendering="crispEdges"
                    fill="var(--color-deepa-4)"
                  >
                    <rect x="3" y="0" width="2" height="8" />
                    <rect x="0" y="3" width="8" height="2" />
                  </svg>
                  <svg
                    class="sparkle spark-b"
                    viewBox="0 0 8 8"
                    aria-hidden="true"
                    shape-rendering="crispEdges"
                    fill="var(--color-deepa-4)"
                  >
                    <rect x="3" y="0" width="2" height="8" />
                    <rect x="0" y="3" width="8" height="2" />
                  </svg>
                </span>
              </span>
            </h1>
            <p class="sub">{translate($locale, 'landing.sub')}</p>
            <button type="button" class="cta-main" onclick={start}>
              {translate($locale, 'landing.cta')}
            </button>
          </div>
        </section>

        <!-- the agent — AGENT CHARACTER CARD (§4.20.G-b, renamed
             BLEAK per §4.22.D) — pixel frame, opaque surface, NO glass,
             floating over the video. §4.32.A: the BARE data-reveal
             scroll marker — the card is the reveal system's 13th scroll
             unit (§4.30.A): at <960 it reveals when the user scrolls it
             into view (below the fold); at ≥960 its IO fires at the
             scroll origin — net the same on-open fade+rise. -->
        <section class="area-agents" id="agents" data-reveal>
          <article class="card pixel-corners pixel-frame pixel-frame--strong agent-card">
            <div class="card-body pixel-corners agent-body">
              <div class="agent-portrait">
                <LandingFigure kind="bleak" size={96} idle={false} />
              </div>
              <h2 class="agent-name">{translate($locale, 'landing.agent.name')}</h2>
              <span class="agent-badge">{translate($locale, 'landing.agent.badge')}</span>
              <p class="agent-traits">{translate($locale, 'landing.agent.traits')}</p>
              <p class="agent-quote">{translate($locale, 'landing.agent.quote')}</p>
              <button type="button" class="talk" onclick={talk}>
                {translate($locale, 'landing.agent.cta')}
              </button>
            </div>
          </article>
        </section>
      </div>

      <!-- BANNER (§4.26.B — the §4.20.G-a/§4.21.F stat card amended IN
           PLACE): the pixel-frame construction is KEPT over the glass —
           only the body fill becomes liquid glass; the [ LIVE NETWORK //
           IRL ] pixel sub-badge renders above the title and the glowing
           AI Agents active nearby caption + pulsing green pixel dot
           joins the BLOOM glyph. -->
      <section class="area-stat" data-reveal>
        <article class="card pixel-corners pixel-frame pixel-frame--strong stat-card">
          <div class="card-body pixel-corners stat-body">
            <div class="stat-copy">
              <span class="stat-badge pixel-corners">
                <span class="pixel-corners">{translate($locale, 'landing.banner.badge')}</span>
              </span>
              <h2 class="stat-title">{translate($locale, 'landing.stat.title')}</h2>
              <p class="stat-line">{translate($locale, 'landing.stat.line1')}</p>
              <p class="stat-line">{translate($locale, 'landing.stat.line2')}</p>
              <p class="stat-line">{translate($locale, 'landing.stat.line3')}</p>
            </div>
            <div class="stat-glyph">
              <LandingFigure kind="bloom" size={72} />
              <span class="stat-status">
                <span class="status-dot" aria-hidden="true"></span>
                {translate($locale, 'landing.banner.status')}
              </span>
            </div>
          </div>
        </article>
      </section>

      <!-- the three BIG step blocks (§4.21.E as amended by §4.26.C and
           §4.31.C): FIND → CHAT → SHARE — the agent card's dark surface,
           hover glow/lift, a decorative pixel mini-illustration top-right
           and the bottom micro-pill; the section id RENAMED tutorial →
           how-it-works (§4.26.K.3, the HOW IT WORKS anchor target).
           §4.31.C: all three cards carry the UNIFIED frame — plain
           `pixel-frame` (the subtle --color-surface-elevated ring; the
           bright `--strong` ring retires for these cards only — the
           agent + banner cards keep it) and the body FILLS the card
           (height: 100%) so the stretched grid can never expose the
           frame fill as a white bottom block. -->
      <section class="tutorial area-tutorial" id="how-it-works">
        <ol class="steps">
          {#each tutorialSteps as step (step.icon)}
            <li class="step-block pixel-corners pixel-frame" data-reveal>
              <div class="step-body pixel-corners">
                <svg
                  class="step-art"
                  viewBox="0 0 {STEP_ART[step.art].viewW} {STEP_ART[step.art].viewH}"
                  aria-hidden="true"
                  shape-rendering="crispEdges"
                >
                  {#each STEP_ART[step.art].parts as part, pi (pi)}
                    <g
                      fill={part.fill}
                      style={part.glow
                        ? 'filter: drop-shadow(0 0 6px color-mix(in srgb, var(--color-deepa-4) 60%, transparent))'
                        : undefined}
                    >
                      {#each part.rects as rect, ri (ri)}
                        <rect x={rect[0]} y={rect[1]} width={rect[2]} height={rect[3]} />
                      {/each}
                    </g>
                  {/each}
                </svg>
                <span class="step-num" aria-hidden="true">{step.num}</span>
                <h3 class="step-title">{step.label}</h3>
                <span class="step-icon">
                  <PixelIcon name={step.icon} size={48} />
                </span>
                <p class="step-desc">{step.desc}</p>
                <span class="step-pill">{step.pill}</span>
              </div>
            </li>
          {/each}
        </ol>
      </section>

      <!-- SECTION 4 — LIVE AGENT SIMULATION (§4.26.F as amended by
           §4.27.C–D): id="sim" — no nav anchor targets it (§4.26.O.6). One
           wide glass container: the BLEAK personage (purple glow) + YOUR
           AGENT / Status: Scanning... with the blinking pixel cursor on the
           left, the NEW SCOUT figure (cyan glow) + NEARBY AGENT /
           Distance: 15m on the right, and the COMPATIBILITY CIRCLE in the
           center — the /chats summary-sheet ring pattern reused (the 96%
           count-up + arc fill) — with the glowing green ICE BROKEN badge
           BELOW it. The §4.26.F 3-message chat window is REMOVED. -->
      <section class="area-sim" id="sim" data-reveal>
        <article class="sim-card">
          <h2 class="section-title">{translate($locale, 'landing.sim.title')}</h2>
          <div class="sim-grid">
            <div class="sim-agent sim-you">
              <span class="sim-portrait sim-portrait--you">
                <LandingFigure kind="bleak" size={96} idle={false} />
              </span>
              <span class="sim-agent-name">{translate($locale, 'landing.sim.you')}</span>
              <span class="sim-status sim-status--you">
                {translate($locale, 'landing.sim.you.status')}
                <span class="sim-cursor" aria-hidden="true"></span>
              </span>
            </div>
            <div class="sim-agent sim-nearby">
              <span class="sim-portrait sim-portrait--nearby">
                <LandingFigure kind="scout" size={96} idle={false} />
              </span>
              <span class="sim-agent-name">{translate($locale, 'landing.sim.nearby')}</span>
              <span class="sim-status sim-status--nearby">
                {translate($locale, 'landing.sim.nearby.status')}
              </span>
            </div>
            <!-- the center column (§4.27.C): EXACTLY two children — the
                 compatibility ring on top, the ICE BROKEN badge below. -->
            <div class="sim-center">
              <svg
                class="compat-ring"
                bind:this={compatRingEl}
                viewBox="0 0 160 160"
                width="160"
                height="160"
                role="img"
                aria-label={compatAria}
                shape-rendering="crispEdges"
              >
                <circle class="track" cx="80" cy="80" r={RING_RADIUS} />
                <circle
                  class="arc"
                  cx="80"
                  cy="80"
                  r={RING_RADIUS}
                  style:--ring-c={RING_C}
                  style:--ring-target={RING_TARGET}
                />
                <text class="compat-score" x="80" y="80">{tally}%</text>
              </svg>
              <span class="sim-badge">{translate($locale, 'landing.sim.badge')}</span>
            </div>
          </div>
        </article>
      </section>

      <!-- SECTION 5 — PRIVACY & CONTROL (§4.26.G): id="privacy" (nav
           target). One glass container; the three inner cards are
           transparent + hairline (no nested blur) — GHOST MODE / MUTUAL
           OPT-IN / EPHEMERAL GPS with the 16×16 pixel icons. -->
      <section class="area-privacy" id="privacy" data-reveal>
        <article class="privacy-card">
          <h2 class="section-title">{translate($locale, 'landing.privacy.title')}</h2>
          <div class="privacy-grid">
            {#each privacyCards as card (card.icon)}
              <div class="privacy-item">
                <svg
                  class="privacy-icon"
                  viewBox="0 0 {PRIVACY_ICONS[card.icon].viewW} {PRIVACY_ICONS[card.icon].viewH}"
                  aria-hidden="true"
                  shape-rendering="crispEdges"
                >
                  {#each PRIVACY_ICONS[card.icon].parts as part, pi (pi)}
                    <g fill={part.fill}>
                      {#each part.rects as rect, ri (ri)}
                        <rect x={rect[0]} y={rect[1]} width={rect[2]} height={rect[3]} />
                      {/each}
                    </g>
                  {/each}
                </svg>
                <h3 class="privacy-title">{card.title}</h3>
                <p class="privacy-desc">{card.desc}</p>
              </div>
            {/each}
          </div>
        </article>
      </section>

      <!-- SECTION 6 — USE CASES (§4.26.H): id="use-cases" (nav target).
           A plain section — NO outer glass; the glass lives on the pills:
           CONFERENCES / PARTIES & BARS / COWORKINGS / FESTIVALS with the
           16×16 pixel icons. -->
      <section class="area-usecases" id="use-cases">
        <h2 class="section-title">{translate($locale, 'landing.usecases.title')}</h2>
        <ul class="usecase-row">
          {#each usecasePills as pill (pill.icon)}
            <li class="usecase-pill" data-reveal>
              <svg
                class="usecase-icon"
                viewBox="0 0 {USECASE_ICONS[pill.icon].viewW} {USECASE_ICONS[pill.icon].viewH}"
                aria-hidden="true"
                shape-rendering="crispEdges"
              >
                {#each USECASE_ICONS[pill.icon].parts as part, pi (pi)}
                  <g
                    fill={part.fill}
                    style={part.glow
                      ? 'filter: drop-shadow(0 0 6px color-mix(in srgb, var(--color-deepa-4) 60%, transparent))'
                      : undefined}
                  >
                    {#each part.rects as rect, ri (ri)}
                      <rect x={rect[0]} y={rect[1]} width={rect[2]} height={rect[3]} />
                    {/each}
                  </g>
                {/each}
              </svg>
              <span class="usecase-label">{pill.label}</span>
            </li>
          {/each}
        </ul>
      </section>

      <!-- SECTION 7 — FINAL CTA (§4.26.I): id="join" (nav target). One
           centered glass card with the purple neon outer glow; the waving
           BLEAK-WAVE mascot; the headline; the inline dark glass input +
           the GET EARLY ACCESS mailto stub (a plain <a>, no form/fetch). -->
      <section class="area-join" id="join" data-reveal>
        <h2 class="section-title">{translate($locale, 'landing.join.title')}</h2>
        <article class="join-card">
          <LandingFigure kind="bleakWave" size={96} idle={false} />
          <h3 class="join-headline">{translate($locale, 'landing.join.headline')}</h3>
          <div class="join-row">
            <input
              class="join-input"
              type="text"
              inputmode="email"
              autocomplete="email"
              placeholder={translate($locale, 'landing.join.input.placeholder')}
              aria-label={translate($locale, 'landing.join.input.placeholder')}
              bind:value={joinValue}
            />
            <!-- §4.26.I-2: a plain mailto anchor (the frontend stub) —
                 the resolve() navigation rule does not apply to external
                 schemes; a <button> + fetch handler replaces it when a
                 real endpoint lands. -->
            <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
            <a class="cta-access" href={joinHref}>
              {translate($locale, 'landing.join.button')}
            </a>
          </div>
        </article>
      </section>

      <!-- FOOTER — the §4.21.G site contact block, resurfaced as the dark
           liquid-glass pill (§4.26.D): the pixel-frame construction is
           retired from it; the content contract (copyright row + EMAIL +
           GITHUB) is verbatim. -->
      <footer class="contact area-foot" data-reveal>
        <div class="foot-body">
          <div class="foot-brand">
            <svg
              viewBox="0 0 64 64"
              width="16"
              height="16"
              shape-rendering="crispEdges"
              aria-hidden="true"
            >
              <g fill="var(--color-deepa-4)">
                <rect x="16" y="14" width="32" height="8" />
                <rect x="12" y="22" width="40" height="16" />
                <rect x="16" y="38" width="32" height="8" />
              </g>
              <g fill="var(--color-landing-bg)">
                <rect x="20" y="26" width="8" height="8" />
                <rect x="36" y="26" width="8" height="8" />
                <rect x="28" y="30" width="8" height="4" />
              </g>
            </svg>
            <span class="brand-name">{copyrightBrand}</span>
            <span class="foot-year">· {copyrightYear}</span>
          </div>
          <div class="foot-links">
            <a class="foot-link" href="mailto:extube@proton.me">
              <span class="link-label">{translate($locale, 'landing.footer.contact.email.label')}</span>
              <span class="link-value">extube@proton.me</span>
            </a>
            <a
              class="foot-link"
              href="https://github.com/extube"
              target="_blank"
              rel="noopener noreferrer"
            >
              <span class="link-label">{translate($locale, 'landing.footer.contact.github.label')}</span>
              <span class="link-value">github.com/extube</span>
            </a>
          </div>
        </div>
      </footer>
    </main>
  </div>
</div>

<style>
  /* §4.22.F: the full-bleed near-black page background (the video's own
   * near-black, 5% Deepa cast) — scoped to /; §4.24.A: .landing is the
   * z-3 scrolling content column ABOVE the fixed video layer (z 0/1/2),
   * the ONE container rule: §4.28.F — phone width max(90%, 280px)
   * shared with the header (desktop keeps max(80%, 280px)) — every
   * section lives inside it (the 1000px canvas cap is retired as a width
   * rule, §4.24.F.2). */
  .landing-page {
    min-height: 100dvh;
    background: var(--color-landing-bg);
  }
  .landing {
    position: relative;
    z-index: 3;
    /* §4.28.F: phone — the content column shares the header's EXACT
     * width expression max(90%, 280px) so the blocks' outer edges align
     * with the header's outer edges (390px → both 351px, 320px → both
     * 288px, below ~311px → both floored at 280px); desktop (≥720px)
     * restores the §4.24.A max(80%, 280px). */
    width: max(90%, 280px);
    margin-inline: auto;
    /* §4.25.A: top padding retired — the fixed header contributes no flow
     * height, and the hero region must span the full first viewport from
     * the page top ("100dvh minus nothing"). §4.28.F: the phone INLINE
     * padding is dropped — the blocks (width: 100%) span the container
     * edge-to-edge so their edges align EXACTLY with the header's outer
     * edges; the bottom padding stays. */
    padding: 0 0 var(--space-5);
    display: flex;
    flex-direction: column;
    gap: var(--space-6);
  }
  @media (min-width: 720px) {
    .landing {
      /* the desktop 80% column + inline gutters stand (§4.24.A/§38) — the
       * header needs NO desktop override: its 280px floor is inert ≥720px */
      width: max(80%, 280px);
      padding: 0 var(--space-7) var(--space-7);
    }
  }

  /* ---------- section 1: the DETACHED floating glass header (§4.26.A) ----------
   * The owner's EXACT §38.1 values, verbatim (superseding §4.25.C,
   * §4.26.K.1–.2): position: fixed; top: 24px — detached from the top edge
   * (the video scrolls through the 24px gap above it and directly
   * underneath the never-moving header). background rgba(18, 15, 28, 0.35)
   * (the sanctioned raw-literal family, §4.26.K.8) + backdrop-filter
   * blur(18px) saturate(180%) (both prefixes), the FULL glossy 1px
   * rgba(255, 255, 255, 0.2) border (all four sides — the §4.25.C
   * top/bottom-only rule is gone) and the inset white highlight — the
   * glowing purple pixel background blurs right through it. Rounding:
   * radius-md (20px) at EVERY width (the phone chip rule is DELETED).
   * Width: the viewport is the containing block — width max(90%, 280px)
   * (the §4.28.F shared floor, the SAME expression as .landing on phone —
   * the edges align), max-width 1200px, margin-inline auto centers it
   * (1152px at 1280, 720px at 800, 351px at 390, 288px at 320; at ≥720px
   * the floor is inert — the desktop 90% cap stands as §4.26.O.5). The
   * §4.24.A container breakout retires. Where backdrop-filter cannot run
   * the fallback is a single higher-opacity tint so text stays readable.
   * The AA tradeoff over bright video frames is the owner's recorded
   * owner-order exception (§4.25.C carries). Keep-list, inner paddings,
   * min-heights and z 10 unchanged. */
  .top {
    position: fixed;
    top: 24px;
    left: 0;
    right: 0;
    margin-inline: auto;
    width: max(90%, 280px);
    max-width: 1200px;
    z-index: 10;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--space-4);
    min-height: 52px;
    padding: 8px 10px;
    /* --- the owner's EXACT values, verbatim (§4.26.A) ---------------- */
    background: rgba(18, 15, 28, 0.35);
    -webkit-backdrop-filter: blur(18px) saturate(180%);
    backdrop-filter: blur(18px) saturate(180%);
    border: 1px solid rgba(255, 255, 255, 0.2);
    box-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.35);
    border-radius: var(--radius-md);
  }
  @supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
    /* no blur support: a single higher-opacity tint keeps the chrome readable */
    .top {
      background: rgba(18, 15, 28, 0.85);
    }
  }
  @media (min-width: 720px) {
    .top {
      min-height: 56px;
      padding: 10px 16px;
    }
  }
  .app-icon {
    display: block;
    flex: none;
  }
  .top-nav {
    display: none;
    align-items: center;
    gap: var(--space-4);
  }
  .top-nav a {
    font-family: var(--font-pixel);
    font-weight: 600;
    font-size: 14px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--color-text-muted);
    transition: color 120ms ease-out;
  }
  .top-nav a:hover {
    color: var(--color-deepa-4);
  }
  .locale {
    display: flex;
    align-items: center;
    height: 40px;
    flex: none;
  }
  .locale :global(.segmented) {
    padding: 2px;
  }
  .locale :global(.segmented button) {
    min-height: 36px;
  }
  @media (min-width: 720px) {
    /* icon · anchors · switcher, left→right (§4.22.A keep-list) */
    .top-nav {
      display: flex;
    }
  }

  /* ---------- the content column over the video (§4.25.A) ----------
   * The DOM order below IS the stack: fixed glass header → lead
   * (transparent) → agent card → stat card → the three step blocks →
   * contact footer (everything overlays the fixed video background; the
   * §4.24.E `calc(200dvh / 3)` spacer is DELETED — the open state is
   * produced entirely by the hero's 100dvh construction, §4.25.D.1).
   * §4.32.A (Concept §45 item 1, superseding §4.31.B's <960 stack): the
   * base .stage is NO LONGER the 100dvh first-viewport region — at <960px
   * the LEAD ALONE owns the first viewport (the `.area-lead` 100dvh
   * centered region in the 959.98px media below); the BLEAK card follows
   * after the stage's 32px gap in the normal scroll flow — strictly BELOW
   * THE FOLD at every <960 width/height ("behind the screen", reached by
   * scrolling). At ≥960px the hero row is the TWO-COLUMN grid (lead
   * 1.2fr, BLEAK 1fr, side by side) with `min-height: 100dvh` — the §37
   * open-state (first viewport = lead + BLEAK, vertically centered)
   * applies ≥960px ONLY. The stat card, step blocks and footer flow
   * AFTER the hero region (below the fold initially, revealed on
   * scroll). */
  .canvas {
    display: flex;
    flex-direction: column;
    gap: var(--space-6);
    min-width: 0;
  }
  /* BASE = <960px: the lead's own region owns the 100dvh — centered
   * ALONE; the BLEAK card follows in the normal scroll flow (below the
   * fold). The base .stage declares NO min-height and NO
   * justify-content (the §4.31.B stack construction is gone). */
  .stage {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-6);
    min-width: 0;
  }
  @media (max-width: 959.98px) {
    /* §45.1: the lead centered ALONE in the first viewport — its region
     * is the 100dvh hero (the card is out of this region, in the scroll
     * flow after it); grow allowed (min-height, never locked). */
    .area-lead {
      min-height: 100dvh;
      display: flex;
      flex-direction: column;
      justify-content: center;
    }
  }
  @media (min-width: 960px) {
    .stage {
      display: grid;
      grid-template-columns: 1.2fr 1fr; /* WAS repeat(3, 1fr) + empty col 2 */
      column-gap: var(--space-6); /* unchanged 32px */
      /* the hero row = the whole first viewport — MOVED here from the
       * base rule (§4.32.A); grow allowed (min-height, never height) */
      min-height: 100dvh;
      align-content: center;
      align-items: center;
    }
    .area-lead {
      grid-column: 1; /* unchanged */
    }
    .area-agents {
      grid-column: 2; /* WAS 3 — the empty middle third retires (§4.31.A) */
    }
    /* §4.32.B (Concept §45 item 2): the §4.30.C 240px cap is DELETED —
     * the card fills its 1fr track via the shared `width: 100%` rule,
     * edge-to-edge, so its right margin from the viewport equals the
     * lead's left margin — both `calc(10% + 48px)` (the container's
     * centered 10% gutter PLUS its 48px inline padding, included
     * symmetrically on both sides; the padding is NOT pierced). */
  }
  /* §4.26.A anchor plumbing: the four smooth-scroll targets (the step
   * cards #how-it-works + the new sections) clear the detached floating
   * header (24px top gap + ≤56px row + slack); #agents keeps its id with
   * no nav link. Smooth scroll via CSS only, scoped under
   * prefers-reduced-motion: no-preference (the default auto IS the
   * reduced-motion fallback; base.css also forces scroll-behavior: auto
   * under reduce). */
  .area-agents,
  .area-tutorial,
  .area-sim,
  .area-privacy,
  .area-usecases,
  .area-join {
    scroll-margin-top: 100px;
  }
  @media (prefers-reduced-motion: no-preference) {
    :global(html) {
      scroll-behavior: smooth;
    }
  }

  /* ---------- lead block (§4.20.C verbatim copy; §4.25.B TRANSPARENT) ----
   * §37.2: the lead is TRANSPARENT and without border — no solid panel, no
   * pixel frame (§4.24.C's opaque construction and the §4.20.G
   * pixel-frame are retired FOR THIS BLOCK, §4.25.D.2; §4.20.G stands for
   * the agent/stat/step/footer surfaces). The headline + supporting text +
   * Start button sit DIRECTLY over the video background; legibility =
   * text treatment ONLY — a token-only dark halo on `.headline`/`.sub`
   * (the accent word keeps its own violet glow declaration, which
   * overrides the inherited halo). The old body padding stays as inert
   * spacing that keeps the copy clear of the track edge — it is not a
   * panel. The Start button is unchanged (an opaque violet pill — it
   * never relied on the panel). Narrower (§4.31.A): the lead fills its
   * 1.2fr track — ≈ 489px at 1280 (100% of the container content width
   * below 960px). */
  .copy {
    min-width: 0;
    width: 100%;
  }
  .copy-body {
    background: transparent;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: var(--space-4);
    padding: 20px;
    width: 100%;
  }
  @media (min-width: 720px) {
    .copy-body {
      padding: 28px;
    }
  }
  @media (min-width: 960px) {
    /* the left alignment belongs to the SIDE-BY-SIDE composition
     * (§4.31.A); below 960px the centered stack keeps the centered lead */
    .copy-body {
      align-items: flex-start;
      text-align: left;
    }
  }
  .headline {
    font-family: var(--font-pixel);
    font-weight: 600;
    /* §4.28.A: 36px → 40px on phone (≥480: 48px; ≥960: clamp(32px,
     * 4.5vw, 64px) per §4.32.C — the bump forces the clamp re-check so
     * the lead stays the dominant title over the grown 28px .agent-name
     * at every ≥960px width: 43.2px at 960px, capped at 64px from
     * ≈1422px up) */
    font-size: 40px;
    line-height: 1.05;
    text-transform: uppercase;
    color: var(--color-text);
    overflow-wrap: anywhere;
    /* the §4.25.B legibility halo — token-only, over the near-black video */
    text-shadow:
      0 1px 2px color-mix(in srgb, var(--color-surface) 90%, transparent),
      0 0 14px color-mix(in srgb, var(--color-surface) 55%, transparent);
  }
  .hl-line {
    display: block;
  }
  @media (min-width: 480px) {
    .headline {
      font-size: 48px;
    }
  }
  @media (min-width: 960px) {
    /* §4.28.A + §4.31.A + §4.32.C: the clamp moves WITH the side-by-side
     * composition (720 → 960px, the 720–959 band keeps the ≥480px 48px
     * value); §4.32.C raises the desktop size — clamp(32px, 4.5vw, 64px):
     * 43.2px at 960 → 57.6px at 1280, capped 64px from ≈1422px up (the
     * 32px floor is inert on ≥960 — a defensive minimum); overflow-wrap:
     * anywhere carries the mid-word breaks */
    .headline {
      font-size: clamp(32px, 4.5vw, 64px);
    }
  }
  .accent-line {
    color: var(--color-deepa-4);
  }
  .accent-word {
    position: relative;
    display: inline-block;
    color: var(--color-deepa-4);
    text-shadow:
      0 0 8px color-mix(in srgb, var(--color-deepa-4) 60%, transparent),
      0 0 24px color-mix(in srgb, var(--color-deepa-4) 30%, transparent);
  }
  .sparkle {
    position: absolute;
    width: 8px;
    height: 8px;
    animation: sparkle 1.6s steps(2) infinite;
  }
  .spark-a {
    top: -10px;
    right: -12px;
  }
  .spark-b {
    bottom: -8px;
    left: -12px;
    animation-delay: 0.8s;
  }
  @keyframes sparkle {
    0%,
    100% {
      opacity: 1;
      transform: scale(1);
    }
    50% {
      opacity: 0.25;
      transform: scale(0.75);
    }
  }
  .sub {
    margin: 0;
    font-family: var(--font-body);
    font-size: 16px; /* §4.28.B: 14px → 16px (18px ≥720px) */
    color: var(--color-text); /* §4.28.1 owner amendment (Concept §41): the lead description reads white — the muted token retired for this element */
    max-width: 40ch;
    /* the §4.25.B legibility halo (the softer ambient tail) */
    text-shadow:
      0 1px 2px color-mix(in srgb, var(--color-surface) 90%, transparent),
      0 0 10px color-mix(in srgb, var(--color-surface) 55%, transparent);
  }
  @media (min-width: 720px) {
    .sub {
      font-size: 18px;
    }
  }

  /* CTA pills (§4.20.C/G): the landing accent pill — violet fill, light
   * text (AA on the violet), glow on hover, scale(0.98) on press. */
  .cta-main,
  .talk {
    border: none;
    border-radius: var(--radius-pill);
    background: var(--color-deepa-4);
    color: var(--color-text);
    font-family: var(--font-pixel);
    font-weight: 600;
    font-size: 18px; /* §4.28.D: the CTA pill family moves together, 16→18 */
    letter-spacing: 0.08em;
    text-transform: uppercase;
    transition:
      filter 120ms ease-out,
      transform 120ms ease-out;
  }
  .cta-main {
    padding: 12px 28px;
    min-height: var(--touch-target);
  }
  .talk {
    padding: 10px 28px;
    min-height: var(--touch-target);
  }
  .cta-main:hover,
  .talk:hover {
    filter: drop-shadow(0 0 8px color-mix(in srgb, var(--color-deepa-4) 50%, transparent))
      drop-shadow(0 0 24px color-mix(in srgb, var(--color-deepa-4) 22%, transparent));
  }
  .cta-main:active,
  .talk:active {
    transform: scale(0.98);
  }

  /* ---------- framed cards (§4.20.G) ---------- */
  .card-body {
    padding: 20px;
  }
  .agent-card,
  .stat-card {
    width: 100%;
    transition:
      transform 120ms ease-out,
      filter 120ms ease-out;
  }
  .agent-card:hover,
  .stat-card:hover {
    transform: translateY(-2px);
    filter: drop-shadow(0 0 8px color-mix(in srgb, var(--color-deepa-4) 50%, transparent))
      drop-shadow(0 0 24px color-mix(in srgb, var(--color-deepa-4) 22%, transparent));
  }
  .agent-card:active,
  .stat-card:active {
    transform: scale(0.98);
  }
  .agent-body {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: var(--space-3);
  }
  .agent-portrait {
    line-height: 0;
    filter: drop-shadow(0 0 10px color-mix(in srgb, var(--color-deepa-4) 45%, transparent))
      drop-shadow(0 0 28px color-mix(in srgb, var(--color-deepa-4) 20%, transparent));
  }
  .agent-name {
    font-family: var(--font-pixel);
    font-weight: 600;
    font-size: 28px; /* §4.28.A: 24→28 — still the largest block title */
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--color-text);
    margin: 0;
  }
  .agent-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 24px;
    padding: 2px var(--space-3);
    border: 1px solid var(--color-deepa-4);
    border-radius: var(--radius-pill);
    font-family: var(--font-pixel);
    font-weight: 600;
    font-size: 13px; /* §4.28.D: 11→13 (13px Handjet still fits min-height 24px) */
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--color-deepa-4);
  }
  .agent-traits {
    margin: 0;
    font-family: var(--font-pixel);
    font-weight: 600;
    font-size: 13px; /* §4.28.C: 11→13 (the caption tier) */
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--color-text-muted);
  }
  .agent-quote {
    margin: 0;
    font-family: var(--font-body);
    font-size: 17px; /* §4.28.B: 15→17 (the description tier) */
    color: var(--color-text);
  }

  /* Stat card, compact (§4.21.F): padding 20px → 12px 14px mobile /
   * 16px 20px desktop; title 18→17px; BLOOM 56px → 44px mobile / 48px
   * desktop; the desktop layout stays title-left / glyph-right in one
   * compact row, full-width atop section 3. */
   /* Stat card → BANNER (§4.26.B): the pixel-frame construction is KEPT
    * over the glass; the compact padding/typography contract (12px 14px /
    * 16px 20px, 17px title, 44/48px BLOOM) stands — only the body FILL
    * becomes the owner's dark liquid glass (rgba(20, 18, 30, 0.55) +
    * blur(12px); the pixel cityscape of the video blurs right through). */
  .stat-body {
    display: flex;
    /* §4.30.F (Concept §42 item 5) — phone STACK: the flower icon + the
     * status caption block sits ON TOP of the text block (the glyph gets
     * order: -1 below); left-aligned column. Desktop ≥720px restores the
     * §4.21.F/§4.26.B text-left / glyph-right compact row (media below). */
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-3);
    padding: 12px 14px;
    /* --- the owner's EXACT values, verbatim (§4.26.B) ---------------- */
    background: rgba(20, 18, 30, 0.55);
    -webkit-backdrop-filter: blur(12px);
    backdrop-filter: blur(12px);
  }
  .stat-copy {
    min-width: 0;
  }
  /* the §4.26.B pixel sub-badge above the title: the pixel-badge
   * technique at chip scale — the outer span's background IS the frame
   * color (deepa-4 at 60%), the inner transparent span carries the text;
   * both layers clip with .pixel-corners. */
  .stat-badge {
    display: inline-flex;
    background: color-mix(in srgb, var(--color-deepa-4) 60%, transparent);
    padding: 2px;
    margin: 0 0 var(--space-2);
  }
  .stat-badge > span {
    padding: 2px 8px;
    font-family: var(--font-pixel);
    font-weight: 600;
    font-size: 13px; /* §4.28.D: 11→13 */
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--color-deepa-4);
    line-height: 1.2;
  }
  .stat-title {
    font-family: var(--font-pixel);
    font-weight: 600;
    font-size: 21px; /* §4.28.A: 17→21 (the compact banner row stands otherwise) */
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--color-text);
    margin: 0 0 var(--space-2);
  }
  .stat-line {
    margin: 0 0 2px;
    font-family: var(--font-body);
    font-size: 17px; /* §4.28.B: 15→17 */
    line-height: 1.35;
    color: var(--color-text-muted);
  }
  /* the glyph: §4.30.F — phone the icon+caption block is FIRST (order -1)
   * laid out as a ROW (the flower left, the pulsing dot + caption beside
   * it, vertically centered); desktop restores the small right column
   * (BLOOM on top, the glowing status caption below it — §4.26.B). */
  .stat-glyph {
    flex: none;
    line-height: 0;
    display: flex;
    order: -1;
    flex-direction: row;
    align-items: center;
    gap: 6px;
  }
  .stat-status {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    line-height: 1;
    font-family: var(--font-pixel);
    font-weight: 600;
    font-size: 13px; /* §4.28.C: 11→13 (the glowing caption) */
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--color-text);
    /* the glowing caption read */
    text-shadow: 0 0 8px color-mix(in srgb, var(--color-deepa-1) 45%, transparent);
  }
  .status-dot {
    width: 9px;
    height: 9px;
    flex: none;
    background: var(--color-deepa-1);
    box-shadow: 0 0 9px color-mix(in srgb, var(--color-deepa-1) 70%, transparent);
    animation: status-pulse 1.6s steps(2) infinite alternate;
  }
  @keyframes status-pulse {
    from {
      opacity: 1;
    }
    to {
      opacity: 0.4;
    }
  }
  .stat-glyph :global(svg) {
    /* §4.30.D (Concept §42 item 3): the banner flower grows +50% — 66px on
     * phone / 72px ≥720px (the markup size 72 carries the same value). */
    width: 66px;
    height: 66px;
  }
  @media (min-width: 720px) {
    /* desktop: the §4.21.F/§4.26.B compact row, UNCHANGED (§4.30.F) —
     * text-left / glyph-right, the glyph back to its small right column */
    .stat-body {
      flex-direction: row;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-4);
      padding: 16px 20px;
    }
    .stat-glyph {
      order: 0;
      flex-direction: column;
      align-items: center;
      gap: 6px;
    }
    .stat-glyph :global(svg) {
      width: 72px;
      height: 72px;
    }
  }

  /* ---------- the three BIG step blocks (§4.21.E as amended by §4.26.C,
   * §4.30.E, §4.30.D) ----------
   * FIND → CHAT → SHARE: one step per display block — pixel step number,
   * pixel-font title, step icon, one-line description. §4.30.E (Concept
   * §42 item 4, SUPERSEDES §4.26.C's glass): the body fill is the agent
   * card's SAME opaque surface token — `var(--color-surface)` (the
   * base.css .card fill) — with the two blur(10px) backdrop-filter
   * declarations RETIRED (an opaque surface needs no blur; the per-card
   * GPU filter cost goes with it). The pixel frame stays square/stepped,
   * the hover purple glow + lift (reduced motion: instant glow, no lift),
   * the decorative mini-illustration top-right and the §4.26.L bottom
   * micro-pill all carry; the icons grow +50% (§4.30.D). */
  .steps {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
  }
  .step-block {
    width: 100%;
    transition: transform 160ms ease-out, filter 160ms ease-out;
  }
  .step-block:hover {
    transform: translateY(-4px);
    filter:
      drop-shadow(0 0 12px color-mix(in srgb, var(--color-deepa-4) 45%, transparent))
      drop-shadow(0 0 36px color-mix(in srgb, var(--color-deepa-4) 20%, transparent));
  }
  @media (prefers-reduced-motion: reduce) {
    .step-block {
      transition-duration: 0s;
    }
    .step-block:hover {
      transform: none; /* glow applies instantly, no lift */
    }
  }
  .step-body {
    /* §4.30.E: the BLEAK agent card's surface — the SAME token, byte-equal
     * to the base.css .card fill (no blur, no rgba glass, no radius).
     * §4.31.C: height: 100% — the body FILLS the stretched grid item, so
     * the frame ring is a uniform 2px on all four sides on EVERY card and
     * no frame fill can ever show below the body (the white-bottom-block
     * leak is structurally impossible). On phone the .steps are an
     * auto-height flex column — a percentage height against an
     * auto-height parent resolves to auto (the declaration is inert
     * there, no regression). */
    background: var(--color-surface);
    position: relative;
    height: 100%;
    padding: 16px;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-2);
  }
  /* the §4.26.C decorative mini-illustration: top-right of the card,
   * token fills, transparent background, no plate. §4.30.D: the art grows
   * +50% — 72px (integer 3× unit scale of the 24-grid, perfectly crisp). */
  .step-art {
    position: absolute;
    top: 12px;
    right: 12px;
    width: 72px;
    height: 72px;
  }
  .step-num {
    font-family: var(--font-pixel);
    font-weight: 600;
    font-size: 40px;
    letter-spacing: 0.1em;
    line-height: 1;
    color: var(--color-deepa-4);
    text-shadow:
      0 0 8px color-mix(in srgb, var(--color-deepa-4) 60%, transparent),
      0 0 24px color-mix(in srgb, var(--color-deepa-4) 30%, transparent);
  }
  .step-title {
    font-family: var(--font-pixel);
    font-weight: 600;
    font-size: 24px; /* §4.28.A: 20→24 */
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--color-text);
    margin: 0;
  }
  .step-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    /* §4.30.D: the wrapper grows with the icon — 48px icon in a 72×72 box */
    width: 72px;
    height: 72px;
    color: var(--color-text-muted);
  }
  .step-desc {
    margin: 0;
    font-family: var(--font-body);
    font-size: 17px; /* §4.28.B: 15→17 */
    color: var(--color-text-muted);
  }
  /* the §4.26.L bottom micro-pill: a chip (§4.5 — pills are NOT
   * pixel-corners), pinned to the card bottom on desktop via margin-top
   * auto. */
  .step-pill {
    display: inline-flex;
    align-items: center;
    margin-top: var(--space-3);
    padding: 4px 10px;
    border: 1px solid color-mix(in srgb, var(--color-deepa-4) 40%, transparent);
    border-radius: var(--radius-pill);
    font-family: var(--font-pixel);
    font-weight: 600;
    font-size: 12px; /* §4.28.D: 10→12 (13px ≥720px) */
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--color-deepa-4);
  }
  @media (min-width: 720px) {
    .step-pill {
      margin-top: auto;
      font-size: 13px;
    }
  }
  @media (min-width: 720px) {
    /* desktop: the three blocks ordered left to right, equal thirds */
    .steps {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: var(--space-6);
    }
    .step-block .step-body {
      min-height: 300px;
      padding: 20px;
    }
  }

  /* ---------- contact footer (§4.21.G as resurfaced by §4.26.D) ----------
   * The dark liquid-glass pill matching the header family: the
   * pixel-frame construction is retired; the content contract (row 1 =
   * the kept copyright content, row 2 = EMAIL + GITHUB) is verbatim.
   * White/purple pixel text = the footer's established --color-text
   * values + deepa-4 hovers. */
  .contact {
    width: 100%;
    max-width: 560px;
    margin: 0 auto;
  }
  .foot-body {
    background: rgba(18, 15, 28, 0.5);
    -webkit-backdrop-filter: blur(14px);
    backdrop-filter: blur(14px);
    border: 1px solid rgba(255, 255, 255, 0.2);
    box-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.35);
    border-radius: var(--radius-md);
    padding: 16px 20px;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: var(--space-3);
  }
  .foot-brand {
    display: inline-flex;
    align-items: baseline;
    gap: var(--space-2);
  }
  .foot-brand svg {
    align-self: center;
    flex: none;
  }
  .brand-name {
    font-family: var(--font-pixel);
    font-weight: 600;
    font-size: 14px;
    letter-spacing: 0.04em;
    color: var(--color-text);
  }
  .foot-year {
    font-family: var(--font-body);
    font-size: 11px;
    color: var(--color-text-muted);
  }
  .foot-links {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
  }
  .foot-link {
    display: inline-flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    text-decoration: none;
  }
  .link-label {
    font-family: var(--font-pixel);
    font-weight: 600;
    font-size: 12px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--color-text-muted);
    transition: color 120ms ease-out;
  }
  .link-value {
    font-family: var(--font-pixel);
    font-weight: 600;
    font-size: 13px;
    letter-spacing: 0.04em;
    color: var(--color-text);
    transition:
      color 120ms ease-out,
      filter 120ms ease-out;
  }
  .foot-link:hover .link-label {
    color: var(--color-text);
  }
  .foot-link:hover .link-value {
    color: var(--color-deepa-4);
    filter: drop-shadow(0 0 8px color-mix(in srgb, var(--color-deepa-4) 50%, transparent));
  }
  .foot-link:focus-visible {
    outline: 2px solid var(--color-deepa-4);
    outline-offset: 2px;
  }
  @media (min-width: 720px) {
    .foot-links {
      flex-direction: row;
      gap: var(--space-6);
    }
  }

  /* ---------- the FOUR new sections (§4.26.E–I, tz12-10) ----------
   * Shared glass recipe (the owner's §38.5 values, applied to each
   * section's own class — NOT a shared glass class, which stays retired,
   * §4.26.K.8): rgba(18, 15, 28, 0.45) + blur(16px) + the thin white
   * glossy border + the inset highlight; glass surfaces are ROUNDED
   * (radius-md 20px) while every pixel-frame surface stays square.
   * Placement: after the step cards, before the footer — the .canvas
   * flex column's --space-6 rhythm spaces them; the phone stack is the
   * DOM order. The z-order holds: plain z-3 content over the fixed video
   * (§4.26.J). */
  .sim-card,
  .privacy-card,
  .usecase-pill,
  .join-card {
    background: rgba(18, 15, 28, 0.45);
    -webkit-backdrop-filter: blur(16px);
    backdrop-filter: blur(16px);
    border: 1px solid rgba(255, 255, 255, 0.2);
    box-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.35);
    border-radius: var(--radius-md);
  }
  /* the shared section title: Handjet 24px uppercase (§4.28.A: 20→24),
   * the §4.20.A glow */
  .section-title {
    font-family: var(--font-pixel);
    font-weight: 600;
    font-size: 24px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    text-align: center;
    color: var(--color-text);
    margin: 0 0 var(--space-4);
    text-shadow:
      0 0 8px color-mix(in srgb, var(--color-deepa-4) 60%, transparent),
      0 0 24px color-mix(in srgb, var(--color-deepa-4) 30%, transparent);
  }

  /* ---- SECTION 4 — LIVE AGENT SIMULATION (§4.26.F) ---- */
  .sim-card {
    width: 100%;
    padding: var(--space-5) var(--space-4);
  }
  .sim-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    grid-template-areas:
      'you nearby'
      'center center';
    gap: var(--space-4);
    align-items: center;
  }
  .sim-you {
    grid-area: you;
  }
  .sim-nearby {
    grid-area: nearby;
  }
  .sim-agent {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: var(--space-2);
  }
  .sim-portrait {
    line-height: 0;
  }
  .sim-portrait--you {
    filter: drop-shadow(0 0 10px color-mix(in srgb, var(--color-deepa-4) 45%, transparent))
      drop-shadow(0 0 28px color-mix(in srgb, var(--color-deepa-4) 20%, transparent));
  }
  .sim-portrait--nearby {
    filter: drop-shadow(0 0 10px color-mix(in srgb, var(--color-deepa-5) 45%, transparent))
      drop-shadow(0 0 28px color-mix(in srgb, var(--color-deepa-5) 20%, transparent));
  }
  .sim-agent-name {
    font-family: var(--font-pixel);
    font-weight: 600;
    font-size: 16px; /* §4.28.A: 14→16 */
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--color-text);
  }
  .sim-status {
    display: inline-flex;
    align-items: center;
    font-family: var(--font-pixel);
    font-weight: 600;
    font-size: 14px; /* §4.28.C: 12→14 */
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .sim-status--you {
    color: var(--color-deepa-4);
  }
  .sim-status--nearby {
    color: var(--color-deepa-5);
  }
  /* the blinking pixel cursor: a 6×2px deepa-4 block after the status
   * text; reduced motion → statically visible (the base.css catch-all). */
  .sim-cursor {
    width: 6px;
    height: 2px;
    flex: none;
    background: var(--color-deepa-4);
    animation: cursor-blink 1s steps(2) infinite;
  }
  @keyframes cursor-blink {
    from {
      opacity: 1;
    }
    to {
      opacity: 0;
    }
  }
  /* the §4.27.C center column: a flex column holding EXACTLY two
   * children, top → bottom — the compatibility circle (§4.27.D) and the
   * ICE BROKEN badge (relocated below the ring; styles unchanged). */
  .sim-center {
    grid-area: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-3);
  }
  /* the §4.27.D compatibility circle — the /chats summary-sheet ring
   * pattern reused (SummarySheet.svelte): SVG viewBox 0 0 160 160 at
   * 160×160px, r 66 (RING_RADIUS, imported), stroke-width 12, butt caps
   * (square ends — the pixel aesthetic), crispEdges; the arc + numeral
   * read the landing text ink (no --sheet-* scope here — the sheet's
   * whites map to var(--color-text), the track at 25% of it). */
  .compat-ring {
    width: 160px;
    height: 160px;
    flex-shrink: 0;
    shape-rendering: crispEdges;
  }
  .compat-ring circle {
    fill: none;
    stroke: var(--color-text);
    stroke-width: 12;
  }
  .compat-ring .track {
    stroke: color-mix(in srgb, var(--color-text) 25%, transparent);
  }
  /* The arc starts at 12 o'clock and sweeps clockwise with the score:
   * dasharray = the full circumference (--ring-c), dashoffset animated
   * from the full C (empty) to --ring-target = ringScoreOffset(96) over
   * 900ms ease-out (the sheet's exact duration/easing — the sanctioned
   * §4.13.5/§4.15.C-5 stroke-geometry exception, carried by the pattern). */
  .compat-ring .arc {
    stroke-linecap: butt;
    stroke-dasharray: var(--ring-c) var(--ring-c);
    stroke-dashoffset: var(--ring-target);
    transform: rotate(-90deg);
    transform-origin: 80px 80px;
    animation: ring-fill 900ms ease-out both;
  }
  @keyframes ring-fill {
    from {
      stroke-dashoffset: var(--ring-c);
    }
    to {
      stroke-dashoffset: var(--ring-target);
    }
  }
  /* The numeral: Handjet 600 40px, letter-spacing 0 (the sheet's 28px PS2P
   * equivalent — Handjet is narrow, 40px fills the 132px ring interior),
   * centered at x 80 / y 80 (the sheet's technique), the text ink. */
  .compat-ring .compat-score {
    stroke: none;
    fill: var(--color-text);
    font-family: var(--font-pixel);
    font-weight: 600;
    font-size: 40px;
    letter-spacing: 0;
    text-anchor: middle;
    dominant-baseline: central;
  }
  .sim-badge {
    display: inline-flex;
    font-family: var(--font-pixel);
    font-weight: 600;
    font-size: 14px; /* §4.28.D: 12→14 */
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--color-deepa-1);
    border: 1px solid color-mix(in srgb, var(--color-deepa-1) 50%, transparent);
    text-shadow: 0 0 8px color-mix(in srgb, var(--color-deepa-1) 60%, transparent);
    animation: badge-pulse 1.6s steps(2) infinite alternate;
  }
  @keyframes badge-pulse {
    from {
      opacity: 1;
    }
    to {
      opacity: 0.7;
    }
  }
  @media (min-width: 720px) {
    .sim-grid {
      grid-template-columns: 1fr auto 1fr;
      grid-template-areas: 'you center nearby';
      gap: var(--space-5);
    }
    .sim-card {
      padding: var(--space-5);
    }
  }

  /* ---- SECTION 5 — PRIVACY & CONTROL (§4.26.G) ---- */
  .privacy-card {
    width: 100%;
    padding: var(--space-5) var(--space-4);
  }
  .privacy-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: var(--space-4);
  }
  /* the inner cards are NOT glass-stacked: transparent + hairline — one
   * backdrop-filter per section, no nested blur cost (§4.26.E). */
  .privacy-item {
    background: transparent;
    border: 1px solid color-mix(in srgb, var(--color-text) 12%, transparent);
    padding: var(--space-4);
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: var(--space-2);
  }
  .privacy-icon {
    /* §4.30.D: +50% — 48px → 72px (crispEdges keeps every unit rect snapped) */
    width: 72px;
    height: 72px;
  }
  .privacy-title {
    font-family: var(--font-pixel);
    font-weight: 600;
    font-size: 16px; /* §4.28.A: 14→16 (one tier under .section-title) */
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--color-text);
    margin: 0;
  }
  .privacy-desc {
    margin: 0;
    font-family: var(--font-body);
    font-size: 17px; /* §4.28.B: 15→17 */
    color: var(--color-text-muted);
  }
  @media (min-width: 720px) {
    .privacy-grid {
      grid-template-columns: repeat(3, 1fr);
      gap: var(--space-5);
    }
    .privacy-card {
      padding: var(--space-5);
    }
  }

  /* ---- SECTION 6 — USE CASES (§4.26.H) ----
   * A plain section — the glass lives on the pills themselves. */
  .usecase-row {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: 1fr;
    gap: var(--space-4);
  }
  .usecase-pill {
    padding: var(--space-4);
    min-height: 112px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
  }
  .usecase-icon {
    /* §4.30.D: +50% — 40px → 60px (crispEdges keeps every unit rect snapped) */
    width: 60px;
    height: 60px;
  }
  .usecase-label {
    font-family: var(--font-pixel);
    font-weight: 600;
    font-size: 16px; /* §4.28.D: 14→16 */
    letter-spacing: 0.08em;
    text-transform: uppercase;
    text-align: center;
    color: var(--color-text);
  }
  @media (min-width: 720px) {
    .usecase-row {
      grid-template-columns: repeat(4, 1fr);
    }
  }

  /* ---- SECTION 7 — FINAL CTA (§4.26.I) ---- */
  .join-card {
    width: 100%;
    max-width: 640px;
    margin: 0 auto;
    padding: var(--space-6) var(--space-5);
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: var(--space-4);
    /* the vibrant purple neon glow behind the card, over the family
     * inset highlight (§4.26.I-1) */
    box-shadow:
      inset 0 1px 1px rgba(255, 255, 255, 0.35),
      0 0 32px color-mix(in srgb, var(--color-deepa-4) 45%, transparent),
      0 0 96px color-mix(in srgb, var(--color-deepa-4) 22%, transparent);
  }
  .join-headline {
    font-family: var(--font-pixel);
    font-weight: 600;
    font-size: 24px; /* §4.28.A: 20→24 (28px ≥720px) */
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--color-text);
    margin: 0;
    text-shadow:
      0 0 8px color-mix(in srgb, var(--color-deepa-4) 60%, transparent),
      0 0 24px color-mix(in srgb, var(--color-deepa-4) 30%, transparent);
  }
  @media (min-width: 720px) {
    .join-headline {
      font-size: 28px;
    }
  }
  .join-row {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    width: 100%;
  }
  /* the inline dark glass input (§4.26.I-3) */
  .join-input {
    width: 100%;
    background: rgba(15, 14, 22, 0.65);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: var(--radius-pill);
    padding: 12px 20px;
    min-height: var(--touch-target);
    font-family: var(--font-body);
    font-size: 14px;
    color: var(--color-text);
  }
  .join-input::placeholder {
    color: var(--color-text-muted);
  }
  .join-input:focus-visible {
    outline: 2px solid var(--color-deepa-4);
    outline-offset: 2px;
  }
  /* the GET EARLY ACCESS neon pixel button — DECIDED neon YELLOW (the
   * §4.1 interactive-accent rule: --color-accent is reserved for exactly
   * this kind of active element). §4.26.I-2: it is a plain <a> (the
   * mailto stub) — no form, no fetch; a <button> + handler replaces it
   * when a real endpoint lands. */
  .cta-access {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 12px 24px;
    min-height: var(--touch-target);
    background: var(--color-accent);
    color: var(--color-accent-ink);
    font-family: var(--font-pixel);
    font-weight: 600;
    font-size: 18px; /* §4.28.D: 16→18 (the CTA pill family) */
    letter-spacing: 0.08em;
    text-transform: uppercase;
    text-decoration: none;
    border: none;
    border-radius: var(--radius-pill);
    transition:
      filter 120ms ease-out,
      transform 120ms ease-out;
  }
  .cta-access:hover {
    filter: drop-shadow(0 0 8px color-mix(in srgb, var(--color-accent) 50%, transparent))
      drop-shadow(0 0 24px color-mix(in srgb, var(--color-accent) 22%, transparent));
  }
  .cta-access:active {
    transform: scale(0.98);
  }
  .cta-access:focus-visible {
    outline: 2px solid var(--color-deepa-4);
    outline-offset: 2px;
  }
  @media (min-width: 720px) {
    .join-row {
      flex-direction: row;
      align-items: stretch;
    }
    .join-input {
      flex: 1;
      width: auto;
    }
  }
</style>
