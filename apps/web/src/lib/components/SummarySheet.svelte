<script lang="ts">
  /**
   * SummarySheet (CONCEPT §15.3, DESIGN §4.15.C — v3.2 arcade sheet):
   * the finished-chat bottom sheet — the once-only hard-match result
   * presented as a modal over the transcript. Mirrors the HandshakeSheet
   * dialog pattern (scrim, Escape + focus + tab-trap, X close top-right).
   *
   * Arcade core (§4.15.C-1..C-4, tz7-02): the `.arcade-sheet` scope block
   * carries the LOCKED sheet palette (owner-locked electric-purple
   * background — NOT remapped to app tokens; it supersedes the §13.1.5
   * Deepa-hue background, recorded in §15.4) plus the pixel stack
   * ('Press Start 2P' with Handjet fallback — the Fontsource import lives
   * in routes/+layout.svelte with latin + cyrillic(+ext) subsets, RU/EN
   * parity). The entrance is the retro spring-bounce `arcade-rise` and the
   * sections cascade in (~50ms stagger). Top bar: the pixel MEETING
   * SUMMARY label (chat.summary.title) + the pixel X close (scale(0.88)
   * press, 48px target). Top corners 24px; dark scrim stays.
   *
   * CENTERPIECE (§4.15.C-5..C-8, tz7-03):
   * - DUAL PIXEL AVATARS: both pair members' PixelAvatar art in 56×56
   *   SQUARE frames (2px white border, radius 0 — framing, not new
   *   sprites) facing each other across the gauge. "Me" is the Summary
   *   member that is NOT the interlocutor (server truth — Summary
   *   user_a/user_b), its frame carries the `own` accent backdrop.
   * - SCORE RING: thick white arc (SVG stroke-dashoffset over the full
   *   circumference — lib/chats/summary.ts ringScoreOffset) filling
   *   CLOCKWISE 0 → score on open (900ms ease-out, 12 o'clock start),
   *   with the score tally COUNTING UP like an arcade score (rAF one-shot
   *   over the pure tallyValue helper, 700ms, integer steps, landing
   *   exactly on the CEIL integer per §4.14.4; under reduced motion the
   *   rAF path jumps straight to the final value — explicit guard, the
   *   base.css catch-all only intercepts CSS).
   * - SCORE TIERS at the owner-revised 80/50 cut (§4.15.C-6): GREAT
   *   80–100 (avatars move 18px toward center + 2-frame hop loops,
   *   marching pixel beam + star/heart sparkle poppers, recolored spark
   *   burst + brightness pulse), GOOD 50–79 (nod/wave once; the glowing
   *   dotted line between the users was REMOVED — owner microchange
   *   Concept §17.1 / DESIGN §4.15.2.1), LOW 0–49 (avatars stay spaced,
   *   sweat drop + idle blink). All motion is hand-rolled CSS keyframes on positioned DOM
   *   elements (+ the SVG stroke geometry + the two sanctioned JS
   *   one-shots) — no canvas, no animation library (§4.15.C-6a).
   * - CHECKLIST choreography: closed checkpoints pop in sequentially
   *   (box scale steps(2), retro white flash, green check 60ms later) at
   *   400ms + i×140ms; open checkpoints appear with the cascade.
   * - SHEET SLIDE EMBED + COMPLETION (§4.15.C-8): the ShareContactSlide
   *   in variant="sheet" — the locked palette lands as OVERRIDES of the
   *   slide's internal tokens from the sheet scope (:global rules here —
   *   no color props on the slide API, and no --sheet-* consumption
   *   inside the slide component; the scope-containment contract keeps
   *   var(--sheet-*) inside the sheet). Completing a gesture made here
   *   locks the slide, swaps the hint to "Contact shared!" (the 409
   *   "already shared" state keeps its own label), fires the 24-flake
   *   8-bit SQUARE-pixel confetti across the modal and the victory jumps.
   *   A re-mount with `shared` already true replays nothing (shipped
   *   gesture-made gating, restated).
   *
   * LAYOUT (Concept §16.2, DESIGN §4.15.1.2 — tz7-07): the sheet is a
   * FIXED-HEIGHT bottom sheet — bottom-anchored with its top edge JUST
   * BELOW the chat header (header 56px + one --space-2 gap, capped at 90%
   * of the screen via the max() so 88–90% holds on typical viewports and
   * the header stays visible at every size). Structure: PINNED TOP (the
   * top bar + the score stage — never scroll), SCROLLABLE MIDDLE (a
   * .sheet-scroll region holding ONLY the summary text + the checklist,
   * smooth, any length), PINNED BOTTOM (the slide, always visible). The
   * slide's bottom edge mirrors the chat footer's Summarization button
   * offset verbatim — `calc(var(--space-4) + env(safe-area-inset-bottom,
   * 0px))`, the .footer padding-bottom — so both controls sit at the same
   * vertical level from the screen bottom (the stale tab-bar reservation
   * is gone: the transcript page hides the tab bar).
   *
   * Pure presentational — the hosting page (routes/chats/[address]) owns the
   * hardMatch call, the share-contact request and the error/retry state; all
   * state comes in as clean props, the embedded ShareContactSlide shares via
   * the existing shareCard handler (onshare passthrough).
   */
  import { tick } from 'svelte';
  import type { Summary, User } from '@bleak/api-client';
  import { locale, translate, type MessageKey } from '#lib/i18n/locale';
  import {
    RING_RADIUS,
    ringCircumference,
    ringScoreOffset,
    summaryCelebrates,
    summaryScoreDisplay,
    summaryTier,
    tallyValue,
    type SummaryTier
  } from '#lib/chats/summary';
  import ShareContactSlide from './ShareContactSlide.svelte';
  import PixelAvatar from './PixelAvatar.svelte';
  import PixelIcon from './icons/PixelIcon.svelte';

  interface Props {
    open?: boolean;
    /** The interlocutor: the sheet's counterpart avatar and name. */
    user: User | null;
    /** The hard-match Summary (null while loading / failed). */
    summary?: Summary | null;
    /** Page-driven hardMatch pending state (loading row, no stale data). */
    loading?: boolean;
    /** Inline failure state with a retry affordance (no crash). */
    error?: 'network' | 'api' | null;
    errorMessage?: string | null;
    /** ShareContactSlide pass-through (tz5-04 contract). The SHEET variant
     * copy is the sheet's own (§4.15.E keys); the host label stays accepted
     * for API stability and is unused by the sheet embed. */
    slideLabel?: string;
    /** The 409 "already shared" label (kept for re-mounts, §4.15.C-8). */
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
    slideLabel: _slideLabel = '',
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

  /** §4.15.C-5: the arcade tally's live integer (0 → ceil(score)). */
  let tally = $state(0);
  /** §4.15.C-8: a completion gesture made in THIS sheet (replay gating). */
  let completedHere = $state(false);

  /** The ring's full circumference — the dasharray + the fill's from-value. */
  const RING_C = ringCircumference();

  const TIER_KEYS: Record<SummaryTier, MessageKey> = {
    great: 'chat.summary.tier.great',
    good: 'chat.summary.tier.good',
    low: 'chat.summary.tier.low'
  };

  const title = $derived(translate($locale, 'chat.summary.title'));
  const checklistHeading = $derived(translate($locale, 'chat.summary.checklist'));
  const loadingText = $derived(translate($locale, 'chat.summary.loading'));
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

  /** §4.15.C-6: the tier evaluates the RAW score (80/50 cut). */
  const tier = $derived<SummaryTier>(summary === null ? 'low' : summaryTier(summary.score));
  const tierText = $derived(translate($locale, TIER_KEYS[tier]));

  /** The counterpart's opposite member IS me (Summary server truth). */
  const meAddress = $derived.by(() => {
    if (user === null || summary === null) return '';
    return summary.user_a === user.address ? summary.user_b : summary.user_a;
  });
  const meName = $derived(translate($locale, 'chat.summary.me'));

  /** Fireworks + brightness pulse — the GREAT tier (>= 80, lib/chats/summary). */
  const celebrate = $derived(summaryCelebrates(summary));

  /**
   * §4.15.C-8 sheet-variant slide copy: the armed hint is the sheet_label
   * key; on completion the hint swaps to "Contact shared!" — but ONLY for a
   * gesture made here (the 409 "already shared" state keeps its own label,
   * e.g. a re-mount with `shared` already true).
   */
  const slideArmedLabel = $derived(translate($locale, 'chat.contact_share.sheet_label'));
  const slideDoneLabel = $derived(translate($locale, 'chat.contact_share.shared_done'));
  const slideSharedLabelResolved = $derived(
    completedHere ? slideDoneLabel : slideSharedLabel
  );

  /** Confetti + victory jumps: gesture made HERE followed by `shared`. */
  const sheetCelebrated = $derived(completedHere && slideShared);

  /**
   * §4.15.C-8 deterministic confetti — 24 flakes, no randomness (SSR/test
   * parity): origins spread across the sheet's top edge and the slide's
   * center, 8–10px squares, fall ≈60–140% of the sheet height, 0.9–1.6s,
   * 0–0.4s stagger, colors from the sheet scope + the pair's Deepa hues.
   */
  const FLAKE_CLASSES: readonly string[] = [
    'c-y',
    'c-w',
    'c-o',
    'deepa-1',
    'deepa-2',
    'deepa-3',
    'deepa-4',
    'deepa-5'
  ];

  const SHEET_FLAKES = Array.from({ length: 24 }, (_, i) => ({
    left: (i * 53) % 100, // origin across the sheet's top edge (%)
    x: ((i % 7) - 3) * 22, // horizontal drift while falling, px
    y: 300 + (i % 6) * 96, // fall distance (≈60–140% of the sheet), px
    size: 8 + (i % 3), // 8–10px squares
    dur: Number((0.9 + (i % 5) * 0.175).toFixed(3)), // 0.9–1.6s
    delay: Number(((i % 6) * 0.08).toFixed(2)), // 0–0.4s stagger
    cls: FLAKE_CLASSES[i % FLAKE_CLASSES.length] ?? 'c-y'
  }));

  $effect(() => {
    if (open && user) {
      void tick().then(() => sheetEl?.querySelector<HTMLElement>('button, a[href]')?.focus());
    }
  });

  /**
   * §4.15.C-5 tally count-up: one-shot per open — resets and runs the rAF
   * loop 0 → ceil(score) over TALLY_MS (integer steps via tallyValue);
   * under reduced motion it jumps straight to the final value (the
   * base.css catch-all only intercepts CSS — this is the explicit guard).
   */
  $effect(() => {
    if (!open || summary === null) return;
    const target = summaryScoreDisplay(summary.score);
    tally = 0;
    const reduce =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce || typeof requestAnimationFrame !== 'function') {
      tally = target;
      return;
    }
    let raf = 0;
    const start = performance.now();
    const step = (now: number): void => {
      tally = tallyValue(now - start, summary.score);
      if (tally < target) {
        raf = requestAnimationFrame(step);
      } else {
        tally = target; // land EXACTLY on the ceil integer (§4.14.4)
      }
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  });

  /** A close always disarms the completion replay (§4.15.C-8 gating). */
  $effect(() => {
    if (!open) completedHere = false;
  });

  function close(): void {
    open = false;
    onclose?.();
  }

  /** The slide's oncomplete: mark the gesture, then the existing handler. */
  function share(): void {
    completedHere = true;
    onshare?.();
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
    <!-- §4.13.5 → §4.15.C-6b celebration: CSS-only sparks (transform/opacity
         keyframes; reduced-motion is disabled by the base.css catch-all). -->
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

    <!-- §4.15.C-8 sheet completion: 8-bit square-pixel confetti across the
         modal — only for a gesture made here followed by the shared state. -->
    {#if sheetCelebrated}
      <div class="confetti" aria-hidden="true">
        {#each SHEET_FLAKES as flake, i (i)}
          <span
            class="flake {flake.cls}"
            style:left="{flake.left}%"
            style:width="{flake.size}px"
            style:height="{flake.size}px"
            style:--flake-x="{flake.x}px"
            style:--flake-y="{flake.y}px"
            style:--flake-dur="{flake.dur}s"
            style:--flake-delay="{flake.delay}s"
          ></span>
        {/each}
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

    {#if loading}
      <!-- hardMatch pending: a quiet loading row, no fake data. -->
      <p class="loading cascade" style:--cascade-i="1" role="status">{loadingText}</p>
    {:else if error}
      <!-- Inline failure + retry affordance; the sheet stays open. -->
      <p class="error cascade" style:--cascade-i="1" role="alert" aria-live="polite">
        {#if error === 'network'}
          {networkErrorText}
        {:else}
          {apiErrorTitle}{errorMessage ? ` — ${errorMessage}` : ''}
        {/if}
      </p>
      <button type="button" class="cta cascade" style:--cascade-i="2" onclick={() => onretry?.()}>
        {translate($locale, 'common.retry')}
      </button>
    {:else if summary}
      <!-- §4.15.C-5 centerpiece: me avatar — ring — them avatar, tier
           reactions per the score tier (§4.15.C-6; the GOOD-tier dotted
           line is removed, §4.15.2.1). -->
      <section class="stage cascade tier-{tier}" class:victory={sheetCelebrated} style:--cascade-i="1">
        <div class="duel">
          <div class="side me">
            <span class="mover">
              <span class="avatar-frame">
                <PixelAvatar address={meAddress} size={52} own label={meName} />
              </span>
            </span>
            <span class="who">{meName}</span>
          </div>

          <svg
            class="ring"
            viewBox="0 0 160 160"
            role="img"
            aria-label={scoreAria}
          >
            <circle class="track" cx="80" cy="80" r={RING_RADIUS} />
            <circle
              class="arc"
              cx="80"
              cy="80"
              r={RING_RADIUS}
              style:--ring-c={RING_C}
              style:--ring-target={ringScoreOffset(summary.score)}
            />
            <text class="score" x="80" y="80">{tally}</text>
          </svg>

          <div class="side them">
            <span class="mover">
              <span class="avatar-frame">
                <PixelAvatar address={user.address} size={52} label={user.name} />
              </span>
              {#if tier === 'low'}
                <span class="sweat" aria-hidden="true"></span>
              {/if}
            </span>
            <span class="who">{user.name}</span>
          </div>

          {#if tier === 'great'}
            <!-- GREAT bridge: the marching pixel energy beam + 6 sparkle
                 poppers (star ×3, heart ×3) around it (§4.15.C-6b). -->
            <div class="beam" aria-hidden="true"><span class="beam-stripes"></span></div>
            <div class="sparkles" aria-hidden="true">
              <span class="popper p1"><PixelIcon name="star" size={16} /></span>
              <span class="popper p2"><PixelIcon name="heart" size={16} /></span>
              <span class="popper p3"><PixelIcon name="star" size={16} /></span>
              <span class="popper p4"><PixelIcon name="heart" size={16} /></span>
              <span class="popper p5"><PixelIcon name="star" size={16} /></span>
              <span class="popper p6"><PixelIcon name="heart" size={16} /></span>
            </div>
            <!-- GOOD tier: NO bridge element — the old glowing dotted line
                 between the two users was removed (owner microchange
                 Concept §17.1 / DESIGN §4.15.2.1); the nod/wave avatar
                 animations stay. -->
          {/if}
        </div>
        <p class="tier-label" class:great={tier === 'great'}>{tierText}</p>
      </section>

      <!-- §16.2/§4.15.1.2 scrollable middle: ONLY the conversation summary
           text and the NETWORKING CHECKLIST scroll (smooth, however long
           the text); the pinned top (bar + stage) and the pinned bottom
           (slide) stay outside this region. -->
      <div class="sheet-scroll">
        {#if summary.description}
          <p class="description cascade" style:--cascade-i="2">{summary.description}</p>
        {/if}

        <section class="checklist cascade" style:--cascade-i="3" aria-label={checklistHeading}>
        <h3>{checklistHeading}</h3>
          <ul>
            {#each summary.checkpoints as checkpoint, i (checkpoint.key)}
              <li class="checkpoint" class:closed={checkpoint.closed} style:--pop-i={i}>
                <!-- §4.14.4 sheet polish: a SQUARE checkbox per checkpoint —
                     the closed ones carry the green check glyph inside, the
                     open ones keep the empty square. §4.15.C-7: closed items
                     pop in sequentially with a retro flash. -->
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
      </div>

      <!-- §4.15.C-8: the v2 slide in its SHEET variant — same control, same
           request, sharing to this counterpart via the existing handler.
           §16.2 pinned bottom: it stays fixed at the sheet bottom. -->
      <div class="share cascade" style:--cascade-i="4">
        <ShareContactSlide
          label={slideArmedLabel}
          sharedLabel={slideSharedLabelResolved}
          disabledHint={slideDisabledHint}
          disabled={slideDisabled}
          pending={slidePending}
          shared={slideShared}
          variant="sheet"
          oncomplete={share}
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
    /* §16.2 (§4.15.1.2) FIXED HEIGHT + ANCHOR: bottom-anchored; the top
     * edge sits JUST BELOW the chat header — the header is 56px tall
     * (routes/chats/[address] `.top-bar`), + one --space-2 gap — and the
     * max() against 10dvh caps the height at 90% of the screen so the
     * 88–90% band holds on typical viewports while the header stays
     * visible at every size. */
    top: max(10dvh, calc(56px + var(--space-2)));
    width: calc(100% - 2 * var(--space-4));
    margin-inline: auto;
    z-index: 31;
    background: var(--sheet-bg);
    color: var(--sheet-ink);
    /* §4.15.C-2: 24px TOP corners only (bottom edge meets the viewport). */
    border-radius: var(--radius-lg) var(--radius-lg) 0 0;
    /* §16.2 (§4.15.1.2) EXACT VERTICAL ALIGNMENT: the bottom padding is the
     * chat footer's padding-bottom VERBATIM (routes/chats/[address]
     * `.footer` — `calc(var(--space-4) + env(safe-area-inset-bottom,
     * 0px))`), so the pinned slide's bottom edge sits at the SAME offset
     * from the screen bottom as the Summarization button behind the sheet
     * (same vertical level / baseline). The stale --bottom-tabbar-height
     * reservation is gone: the transcript page hides the tab bar. */
    padding: var(--space-5) var(--space-5) calc(var(--space-4) + env(safe-area-inset-bottom, 0px));
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
   * Sections carry --cascade-i (top bar → score stage → description →
   * checklist → slide). */
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
  /* §16.2 (§4.15.1.2) pinned top: flex-shrink: 0 — the MEETING SUMMARY bar
   * + X close never scroll and never shrink away. */
  .top-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
    flex-shrink: 0;
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
  /* --- §4.15.C-5 centerpiece stage ---------------------------------------- */
  /* §16.2 (§4.15.1.2) pinned top: the dual avatars + the score ring (the
   * whole stage, tier label included) never scroll — the tier animations
   * stay in the pinned top. */
  .stage {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-2);
    flex-shrink: 0;
  }
  /* §16.2 (§4.15.1.2) SCROLLABLE MIDDLE: ONLY the conversation summary
   * text and the NETWORKING CHECKLIST scroll here — smooth, however long
   * the text. min-height: 0 lets the fixed-height flex sheet hand this
   * region exactly the leftover space between the pinned top and the
   * pinned bottom; overscroll containment keeps the scroll inside the
   * modal (no chaining to the transcript behind the scrim). */
  .sheet-scroll {
    flex: 1 1 auto;
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    overflow-y: auto;
    scroll-behavior: smooth;
    overscroll-behavior: contain;
  }
  .duel {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-5);
  }
  .side {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-2);
  }
  /* §4.15.C-5 avatars: 56×56 SQUARE pixel frames — 2px white border,
   * radius 0 (unlike the rounded frames elsewhere) — around the
   * PixelAvatar art (52px inside the border). Framing, not new sprites;
   * image-rendering: pixelated pins the raster fallback. (The class is
   * .avatar-frame — PixelAvatar's own root span is .frame.) */
  .avatar-frame {
    box-sizing: border-box;
    width: 56px;
    height: 56px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 2px solid var(--sheet-white);
    border-radius: 0;
    image-rendering: pixelated;
    overflow: hidden;
  }
  .mover {
    position: relative;
    display: inline-flex;
  }
  /* Names under the frames — Inter 12px semibold, white ink. */
  .who {
    font-family: var(--font-body);
    font-size: 12px;
    font-weight: 600;
    color: var(--sheet-white);
    max-width: 96px;
    text-align: center;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  /* --- the ring (§4.15.C-5): SVG stroke-dashoffset fill, clockwise -------- */
  /* Thick white arc (stroke-width 12, butt caps — square ends for the pixel
   * aesthetic), crispEdges on the SVG. The fill runs 0 → score on open:
   * dasharray = the full circumference, dashoffset animated from the full C
   * to c × (1 − score/100) (geometry: lib/chats/summary ringScoreOffset)
   * over 900ms ease-out — the shipped donut precedent (§4.13.5). */
  .ring {
    width: 160px;
    height: 160px;
    flex-shrink: 0;
    shape-rendering: crispEdges;
  }
  .ring circle {
    fill: none;
    stroke: var(--sheet-white);
    stroke-width: 12;
  }
  .ring .track {
    stroke: color-mix(in srgb, var(--sheet-white) 25%, transparent);
  }
  /* The arc starts at 12 o'clock and sweeps clockwise with the score. */
  .ring .arc {
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
  /* §4.15.C-5/C-3: the score numeral renders in the pixel stack 28px. */
  .ring .score {
    stroke: none;
    fill: var(--sheet-white);
    font-family: var(--sheet-font-pixel);
    font-size: 28px;
    letter-spacing: 0;
    text-anchor: middle;
    dominant-baseline: central;
  }
  /* §4.15.C-6: the tier label under the ring — pixel face 10px, yellow for
   * GREAT, white otherwise (plain text — no color-only meaning, C-9). */
  .tier-label {
    margin: 0;
    font-family: var(--sheet-font-pixel);
    font-size: 10px;
    letter-spacing: 0;
    color: var(--sheet-white);
    text-align: center;
  }
  .tier-label.great {
    color: var(--sheet-yellow);
  }
  /* --- §4.15.C-6b tier animations ----------------------------------------- */
  /* GREAT 80–100: both avatars move 18px toward the center on open (300ms
   * ease-out, 200ms delay), then bounce joyfully in idle 2-frame pixel
   * loops (steps(2, jump-none) on a two-keyframe pair). */
  .tier-great .side.me .mover {
    animation: avatar-approach 300ms ease-out 200ms both;
  }
  .tier-great .side.them .mover {
    animation: avatar-approach-left 300ms ease-out 200ms both;
  }
  @keyframes avatar-approach {
    from {
      transform: translateX(0);
    }
    to {
      transform: translateX(18px);
    }
  }
  @keyframes avatar-approach-left {
    from {
      transform: translateX(0);
    }
    to {
      transform: translateX(-18px);
    }
  }
  .tier-great .mover .avatar-frame {
    animation: avatar-hop 600ms steps(2, jump-none) infinite alternate;
    animation-delay: 500ms;
  }
  @keyframes avatar-hop {
    from {
      transform: translateY(0);
    }
    to {
      transform: translateY(-6px);
    }
  }
  /* GOOD 50–79: a friendly nod/wave once on open (two dips / two rocks),
   * then idle. */
  .tier-good .side.me .avatar-frame {
    animation: avatar-nod 400ms ease-in-out 400ms 2 both;
  }
  @keyframes avatar-nod {
    0%,
    100% {
      transform: translateY(0);
    }
    50% {
      transform: translateY(2px);
    }
  }
  .tier-good .side.them .avatar-frame {
    animation: avatar-wave 400ms ease-in-out 400ms 2 both;
    transform-origin: 50% 100%;
  }
  @keyframes avatar-wave {
    0%,
    100% {
      transform: rotate(0deg);
    }
    25% {
      transform: rotate(-6deg);
    }
    50% {
      transform: rotate(6deg);
    }
    75% {
      transform: rotate(-6deg);
    }
  }
  /* LOW 0–49: avatars stay spaced apart (no approach); a playful sweat
   * drop beside the counterpart's frame — falls twice, then idles on the
   * 4s cycle — and a neutral 120ms idle blink on each frame every 4s. */
  .tier-low .side.them .sweat {
    position: absolute;
    top: 0;
    left: -14px;
    width: 8px;
    height: 10px;
    background: var(--sheet-white);
    animation: sweat-cycle 4s linear infinite;
  }
  @keyframes sweat-cycle {
    0% {
      transform: translateY(0);
      opacity: 1;
    }
    17.5% {
      transform: translateY(10px);
      opacity: 0;
    }
    17.6% {
      transform: translateY(0);
      opacity: 0;
    }
    25% {
      transform: translateY(0);
      opacity: 1;
    }
    42.5% {
      transform: translateY(10px);
      opacity: 0;
    }
    100% {
      transform: translateY(10px);
      opacity: 0;
    }
  }
  .tier-low .mover .avatar-frame {
    animation: avatar-blink 4s linear infinite;
  }
  @keyframes avatar-blink {
    0%,
    97% {
      opacity: 1;
    }
    98% {
      opacity: 0.65;
    }
    100% {
      opacity: 1;
    }
  }
  /* GREAT bridge: the marching pixel energy beam — a 4px stepped strip
   * (8px dashes) translating one step per 800ms, its opacity pulsing
   * 0.7↔1.0 (two animations, disjoint properties). */
  .beam {
    position: absolute;
    left: 50%;
    top: 50%;
    width: calc(160px + 2 * var(--space-5));
    height: 4px;
    transform: translate(-50%, -50%);
    overflow: hidden;
    pointer-events: none;
    animation: beam-pulse 1.2s ease-in-out infinite;
  }
  .beam-stripes {
    position: absolute;
    top: 0;
    bottom: 0;
    left: 0;
    width: calc(100% + 16px);
    background: repeating-linear-gradient(
      90deg,
      var(--sheet-yellow) 0 8px,
      transparent 8px 16px
    );
    animation: beam-march 800ms steps(2, jump-none) infinite;
  }
  @keyframes beam-march {
    from {
      transform: translateX(0);
    }
    to {
      transform: translateX(-16px);
    }
  }
  @keyframes beam-pulse {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.7;
    }
  }
  /* GOOD tier: the old glowing dotted-line bridge (the 6px square-dot row
   * + its pre-blurred pulsing glow layer and its opacity keyframes) was
   * REMOVED — owner microchange Concept §17.1 / DESIGN §4.15.2.1; the
   * nod/wave avatar animations above stay. */
  /* GREAT sparkles: 6 pixel-glyph poppers (star ×3, heart ×3) absolutely
   * positioned around the bridge — 1.2s stepped scale/opacity loops with
   * 0–500ms staggered delays, colored yellow/orange/white. */
  .sparkles {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }
  .popper {
    position: absolute;
    display: inline-flex;
    opacity: 0;
    transform: scale(0);
    animation: sparkle-pop 1.2s steps(2, jump-none) infinite;
  }
  .popper.p1 { left: 18%; top: 12%; color: var(--sheet-yellow); animation-delay: 0ms; }
  .popper.p2 { left: 66%; top: 6%; color: var(--sheet-orange); animation-delay: 100ms; }
  .popper.p3 { left: 82%; top: 34%; color: var(--sheet-white); animation-delay: 200ms; }
  .popper.p4 { left: 74%; top: 72%; color: var(--sheet-yellow); animation-delay: 300ms; }
  .popper.p5 { left: 26%; top: 78%; color: var(--sheet-white); animation-delay: 400ms; }
  .popper.p6 { left: 8%; top: 40%; color: var(--sheet-orange); animation-delay: 500ms; }
  @keyframes sparkle-pop {
    0% {
      transform: scale(0);
      opacity: 0;
    }
    30% {
      transform: scale(1);
      opacity: 1;
    }
    60% {
      transform: scale(1);
      opacity: 1;
    }
    100% {
      transform: scale(0);
      opacity: 0;
    }
  }
  /* §4.15.C-8 completion: BOTH avatars do the celebratory victory jump —
   * once per completion gesture made here (.victory keys to gesture →
   * shared; a re-mount with shared true replays nothing). */
  .stage.victory .mover {
    animation: victory-jump 700ms steps(2, jump-none) 2;
  }
  @keyframes victory-jump {
    0% {
      transform: translateY(0);
    }
    30% {
      transform: translateY(-10px);
    }
    45% {
      transform: translateY(0);
    }
    55% {
      transform: translateY(-6px);
    }
    65% {
      transform: translateY(0);
    }
    100% {
      transform: translateY(0);
    }
  }
  /* --- §4.15.C-7 conversation summary & checklist ------------------------- */
  /* §4.15.C-7: crisp white sans body copy on purple. */
  .description {
    margin: 0;
    color: var(--sheet-ink);
    font-size: 14px;
    line-height: 1.45;
    text-align: left;
  }
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
    position: relative;
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
  /* §4.15.C-7 ENTRANCE CHOREOGRAPHY: each closed checkpoint pops in
   * sequentially — the box scales 0→1 with steps(2) (150ms), a retro white
   * flash fires right after the pop (120ms), the check glyph appears 60ms
   * later; item i's delay = 400ms + i×140ms (the drawn one-by-one
   * cadence). Open checkpoints appear with the cascade (no pop, no
   * flash). */
  .checkpoint.closed .box {
    animation: box-pop 150ms steps(2, jump-none) both;
    animation-delay: calc(400ms + var(--pop-i, 0) * 140ms);
  }
  @keyframes box-pop {
    from {
      transform: scale(0);
    }
    to {
      transform: scale(1);
    }
  }
  .checkpoint.closed .box::after {
    content: '';
    position: absolute;
    inset: -1.5px;
    background: var(--sheet-white);
    opacity: 0;
    animation: retro-flash 120ms linear both;
    animation-delay: calc(400ms + var(--pop-i, 0) * 140ms + 150ms);
  }
  @keyframes retro-flash {
    from {
      opacity: 1;
    }
    to {
      opacity: 0;
    }
  }
  .checkpoint.closed .check {
    animation: check-in 60ms linear both;
    animation-delay: calc(400ms + var(--pop-i, 0) * 140ms + 280ms);
  }
  @keyframes check-in {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }
  /* --- §4.15.C-8 sheet-variant slide (§4.15.A internal-token API) --------- */
  /* The locked sheet palette lands as OVERRIDES of the slide's internal
   * custom properties FROM THE SHEET SCOPE (:global rules here): no color
   * props exist on the slide API (§4.15.F), and no --sheet-* token is
   * consumed inside the slide component (the scope-containment contract
   * keeps var(--sheet-*) inside the sheet — cascade delivers the values). */
  .share {
    margin-top: var(--space-2);
    /* §16.2 (§4.15.1.2) pinned bottom: the slide stays fixed at the sheet
     * bottom, always visible. */
    flex-shrink: 0;
  }
  .share :global(.slide) {
    /* §4.15.C-8 height: the 64px floor (§15.3) with the width ÷ 3.75
     * target, capped at 80px — the 3.5:1–4:1 band holds because the slide
     * caps at 288px wide (from 720px up the sheet is 640px and the track
     * stays 288px, centered). The inset math mirrors the sheet's own
     * width chain (the page's --space-4 insets + the sheet's --space-5
     * padding). The thumb stays height − 8px (the §4.15.A invariant). */
    --slide-height: clamp(64px, calc((100vw - 2 * var(--space-4) - 2 * var(--space-5)) / 3.75), 80px);
    --slide-track-bg: var(--sheet-charcoal);
    --slide-track-border: var(--sheet-yellow);
    --slide-thumb: var(--sheet-yellow);
    --slide-thumb-ink: var(--sheet-charcoal);
    --slide-stripe-a: var(--sheet-yellow);
    --slide-stripe-b: var(--sheet-white);
    --slide-stripe-c: var(--sheet-orange);
    --slide-hint-ink: var(--sheet-white);
    /* §4.15.C-3: the sheet-variant hint is the pixel face at 10px. */
    --slide-hint-font: 10px var(--sheet-font-pixel);
  }
  .share :global(.slide .track) {
    border-width: 2px;
  }
  .share :global(.slide .hint) {
    text-transform: uppercase;
  }
  /* §4.15.C-8 trail: the 3-color cycle (yellow/white/orange, 12px
   * segments — brighter/wider per the owner note), period 36px → the
   * seamless loop shift 36 / 0.70711 ≈ 50.912px, marquee 0.9s linear
   * infinite ("continuously scrolling forward"). */
  .share :global(.slide .candy-stripes) {
    width: calc(100% + 56px);
    background: repeating-linear-gradient(
      45deg,
      var(--slide-stripe-a) 0 12px,
      var(--slide-stripe-b) 12px 24px,
      var(--slide-stripe-c) 24px 36px
    );
    animation: sheet-marquee 0.9s linear infinite;
  }
  @keyframes sheet-marquee {
    from {
      transform: translateX(0);
    }
    to {
      transform: translateX(-50.912px);
    }
  }
  /* §4.15.C-8: the yellow thumb's subtly pulsing pixel arrow (opacity
   * 1↔0.6 over 1s). */
  .share :global(.slide .thumb svg) {
    animation: arrow-pulse 1s ease-in-out infinite;
  }
  @keyframes arrow-pulse {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.6;
    }
  }
  /* --- §4.15.C-8 sheet confetti: 8-bit SQUARE pixels across the modal ----- */
  .confetti {
    position: absolute;
    inset: 0;
    z-index: 2;
    pointer-events: none;
  }
  .flake {
    position: absolute;
    top: 0;
    border-radius: 0; /* the 8-bit shape change vs the v3.1 round flakes */
    opacity: 0;
    animation: confetti-fall var(--flake-dur) ease-in var(--flake-delay) 1 forwards;
  }
  .flake.c-y {
    background: var(--sheet-yellow);
  }
  .flake.c-w {
    background: var(--sheet-white);
  }
  .flake.c-o {
    background: var(--sheet-orange);
  }
  .flake.deepa-1 {
    background: var(--color-deepa-1);
  }
  .flake.deepa-2 {
    background: var(--color-deepa-2);
  }
  .flake.deepa-3 {
    background: var(--color-deepa-3);
  }
  .flake.deepa-4 {
    background: var(--color-deepa-4);
  }
  .flake.deepa-5 {
    background: var(--color-deepa-5);
  }
  @keyframes confetti-fall {
    0% {
      transform: translate(0, 0);
      opacity: 1;
    }
    80% {
      opacity: 1;
    }
    100% {
      transform: translate(var(--flake-x), var(--flake-y));
      opacity: 0;
    }
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
  /* --- celebration (GREAT tier ≥ 80): sparks + brightness pulse ----------- */
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
  /* §4.15.C-9 reduced motion: the base.css catch-all zeroes animation
   * DURATIONS; the staged DELAYS are zeroed here so the choreography
   * (approach, idle loops, pop/flash/check) collapses to the final
   * instant state without the staggered waits. The JS one-shots (the
   * tally rAF) check the media query explicitly (see the effect above). */
  @media (prefers-reduced-motion: reduce) {
    .tier-great .side.me .mover,
    .tier-great .side.them .mover,
    .tier-great .mover .avatar-frame,
    .tier-good .side.me .avatar-frame,
    .tier-good .side.them .avatar-frame,
    .tier-low .side.them .sweat,
    .tier-low .mover .avatar-frame,
    .checkpoint.closed .box,
    .checkpoint.closed .box::after,
    .checkpoint.closed .check {
      animation-delay: 0ms;
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
    /* §4.15.C-3: the sheet-variant hint steps up to 12px from 720px up. */
    .share :global(.slide .hint) {
      font-size: 12px;
    }
  }
</style>
