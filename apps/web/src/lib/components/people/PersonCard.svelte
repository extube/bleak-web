<script lang="ts">
  /**
   * PersonCard (DESIGN §3.3): one stacked attendee card. Presentational —
   * the route owns the API call and passes relationship state (pure module
   * lib/room/relationships.ts), pending/error flags and per-state callbacks
   * in as data.
   *
   * Per-state right-edge action (48px):
   *  - none        → «+» sends POST /api/handshake directly (no sheet);
   *  - incoming    → expand toggle: «Ответить хендшейком» + «Закрыть»
   *                  (dismiss = LOCAL collapse only — owner ruling 2; copy
   *                  never implies rejection);
   *  - chat        → ▤ opens the existing dialog;
   *  - outgoing    → no action (waits for the reciprocal handshake).
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
    /** Incoming card expanded in place («Ответить хендшейком» + «Закрыть»). */
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
    ontoggle?: () => void;
    ondismiss?: () => void;
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
    ontoggle,
    ondismiss
  }: Props = $props();

  const state = $derived(relationship?.state ?? 'none');
  const incoming = $derived(state === 'incoming');

  const sendLabel = $derived(translate($locale, 'people.action.send', { name: user.name }));
  const dialogLabel = $derived(translate($locale, 'people.action.dialog', { name: user.name }));
  const expandLabel = $derived(translate($locale, 'people.action.expand', { name: user.name }));
  const collapseLabel = $derived(translate($locale, 'people.action.collapse', { name: user.name }));
  const backLabel = $derived(translate($locale, 'hs.back'));
  const dismissLabel = $derived(translate($locale, 'people.dismiss'));
  const sentLabel = $derived(translate($locale, 'hs.sent'));
  const addedYouLabel = $derived(translate($locale, 'hs.added_you'));
  const chattingLabel = $derived(translate($locale, 'hs.chatting'));
  const networkErrorText = $derived(translate($locale, 'hs.error.network'));
  const incomeErrorText = $derived(translate($locale, 'hs.income_limit'));
  const apiErrorTitle = $derived(translate($locale, 'common.error.api'));

  const pill = $derived(
    state === 'chat'
      ? { text: chattingLabel, variant: 'outline-accent' as const }
      : state === 'incoming'
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
</script>

<li class="person-card pixel-corners" class:expanded>
  <div class="row">
    <PixelAvatar address={user.address} size={56} label={user.name} />
    <div class="main">
      <p class="name">{user.name}</p>
      {#if user.public_bio}
        <p class="bio">{user.public_bio}</p>
      {/if}
    </div>
    <div class="meta">
      {#if pill}
        <Chip variant={pill.variant}>{pill.text}</Chip>
      {/if}
      {#if time}
        <!-- time is decoration: title fallback, hidden from AT (§3.3 a11y) -->
        <span class="time" title={time} aria-hidden="true">{time}</span>
      {/if}
    </div>
    <div class="action">
      {#if state === 'none'}
        <button
          type="button"
          class="icon-button"
          aria-label={sendLabel}
          disabled={sending}
          onclick={() => onsend?.()}
        >
          <PixelIcon name="plus" size={16} />
        </button>
      {:else if incoming}
        <button
          type="button"
          class="icon-button toggle"
          class:open={expanded}
          aria-expanded={expanded}
          aria-label={expanded ? collapseLabel : expandLabel}
          onclick={() => ontoggle?.()}
        >
          <svg
            viewBox="0 0 16 16"
            width={16}
            height={16}
            shape-rendering="crispEdges"
            fill="currentColor"
            aria-hidden="true"
          >
            <rect x="3" y="5" width="2" height="2" />
            <rect x="5" y="7" width="2" height="2" />
            <rect x="7" y="9" width="2" height="2" />
            <rect x="9" y="7" width="2" height="2" />
            <rect x="11" y="5" width="2" height="2" />
          </svg>
        </button>
      {:else if state === 'chat'}
        <a
          class="icon-button"
          href={chatAddress
            ? resolve('/chats/[address]', { address: chatAddress })
            : resolve('/chats')}
          aria-label={dialogLabel}
        >
          <PixelIcon name="dialog-lines" size={16} />
        </a>
      {/if}
    </div>
  </div>

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
  .toggle.open {
    transform: rotate(180deg);
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
