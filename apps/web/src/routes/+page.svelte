<script lang="ts">
  /**
   * `/` — the landing page (tz12-06, Concept §31+§32+§33+§34, DESIGN §4.22
   * amending §4.21/§4.20 item by item):
   *
   * - Canvas: the NEW §4.22.F page background — `--color-landing-bg` (the
   *   near-black page matching the hero video's own near-black background),
   *   painted full-bleed by the page wrapper; the 1000px content canvas is
   *   centered inside. Every other page keeps --color-bg.
   * - Section 1 — header (§4.22.A, taglines dropped): ONLY the web icon
   *   (the §30 FormShell mark, plate-less, cutouts in
   *   `--color-landing-bg`), the desktop-only in-page anchors and the
   *   working RU/EN switch (the shared LocaleControl) — one non-sticky row;
   *   on phone the header is icon + switcher only.
   * - Section 2 — the `.stage` hero (§4.22.B as amended by §4.22.1): DOM
   *   order = the phone stacking order — lead block (headline +
   *   subheadline + Start CTA, §4.20.C verbatim) → video block
   *   (`LandingVideoHero`: the owner's 16:9 video, full common-block
   *   width, the vignette dissolve into the page token, the animated
   *   purple pixels, the bottom-fixed reminder §4.22.C, the gated play
   *   control) → the BLEAK agent card (§4.20.G-b as renamed §4.22.D).
   *   Desktop ≥720px: the lead and agent blocks OVERLAY the video from
   *   their sides (floating over the video's vignette-dissolved dark
   *   edges, vertically centered on the video). The mascot-chat strip
   *   (§4.20.F) is RETIRED (§4.22.1 owner amendment — the video's own
   *   cast is the only animated center content). PHONE: no overlay — the
   *   blocks stack in exactly this order.
   * - Section 3: the stat card — compact per §4.21.F, full-width — then
   *   the three BIG step blocks (§4.21.E): FIND / CHAT / SHARE.
   * - Footer (§4.21.G): the site contact block — extube@proton.me +
   *   github.com/extube with RU/EN labels.
   * - Mascots (§4.20.J as amended by §4.22.I/§4.22.1): two figures —
   *   BLEAK (the agent card, promoted shared personage §4.22.E) and
   *   BLOOM (stat card). PIP + GLITCH retire with the chat strip
   *   (§4.22.1); NOVA + ASTRA retired with the drawn hero scene
   *   (§4.22.G) — the video carries its own cast.
   * - Behavior (§4.20.L + §4.21.G amendment, §4.22.A made exact): the
   *   /income entry points are EXACTLY TWO — the Start CTA and the
   *   agent-card TALK (the header START controls are removed, §4.22.A);
   *   nothing on / fetches; the join deep links (?code= / ?u=) still
   *   forward to /income with the query preserved (the §3.1 guard,
   *   unchanged).
   * - RU/EN parity: every landing string goes through the 35 §4.20.M +
   *   §4.21.H + §4.22.H keys; the header switch re-renders the page
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

  const videoAria = $derived(translate($locale, 'landing.video.aria'));
  const videoPlay = $derived(translate($locale, 'landing.video.play'));
  const videoPause = $derived(translate($locale, 'landing.video.pause'));

  const dialogLines = $derived([
    translate($locale, 'landing.dialog.line1'),
    translate($locale, 'landing.dialog.line2'),
    translate($locale, 'landing.dialog.line3')
  ]);

  /* The §4.21.E step blocks: number/title/icon/mini-description — the
   * numbers are locale-invariant literals; titles reuse the §4.20.M keys. */
  const tutorialSteps = $derived([
    {
      num: '01',
      icon: 'search',
      label: translate($locale, 'landing.tutorial.search'),
      desc: translate($locale, 'landing.steps.find.desc')
    },
    {
      num: '02',
      icon: 'dialog-lines',
      label: translate($locale, 'landing.tutorial.chat'),
      desc: translate($locale, 'landing.steps.chat.desc')
    },
    {
      num: '03',
      icon: 'contact-share',
      label: translate($locale, 'landing.tutorial.share'),
      desc: translate($locale, 'landing.steps.share.desc')
    }
  ] as const);

  /* §4.21.G: the kept copyright line splits into the Handjet brand name +
   * the Inter muted year (the contact block's row 1). */
  const copyright = $derived(translate($locale, 'landing.footer.copyright'));
  const copyrightBrand = $derived(copyright.split(' · ')[0] ?? '');
  const copyrightYear = $derived(copyright.split(' · ')[1] ?? '');
</script>

<!-- §4.22.F: the full-bleed landing page background — --color-landing-bg
     (scoped to /; every other page keeps --color-bg), the 1000px canvas
     centered inside. -->
<div class="landing-page">
  <div class="landing">
    <!-- SECTION 1 — HEADER (§4.22.A): the web icon + the navigation + the
         language switcher ONLY — one non-sticky row; on phone icon +
         switcher (the anchors are a desktop convenience). -->
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
      <!-- desktop-only in-page anchors; their accessible names reuse the
           §4.20.M keys (§4.20.M: no extra nav keys). -->
      <div class="top-nav">
        <a href="#tutorial">
          {translate($locale, 'landing.tutorial.search')} →
          {translate($locale, 'landing.tutorial.chat')} →
          {translate($locale, 'landing.tutorial.share')}
        </a>
        <a href="#agents">{translate($locale, 'landing.agent.name')}</a>
      </div>
      <div class="locale"><LocaleControl /></div>
    </header>

    <main class="canvas">
      <!-- SECTION 2 · the .stage hero (§4.22.B as amended by §4.22.1). DOM
           order = the phone stacking order: lead → video → agent card. -->
      <div class="stage">
        <!-- SECTION 2 · lead — HEADLINE BLOCK + START CTA (§4.20.C verbatim) -->
        <section class="copy area-lead">
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
        </section>

        <!-- SECTION 2 · video — the §4.22.B video block (the owner's video,
             the vignette dissolve, the purple pixels, the bottom-fixed
             reminder, the gated play control) -->
        <div class="area-video">
          <LandingVideoHero
            aria={videoAria}
            playLabel={videoPlay}
            pauseLabel={videoPause}
            lines={dialogLines}
            srLine={dialogLines[0] ?? ''}
          />
        </div>

        <!-- SECTION 2 · agent — AGENT CHARACTER CARD (§4.20.G-b, renamed
             BLEAK per §4.22.D) -->
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

      <!-- SECTION 3 · STAT / FEATURE CARD (§4.20.G-a, compact per §4.21.F) -->
      <section class="area-stat">
        <article class="card pixel-corners pixel-frame pixel-frame--strong stat-card">
          <div class="card-body pixel-corners stat-body">
            <div class="stat-copy">
              <h2 class="stat-title">{translate($locale, 'landing.stat.title')}</h2>
              <p class="stat-line">{translate($locale, 'landing.stat.line1')}</p>
              <p class="stat-line">{translate($locale, 'landing.stat.line2')}</p>
              <p class="stat-line">{translate($locale, 'landing.stat.line3')}</p>
            </div>
            <div class="stat-glyph">
              <LandingFigure kind="bloom" size={48} />
            </div>
          </div>
        </article>
      </section>

      <!-- SECTION 3 · the three BIG step blocks (§4.21.E):
           FIND → CHAT → SHARE, number + pixel title + icon + description -->
      <section class="tutorial area-tutorial" id="tutorial">
        <ol class="steps">
          {#each tutorialSteps as step (step.icon)}
            <li class="step-block pixel-corners pixel-frame pixel-frame--strong">
              <div class="step-body pixel-corners">
                <span class="step-num" aria-hidden="true">{step.num}</span>
                <h3 class="step-title">{step.label}</h3>
                <span class="step-icon">
                  <PixelIcon name={step.icon} size={32} />
                </span>
                <p class="step-desc">{step.desc}</p>
              </div>
            </li>
          {/each}
        </ol>
      </section>

      <!-- FOOTER — the §4.21.G site contact block -->
      <footer class="contact area-foot pixel-corners pixel-frame pixel-frame--strong">
        <div class="foot-body pixel-corners">
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
   * near-black, 5% Deepa cast) — scoped to /; the 1000px canvas centered
   * inside. */
  .landing-page {
    min-height: 100dvh;
    background: var(--color-landing-bg);
  }
  .landing {
    width: 100%;
    max-width: 1000px;
    margin: 0 auto;
    padding: var(--space-5);
    display: flex;
    flex-direction: column;
    gap: var(--space-6);
  }
  @media (min-width: 720px) {
    .landing {
      padding: var(--space-7);
    }
  }

  /* ---------- section 1: header (§4.22.A — slimmed) ---------- */
  .top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--space-4);
    min-height: 56px;
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
    /* icon · anchors · switcher, left→right (§4.22.A) */
    .top-nav {
      display: flex;
    }
  }

  /* ---------- sections 2 + 3: the canvas (§4.22.B) ----------
   * PHONE ORDER (§4.20.K preserved, chat strip retired §4.22.1): the DOM
   * order below IS the mobile stack — header → headline → sub → Start →
   * video block (the reminder lives inside it at the bottom) → agent card
   * → stat card → the three step blocks → contact footer. Desktop (≥720px)
   * overlays the lead/agent blocks on the video's side edges — CSS-only
   * re-composition, same DOM. */
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
  @media (min-width: 720px) {
    /* §4.22.B desktop composition (the chat-strip slot retired, §4.22.1):
     * the video is the full common-block width (it spans the whole row);
     * the lead (27%) and agent-card (26%) blocks overlay the video's side
     * edges, vertically centered on the video, ABOVE it in z-order. The
     * 47% clear center band (100% − 27% − 26%) is the reminder's §4.22.C
     * desktop cap band. */
    .stage {
      display: grid;
      grid-template-columns: 27% minmax(0, 1fr) 26%;
      align-items: center;
      column-gap: var(--space-6);
    }
    .area-video {
      grid-column: 1 / -1;
      grid-row: 1;
      z-index: 0;
      min-width: 0;
    }
    .area-lead {
      grid-column: 1;
      grid-row: 1;
      z-index: 2;
    }
    .area-agents {
      grid-column: 3;
      grid-row: 1;
      z-index: 2;
    }
  }

  /* ---------- headline block (§4.20.C, unchanged) ---------- */
  .copy {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: var(--space-4);
    min-width: 0;
  }
  .headline {
    font-family: var(--font-pixel);
    font-weight: 600;
    font-size: 36px;
    line-height: 1.05;
    text-transform: uppercase;
    color: var(--color-text);
    overflow-wrap: anywhere;
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
    .copy {
      align-items: flex-start;
      text-align: left;
    }
    .headline {
      font-size: 64px;
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
  .stat-body {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-4);
    padding: 12px 14px;
  }
  .stat-copy {
    min-width: 0;
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
  .stat-glyph {
    flex: none;
    line-height: 0;
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

  /* ---------- the three BIG step blocks (§4.21.E) ----------
   * FIND → CHAT → SHARE: one step per display block — pixel step number,
   * pixel-font title, step icon, one-line description. Non-interactive:
   * no hover/press states, no motion (§4.6 no scroll-triggered motion). */
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
  }
  .step-body {
    background: var(--color-surface);
    padding: 16px;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-2);
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

  /* ---------- contact footer (§4.21.G) ----------
   * One pixel-framed site contact block, centered: row 1 = the kept
   * copyright content (logo + brand + year), row 2 = EMAIL + GITHUB. */
  .contact {
    width: 100%;
    max-width: 560px;
    margin: 0 auto;
  }
  .foot-body {
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
</style>
