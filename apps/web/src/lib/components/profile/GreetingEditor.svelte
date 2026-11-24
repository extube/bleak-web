<script lang="ts">
  /**
   * GreetingEditor — the greeting FIELD GROUP of /profile/edit (DESIGN
   * §4.29.C.3, v3.23 profile redesign). Previously the inline-swap editor
   * with its own Save/Cancel CTAs — those are retired (the route owns the
   * ONE Save Changes, §4.29.C.4); the fields, labels, validators and
   * helper copy carry verbatim: the textarea (max 255, counter shown),
   * the rule copy as helper text, the inline **Regenerate** outline button
   * that fills the editor WITHOUT saving (the route calls the regenerate
   * endpoint and passes the result back through the bindable value), and
   * the client-side question-mark validation (any `?` or full-width `？`
   * shows the exact inline error; the ROUTE disables its Save button with
   * `aria-disabled` while `invalid` — the rule blocks the WHOLE save).
   * Save → `PUT putUserGreeting` via the route.
   */
  import { locale, translate } from '#lib/i18n/locale';

  interface Props {
    /** The greeting text (bindable — regenerated values flow through). */
    greeting?: string;
    /** The client-side question-free rule (computed by the route). */
    invalid?: boolean;
    /** Loading while the canonical greeting is fetched on mount. */
    loading?: boolean;
    /** Save/regenerate error from the route: `no_questions` = server 400. */
    error?: { kind: 'network' | 'api' | 'no_questions'; text: string | null } | null;
    regeneratePending?: boolean;
    onregenerate?: () => void;
  }

  let {
    greeting = $bindable(''),
    invalid = false,
    loading = false,
    error = null,
    regeneratePending = false,
    onregenerate
  }: Props = $props();

  const counter = $derived(translate($locale, 'profile.greeting.counter', { n: String(greeting.length) }));

  const errorMessage = $derived.by(() => {
    if (invalid) return translate($locale, 'profile.greeting.no_questions');
    if (!error) return null;
    if (error.kind === 'no_questions') return translate($locale, 'profile.greeting.no_questions');
    if (error.kind === 'network') return translate($locale, 'common.error.network');
    return error.text ?? translate($locale, 'common.error');
  });
</script>

<div class="group card pixel-corners">
  {#if loading}
    <p class="caption" aria-live="polite">{translate($locale, 'common.loading')}</p>
  {:else}
    <div class="field">
      <label for="greeting-text">{translate($locale, 'profile.greeting.label')}</label>
      <textarea
        id="greeting-text"
        maxlength={255}
        rows={4}
        bind:value={greeting}
        class:invalid={invalid}
      ></textarea>
      <div class="under">
        <p class="caption">{translate($locale, 'profile.greeting.rule')}</p>
        <span class="counter" aria-hidden="true">{counter}</span>
      </div>
    </div>

    {#if errorMessage}
      <p class="field-error" role="alert" aria-live="polite">{errorMessage}</p>
    {/if}

    <!-- Inline Regenerate (C.3): fills the textarea WITHOUT saving — the
         route owns the only save. -->
    <button
      type="button"
      class="outline"
      disabled={regeneratePending}
      onclick={() => onregenerate?.()}
    >
      {#if regeneratePending}<span class="spinner dark" aria-hidden="true"></span>{/if}
      {translate($locale, 'profile.greeting.regenerate')}
    </button>
  {/if}
</div>

<style>
  .card {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    background: var(--color-surface);
    border-radius: var(--radius-lg);
    padding: var(--space-4) var(--space-5);
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
  textarea {
    background: transparent;
    color: var(--color-text);
    border: none;
    border-radius: 0;
    min-height: var(--touch-target);
    padding: var(--space-2) 0;
    font-size: 15px;
    font-family: var(--font-body);
    resize: vertical;
    transition: color 120ms ease-out;
  }
  textarea:focus {
    outline: none;
    color: var(--color-accent);
  }
  textarea.invalid {
    color: var(--color-accent);
  }
  .under {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--space-3);
  }
  .counter {
    font-size: 14px;
    color: var(--color-text-muted);
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
  .outline {
    align-self: flex-start;
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    min-height: var(--touch-target);
    padding: 0 var(--space-5);
    border-radius: var(--radius-pill);
    border: 1px solid var(--color-text-disabled-strong);
    background: transparent;
    color: var(--color-text);
    font-weight: 600;
    font-size: 14px;
    font-family: var(--font-body);
    transition: opacity 120ms ease-out;
  }
  .outline:disabled {
    cursor: default;
    color: var(--color-text-disabled);
  }
  .spinner {
    width: 16px;
    height: 16px;
    border: 2px solid var(--color-accent-ink);
    border-right-color: transparent;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  .spinner.dark {
    border-color: var(--color-text-muted);
    border-right-color: transparent;
  }
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
