<script lang="ts">
  /**
   * PersonCard (DESIGN §3.3; reworked §4.15.4.3, Concept §19.3): one stacked
   * attendee card. Presentational — the route owns the API call and passes
   * relationship state (pure module lib/room/relationships.ts), pending/
   * error flags and per-state callbacks in as data.
   *
   * v3.6 item rework: the right icon (chat-open / handshake-form toggle) is
   * REMOVED — the handshake-back panel is driven purely by the route's
   * `expanded` flag (the FIRST card of the sorted list auto-opens on mount,
   * §4.15.4.3). The «+» direct-send stays for untouched cards (state none).
   * The "chatting" badge is replaced by an "Open chat" button navigating to
   * the existing dialog.
   *
   * §4.15.4.3 addendum (Concept §19.3): the removed icon's toggle role moves
   * to the card itself — for an "added you" (incoming) card the whole row is
   * the tap target: tapping it fires `ontoggle` and the route opens/collapses
   * the Handshake!/Dismiss form for THAT user (single-expanded pattern).
   * Non-incoming rows are not tap targets.
   */
  import { resolve } from '$app/paths';
  import type { User } from '@bleak/api-client';
  import type { Relationship } from '#lib/room/relationships';
  import { locale, translate } from '#lib/i18n/locale';
  import { relativeTime } from '#lib/people/view';
  import PixelAvatar from '#lib/components/PixelAvatar.svelte';
  import Chip from '#lib/components/Chip.svelte';
  import PixelIcon from '#lib/components/icons/PixelIcon.svelte';

  interface Props {
    user: User;
    relationship: Relationship | null;
    /** Incoming card expanded in place («Привет!» + «Закрыть»). */
    expanded?: boolean;
    /** POST in flight for this card (spinner, double-submit guard). */
    sending?: boolean;
    /**
     * Inline per-card action error. `income` is the §2.9 income-rule state
     * (403 on the «+» send): the card stays in the "none" state, announced
     * aria-live="polite" below the name line.
     */
    error?: 'network' | 'api' | 'income' | null;
    errorMessage?: string | null;
    onsend?: () => void;
    onback?: () => void;
    ondismiss?: () => void;
    /** Tap on an incoming row (§4.15.4.3 addendum): toggle the form. */
    ontoggle?: () => void;
  }

  let {
    user,
    relationship,
    expanded = false,
    sending = false,
    error = null,
    errorMessage = null,
    onsend,
    onback,
    ondismiss,
    ontoggle
  }: Props = $props();

  const state = $derived(relationship?.state ?? 'none');
  const incoming = $derived(state === 'incoming');

  const sendLabel = $derived(translate($locale, 'people.action.send', { name: user.name }));
  const backLabel = $derived(translate($locale, 'people.action.back'));
  const openChatLabel = $derived(translate($locale, 'people.action.open_chat'));
  const dismissLabel = $derived(translate($locale, 'people.dismiss'));
  const sentLabel = $derived(translate($locale, 'hs.sent'));
  const addedYouLabel = $derived(translate($locale, 'hs.added_you'));
  const networkErrorText = $derived(translate($locale, 'hs.error.network'));
  const incomeErrorText = $derived(translate($locale, 'hs.income_limit'));
  const apiErrorTitle = $derived(translate($locale, 'common.error.api'));

  // §4.15.4.3: the "chatting" badge is gone — the chat state carries no
  // pill; it renders the "Open chat" button instead.
  const pill = $derived(
    state === 'incoming'
      ? { text: addedYouLabel, variant: 'fill-accent' as const }
      : state === 'outgoing'
        ? { text: sentLabel, variant: 'outline-muted' as const }
        : null
  );

  const timeIso = $derived(
    state === 'chat'
      ? (relationship?.chatAt ?? null)
      : state === 'incoming'
        ? (relationship?.incomingAt ?? null)
        : state === 'outgoing'
          ? (relationship?.outgoingAt ?? null)
          : user.created_at
  );
  const time = $derived(
    timeIso === null ? '' : relativeTime(timeIso, Date.now(), $locale)
  );

  const chatAddress = $derived(relationship?.chatAddress ?? null);

  // §4.15.4.3 addendum: Enter/Space activates the incoming row's tap toggle
  // (the row is a role="button" tap target only for the incoming state).
  function onRowKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      ontoggle?.();
    }
  }
</script>

<li class="person-card pixel-corners" class:expanded>
  {#snippet rowBody()}
    <PixelAvatar address={user.address} size={56} label={user.name} />
    <div class="main">
      <p class="name">{user.name}</p>
      {#if user.public_bio}
        <p class="bio">{user.public_bio}</p>
      {/if}
    </div>
    <div class="meta">
      {#if state === 'chat'}
        <!-- §4.15.4.3: the "chatting" badge is replaced by the Open-chat
             button (navigates the way the removed icon did). -->
        <a
          class="open-chat"
          href={chatAddress
            ? resolve('/chats/[address]', { address: chatAddress })
            : resolve('/chats')}
        >
          {openChatLabel}
        </a>
      {:else if pill}
        <Chip variant={pill.variant}>{pill.text}</Chip>
      {/if}
      {#if time}
        <!-- time is decoration: title fallback, hidden from AT (§3.3 a11y) -->
        <span class="time" title={time} aria-hidden="true">{time}</span>
      {/if}
    </div>
    {#if state === 'none'}
      <!-- The only remaining right-edge icon: the direct «+» send (§3.3).
           The chat-open / handshake-form toggle icon is REMOVED (v3.6). -->
      <div class="action">
        <button
          type="button"
          class="icon-button"
          aria-label={sendLabel}
          disabled={sending}
          onclick={() => onsend?.()}
        >
          <PixelIcon name="plus" size={16} />
        </button>
      </div>
    {/if}
  {/snippet}
  <!-- §4.15.4.3 addendum: an incoming ("added you") row is the tap target
       that toggles the Handshake!/Dismiss form (the removed right icon's
       role); non-incoming rows stay inert (no tap behavior added). -->
  {#if incoming}
    <div
      class="row tappable"
      role="button"
      tabindex={0}
      aria-expanded={expanded}
      onclick={() => ontoggle?.()}
      onkeydown={onRowKeydown}
    >
      {@render rowBody()}
    </div>
  {:else}
    <div class="row">
      {@render rowBody()}
    </div>
  {/if}

  {#if expanded && incoming}
    <div class="expanded-actions">
      <button type="button" class="back" disabled={sending} onclick={() => onback?.()}>
        {backLabel}
      </button>
      <!-- Dismiss (ruling 2): local collapse ONLY — no server call exists. -->
      <button type="button" class="dismiss" onclick={() => ondismiss?.()}>
        {dismissLabel}
      </button>
    </div>
  {/if}
  {#if error}
    <p class="error" role="alert" aria-live="polite">
      {#if error === 'income'}
        {incomeErrorText}
        {#if errorMessage}<span class="server-text"> — {errorMessage}</span>{/if}
      {:else if error === 'api'}
        {apiErrorTitle}{errorMessage ? ` — ${errorMessage}` : ''}
      {:else}
        {networkErrorText}
      {/if}
    </p>
  {/if}
</li>

<style>
  .person-card {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    background: var(--color-surface);
    border-radius: var(--radius-md);
    padding: var(--space-4);
    min-width: 0;
  }
  .row {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    min-width: 0;
  }
  /* §4.15.4.3 addendum: the incoming row is the form's tap target. */
  .row.tappable {
    cursor: pointer;
    border-radius: var(--radius-sm);
    transition: opacity 120ms ease-out;
  }
  .row.tappable:active {
    opacity: 0.85;
  }
  .row.tappable:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: 2px;
  }
  .main {
    flex: 1;
    min-width: 0;
  }
  .name {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: var(--color-text);
  }
  .bio {
    margin: 2px 0 0;
    font-size: 14px;
    color: var(--color-text-muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .meta {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: var(--space-1);
    flex-shrink: 0;
  }
  .time {
    font-size: 14px;
    color: var(--color-text-muted);
  }
  .action {
    flex-shrink: 0;
    display: flex;
  }
  .icon-button {
    width: var(--touch-target);
    height: var(--touch-target);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    color: var(--color-text-muted);
    border-radius: var(--radius-pill);
    text-decoration: none;
    transition:
      color 120ms ease-out,
      transform 120ms ease-out;
  }
  .icon-button:hover,
  .icon-button:focus-visible {
    color: var(--color-accent);
  }
  .icon-button:disabled {
    color: var(--color-text-disabled);
  }
  .open-chat {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: var(--touch-target);
    padding: 0 var(--space-3);
    background: transparent;
    border: 1px solid var(--color-accent);
    color: var(--color-accent);
    border-radius: var(--radius-pill);
    font-size: 13px;
    font-weight: 600;
    text-decoration: none;
    white-space: nowrap;
    transition: opacity 120ms ease-out;
  }
  .open-chat:hover,
  .open-chat:focus-visible {
    opacity: 0.85;
  }
  .expanded-actions {
    display: flex;
    gap: var(--space-3);
  }
  .expanded-actions button {
    flex: 1;
    min-height: var(--touch-target);
    border-radius: var(--radius-pill);
    font-size: 14px;
    font-weight: 600;
    transition: opacity 120ms ease-out;
  }
  .back {
    background: var(--color-accent);
    border: none;
    color: var(--color-accent-ink);
  }
  .back:disabled {
    opacity: 0.6;
  }
  .dismiss {
    background: transparent;
    border: 1px solid var(--color-text-disabled-strong);
    color: var(--color-text);
  }
  .error {
    margin: 0;
    font-size: 14px;
    color: var(--color-text-muted);
  }
  .error .server-text {
    color: var(--color-text-disabled-strong);
    font-size: 14px;
  }
</style>
