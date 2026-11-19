<script lang="ts">
  /**
   * InterestsEditor (DESIGN §4.13.1 item 2): the interests PICKER in
   * /profile/settings — the curated client catalog rendered as group
   * sections of emoji chips. Toggling ON upserts through the REAL
   * `addUserInterests` endpoint (that persona's Bearer, 1..50 rows) and
   * mirrors the 201 FULL list; toggling OFF calls `deleteUserInterests`
   * (idempotent delete by key) and mirrors the 200 REMAINING list. There
   * is no interests GET — the local mirror store (stores/interests.ts)
   * is the read source the badge renders from.
   *
   * The 1..50 rows / 1..64 title caps are enforced client-side by the
   * tz5-01 client (`ValidationError` pre-flight); at 50 rows the
   * unselected chips disable (the cap never needs a request to learn).
   */
  import { get } from 'svelte/store';
  import { identity } from '#lib/stores/identity';
  import { api } from '#lib/api/client';
  import { locale, translate } from '#lib/i18n/locale';
  import {
    INTEREST_CATALOG,
    INTEREST_GROUPS,
    groupTitle,
    interestTitle,
    type InterestCatalogEntry
  } from '#lib/interests/catalog';
  import { MAX_INTERESTS, loadInterests, saveInterests } from '#lib/stores/interests';

  interface Props {
    ondone?: () => void;
  }

  let { ondone }: Props = $props();

  const me = $derived($identity);

  // Working selection: numeric keys mirrored for the current persona
  // (hydrated from the local mirror when the identity is present).
  let selectedKeys = $state<number[]>([]);
  let pendingKeys = $state<number[]>([]);
  let error = $state<string | null>(null);

  $effect(() => {
    const id = me;
    if (!id) return;
    selectedKeys = loadInterests(id.roomAddress, id.userAddress).map((row) => row.key);
  });

  const selectedSet = $derived(new Set(selectedKeys));
  const atCap = $derived(selectedKeys.length >= MAX_INTERESTS);

  function isPending(key: number): boolean {
    return pendingKeys.includes(key);
  }

  async function toggle(entry: InterestCatalogEntry): Promise<void> {
    const id = me;
    if (!id || isPending(entry.key)) return;
    const selected = selectedSet.has(entry.key);
    error = null;
    pendingKeys = [...pendingKeys, entry.key];
    try {
      if (selected) {
        // Delete is idempotent (unknown keys ignored): the 200 REMAINING
        // list is the mirror truth.
        const remaining = await api.deleteUserInterests(id.roomAddress, id.userAddress, [entry.key]);
        selectedKeys = saveInterests(id.roomAddress, id.userAddress, remaining).map((r) => r.key);
      } else {
        const title = interestTitle(entry, get(locale));
        const list = await api.addUserInterests(id.roomAddress, id.userAddress, [
          { title, group: entry.group, key: entry.key }
        ]);
        selectedKeys = saveInterests(id.roomAddress, id.userAddress, list).map((r) => r.key);
      }
    } catch {
      error = translate(get(locale), 'profile.interests.error');
    } finally {
      pendingKeys = pendingKeys.filter((key) => key !== entry.key);
    }
  }
</script>

<section class="editor pixel-corners">
  <h2>{translate($locale, 'profile.interests.edit')}</h2>
  <p class="caption">{translate($locale, 'profile.interests.note')}</p>

  {#each INTEREST_GROUPS as group (group.group)}
    <h3 class="group-title">{groupTitle(group.group, $locale)}</h3>
    <ul class="chips" aria-label={groupTitle(group.group, $locale)}>
      {#each INTEREST_CATALOG.filter((entry) => entry.group === group.group) as entry (entry.key)}
        {@const selected = selectedSet.has(entry.key)}
        <li>
          <button
            type="button"
            class="toggle-chip"
            class:selected
            disabled={!selected && atCap}
            aria-pressed={selected}
            onclick={() => toggle(entry)}
          >
            <span aria-hidden="true">{entry.emoji}</span>
            {interestTitle(entry, $locale)}
          </button>
        </li>
      {/each}
    </ul>
  {/each}

  {#if error}
    <p class="field-error" role="alert" aria-live="polite">{error}</p>
  {/if}

  <div class="actions">
    <button type="button" class="cta" onclick={() => ondone?.()}>
      {translate($locale, 'profile.interests.done')}
    </button>
  </div>
</section>

<style>
  .editor {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    background: var(--color-surface);
    border-radius: var(--radius-lg);
    padding: var(--space-5);
    text-align: left;
  }
  .editor h2 {
    font-size: 24px;
  }
  .caption {
    margin: 0;
    font-size: 14px;
    color: var(--color-text-muted);
  }
  .group-title {
    margin: var(--space-2) 0 0;
    font-family: var(--font-body);
    font-size: 14px;
    font-weight: 600;
    color: var(--color-text-muted);
  }
  .chips {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }
  .toggle-chip {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    min-height: 40px;
    padding: 0 var(--space-4);
    border: 1px solid var(--color-text-disabled-strong);
    border-radius: var(--radius-pill);
    background: transparent;
    color: var(--color-text-muted);
    font-size: 14px;
    transition:
      background-color 120ms ease-out,
      color 120ms ease-out,
      border-color 120ms ease-out;
  }
  .toggle-chip.selected {
    border-color: var(--color-accent);
    background: var(--color-accent);
    color: var(--color-accent-ink);
  }
  .toggle-chip:disabled {
    opacity: 0.5;
    cursor: default;
  }
  .field-error {
    margin: 0;
    font-size: 14px;
    color: var(--color-danger-text);
  }
  .actions {
    display: flex;
    justify-content: flex-end;
    margin-top: var(--space-2);
  }
  .cta {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    min-height: var(--touch-target);
    padding: 0 var(--space-5);
    background: var(--color-accent);
    color: var(--color-accent-ink);
    border: none;
    border-radius: var(--radius-pill);
    font-weight: 600;
    font-size: 14px;
    transition: opacity 120ms ease-out;
  }
</style>
