<script lang="ts">
  /**
   * InterestsEditor (DESIGN §3.6): the mock interests editor — a preset
   * catalog of `Interest {id, label, emoji}` entries (RU/EN label pairs
   * shipped with the app), add/remove chips, done button. The selection is
   * client-side ONLY (`localStorage bleak.interests`, stores/interests.ts)
   * and NEVER issues a network request (architecture §8.1).
   */
  import { locale, translate } from '#lib/i18n/locale';
  import {
    INTEREST_CATALOG,
    loadInterestIds,
    selectedInterests,
    toggleInterestId
  } from '#lib/stores/interests';
  import type { Interest } from '#lib/stores/interests';

  interface Props {
    ondone?: () => void;
  }

  let { ondone }: Props = $props();

  // Local working selection; each toggle persists immediately through the
  // store module (pure localStorage — no network).
  let ids = $state<string[]>(loadInterestIds());

  // The whole catalog rendered as `Interest {id, label, emoji}` chips for
  // the current locale (labels follow the UI locale).
  const chips = $derived<Interest[]>(
    selectedInterests(INTEREST_CATALOG.map((entry) => entry.id), $locale)
  );

  function toggle(id: string): void {
    ids = toggleInterestId(ids, id);
  }
</script>

<section class="editor pixel-corners">
  <h2>{translate($locale, 'profile.interests.edit')}</h2>
  <p class="caption">{translate($locale, 'profile.interests.note')}</p>

  <ul class="chips" aria-label={translate($locale, 'profile.interests.edit')}>
    {#each chips as chip (chip.id)}
      {@const selected = ids.includes(chip.id)}
      <li>
        <button
          type="button"
          class="toggle-chip"
          class:selected
          aria-pressed={selected}
          onclick={() => toggle(chip.id)}
        >
          <span aria-hidden="true">{chip.emoji}</span>
          {chip.label}
        </button>
      </li>
    {/each}
  </ul>

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
