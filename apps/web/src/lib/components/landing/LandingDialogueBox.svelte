<script lang="ts">
  /**
   * LandingDialogueBox (DESIGN §4.20.E): the retro RPG dialogue box — the
   * landing's signature element. Construction: 2px `--color-text` simulated
   * border, square corners with 4px stepped notches (the `.pixel-notch`
   * utility — deliberately NOT the .pixel-corners ladder), `--color-surface`
   * fill, min-height 72px, max-width 480px, padding 16×20.
   *
   * Content: one asterisk line cycling through three copies (each ≥4s,
   * 200ms cross-fade, pure CSS — no JS loop); the caret is an accent pixel
   * chevron blinking 800ms steps(2) with the glow recipe. The cycling lines
   * are decorative; one full static line is exposed in .sr-only so screen
   * readers get the copy without the cycle spamming aria-live.
   *
   * Reduced motion (§4.6 + §4.20.L): the base.css catch-all collapses the
   * cycle — here the three lines re-stack in normal flow (all readable)
   * and the caret stops blinking but stays visible.
   */
  interface Props {
    /** The three cycling asterisk lines (already translated). */
    lines: readonly string[];
    /** Static full line for screen readers. */
    srLine: string;
  }

  let { lines, srLine }: Props = $props();
</script>

<div class="dialog-box pixel-notch">
  <div class="dialog-body pixel-notch">
    <div class="dialog-stage" aria-hidden="true">
      {#each lines as line, i (i)}
        <p class="dialog-line" style="--i: {i}">{line}</p>
      {/each}
    </div>
    <p class="sr-only">{srLine}</p>
  </div>
  <span class="caret" aria-hidden="true">
    <svg viewBox="0 0 10 6" width="10" height="6" shape-rendering="crispEdges" fill="var(--color-deepa-4)">
      <rect x="2" y="0" width="6" height="2" />
      <rect x="4" y="2" width="2" height="2" />
      <rect x="3" y="4" width="4" height="2" />
    </svg>
  </span>
</div>

<style>
  .dialog-box {
    position: relative;
    background: var(--color-text);
    padding: 2px;
    min-height: 72px;
    max-width: 480px;
    width: 100%;
  }
  .dialog-body {
    background: var(--color-surface);
    min-height: 68px;
    padding: 16px 20px 20px;
  }
  .dialog-stage {
    position: relative;
    min-height: 24px;
  }
  .dialog-line {
    margin: 0;
    position: absolute;
    inset: 0 auto auto 0;
    width: 100%;
    font-family: var(--font-body);
    font-size: 14px;
    line-height: 1.4;
    color: var(--color-text);
    opacity: 0;
    /* the 3-line cycle: 12s total, one 4s window per line, 200ms fades */
    animation: dialog-line 12s linear infinite;
    animation-delay: calc(var(--i, 0) * 4s);
  }
  @keyframes dialog-line {
    0% {
      opacity: 0;
    }
    1.67%,
    31.67% {
      opacity: 1;
    }
    33.33%,
    100% {
      opacity: 0;
    }
  }

  /* Caret: accent pixel chevron, 800ms steps(2) blink, glow recipe. */
  .caret {
    position: absolute;
    bottom: 6px;
    left: 50%;
    transform: translateX(-50%);
    line-height: 0;
    animation: caret-blink 800ms steps(2) infinite;
    filter: drop-shadow(0 0 6px color-mix(in srgb, var(--color-deepa-4) 50%, transparent))
      drop-shadow(0 0 18px color-mix(in srgb, var(--color-deepa-4) 22%, transparent));
  }
  .caret svg {
    display: block;
  }
  @keyframes caret-blink {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0;
    }
  }

  /* Reduced motion: all three lines readable in flow, caret static. */
  @media (prefers-reduced-motion: reduce) {
    .dialog-line {
      animation: none;
      position: static;
      opacity: 1;
    }
    .caret {
      animation: none;
    }
  }
</style>
