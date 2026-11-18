<script lang="ts">
  /**
   * RadarRings (DESIGN §3.2 + §4.8.3 + §4.9.2): three dashed rings —
   * decorative layer only (aria-hidden, §2.6; never focusable). Radii
   * follow RING_FRACTIONS of the viewBox half (56 / 70 / 84 — scaled up
   * from 28/56/84 so the inner ring clears the enlarged "you"-chip
   * exclusion zone, matching lib/room/radar.ts). §4.9.2: each ring rotates
   * at its ring's distinct speed ("each ring with its items" — the ring
   * line shares the speed of the nodes riding it, RING_ORBIT_DURATIONS_S:
   * 60s / 90s / 20s). The ambient rotation (§4.6, transform-only) starts
   * only when data has arrived (loading state shows static rings) and is
   * disabled under prefers-reduced-motion by the base.css rule. Token-only
   * colors; `.pixel-corners` is never applied here (§4.5).
   */
  import { RING_FRACTIONS, RING_ORBIT_DURATIONS_S } from '#lib/room/radar';

  interface Props {
    /** Rings rotate only after the first successful poll tick. */
    animate?: boolean;
  }

  let { animate = false }: Props = $props();

  // One spinning group per ring: radius from the shared fractions, duration
  // from the shared per-ring speed constants (single source, radar.ts).
  const rings = RING_FRACTIONS.map((fraction, i) => ({
    r: fraction * 100,
    durationS: RING_ORBIT_DURATIONS_S[i]
  }));
</script>

<svg class="rings" viewBox="0 0 200 200" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
  {#each rings as ring, i (i)}
    <g class:animate style:animation-duration="{ring.durationS}s">
      <circle cx="100" cy="100" r={ring.r} />
    </g>
  {/each}
</svg>

<style>
  .rings {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }
  circle {
    fill: none;
    stroke: var(--color-ring);
    stroke-width: 1;
    /* True 1px dashes despite the viewBox scale. */
    vector-effect: non-scaling-stroke;
    stroke-dasharray: 4 6;
  }
  g {
    transform-box: view-box;
    transform-origin: 50% 50%;
  }
  g.animate {
    animation: spin 90s linear infinite;
    /* Inline animation-duration (per-ring, above) overrides this fallback. */
  }
  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }
</style>
