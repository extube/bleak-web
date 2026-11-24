<script lang="ts">
  /**
   * BleakMascot (Concept §22.3 item 1, DESIGN §4.16.1 as amended by
   * §4.22.E — Concept §34): the Bleak mascot is now the shared BLEAK
   * PERSONAGE — the agent-card pixel personage (renamed from the old
   * landing name per §4.22.D, the rect art UNCHANGED), promoted to the
   * shared module `personage/bleakFigure.ts` so EVERY `/income*` mascot
   * mount renders the same figure the landing agent card does:
   * CodeEntry 96, RoomPreview 96, CreationWizard intro 96 + steps 112,
   * MessageBubble mascot rows 28. The old 12×12 ghost art retires
   * (§4.22.G item 7).
   *
   * The §4.3 rect technique: crispEdges SVG rects on the figure's 32×32
   * grid, token fills only (§4.1), transparent background. §23.1 item 1:
   * NO BACKGROUND — no plate/box behind the figure (no backdrop fill, no
   * frame padding); the pixel figure sits directly on the page and the
   * personage carries itself.
   *
   * `idle` maps to the personage's established idle — the §4.20.J
   * card-portrait sway (1.6s steps(2) ±2°, transform-origin 50% 100%).
   * Reduced motion needs no local override: the base.css catch-all
   * collapses the animation to a single frame.
   *
   * Public API UNCHANGED (§4.22.E item 2): `size` px height, `idle`
   * boolean, `label` accessible name; decorative by default.
   */
  import { BLEAK_FIGURE } from './personage/bleakFigure';

  interface Props {
    /** Rendered size in px (scales the 32×32 grid cleanly; design size ~96–128). */
    size?: number;
    /** The personage's idle sway (1.6s steps(2) ±2°). */
    idle?: boolean;
    /** Accessible name; empty → decorative (aria-hidden). */
    label?: string;
  }

  let { size = 112, idle = true, label = '' }: Props = $props();
</script>

<span class="mascot" class:idle>
  <svg
    viewBox="0 0 {BLEAK_FIGURE.viewW} {BLEAK_FIGURE.viewH}"
    width={size}
    height={size}
    shape-rendering="crispEdges"
    role={label ? 'img' : undefined}
    aria-label={label || undefined}
    aria-hidden={label ? undefined : 'true'}
  >
    {#each BLEAK_FIGURE.parts as part, pi (pi)}
      <g fill={part.fill}>
        {#each part.rects as rect, ri (ri)}
          <rect x={rect[0]} y={rect[1]} width={rect[2]} height={rect[3]} />
        {/each}
      </g>
    {/each}
  </svg>
</span>

<style>
  /* §23.1 item 1: no plate — the frame is a transparent inline box that
   * reserves exactly the declared `size`; the personage carries itself
   * directly on the page background. */
  .mascot {
    display: inline-block;
    flex: none;
  }
  .mascot svg {
    display: block;
  }
  /* `idle` = the personage's established idle: the card-portrait sway
   * (§4.20.J / §4.22.E) — a hard two-state steps(2) loop, ±2°, pivoting
   * at the figure's feet. */
  .mascot.idle svg {
    animation: mascot-idle 1.6s steps(2) infinite alternate;
    transform-origin: 50% 100%;
  }
  @keyframes mascot-idle {
    from {
      transform: rotate(-2deg);
    }
    to {
      transform: rotate(2deg);
    }
  }
</style>
