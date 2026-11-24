<script lang="ts">
  /**
   * Member drill-down sheet (DESIGN rev. 4 §3.7.2 region 1 bullet): the
   * host observes one member's dialogs read with the ROOM token. ALL data
   * arrives as props — the listing fetch is ON-DEMAND from the page (the
   * room-token `GET /api/room/{room}/user/{address}/chat` real listing,
   * never polled).
   *
   * Each dialog row links to the read-only /chats/{address} transcript
   * (host viewer context) and carries per-record-labelled inline actions:
   * «Очистить историю» (confirm copy «История диалога участников будет
   * очищена.») → `DELETE /api/chat/{address}/message` (room token) and
   * «Запустить заново» (the §3.5 kickoff confirm copy) → `POST
   * /api/chat/{address}/kickoff` (room token; the KickoffResponse speaker
   * renders as the transient speaker line). Kickoff is per-dialog only —
   * no room-level batch restart exists in the contract and none is faked.
   *
   * RULE-D locked row (TZ §9.4.1-d): at the bottom of the sheet, where
   * member deletion will live after the backend amendment, a
   * NON-INTERACTIVE locked row renders — muted lock glyph +
   * «Удаление участника появится вместе с серверным обновлением.»,
   * `aria-disabled="true"`, NO click handler, and no `deleteRoomUser`
   * call anywhere in host code.
   *
   * Legacy note: `chats === null` with `loading === false` renders the
   * retired 6.9a hint state — only the pre-rework entry console passes
   * that shape; the panel always passes `loading` or a real array.
   * NO handshake counts anywhere (rule B).
   */
  import { resolve } from '$app/paths';
  import { tick } from 'svelte';
  import type { User } from '@bleak/api-client';
  import { locale, translate } from '#lib/i18n/locale';
  import PixelAvatar from '#lib/components/PixelAvatar.svelte';
  import Chip from '#lib/components/Chip.svelte';
  import PixelIcon from '#lib/components/icons/PixelIcon.svelte';
  import ConfirmDialog from '#lib/components/ConfirmDialog.svelte';
  import SkeletonBlock from '#lib/components/SkeletonBlock.svelte';

  /** A discovered dialog row (chat address + verbatim phase/scenario). */
  export interface DrillDialog {
    address: string;
    phase: string;
    scenario: string;
  }

  interface Props {
    member: User | null;
    /** The room-token listing (null = not loaded / legacy entry console). */
    chats: DrillDialog[] | null;
    /** True while the page fetches the listing (skeleton rows). */
    loading?: boolean;
    error: 'network' | 'api' | null;
    errorMessage: string | null;
    /** Transient KickoffResponse speaker line (resolved name; null = idle). */
    kickoffSpeaker?: string | null;
    onretry?: () => void;
    onclose?: () => void;
    onclear?: (chatAddress: string) => void;
    onkickoff?: (chatAddress: string) => void;
  }

  let {
    member,
    chats = null,
    loading = false,
    error = null,
    errorMessage = null,
    kickoffSpeaker = null,
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
  const legacyHint = $derived(translate($locale, 'host.drill.pending_amendment'));
  const lockedCopy = $derived(translate($locale, 'host.drill.delete_member_locked'));
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

  function clearAria(chat: string): string {
    return translate($locale, 'host.drill.clear_aria', { chat });
  }

  function restartAria(chat: string): string {
    return translate($locale, 'host.drill.restart_aria', { chat });
  }

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
    {:else if loading}
      <!-- On-demand listing in flight — the sheet is NEVER polled. -->
      <ul class="dialogs" aria-hidden="true">
        {#each [0, 1] as skeleton (skeleton)}
          <li class="dialog-row">
            <SkeletonBlock width="60%" height="16px" />
            <SkeletonBlock width="40%" height="16px" />
          </li>
        {/each}
      </ul>
    {:else if chats === null}
      <!-- Legacy pre-rework entry-console state (never the panel). -->
      <p class="empty">{emptyCopy}</p>
      <p class="hint">{legacyHint}</p>
    {:else}
      <h3>{dialogsTitle}</h3>
      {#if chats.length === 0}
        <!-- CONFIRM-LF: the real room-token listing came back empty. -->
        <p class="empty">{emptyCopy}</p>
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
                  aria-label={clearAria(chat.address)}
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
                  aria-label={restartAria(chat.address)}
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
      {#if kickoffSpeaker}
        <!-- KickoffResponse speaker: the dialog restarts with this speaker. -->
        <p class="kickoff-note" aria-live="polite">{kickoffSpeaker}</p>
      {/if}
    {/if}

    <!-- Rule-D locked row: non-interactive, aria-disabled, no click
         handler — member deletion arrives with a server amendment. -->
    <div class="locked-row" aria-disabled="true">
      <PixelIcon name="lock" size={16} />
      <span>{lockedCopy}</span>
    </div>
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
  .kickoff-note {
    margin: 0;
    font-size: 14px;
    color: var(--color-accent);
  }
  .locked-row {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-3);
    border-top: 1px solid var(--color-text-disabled);
    color: var(--color-text-muted);
    font-size: 14px;
  }
  .locked-row :global(svg) {
    flex: none;
    color: var(--color-text-muted);
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
