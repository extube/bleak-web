<script lang="ts">
  /**
   * QrScanner placeholder (TZ-02 §6): the FINAL public API of the real
   * scanner (TZ-04 replaces this body in place — same file, same props).
   * No camera logic here; renders a static panel and wires the
   * open/close callbacks so TZ-03/TZ-05 compile and integrate against the
   * contract now.
   *
   * Public API (binding for TZ-04):
   *   open            — bindable; the overlay renders when true
   *   context         — 'invite' (join flow) | 'persona' (scan-a-person)
   *   members         — current room member list (persona-context checks)
   *   onInviteCode    — invite QR resolved: 6-digit code, exactly as typed
   *   onPersonaScanned— persona QR resolved: the scanned user address
   *   onClosed        — overlay closed (X / Escape / fallback)
   */
  import { tick } from 'svelte';
  import type { User } from '@bleak/api-client';
  import { locale, translate } from '#lib/i18n/locale';
  import PixelIcon from './icons/PixelIcon.svelte';

  interface Props {
    open?: boolean;
    context?: 'invite' | 'persona';
    members?: readonly User[];
    onInviteCode?: (code: string) => void;
    onPersonaScanned?: (userAddress: string) => void;
    onClosed?: () => void;
  }

  let { open = $bindable(false), context = 'invite', onClosed }: Props = $props();

  let panelEl: HTMLElement | null = $state(null);

  const titleLabel = $derived(translate($locale, 'scan.title'));
  const closeLabel = $derived(translate($locale, 'scan.close'));
  const closeText = $derived(translate($locale, 'common.close'));
  const placeholderText = $derived(translate($locale, 'scan.placeholder'));
  const scannerLabel = $derived(translate($locale, 'scan.aria'));
  const hintText = $derived(
    translate($locale, context === 'invite' ? 'scan.hint.join' : 'scan.hint.person')
  );

  $effect(() => {
    if (open) {
      void tick().then(() => panelEl?.focus());
      return () => {
        // cleanup hook kept for TZ-04 (camera lifecycle binds here)
      };
    }
  });

  function close(): void {
    open = false;
    onClosed?.();
  }

  function overlayKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
    }
  }
</script>

{#if open}
  <div class="overlay" role="dialog" aria-modal="true" aria-label={scannerLabel} tabindex="-1" onkeydown={overlayKeydown}>
    <header class="top-bar pixel-corners">
      <button type="button" class="close" aria-label={closeLabel} onclick={close}>
        <PixelIcon name="close" size={16} />
      </button>
      <h2>{titleLabel}</h2>
    </header>
    <div class="panel">
      <div class="panel-card pixel-corners" tabindex="-1" bind:this={panelEl}>
        <PixelIcon name="scan" size={16} />
        <p>{placeholderText}</p>
        <p class="hint">{hintText}</p>
        <button type="button" class="fallback" onclick={close}>{closeText}</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .overlay {
    position: fixed;
    inset: 0;
    background: var(--color-bg);
    z-index: 50;
    display: flex;
    flex-direction: column;
  }
  .top-bar {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    min-height: 56px;
    padding: 0 var(--space-3);
    background: var(--color-surface);
  }
  .top-bar h2 {
    font-size: 24px;
    margin: 0;
  }
  .close {
    width: var(--touch-target);
    height: var(--touch-target);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    color: var(--color-text-muted);
    border-radius: var(--radius-pill);
    transition: color 120ms ease-out;
  }
  .panel {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--space-5);
  }
  .panel-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-3);
    background: var(--color-surface);
    border-radius: var(--radius-lg);
    padding: var(--space-5);
    max-width: 320px;
    text-align: center;
    color: var(--color-text-muted);
  }
  .panel-card p {
    margin: 0;
    font-size: 14px;
  }
  .panel-card .hint {
    color: var(--color-text-disabled-strong);
  }
  .fallback {
    min-height: var(--touch-target);
    border: 1px solid var(--color-text-disabled-strong);
    background: transparent;
    color: var(--color-text);
    border-radius: var(--radius-pill);
    padding: 0 var(--space-4);
    font-size: 14px;
    font-weight: 600;
  }
</style>
