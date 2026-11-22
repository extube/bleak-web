<script lang="ts">
  /**
   * LandingChatStrip (DESIGN §4.20.F, Concept §32 owner addition): two
   * mascots chatting in 80s-game pixel speech bubbles — **PIP** (human
   * attendee) left, **GLITCH** (robo-cat agent) right — four alternating
   * turns with a per-character CSS typewriter, in an infinite loop.
   *
   * Timing per turn: pop-in 160ms ease-out → typewriter reveal 55ms/char
   * (`steps(var(--chars))` clip-reveal — `--chars` is set inline from the
   * rendered string length) → hold 900ms (long turns clamp at 3.4s). After
   * turn 4 all bubbles fade out 600ms, the strip rests 400ms, the loop
   * restarts. The loop duration is content-derived (RU/EN differ).
   *
   * NO continuous JS (§4.15.C-6a): the schedule and the locale-dependent
   * `@keyframes` come from the one-shot pure computation in chatTimeline.ts
   * (re-derived when the locale switches — the same one-shot computation)
   * and are injected once per locale; every animation is CSS-driven.
   *
   * Reduced motion (§4.20.F): no typewriter, no loop — all four bubbles
   * render statically visible in flow. A11y: the strip is one named image
   * (`role="img"` + aria-label); the bubble texts remain in the DOM (clip
   * reveal, not text injection).
   */
  import { buildChatTimeline, type ChatBubbleSpec } from './chatTimeline';
  import LandingFigure from './LandingFigure.svelte';

  interface Props {
    /** Strip header label (Handjet, top-left). */
    label: string;
    /** The strip's accessible name (role="img"). */
    aria: string;
    /** The four alternating bubble texts (already translated). */
    bubbles: readonly ChatBubbleSpec[];
  }

  let { label, aria, bubbles }: Props = $props();

  const timeline = $derived(buildChatTimeline(bubbles));
</script>

<svelte:head>
  {#if timeline.keyframesCss}
    <!-- eslint-disable-next-line svelte/no-at-html-tags -- trusted CSS from chatTimeline.ts (static copy data, never user input) -->
    {@html `<style>${timeline.keyframesCss}</style>`}
  {/if}
</svelte:head>

<section
  class="chat-strip pixel-corners pixel-frame pixel-frame--strong"
  role="img"
  aria-label={aria}
  style="--loop: {timeline.loopMs}ms"
>
  <div class="chat-body pixel-corners">
    <span class="chat-label">{label}</span>
    <div class="chat-stage">
      <span class="chat-mascot pip" aria-hidden="true">
        <LandingFigure kind="pip" size={48} idle={false} />
      </span>
      <span class="chat-mascot glitch" aria-hidden="true">
        <LandingFigure kind="glitch" size={48} idle={false} />
      </span>
      {#each timeline.turns as turn, i (i)}
        <div
          class="chat-bubble {turn.from}"
          class:i0={i === 0}
          class:i1={i === 1}
          class:i2={i === 2}
          class:i3={i === 3}
          style="--chars: {turn.chars}"
        >
          <div class="chat-bubble-in bubble-clip">
            <p
              class="chat-bubble-text"
              class:i0={i === 0}
              class:i1={i === 1}
              class:i2={i === 2}
              class:i3={i === 3}
            >
              {turn.text}
            </p>
          </div>
          <span class="chat-tail" aria-hidden="true"></span>
        </div>
      {/each}
    </div>
  </div>
</section>

<style>
  .chat-strip {
    width: 100%;
  }
  .chat-body {
    padding: 10px 12px 12px;
    display: flex;
    flex-direction: column;
    min-height: 200px;
  }
  .chat-label {
    font-family: var(--font-pixel);
    font-weight: 600;
    font-size: 11px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--color-text-muted);
  }
  .chat-stage {
    position: relative;
    flex: 1;
    min-height: 150px;
  }

  /* The two mascots face each other at the strip's left/right edges. */
  .chat-mascot {
    position: absolute;
    bottom: 0;
    line-height: 0;
  }
  .chat-mascot.pip {
    left: 2px;
  }
  .chat-mascot.glitch {
    right: 2px;
  }

  /* Speech bubbles: pixel-frame boxes with 3×3px corner notches, stepped
   * 3-rect tail pointing to the speaker. PIP's frame is text-bright,
   * GLITCH's is the landing accent (violet). */
  .chat-bubble {
    position: absolute;
    top: 10px;
    max-width: 60%;
    color: var(--color-text); /* = the frame color via currentColor */
    opacity: 0;
    transform: scale(0.6);
    animation-duration: var(--loop, 14600ms);
    animation-timing-function: linear;
    animation-iteration-count: infinite;
  }
  .bubble-clip {
    clip-path: polygon(
      0 3px, 3px 3px, 3px 0,
      calc(100% - 3px) 0, calc(100% - 3px) 3px, 100% 3px,
      100% calc(100% - 3px), calc(100% - 3px) calc(100% - 3px), calc(100% - 3px) 100%,
      3px 100%, 3px calc(100% - 3px), 0 calc(100% - 3px)
    );
  }
  .chat-bubble-in {
    background: currentColor;
    padding: 2px;
  }
  .chat-bubble-text {
    margin: 0;
    background: var(--color-surface-elevated);
    padding: 8px 10px;
    font-family: var(--font-body);
    font-size: 12px;
    line-height: 1.4;
    color: var(--color-text);
    clip-path: inset(0 100% 0 0);
    animation-duration: var(--loop, 14600ms);
    animation-timing-function: linear;
    animation-iteration-count: infinite;
  }
  .chat-bubble.pip {
    left: 2px;
    color: var(--color-text);
  }
  .chat-bubble.glitch {
    right: 2px;
    color: var(--color-deepa-4);
  }
  /* per-turn phase classes (compiler-visible) + slot placement */
  .chat-bubble.i0 {
    animation-name: lp-pop-0;
    top: 10px;
  }
  .chat-bubble.i1 {
    animation-name: lp-pop-1;
    top: 26px;
  }
  .chat-bubble.i2 {
    animation-name: lp-pop-2;
    top: 10px;
  }
  .chat-bubble.i3 {
    animation-name: lp-pop-3;
    top: 26px;
  }
  .chat-bubble-text.i0 {
    animation-name: lp-type-0;
  }
  .chat-bubble-text.i1 {
    animation-name: lp-type-1;
  }
  .chat-bubble-text.i2 {
    animation-name: lp-type-2;
  }
  .chat-bubble-text.i3 {
    animation-name: lp-type-3;
  }

  /* Stepped 3-rect tail: one rect + two box-shadow steps toward the speaker. */
  .chat-tail {
    position: absolute;
    bottom: -3px;
    width: 3px;
    height: 3px;
    background: currentColor;
  }
  .chat-bubble.pip .chat-tail {
    left: 10px;
    box-shadow:
      -3px 3px 0 currentColor,
      -6px 6px 0 currentColor;
  }
  .chat-bubble.glitch .chat-tail {
    right: 10px;
    box-shadow:
      3px 3px 0 currentColor,
      6px 6px 0 currentColor;
  }

  /* Reduced motion: no typewriter, no loop — all four bubbles statically
   * visible in a readable flow (mascots in a top row). */
  @media (prefers-reduced-motion: reduce) {
    .chat-body {
      min-height: 0;
    }
    .chat-stage {
      display: grid;
      grid-template-columns: 48px 1fr 48px;
      grid-auto-rows: min-content;
      gap: var(--space-2);
    }
    .chat-mascot {
      position: static;
    }
    .chat-mascot.pip {
      grid-area: 1 / 1;
    }
    .chat-mascot.glitch {
      grid-area: 1 / 3;
      justify-self: end;
    }
    .chat-bubble {
      position: static;
      grid-column: 1 / -1;
      max-width: none;
      animation: none;
      opacity: 1;
      transform: none;
    }
    .chat-bubble.glitch {
      justify-self: end;
    }
    .chat-bubble-text {
      animation: none;
      clip-path: none;
    }
    .chat-tail {
      display: none;
    }
  }
</style>
