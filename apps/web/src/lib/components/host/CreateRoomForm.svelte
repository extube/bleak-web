<script lang="ts">
  /**
   * Create-room form (DESIGN §3.7 item 3): name (required), description
   * (optional), agent-language select ru|en. NO max_user field — it is not
   * in CreateRoomRequest (flag §6.3). Pending state disables the form and
   * shows the CTA spinner; 400/409 server text renders under the form.
   */
  import { locale, translate } from '#lib/i18n/locale';

  export interface RoomDraft {
    name: string;
    description: string;
    language: 'ru' | 'en';
  }

  interface Props {
    pending?: boolean;
    /** Server-side error text (helper body) shown under the form. */
    error?: string | null;
    onsubmit?: (draft: RoomDraft) => void;
  }

  let { pending = false, error = null, onsubmit }: Props = $props();

  let name = $state('');
  let description = $state('');
  let language = $state<'ru' | 'en'>('ru');
  let nameMissing = $state(false);

  const nameLabel = $derived(translate($locale, 'host.form.name'));
  const descriptionLabel = $derived(translate($locale, 'host.form.description'));
  const languageLabel = $derived(translate($locale, 'host.form.language'));
  const createLabel = $derived(translate($locale, 'host.create'));
  const requiredLabel = $derived(translate($locale, 'join.error.name_required'));

  const errorMessage = $derived.by(() => {
    if (nameMissing) return requiredLabel;
    return error;
  });

  function submit(event: SubmitEvent): void {
    event.preventDefault();
    if (name.trim() === '') {
      nameMissing = true;
      return;
    }
    nameMissing = false;
    onsubmit?.({ name: name.trim(), description: description.trim(), language });
  }
</script>

<form class="create card pixel-corners" onsubmit={submit}>
  <div class="field">
    <label for="room-name">{nameLabel}</label>
    <input id="room-name" type="text" maxlength={255} bind:value={name} class:invalid={nameMissing} />
  </div>
  <div class="field">
    <label for="room-description">{descriptionLabel}</label>
    <input id="room-description" type="text" maxlength={255} bind:value={description} />
  </div>
  <div class="field">
    <label for="room-language">{languageLabel}</label>
    <select id="room-language" bind:value={language}>
      <option value="ru">ru</option>
      <option value="en">en</option>
    </select>
  </div>

  {#if errorMessage}
    <p class="field-error" role="alert" aria-live="polite">{errorMessage}</p>
  {/if}

  <button type="submit" class="cta" disabled={pending}>
    {#if pending}<span class="spinner" aria-hidden="true"></span>{/if}
    {createLabel}
  </button>
</form>

<style>
  .create {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    max-width: 480px;
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
  .cta {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
  }
  .cta:disabled {
    cursor: default;
    filter: saturate(0.4);
  }
  .spinner {
    width: 16px;
    height: 16px;
    border: 2px solid var(--color-accent-ink);
    border-right-color: transparent;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
