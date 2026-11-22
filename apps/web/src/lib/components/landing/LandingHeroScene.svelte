<script lang="ts">
  /**
   * Landing hero composition block (DESIGN §4.21.B, amends §4.20.D —
   * Concept §33 owner photo review): one `.art-block` holds the whole
   * §4.20.D hero scene re-staged — the owner's pixel scene IMAGE
   * (`background.jpg`, a boy and a robot in a purple flower field before a
   * violet city skyline, under a glowing HELLO speech bubble) as the
   * background, the smooth edge-fade vignette dissolving into
   * `--color-bg` (no hard edge), the animated purple pixels kept (the
   * §4.20.D mesh/sparkle system re-expressed as pixel dots with the
   * steps(2) twinkle), and the hero pair — **NOVA** (left, unchanged) and
   * **ASTRA** (right: a copy of NOVA with white hair + small purple horns,
   * §4.21.A) — standing in the image's bottom-corner flower band. The
   * §4.20.D handshake-node diamond + light beam are RETIRED: the image's
   * glowing HELLO bubble is the composition's focal element now. BYTE
   * retires from the landing (§4.21.A).
   *
   * Protected central safe zone (§4.21.B): nothing renders over the
   * image's scenario — figures rect x 21–83% / y 44–80%, bubble rect
   * x 24–76% / y 2–22%. The pair is anchored to the outer 2% edges; the
   * dots are placed outside both rects; the reminder box (§4.21.C) sits
   * below them (top edge ≥81% of the block height by geometry).
   *
   * Asset (§4.21.B worker instruction): `background.jpg` is a committed app
   * asset imported as a Vite URL import (the established `#lib` alias;
   * `?raw` is for SVG text only) and bound as the `<img>` src.
   *
   * Color discipline (§4.20.A / §4.1): existing tokens only — the landing
   * accent is the approved Deepa violet (--color-deepa-4); shading stays
   * inside `color-mix` alpha variants of it.
   */
  import backgroundUrl from '#lib/assets/landing/background.jpg';
  import LandingFigure from './LandingFigure.svelte';
  import LandingReminder from './LandingReminder.svelte';

  interface Props {
    /** Accessible name (the hero pair is one named image; inner rects aria-hidden). */
    label: string;
    /** The three cycling reminder lines (already translated). */
    lines: readonly string[];
    /** Static full reminder line for screen readers. */
    srLine: string;
  }

  let { label, lines, srLine }: Props = $props();

  /* Animated purple pixels (§4.21.B layer 3): [x%, y%, size px, shade 0..2,
   * delay s] — 12 dots in the three violet alpha shades, steps(2) twinkle
   * 1.6s, staggered 0–1.2s delays. Sky dots + ground-band dots, every
   * position OUTSIDE the protected rects (figures x 21–83 / y 44–80;
   * bubble x 24–76 / y 2–22). */
  const DOTS: readonly (readonly [number, number, number, 0 | 1 | 2, number])[] = [
    [5, 12, 4, 1, 0],
    [93, 16, 6, 2, 0.3],
    [8, 55, 4, 0, 0.6],
    [90, 60, 5, 1, 0.9],
    [4, 90, 5, 0, 0.2],
    [12, 95, 4, 2, 0.5],
    [88, 90, 6, 1, 0.8],
    [95, 94, 4, 0, 1.1],
    [20, 92, 5, 1, 0.4],
    [30, 96, 4, 0, 0.7],
    [70, 91, 5, 2, 1.0],
    [80, 97, 4, 1, 1.2]
  ];
  const SHADE_ALPHA = [18, 35, 60] as const;

  function dotFill(shade: 0 | 1 | 2): string {
    return `color-mix(in srgb, var(--color-deepa-4) ${SHADE_ALPHA[shade]}%, transparent)`;
  }
</script>

<section class="art-block">
  <!-- layer 1: the owner's pixel scene image (decorative scenery) -->
  <img
    class="bg"
    src={backgroundUrl}
    alt=""
    aria-hidden="true"
    loading="eager"
    decoding="async"
    width="1024"
    height="1024"
  />

  <!-- layer 3: the animated purple pixels (kept from §4.20.D) -->
  <span class="dots" aria-hidden="true">
    {#each DOTS as dot, i (i)}
      <span
        class="dot"
        style="left: {dot[0]}%; top: {dot[1]}%; width: {dot[2]}px; height: {dot[2]}px;
          background: {dotFill(dot[3])}; --d: {dot[4]}s"
      ></span>
    {/each}
  </span>

  <!-- layer 4: the hero pair — NOVA (left, unchanged) + ASTRA (right) -->
  <div class="pair" role="img" aria-label={label}>
    <span class="nova-slot" aria-hidden="true">
      <LandingFigure kind="nova" size={160} />
    </span>
    <span class="astra-slot" aria-hidden="true">
      <LandingFigure kind="astra" size={160} />
    </span>
  </div>

  <!-- layer 5: the agent reminder box, fixed at the block's bottom -->
  <LandingReminder {lines} {srLine} />
</section>

<style>
  /* The composition block (§4.21.B): taller than the §4.20.D scene —
   * 500px mobile / 680px ≥720px; base tint shows only pre-load. */
  .art-block {
    --reminder-w: min(100% - 32px, 256px);
    --reminder-h: calc(var(--reminder-w) / 3.5);
    position: relative;
    width: 100%;
    height: 500px;
    overflow: hidden;
    background: color-mix(in srgb, var(--color-deepa-4) 6%, var(--color-bg));
  }
  @media (min-width: 720px) {
    .art-block {
      --reminder-w: min(100% - 48px, 348px);
      height: 680px;
    }
  }

  /* Layer 1: the background image, cover-cropped, no CLS (intrinsic dims). */
  .bg {
    position: absolute;
    inset: 0;
    z-index: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: 50% 50%;
  }

  /* Layer 2: the edge-fade vignette — THE smooth transition (§4.21.B):
   * every edge dissolves into exactly --color-bg, no hard rectangle edge
   * at any breakpoint. */
  .art-block::after {
    content: '';
    position: absolute;
    inset: 0;
    z-index: 1;
    pointer-events: none;
    background: radial-gradient(
      ellipse 80% 78% at 50% 46%,
      transparent 0 52%,
      color-mix(in srgb, var(--color-bg) 45%, transparent) 72%,
      var(--color-bg) 100%
    );
  }

  /* Layer 3: the pixel dots — steps(2) twinkle, staggered delays. */
  .dots {
    position: absolute;
    inset: 0;
    z-index: 2;
    pointer-events: none;
  }
  .dot {
    position: absolute;
    animation: dot-twinkle 1.6s steps(2) infinite;
    animation-delay: var(--d, 0s);
  }
  @keyframes dot-twinkle {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.2;
    }
  }

  /* Layer 4: the hero pair — two separate figures anchored to the outer
   * 2% edges, feet line above the reminder box (§4.21.B layer table). */
  .pair {
    position: absolute;
    inset: 0;
    z-index: 3;
    pointer-events: none;
  }
  .pair :global(.figure) {
    position: absolute;
    bottom: calc(var(--reminder-h) + 16px);
  }
  .pair :global([data-figure='nova']) {
    left: 2%;
  }
  .pair :global([data-figure='astra']) {
    right: 2%;
  }
  /* mobile: 64px tall (~33px wide) corner figures */
  .pair :global([data-figure='nova'] svg),
  .pair :global([data-figure='astra'] svg) {
    width: 33px;
    height: 64px;
  }
  @media (min-width: 720px) {
    /* desktop: 160px tall (~82px wide) */
    .pair :global([data-figure='nova'] svg),
    .pair :global([data-figure='astra'] svg) {
      width: 82px;
      height: 160px;
    }
  }

  /* Layer 5 (the reminder) rides above the vignette with its own z-index. */
  .art-block :global(.reminder) {
    z-index: 4;
  }

  /* Reduced motion (§4.6 + base.css catch-all): the twinkle collapses —
   * the dots stay statically visible at their base opacity. */
  @media (prefers-reduced-motion: reduce) {
    .dot {
      animation: none;
    }
  }
</style>
