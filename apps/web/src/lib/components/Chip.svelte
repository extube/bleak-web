<script lang="ts">
  /**
   * Chip (DESIGN §4.2): pill element — variants outline-muted,
   * outline-accent, fill-accent. Never receives `.pixel-corners` (§4.5:
   * pills keep smooth pill shapes).
   */
  import type { Snippet } from 'svelte';

  export type ChipVariant = 'outline-muted' | 'outline-accent' | 'fill-accent';

  interface Props {
    variant?: ChipVariant;
    children: Snippet;
  }

  let { variant = 'outline-muted', children }: Props = $props();
</script>

<span class="chip {variant}"><span class="chip-body">{@render children()}</span></span>

<style>
  .chip {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 28px;
    padding: 2px var(--space-3);
    border-radius: var(--radius-pill);
    font-size: 14px;
    line-height: 1.3;
    letter-spacing: 0.02em;
    white-space: nowrap;
    transition:
      background-color 120ms ease-out,
      color 120ms ease-out,
      border-color 120ms ease-out;
  }
  .outline-muted {
    border: 1px solid var(--color-text-disabled-strong);
    color: var(--color-text-muted);
    background: transparent;
  }
  .outline-accent {
    border: 1px solid var(--color-accent);
    color: var(--color-accent);
    background: transparent;
  }
  .fill-accent {
    border: 1px solid var(--color-accent);
    color: var(--color-accent-ink);
    background: var(--color-accent);
  }
  .chip-body {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
  }
</style>
