<script lang="ts">
  /**
   * ChatCard (DESIGN §3.4 as amended by §4.11.5–7 / Concept §10.1.5–7): one
   * stacked dialog card. Presentational — the route owns the polled data
   * and passes the chat, the resolved counterpart user and the «+N» extra
   * count in as data.
   *
   * v2.4 list item (§4.11.5–7): the dialog-theme chips (phase/scenario) are
   * REMOVED. Under the name the card shows the LAST-MESSAGE PREVIEW — the
   * last message of the counterpart dialog (the route fetches each listed
   * chat's transcript per the owner's 2026-11-18 frontend-only decision and
   * feeds it in via `lastMessage`), rendered muted (with opacity) against
   * the card text and truncated with a single-line CSS ellipsis («…» via
   * `text-overflow: ellipsis`) when it overflows — plus the TIME OF THE
   * LAST MESSAGE (absolute hh:mm, §4.9.8 form). Until the transcript is
   * fetched the card shows without a preview (no placeholder spinner).
   * The right side now carries the STATUS ICON (§4.11.7): ACTIVE → a
   * loading-style glyph; FINISHED → the red reminder mark on the danger
   * token. With no backend lifecycle signal every chat derives 'active'
   * (see `chatStatus` — the gap is recorded there); `status` exists as a
   * presentation-level override so the finished state slots in without
   * structural change once the signal exists. The accessible name drops
   * the removed theme words and carries the status instead.
   *
   * Per Concept §9.1.5 / DESIGN §4.11.5 every card keeps the bright Deepa
   * color coding derived deterministically from the INTERLOCUTOR'S user
   * id: the counterpart's hue as the FULL-OPACITY card background
   * (`--color-deepa-<n>` via codeHue(counterpartAddress) — the
   * `fnv1a(address) % 5` contract, pinned by tests); text on the card
   * pairs with the hue's ink token (`--color-deepa-ink-<n>` — AA ≥4.5:1,
   * tests/bubble-contrast.test.ts). A missing counterpart address
   * (degenerate 0-participant case) keeps the neutral surface.
   */
  import { resolve } from '$app/paths';
  import type { Chat, User } from '@bleak/api-client';
  import { locale, translate } from '#lib/i18n/locale';
  import { messageTime, chatStatus, type ChatStatus } from '#lib/chats/view';
  import type { LastMessageEntry } from '#lib/stores/lastMessage';
  import { codeHue } from '#lib/avatar/traits';
  import PixelAvatar from '#lib/components/PixelAvatar.svelte';
  import PixelIcon from '#lib/components/icons/PixelIcon.svelte';

  interface Props {
    chat: Chat;
    /** Resolved counterpart record (null → raw address shown). */
    counterpart: User | null;
    /** Counterpart address (avatar seed + §4.11.5 hue derivation). */
    counterpartAddress: string | null;
    /** Participants beyond me + the first counterpart («+N»). */
    extra?: number;
    /** Cached last message of the dialog (null → no preview row yet). */
    lastMessage?: LastMessageEntry | null;
    /** Status override (presentation-level; default: derived from chat). */
    status?: ChatStatus;
  }

  let {
    chat,
    counterpart,
    counterpartAddress,
    extra = 0,
    lastMessage = null,
    status
  }: Props = $props();

  const name = $derived(counterpart?.name ?? counterpartAddress ?? chat.address);
  const state = $derived(status ?? chatStatus(chat));
  // §4.11.6: the last message's time (absolute hh:mm) lives in the preview
  // line — the right-side relative card time is retired with it.
  const time = $derived(lastMessage ? messageTime(lastMessage.created_at, $locale) : '');
  // §4.10.5/§4.11.5: the card wears the counterpart's Deepa hue derived
  // from the interlocutor's user id; a missing counterpart address
  // (degenerate 0-participant case) keeps the neutral surface. The hue
  // string IS the class name (deepa-1…deepa-5).
  const hueClass = $derived(counterpartAddress === null ? '' : codeHue(counterpartAddress));
  const statusLabel = $derived(
    translate($locale, state === 'finished' ? 'chats.status.finished' : 'chats.status.active')
  );
  const aria = $derived(
    translate($locale, 'chats.card.aria', { name, status: statusLabel })
  );
</script>

<li class="chat-item">
  <a
    class="chat-card pixel-corners {hueClass}"
    href={resolve('/chats/[address]', { address: chat.address })}
    aria-label={aria}
  >
    <PixelAvatar address={counterpartAddress ?? ''} size={56} label={name} />
    <div class="main">
      <p class="name">{name}</p>
      {#if lastMessage}
        <p class="preview-line">
          <span class="time" aria-hidden="true">{time}</span>
          <!-- §4.11.6: muted preview, single-line CSS ellipsis truncation -->
          <span class="preview" title={lastMessage.content}>{lastMessage.content}</span>
        </p>
      {/if}
      {#if extra > 0}
        <span class="extra">+{extra}</span>
      {/if}
    </div>
    <!-- status icon is decoration: the accessible name carries the status
         (§4.11.7; the aria-hidden pattern matches the retired time) -->
    <span
      class="status {state}"
      aria-hidden="true"
      title={statusLabel}
    >
      <PixelIcon name={state === 'finished' ? 'status-finished' : 'status-active'} size={16} />
    </span>
  </a>
</li>

<style>
  .chat-item {
    list-style: none;
  }
  .chat-card {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-4);
    background: var(--color-surface);
    border-radius: var(--radius-md);
    color: var(--color-text);
    transition: opacity 120ms ease-out;
  }
  .chat-card:active {
    opacity: 0.8;
  }
  /* Bright Deepa color coding (§4.11.5): the counterpart's hue as the
   * FULL-OPACITY card background, with the hue's ink token as the text
   * color (name inherits it). Declared after the base so the hue wins. */
  .chat-card.deepa-1 {
    background: var(--color-deepa-1);
    color: var(--color-deepa-ink-1);
  }
  .chat-card.deepa-2 {
    background: var(--color-deepa-2);
    color: var(--color-deepa-ink-2);
  }
  .chat-card.deepa-3 {
    background: var(--color-deepa-3);
    color: var(--color-deepa-ink-3);
  }
  .chat-card.deepa-4 {
    background: var(--color-deepa-4);
    color: var(--color-deepa-ink-4);
  }
  .chat-card.deepa-5 {
    background: var(--color-deepa-5);
    color: var(--color-deepa-ink-5);
  }
  .main {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  .name {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  /* §4.11.6: the preview line — muted (opacity against the card text) and
   * truncated with a single-line ellipsis when it overflows the block. */
  .preview-line {
    margin: 0;
    display: flex;
    align-items: baseline;
    gap: var(--space-2);
    min-width: 0;
    font-size: 14px;
    opacity: 0.75;
  }
  .preview-line .preview {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .extra {
    font-size: 14px;
    color: var(--color-text-muted);
  }
  .chat-card.deepa-1 .extra,
  .chat-card.deepa-2 .extra,
  .chat-card.deepa-3 .extra,
  .chat-card.deepa-4 .extra,
  .chat-card.deepa-5 .extra {
    color: inherit;
  }
  /* §4.11.7: the status icon replaces the right-side time. The finished
   * reminder mark takes the danger token; the active loading glyph keeps
   * the card's ink pairing (currentColor). */
  .status {
    flex-shrink: 0;
    display: inline-flex;
  }
  .status.finished {
    color: var(--color-danger);
  }
</style>
