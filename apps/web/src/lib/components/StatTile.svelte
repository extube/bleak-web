<script lang="ts">
  /**
   * StatTile (DESIGN §4.2): big Handjet numeral + caption (persona stats,
   * host summary). The full "caption: value" pair is the accessible name.
   */
  interface Props {
    value: number | string;
    /** Caption also used in the accessible name ("Хендшейков: 7"). */
    label: string;
  }

  let { value, label }: Props = $props();
</script>

<div class="stat-tile pixel-corners" role="img" aria-label={`${label}: ${value}`}>
  <span class="numeral">{value}</span>
  <span class="caption" aria-hidden="true">{label}</span>
</div>

<style>
  .stat-tile {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--space-1);
    background: var(--color-surface-elevated);
    border-radius: var(--radius-md);
    padding: var(--space-4);
    min-height: 88px;
  }
  .numeral {
    font-family: var(--font-pixel);
    font-size: 32px;
    line-height: 1;
    color: var(--color-text);
  }
  .caption {
    font-size: 14px;
    color: var(--color-text-muted);
    text-align: center;
  }
</style>
