<script lang="ts">
  /**
   * `/` — the landing page (tz12-04, Concept §31 + §32, DESIGN §4.20):
   * REBUILT from zero per the owner's design example
   * (landing-design-example.png — mood/structure adapted to OUR story:
   * effective networking with AI agents, not the example's dating scene).
   *
   * - Canvas: the existing --color-bg (near-black, the example's canvas);
   *   the landing accent is the approved Deepa violet (--color-deepa-4 —
   *   the example's purple bloom; every color is an existing §4.1 token or
   *   a color-mix alpha variant; no new values, no new dependencies, no
   *   canvas, no animation library).
   * - Header: pixel-font taglines (left pair always; top-center and the
   *   right pair + GLITCH glyph on desktop), the working RU/EN switch
   *   (the shared LocaleControl), desktop in-page anchors and the START
   *   pill (mobile) / text link (desktop).
   * - Headline: three lines with the single highlighted accent word
   *   (glow + pixel sparkles), subheadline, the START CTA.
   * - Hero: the NOVA-meets-BYTE pixel-art scene with the glowing
   *   handshake-node focal element (§4.20.D).
   * - Retro dialogue-box: the signature element — 3 cycling asterisk
   *   lines + blinking pixel caret (§4.20.E).
   * - Mascot-chat animation strip: PIP ↔ GLITCH pixel speech bubbles,
   *   typewriter loop (§4.20.F).
   * - Framed cards: the stat card (BLOOM) + the agent character card
   *   (VECTOR, single TALK action → /income) (§4.20.G).
   * - Tutorial: exactly 3 pixel icons — FIND → CHAT → SHARE (search →
   *   chatting → contacts sharing) with pixel-chevron connectors
   *   (§4.20.H).
   * - Footer blocks: positioning block + the START-NOW badge block →
   *   /income (§4.20.I).
   * - Mascot variety: six distinct figures — NOVA/BYTE (scene), VECTOR
   *   (card), BLOOM (stat card), PIP/GLITCH (chat strip + tagline glyph)
   *   — all original SVG-rect art, no background plates (§4.20.J).
   * - Adaptive: mobile-first single column (the DOM order below); ≥720px
   *   re-composes into the example's 26% / 1fr / 26% three-column grid —
   *   CSS-only rearrangement, same DOM (§4.20.K).
   * - Behavior (§4.20.L): Start CTA, agent-card TALK and the badge block
   *   navigate to /income (the 6-digit entry); nothing on / fetches; the
   *   join deep links (?code= / ?u=) still forward to /income with the
   *   query preserved (the §3.1 guard, unchanged).
   * - RU/EN parity: every landing string goes through the 35 §4.20.M
   *   keys; the header switch re-renders the page without a reload.
   */
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { page } from '$app/state';
  import { locale, translate } from '#lib/i18n/locale';
  import LocaleControl from '#lib/components/join/LocaleControl.svelte';
  import PixelIcon from '#lib/components/icons/PixelIcon.svelte';
  import LandingHeroScene from '#lib/components/landing/LandingHeroScene.svelte';
  import LandingDialogueBox from '#lib/components/landing/LandingDialogueBox.svelte';
  import LandingChatStrip from '#lib/components/landing/LandingChatStrip.svelte';
  import LandingFigure from '#lib/components/landing/LandingFigure.svelte';
  import type { ChatBubbleSpec } from '#lib/components/landing/chatTimeline';

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

  /** The tagline's first word cluster carries the accent tint (§4.20.B). */
  function splitFirstWord(line: string): [string, string] {
    const at = line.indexOf(' ');
    return at === -1 ? [line, ''] : [line.slice(0, at), line.slice(at)];
  }

  const dialogLines = $derived([
    translate($locale, 'landing.dialog.line1'),
    translate($locale, 'landing.dialog.line2'),
    translate($locale, 'landing.dialog.line3')
  ]);

  const chatBubbles = $derived<readonly ChatBubbleSpec[]>([
    { from: 'glitch', text: translate($locale, 'landing.chat.bubble1') },
    { from: 'pip', text: translate($locale, 'landing.chat.bubble2') },
    { from: 'glitch', text: translate($locale, 'landing.chat.bubble3') },
    { from: 'pip', text: translate($locale, 'landing.chat.bubble4') }
  ]);

  const tutorialSteps = $derived([
    { icon: 'search', label: translate($locale, 'landing.tutorial.search') },
    { icon: 'dialog-lines', label: translate($locale, 'landing.tutorial.chat') },
    { icon: 'contact-share', label: translate($locale, 'landing.tutorial.share') }
  ] as const);

  const leftTagline = $derived(translate($locale, 'landing.tagline.left.1'));
  const leftTaglineSplit = $derived(splitFirstWord(leftTagline));
</script>

<div class="landing">
  <!-- HEADER (§4.20.B): taglines + the locale switch + the START control. -->
  <header class="top">
    <div class="tagline tagline-left">
      <span class="tag-line">
        <span class="tint">{leftTaglineSplit[0]}</span>{leftTaglineSplit[1]}
      </span>
      <span class="tag-line">{translate($locale, 'landing.tagline.left.2')}</span>
    </div>
    <p class="tagline tagline-top">{translate($locale, 'landing.tagline.top')}</p>
    <div class="tagline tagline-right">
      <span class="tag-glyph" aria-hidden="true">
        <LandingFigure kind="glitch" size={24} idle={false} />
      </span>
      <span class="tag-lines">
        <span class="tag-line">{translate($locale, 'landing.tagline.right.1')}</span>
        <span class="tag-line">{translate($locale, 'landing.tagline.right.2')}</span>
      </span>
    </div>
    <div class="top-actions">
      <div class="locale"><LocaleControl /></div>
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
      <button type="button" class="start-pill cta-pill" onclick={start}>
        {translate($locale, 'landing.cta')}
      </button>
      <a class="start-link" href={resolve('/income')}>
        {translate($locale, 'landing.cta')}
      </a>
    </div>
  </header>

  <main class="canvas">
    <!-- HEADLINE BLOCK (§4.20.C) -->
    <section class="copy area-copy">
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

    <!-- HERO SCENE + RETRO DIALOGUE BOX (§4.20.D/E) -->
    <section class="hero area-hero">
      <LandingHeroScene label={translate($locale, 'landing.hero.aria')} />
      <div class="dialog-wrap">
        <LandingDialogueBox lines={dialogLines} srLine={dialogLines[0] ?? ''} />
      </div>
    </section>

    <!-- MASCOT-CHAT ANIMATION STRIP (§4.20.F) -->
    <div class="area-chat">
      <LandingChatStrip
        label={translate($locale, 'landing.chat.label')}
        aria={translate($locale, 'landing.chat.aria')}
        bubbles={chatBubbles}
      />
    </div>

    <!-- AGENT CHARACTER CARD (§4.20.G-b) -->
    <section class="area-agents" id="agents">
      <article class="card pixel-corners pixel-frame pixel-frame--strong agent-card">
        <div class="card-body pixel-corners agent-body">
          <div class="agent-portrait">
            <LandingFigure kind="vector" size={96} idle={false} />
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

    <!-- STAT / FEATURE CARD (§4.20.G-a) -->
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
            <LandingFigure kind="bloom" size={56} />
          </div>
        </div>
      </article>
    </section>

    <!-- TUTORIAL: FIND → CHAT → SHARE (§4.20.H, exactly 3 steps) -->
    <section class="tutorial area-tutorial" id="tutorial">
      <ol class="steps">
        {#each tutorialSteps as step, i (step.icon)}
          <li class="step">
            <span class="step-icon">
              <PixelIcon name={step.icon} size={32} />
            </span>
            <span class="step-label">{step.label}</span>
          </li>
          {#if i < tutorialSteps.length - 1}
            <li class="chevron" aria-hidden="true">
              <svg viewBox="0 0 6 10" width="6" height="10" shape-rendering="crispEdges" fill="var(--color-text-muted)">
                <rect x="0" y="0" width="2" height="2" />
                <rect x="2" y="2" width="2" height="2" />
                <rect x="4" y="4" width="2" height="2" />
                <rect x="2" y="6" width="2" height="2" />
                <rect x="0" y="8" width="2" height="2" />
              </svg>
              <svg viewBox="0 0 6 10" width="6" height="10" shape-rendering="crispEdges" fill="var(--color-text-muted)">
                <rect x="0" y="0" width="2" height="2" />
                <rect x="2" y="2" width="2" height="2" />
                <rect x="4" y="4" width="2" height="2" />
                <rect x="2" y="6" width="2" height="2" />
                <rect x="0" y="8" width="2" height="2" />
              </svg>
            </li>
          {/if}
        {/each}
      </ol>
    </section>

    <!-- FOOTER: positioning block (§4.20.I) -->
    <footer class="foot-block area-ftpos pixel-corners pixel-frame pixel-frame--strong">
      <div class="foot-body pixel-corners">
        <span class="brand">
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
            <g fill="var(--color-bg)">
              <rect x="20" y="26" width="8" height="8" />
              <rect x="36" y="26" width="8" height="8" />
              <rect x="28" y="30" width="8" height="4" />
            </g>
          </svg>
          <span class="brand-name">bleak-web</span>
        </span>
        <p class="foot-line">{translate($locale, 'landing.footer.line')}</p>
        <p class="foot-copy">{translate($locale, 'landing.footer.copyright')}</p>
      </div>
    </footer>

    <!-- FOOTER: the START-NOW badge block → /income (§4.20.I) -->
    <a class="badge-block area-badge pixel-corners pixel-frame pixel-frame--strong" href={resolve('/income')}>
      <div class="foot-body pixel-corners badge-body">
        <svg
          class="badge-glyph"
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
          <g fill="var(--color-bg)">
            <rect x="20" y="26" width="8" height="8" />
            <rect x="36" y="26" width="8" height="8" />
            <rect x="28" y="30" width="8" height="4" />
          </g>
        </svg>
        <span class="badge-label">{translate($locale, 'landing.footer.badge')}</span>
      </div>
    </a>
  </main>
</div>

<style>
  /* Canvas (§4.20.A): the near-black page bg is the app shell's; the
   * content canvas is centered at 1000px. */
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

  /* ---------- header (§4.20.B) ---------- */
  .top {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: var(--space-4);
  }
  .tagline {
    font-family: var(--font-pixel);
    font-weight: 600;
    font-size: 12px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    line-height: 1.4;
    color: var(--color-text);
  }
  .tagline-left {
    display: flex;
    flex-direction: column;
  }
  .tag-line {
    display: block;
  }
  .tint {
    color: var(--color-deepa-4);
  }
  .tagline-top {
    display: none;
    margin: 0;
    color: var(--color-deepa-4);
  }
  .tagline-right {
    display: none;
    align-items: flex-start;
    gap: var(--space-2);
  }
  .tag-glyph {
    line-height: 0;
    flex: none;
  }
  .tag-lines {
    display: flex;
    flex-direction: column;
  }
  .top-actions {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    flex: none;
  }
  .locale {
    display: flex;
    align-items: center;
    height: 40px;
  }
  .locale :global(.segmented) {
    padding: 2px;
  }
  .locale :global(.segmented button) {
    min-height: 36px;
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
  .start-link {
    display: none;
    font-family: var(--font-pixel);
    font-weight: 600;
    font-size: 12px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--color-text);
    transition: color 120ms ease-out;
  }
  .start-link:hover {
    color: var(--color-deepa-4);
  }
  @media (min-width: 720px) {
    .top {
      display: grid;
      grid-template-columns: 26% 1fr 26%;
      column-gap: var(--space-6);
      row-gap: var(--space-4);
      align-items: start;
    }
    .tagline {
      font-size: 13px;
    }
    .tagline-left {
      grid-column: 1;
      grid-row: 1;
    }
    .tagline-top {
      display: block;
      grid-column: 2;
      grid-row: 1;
      justify-self: center;
      text-align: center;
      font-size: 12px;
    }
    .tagline-right {
      display: flex;
      grid-column: 3;
      grid-row: 1;
      justify-self: end;
      text-align: right;
    }
    .top-actions {
      grid-column: 1 / -1;
      grid-row: 2;
      justify-self: end;
    }
    .top-nav {
      display: flex;
    }
    .start-pill {
      display: none;
    }
    .start-link {
      display: inline-block;
    }
  }

  /* ---------- canvas grid (§4.20.K) ---------- */
  .canvas {
    display: flex;
    flex-direction: column;
    gap: var(--space-6);
    min-width: 0;
  }
  @media (min-width: 720px) {
    .canvas {
      display: grid;
      grid-template-columns: 26% 1fr 26%;
      grid-template-areas:
        'copy  hero agents'
        'stat  hero chat'
        'ftpos hero badge'
        'tut   tut  tut';
      column-gap: var(--space-6);
      row-gap: var(--space-6);
      align-items: start;
    }
    .area-copy {
      grid-area: copy;
    }
    .area-hero {
      grid-area: hero;
      justify-self: center;
    }
    .area-chat {
      grid-area: chat;
      width: 100%;
    }
    .area-agents {
      grid-area: agents;
    }
    .area-stat {
      grid-area: stat;
      align-self: end;
    }
    .area-tutorial {
      grid-area: tut;
    }
    .area-ftpos {
      grid-area: ftpos;
      align-self: end;
    }
    .area-badge {
      grid-area: badge;
      align-self: end;
    }
  }

  /* ---------- headline block (§4.20.C) ---------- */
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
  .talk,
  .start-pill {
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
  .start-pill {
    padding: 6px 14px;
    min-height: 36px;
    font-size: 12px;
  }
  .cta-main:hover,
  .talk:hover,
  .start-pill:hover {
    filter: drop-shadow(0 0 8px color-mix(in srgb, var(--color-deepa-4) 50%, transparent))
      drop-shadow(0 0 24px color-mix(in srgb, var(--color-deepa-4) 22%, transparent));
  }
  .cta-main:active,
  .talk:active,
  .start-pill:active {
    transform: scale(0.98);
  }

  /* ---------- hero (§4.20.D/E) ---------- */
  .hero {
    display: flex;
    flex-direction: column;
    align-items: center;
    min-width: 0;
  }
  .dialog-wrap {
    display: flex;
    justify-content: center;
    width: 100%;
    /* the example's overlap: the box rides the scene's bottom edge */
    margin-top: -16px;
    position: relative;
    z-index: 1;
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
  .stat-body {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-4);
  }
  .stat-copy {
    min-width: 0;
  }
  .stat-title {
    font-family: var(--font-pixel);
    font-weight: 600;
    font-size: 18px;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--color-text);
    margin: 0 0 var(--space-2);
  }
  .stat-line {
    margin: 0 0 var(--space-1);
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--color-text-muted);
  }
  .stat-glyph {
    flex: none;
    line-height: 0;
  }

  /* ---------- tutorial (§4.20.H) ---------- */
  .tutorial {
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .steps {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-3);
  }
  .step {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-2);
  }
  .step-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    color: var(--color-text);
  }
  .step-label {
    font-family: var(--font-pixel);
    font-weight: 600;
    font-size: 12px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--color-text);
  }
  .chevron {
    display: flex;
    align-items: center;
    gap: 2px;
    padding-top: 0;
  }
  @media (min-width: 720px) {
    .tutorial::before,
    .tutorial::after {
      content: '';
      flex: 1;
      height: 1px;
      background: var(--color-surface-elevated);
    }
  }

  /* ---------- footer blocks (§4.20.I) ---------- */
  .foot-block {
    width: 100%;
    transition: filter 120ms ease-out;
  }
  .foot-body {
    padding: 12px 16px;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  .brand {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
  }
  .brand-name {
    font-family: var(--font-pixel);
    font-weight: 600;
    font-size: 14px;
    letter-spacing: 0.04em;
    color: var(--color-text);
  }
  .foot-line {
    margin: 0;
    font-family: var(--font-pixel);
    font-weight: 600;
    font-size: 12px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--color-text);
  }
  .foot-copy {
    margin: 0;
    font-family: var(--font-body);
    font-size: 11px;
    color: var(--color-text-muted);
  }
  .badge-block {
    display: block;
    text-decoration: none;
  }
  .badge-body {
    flex-direction: row;
    align-items: center;
    gap: var(--space-3);
  }
  .badge-glyph {
    flex: none;
    display: block;
  }
  .badge-label {
    font-family: var(--font-pixel);
    font-weight: 600;
    font-size: 12px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--color-deepa-4);
  }
  .badge-block:hover {
    filter: drop-shadow(0 0 8px color-mix(in srgb, var(--color-deepa-4) 50%, transparent))
      drop-shadow(0 0 24px color-mix(in srgb, var(--color-deepa-4) 22%, transparent));
  }
</style>
