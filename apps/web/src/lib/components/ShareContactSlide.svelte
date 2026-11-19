<script lang="ts">
  /**
   * ShareContactSlide (DESIGN §4.13.3 item 3 / Concept §13.1.3): the
   * reusable swipe-right slide control for sharing a contact card.
   *
   * Rendered in the dialog footer (routes/chats/[address], gated on the
   * tz5-03 `isChatDone` selector) and REUSABLE inside the tz5-05 summary
   * sheet — all copy and state come in as clean props; the component never
   * calls the API itself. `oncomplete` fires ONCE per completed gesture
   * (the parent owns the request + the shared/disabled states afterwards).
   *
   * States (parent-driven):
   * - `shared`    → done glyph + `sharedLabel`, non-interactive (server
   *                 truth is the 409 "already shared"; a 201 lands here too);
   * - `disabled`  → the thumb is inert, `disabledHint` is shown in the
   *                 track (dialog not finished, or no contact card yet);
   * - `pending`   → the request is in flight; the thumb is inert so a
   *                 second gesture cannot double-fire;
   * - otherwise   → the armed slide: drag the thumb right (or click /
   *                 keyboard-activate the thumb — the accessible path) to
   *                 complete.
   *
   * §4.14.1 polish (Concept §14.1.1): the armed track carries an animated
   * red-white candy-cane stripe band; the shared-state transition plays a
   * CSS-only confetti from the top of the slide. Both are decoration only —
   * the mechanics, props and states above are untouched.
   */
  import PixelIcon from './icons/PixelIcon.svelte';

  interface Props {
    /** Armed-state hint shown in the track (e.g. "Swipe right to share"). */
    label: string;
    /** Shared-state copy (done glyph + this text). */
    sharedLabel: string;
    /** Disabled-state hint (replaces `label` in the track). */
    disabledHint: string;
    /** Gate off (dialog not finished / no card / parent says no). */
    disabled?: boolean;
    /** Request in flight — the thumb cannot be re-gripped. */
    pending?: boolean;
    /** Already shared — the terminal, non-interactive state. */
    shared?: boolean;
    /** Fired ONCE when the gesture completes (drag to the end or activation). */
    oncomplete?: () => void;
  }

  let {
    label,
    sharedLabel,
    disabledHint,
    disabled = false,
    pending = false,
    shared = false,
    oncomplete
  }: Props = $props();

  /** Drag offset in px (0 = thumb at rest). */
  let dx = $state(0);
  /** The thumb is currently gripped (pointer down, drag live). */
  let gripping = $state(false);
  /** The live gesture consumed the pointer (suppresses the click fallback). */
  let dragged = $state(false);
  /** Pointer-down clientX — the drag delta reference. */
  let startX = 0;

  const inert = $derived(disabled || pending || shared);
  const armed = $derived(!inert);
  const trackText = $derived(
    shared ? sharedLabel : disabled ? disabledHint : label
  );

  /**
   * Confetti (Concept §14.1.1 / DESIGN §4.14.1 item 1): plays when a
   * completion gesture made HERE is followed by the parent landing the
   * shared state — the choice stated on the task card. The gesture flag is
   * set in `complete()`; the confetti renders only once BOTH the gesture
   * and `shared` are true, so 201 AND 409 celebrate (both land `shared`)
   * while a failed request (never lands `shared`) does not — and an
   * already-shared chat re-mounting with `shared` true from the start (the
   * parent hydrating the local mark) replays nothing.
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

  function maxDx(): number {
    const track = trackEl?.clientWidth ?? 0;
    const thumb = thumbEl?.clientWidth ?? 0;
    return Math.max(track - thumb, 0);
  }

  function complete(): void {
    if (inert) return;
    celebrated = true; // a gesture completed here — §4.14.1 confetti arms
    oncomplete?.();
    gripping = false;
    dx = 0;
  }

  function onPointerDown(event: PointerEvent): void {
    if (inert || event.button !== 0) return;
    (event.currentTarget as HTMLElement | null)?.setPointerCapture?.(event.pointerId);
    gripping = true;
    dragged = false;
    startX = event.clientX;
    dx = 0;
  }

  function onPointerMove(event: PointerEvent): void {
    if (inert || !gripping) return;
    dx = Math.max(event.clientX - startX, 0);
    if (dx > 2) dragged = true;
    if (dx >= maxDx()) complete();
  }

  function onPointerUp(): void {
    if (inert) return;
    gripping = false;
    // Spring back unless the gesture completed (complete() already reset dx).
    if (dx < maxDx()) dx = 0;
  }

  /**
   * The accessible activation path: click / Enter / Space on the thumb
   * completes the gesture without a pointer drag (screen readers, keyboards,
   * and tests). A pointer drag ending on the thumb also emits click — the
   * `dragged` flag suppresses the double fire.
   */
  function onClick(): void {
    if (dragged) {
      dragged = false;
      return;
    }
    complete();
  }
</script>

<div class="slide" class:shared class:disabled class:pending class:armed={!inert} aria-disabled={inert}>
  <div class="track" bind:this={trackEl}>
    {#if armed}
      <span class="candy" aria-hidden="true"></span>
    {/if}
    <span class="hint">{trackText}</span>
    <button
      type="button"
      class="thumb"
      class:gripping
      bind:this={thumbEl}
      style:transform="translateX({dx}px)"
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
      {:else}
        <PixelIcon name="arrow-right" size={16} />
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
    /* anchors the confetti layer's "from the top of the container" origin */
    position: relative;
    width: 100%;
  }
  .track {
    position: relative;
    display: flex;
    align-items: center;
    min-height: var(--touch-target);
    padding: var(--space-1);
    background: var(--color-surface);
    border: 1px solid var(--color-text-disabled-strong);
    border-radius: var(--radius-pill);
    overflow: hidden;
  }
  .hint {
    position: relative; /* the hint pill sits above the candy stripes */
    flex: 1;
    text-align: center;
    font-size: 14px;
    color: var(--color-text-muted);
    padding: 0 calc(var(--touch-target) + var(--space-2)) 0 var(--space-2);
    /* readability scrim (§4.14.1): the pill keeps the hint legible over the
     * animated stripes; the candy band stays visible around it (ring +
     * the trail the thumb reveals as it slides). */
    background: color-mix(in srgb, var(--color-surface) 80%, transparent);
    border-radius: var(--radius-pill);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  /* Candy-cane stripes (Concept §14.1.1 / DESIGN §4.14.1 item 1): an
   * animated red-white diagonal band across the track, armed state only.
   * The 45° stripes repeat every 20px along the gradient axis, so shifting
   * the layer horizontally by 20px/sin(45°) ≈ 28.284px loops the pattern
   * seamlessly. Transform-only motion (§4.6); the base.css reduced-motion
   * catch-all collapses it to a static band. */
  .candy {
    position: absolute;
    top: 0;
    bottom: 0;
    left: 0;
    width: calc(100% + 32px);
    background: repeating-linear-gradient(
      45deg,
      var(--color-danger-text) 0 10px,
      var(--color-text) 10px 20px
    );
    opacity: 0.5;
    animation: candy-move 1.2s linear infinite;
  }
  @keyframes candy-move {
    from {
      transform: translateX(0);
    }
    to {
      transform: translateX(-28.284px);
    }
  }
  .thumb {
    position: absolute;
    left: var(--space-1);
    top: 50%;
    translate: 0 -50%;
    width: calc(var(--touch-target) - var(--space-2));
    height: calc(var(--touch-target) - var(--space-2));
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: var(--color-accent);
    color: var(--color-accent-ink);
    border: none;
    border-radius: var(--radius-pill);
    cursor: grab;
    touch-action: none;
    transition: transform 120ms ease-out;
  }
  .thumb:active {
    cursor: grabbing;
  }
  .thumb.gripping {
    transition: none;
  }
  .thumb:disabled {
    cursor: default;
    opacity: 0.5;
  }
  .shared .track {
    border-color: var(--color-accent);
  }
  .shared .hint {
    color: var(--color-text);
  }
  .shared .thumb {
    opacity: 1;
  }
  .disabled .thumb {
    opacity: 0.35;
  }
  .pending .thumb {
    opacity: 0.6;
  }
  /* Confetti (Concept §14.1.1 / DESIGN §4.14.1 item 1): CSS-only particles
   * falling FROM THE TOP of the slide, rendered only when a completion
   * gesture made here is followed by the shared state. 12 deterministic
   * flakes in the Deepa family, transform/opacity keyframes only (§4.6);
   * the base.css reduced-motion catch-all collapses the animation to its
   * instant, invisible end state. */
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
