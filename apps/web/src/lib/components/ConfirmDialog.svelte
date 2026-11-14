<script lang="ts">
  /**
   * ConfirmDialog (DESIGN §2.1): pixel-cornered confirm dialog with a focus
   * trap, Escape-to-close and focus restoration (kickoff, leave room,
   * delete room).
   */
  import { tick } from 'svelte';
  import { locale, translate } from '#lib/i18n/locale';

  interface Props {
    open?: boolean;
    title: string;
    body: string;
    confirmLabel?: string;
    cancelLabel?: string;
    /** Destructive confirmations keep the accent discipline (§4 tokens). */
    danger?: boolean;
    onconfirm?: () => void;
    oncancel?: () => void;
  }

  let { open = $bindable(false), title, body, confirmLabel = '', cancelLabel = '', danger = false, onconfirm, oncancel }: Props =
    $props();

  let dialogEl: HTMLDivElement | null = $state(null);
  let previouslyFocused: HTMLElement | null = null;

  const confirmText = $derived(confirmLabel || translate($locale, 'common.save'));
  const cancelText = $derived(cancelLabel || translate($locale, 'common.cancel'));

  $effect(() => {
    if (open) {
      previouslyFocused = document.activeElement as HTMLElement | null;
      void tick().then(() => {
        dialogEl?.querySelector<HTMLElement>('button, a[href]')?.focus();
      });
      return () => {
        previouslyFocused?.focus?.();
        previouslyFocused = null;
      };
    }
  });

  function close(cancel: boolean): void {
    open = false;
    if (cancel) oncancel?.();
  }

  function trapKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      close(true);
      return;
    }
    if (event.key !== 'Tab' || !dialogEl) return;
    const focusables = Array.from(
      dialogEl.querySelectorAll<HTMLElement>('button, a[href], [tabindex]:not([tabindex="-1"])')
    ).filter((el) => !el.hasAttribute('disabled'));
    if (focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (!first || !last) return;
    const active = document.activeElement;
    if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }
</script>

{#if open}
  <div class="scrim">
    <div
      class="dialog pixel-corners"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      tabindex="-1"
      bind:this={dialogEl}
      onkeydown={trapKeydown}
    >
      <h2>{title}</h2>
      <p>{body}</p>
      <div class="actions">
        <button type="button" class="cancel" onclick={() => close(true)}>{cancelText}</button>
        <button type="button" class="confirm" class:danger onclick={() => { close(false); onconfirm?.(); }}>
          {confirmText}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .scrim {
    position: fixed;
    inset: 0;
    background: var(--color-scrim);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--space-5);
    z-index: 40;
  }
  .dialog {
    background: var(--color-surface);
    border-radius: var(--radius-lg);
    padding: var(--space-5);
    max-width: 420px;
    width: 100%;
    animation: enter 200ms ease-out;
  }
  .dialog h2 {
    font-size: 24px;
    margin: 0 0 var(--space-3);
  }
  .dialog p {
    margin: 0 0 var(--space-5);
    font-size: 14px;
    color: var(--color-text-muted);
  }
  .actions {
    display: flex;
    gap: var(--space-3);
  }
  button {
    flex: 1;
    min-height: var(--touch-target);
    border-radius: var(--radius-pill);
    font-weight: 600;
    font-size: 14px;
    transition: opacity 120ms ease-out;
  }
  .cancel {
    background: transparent;
    border: 1px solid var(--color-text-disabled-strong);
    color: var(--color-text);
  }
  .confirm {
    background: var(--color-accent);
    border: none;
    color: var(--color-accent-ink);
  }
  @keyframes enter {
    from {
      opacity: 0;
      transform: translateY(8px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
</style>
