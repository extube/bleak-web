<script lang="ts">
  /**
   * CopyField (DESIGN §4.2): a labelled value row with an inline CopyButton
   * (invite link, 6-digit code).
   */
  import CopyButton from './CopyButton.svelte';

  interface Props {
    label: string;
    value: string;
    /** Truncate long values (invite links) with ellipsis. */
    truncate?: boolean;
  }

  let { label, value, truncate = true }: Props = $props();
</script>

<div class="copy-field">
  <span class="label">{label}</span>
  <span class="value" class:truncate>{value}</span>
  <CopyButton {value} />
</div>

<style>
  .copy-field {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    min-height: var(--touch-target);
    padding: var(--space-2) var(--space-4);
    background: var(--color-surface);
    border-radius: var(--radius-md);
  }
  .label {
    font-size: 14px;
    color: var(--color-text-muted);
    white-space: nowrap;
  }
  .value {
    flex: 1;
    min-width: 0;
    font-size: 14px;
    color: var(--color-text);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .value:not(.truncate) {
    overflow-wrap: anywhere;
    white-space: normal;
  }
</style>
