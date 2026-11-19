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
  const trackText = $derived(
    shared ? sharedLabel : disabled ? disabledHint : label
  );

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

<div class="slide" class:shared class:disabled class:pending aria-disabled={inert}>
  <div class="track" bind:this={trackEl}>
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
</div>

<style>
  .slide {
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
    flex: 1;
    text-align: center;
    font-size: 14px;
    color: var(--color-text-muted);
    padding: 0 calc(var(--touch-target) + var(--space-2)) 0 var(--space-2);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
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
</style>
