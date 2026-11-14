<script lang="ts">
  /**
   * SegmentedControl (DESIGN §4.2): pill-track control on the elevated
   * surface (locale switch, filter rows). Radio semantics with a group
   * aria-label; active option is accent-filled.
   */
  interface Option {
    value: string;
    label: string;
  }

  interface Props {
    options: readonly Option[];
    value: string;
    /** Accessible name of the group. */
    label: string;
    onchange?: (value: string) => void;
  }

  let { options, value, label, onchange }: Props = $props();
</script>

<div class="segmented" role="radiogroup" aria-label={label}>
  {#each options as option (option.value)}
    <button
      type="button"
      role="radio"
      aria-checked={option.value === value}
      class:active={option.value === value}
      onclick={() => onchange?.(option.value)}
    >
      {option.label}
    </button>
  {/each}
</div>

<style>
  .segmented {
    display: inline-flex;
    gap: var(--space-1);
    background: var(--color-surface-elevated);
    border-radius: var(--radius-pill);
    padding: var(--space-1);
  }
  button {
    border: none;
    background: transparent;
    color: var(--color-text-muted);
    border-radius: var(--radius-pill);
    min-height: 40px;
    padding: 0 var(--space-4);
    font-size: 14px;
    font-weight: 600;
    letter-spacing: 0.02em;
    transition:
      background-color 120ms ease-out,
      color 120ms ease-out;
  }
  button.active {
    background: var(--color-accent);
    color: var(--color-accent-ink);
  }
</style>
