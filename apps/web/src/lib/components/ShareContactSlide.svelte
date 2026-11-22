<script lang="ts">
  /**
   * ShareContactSlide v2 (DESIGN §4.15.A / Concept §15.1): the owner's
   * iOS-style "Slide to Answer" control for sharing a contact card.
   *
   * Rendered in the dialog footer (routes/chats/[address]) and REUSABLE
   * inside the tz5-05 summary sheet — all copy and state come in as clean
   * props; the component never calls the API itself. `oncomplete` fires
   * ONCE per completed gesture (the parent owns the request + the
   * shared/disabled states afterwards).
   *
   * States (parent-driven, machine unchanged from §4.13.3):
   * - `shared`    → the thumb locks right, `sharedLabel` in the track,
   *                 non-interactive (server truth is the 409 "already
   *                 shared"; a 201 lands here too);
   * - `disabled`  → the thumb is inert at rest, `disabledHint` centered
   *                 (no glass shimmer motion);
   * - `pending`   → the request is in flight; the thumb is inert so a
   *                 second gesture cannot double-fire;
   * - otherwise   → the armed slide: drag the thumb right to complete —
   *                 release ≥ 85% of the drag range snaps to the end,
   *                 release below springs back; click / Enter / Space on
   *                 the thumb activates DIRECTLY (the accessible path is
   *                 the documented equivalent of the gesture, §4.15.A —
   *                 NOT subject to the 85% rule).
   *
   * v2 look (§4.15.A): dark translucent glass pill track with a shimmering
   * centered hint that fades out with drag progress; a crisp white thumb
   * carrying the green `phone` glyph (base variant); and the candy-cane
   * trail — a WRAPPING striped pill (§4.15.1.1): the fill starts at the
   * track's left edge, wraps around the draggable circle and ends in a
   * matching pill cap hugging the thumb's right edge with a uniform 4px
   * ring (width = the thumb's padding-box diameter + 8px + dx), with the
   * continuous 45° stripe marquee looping seamlessly at 24px ÷ sin45° ≈
   * 33.941px inside it. The v3.1 confetti flake system is reused
   * unchanged (gesture made here + shared landed → 201 AND 409
   * celebrate; a re-mount replays nothing).
   *
   * v3.3 geometry amendment (§4.15.1.1 — owner change request): the
   * SHEET track spans the full content column (the sheet's --space-5
   * insets put that at the 88–92% share of the modal's width, aligned
   * with the checklist/summary text edges) at a literal 64px height;
   * the base variant keeps its own §4.15.A sizing (76px, min(100%,
   * 288px)). Layering: placeholder < candy fill < thumb — the stripes
   * cover/clip the text as the fill expands, and the hint fade completes
   * BY the track's midpoint. The completed thumb nests in the right end
   * at the uniform 4px margin.
   *
   * Variant API (§4.15.A): `variant: 'base' | 'sheet'` maps to a scope
   * class that swaps the component's INTERNAL custom properties — parents
   * may not pass raw colors. The locked sheet palette values land with the
   * sheet task (§4.15.C-E); the prop and the scope plumbing ship here.
   */
  import PixelIcon from './icons/PixelIcon.svelte';

  interface Props {
    /** Armed-state hint shown in the track (e.g. "Swipe right to share"). */
    label: string;
    /** Shared-state copy (sharedLabel, thumb locked right). */
    sharedLabel: string;
    /** Disabled-state hint (replaces `label` in the track). */
    disabledHint: string;
    /** Gate off (dialog not finished / no card / parent says no). */
    disabled?: boolean;
    /** Request in flight — the thumb cannot be re-gripped. */
    pending?: boolean;
    /** Already shared — the terminal, non-interactive state. */
    shared?: boolean;
    /** Component scope: base (footer/glass) or sheet (§4.15.C palette). */
    variant?: 'base' | 'sheet';
    /** Fired ONCE when the gesture completes (≥85% release, mid-gesture end, or activation). */
    oncomplete?: () => void;
  }

  let {
    label,
    sharedLabel,
    disabledHint,
    disabled = false,
    pending = false,
    shared = false,
    variant = 'base',
    oncomplete
  }: Props = $props();

  /** Drag offset in px (0 = thumb at rest). */
  let dx = $state(0);
  /** The thumb is currently gripped (pointer down, drag live). */
  let gripping = $state(false);
  /** The live gesture consumed the pointer (suppresses the click fallback). */
  let dragged = $state(false);
  /** Release animation: spring-back overrides the default completion snap. */
  let release = $state<'spring' | null>(null);
  /** Pointer-down clientX — the drag delta reference. */
  let startX = 0;

  const inert = $derived(disabled || pending || shared);
  const armed = $derived(!inert);
  const trackText = $derived(
    shared ? sharedLabel : disabled ? disabledHint : label
  );

  /**
   * Drag progress 0..1 (dx / maxDx) — drives the hint fade-out
   * (inline `opacity = 1 − progress`, gone before the thumb reaches the
   * end, §4.15.A). A 0px track (tests/SSR) keeps progress at 0.
   */
  const progress = $derived.by(() => {
    const offset = dx; // read unconditionally — dx must always be tracked
    const max = maxDx();
    return max > 0 ? Math.min(offset / max, 1) : 0;
  });

  /**
   * §4.15.1.1: the placeholder fade completes BY the center — the hint is
   * fully gone as the thumb passes the track's midpoint (progress 0.5).
   * The candy fill paints above the text regardless; the fade is the
   * smooth pre-cover polish.
   */
  const hintFade = $derived(Math.min(progress * 2, 1));

  /**
   * Confetti (Concept §14.1.1 / DESIGN §4.14.1 → reused unchanged per
   * §4.15.A): plays when a completion gesture made HERE is followed by
   * the parent landing the shared state. The gesture flag is set in
   * `complete()`; the confetti renders only once BOTH the gesture and
   * `shared` are true, so 201 AND 409 celebrate (both land `shared`)
   * while a failed request (never lands `shared`) does not — and an
   * already-shared chat re-mounting with `shared` true from the start
   * (the parent hydrating the local mark) replays nothing.
   */
  let celebrated = $state(false);

  /** Deterministic flakes — no randomness (SSR render + tests identical). */
  const FLAKES = Array.from({ length: 12 }, (_, i) => ({
    x0: ((i * 53) % 200) - 100, // start offset around the center, px
    x: ((i % 5) - 2) * 18, // horizontal drift while falling, px
    y: 90 + (i % 3) * 30, // fall distance past the container bottom, px
    rot: (i % 2 ? 1 : -1) * (240 + i * 37), // spin, deg
    dur: 0.9 + (i % 4) * 0.18, // duration, s
    delay: (i % 6) * 0.07, // stagger, s
    hue: (i % 5) + 1 // Deepa color class 1..5
  }));

  /** progress in 0..1 — 0px track (tests/SSR) completes on any move. */
  let trackEl: HTMLElement | null = $state(null);
  let thumbEl: HTMLElement | null = $state(null);

  /**
   * Drag range (§4.15.1.1 nesting): the thumb travels from the left 4px
   * padding edge to the mirrored right edge — track (padding box) width
   * − thumb width − the two 4px padding insets. The completed thumb
   * nests EXACTLY at the 4px margin (no overflow clipping, no overshoot).
   */
  function maxDx(): number {
    const track = trackEl?.clientWidth ?? 0;
    const thumb = thumbEl?.clientWidth ?? 0;
    return Math.max(track - thumb - 8, 0);
  }

  /**
   * Completion (§4.15.A): the thumb animates to the end (default 160ms
   * ease-out snap) and `oncomplete` fires immediately — the parent starts
   * the request and lands `shared` (201 or 409) when it answers. Any
   * release path and the direct activation converge here.
   */
  function complete(): void {
    if (inert) return;
    celebrated = true; // a gesture completed here — the confetti arms
    dx = maxDx();
    release = null; // the default snap transition, not the spring
    oncomplete?.();
    gripping = false;
  }

  function onPointerDown(event: PointerEvent): void {
    if (inert || event.button !== 0) return;
    (event.currentTarget as HTMLElement | null)?.setPointerCapture?.(event.pointerId);
    gripping = true;
    dragged = false;
    release = null;
    startX = event.clientX;
    dx = 0;
  }

  function onPointerMove(event: PointerEvent): void {
    if (inert || !gripping) return;
    dx = Math.max(event.clientX - startX, 0);
    if (dx > 2) dragged = true;
    // Dragging all the way to the end mid-gesture still completes at once.
    if (dx >= maxDx()) complete();
  }

  /**
   * Release rule (§4.15.A — supersedes the shipped always-snap): at/past
   * 85% of the drag range → snap to the end and complete; below → spring
   * back smoothly (240ms light-overshoot bezier on thumb + trail).
   */
  function onPointerUp(): void {
    if (inert || !gripping) return;
    gripping = false;
    const max = maxDx();
    if (max > 0 && dx >= 0.85 * max) {
      complete();
    } else {
      release = 'spring';
      dx = 0;
    }
  }

  /**
   * The accessible activation path: click / Enter / Space on the thumb
   * completes the gesture without a pointer drag (screen readers,
   * keyboards, and tests). It is the documented equivalent of the gesture
   * and is NOT subject to the 85% release rule (§4.15.A). A pointer drag
   * ending on the thumb also emits click — the `dragged` flag suppresses
   * the double fire.
   */
  function onClick(): void {
    if (dragged) {
      dragged = false;
      return;
    }
    complete();
  }
</script>

<div
  class="slide"
  class:variant-base={variant === 'base'}
  class:variant-sheet={variant === 'sheet'}
  class:shared
  class:disabled
  class:pending
  class:armed={!inert}
  aria-disabled={inert}
>
  <div class="track" bind:this={trackEl}>
    <!-- §4.15.1.1 z-order: the hint paints BELOW the candy fill (stripes
         cover/clip the text as the fill expands) and the thumb paints on
         top of the fill — all three are positioned, so DOM order is the
         paint order (no z-index fights). -->
    <span class="hint" style:opacity={`${armed ? 1 - hintFade : 1}`}>{trackText}</span>
    {#if armed}
      <!-- §4.15.1.1 candy trail: the striped WRAPPING pill — the container
           starts at the track's left edge, wraps around the draggable
           circle and ends in a matching pill cap hugging the thumb's right
           edge with a uniform 4px ring (width = the thumb's padding-box
           diameter + 8px + dx; the cap is concentric with the circle at
           every dx). Marquee stripe layer inside, unchanged (§4.15.A).
           Armed only — shared/disabled stay plain. -->
      <span
        class="candy"
        class:gripping
        class:spring={release === 'spring'}
        aria-hidden="true"
        style:width="calc(var(--slide-height) - 2 * var(--slide-border-w) + {dx}px)"
      >
        <span class="candy-stripes"></span>
      </span>
    {/if}
    <button
      type="button"
      class="thumb"
      class:gripping
      class:spring={release === 'spring'}
      bind:this={thumbEl}
      style:transform={`translateX(${shared ? 0 : dx}px)`}
      disabled={inert}
      aria-label={trackText}
      onpointerdown={onPointerDown}
      onpointermove={onPointerMove}
      onpointerup={onPointerUp}
      onpointercancel={onPointerUp}
      onclick={onClick}
    >
      {#if shared}
        <PixelIcon name="check" size={16} />
      {:else if variant === 'sheet'}
        <PixelIcon name="arrow-right" size={16} />
      {:else}
        <PixelIcon name="phone" size={16} />
      {/if}
    </button>
  </div>
  {#if celebrated && shared}
    <div class="confetti" aria-hidden="true">
      {#each FLAKES as flake, i (i)}
        <span
          class="flake deepa-{flake.hue}"
          style:left="calc(50% + {flake.x0}px)"
          style:--flake-x="{flake.x}px"
          style:--flake-y="{flake.y}px"
          style:--flake-rot="{flake.rot}deg"
          style:--flake-dur="{flake.dur}s"
          style:--flake-delay="{flake.delay}s"
        ></span>
      {/each}
    </div>
  {/if}
</div>

<style>
  .slide {
    /* §4.15.A variant scope — the component colors ONLY through these
     * internal tokens; the `.variant-sheet` scope swaps them (locked sheet
     * palette lands with the sheet task, §4.15.C-E). Parents may not pass
     * raw colors. Base defaults per §4.15.A. */
    --slide-height: 76px;
    --slide-pad: 4px; /* the 4px internal padding (thumb = height − 8px) */
    --slide-border-w: 1px; /* the track border width — feeds the ring math */
    --slide-track-bg: color-mix(in srgb, var(--color-bg) 45%, transparent);
    --slide-track-border: color-mix(in srgb, var(--color-text) 18%, transparent);
    --slide-thumb: var(--color-text); /* the crisp white circle */
    --slide-thumb-ink: var(--color-check-green); /* the green phone glyph */
    --slide-stripe-a: var(--color-danger-text); /* candy red */
    --slide-stripe-b: var(--color-text); /* candy white */
    --slide-stripe-c: var(--color-text); /* sheet's third stripe (§4.15.C) */
    --slide-hint-ink: var(--color-text-muted);
    --slide-hint-font: 500 14px var(--font-body);

    /* anchors the confetti layer's "from the top of the container" origin;
     * the pill is centered in its slot at the §4.15.A ~3.8:1 ratio */
    position: relative;
    width: 100%;
    display: flex;
    justify-content: center;
  }
  .track {
    position: relative;
    width: min(100%, 288px); /* base: the 3.8:1 pill at the 76px height (§4.15.A) */
    height: var(--slide-height);
    padding: var(--slide-pad);
    background: var(--slide-track-bg);
    border: var(--slide-border-w) solid var(--slide-track-border);
    border-radius: var(--radius-pill);
    overflow: hidden;
    /* dark translucent glassmorphism (§4.15.A) */
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    /* §4.15.1.1: flex centers the placeholder STRICTLY, both axes, in the
     * full track width — the candy/thumb stay absolutely positioned. */
    display: flex;
    align-items: center;
  }
  /* §4.15.1.1 sheet geometry (declared on .track so it wins the cascade
   * over the sheet's --slide-height slot on .slide regardless of order):
   * - width 100% of the component's slot = the sheet's content column,
   *   which the sheet's --space-5 content insets hold at the 88–92% share
   *   of the MODAL's width, horizontally aligned with the checklist and
   *   summary text edges (the modal width is the reference in the sheet
   *   context);
   * - height a literal 64px (the amendment drops the sheet's clamp);
   * - the sheet's 2px border feeds the ring math via the token (keeping
   *   the sheet's own border-width override in sync). */
  .variant-sheet .track {
    width: 100%;
    --slide-height: 64px;
    --slide-border-w: 2px;
  }
  .hint {
    position: relative; /* anchors the sheen ::after to the hint box only */
    flex: 1;
    text-align: center;
    font: var(--slide-hint-font);
    color: var(--slide-hint-ink);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    /* §4.15.1.1: the hint sits BELOW the candy fill — the stripes cover/
     * clip the text as the fill expands (paint order: DOM order). */
  }
  /* Shimmer sheen (§4.15.A): a gradient stripe sweeping across the hint
   * text, transform-only keyframes (§4.6), armed state only — the
   * disabled/shared hints keep a still, plain track. */
  .armed .hint::after {
    content: '';
    position: absolute;
    top: 0;
    bottom: 0;
    left: -45%;
    width: 45%;
    background: linear-gradient(
      90deg,
      transparent,
      color-mix(in srgb, var(--slide-hint-ink) 45%, transparent),
      transparent
    );
    animation: hint-sheen 2.4s linear infinite;
  }
  @keyframes hint-sheen {
    from {
      transform: translateX(0);
    }
    to {
      transform: translateX(322%);
    }
  }
  /* Candy-cane trail (Concept §15.1 / DESIGN §4.15.A; §4.15.1.1 wrapping
   * amendment): the striped container is a full-height pill that starts
   * at the track's left edge, WRAPS AROUND the draggable circle and ends
   * in a matching pill cap hugging the thumb's right edge — the cap is
   * concentric with the circle at every dx (both centers sit at the same
   * x), so the ring between circle and striped edge is a UNIFORM 4px with
   * no flat vertical edge anywhere. The inner stripe layer runs the
   * continuous marquee so the pattern scrolls even while the cap moves.
   * WIDER + brighter than the §4.14.1 band: full-opacity 12px stripes.
   * The stripe period along the gradient axis is 24px, so a horizontal
   * shift of 24px ÷ sin45° ≈ 33.941px tiles the pattern exactly — the
   * seamless loop. Transform-only motion (§4.6); the base.css
   * reduced-motion catch-all collapses it. */
  .candy {
    position: absolute;
    top: 0;
    bottom: 0;
    left: 0;
    overflow: hidden;
    /* §4.15.1.1: the full pill radius WRAPS the fill — the right end is
     * the rounded cap (9999px-class radius, clamped to the half height),
     * matching the track's own pill curve. */
    border-radius: var(--radius-pill);
    /* release animations mirror the thumb: default = the 160ms completion
     * snap; `.spring` = the 240ms overshoot; dragging tracks live (none) */
    transition: width 160ms ease-out;
  }
  .candy.gripping {
    transition: none;
  }
  .candy.spring {
    transition: width 240ms cubic-bezier(0.34, 1.56, 0.64, 1);
  }
  .candy-stripes {
    position: absolute;
    top: 0;
    bottom: 0;
    left: 0;
    /* cover the whole track plus one loop shift so the marquee never gaps */
    width: calc(100% + 48px);
    background: repeating-linear-gradient(
      45deg,
      var(--slide-stripe-a) 0 12px,
      var(--slide-stripe-b) 12px 24px
    );
    animation: candy-move 1.1s linear infinite;
  }
  @keyframes candy-move {
    from {
      transform: translateX(0);
    }
    to {
      transform: translateX(-33.941px);
    }
  }
  .thumb {
    position: absolute;
    left: var(--slide-pad);
    top: var(--slide-pad);
    /* §4.15.1.1 invariant: thumb = the track's PADDING-BOX height − 8px —
     * the two 4px insets are measured inside the border, so the wrapping
     * fill's concentric pill cap keeps a UNIFORM 4px ring around the
     * circle (border-width via the token keeps the math border-agnostic). */
    width: calc(var(--slide-height) - 2 * var(--slide-border-w) - 8px);
    height: calc(var(--slide-height) - 2 * var(--slide-border-w) - 8px);
    /* pin clientWidth to the CSS width across UA button styles — the
     * drag-range math reads it (maxDx) */
    padding: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    background: var(--slide-thumb);
    color: var(--slide-thumb-ink);
    border: none;
    border-radius: var(--radius-pill);
    cursor: grab;
    touch-action: none;
    /* default release = the completion snap to the end (§4.15.A) */
    transition: transform 160ms ease-out;
  }
  .thumb:active {
    cursor: grabbing;
  }
  .thumb.gripping {
    transition: none;
  }
  .thumb.spring {
    /* spring-back below the 85% snap point (§4.15.A): light overshoot */
    transition: transform 240ms cubic-bezier(0.34, 1.56, 0.64, 1);
  }
  .thumb:disabled {
    cursor: default;
    opacity: 0.5;
  }
  /* shared: the thumb locks right, plain track, terminal look (§4.15.A) */
  .shared .track {
    border-color: var(--color-accent);
  }
  .shared .hint {
    color: var(--color-text);
  }
  .shared .thumb {
    left: auto;
    right: var(--slide-pad);
    opacity: 1;
    /* §4.15.1.1: the swap to the right-anchored rest position is instant
     * (the inline transform zeroes with it) — the completed thumb is
     * already nested at the uniform 4px margin, so nothing jumps. */
    transition: none;
  }
  .disabled .thumb {
    opacity: 0.35;
  }
  .pending .thumb {
    opacity: 0.6;
  }
  /* Confetti (Concept §14.1.1 / DESIGN §4.14.1 → §4.15.A reuses it
   * unchanged): CSS-only particles falling FROM THE TOP of the slide,
   * rendered only when a completion gesture made here is followed by the
   * shared state. 12 deterministic flakes in the Deepa family,
   * transform/opacity keyframes only (§4.6); the base.css reduced-motion
   * catch-all collapses the animation to its instant, invisible end
   * state. */
  .confetti {
    position: absolute;
    inset: 0;
    overflow: visible;
    pointer-events: none;
  }
  .flake {
    position: absolute;
    top: 0;
    width: 6px;
    height: 10px;
    border-radius: 1px;
    opacity: 0;
    animation: confetti-fall var(--flake-dur) ease-in var(--flake-delay) 1
      forwards;
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
      transform: translate(0, 0) rotate(0deg);
      opacity: 1;
    }
    80% {
      opacity: 1;
    }
    100% {
      transform: translate(var(--flake-x), var(--flake-y))
        rotate(var(--flake-rot));
      opacity: 0;
    }
  }
</style>
