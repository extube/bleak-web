<script lang="ts">
  /**
   * HandshakeSheet (DESIGN §3.2 bottom sheet / §3.3 states): the single
   * source of handshake actions. Pure presentational — the hosting page
   * owns the API call via `onsend` and passes the derived relationship
   * (lib/room/relationships.ts) plus error state back in as data.
   */
  import { resolve } from '$app/paths';
  import { tick } from 'svelte';
  import type { User } from '@bleak/api-client';
  import type { Relationship } from '#lib/room/relationships';
  import { locale, translate } from '#lib/i18n/locale';
  import PixelAvatar from './PixelAvatar.svelte';
  import Chip from './Chip.svelte';
  import PixelIcon from './icons/PixelIcon.svelte';

  interface Props {
    open?: boolean;
    user: User | null;
    relationship?: Relationship | null;
    /** Page-driven POST pending state (spinner, double-submit guard). */
    sending?: boolean;
    /** Inline error recovery: the button returns to its active state. */
    error?: 'network' | 'api' | null;
    errorMessage?: string | null;
    onsend?: () => void;
    onclose?: () => void;
  }

  let {
    open = $bindable(false),
    user,
    relationship = null,
    sending = false,
    error = null,
    errorMessage = null,
    onsend,
    onclose
  }: Props = $props();

  let sheetEl: HTMLElement | null = $state(null);

  const sendLabel = $derived(translate($locale, 'hs.send'));
  const sentLabel = $derived(translate($locale, 'hs.sent'));
  const waitingLabel = $derived(translate($locale, 'hs.waiting'));
  const backLabel = $derived(translate($locale, 'hs.back'));
  const addedYouLabel = $derived(translate($locale, 'hs.added_you'));
  const chattingLabel = $derived(translate($locale, 'hs.chatting'));
  const openDialogLabel = $derived(translate($locale, 'hs.open_dialog'));
  const closeLabel = $derived(translate($locale, 'common.close'));
  const networkErrorText = $derived(translate($locale, 'hs.error.network'));
  const apiErrorTitle = $derived(translate($locale, 'common.error.api'));

  $effect(() => {
    if (open && user) {
      void tick().then(() => sheetEl?.querySelector<HTMLElement>('button, a[href]')?.focus());
    }
  });

  function close(): void {
    open = false;
    onclose?.();
  }

  function sheetKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
    } else if (event.key === 'Tab' && sheetEl) {
      const focusables = Array.from(
        sheetEl.querySelectorAll<HTMLElement>('button, a[href]')
      ).filter((el) => !el.hasAttribute('disabled'));
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

<svelte:window onkeydown={(event) => (open ? sheetKeydown(event) : undefined)} />

{#if open && user}
  <div class="scrim" aria-hidden="true"></div>
  <div
    class="sheet pixel-corners"
    role="dialog"
    aria-modal="true"
    aria-label={user.name}
    tabindex="-1"
    bind:this={sheetEl}
  >
    <button type="button" class="close" aria-label={closeLabel} onclick={close}>
      <PixelIcon name="close" size={16} />
    </button>
    <div class="identity">
      <PixelAvatar address={user.address} size={56} label={user.name} />
      <div class="texts">
        <h2>{user.name}</h2>
        {#if user.public_bio}
          <p class="bio">{user.public_bio}</p>
        {/if}
      </div>
    </div>

    {#if relationship}
      <div class="state-row">
        {#if relationship.state === 'chat'}
          <Chip variant="outline-accent">{chattingLabel}</Chip>
        {:else if relationship.state === 'incoming'}
          <Chip variant="fill-accent">{addedYouLabel}</Chip>
        {:else if relationship.state === 'outgoing'}
          <Chip variant="outline-muted">{sentLabel}</Chip>
        {/if}
      </div>
    {/if}

    {#if error}
      <p class="error" role="alert">
        {error === 'network' ? networkErrorText : `${apiErrorTitle}${errorMessage ? ` — ${errorMessage}` : ''}`}
      </p>
    {/if}

    <div class="actions">
      {#if relationship?.state === 'chat'}
        {#if relationship.chatAddress}
          <a class="cta" href={resolve('/chats/[address]', { address: relationship.chatAddress })}>
            {openDialogLabel}
          </a>
        {:else}
          <a class="cta" href={resolve('/chats')}>{openDialogLabel}</a>
        {/if}
      {:else if relationship?.state === 'incoming'}
        <button type="button" class="cta" disabled={sending} onclick={() => onsend?.()}>
          {backLabel}
        </button>
      {:else if relationship?.state === 'outgoing'}
        <button type="button" class="cta waiting" disabled>{waitingLabel}</button>
      {:else}
        <button type="button" class="cta" disabled={sending} onclick={() => onsend?.()}>
          {sendLabel}
        </button>
      {/if}
    </div>
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
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .state-row {
    display: flex;
  }
  .error {
    margin: 0;
    font-size: 14px;
    color: var(--color-text-muted);
  }
  .actions {
    display: flex;
    flex-direction: column;
  }
  .cta {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: var(--touch-target);
    border-radius: var(--radius-pill);
    font-weight: 600;
    font-size: 16px;
    text-align: center;
  }
  button.cta {
    background: var(--color-accent);
    border: none;
    color: var(--color-accent-ink);
    transition: opacity 120ms ease-out;
  }
  button.cta:disabled {
    opacity: 0.6;
  }
  button.cta.waiting {
    background: transparent;
    border: 1px solid var(--color-text-disabled-strong);
    color: var(--color-text-muted);
  }
  a.cta {
    background: var(--color-accent);
    color: var(--color-accent-ink);
    text-decoration: none;
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
