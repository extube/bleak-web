<script lang="ts">
  /**
   * Landing hero scene (DESIGN §4.20.D, Concept §32): the example's
   * two-figures-under-a-glow composition retold as OUR story — the person
   * **NOVA** (left, back three-quarter view, warm-neutral palette,
   * accent-striped scarf) meets their AI agent **BYTE** (right — charcoal
   * body, single violet visor-eye, 2px antenna) under a glowing
   * handshake-node diamond with a vertical light beam.
   *
   * Technique (§4.3): one 64×64 `<svg>`, individual `<rect>`s,
   * `shape-rendering="crispEdges"`, transparent background — NO background
   * plate (Concept §23/§32). The ground is a mesh of purple network nodes
   * (small squares on stems — the example's flower field adapted), drawn
   * from a fixed data array (deterministic, no runtime randomness).
   *
   * Color discipline (§4.20.A / §4.1): existing tokens only — the landing
   * accent is the approved Deepa violet (--color-deepa-4, the example's
   * purple bloom; no new color values); shading stays inside `color-mix`
   * alpha variants of it.
   */
  interface Props {
    /** Accessible name (the scene is one named image; inner rects aria-hidden). */
    label: string;
  }

  let { label }: Props = $props();

  /* Ground mesh: [x, headRow(0 = back row, 1 = front row), shade(1..3)] —
   * ~40 tiles in three violet alpha shades (the connection mesh). */
  const MESH: readonly (readonly [number, number, number])[] = [
    [2, 0, 1], [6, 0, 2], [10, 0, 1], [13, 0, 3], [33, 0, 2], [37, 0, 1],
    [41, 0, 3], [45, 0, 1], [50, 0, 2], [54, 0, 1], [58, 0, 3], [61, 0, 2],
    [4, 0, 2], [9, 0, 3], [35, 0, 3], [48, 0, 3], [56, 0, 2],
    [1, 1, 2], [5, 1, 1], [9, 1, 3], [12, 1, 2], [16, 1, 1], [20, 1, 3],
    [24, 1, 2], [28, 1, 1], [32, 1, 3], [36, 1, 2], [40, 1, 1], [44, 1, 3],
    [48, 1, 2], [52, 1, 1], [55, 1, 3], [59, 1, 2], [62, 1, 1],
    [3, 1, 3], [8, 1, 2], [14, 1, 2], [27, 1, 2], [39, 1, 2], [51, 1, 3]
  ];
  const SHADE_ALPHA = [18, 35, 60] as const;

  /* Scene sparkles: [x, y, delay s] — five 2×2 accent rects, staggered
   * two-frame twinkle (0.8–1.6s delays). */
  const SPARKLES: readonly (readonly [number, number, number])[] = [
    [10, 12, 0.8], [50, 16, 1.2], [22, 8, 1.6], [44, 6, 1.0], [14, 30, 1.4]
  ];

  /* Violet alpha shades for the mesh (color-mix variants — no new colors). */
  function meshFill(shade: 0 | 1 | 2): string {
    return `color-mix(in srgb, var(--color-deepa-4) ${SHADE_ALPHA[shade]}%, transparent)`;
  }
</script>

<svg
  class="scene"
  viewBox="0 0 64 64"
  shape-rendering="crispEdges"
  role="img"
  aria-label={label}
>
  <!-- light beam: widening upward from the node (violet 12% column) -->
  <g aria-hidden="true" fill="color-mix(in srgb, var(--color-deepa-4) 12%, transparent)">
    <rect x="26" y="0" width="12" height="4" />
    <rect x="28" y="4" width="8" height="4" />
    <rect x="30" y="8" width="4" height="6" />
  </g>
  <g aria-hidden="true" fill="color-mix(in srgb, var(--color-deepa-4) 30%, transparent)">
    <rect x="31" y="2" width="2" height="11" />
  </g>

  <!-- NOVA — human attendee, back three-quarter view (left) -->
  <g aria-hidden="true" data-figure="nova">
    <!-- hair mass (back view: the head is all hair) -->
    <g fill="color-mix(in srgb, var(--color-art-hair-3) 65%, var(--color-surface))">
      <rect x="20" y="26" width="8" height="2" />
      <rect x="18" y="28" width="12" height="8" />
      <rect x="19" y="36" width="10" height="3" />
    </g>
    <!-- neck (warm skin slot) -->
    <rect x="22" y="39" width="4" height="2" fill="var(--color-art-skin-2)" />
    <!-- scarf with accent stripes -->
    <g>
      <rect x="17" y="41" width="14" height="4" fill="var(--color-text)" />
      <rect x="20" y="41" width="2" height="4" fill="var(--color-deepa-4)" />
      <rect x="26" y="41" width="2" height="4" fill="var(--color-deepa-4)" />
    </g>
    <!-- coat + arms -->
    <g fill="var(--color-surface-elevated)">
      <rect x="18" y="45" width="12" height="5" />
      <rect x="16" y="46" width="2" height="5" />
      <rect x="30" y="46" width="2" height="5" />
      <!-- legs -->
      <rect x="19" y="50" width="4" height="4" />
      <rect x="25" y="50" width="4" height="4" />
    </g>
    <!-- shoes -->
    <g fill="var(--color-text)">
      <rect x="18" y="53" width="5" height="1" />
      <rect x="25" y="53" width="5" height="1" />
    </g>
  </g>

  <!-- BYTE — the AI agent (right) -->
  <g aria-hidden="true" data-figure="byte">
    <!-- 2px antenna + accent tip -->
    <rect x="43" y="26" width="2" height="3" fill="var(--color-text-muted)" />
    <rect x="43" y="24" width="2" height="2" fill="var(--color-deepa-4)" />
    <!-- boxy charcoal head -->
    <rect x="36" y="29" width="16" height="10" fill="var(--color-surface-elevated)" />
    <!-- single accent visor-eye -->
    <rect x="40" y="33" width="8" height="2" fill="var(--color-deepa-4)" />
    <!-- head vents -->
    <g fill="var(--color-surface)">
      <rect x="37" y="36" width="2" height="2" />
      <rect x="49" y="36" width="2" height="2" />
    </g>
    <!-- body + chest panel -->
    <rect x="38" y="39" width="12" height="9" fill="var(--color-surface-elevated)" />
    <rect x="41" y="41" width="6" height="3" fill="var(--color-surface)" />
    <rect x="43" y="42" width="2" height="1" fill="var(--color-deepa-4)" />
    <!-- feet -->
    <g fill="var(--color-text)">
      <rect x="38" y="52" width="5" height="2" />
      <rect x="45" y="52" width="5" height="2" />
    </g>
  </g>

  <!-- ground: the network-node mesh (the flower field adapted) -->
  <g aria-hidden="true">
    {#each MESH as tile, i (i)}
      <g fill={meshFill(tile[2] as 0 | 1 | 2)}>
        {#if tile[1] === 0}
          <rect x={tile[0]} y="52" width="2" height="2" />
          <rect x={tile[0]} y="54" width="1" height="2" />
        {:else}
          <rect x={tile[0]} y="56" width="2" height="2" />
          <rect x={tile[0]} y="58" width="1" height="2" />
        {/if}
      </g>
    {/each}
  </g>

  <!-- focal element: the glowing handshake-node diamond -->
  <g class="node-halo" aria-hidden="true" fill="color-mix(in srgb, var(--color-deepa-4) 45%, transparent)">
    <rect x="28" y="15" width="8" height="1" />
    <rect x="27" y="16" width="10" height="3" />
    <rect x="28" y="19" width="8" height="1" />
    <rect x="29" y="20" width="6" height="1" />
    <rect x="30" y="21" width="4" height="1" />
  </g>
  <g class="node-pulse" aria-hidden="true" fill="var(--color-deepa-4)">
    <rect x="31" y="14" width="2" height="1" />
    <rect x="30" y="15" width="4" height="1" />
    <rect x="29" y="16" width="6" height="1" />
    <rect x="28" y="17" width="8" height="1" />
    <rect x="27" y="18" width="10" height="1" />
    <rect x="28" y="19" width="8" height="1" />
    <rect x="29" y="20" width="6" height="1" />
    <rect x="30" y="21" width="4" height="1" />
    <rect x="31" y="22" width="2" height="1" />
    <rect x="31" y="17" width="2" height="2" fill="var(--color-text)" />
  </g>

  <!-- sparkles: staggered two-frame twinkle -->
  <g aria-hidden="true" fill="var(--color-deepa-4)">
    {#each SPARKLES as sparkle, i (i)}
      <rect
        class="tw"
        style="--d: {sparkle[2]}s"
        x={sparkle[0]}
        y={sparkle[1]}
        width="2"
        height="2"
      />
    {/each}
  </g>
</svg>

<style>
  .scene {
    display: block;
    width: min(320px, 100%);
    height: auto;
    aspect-ratio: 1;
  }
  @media (min-width: 720px) {
    .scene {
      width: 480px;
    }
  }

  /* Focal pulse (§4.6 live-dot pattern): scale + glow-intensity via the
   * halo's opacity — transform/opacity only. */
  .node-pulse,
  .node-halo {
    transform-box: fill-box;
    transform-origin: center;
  }
  .node-pulse {
    animation: node-pulse 1.8s steps(2, jump-none) infinite alternate;
  }
  @keyframes node-pulse {
    from {
      transform: scale(1);
    }
    to {
      transform: scale(1.08);
    }
  }
  .node-halo {
    animation: node-halo 1.8s steps(2, jump-none) infinite alternate;
  }
  @keyframes node-halo {
    from {
      opacity: 0.45;
    }
    to {
      opacity: 1;
    }
  }

  /* Sparkle twinkle: two-frame staggered blink; base opacity 1 so the
   * reduced-motion catch-all (base.css) leaves them statically visible. */
  .tw {
    animation: tw 0.8s steps(2) infinite;
    animation-delay: var(--d, 0s);
  }
  @keyframes tw {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.2;
    }
  }
</style>
