<script lang="ts">
  /**
   * Step 3b (1/2) — import room picker (DESIGN §3.1): rows of previous
   * event rooms; picking one loads that room's personas (listImportPersonas).
   */
  import { locale, translate } from '#lib/i18n/locale';
  import type { Room } from '@bleak/api-client';
  import PixelIcon from '#lib/components/icons/PixelIcon.svelte';

  interface Props {
    rooms: Room[];
    loading?: boolean;
    onpick?: (room: Room) => void;
    onback?: () => void;
  }

  let { rooms, loading = false, onpick, onback }: Props = $props();
</script>

<div class="step">
  <h2>{translate($locale, 'join.import.title')}</h2>
  {#if loading}
    <p class="muted" role="status">{translate($locale, 'common.loading')}</p>
  {:else if rooms.length === 0}
    <p class="muted">{translate($locale, 'join.import.empty')}</p>
  {:else}
    <ul class="rows">
      {#each rooms as room (room.address)}
        <li>
          <button type="button" class="row" onclick={() => onpick?.(room)}>
            <span class="name">{room.name}</span>
            <span class="muted">{room.language}</span>
            <PixelIcon name="plus" size={16} />
          </button>
        </li>
      {/each}
    </ul>
  {/if}
  <button type="button" class="link" onclick={() => onback?.()}>
    {translate($locale, 'common.back')}
  </button>
</div>

<style>
  .step {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    text-align: left;
  }
  h2 {
    font-size: 28px;
  }
  .rows {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  .row {
    width: 100%;
    display: flex;
    align-items: center;
    gap: var(--space-3);
    background: var(--color-surface-elevated);
    border: none;
    border-radius: var(--radius-md);
    min-height: var(--touch-target);
    padding: var(--space-2) var(--space-4);
    color: var(--color-text);
    text-align: left;
    transition: background-color 120ms ease-out;
  }
  .name {
    flex: 1;
    font-weight: 600;
  }
  .muted {
    color: var(--color-text-muted);
    font-size: 14px;
  }
  .link {
    align-self: flex-start;
    background: transparent;
    border: none;
    color: var(--color-text-muted);
    min-height: var(--touch-target);
    font-size: 14px;
  }
</style>
