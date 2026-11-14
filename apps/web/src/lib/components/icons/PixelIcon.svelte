<script lang="ts">
  /**
   * PixelIcon (DESIGN §4.4): a 16×16 grid pixel-art glyph rendered with
   * `currentColor` (token colors are inherited, never hardcoded). Give
   * `label` for meaningful icons; decorative icons stay aria-hidden.
   */
  import { ICON_RECTS, type IconName } from './registry';

  interface Props {
    name: IconName;
    size?: number;
    /** Accessible name; empty → decorative (aria-hidden). */
    label?: string;
  }

  let { name, size = 16, label = '' }: Props = $props();
</script>

<svg
  viewBox="0 0 16 16"
  width={size}
  height={size}
  shape-rendering="crispEdges"
  fill="currentColor"
  role={label ? 'img' : undefined}
  aria-label={label || undefined}
  aria-hidden={label ? undefined : 'true'}
>
  {#each ICON_RECTS[name] as rect, index (index)}
    <rect x={rect[0]} y={rect[1]} width={rect[2]} height={rect[3]} />
  {/each}
</svg>
