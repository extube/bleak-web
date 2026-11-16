<script lang="ts">
  /**
   * Creation-token gate (DESIGN rev. 3 §3.7 item 2): masked password input
   * on a surface card. The one-time token is validated lazily (on first
   * create — there is no validate endpoint) and is NEVER persisted anywhere:
   * it lives only in the console's memory for the duration of the create
   * call (consumed server-side on use). A 401/403 surfaces «Токен
   * отклонён.» under the field with the entered value kept masked.
   */
  import { locale, translate } from '#lib/i18n/locale';

  interface Props {
    /** In-memory value kept across a rejection (NEVER persisted). */
    initial?: string;
    /** Rejection line rendered under the field (server text appended). */
    rejected?: string | null;
    onsubmit?: (token: string) => void;
  }

  let { initial = '', rejected = null, onsubmit }: Props = $props();

  // Intentional initial capture: the in-memory creation token survives a
  // rejection via the page prop (never persisted — the value dies with the
  // console visit).
  let value = $state(initial);

  const fieldLabel = $derived(translate($locale, 'host.gate.label'));
  const note = $derived(translate($locale, 'host.gate.note'));
  const continueLabel = $derived(translate($locale, 'host.gate.continue'));

  function submit(event: SubmitEvent): void {
    event.preventDefault();
    const token = value.trim();
    if (token === '') return;
    onsubmit?.(token);
  }
</script>

<form class="gate card pixel-corners" onsubmit={submit}>
  <div class="field">
    <label for="host-token">{fieldLabel}</label>
    <input
      id="host-token"
      type="password"
      autocomplete="off"
      bind:value={value}
      class:invalid={rejected !== null}
    />
  </div>

  {#if rejected}
    <p class="field-error" role="alert" aria-live="polite">{rejected}</p>
  {/if}

  <button type="submit" class="cta">{continueLabel}</button>

  <p class="note">{note}</p>
</form>

<style>
  .gate {
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
  input {
    background: var(--color-surface);
    color: var(--color-text);
    border: 1px solid var(--color-text-disabled-strong);
    border-radius: var(--radius-md);
    min-height: var(--touch-target);
    padding: 0 var(--space-4);
    font-size: 16px;
    letter-spacing: 0.2em;
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
  .cta {
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
  .note {
    margin: 0;
    font-size: 14px;
    color: var(--color-text-muted);
  }
</style>
