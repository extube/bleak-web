<script lang="ts">
  /**
   * Step 3b — vault list (DESIGN §3.1 rev. 3 step 6, Concept §6.2): the
   * device token-vault import picker. Rows are `bleak.tokenVault` entries —
   * NEVER server rooms (no `GET /api/room` exists in this flow). A row tap
   * reads the old persona with its stored token; a dead persona surfaces
   * its error honestly on the row and the entry stays (append-only vault).
   */
  import { locale, translate } from '#lib/i18n/locale';
  import { relativeTime } from '#lib/people/view';
  import type { VaultEntry } from '#lib/stores/tokenVault';
  import PixelAvatar from '#lib/components/PixelAvatar.svelte';
  import PixelIcon from '#lib/components/icons/PixelIcon.svelte';

  interface Props {
    entries: VaultEntry[];
    loading?: boolean;
    /** Dead-entry error state keyed by the picked user address (§3.1). */
    dead?: { address: string; text: string | null } | null;
    onpick?: (entry: VaultEntry) => void;
    onback?: () => void;
    /** Empty-vault escape hatch: back to persona creation (§3.1 AC 14). */
    oncreate?: () => void;
  }

  let { entries, loading = false, dead = null, onpick, onback, oncreate }: Props = $props();

  const nowMs = $state(Date.now());
  const emptyLabel = $derived(translate($locale, 'join.import.empty'));
  const subtitle = $derived(translate($locale, 'join.import.subtitle'));
  const backLabel = $derived(translate($locale, 'common.back'));
</script>

<div class="step">
  <h2>{translate($locale, 'join.import.title')}</h2>
  <p class="muted">{subtitle}</p>

  {#if loading}
    <p class="muted" role="status">{translate($locale, 'common.loading')}</p>
  {:else if entries.length === 0}
    <p class="muted">{emptyLabel}</p>
    {#if oncreate}
      <button type="button" class="link" onclick={() => oncreate?.()}>
        {translate($locale, 'join.create_persona')}
      </button>
    {/if}
  {:else}
    <ul class="rows">
      {#each entries as entry (entry.roomAddress + entry.userAddress)}
        <li>
          <button
            type="button"
            class="row"
            class:dead={dead?.address === entry.userAddress}
            aria-label={translate($locale, 'join.import.row_aria', {
              name: entry.name ?? entry.userAddress
            })}
            onclick={() => onpick?.(entry)}
          >
            <PixelAvatar address={entry.userAddress} size={44} />
            <span class="texts">
              <span class="name">{entry.name ?? entry.userAddress}</span>
              <span class="muted">
                {translate($locale, 'join.import.saved_at', {
                  date: relativeTime(entry.savedAt, nowMs, $locale),
                  room: entry.roomAddress
                })}
              </span>
            </span>
            <PixelIcon name="plus" size={16} />
          </button>
          {#if dead?.address === entry.userAddress}
            <!-- Dead-entry state (§3.1): the entry stays listed; server
                 text appended muted when present (401/403 variant). -->
            <p class="dead-note" role="alert" aria-live="polite">
              {translate($locale, 'join.import.dead')}
              {#if dead.text}<span class="muted"> — {dead.text}</span>{/if}
            </p>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
  <button type="button" class="link" onclick={() => onback?.()}>
    {backLabel}
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
  .row.dead {
    color: var(--color-text-muted);
  }
  .texts {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .name {
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .muted {
    color: var(--color-text-muted);
    font-size: 14px;
  }
  .dead-note {
    margin: var(--space-1) 0 0;
    font-size: 14px;
    color: var(--color-accent);
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
