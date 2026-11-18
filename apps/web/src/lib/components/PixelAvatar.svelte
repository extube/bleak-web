<script lang="ts">
  /**
   * PixelAvatar (DESIGN §4.3, §4.8.1, §4.8.2): chunky 12×12 pixel portrait
   * composed from trait part fragments under `#lib/assets/avatars/`, selected
   * deterministically from the user address (lib/avatar/traits.ts).
   * The `own` persona's backdrop is the accent (the single non-interactive
   * accent exception — the "you are here" mark); unparseable addresses
   * render the fixed pixel-ghost portrait. Trait palettes are the
   * Deepa-derived art tokens (tokens.css --color-art-*, redefined onto the
   * Deepa palette — Concept §9.1.6, DESIGN §4.10.6) — decorative color,
   * token references only; backdrops are dark derivatives of their Deepa
   * hue, darker than the art drawn on top.
   * §4.8.2 padding: the frame carries 1px of padding in the SAME color as
   * the backdrop, so the art never touches the card/surface edge at any
   * rendered size — the outer box stays the declared `size` (the art
   * content shrinks by the padding, not the box).
   */
  import backdropPart from '#lib/assets/avatars/backdrop.svg?raw';
  import headPart from '#lib/assets/avatars/head.svg?raw';
  import facePart from '#lib/assets/avatars/face.svg?raw';
  import hair1 from '#lib/assets/avatars/hair-1.svg?raw';
  import hair2 from '#lib/assets/avatars/hair-2.svg?raw';
  import hair3 from '#lib/assets/avatars/hair-3.svg?raw';
  import hair4 from '#lib/assets/avatars/hair-4.svg?raw';
  import hair5 from '#lib/assets/avatars/hair-5.svg?raw';
  import hair6 from '#lib/assets/avatars/hair-6.svg?raw';
  import hair7 from '#lib/assets/avatars/hair-7.svg?raw';
  import hair8 from '#lib/assets/avatars/hair-8.svg?raw';
  import facialHair1 from '#lib/assets/avatars/facial-hair-1.svg?raw';
  import facialHair2 from '#lib/assets/avatars/facial-hair-2.svg?raw';
  import facialHair3 from '#lib/assets/avatars/facial-hair-3.svg?raw';
  import glasses1 from '#lib/assets/avatars/glasses-1.svg?raw';
  import glasses2 from '#lib/assets/avatars/glasses-2.svg?raw';
  import ghostBody from '#lib/assets/avatars/ghost.svg?raw';
  import ghostEyes from '#lib/assets/avatars/ghost-eyes.svg?raw';
  import { deriveTraits, isParseableAddress, TRAIT_COUNTS } from '#lib/avatar/traits';

  interface Props {
    /** User address — the portrait seed. */
    address?: string | null;
    /** Rendered size in px (scales the 12×12 grid cleanly). */
    size?: number;
    /** Own persona: accent backdrop ("me" mark). */
    own?: boolean;
    /** Accessible name; empty → decorative (aria-hidden). */
    label?: string;
  }

  let { address = '', size = 44, own = false, label = '' }: Props = $props();

  /* Deepa-derived art palettes (§4.10.6) — token names resolved in
   * tokens.css (color-mix/var over the Deepa hues; no raw hex here).
   * Skins: light warm mixes of deepa-2/deepa-3 over --color-text; hairs:
   * the five Deepa hues; backdrops: dark 30% mixes of each Deepa hue over
   * --color-surface (darker than the skin/hair art). */
  const HAIRS: readonly string[] = [
    '--color-art-hair-1',
    '--color-art-hair-2',
    '--color-art-hair-3',
    '--color-art-hair-4',
    '--color-art-hair-5'
  ];
  const SKINS: readonly string[] = [
    '--color-art-skin-1',
    '--color-art-skin-2',
    '--color-art-skin-3',
    '--color-art-skin-4'
  ];
  const BACKDROPS: readonly string[] = [
    '--color-art-backdrop-1',
    '--color-art-backdrop-2',
    '--color-art-backdrop-3',
    '--color-art-backdrop-4',
    '--color-art-backdrop-5'
  ];
  const HAIR_PARTS: readonly string[] = [hair1, hair2, hair3, hair4, hair5, hair6, hair7, hair8];
  const FACIAL_HAIR_PARTS: readonly string[] = [facialHair1, facialHair2, facialHair3];
  const GLASSES_PARTS: readonly string[] = [glasses1, glasses2];

  function pick(list: readonly string[], index: number): string {
    const value = list[index % list.length];
    return value ?? '';
  }

  const traits = $derived(isParseableAddress(address) ? deriveTraits(address) : null);

  function token(index: number, list: readonly string[]): string {
    return `var(${pick(list, index)})`;
  }

  /* §4.8.2: the frame padding color = the backdrop color — the same token
   * string that fills the backdrop part below (accent for `own`, the muted
   * ghost surface for the fallback). Token references only. */
  const backdropColor = $derived(
    traits
      ? own
        ? 'var(--color-accent)'
        : token(traits.backdrop, BACKDROPS)
      : 'var(--color-surface-elevated)'
  );
</script>

<span
  class="frame"
  style:width="{size}px"
  style:height="{size}px"
  style:background={backdropColor}
>
  <svg
    viewBox="0 0 12 12"
    width={size - 2}
    height={size - 2}
    shape-rendering="crispEdges"
    role={label ? 'img' : undefined}
    aria-label={label || undefined}
    aria-hidden={label ? undefined : 'true'}
  >
  {#if traits}
    <g fill={backdropColor}>
      {@html backdropPart}
    </g>
    <g fill={token(traits.skin, SKINS)}>{@html headPart}</g>
    <g fill={token(traits.hairColor, HAIRS)}>{@html pick(HAIR_PARTS, traits.hairstyle)}</g>
    <g fill={token(traits.skin, SKINS)}>{@html facePart}</g>
    {#if traits.facialHair > 0}
      <!-- variant 3 is the gray beard: fixed muted tone regardless of hair color -->
      <g
        fill={traits.facialHair === TRAIT_COUNTS.facialHair - 1
          ? 'var(--color-text-muted)'
          : token(traits.hairColor, HAIRS)}
      >
        {@html pick(FACIAL_HAIR_PARTS, traits.facialHair - 1)}
      </g>
    {/if}
    {#if traits.glasses > 0}
      <g fill="var(--color-surface)">{@html pick(GLASSES_PARTS, traits.glasses - 1)}</g>
    {/if}
  {:else}
    <g fill="var(--color-surface-elevated)">{@html backdropPart}</g>
    <g fill="var(--color-text-muted)">{@html ghostBody}</g>
    <g fill="var(--color-surface)">{@html ghostEyes}</g>
  {/if}
  </svg>
</span>

<style>
  /* §4.8.2 — 1px backdrop-colored padding on all four sides; the outer box
   * stays the declared `size` (border-box), so no consumer layout shifts.
   * The color comes in as the inline `background` (the backdrop token). */
  .frame {
    box-sizing: border-box;
    display: inline-block;
    padding: 1px;
    overflow: hidden;
    flex: none;
  }
  .frame svg {
    display: block;
  }
</style>
