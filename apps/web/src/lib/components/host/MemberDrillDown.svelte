<script lang="ts">
  /**
   * Member drill-down sheet (DESIGN rev. 3 §3.7 item 5): the host observes
   * one member's dialogs read with the ROOM token. ALL data arrives as
   * props — the fetches are ON-DEMAND from the page (never polled).
   *
   * Chat discovery is 6.9a-BLOCKED (the plain room-token chat reads give no
   * room-scoped per-user chat LISTING): until the amendment lands the sheet
   * renders the empty drill-down copy («У участника пока нет диалогов.»)
   * plus the muted flag hint — chat listings are NEVER invented client
   * side. `chats` carries only discoverable chat knowledge (v2: none).
   * Each dialog row links to the read-only /chats/{address} transcript and
   * carries «Очистить историю» (confirm) and «Запустить заново» (§3.5
   * kickoff copy) → page callbacks with the room token. NO handshake
   * counts are shown anywhere (AC 11).
   */
  import { resolve } from '$app/paths';
  import { tick } from 'svelte';
  import type { User } from '@bleak/api-client';
  import { locale, translate } from '#lib/i18n/locale';
  import PixelAvatar from '#lib/components/PixelAvatar.svelte';
  import Chip from '#lib/components/Chip.svelte';
  import PixelIcon from '#lib/components/icons/PixelIcon.svelte';
  import ConfirmDialog from '#lib/components/ConfirmDialog.svelte';

  /** A discoverable dialog row (room + chat address + verbatim chips). */
  export interface DrillDialog {
    address: string;
    phase: string;
    scenario: string;
  }

  interface Props {
    member: User | null;
    /** Discoverable dialogs (null = nothing discoverable yet, 6.9a). */
    chats: DrillDialog[] | null;
    error: 'network' | 'api' | null;
    errorMessage: string | null;
    onretry?: () => void;
    onclose?: () => void;
    onclear?: (chatAddress: string) => void;
    onkickoff?: (chatAddress: string) => void;
  }

  let {
    member,
    chats = null,
    error = null,
    errorMessage = null,
    onretry,
    onclose,
    onclear,
    onkickoff
  }: Props = $props();

  let sheetEl: HTMLElement | null = $state(null);
  let clearOpen = $state(false);
  let clearTarget = $state<string | null>(null);
  let kickoffOpen = $state(false);
  let kickoffTarget = $state<string | null>(null);

  const closeLabel = $derived(translate($locale, 'common.close'));
  const dialogsTitle = $derived(translate($locale, 'host.drill.dialogs'));
  const emptyCopy = $derived(translate($locale, 'host.drill.empty'));
  const amendmentHint = $derived(translate($locale, 'host.drill.pending_amendment'));
  const retryLabel = $derived(translate($locale, 'common.retry'));
  const networkErrorText = $derived(translate($locale, 'common.error.network'));
  const apiErrorTitle = $derived(translate($locale, 'common.error.api'));
  const clearLabel = $derived(translate($locale, 'host.drill.clear'));
  const clearConfirm = $derived(translate($locale, 'host.drill.clear_confirm'));
  const kickoffLabel = $derived(translate($locale, 'host.drill.kickoff'));
  const kickoffTitle = $derived(translate($locale, 'chat.kickoff.confirm_title'));
  const kickoffBody = $derived(translate($locale, 'chat.kickoff.confirm_body'));
  const kickoffRun = $derived(translate($locale, 'chat.kickoff.confirm_run'));
  const cancelLabel = $derived(translate($locale, 'common.cancel'));

  $effect(() => {
    if (member) {
      void tick().then(() => sheetEl?.querySelector<HTMLElement>('button, a[href]')?.focus());
    }
  });

  function close(): void {
    onclose?.();
  }

  function sheetKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
    } else if (event.key === 'Tab' && sheetEl) {
      const focusables = Array.from(sheetEl.querySelectorAll<HTMLElement>('button, a[href]')).filter(
        (el) => !el.hasAttribute('disabled')
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  }
</script>

<svelte:window onkeydown={(event) => (member ? sheetKeydown(event) : undefined)} />

{#if member}
  <div class="scrim" aria-hidden="true"></div>
  <div
    class="sheet pixel-corners"
    role="dialog"
    aria-modal="true"
    aria-label={member.name}
    tabindex="-1"
    bind:this={sheetEl}
  >
    <button type="button" class="close" aria-label={closeLabel} onclick={close}>
      <PixelIcon name="close" size={16} />
    </button>

    <div class="identity">
      <PixelAvatar address={member.address} size={56} label={member.name} />
      <div class="texts">
        <h2>{member.name}</h2>
        {#if member.public_bio}
          <p class="bio">{member.public_bio}</p>
        {/if}
      </div>
    </div>

    {#if error}
      <p class="error" role="alert">
        {error === 'network' ? networkErrorText : `${apiErrorTitle}${errorMessage ? ` — ${errorMessage}` : ''}`}
      </p>
      <button type="button" class="retry" onclick={() => onretry?.()}>{retryLabel}</button>
    {:else if chats === null}
      <!-- 6.9a-blocked discovery: the honest empty state + the muted flag
           hint — no invented listings (§3.7). -->
      <p class="empty">{emptyCopy}</p>
      <p class="hint">{amendmentHint}</p>
    {:else}
      <h3>{dialogsTitle}</h3>
      {#if chats.length === 0}
        <p class="empty">{emptyCopy}</p>
        <p class="hint">{amendmentHint}</p>
      {:else}
        <ul class="dialogs">
          {#each chats as chat (chat.address)}
            <li class="dialog-row">
              <a href={resolve('/chats/[address]', { address: chat.address })}>
                <Chip variant="outline-muted">{chat.phase}</Chip>
                <Chip variant="outline-muted">{chat.scenario}</Chip>
                <span class="chat-address">{chat.address}</span>
              </a>
              <div class="row-actions">
                <button
                  type="button"
                  class="row-action"
                  onclick={() => {
                    clearTarget = chat.address;
                    clearOpen = true;
                  }}
                >
                  {clearLabel}
                </button>
                <button
                  type="button"
                  class="row-action"
                  onclick={() => {
                    kickoffTarget = chat.address;
                    kickoffOpen = true;
                  }}
                >
                  {kickoffLabel}
                </button>
              </div>
            </li>
          {/each}
        </ul>
      {/if}
    {/if}
  </div>
{/if}

<ConfirmDialog
  bind:open={clearOpen}
  title={clearLabel}
  body={clearConfirm}
  confirmLabel={clearLabel}
  cancelLabel={cancelLabel}
  onconfirm={() => {
    if (clearTarget) onclear?.(clearTarget);
    clearTarget = null;
  }}
  oncancel={() => (clearTarget = null)}
/>

<ConfirmDialog
  bind:open={kickoffOpen}
  title={kickoffTitle}
  body={kickoffBody}
  confirmLabel={kickoffRun}
  cancelLabel={cancelLabel}
  onconfirm={() => {
    if (kickoffTarget) onkickoff?.(kickoffTarget);
    kickoffTarget = null;
  }}
  oncancel={() => (kickoffTarget = null)}
/>

<style>
  .scrim {
    position: fixed;
    inset: 0;
    background: var(--color-scrim);
    z-index: 30;
    animation: fade-in 200ms ease-out;
  }
  .sheet {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 31;
    background: var(--color-surface);
    border-radius: var(--radius-lg);
    padding: var(--space-5) var(--space-5) calc(var(--bottom-tabbar-height) + var(--space-4));
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    animation: slide-up 200ms ease-out;
  }
  .close {
    position: absolute;
    top: var(--space-3);
    right: var(--space-3);
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
  .identity {
    display: flex;
    align-items: center;
    gap: var(--space-4);
  }
  .texts h2 {
    font-size: 24px;
    margin: 0;
  }
  .bio {
    margin: 4px 0 0;
    font-size: 14px;
    color: var(--color-text-muted);
  }
  h3 {
    font-family: var(--font-pixel);
    font-size: 24px;
    letter-spacing: 0.04em;
  }
  .empty {
    margin: 0;
    font-size: 14px;
    color: var(--color-text-muted);
  }
  .hint {
    margin: 0;
    font-size: 14px;
    color: var(--color-text-muted);
  }
  .dialogs {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }
  .dialog-row {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    padding: var(--space-3);
    background: var(--color-surface-elevated);
    border-radius: var(--radius-md);
  }
  .dialog-row > a {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    min-height: var(--touch-target);
    text-decoration: none;
  }
  .chat-address {
    font-size: 14px;
    color: var(--color-text-muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .row-actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }
  .row-action {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 40px;
    padding: 0 var(--space-4);
    border: 1px solid var(--color-text-disabled-strong);
    background: transparent;
    color: var(--color-text);
    border-radius: var(--radius-pill);
    font-size: 14px;
    font-weight: 600;
    transition:
      border-color 120ms ease-out,
      color 120ms ease-out;
  }
  .error {
    margin: 0;
    font-size: 14px;
    color: var(--color-text-muted);
  }
  .retry {
    min-height: var(--touch-target);
    border: 1px solid var(--color-text-disabled-strong);
    border-radius: var(--radius-pill);
    background: transparent;
    color: var(--color-text);
    font-weight: 600;
    font-size: 14px;
  }
  @keyframes slide-up {
    from {
      transform: translateY(100%);
    }
    to {
      transform: translateY(0);
    }
  }
  @keyframes fade-in {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }
</style>
