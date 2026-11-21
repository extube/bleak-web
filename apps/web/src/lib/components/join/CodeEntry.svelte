<script lang="ts">
  /**
   * Step 1 — code entry card (DESIGN §3.1, §4.12.1 item 6): DigitInput (six
   * cells capped at 56px, flexible at phone widths), inline 404/400 errors
   * with a single shake, scan entry (QrScanner context *a* is mounted by
   * the parent JoinFlow).
   *
   * Concept §30 (DESIGN §4.19 + owner amendment) — the reference
   * three-block instantiation: the form mounts the SHARED FormShell —
   * header (fixed): the app icon left + the language switch right;
   * middle (the ONLY scrollable region): the mascot, the "Join the
   * Event" title, the subtitle text and the 6-digit input plus the
   * QR-scan link ONLY; footer (fixed, the 1..n stacked case): the
   * primary enter action ("Enter the room" — existing .cta styles) and,
   * BELOW it, the "Return to event" entry (§4.11.1, same link styles).
   * The <form> still wraps the whole shell, so the footer enter button
   * keeps its native submit semantics (Enter in a cell submits).
   */
  import { locale, translate } from '#lib/i18n/locale';
  import { isValidInviteCode } from '#lib/join';
  import BleakMascot from '#lib/components/BleakMascot.svelte';
  import DigitInput from '#lib/components/DigitInput.svelte';
  import PixelIcon from '#lib/components/icons/PixelIcon.svelte';
  import FormShell from './FormShell.svelte';

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
    /** Return-to-event entry (§4.11.1): present only when the device vault
     * holds a saved persona — the path BACK after "join another event". */
    onreturn?: () => void;
  }

  let {
    code = $bindable(''),
    disabled = false,
    error = null,
    shakeKey = 0,
    onsubmit,
    onscan,
    onreturn
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
  <FormShell>
    <div class="body">
      <!-- §23.1 item 2 content order (now the §30 MIDDLE block): mascot
           → title → text → the 6-digit input → the QR-scan link ONLY
           (owner amendment: the return-to-event entry moved to the
           footer, stacked below the enter action). -->
      <div class="mascot-row">
        <BleakMascot size={96} idle />
      </div>
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

      <div class="divider" aria-hidden="true"></div>
      <button type="button" class="scan" onclick={() => onscan?.()}>
        <PixelIcon name="scan" size={16} />
        {translate($locale, 'join.scan.open')}
      </button>
    </div>
    {#snippet footer()}
      <!-- §30 footer (the 1..n stacked case, owner amendment): the
           primary enter button (native type=submit inside the <form>)
           and, BELOW it, the return-to-event entry (§4.11.1) — same
           link styles, always fully visible. -->
      <button type="submit" class="cta" disabled={disabled || !complete}>
        {#if disabled}<span class="spinner" aria-hidden="true"></span>{/if}
        {translate($locale, 'join.enter')}
      </button>
      {#if onreturn}
        <button type="button" class="scan" onclick={() => onreturn?.()}>
          <PixelIcon name="key" size={16} />
          {translate($locale, 'join.import.title')}
        </button>
      {/if}
    {/snippet}
  </FormShell>
</form>

<style>
  .step {
    /* §30: the form fills the bounded card — the FormShell inside carries
     * the three-region geometry (header/footer fixed, middle scrolling). */
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    min-width: 0;
  }
  .body {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    min-width: 0;
  }
  h1 {
    font-size: 32px;
    /* §4.12.1 item 6: long words must not push the card past its bounds
     * at phone widths (320/360/390). */
    overflow-wrap: anywhere;
  }
  .subtitle {
    margin: 0;
    color: var(--color-text-muted);
    font-size: 14px;
  }
  .mascot-row {
    display: flex;
    justify-content: center;
  }
  .cells {
    /* §4.12.1 item 6: NOT a flex container anymore — as a flex row it made
     * .digit-input an unconstrained flex item (min-width: auto) that sized
     * to its capped 376px content and never shrank, locking the row past
     * the card at every phone width. Centering lives inside DigitInput
     * (justify-content on the cells row). Kept as a plain block with a
     * defensive min-width: 0 (harmless cross-axis floor in .step). */
    min-width: 0;
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
</style>
