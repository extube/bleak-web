<script lang="ts">
  /**
   * LandingFigure (DESIGN §4.20.J + §4.21.A): renders one of the landing's
   * mascot cast figures (VECTOR / BLOOM / PIP / GLITCH / NOVA / ASTRA) from
   * the hand-authored rect data in figures.ts — the §4.3 technique
   * (explicit viewBox from the figure's viewW/viewH, crisp SVG rects, token
   * fills, transparent background, NO plate: the wrapper is a transparent
   * inline box that reserves exactly the rendered size). Optional `idle`
   * runs the figure's two-frame idle motion (§4.6 live-dot family; the
   * §4.21.A hero-pair sway kept: 1.6s steps(2) ±2°); the base.css
   * reduced-motion catch-all collapses it to a static frame.
   */
  import { LANDING_FIGURES, type FigureName } from './figures';

  interface Props {
    kind: FigureName;
    /** Rendered height in px (width scales from the figure's viewBox). */
    size?: number;
    /** Two-frame idle motion (sway/bob) — on by default. */
    idle?: boolean;
    /** Accessible name; empty → decorative (aria-hidden). */
    label?: string;
  }

  let { kind, size = 48, idle = true, label = '' }: Props = $props();

  const figure = $derived(LANDING_FIGURES[kind]);
  const width = $derived(Math.round((size * figure.viewW) / figure.viewH));
</script>

<span class="figure" class:idle data-figure={kind}>
  <svg
    viewBox="0 0 {figure.viewW} {figure.viewH}"
    width={width}
    height={size}
    shape-rendering="crispEdges"
    role={label ? 'img' : undefined}
    aria-label={label || undefined}
    aria-hidden={label ? undefined : 'true'}
  >
    {#each figure.parts as part, pi (pi)}
      <g fill={part.fill}>
        {#each part.rects as rect, ri (ri)}
          <rect x={rect[0]} y={rect[1]} width={rect[2]} height={rect[3]} />
        {/each}
      </g>
    {/each}
  </svg>
</span>

<style>
  /* §23 item 1 (as §4.20.J): no plate — a transparent inline box. */
  .figure {
    display: inline-block;
    flex: none;
  }
  .figure svg {
    display: block;
  }
  /* The idle motion toggles with a hard two-state steps(2) loop — the
   * BLOOM sway (§4.20.G-a) and the card portraits' shared idle bob. */
  .idle svg {
    animation: figure-idle 1.6s steps(2) infinite alternate;
    transform-origin: 50% 100%;
  }
  @keyframes figure-idle {
    from {
      transform: rotate(-2deg);
    }
    to {
      transform: rotate(2deg);
    }
  }
</style>
