<script lang="ts">
  /**
   * SummarySheet (CONCEPT §15.3, DESIGN §4.15.C — v3.2 arcade-sheet core):
   * the finished-chat bottom sheet — the once-only hard-match result
   * presented as a modal over the transcript. Mirrors the HandshakeSheet
   * dialog pattern (scrim, Escape + focus + tab-trap, X close top-right).
   *
   * Arcade core (§4.15.C-1..C-4; tz7-02 — the centerpiece/tier/checklist
   * redesign is the NEXT task): a `.arcade-sheet` scope block carries the
   * LOCKED sheet palette (the owner-locked electric-purple background —
   * NOT remapped to app tokens; it supersedes the §13.1.5 Deepa-hue
   * background, recorded in §15.4) plus the pixel stack ('Press Start 2P'
   * with Handjet fallback — the Fontsource import lives in
   * routes/+layout.svelte with latin + cyrillic(+ext) subsets, RU/EN
   * parity). The entrance replaces
   * the 200ms linear slide-up with the retro spring-bounce `arcade-rise`
   * and the sections cascade in (~50ms stagger). Top bar: the pixel
   * MEETING SUMMARY label (chat.summary.title) + the pixel X close
   * (scale(0.88) press, 48px target). Top corners 24px; dark scrim stays.
   *
   * Pure presentational — the hosting page (routes/chats/[address]) owns the
   * hardMatch call, the share-contact request and the error/retry state; all
   * copy and state come in as clean props, the embedded ShareContactSlide is
   * the REUSED tz5-04 control (same props, forwarded verbatim — never forked).
   *
   * Inside (kept working, restyled only where the container demands):
   * - a round SVG donut (stroke-dasharray over the circumference —
   *   lib/chats/summary.ts) showing the 0..100 score;
   * - the networking checklist: the Summary.checkpoints render closed (check
   *   glyph) / open (muted); the server-provided English labels display
   *   verbatim (no i18n for labels — the heading IS i18n'd RU/EN);
   * - `Summary.description` as a paragraph when present;
   * - score > 80 → the `celebrate` class: CSS-only spark particles +
   *   an opacity "brightness pulse" overlay (transform/opacity only, §4.6;
   *   the base.css reduced-motion catch-all disables both) — recolored to
   *   the sheet scope (§4.15.C-6b).
   */
  import { tick } from 'svelte';
  import type { Summary, User } from '@bleak/api-client';
  import { locale, translate } from '#lib/i18n/locale';
  import { DONUT_RADIUS, donutScoreDash, summaryCelebrates, summaryScoreDisplay } from '#lib/chats/summary';
  import ShareContactSlide from './ShareContactSlide.svelte';
  import PixelAvatar from './PixelAvatar.svelte';
  import PixelIcon from './icons/PixelIcon.svelte';

  interface Props {
    open?: boolean;
    /** The interlocutor: the sheet's name and avatar. */
    user: User | null;
    /** The hard-match Summary (null while loading / failed). */
    summary?: Summary | null;
    /** Page-driven hardMatch pending state (loading row, no stale data). */
    loading?: boolean;
    /** Inline failure state with a retry affordance (no crash). */
    error?: 'network' | 'api' | null;
    errorMessage?: string | null;
    /** ShareContactSlide pass-through (tz5-04, same props). */
    slideLabel?: string;
    slideSharedLabel?: string;
    slideDisabledHint?: string;
    slideDisabled?: boolean;
    slidePending?: boolean;
    slideShared?: boolean;
    onshare?: () => void;
    onretry?: () => void;
    onclose?: () => void;
  }

  let {
    open = $bindable(false),
    user,
    summary = null,
    loading = false,
    error = null,
    errorMessage = null,
    slideLabel = '',
    slideSharedLabel = '',
    slideDisabledHint = '',
    slideDisabled = false,
    slidePending = false,
    slideShared = false,
    onshare,
    onretry,
    onclose
  }: Props = $props();

  let sheetEl: HTMLElement | null = $state(null);

  const title = $derived(translate($locale, 'chat.summary.title'));
  const checklistHeading = $derived(translate($locale, 'chat.summary.checklist'));
  const loadingText = $derived(translate($locale, 'chat.summary.loading'));
  const scoreText = $derived(summary === null ? '' : String(summaryScoreDisplay(summary.score)));
  const scoreAria = $derived(
    summary === null
      ? ''
      : translate($locale, 'chat.summary.score.aria', {
          score: String(summaryScoreDisplay(summary.score))
        })
  );
  const closeLabel = $derived(translate($locale, 'common.close'));
  const networkErrorText = $derived(translate($locale, 'common.error.network'));
  const apiErrorTitle = $derived(translate($locale, 'common.error.api'));

  /** Fireworks + brightness pulse — strictly above 80 (lib/chats/summary). */
  const celebrate = $derived(summaryCelebrates(summary));

  $effect(() => {
    if (open && user) {
      void tick().then(() => sheetEl?.querySelector<HTMLElement>('button, a[href]')?.focus());
    }
  });

  function close(): void {
    open = false;
    onclose?.();
  }

  function sheetKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
    } else if (event.key === 'Tab' && sheetEl) {
      const focusables = Array.from(
        sheetEl.querySelectorAll<HTMLElement>('button, a[href]')
      ).filter((el) => !el.hasAttribute('disabled'));
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  }
</script>

<svelte:window onkeydown={(event) => (open ? sheetKeydown(event) : undefined)} />

{#if open && user}
  <div class="scrim" aria-hidden="true"></div>
  <div
    class="sheet arcade-sheet"
    class:celebrate
    role="dialog"
    aria-modal="true"
    aria-label={title}
    tabindex="-1"
    bind:this={sheetEl}
  >
    <!-- §4.13.5 celebration: CSS-only sparks (transform/opacity keyframes;
         reduced-motion is disabled by the base.css catch-all). -->
    {#if celebrate}
      <div class="fireworks" aria-hidden="true">
        <i class="spark s1"></i>
        <i class="spark s2"></i>
        <i class="spark s3"></i>
        <i class="spark s4"></i>
        <i class="spark s5"></i>
        <i class="spark s6"></i>
      </div>
    {/if}

    <!-- §4.15.C-4 top bar: the pixel MEETING SUMMARY label left, the pixel
         X close right (scale-down press, 48px target). -->
    <header class="top-bar cascade" style:--cascade-i="0">
      <p class="sheet-label">{title}</p>
      <button type="button" class="close" aria-label={closeLabel} onclick={close}>
        <PixelIcon name="close" size={16} />
      </button>
    </header>

    <div class="identity cascade" style:--cascade-i="1">
      <PixelAvatar address={user.address} size={56} label={user.name} />
      <h2>{user.name}</h2>
    </div>

    {#if loading}
      <!-- hardMatch pending: a quiet loading row, no fake data. -->
      <p class="loading cascade" style:--cascade-i="2" role="status">{loadingText}</p>
    {:else if error}
      <!-- Inline failure + retry affordance; the sheet stays open. -->
      <p class="error cascade" style:--cascade-i="2" role="alert" aria-live="polite">
        {#if error === 'network'}
          {networkErrorText}
        {:else}
          {apiErrorTitle}{errorMessage ? ` — ${errorMessage}` : ''}
        {/if}
      </p>
      <button type="button" class="cta cascade" style:--cascade-i="3" onclick={() => onretry?.()}>
        {translate($locale, 'common.retry')}
      </button>
    {:else if summary}
      <div class="score-row cascade" style:--cascade-i="2">
        <svg
          class="donut"
          viewBox="0 0 120 120"
          role="img"
          aria-label={scoreAria}
        >
          <circle class="track" cx="60" cy="60" r={DONUT_RADIUS} />
          <circle
            class="arc"
            cx="60"
            cy="60"
            r={DONUT_RADIUS}
            style:stroke-dasharray={donutScoreDash(summary.score)}
          />
          <text class="score" x="60" y="60">{scoreText}</text>
        </svg>
      </div>

      {#if summary.description}
        <p class="description cascade" style:--cascade-i="3">{summary.description}</p>
      {/if}

      <section class="checklist cascade" style:--cascade-i="4" aria-label={checklistHeading}>
        <h3>{checklistHeading}</h3>
        <ul>
          {#each summary.checkpoints as checkpoint (checkpoint.key)}
            <li class="checkpoint" class:closed={checkpoint.closed}>
              <!-- §4.14.4 sheet polish: a SQUARE checkbox per checkpoint —
                   the closed ones carry the green check glyph inside, the
                   open ones keep the empty square. -->
              <span class="box" aria-hidden="true">
                {#if checkpoint.closed}
                  <span class="check"><PixelIcon name="check" size={12} /></span>
                {/if}
              </span>
              <span class="label">{checkpoint.label}</span>
            </li>
          {/each}
        </ul>
      </section>

      <!-- §4.13.5: the share-contact slide INSIDE the sheet — the same
           tz5-04 control with the same props, sharing to this counterpart.
           (The variant="sheet" embed is the NEXT task's cutover, §4.15.C-8.) -->
      <div class="share cascade" style:--cascade-i="5">
        <ShareContactSlide
          label={slideLabel}
          sharedLabel={slideSharedLabel}
          disabledHint={slideDisabledHint}
          disabled={slideDisabled}
          pending={slidePending}
          shared={slideShared}
          oncomplete={() => onshare?.()}
        />
      </div>
    {/if}
  </div>
{/if}

<style>
  .scrim {
    position: fixed;
    inset: 0;
    background: var(--color-scrim);
    z-index: 30;
    animation: fade-in 200ms ease-out;
  }
  /* WIDTH (§4.14.4): the sheet's horizontal extent MATCHES the dialog
   * content box — the transcript column in routes/chats/[address] sits
   * inside the page's `--space-4` scroll insets (phone) and is capped at
   * 640px centered from 720px up (that page's `.column` media query), so
   * the sheet mirrors exactly that mapping: the sheet's left/right edges
   * align with the messages' left/right borders at every viewport. */
  .sheet {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    width: calc(100% - 2 * var(--space-4));
    margin-inline: auto;
    z-index: 31;
    background: var(--sheet-bg);
    color: var(--sheet-ink);
    /* §4.15.C-2: 24px TOP corners only (bottom edge meets the viewport). */
    border-radius: var(--radius-lg) var(--radius-lg) 0 0;
    padding: var(--space-5) var(--space-5) calc(var(--bottom-tabbar-height) + var(--space-4));
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    animation: arcade-rise 460ms cubic-bezier(0.22, 1, 0.36, 1);
    overflow: hidden;
  }
  /* §4.15.C-1 PALETTE SCOPE — the sheet does NOT remap app tokens: the
   * locked sheet colors live here and are consumed ONLY inside the sheet
   * (--sheet-*). --sheet-bg is OWNER-LOCKED (Concept §15.3; the
   * app palette itself is unchanged) and supersedes the §13.1.5
   * Deepa-hue background (recorded, Concept §15.4) — the .deepa-N hue
   * classes are removed from the sheet. --sheet-green reuses the approved
   * Deepa green (--color-check-green — no new hex). */
  .arcade-sheet {
    --sheet-bg: #8a12ff;
    --sheet-charcoal: #18181b;
    --sheet-yellow: #facc15;
    --sheet-white: #ffffff;
    --sheet-orange: #ff8a00;
    --sheet-green: var(--color-check-green);
    --sheet-ink: var(--sheet-white);
    /* §4.15.C-3 typography: Press Start 2P for BOTH locales (it ships
     * Cyrillic upstream; Handjet second = the Cyrillic pixel fallback,
     * never a serif). Loaded via Fontsource in routes/+layout.svelte. */
    --sheet-font-pixel: 'Press Start 2P', 'Handjet Variable', 'Handjet', monospace;
  }
  /* §4.15.C-2 ENTRANCE — the 200ms linear slide-up is superseded by the
   * retro-arcade SPRING BOUNCE rise (transform-only; the scrim keeps its
   * 200ms fade). */
  @keyframes arcade-rise {
    0% {
      transform: translateY(100%);
    }
    62% {
      transform: translateY(-12px);
    }
    82% {
      transform: translateY(4px);
    }
    100% {
      transform: translateY(0);
    }
  }
  /* §4.15.C-2 CASCADE — the sheet's sections stagger in ~50ms apart
   * (delay 120ms + i×50ms), each a fade-and-slide-up 240ms ease-out.
   * Sections carry --cascade-i (top bar → identity → score stage →
   * description → checklist → slide). */
  .cascade {
    animation: cascade-in 240ms ease-out both;
    animation-delay: calc(120ms + var(--cascade-i, 0) * 50ms);
  }
  @keyframes cascade-in {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  /* --- §4.15.C-4 top bar -------------------------------------------------- */
  .top-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
  }
  /* The pixel MEETING SUMMARY label — i18n'd (chat.summary.title),
   * uppercase, pixel face 10px (PS2P runs large), white ink. */
  .sheet-label {
    margin: 0;
    font-family: var(--sheet-font-pixel);
    font-size: 10px;
    letter-spacing: 0;
    text-transform: uppercase;
    color: var(--sheet-white);
  }
  /* The pixel X close: 48px hit target, yellow glyph, press state =
   * pixel scale-DOWN over 90ms (no opacity fade), yellow focus ring. */
  .close {
    flex-shrink: 0;
    width: var(--touch-target);
    height: var(--touch-target);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    color: var(--sheet-yellow);
    transition: transform 90ms ease-out;
  }
  .close:active {
    transform: scale(0.88);
  }
  .close:focus-visible {
    outline: 2px solid var(--sheet-yellow);
    outline-offset: 2px;
  }
  .identity {
    display: flex;
    align-items: center;
    gap: var(--space-4);
  }
  .identity h2 {
    font-family: var(--font-body);
    font-size: 24px;
    margin: 0;
    color: var(--sheet-white);
  }
  /* --- donut (§4.13.5): stroke-dasharray over the circumference --------- */
  .score-row {
    display: flex;
    justify-content: center;
  }
  .donut {
    width: 132px;
    height: 132px;
  }
  .donut circle {
    fill: none;
    stroke: var(--sheet-white);
    stroke-width: 10;
  }
  .donut .track {
    stroke-opacity: 0.25;
  }
  /* The arc starts at 12 o'clock and sweeps clockwise with the score. */
  .donut .arc {
    stroke-linecap: round;
    transform: rotate(-90deg);
    transform-origin: 60px 60px;
    transition: stroke-dasharray 400ms ease-out;
  }
  /* §4.15.C-5/C-3: the score numeral renders in the pixel stack 28px. */
  .donut .score {
    stroke: none;
    fill: var(--sheet-white);
    font-family: var(--sheet-font-pixel);
    font-size: 28px;
    letter-spacing: 0;
    text-anchor: middle;
    dominant-baseline: central;
  }
  /* §4.15.C-7: crisp white sans body copy on purple. */
  .description {
    margin: 0;
    color: var(--sheet-ink);
    font-size: 14px;
    line-height: 1.45;
  }
  /* --- networking checklist --------------------------------------------- */
  /* §4.15.C-7: the pixel NETWORKING CHECKLIST header. */
  .checklist h3 {
    margin: 0 0 var(--space-2);
    font-family: var(--sheet-font-pixel);
    font-size: 10px;
    letter-spacing: 0;
    text-transform: uppercase;
    color: var(--sheet-white);
  }
  .checklist ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  .checkpoint {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    font-size: 14px;
  }
  /* §4.14.4 sheet polish: SQUARE checkboxes — a bordered square box per
   * checkpoint; closed items carry the check glyph inside (GREEN — the
   * --color-check-green token via --sheet-green), open items keep the
   * empty square. */
  .checkpoint .box {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    flex-shrink: 0;
    border: 1.5px solid var(--sheet-white);
  }
  /* the GREEN check sign (§4.14.4) — the wrapper owns the color so the
    * PixelIcon glyph inherits it (currentColor fill; cross-component
    * selectors are out of Svelte's scope, so the color sits on OUR span). */
  .checkpoint .check {
    display: inline-flex;
    color: var(--sheet-green);
  }
  /* Open criteria render muted (no glyph) — the §4.13.5 closed/open states. */
  .checkpoint:not(.closed) {
    opacity: 0.6;
  }
  .share {
    margin-top: var(--space-2);
  }
  .loading {
    margin: 0;
    color: var(--sheet-ink);
    font-size: 14px;
  }
  .error {
    margin: 0;
    color: var(--sheet-ink);
    font-size: 14px;
  }
  /* The retry affordance stays readable on the locked purple: white ink. */
  .cta {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: var(--touch-target);
    border-radius: var(--radius-pill);
    font-weight: 600;
    font-size: 16px;
    text-align: center;
    background: transparent;
    border: 1px solid var(--sheet-white);
    color: var(--sheet-ink);
    transition: opacity 120ms ease-out;
  }
  .cta:disabled {
    opacity: 0.6;
  }
  /* --- celebration (score > 80): sparks + brightness pulse --------------- */
  /* Transform/opacity only (§4.6); prefers-reduced-motion kills both via
    * the base.css catch-all. §4.15.C-6b: the sparks recolor to the sheet
    * scope (yellow/orange/white) and the wash reads --sheet-white at its
    * existing 0.22 peak. */
  .fireworks {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }
  .spark {
    position: absolute;
    width: 6px;
    height: 6px;
    background: var(--sheet-yellow);
    opacity: 0;
    animation: spark-fly 900ms ease-out 80ms 2;
  }
  .spark.s2,
  .spark.s5 {
    background: var(--sheet-orange);
  }
  .spark.s3,
  .spark.s6 {
    background: var(--sheet-white);
  }
  .spark.s1 { left: 12%; bottom: 30%; --sx: 18px; --sy: -70px; }
  .spark.s2 { left: 30%; bottom: 55%; --sx: -14px; --sy: -58px; animation-delay: 220ms; }
  .spark.s3 { left: 50%; bottom: 25%; --sx: 10px; --sy: -84px; animation-delay: 120ms; }
  .spark.s4 { left: 66%; bottom: 48%; --sx: -20px; --sy: -66px; animation-delay: 300ms; }
  .spark.s5 { left: 82%; bottom: 33%; --sx: 14px; --sy: -76px; animation-delay: 180ms; }
  .spark.s6 { left: 44%; bottom: 62%; --sx: -8px; --sy: -50px; animation-delay: 380ms; }
  @keyframes spark-fly {
    0% {
      opacity: 0;
      transform: translate(0, 0) scale(0.6);
    }
    25% {
      opacity: 0.9;
    }
    100% {
      opacity: 0;
      transform: translate(var(--sx, 12px), var(--sy, -60px)) scale(1);
    }
  }
  /* The "brightness" pulse: an opacity-only wash over the sheet (filter
    * animations are out per §4.6 — the wash reads identically). */
  .celebrate::after {
    content: '';
    position: absolute;
    inset: 0;
    pointer-events: none;
    background: var(--sheet-white);
    opacity: 0;
    animation: brightness-pulse 900ms ease-out 100ms 2;
  }
  @keyframes brightness-pulse {
    0%,
    100% {
      opacity: 0;
    }
    50% {
      opacity: 0.22;
    }
  }
  @keyframes fade-in {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }
  /* Desktop cap (§4.14.4): the transcript column is capped at 640px
   * centered from 720px up (routes/chats/[address] `.column` media query)
   * — the sheet mirrors that same breakpoint/value. The width contract
   * test pins the two files in lockstep (tests/summary-sheet.test.ts). */
  @media (min-width: 720px) {
    .sheet {
      max-width: 640px;
    }
  }
</style>
