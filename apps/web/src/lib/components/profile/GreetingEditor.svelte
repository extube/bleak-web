<script lang="ts">
  /**
   * GreetingEditor (DESIGN §3.6): inline swap of the badge card — textarea
   * (max 255, counter shown), the rule copy as helper text, client-side
   * question-mark validation (any `?` or full-width `？` disables Save with
   * the exact inline error), `Regenerate` fills the editor WITHOUT saving
   * (the route calls the regenerate endpoint and passes the result back in
   * as the `greeting` prop), Save → `PUT putUserGreeting` via the route.
   */
  import { locale, translate } from '#lib/i18n/locale';
  import { containsQuestionMark } from './greeting';

  interface Props {
    /** Canonical greeting (editor source; regenerated value replaces it). */
    greeting: string;
    loading?: boolean;
    pending?: boolean;
    regeneratePending?: boolean;
    /** Save/regenerate error from the route: `no_questions` = server 400. */
    error?: { kind: 'network' | 'api' | 'no_questions'; text: string | null } | null;
    onsave?: (greeting: string) => void;
    onregenerate?: () => void;
    oncancel?: () => void;
  }

  let {
    greeting,
    loading = false,
    pending = false,
    regeneratePending = false,
    error = null,
    onsave,
    onregenerate,
    oncancel
  }: Props = $props();

  let text = $state(greeting);

  const invalid = $derived(containsQuestionMark(text));
  const counter = $derived(translate($locale, 'profile.greeting.counter', { n: String(text.length) }));

  const errorMessage = $derived.by(() => {
    if (invalid) return translate($locale, 'profile.greeting.no_questions');
    if (!error) return null;
    if (error.kind === 'no_questions') return translate($locale, 'profile.greeting.no_questions');
    if (error.kind === 'network') return translate($locale, 'common.error.network');
    return error.text ?? translate($locale, 'common.error');
  });

  function submit(event: SubmitEvent): void {
    event.preventDefault();
    if (invalid || pending) return;
    onsave?.(text);
  }
</script>

<form class="editor pixel-corners" onsubmit={submit}>
  <h2>{translate($locale, 'profile.greeting.edit')}</h2>

  {#if loading}
    <p class="caption" aria-live="polite">{translate($locale, 'common.loading')}</p>
  {:else}
    <div class="field">
      <label for="greeting-text">{translate($locale, 'profile.greeting.label')}</label>
      <textarea
        id="greeting-text"
        maxlength={255}
        rows={4}
        bind:value={text}
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

    <div class="actions">
      <button
        type="button"
        class="outline"
        disabled={regeneratePending}
        onclick={() => onregenerate?.()}
      >
        {#if regeneratePending}<span class="spinner dark" aria-hidden="true"></span>{/if}
        {translate($locale, 'profile.greeting.regenerate')}
      </button>
      <button type="button" class="outline" onclick={() => oncancel?.()}>
        {translate($locale, 'common.cancel')}
      </button>
      <button type="submit" class="cta" disabled={invalid || pending} aria-disabled={invalid || pending}>
        {#if pending}<span class="spinner" aria-hidden="true"></span>{/if}
        {translate($locale, 'common.save')}
      </button>
    </div>
  {/if}
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
  textarea {
    background: var(--color-bg);
    color: var(--color-text);
    border: 1px solid var(--color-text-disabled-strong);
    border-radius: var(--radius-md);
    min-height: var(--touch-target);
    padding: var(--space-3) var(--space-4);
    font-size: 16px;
    font-family: var(--font-body);
    resize: vertical;
    transition: border-color 120ms ease-out;
  }
  textarea.invalid {
    border-color: var(--color-accent);
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
  .actions {
    display: flex;
    flex-wrap: wrap;
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
