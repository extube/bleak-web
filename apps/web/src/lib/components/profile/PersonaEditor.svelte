<script lang="ts">
  /**
   * PersonaEditor (DESIGN §3.6): inline swap of the badge card — name,
   * public_bio, private_bio prefilled; saves via `PUT updateRoomUser`
   * sending ALL THREE fields (omitted-field semantics). Pending spinner +
   * double-submit prevention; server errors surface inline.
   */
  import { locale, translate } from '#lib/i18n/locale';
  import type { User } from '@bleak/api-client';
  import type { PersonaDraft } from '#lib/join';

  interface Props {
    user: User;
    pending?: boolean;
    /** Server error mapping from the route ({kind, text}). */
    error?: { kind: 'network' | 'api'; text: string | null } | null;
    onsave?: (draft: PersonaDraft) => void;
    oncancel?: () => void;
  }

  let { user, pending = false, error = null, onsave, oncancel }: Props = $props();

  let name = $state(user.name);
  let publicBio = $state(user.public_bio);
  let privateBio = $state(user.private_bio);
  let nameError = $state<string | null>(null);

  const errorMessage = $derived.by(() => {
    if (nameError) return nameError;
    if (!error) return null;
    if (error.kind === 'network') return translate($locale, 'common.error.network');
    return error.text ?? translate($locale, 'common.error');
  });

  function submit(event: SubmitEvent): void {
    event.preventDefault();
    nameError = null;
    if (name.trim() === '') {
      nameError = translate($locale, 'join.error.name_required');
      return;
    }
    onsave?.({ name: name.trim(), publicBio, privateBio });
  }
</script>

<form class="editor pixel-corners" onsubmit={submit}>
  <h2>{translate($locale, 'profile.persona.edit')}</h2>

  <div class="field">
    <label for="persona-edit-name">{translate($locale, 'join.form.name')}</label>
    <input
      id="persona-edit-name"
      type="text"
      maxlength={64}
      autocomplete="off"
      bind:value={name}
      class:invalid={nameError !== null}
    />
  </div>
  <div class="field">
    <label for="persona-edit-public">{translate($locale, 'join.form.public_bio')}</label>
    <input id="persona-edit-public" type="text" maxlength={255} bind:value={publicBio} />
  </div>
  <div class="field">
    <label for="persona-edit-private">{translate($locale, 'join.form.private_bio')}</label>
    <input id="persona-edit-private" type="text" maxlength={255} bind:value={privateBio} />
    <p class="caption">{translate($locale, 'profile.private_bio.caption')}</p>
  </div>

  {#if errorMessage}
    <p class="field-error" role="alert" aria-live="polite">{errorMessage}</p>
  {/if}

  <div class="actions">
    <button type="button" class="outline" onclick={() => oncancel?.()}>
      {translate($locale, 'common.cancel')}
    </button>
    <button type="submit" class="cta" disabled={pending}>
      {#if pending}<span class="spinner" aria-hidden="true"></span>{/if}
      {translate($locale, 'common.save')}
    </button>
  </div>
</form>

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
  .field {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }
  label {
    color: var(--color-text-muted);
    font-size: 14px;
  }
  input {
    background: var(--color-bg);
    color: var(--color-text);
    border: 1px solid var(--color-text-disabled-strong);
    border-radius: var(--radius-md);
    min-height: var(--touch-target);
    padding: 0 var(--space-4);
    font-size: 16px;
    transition: border-color 120ms ease-out;
  }
  input.invalid {
    border-color: var(--color-accent);
  }
  .caption {
    margin: 0;
    font-size: 14px;
    color: var(--color-text-muted);
  }
  .field-error {
    margin: 0;
    color: var(--color-accent);
    font-size: 14px;
  }
  .actions {
    display: flex;
    gap: var(--space-3);
    margin-top: var(--space-2);
  }
  .cta,
  .outline {
    flex: 1;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    min-height: var(--touch-target);
    border-radius: var(--radius-pill);
    font-weight: 600;
    font-size: 14px;
    transition: opacity 120ms ease-out;
  }
  .cta {
    background: var(--color-accent);
    border: none;
    color: var(--color-accent-ink);
  }
  .cta:disabled {
    cursor: default;
    filter: saturate(0.4);
  }
  .outline {
    background: transparent;
    border: 1px solid var(--color-text-disabled-strong);
    color: var(--color-text);
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
