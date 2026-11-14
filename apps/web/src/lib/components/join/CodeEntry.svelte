<script lang="ts">
  /**
   * Step 1 — code entry card (DESIGN §3.1): DigitInput (six 56px cells),
   * CTA enabled at 6 digits, inline 404/400 errors with a single shake,
   * scan entry (QrScanner context *a* is mounted by the parent JoinFlow),
   * locale control in the card footer.
   */
  import { locale, translate } from '#lib/i18n/locale';
  import { isValidInviteCode } from '#lib/join';
  import DigitInput from '#lib/components/DigitInput.svelte';
  import PixelIcon from '#lib/components/icons/PixelIcon.svelte';
  import LocaleControl from './LocaleControl.svelte';

  interface Props {
    code?: string;
    /** Resolution in flight → CTA spinner + disabled. */
    disabled?: boolean;
    /** Inline error kind under the cells (404 / malformed 400). */
    error?: 'not_found' | 'malformed' | null;
    /** Increment to retrigger the 120 ms shake (unless reduced motion). */
    shakeKey?: number;
    onsubmit?: (code: string) => void;
    onscan?: () => void;
  }

  let {
    code = $bindable(''),
    disabled = false,
    error = null,
    shakeKey = 0,
    onsubmit,
    onscan
  }: Props = $props();

  let cellsWrap = $state<HTMLElement | null>(null);
  let shaking = $state(false);

  /** Parent-facing focus helper: closing the scanner returns focus to the
   * digit cells (AC 12). */
  export function focusCode(): void {
    (cellsWrap?.querySelector('input') as HTMLInputElement | null)?.focus();
  }
  // Retrigger the shake whenever the parent bumps the key.
  $effect(() => {
    if (shakeKey > 0) {
      shaking = true;
      const id = window.setTimeout(() => (shaking = false), 130);
      return () => window.clearTimeout(id);
    }
  });

  const complete = $derived(isValidInviteCode(code));

  function submit(event: SubmitEvent): void {
    event.preventDefault();
    if (!disabled && complete) onsubmit?.(code);
  }
</script>

<form class="step" onsubmit={submit}>
  <h1>{translate($locale, 'join.title')}</h1>
  <p class="subtitle">{translate($locale, 'join.subtitle')}</p>

  <div class="cells" bind:this={cellsWrap} class:shaking>
    <DigitInput bind:value={code} {disabled} />
  </div>

  {#if error}
    <p class="field-error" role="alert" aria-live="polite">
      {error === 'not_found'
        ? translate($locale, 'join.error.unknown')
        : translate($locale, 'join.code.malformed')}
    </p>
  {/if}

  <button type="submit" class="cta" disabled={disabled || !complete}>
    {#if disabled}<span class="spinner" aria-hidden="true"></span>{/if}
    {translate($locale, 'join.enter')}
  </button>

  <div class="divider" aria-hidden="true"></div>
  <button type="button" class="scan" onclick={() => onscan?.()}>
    <PixelIcon name="scan" size={16} />
    {translate($locale, 'join.scan.open')}
  </button>

  <div class="footer">
    <LocaleControl />
  </div>
</form>

<style>
  .step {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }
  h1 {
    font-size: 32px;
  }
  .subtitle {
    margin: 0;
    color: var(--color-text-muted);
    font-size: 14px;
  }
  .cells {
    display: flex;
    justify-content: center;
  }
  .shaking {
    animation: shake 120ms ease-out;
  }
  @keyframes shake {
    25% {
      transform: translateX(-4px);
    }
    75% {
      transform: translateX(4px);
    }
  }
  .field-error {
    margin: 0;
    color: var(--color-accent);
    font-size: 14px;
    text-align: center;
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
  .divider {
    height: 1px;
    background: var(--color-text-disabled-strong);
    opacity: 0.4;
  }
  .scan {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    background: transparent;
    border: none;
    color: var(--color-text-muted);
    min-height: var(--touch-target);
    font-size: 14px;
    font-weight: 600;
    transition: color 120ms ease-out;
  }
  .scan:hover {
    color: var(--color-text);
  }
  .footer {
    display: flex;
  }
</style>
