<script lang="ts">
  /**
   * The RETURN screen (Concept §10.1.1, DESIGN §4.11.1 — amends §6.2
   * import semantics): the device token-vault picker. Rows are
   * `bleak.tokenVault` entries — NEVER server rooms (no `GET /api/room`
   * exists in this flow). A row tap validates the stored token and enters
   * THAT room (identity restore, no re-creation); a dead/stale entry
   * surfaces its error honestly on the row and the entry stays
   * (append-only vault). Each row is marked "Return / Вернуться".
   *
   * Concept §30 (DESIGN §4.19): the screen mounts the SHARED FormShell —
   * header (fixed): app icon + language switch; middle (the ONLY
   * scrollable region): the title, the subtitle and the picker rows (the
   * resume-session main interactive element — top-anchored, text ≤ 75%);
   * footer (fixed): the back action. Existing row styles reused.
   */
  import { locale, translate } from '#lib/i18n/locale';
  import { relativeTime } from '#lib/people/view';
  import type { VaultEntry } from '#lib/stores/tokenVault';
  import PixelAvatar from '#lib/components/PixelAvatar.svelte';
  import PixelIcon from '#lib/components/icons/PixelIcon.svelte';
  import FormShell from './FormShell.svelte';

  interface Props {
    entries: VaultEntry[];
    loading?: boolean;
    /** Dead-entry error state keyed by the picked user address (§3.1). */
    dead?: { address: string; text: string | null } | null;
    onpick?: (entry: VaultEntry) => void;
    onback?: () => void;
  }

  let { entries, loading = false, dead = null, onpick, onback }: Props = $props();

  const nowMs = $state(Date.now());
  const emptyLabel = $derived(translate($locale, 'join.import.empty'));
  const subtitle = $derived(translate($locale, 'join.import.subtitle'));
  const backLabel = $derived(translate($locale, 'common.back'));
  const returnBadge = $derived(translate($locale, 'join.import.return'));
</script>

<FormShell>
  <div class="body">
    <h2>{translate($locale, 'join.import.title')}</h2>
    <p class="muted">{subtitle}</p>

    {#if loading}
      <p class="muted" role="status">{translate($locale, 'common.loading')}</p>
    {:else if entries.length === 0}
      <p class="muted">{emptyLabel}</p>
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
                    date: relativeTime(entry.savedAt, nowMs, $locale)
                  })}
                </span>
              </span>
              <span class="badge">{returnBadge}</span>
              <PixelIcon name="key" size={16} />
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
  </div>
  {#snippet footer()}
    <button type="button" class="link" onclick={() => onback?.()}>
      {backLabel}
    </button>
  {/snippet}
</FormShell>

<style>
  .body {
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
  .badge {
    flex-shrink: 0;
    border: 1px solid var(--color-text-disabled-strong);
    border-radius: var(--radius-pill);
    color: var(--color-text-muted);
    font-size: 12px;
    font-weight: 600;
    padding: 2px var(--space-2);
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
