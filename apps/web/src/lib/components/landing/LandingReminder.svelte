<script lang="ts">
  /**
   * LandingReminder (DESIGN §4.21.C as migrated by §4.22.C, Concept §33.2):
   * the agent reminder box — the retro dialogue box becomes the reminder
   * FIXED at the BOTTOM of the video block (§4.22.B/C — the video hero
   * replaces the still-image art block; every §33/§4.21.C contract carries
   * over verbatim).
   *
   * - Geometry: the owner's 1 : 3.5 height:width ratio (a wide strip) —
   *   `aspect-ratio: 3.5 / 1`; the width cap is the block-exposed
   *   `--reminder-w` (§4.22.C: phone `min(100% - 32px, 256px)` unchanged;
   *   ≥720px the §4.22.C center-band cap `min(calc(47% - 48px), 348px)` —
   *   the no-overlay rule against the new flanking lead/agent overlays);
   *   absolute, bottom 16px, centered via left/right 0 + margin-inline auto
   *   (no transform centering — transform is reserved for the bob). The
   *   block exposes the resolved height as `--reminder-h` (the play
   *   control's phone geometry consumes it, §4.22.B).
   * - Frame: the §4.20.E pixel-frame stands — 2px --color-text simulated
   *   border, square corners with 4px stepped notches (the .pixel-notch
   *   utility), bg --color-surface.
   * - Font: PIXEL — the established Handjet stack (§4.7/§4.20.B), 16px
   *   mobile / 18px desktop, letter-spacing 0.05em, line-height 1.3,
   *   horizontally CENTERED (owner item 2c), max 2 lines, padding 12×20.
   * - Pixel emoji: an original §4.3-construction 16-grid pixel
   *   sparkle-star, 24px, absolutely positioned at the box's top-left
   *   corner at offset (−10px, −10px) overlapping the frame; twinkle
   *   opacity 1↔0.55, 1.6s steps(2) infinite.
   * - Check mark (owner item 2e): the 8px caret is replaced by a 24px
   *   (20px mobile) pixel check — a 12-grid cell run with a --color-text
   *   glint at the vertex — bottom-center, half-out over the frame edge
   *   (translateY(50%) on the mark itself; the bob transform stays free),
   *   with the §4.20.A glow pulsing 60%→100% accent mix, 1.6s steps(2)
   *   infinite alternate.
   * - Content: the §4.20.E cycling lines keep their copy and timing (3
   *   asterisk lines, 200ms cross-fade; decorative + one sr-only static
   *   line).
   * - Up-and-down movement (owner item 2d): ambient bob on the whole box —
   *   translateY 0→−6px mobile / −10px desktop, 3s ease-in-out infinite
   *   (the §4.6 reminder-bob row; transform-only). Reduced motion (§4.6 +
   *   base.css): the bob, twinkle, glow pulse and the cycle all collapse —
   *   static first line + static glyphs.
   */
  interface Props {
    /** The three cycling asterisk lines (already translated). */
    lines: readonly string[];
    /** Static full line for screen readers. */
    srLine: string;
  }

  let { lines, srLine }: Props = $props();
</script>

<div class="reminder pixel-notch">
  <div class="reminder-body pixel-notch">
    <div class="reminder-stage" aria-hidden="true">
      {#each lines as line, i (i)}
        <p class="reminder-line" style="--i: {i}">{line}</p>
      {/each}
    </div>
    <p class="sr-only">{srLine}</p>
  </div>

  <!-- pixel emoji: sparkle-star at the top-left corner (−10, −10) -->
  <span class="spark" aria-hidden="true">
    <svg
      viewBox="0 0 16 16"
      width="24"
      height="24"
      shape-rendering="crispEdges"
      fill="var(--color-deepa-4)"
    >
      <!-- arms -->
      <rect x="7" y="2" width="2" height="2" />
      <rect x="7" y="12" width="2" height="2" />
      <rect x="2" y="7" width="2" height="2" />
      <rect x="12" y="7" width="2" height="2" />
      <!-- diagonals (2×2 cells) -->
      <rect x="4" y="4" width="2" height="2" />
      <rect x="5" y="5" width="2" height="2" />
      <rect x="10" y="5" width="2" height="2" />
      <rect x="11" y="4" width="2" height="2" />
      <rect x="4" y="10" width="2" height="2" />
      <rect x="5" y="11" width="2" height="2" />
      <rect x="10" y="11" width="2" height="2" />
      <rect x="11" y="10" width="2" height="2" />
      <!-- center + highlight cell -->
      <rect x="7" y="7" width="2" height="2" />
      <rect x="7" y="7" width="1" height="1" fill="var(--color-text)" />
    </svg>
  </span>

  <!-- the check mark: bigger + more visible, bottom-center, half-out -->
  <span class="check" aria-hidden="true">
    <svg
      viewBox="0 0 12 12"
      width="24"
      height="24"
      shape-rendering="crispEdges"
      fill="var(--color-deepa-4)"
    >
      <rect x="2" y="6" width="1" height="1" />
      <rect x="3" y="7" width="1" height="1" />
      <rect x="4" y="8" width="1" height="1" />
      <rect x="5" y="7" width="1" height="1" />
      <rect x="6" y="6" width="1" height="1" />
      <rect x="7" y="5" width="1" height="1" />
      <rect x="8" y="4" width="1" height="1" />
      <rect x="9" y="3" width="1" height="1" />
      <!-- glint at the vertex (4, 8) -->
      <rect x="4" y="8" width="1" height="1" fill="var(--color-text)" />
    </svg>
  </span>
</div>

<style>
  /* Geometry (§4.21.C → §4.22.C): the 1:3.5 wide strip, bottom-fixed inside
   * the video block; the width cap is the block-exposed --reminder-w (the
   * §4.22.C phone cap / desktop center-band cap; fallback = the phone cap). */
  .reminder {
    position: absolute;
    bottom: 16px;
    left: 0;
    right: 0;
    margin-inline: auto;
    width: var(--reminder-w, min(100% - 32px, 256px));
    aspect-ratio: 3.5 / 1;
    min-height: 64px;
    background: var(--color-text);
    padding: 2px;
    /* the up-and-down movement: smooth float, transform-only (§4.6) */
    --bob-amp: 6px;
    animation: reminder-bob 3s ease-in-out infinite;
  }
  @media (min-width: 720px) {
    .reminder {
      --bob-amp: 10px;
    }
  }
  @keyframes reminder-bob {
    0%,
    100% {
      transform: translateY(0);
    }
    50% {
      transform: translateY(calc(-1 * var(--bob-amp, 6px)));
    }
  }

  .reminder-body {
    background: var(--color-surface);
    height: 100%;
    display: flex;
    align-items: center;
    padding: 12px 20px;
  }
  .reminder-stage {
    position: relative;
    width: 100%;
  }
  .reminder-line {
    margin: 0;
    position: absolute;
    inset: 0 auto auto 0;
    width: 100%;
    /* the message font is PIXEL (owner item 2a): the Handjet stack */
    font-family: var(--font-pixel);
    font-weight: 600;
    font-size: 16px;
    letter-spacing: 0.05em;
    line-height: 1.3;
    text-align: center;
    color: var(--color-text);
    opacity: 0;
    /* the 3-line cycle: 12s total, one 4s window per line, 200ms fades */
    animation: reminder-line 12s linear infinite;
    animation-delay: calc(var(--i, 0) * 4s);
  }
  @media (min-width: 720px) {
    .reminder-line {
      font-size: 18px;
    }
  }
  @keyframes reminder-line {
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

  /* Pixel emoji (§4.21.C): 24px sparkle-star at the top-left corner. */
  .spark {
    position: absolute;
    top: -10px;
    left: -10px;
    line-height: 0;
    animation: spark-twinkle 1.6s steps(2) infinite;
  }
  .spark svg {
    display: block;
  }
  @keyframes spark-twinkle {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.55;
    }
  }

  /* Check mark (§4.21.C): 24px (20px mobile), bottom-center, half-out over
   * the frame edge; the visible glow pulses 60% → 100% accent mix. */
  .check {
    position: absolute;
    bottom: 0;
    left: 50%;
    transform: translate(-50%, 50%);
    line-height: 0;
    animation: check-glow 1.6s steps(2) infinite alternate;
  }
  .check svg {
    display: block;
  }
  @keyframes check-glow {
    from {
      filter: drop-shadow(0 0 6px color-mix(in srgb, var(--color-deepa-4) 60%, transparent));
    }
    to {
      filter: drop-shadow(0 0 6px var(--color-deepa-4));
    }
  }
  @media (max-width: 719.98px) {
    .check svg {
      width: 20px;
      height: 20px;
    }
  }

  /* Reduced motion: static box (no bob), static glyphs, the three lines
   * readable in flow (§4.6 / §4.20.L baselines). */
  @media (prefers-reduced-motion: reduce) {
    .reminder {
      animation: none;
    }
    .spark,
    .check {
      animation: none;
    }
    .reminder-line {
      animation: none;
      position: static;
      opacity: 1;
    }
  }
</style>
