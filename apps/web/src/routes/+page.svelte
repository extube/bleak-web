<script lang="ts">
  /**
   * `/` — the landing page (tz12-08, Concept §36, DESIGN §4.24 amending
   * §4.23 → §4.22 → §4.21 → §4.20 item by item):
   *
   * - Canvas: the §4.22.F page background stays — `--color-landing-bg` (the
   *   near-black page matching the video's own near-black background),
   *   painted full-bleed by the page wrapper. §4.24.A: ONE container rule —
   *   `.landing` is `max(80%, 280px)` wide, centered (the §4.20 1000px
   *   canvas cap is retired as a width rule); every section lives inside
   *   that one 80% column.
   * - §4.23.A fixed background: `LandingVideoHero` (REPURPOSED in place) is
   *   the FIRST child of `.landing-page` — a fixed full-viewport video
   *   layer (z 0) + dissolve vignette + 30% tint (z 1) + the 12-dot purple
   *   mesh (z 2); ALL landing blocks scroll OVER it as overlays. The
   *   §4.22.B "center video block" geometry and the phone no-overlay rule
   *   are superseded (§4.23.E).
   * - Header (§4.23.B, as amended by §4.24.A/B): the floating LIQUID-GLASS
   *   panel — sticky at 12px, frosted translucent fill + backdrop blur(14px)
   *   saturate(1.1) + violet hairline, ROUNDED corners (radius-lg desktop /
   *   radius-md phone chip — the ONLY rounded surface left, §4.24.F.4). It
   *   is the same 80% column as the content, via the container breakout
   *   (`calc(100% + 2 * padding)` + matching negative `margin-inline`).
   *   Two-tier glass fill (§4.24.B): 92% where blur cannot run (the
   *   fallback floor), 88% inside `@supports` where the blur actually
   *   renders. Keep-list UNCHANGED (§4.22.A): the web icon (cutouts in
   *   `--color-landing-bg`), the desktop-only in-page anchors and the
   *   working RU/EN switch; on phone the header is the smaller chip —
   *   icon + switcher only.
   * - Lead section (§4.24.C): headline + subheadline + Start CTA
   *   (§4.20.C verbatim; the desktop headline adapts via
   *   `clamp(22px, 3.5vw, 44px)`) in a FULLY OPAQUE solid panel — the
   *   §4.20.G pixel-frame construction (`--color-surface` body, square
   *   corners), NO glass/translucency — the contrast with the glass header
   *   is intentional.
   * - Thirds layout (§4.24.D, desktop ≥720px): the first content row is
   *   `repeat(3, 1fr)` — the lead in column 1, the BLEAK agent card in
   *   column 3, the MIDDLE THIRD EMPTY (the fixed video + vignette + dots
   *   show through; no element is placed in column 2). The §4.23.D
   *   `minmax(0,1fr) 360px` row and the 360px cap retire.
   * - Phone open state (§4.24.E): on phones the first content block starts
   *   below the two-thirds mark — `main.canvas` gets
   *   `padding-top: calc(200dvh / 3)` at <720px; desktop has no offset.
   * - Stat card (§4.21.F compact) + the three BIG step blocks (§4.21.E):
   *   FIND / CHAT / SHARE — opaque pixel frames, floating over the video,
   *   full-width rows of the 80% container below the thirds row.
   * - Footer (§4.21.G): the site contact block — extube@proton.me +
   *   github.com/extube with RU/EN labels.
   * - Reminders REMOVED (§4.23.C, §35 item 3): LandingReminder, its props,
   *   the play control and the dialog/video i18n keys are all retired —
   *   pure subtraction (§4.23.E supersessions).
   * - Mascots: two figures — BLEAK (the agent card) and BLOOM (stat card);
   *   the video carries its own cast.
   * - Behavior (§4.20.L + §4.22.A made exact): the /income entry points
   *   are EXACTLY TWO — the Start CTA and the agent-card TALK; nothing on
   *   / fetches; the join deep links (?code= / ?u=) still forward to
   *   /income with the query preserved (the §3.1 guard, unchanged).
   * - RU/EN parity: every landing string goes through the landing keys;
   *   the header switch re-renders the page without a reload.
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
     (scoped to /; every other page keeps --color-bg); §4.24.A: the single
     80%-width content container is centered inside. -->
<div class="landing-page">
  <!-- §4.23.A: the fixed full-viewport video background — the FIRST child
       of .landing-page, before .landing; the page content scrolls over it. -->
  <LandingVideoHero />
  <div class="landing">
    <!-- SECTION 1 — HEADER (§4.23.B, §4.24.A/B): the floating liquid-glass
         panel — sticky at 12px, frosted translucent fill + backdrop blur +
         violet hairline + rounded corners (radius-lg desktop / radius-md
         phone chip), spanning the container's full 80% via the breakout.
         Keep-list (§4.22.A verbatim): the web icon + the navigation + the
         language switcher ONLY; on phone icon + switcher (the anchors are
         a desktop convenience). -->
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
      <!-- §4.24.D: the thirds grid — desktop ≥720px the lead (column 1) and
           the agent card (column 3) share one row; the MIDDLE THIRD (column
           2) stays EMPTY — the fixed video + vignette + dots show through.
           Phone stacks in DOM order (below the §4.24.E open-state spacer). -->
      <div class="stage">
        <!-- the lead — HEADLINE BLOCK + START CTA (§4.20.C verbatim) in the
             §4.24.C FULLY OPAQUE panel: the §4.20.G pixel-frame
             construction, solid --color-surface body, SQUARE corners (the
             header is now the ONLY rounded surface, §4.24.F.4) — no glass,
             no translucency. -->
        <section class="copy area-lead pixel-corners pixel-frame pixel-frame--strong">
          <div class="copy-body pixel-corners">
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

      <!-- STAT / FEATURE CARD (§4.20.G-a, compact per §4.21.F) -->
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

      <!-- the three BIG step blocks (§4.21.E):
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

  /* ---------- section 1: the liquid-glass header (§4.23.B, §4.24.A/B) ----
   * Floating rounded glass panel over the video: sticky at 12px; §4.24.A:
   * the header is the SAME 80% column as the content, via the container
   * breakout — width = container + 2 × its own padding, negative
   * margin-inline pulling it out (no vw units — a classic scrollbar can
   * never make it outgrow the viewport). The §4.23.B inset chip width
   * retires (§4.24.F.1). Translucent fill via the black token family,
   * backdrop blur(14px) + saturate(1.1), a subtle violet hairline (22%
   * Deepa) and rounded corners — radius-lg desktop / radius-md phone chip
   * (the ONLY rounded surface, §4.24.F.4). §4.24.B two-tier fill: tier 1 =
   * 92% (the no-blur fallback floor — its AA math is unchanged, ≈ 5.0:1
   * worst case); tier 2 = 88% inside @supports, where the blur actually
   * runs (blur-inclusive worst case ≈ 5.2:1 — the 14px kernel diffuses a
   * worst-case white pixel, muted text holds AA ≥ 4.5). The blur radius
   * and saturation lift are unchanged; the hairline is unchanged. */
  .top {
    position: sticky;
    top: var(--space-3);
    z-index: 10;
    width: calc(100% + 2 * var(--space-5));
    margin-inline: calc(-1 * var(--space-5));
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--space-4);
    min-height: 52px;
    padding: 8px 10px;
    /* tier 1 — the @supports fallback floor (§4.23.B math unchanged) */
    background: color-mix(in srgb, var(--color-landing-bg) 92%, transparent);
    -webkit-backdrop-filter: blur(14px) saturate(1.1);
    backdrop-filter: blur(14px) saturate(1.1);
    border: 1px solid color-mix(in srgb, var(--color-deepa-4) 22%, transparent);
    border-radius: var(--radius-lg);
  }
  @supports (backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px)) {
    /* tier 2 — 12% show-through: the blur becomes perceptible (§4.24.B) */
    .top {
      background: color-mix(in srgb, var(--color-landing-bg) 88%, transparent);
    }
  }
  @media (max-width: 719.98px) {
    /* the smaller phone chip reads 20px (§4.23.B) */
    .top {
      border-radius: var(--radius-md);
    }
  }
  @media (min-width: 720px) {
    .top {
      width: calc(100% + 2 * var(--space-7));
      margin-inline: calc(-1 * var(--space-7));
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

  /* ---------- the content column over the video (§4.24.D/E) ----------
   * PHONE: the DOM order below IS the mobile stack — glass header chip →
   * lead opaque panel → agent card → stat card → the three step blocks →
   * contact footer (everything overlays the fixed video background).
   * §4.24.E: on phones the site "opens" on pure video — the first content
   * block starts below the two-thirds mark, via padding-top on the content
   * wrapper (dvh tracks the mobile URL bar; desktop has NO offset).
   * Desktop (≥720px): the §4.24.D THIRDS grid — lead in column 1, the
   * agent card in column 3, the middle third EMPTY (the video + vignette
   * + dots show through; nothing is placed in column 2). The §4.23.D
   * `minmax(0,1fr) 360px` row and the 360px agent-card cap retire
   * (§4.24.F.5) — the card fills its third (≈ 288px at 1280). */
  .canvas {
    display: flex;
    flex-direction: column;
    gap: var(--space-6);
    min-width: 0;
  }
  @media (max-width: 719.98px) {
    /* the §4.24.E open state: exactly 2/3 of the viewport before the
     * first content block — the floating glass header + pure video only */
    .canvas {
      padding-top: calc(200dvh / 3);
    }
  }
  .stage {
    display: flex;
    flex-direction: column;
    gap: var(--space-6);
    min-width: 0;
  }
  @media (min-width: 720px) {
    .stage {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      column-gap: var(--space-6);
      align-items: start;
    }
    .area-lead {
      grid-column: 1;
    }
    .area-agents {
      grid-column: 3;
    }
    /* column 2: NO element — nothing is placed there (§4.24.D) */
  }
  /* anchored sections never hide under the stuck glass panel (§4.23.B) */
  .area-agents,
  .area-tutorial {
    scroll-margin-top: 80px;
  }

  /* ---------- lead block (§4.20.C verbatim copy; §4.24.C OPAQUE) ----------
   * The §4.23.D liquid-glass lead panel is RETIRED (§4.24.F.3): the lead
   * is a solid panel in the §4.20.G card language — outer pixel frame +
   * inner `--color-surface` body, SQUARE/stepped corners (with the glass
   * gone, the rounded exception applies only to the header). NO
   * backdrop-filter, no translucent fill — the pixel frame IS the border.
   * Narrower (§4.24.C): the lead fills its thirds column — ≈ 288px at
   * 1280 (100% of the container content width on phone); the §4.23.D
   * content-sized/560px lead sizing retires. */
  .copy {
    min-width: 0;
    width: 100%;
  }
  .copy-body {
    background: var(--color-surface);
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
