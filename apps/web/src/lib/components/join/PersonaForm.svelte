<script lang="ts">
  /**
   * Step 3a/3b — persona form (DESIGN §3.1): name (required, ≤64),
   * public/private bios, the import copy notice when prefilled, client-side
   * empty-name prevention (AC 6) and server-error surfacing (400/409).
   */
  import { locale, translate } from '#lib/i18n/locale';
  import type { PersonaDraft, PersonaError } from '#lib/join';

  interface Props {
    /** Import prefill (§3.1 step 3b) — shows the copy notice. */
    prefill?: PersonaDraft | null;
    /** Server-side error mapping (from JoinFlow). */
    error?: { kind: PersonaError; text: string | null } | null;
    /** Create in flight → CTA spinner + disabled (double-submit prevented). */
    pending?: boolean;
    onsubmit?: (draft: PersonaDraft) => void;
    onback?: () => void;
  }

  let { prefill = null, error = null, pending = false, onsubmit, onback }: Props = $props();

  let name = $state(prefill?.name ?? '');
  let publicBio = $state(prefill?.publicBio ?? '');
  let privateBio = $state(prefill?.privateBio ?? '');
  let localError = $state<'join.error.name_required' | null>(null);

  const errorMessage = $derived.by(() => {
    if (localError) return translate($locale, localError);
    if (!error) return null;
    switch (error.kind) {
      case 'name_required':
        return translate($locale, 'join.error.name_required');
      case 'name_taken':
        return translate($locale, 'join.error.name_taken');
      case 'gone':
        return translate($locale, 'join.error.gone');
      case 'network':
        return translate($locale, 'common.error.network');
      default:
        return error.text ?? translate($locale, 'common.error');
    }
  });

  function submit(event: SubmitEvent): void {
    event.preventDefault();
    localError = null;
    const draft = { name, publicBio, privateBio };
    // Client-side prevention of an empty name (AC 6).
    if (draft.name.trim() === '') {
      localError = 'join.error.name_required';
      return;
    }
    onsubmit?.(draft);
  }
</script>

<form class="step" onsubmit={submit}>
  {#if prefill}
    <p class="notice">{translate($locale, 'join.import.notice')}</p>
  {/if}

  <div class="field">
    <label for="persona-name">{translate($locale, 'join.form.name')}</label>
    <input
      id="persona-name"
      type="text"
      maxlength={64}
      autocomplete="off"
      bind:value={name}
      class:invalid={errorMessage !== null}
    />
  </div>
  <div class="field">
    <label for="persona-public">{translate($locale, 'join.form.public_bio')}</label>
    <input id="persona-public" type="text" maxlength={255} bind:value={publicBio} />
  </div>
  <div class="field">
    <label for="persona-private">{translate($locale, 'join.form.private_bio')}</label>
    <input id="persona-private" type="text" maxlength={255} bind:value={privateBio} />
  </div>

  {#if errorMessage}
    <p class="field-error" role="alert" aria-live="polite">{errorMessage}</p>
  {/if}

  <div class="actions">
    {#if onback}
      <button type="button" class="link" onclick={() => onback?.()}>
        {translate($locale, 'common.back')}
      </button>
    {/if}
    <button type="submit" class="cta" disabled={pending}>
      {#if pending}<span class="spinner" aria-hidden="true"></span>{/if}
      {translate($locale, 'join.enter')}
    </button>
  </div>
</form>

<style>
  .step {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    text-align: left;
  }
  .notice {
    margin: 0;
    padding: var(--space-2) var(--space-3);
    background: var(--color-accent-soft);
    color: var(--color-text);
    border-radius: var(--radius-md);
    font-size: 14px;
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
    background: var(--color-surface);
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
  .field-error {
    margin: 0;
    color: var(--color-accent);
    font-size: 14px;
  }
  .actions {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    margin-top: var(--space-2);
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
  .link {
    background: transparent;
    border: none;
    color: var(--color-text-muted);
    min-height: var(--touch-target);
    font-size: 14px;
  }
</style>
