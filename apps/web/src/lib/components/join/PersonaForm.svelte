<script lang="ts">
  /**
   * Step 3a — persona form (DESIGN §3.1): name (required, ≤64),
   * public/private bios, client-side empty-name prevention (AC 7) and
   * server-error surfacing (400/409).
   *
   * §4.14.3 item 3 (Concept §14.1.3): a CONTACT field — client-LOCAL data
   * (the backend user model has no contact field). The value rides the
   * draft only; JoinFlow persists it to the contactCard store
   * (`bleak.contactCard`, room|user scope) AFTER the persona 2xx — nothing
   * is sent to the backend at creation. Cap + counter mirror
   * ContactCardEditor (255, the server MaxContactContentLen).
   */
  import { locale, translate } from '#lib/i18n/locale';
  import { MAX_CONTACT_CARD } from '#lib/stores/contactCard';
  import type { PersonaDraft, PersonaError } from '#lib/join';

  interface Props {
    /** Server-side error mapping (from JoinFlow). */
    error?: { kind: PersonaError; text: string | null } | null;
    /** Create in flight → CTA spinner + disabled (double-submit prevented). */
    pending?: boolean;
    onsubmit?: (draft: PersonaDraft) => void;
    onback?: () => void;
  }

  let { error = null, pending = false, onsubmit, onback }: Props = $props();

  let name = $state('');
  let publicBio = $state('');
  let privateBio = $state('');
  // §4.14.3: fresh persona → empty prefill; local-only draft value until
  // JoinFlow persists it post-creation.
  let contact = $state('');
  let localError = $state<'join.error.name_required' | null>(null);

  const contactCounter = $derived(
    translate($locale, 'profile.greeting.counter', { n: String(contact.length) })
  );

  const errorMessage = $derived.by(() => {
    if (localError) return translate($locale, localError);
    if (!error) return null;
    switch (error.kind) {
      case 'name_required':
        return translate($locale, 'join.error.name_required');
      case 'name_taken':
        return translate($locale, 'join.error.name_taken');
      case 'invite':
        // §2.9: creation rejected over the invite code (invalid/expired/
        // revoked) — identity and vault unchanged (§3.1 AC 9).
        return translate($locale, 'join.error.invite');
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
    const draft = { name, publicBio, privateBio, contact: contact.trim() };
    // Client-side prevention of an empty name (AC 6).
    if (draft.name.trim() === '') {
      localError = 'join.error.name_required';
      return;
    }
    onsubmit?.(draft);
  }
</script>

<form class="step" onsubmit={submit}>
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
  <div class="field">
    <label for="persona-contact">{translate($locale, 'join.form.contact')}</label>
    <!-- maxlength is the client-side cap; the store clamps again on save -->
    <input id="persona-contact" type="text" maxlength={MAX_CONTACT_CARD} bind:value={contact} />
    <span class="hint">{translate($locale, 'join.form.contact_hint')}</span>
    <span class="counter">{contactCounter}</span>
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
  .hint {
    color: var(--color-text-muted);
    font-size: 12px;
  }
  .counter {
    color: var(--color-text-muted);
    font-size: 12px;
    align-self: flex-end;
    margin-top: calc(var(--space-1) * -1);
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
