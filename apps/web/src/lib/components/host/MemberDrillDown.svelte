<script lang="ts">
  /**
   * Member drill-down sheet (DESIGN §3.7 item 5): the host observes one
   * member's handshake counts (sent/received split by `from_address`
   * direction — computed by the page via hostLogic.handshakeCounts) and
   * their dialogs. ALL data arrives as props — the fetches are ON-DEMAND
   * from the page (never polled). Focus-trapped bottom sheet, Escape
   * closes (same pattern as the kit's HandshakeSheet).
   */
  import { resolve } from '$app/paths';
  import { tick } from 'svelte';
  import type { Chat, User } from '@bleak/api-client';
  import { locale, translate } from '#lib/i18n/locale';
  import PixelAvatar from '#lib/components/PixelAvatar.svelte';
  import Chip from '#lib/components/Chip.svelte';
  import PixelIcon from '#lib/components/icons/PixelIcon.svelte';

  interface Props {
    member: User | null;
    counts: { sent: number; received: number } | null;
    chats: Chat[] | null;
    error: 'network' | 'api' | null;
    errorMessage: string | null;
    onretry?: () => void;
    onclose?: () => void;
  }

  let { member, counts = null, chats = null, error = null, errorMessage = null, onretry, onclose }: Props =
    $props();

  let sheetEl: HTMLElement | null = $state(null);

  const closeLabel = $derived(translate($locale, 'common.close'));
  const sentLabel = $derived.by(() =>
    member ? translate($locale, 'host.drill.sent', { n: String(counts?.sent ?? 0) }) : ''
  );
  const receivedLabel = $derived.by(() =>
    member ? translate($locale, 'host.drill.received', { n: String(counts?.received ?? 0) }) : ''
  );
  const dialogsTitle = $derived(translate($locale, 'host.drill.dialogs'));
  const noDialogs = $derived(translate($locale, 'host.drill.no_dialogs'));
  const loadingLabel = $derived(translate($locale, 'common.loading'));
  const retryLabel = $derived(translate($locale, 'common.retry'));
  const networkErrorText = $derived(translate($locale, 'common.error.network'));
  const apiErrorTitle = $derived(translate($locale, 'common.error.api'));

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
    {:else if counts === null || chats === null}
      <p class="loading" role="status">{loadingLabel}</p>
    {:else}
      <div class="counts">
        <span class="count">{sentLabel}</span>
        <span class="count">{receivedLabel}</span>
      </div>

      <h3>{dialogsTitle}</h3>
      {#if chats.length === 0}
        <p class="empty">{noDialogs}</p>
      {:else}
        <ul class="dialogs">
          {#each chats as chat (chat.address)}
            <li>
              <a href={resolve('/chats/[address]', { address: chat.address })}>
                <Chip variant="outline-muted">{chat.phase}</Chip>
                <span class="chat-address">{chat.address}</span>
              </a>
            </li>
          {/each}
        </ul>
      {/if}
    {/if}
  </div>
{/if}

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
  .counts {
    display: flex;
    gap: var(--space-4);
  }
  .count {
    font-size: 14px;
    color: var(--color-text);
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
  .dialogs {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  .dialogs a {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    min-height: var(--touch-target);
    padding: var(--space-2) var(--space-3);
    background: var(--color-surface-elevated);
    border-radius: var(--radius-md);
    text-decoration: none;
  }
  .chat-address {
    font-size: 14px;
    color: var(--color-text-muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
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
  .loading {
    margin: 0;
    font-size: 14px;
    color: var(--color-text-muted);
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
