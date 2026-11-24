<script lang="ts">
  /**
   * Create-room form FIELDS (DESIGN §3.7.1 Create mode): name (required),
   * description (optional), agent-language select ru|en. TZ13-02: the form
   * moved INSIDE the `HostEntryCard` mode card — this block renders only the
   * three fields (+ the error line under them); the card owns the single
   * <form>, the submit validation and the CTA. NO max_user field — it is not
   * in CreateRoomRequest (F9; the server default displays read-only in the
   * panel). Server text (400/409) renders under the fields.
   */
  import { locale, translate } from '#lib/i18n/locale';

  export interface RoomDraft {
    name: string;
    description: string;
    language: 'ru' | 'en';
  }

  interface Props {
    /** Two-way bound draft — the entry card owns submit + validation. */
    draft?: RoomDraft;
    /** Error line under the fields: required-name copy or server text. */
    error?: string | null;
    /** Red-border state for the required `name` field. */
    invalidName?: boolean;
  }

  let {
    draft = $bindable({ name: '', description: '', language: 'ru' }),
    error = null,
    invalidName = false
  }: Props = $props();

  const nameLabel = $derived(translate($locale, 'host.form.name'));
  const descriptionLabel = $derived(translate($locale, 'host.form.description'));
  const languageLabel = $derived(translate($locale, 'host.form.language'));
</script>

<div class="room-fields">
  <div class="field">
    <label for="room-name">{nameLabel}</label>
    <input
      id="room-name"
      type="text"
      maxlength={255}
      bind:value={draft.name}
      class:invalid={invalidName}
    />
  </div>
  <div class="field">
    <label for="room-description">{descriptionLabel}</label>
    <input id="room-description" type="text" maxlength={255} bind:value={draft.description} />
  </div>
  <div class="field">
    <label for="room-language">{languageLabel}</label>
    <select id="room-language" bind:value={draft.language}>
      <option value="ru">ru</option>
      <option value="en">en</option>
    </select>
  </div>

  {#if error}
    <p class="field-error" role="alert" aria-live="polite">{error}</p>
  {/if}
</div>

<style>
  .room-fields {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }
  .field {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }
  label {
    color: var(--color-text-muted);
    font-size: 14px;
  }
  input,
  select {
    background: var(--color-surface);
    color: var(--color-text);
    border: 1px solid var(--color-text-disabled-strong);
    border-radius: var(--radius-md);
    min-height: var(--touch-target);
    padding: 0 var(--space-4);
    font-size: 16px;
    font-family: var(--font-body);
    transition: border-color 120ms ease-out;
  }
  select {
    padding: 0 var(--space-2);
  }
  input.invalid {
    border-color: var(--color-accent);
  }
  .field-error {
    margin: 0;
    color: var(--color-accent);
    font-size: 14px;
  }
</style>
