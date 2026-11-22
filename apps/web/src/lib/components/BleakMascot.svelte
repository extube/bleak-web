<script lang="ts">
  /**
   * BleakMascot (Concept §22.3 item 1, DESIGN §4.16.1): the Bleak mascot —
   * a chunky 12×12 pixel-art ghost portrait hand-rolled as inline SVG rects
   * (the PixelIcon/PixelAvatar technique: crispEdges, token fills only).
   * Same art register as the avatar art (tokens.css --color-art-* / deepa
   * family): muted ghost body, surface face, a warm Deepa blush —
   * decorative color, token references only, never the interactive accent
   * (§4.1 accent discipline).
   * §23.1 item 1: NO BACKGROUND — no plate/box behind the figure (no
   * backdrop fill, no frame padding); the pixel figure sits directly on
   * the page and the ghost outline carries itself.
   * `idle` runs the 2-frame CSS blink (steps(1) — hard toggle between the
   * open and closed eye frames). Reduced motion needs no local override:
   * the base.css catch-all collapses the animation to a single frame.
   * Reusable so the §4.16.2 creation wizard can mount it too.
   */
  interface Props {
    /** Rendered size in px (scales the 12×12 grid cleanly; design size ~96–128). */
    size?: number;
    /** 2-frame CSS idle blink (eyes open → closed). */
    idle?: boolean;
    /** Accessible name; empty → decorative (aria-hidden). */
    label?: string;
  }

  let { size = 112, idle = true, label = '' }: Props = $props();
</script>

<span class="mascot" class:idle>
  <svg
    viewBox="0 0 12 12"
    width={size}
    height={size}
    shape-rendering="crispEdges"
    role={label ? 'img' : undefined}
    aria-label={label || undefined}
    aria-hidden={label ? undefined : 'true'}
  >
    <!-- ghost body: dome + tuft + the three-tab fringe -->
    <g fill="var(--color-text-muted)">
      <rect x="5" y="0" width="2" height="1" />
      <rect x="4" y="1" width="4" height="1" />
      <rect x="3" y="2" width="6" height="1" />
      <rect x="2" y="3" width="8" height="7" />
      <rect x="2" y="10" width="2" height="1" />
      <rect x="5" y="10" width="2" height="1" />
      <rect x="8" y="10" width="2" height="1" />
    </g>
    <!-- open eyes + smile (surface pixels on the body) -->
    <g fill="var(--color-surface)">
      <rect x="3" y="4" width="2" height="2" />
      <rect x="7" y="4" width="2" height="2" />
      <rect x="4" y="6" width="1" height="1" />
      <rect x="7" y="6" width="1" height="1" />
      <rect x="5" y="7" width="2" height="1" />
    </g>
    <!-- Deepa blush (same decorative register as the avatar art) -->
    <g fill="var(--color-art-skin-4)">
      <rect x="2" y="6" width="1" height="1" />
      <rect x="9" y="6" width="1" height="1" />
    </g>
    <!-- blink frame: erases the open eyes, draws the closed 1px lids -->
    <g class="eyes-closed">
      <g fill="var(--color-text-muted)">
        <rect x="3" y="4" width="2" height="2" />
        <rect x="7" y="4" width="2" height="2" />
      </g>
      <g fill="var(--color-surface)">
        <rect x="3" y="5" width="2" height="1" />
        <rect x="7" y="5" width="2" height="1" />
      </g>
    </g>
  </svg>
</span>

<style>
  /* §23.1 item 1: no plate — the frame is a transparent inline box that
   * reserves exactly the declared `size`; the ghost figure carries itself
   * directly on the page background. */
  .mascot {
    display: inline-block;
    flex: none;
  }
  .mascot svg {
    display: block;
  }
  /* The closed-eye frame is off by default; `idle` toggles it with a hard
   * two-state steps(1) loop — eyes open ~3.6s, closed ~170ms, again. */
  .eyes-closed {
    opacity: 0;
  }
  .idle .eyes-closed {
    animation: mascot-blink 4.2s steps(1) infinite;
  }
  @keyframes mascot-blink {
    0%,
    90%,
    100% {
      opacity: 0;
    }
    92%,
    96% {
      opacity: 1;
    }
  }
</style>
