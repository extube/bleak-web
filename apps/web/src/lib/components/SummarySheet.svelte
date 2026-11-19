<script lang="ts">
  /**
   * SummarySheet (CONCEPT §13.1.5, DESIGN §4.13.5 item 5): the finished-chat
   * bottom sheet — the once-only hard-match result presented as a modal over
   * the transcript. Mirrors the HandshakeSheet dialog pattern (scrim, Escape
   * + focus + tab-trap, X close top-right) with ROUND corners instead of the
   * pixel steps, and the sheet's BACKGROUND is the interlocutor's Deepa hue
   * (`codeHue` — the message-bubble pairing: text on a hue uses the hue's
   * `--color-deepa-ink-<n>` token, AA ≥4.5 verified numerically).
   *
   * Pure presentational — the hosting page (routes/chats/[address]) owns the
   * hardMatch call, the share-contact request and the error/retry state; all
   * copy and state come in as clean props, the embedded ShareContactSlide is
   * the REUSED tz5-04 control (same props, forwarded verbatim — never forked).
   *
   * Inside:
   * - a round SVG donut (stroke-dasharray over the circumference —
   *   lib/chats/summary.ts) showing the 0..100 score;
   * - the networking checklist: the Summary.checkpoints render closed (check
   *   glyph) / open (muted); the server-provided English labels display
   *   verbatim (no i18n for labels — the heading IS i18n'd RU/EN);
   * - `Summary.description` as a muted paragraph when present;
   * - score > 80 → the `celebrate` class: CSS-only spark particles +
   *   an opacity "brightness pulse" overlay (transform/opacity only, §4.6;
   *   the base.css reduced-motion catch-all disables both).
   */
  import { tick } from 'svelte';
  import type { Summary, User } from '@bleak/api-client';
  import { locale, translate } from '#lib/i18n/locale';
  import { codeHue } from '#lib/avatar/traits';
  import { DONUT_RADIUS, donutScoreDash, summaryCelebrates } from '#lib/chats/summary';
  import ShareContactSlide from './ShareContactSlide.svelte';
  import PixelAvatar from './PixelAvatar.svelte';
  import PixelIcon from './icons/PixelIcon.svelte';

  interface Props {
    open?: boolean;
    /** The interlocutor: the sheet's name, avatar and hue background. */
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
  const scoreAria = $derived(
    summary === null ? '' : translate($locale, 'chat.summary.score.aria', { score: String(summary.score) })
  );
  const closeLabel = $derived(translate($locale, 'common.close'));
  const networkErrorText = $derived(translate($locale, 'common.error.network'));
  const apiErrorTitle = $derived(translate($locale, 'common.error.api'));

  /** The interlocutor's message hue class (the sheet's background pairing). */
  const hue = $derived(user === null ? '' : codeHue(user.address));
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
    class="sheet {hue}"
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
    <button type="button" class="close" aria-label={closeLabel} onclick={close}>
      <PixelIcon name="close" size={16} />
    </button>

    <div class="identity">
      <PixelAvatar address={user.address} size={56} label={user.name} />
      <div class="texts">
        <p class="kicker">{title}</p>
        <h2>{user.name}</h2>
      </div>
    </div>

    {#if loading}
      <!-- hardMatch pending: a quiet loading row, no fake data. -->
      <p class="loading" role="status">{loadingText}</p>
    {:else if error}
      <!-- Inline failure + retry affordance; the sheet stays open. -->
      <p class="error" role="alert" aria-live="polite">
        {#if error === 'network'}
          {networkErrorText}
        {:else}
          {apiErrorTitle}{errorMessage ? ` — ${errorMessage}` : ''}
        {/if}
      </p>
      <button type="button" class="cta" onclick={() => onretry?.()}>
        {translate($locale, 'common.retry')}
      </button>
    {:else if summary}
      <div class="score-row">
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
          <text class="score" x="60" y="60">{summary.score}</text>
        </svg>
      </div>

      {#if summary.description}
        <p class="description">{summary.description}</p>
      {/if}

      <section class="checklist" aria-label={checklistHeading}>
        <h3>{checklistHeading}</h3>
        <ul>
          {#each summary.checkpoints as checkpoint (checkpoint.key)}
            <li class="checkpoint" class:closed={checkpoint.closed}>
              {#if checkpoint.closed}
                <span class="glyph"><PixelIcon name="check" size={12} /></span>
              {/if}
              <span class="label">{checkpoint.label}</span>
            </li>
          {/each}
        </ul>
      </section>

      <!-- §4.13.5: the share-contact slide INSIDE the sheet — the same
           tz5-04 control with the same props, sharing to this counterpart. -->
      <div class="share">
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
  /* ROUND corners (§4.13.5): the owner change vs HandshakeSheet's pixel
   * steps — the bottom sheet keeps the slide-up, scrim and close pattern. */
  .sheet {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 31;
    background: var(--color-surface);
    border-radius: var(--radius-lg);
    padding: var(--space-5) var(--space-5) calc(var(--bottom-tabbar-height) + var(--space-4));
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    animation: slide-up 200ms ease-out;
    overflow: hidden;
  }
  /* The interlocutor's Deepa hue IS the background; text pairs with the
   * hue's ink token (the §4.10.5 message-bubble pairing — readable AA). */
  .sheet.deepa-1 {
    background: var(--color-deepa-1);
    color: var(--color-deepa-ink-1);
  }
  .sheet.deepa-2 {
    background: var(--color-deepa-2);
    color: var(--color-deepa-ink-2);
  }
  .sheet.deepa-3 {
    background: var(--color-deepa-3);
    color: var(--color-deepa-ink-3);
  }
  .sheet.deepa-4 {
    background: var(--color-deepa-4);
    color: var(--color-deepa-ink-4);
  }
  .sheet.deepa-5 {
    background: var(--color-deepa-5);
    color: var(--color-deepa-ink-5);
  }
  .close {
    position: absolute;
    top: var(--space-3);
    right: var(--space-3);
    width: var(--touch-target);
    height: var(--touch-target);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    color: inherit;
    border-radius: var(--radius-pill);
    transition: opacity 120ms ease-out;
  }
  .close:hover {
    opacity: 0.7;
  }
  .identity {
    display: flex;
    align-items: center;
    gap: var(--space-4);
  }
  .texts .kicker {
    margin: 0 0 2px;
    font-size: 11px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    opacity: 0.8;
  }
  .texts h2 {
    font-size: 24px;
    margin: 0;
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
    stroke: currentColor;
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
  .donut .score {
    stroke: none;
    fill: currentColor;
    font-family: var(--font-body);
    font-size: 30px;
    font-weight: 600;
    text-anchor: middle;
    dominant-baseline: central;
  }
  .description {
    margin: 0;
    font-size: 14px;
    line-height: 1.45;
    opacity: 0.85;
  }
  /* --- networking checklist --------------------------------------------- */
  .checklist h3 {
    margin: 0 0 var(--space-2);
    font-size: 12px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    opacity: 0.8;
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
  .checkpoint .glyph {
    display: inline-flex;
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
    font-size: 14px;
    opacity: 0.8;
  }
  .error {
    margin: 0;
    font-size: 14px;
  }
  /* The retry affordance stays readable on the hue: the ink pairing. */
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
    border: 1px solid currentColor;
    color: inherit;
    transition: opacity 120ms ease-out;
  }
  .cta:disabled {
    opacity: 0.6;
  }
  /* --- celebration (score > 80): sparks + brightness pulse --------------- */
  /* Transform/opacity only (§4.6); prefers-reduced-motion kills both via
   * the base.css catch-all. */
  .fireworks {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }
  .spark {
    position: absolute;
    width: 6px;
    height: 6px;
    background: currentColor;
    opacity: 0;
    animation: spark-fly 900ms ease-out 80ms 2;
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
    background: var(--color-surface);
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
  @keyframes slide-up {
    from {
      transform: translateY(100%);
    }
    to {
      transform: translateY(0);
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
</style>
