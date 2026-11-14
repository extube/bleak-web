<script lang="ts">
  /**
   * RadarRings (DESIGN §3.2): three dashed rings — decorative layer only
   * (aria-hidden, §2.6; never focusable). Radii follow RING_FRACTIONS of
   * the viewBox half. The 90 s ambient rotation (§4.6, transform-only)
   * starts only when data has arrived (loading state shows static rings)
   * and is disabled under prefers-reduced-motion by the base.css rule.
   * Token-only colors; `.pixel-corners` is never applied here (§4.5).
   */
  interface Props {
    /** Rings rotate only after the first successful poll tick. */
    animate?: boolean;
  }

  let { animate = false }: Props = $props();
</script>

<svg class="rings" viewBox="0 0 200 200" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
  <g class:animate>
    <circle cx="100" cy="100" r="28" />
    <circle cx="100" cy="100" r="56" />
    <circle cx="100" cy="100" r="84" />
  </g>
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
