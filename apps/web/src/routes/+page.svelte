<script lang="ts">
  /**
   * `/` — the landing page (tz12-10, Concept §38 owner batch, DESIGN
   * §4.26 amending §4.25 item by item):
   *
   * - Canvas: the §4.22.F page background stays — `--color-landing-bg`
   *   painted full-bleed by the page wrapper; §4.24.A: ONE container rule
   *   — `.landing` is `max(80%, 280px)` wide, centered (§4.26.O.5: the
   *   header is deliberately WIDER — 90% / max 1200px — do not
   *   "harmonize" them).
   * - §4.23.A fixed background: `LandingVideoHero` stays the FIRST child
   *   of `.landing-page` — a fixed full-viewport video layer (z 0) +
   *   dissolve vignette + 30% tint (z 1) + the 12-dot purple mesh (z 2);
   *   ALL landing blocks scroll OVER it as overlays.
   * - Header (§4.26.A — the owner's EXACT §38.1 values verbatim,
   *   superseding §4.25.C): the DETACHED floating glass pill —
   *   `position: fixed; top: 24px`, centered `width: 90%`,
   *   `max-width: 1200px`, `border-radius: var(--radius-md)` (20px),
   *   `rgba(18, 15, 28, 0.35)` + `backdrop-filter: blur(18px)
   *   saturate(180%)`, full 1px `rgba(255, 255, 255, 0.2)` border + the
   *   inset white highlight; the no-backdrop fallback is
   *   `rgba(18, 15, 28, 0.85)`. Keep-list UNCHANGED (§4.22.A).
   *   The nav anchors are FOUR smooth-scroll links (§4.26.K.3): HOW IT
   *   WORKS → #how-it-works (the step cards; the `tutorial` id is
   *   renamed), PRIVACY → #privacy, USE CASES → #use-cases, JOIN →
   *   #join (`#agents` stays as an id with no nav link); CSS smooth
   *   scroll under `prefers-reduced-motion: no-preference`.
   * - Open state (§4.25.A — §37.1 CARRIES, §4.26.J): on open, ONLY the
   *   lead (Start block) and the BLEAK agent card are visible,
   *   VERTICALLY CENTERED in the first viewport; everything else flows
   *   AFTER the hero region — below the fold, revealed on scroll.
   * - Lead section (§4.25.B): TRANSPARENT and borderless — unchanged.
   * - Banner (§4.26.B — the stat card amended in place): the
   *   pixel-framed card goes liquid glass (`rgba(20, 18, 30, 0.55)` +
   *   blur 12px), the `[ LIVE NETWORK // IRL ]` pixel sub-badge above
   *   the title, and the glowing `AI Agents active nearby` caption with
   *   a pulsing green pixel dot next to the BLOOM glyph.
   * - Step cards (§4.26.C): glass (`rgba(15, 14, 22, 0.65)` + blur
   *   10px), hover purple glow + slight lift (reduced motion: instant
   *   glow, no lift), a decorative pixel mini-illustration top-right
   *   per card (§4.3 art in `landing/sectionArt.ts`) and the bottom
   *   micro-pills (§4.26.L exact strings).
   * - Footer (§4.26.D): the dark liquid-glass pill — the pixel-frame
   *   construction is retired from it; content contract verbatim.
   * - The FOUR new sections (§4.26.E–I, after the steps, before the
   *   footer): sim (#sim, no nav link) → privacy (#privacy) →
   *   use-cases (#use-cases) → join (#join) — the shared glass recipe
   *   (`rgba(18, 15, 28, 0.45)` + blur 16px + the white border +
   *   inset highlight + radius-md), the SCOUT + BLEAK-WAVE figures, the
   *   sim chat window and the GET EARLY ACCESS mailto stub (§4.26.I-2:
   *   a plain `<a>` — no form, no fetch, no validation; the stub swaps
   *   to a button + handler when a real endpoint lands).
   * - Reminders REMOVED (§4.23.C) — stays removed.
   * - Behavior (§4.20.L + §4.22.A): the /income entry points are
   *   EXACTLY TWO — the Start CTA and the agent-card TALK; nothing on /
   *   fetches; the join deep links still forward to /income.
   * - RU/EN parity: 58 landing keys (§4.26.L); the header switch
   *   re-renders the page without a reload.
   */
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { page } from '$app/state';
  import { locale, translate } from '#lib/i18n/locale';
  import LocaleControl from '#lib/components/join/LocaleControl.svelte';
  import PixelIcon from '#lib/components/icons/PixelIcon.svelte';
  import LandingVideoHero from '#lib/components/landing/LandingVideoHero.svelte';
  import LandingFigure from '#lib/components/landing/LandingFigure.svelte';
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
</script>

<!-- §4.22.F: the full-bleed landing page background — --color-landing-bg
     (scoped to /; every other page keeps --color-bg); §4.24.A: the single
     80%-width content container is centered inside. -->
<div class="landing-page">
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
      <!-- §4.25.A: the hero region — desktop ≥720px .stage IS the 100dvh
           hero (the thirds grid, everything centered); phone stacks in DOM
           order with .area-lead as the 100dvh hero. -->
      <div class="stage">
        <!-- the lead — HEADLINE BLOCK + START CTA (§4.20.C verbatim),
             TRANSPARENT and BORDERLESS (§4.25.B — §37.2): NO pixel frame,
             NO panel, NO border — the copy sits directly over the video
             background; legibility = the token-only text halo. -->
        <section class="copy area-lead">
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
             floating over the video -->
        <section class="area-agents" id="agents">
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
      <section class="area-stat">
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
              <LandingFigure kind="bloom" size={48} />
              <span class="stat-status">
                <span class="status-dot" aria-hidden="true"></span>
                {translate($locale, 'landing.banner.status')}
              </span>
            </div>
          </div>
        </article>
      </section>

      <!-- the three BIG step blocks (§4.21.E as amended by §4.26.C):
           FIND → CHAT → SHARE — glass fill, hover glow/lift, a decorative
           pixel mini-illustration top-right and the bottom micro-pill;
           the section id RENAMED tutorial → how-it-works (§4.26.K.3, the
           HOW IT WORKS anchor target). -->
      <section class="tutorial area-tutorial" id="how-it-works">
        <ol class="steps">
          {#each tutorialSteps as step (step.icon)}
            <li class="step-block pixel-corners pixel-frame pixel-frame--strong">
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
                  <PixelIcon name={step.icon} size={32} />
                </span>
                <p class="step-desc">{step.desc}</p>
                <span class="step-pill">{step.pill}</span>
              </div>
            </li>
          {/each}
        </ol>
      </section>

      <!-- SECTION 4 — LIVE AGENT SIMULATION (§4.26.F): id="sim" — no nav
           anchor targets it (§4.26.O.6). One wide glass container: the
           BLEAK personage (purple glow) + YOUR AGENT / Status: Scanning...
           with the blinking pixel cursor on the left, the NEW SCOUT figure
           (cyan glow) + NEARBY AGENT / Distance: 15m on the right, and the
           opaque dark pixel-frame chat window in the center — exactly 3
           rows + the glowing green ICE BROKEN badge. -->
      <section class="area-sim" id="sim">
        <article class="sim-card">
          <h2 class="section-title">{translate($locale, 'landing.sim.title')}</h2>
          <div class="sim-grid">
            <div class="sim-agent sim-you">
              <span class="sim-portrait sim-portrait--you">
                <LandingFigure kind="bleak" size={64} idle={false} />
              </span>
              <span class="sim-agent-name">{translate($locale, 'landing.sim.you')}</span>
              <span class="sim-status sim-status--you">
                {translate($locale, 'landing.sim.you.status')}
                <span class="sim-cursor" aria-hidden="true"></span>
              </span>
            </div>
            <div class="sim-agent sim-nearby">
              <span class="sim-portrait sim-portrait--nearby">
                <LandingFigure kind="scout" size={64} idle={false} />
              </span>
              <span class="sim-agent-name">{translate($locale, 'landing.sim.nearby')}</span>
              <span class="sim-status sim-status--nearby">
                {translate($locale, 'landing.sim.nearby.status')}
              </span>
            </div>
            <!-- the chat is the "screen" — opaque, it does not blur -->
            <div class="sim-chat pixel-corners pixel-frame pixel-frame--strong">
              <div class="sim-chat-body pixel-corners">
                <div class="sim-row sim-row--left">
                  <span class="sim-who">{translate($locale, 'landing.sim.who1')}</span>
                  <p class="sim-msg">{translate($locale, 'landing.sim.msg1')}</p>
                </div>
                <div class="sim-row sim-row--right">
                  <span class="sim-who">{translate($locale, 'landing.sim.who2')}</span>
                  <p class="sim-msg">{translate($locale, 'landing.sim.msg2')}</p>
                </div>
                <div class="sim-row sim-row--badge">
                  <span class="sim-badge">{translate($locale, 'landing.sim.badge')}</span>
                </div>
              </div>
            </div>
          </div>
        </article>
      </section>

      <!-- SECTION 5 — PRIVACY & CONTROL (§4.26.G): id="privacy" (nav
           target). One glass container; the three inner cards are
           transparent + hairline (no nested blur) — GHOST MODE / MUTUAL
           OPT-IN / EPHEMERAL GPS with the 16×16 pixel icons. -->
      <section class="area-privacy" id="privacy">
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
            <li class="usecase-pill">
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
      <section class="area-join" id="join">
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
      <footer class="contact area-foot">
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
   * the ONE container rule: max(80%, 280px) wide, centered — every
   * section lives inside it (the 1000px canvas cap is retired as a width
   * rule, §4.24.F.2). */
  .landing-page {
    min-height: 100dvh;
    background: var(--color-landing-bg);
  }
  .landing {
    position: relative;
    z-index: 3;
    width: max(80%, 280px);
    margin-inline: auto;
    /* §4.25.A: top padding retired — the fixed header contributes no flow
     * height, and the hero region must span the full first viewport from
     * the page top ("100dvh minus nothing"); inline + bottom padding stay */
    padding: 0 var(--space-5) var(--space-5);
    display: flex;
    flex-direction: column;
    gap: var(--space-6);
  }
  @media (min-width: 720px) {
    .landing {
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
   * Width: the viewport is the containing block — width 90%,
   * max-width 1200px, margin-inline auto centers it (1152px at 1280,
   * 720px at 800, 351px at 390, 288px at 320 — deliberately WIDER than
   * the 80% content column, §4.26.O.5). The §4.24.A container breakout
   * retires. Where backdrop-filter cannot run the fallback is a single
   * higher-opacity tint so text stays readable. The AA tradeoff over
   * bright video frames is the owner's recorded owner-order exception
   * (§4.25.C carries). Keep-list, inner paddings, min-heights and z 10
   * unchanged. */
  .top {
    position: fixed;
    top: 24px;
    left: 0;
    right: 0;
    margin-inline: auto;
    width: 90%;
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
    font-size: 12px;
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
   * PHONE: the DOM order below IS the mobile stack — fixed glass header →
   * lead (transparent, the 100dvh hero region — the Start block centered
   * in screen 1) → agent card (NEXT in flow) → stat card → the three step
   * blocks → contact footer (everything overlays the fixed video
   * background; the §4.24.E `calc(200dvh / 3)` spacer is DELETED — the
   * open state is produced entirely by the 100dvh constructions,
   * §4.25.D.1).
   * Desktop (≥720px): the §4.24.D THIRDS grid as the HERO REGION —
   * `min-height: 100dvh` + `align-content: center` + `align-items: center`
   * (superseding §4.24.D's `align-items: start`, §4.25.D.6): the lead in
   * column 1, the agent card in column 3, the middle third EMPTY (the
   * video + vignette + dots show through; nothing is placed in column 2);
   * lead + BLEAK float vertically centered in the first viewport,
   * side-by-side. The stat card, step blocks and footer flow AFTER the
   * hero region (below the fold initially, revealed on scroll). */
  .canvas {
    display: flex;
    flex-direction: column;
    gap: var(--space-6);
    min-width: 0;
  }
  .stage {
    display: flex;
    flex-direction: column;
    gap: var(--space-6);
    min-width: 0;
  }
  @media (max-width: 719.98px) {
    /* the phone hero region: the Start block centers in the first screen;
     * BLEAK is the immediately following block in flow */
    .area-lead {
      min-height: 100dvh;
      display: flex;
      flex-direction: column;
      justify-content: center;
    }
  }
  @media (min-width: 720px) {
    .stage {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      column-gap: var(--space-6);
      /* the hero row = the whole first viewport, everything centered */
      min-height: 100dvh;
      align-content: center;
      align-items: center;
    }
    .area-lead {
      grid-column: 1;
    }
    .area-agents {
      grid-column: 3;
    }
    /* column 2: NO element — nothing is placed there (§4.24.D) */
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
   * spacing that keeps the copy clear of the thirds edge — it is not a
   * panel. The Start button is unchanged (an opaque violet pill — it
   * never relied on the panel). Narrower (§4.24.C): the lead fills its
   * thirds column — ≈ 288px at 1280 (100% of the container content width
   * on phone). */
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
      align-items: flex-start;
      text-align: left;
      padding: 28px;
    }
  }
  .headline {
    font-family: var(--font-pixel);
    font-weight: 600;
    font-size: 36px;
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
      font-size: 44px;
    }
  }
  @media (min-width: 720px) {
    /* §4.24.C size amendment: 64px mid-word-breaks inside a 288px third —
     * the clamp caps at 44px at 1280 and scales down with the third */
    .headline {
      font-size: clamp(22px, 3.5vw, 44px);
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
    font-size: 14px;
    color: var(--color-text-muted);
    max-width: 40ch;
    /* the §4.25.B legibility halo (the softer ambient tail) */
    text-shadow:
      0 1px 2px color-mix(in srgb, var(--color-surface) 90%, transparent),
      0 0 10px color-mix(in srgb, var(--color-surface) 55%, transparent);
  }
  @media (min-width: 720px) {
    .sub {
      font-size: 16px;
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
    font-size: 16px;
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
    font-size: 24px;
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
    font-size: 11px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--color-deepa-4);
  }
  .agent-traits {
    margin: 0;
    font-family: var(--font-pixel);
    font-weight: 600;
    font-size: 11px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--color-text-muted);
  }
  .agent-quote {
    margin: 0;
    font-family: var(--font-body);
    font-size: 13px;
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
    align-items: center;
    justify-content: space-between;
    gap: var(--space-4);
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
    font-size: 11px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--color-deepa-4);
    line-height: 1.2;
  }
  .stat-title {
    font-family: var(--font-pixel);
    font-weight: 600;
    font-size: 17px;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--color-text);
    margin: 0 0 var(--space-2);
  }
  .stat-line {
    margin: 0 0 2px;
    font-family: var(--font-body);
    font-size: 13px;
    line-height: 1.35;
    color: var(--color-text-muted);
  }
  /* the glyph becomes a small right column: BLOOM on top, below it the
   * glowing status caption with the pulsing green pixel dot (§4.26.B). */
  .stat-glyph {
    flex: none;
    line-height: 0;
    display: flex;
    flex-direction: column;
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
    font-size: 11px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--color-text);
    /* the glowing caption read */
    text-shadow: 0 0 8px color-mix(in srgb, var(--color-deepa-1) 45%, transparent);
  }
  .status-dot {
    width: 6px;
    height: 6px;
    flex: none;
    background: var(--color-deepa-1);
    box-shadow: 0 0 6px color-mix(in srgb, var(--color-deepa-1) 70%, transparent);
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
    width: 44px;
    height: 44px;
  }
  @media (min-width: 720px) {
    .stat-body {
      padding: 16px 20px;
    }
    .stat-glyph :global(svg) {
      width: 48px;
      height: 48px;
    }
  }

  /* ---------- the three BIG step blocks (§4.21.E as amended by §4.26.C) ----------
   * FIND → CHAT → SHARE: one step per display block — pixel step number,
   * pixel-font title, step icon, one-line description. §4.26.C: the body
   * fill becomes the owner's glass (rgba(15, 14, 22, 0.65) + blur(10px);
   * the pixel frame stays square/stepped over the glass), the blocks gain
   * the hover purple glow + slight lift (no click handler, no cursor
   * change — they still navigate nowhere), each carries its decorative
   * mini-illustration top-right and the §4.26.L bottom micro-pill. */
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
    background: rgba(15, 14, 22, 0.65);
    -webkit-backdrop-filter: blur(10px);
    backdrop-filter: blur(10px);
    position: relative;
    padding: 16px;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-2);
  }
  /* the §4.26.C decorative mini-illustration: top-right of the card,
   * token fills, transparent background, no plate. */
  .step-art {
    position: absolute;
    top: 12px;
    right: 12px;
    width: 48px;
    height: 48px;
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
    font-size: 20px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--color-text);
    margin: 0;
  }
  .step-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    color: var(--color-text-muted);
  }
  .step-desc {
    margin: 0;
    font-family: var(--font-body);
    font-size: 13px;
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
    font-size: 10px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--color-deepa-4);
  }
  @media (min-width: 720px) {
    .step-pill {
      margin-top: auto;
      font-size: 11px;
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
  /* the shared section title: Handjet 20px uppercase, the §4.20.A glow */
  .section-title {
    font-family: var(--font-pixel);
    font-weight: 600;
    font-size: 20px;
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
      'chat chat';
    gap: var(--space-4);
    align-items: center;
  }
  .sim-you {
    grid-area: you;
  }
  .sim-nearby {
    grid-area: nearby;
  }
  .sim-chat {
    grid-area: chat;
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
    font-size: 14px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--color-text);
  }
  .sim-status {
    display: inline-flex;
    align-items: center;
    font-family: var(--font-pixel);
    font-weight: 600;
    font-size: 12px;
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
  /* the dark pixel chat window: the established card pattern — opaque
   * (the chat is the "screen", it does not blur), stepped square frame. */
  .sim-chat {
    width: min(100%, 420px);
    margin-inline: auto;
  }
  .sim-chat-body {
    background: var(--color-surface);
    padding: 12px 16px;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  .sim-row--right {
    text-align: right;
  }
  .sim-row--badge {
    text-align: center;
  }
  .sim-who {
    display: block;
    font-family: var(--font-pixel);
    font-weight: 600;
    font-size: 10px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--color-text-muted);
  }
  .sim-msg {
    margin: 0;
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--color-text);
  }
  .sim-badge {
    display: inline-flex;
    font-family: var(--font-pixel);
    font-weight: 600;
    font-size: 12px;
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
      grid-template-areas: 'you chat nearby';
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
    width: 48px;
    height: 48px;
  }
  .privacy-title {
    font-family: var(--font-pixel);
    font-weight: 600;
    font-size: 14px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--color-text);
    margin: 0;
  }
  .privacy-desc {
    margin: 0;
    font-family: var(--font-body);
    font-size: 13px;
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
    width: 40px;
    height: 40px;
  }
  .usecase-label {
    font-family: var(--font-pixel);
    font-weight: 600;
    font-size: 14px;
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
    font-size: 20px;
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
      font-size: 24px;
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
    font-size: 16px;
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
