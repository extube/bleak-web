<script lang="ts">
  /**
   * `/` — the landing page (tz12-02, Concept §31): the public showcase in
   * the pixel-art mobile-app mood (the owner's dribbble reference — mood
   * adapted, not copied; existing tokens only). Mobile-first single column.
   *
   * - Positioning ("words about the project"): EFFECTIVE NETWORKING WITH
   *   AI AGENTS — the hero title + the about paragraph.
   * - Pixel mascots: the shared BleakMascot (§23.1 — NO background plate;
   *   the figure sits directly on the page) — one hero figure + one per
   *   tutorial step.
   * - Navigation: a labelled nav row (about anchor, how-it-works anchor,
   *   the host console — the one public route) + the Start CTA.
   * - Start button → `/income` — the room-income entry page with the
   *   6-digit invite input (the join flow re-homed there, tz12-02).
   * - Tutorial: how it works — search → chatting → contacts sharing
   *   (three steps).
   * - RU/EN parity: the FormShell-style header switcher (the shared
   *   LocaleControl, 40px row next to the 40px app icon).
   * - Deep links: `?code=NNNNNN` (invite QR/link) and `?u=…&m=…`
   *   (persona QR) land on `/` — forwarded to `/income` with the query
   *   preserved (replaceState), where the join flow consumes them (the
   *   §3.1 deep links + the §3.8 handshake routine, unchanged behavior).
   */
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { page } from '$app/state';
  import { locale, translate, type MessageKey } from '#lib/i18n/locale';
  import BleakMascot from '#lib/components/BleakMascot.svelte';
  import LocaleControl from '#lib/components/join/LocaleControl.svelte';

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

  const steps: { n: number; title: MessageKey; text: MessageKey }[] = [
    { n: 1, title: 'landing.how.step1.title', text: 'landing.how.step1.text' },
    { n: 2, title: 'landing.how.step2.title', text: 'landing.how.step2.text' },
    { n: 3, title: 'landing.how.step3.title', text: 'landing.how.step3.text' }
  ];
</script>

<div class="landing">
  <!-- FormShell-style header (§30): the app icon LEFT + the language
       switch RIGHT (the 40px switcher row). -->
  <header class="top">
    <div class="brand">
      <svg
        class="app-icon"
        viewBox="0 0 64 64"
        width="40"
        height="40"
        shape-rendering="crispEdges"
        role="img"
        aria-hidden="true"
      >
        <g fill="var(--color-accent)">
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
      <span class="wordmark">bleak-web</span>
    </div>
    <div class="locale"><LocaleControl /></div>
  </header>

  <main class="content">
    <!-- HERO: the positioning — effective networking with AI agents. -->
    <section id="about" class="hero">
      <div class="hero-mascot">
        <BleakMascot size={144} idle label={translate($locale, 'landing.mascot.aria')} />
      </div>
      <h1>{translate($locale, 'landing.hero.title')}</h1>
      <p class="about">{translate($locale, 'landing.hero.text')}</p>

      <!-- Navigation: section anchors + the public host console. -->
      <nav class="landing-nav" aria-label={translate($locale, 'landing.nav.aria')}>
        <a href="#about">{translate($locale, 'landing.nav.about')}</a>
        <a href="#how">{translate($locale, 'landing.nav.how')}</a>
        <a href={resolve('/host')}>{translate($locale, 'landing.nav.host')}</a>
      </nav>

      <!-- START: opens /income — the 6-digit invite input (the re-homed
           join flow). -->
      <button type="button" class="cta start" onclick={start}>
        {translate($locale, 'landing.start')}
      </button>
      <p class="hint">{translate($locale, 'landing.start.hint')}</p>
    </section>

    <!-- TUTORIAL: search → chatting → contacts sharing. -->
    <section id="how" class="how">
      <h2>{translate($locale, 'landing.how.title')}</h2>
      <ol class="steps">
        {#each steps as step (step.n)}
          <li class="card pixel-corners step" aria-label={translate($locale, 'landing.step.aria', { n: String(step.n) })}>
            <div class="step-head">
              <BleakMascot size={48} idle />
              <span class="num" aria-hidden="true">{step.n}</span>
            </div>
            <h3>{translate($locale, step.title)}</h3>
            <p>{translate($locale, step.text)}</p>
          </li>
        {/each}
      </ol>
    </section>
  </main>
</div>

<style>
  .landing {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: var(--space-6);
    width: 100%;
    max-width: 480px;
    margin: 0 auto;
    padding: var(--space-5) var(--space-5) var(--space-6);
  }
  /* FormShell-style header: icon + wordmark LEFT, the language switch
   * RIGHT — the switcher's height equals the icon's (the §30 sizing,
   * mirrored from FormShell). */
  .top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
  }
  .brand {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    min-width: 0;
  }
  .app-icon {
    display: block;
    flex: none;
    background: transparent;
  }
  .wordmark {
    font-family: var(--font-pixel);
    font-weight: 600;
    font-size: 24px;
    letter-spacing: 0.04em;
    color: var(--color-text);
    overflow-wrap: anywhere;
  }
  .locale {
    display: flex;
    flex: none;
    align-items: center;
    height: 40px;
  }
  .locale :global(.segmented) {
    padding: 2px;
  }
  .locale :global(.segmented button) {
    min-height: 36px;
  }
  .content {
    display: flex;
    flex-direction: column;
    gap: var(--space-6);
    min-width: 0;
  }
  .hero {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: var(--space-4);
  }
  .hero-mascot {
    display: flex;
    justify-content: center;
  }
  .hero h1 {
    font-size: 40px;
    overflow-wrap: anywhere;
  }
  .about {
    margin: 0;
    color: var(--color-text-muted);
    font-size: 15px;
  }
  .landing-nav {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: var(--space-2);
  }
  .landing-nav a {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: var(--touch-target);
    padding: 0 var(--space-4);
    background: transparent;
    border: 1px solid var(--color-text-disabled-strong);
    border-radius: var(--radius-pill);
    font-size: 14px;
    font-weight: 600;
    color: var(--color-accent);
    transition: border-color 120ms ease-out;
  }
  .landing-nav a:hover {
    border-color: var(--color-accent);
  }
  .start {
    width: 100%;
    font-size: 16px;
  }
  .hint {
    margin: 0;
    color: var(--color-text-muted);
    font-size: 13px;
  }
  .how {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }
  .how h2 {
    font-size: 28px;
    overflow-wrap: anywhere;
  }
  .steps {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }
  .step {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    text-align: left;
  }
  .step-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
  }
  .num {
    font-family: var(--font-pixel);
    font-weight: 600;
    font-size: 32px;
    color: var(--color-text);
  }
  .step h3 {
    font-size: 22px;
    overflow-wrap: anywhere;
  }
  .step p {
    margin: 0;
    color: var(--color-text-muted);
    font-size: 14px;
  }
  @media (min-width: 720px) {
    .landing {
      justify-content: center;
    }
  }
</style>
