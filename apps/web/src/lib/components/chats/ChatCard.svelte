<script lang="ts">
  /**
   * ChatCard (DESIGN §3.4): one stacked dialog card. Presentational — the
   * route owns the polled data and passes the chat, the resolved counterpart
   * user and the «+N» extra count in as data. No message preview in v1 (§5
   * performance rationale: one extra request per chat per poll is too heavy
   * on venue Wi-Fi). Cards are <a>-wrapped list items with full accessible
   * names: «Диалог с {name} · {phase} · {scenario}».
   */
  import { resolve } from '$app/paths';
  import type { Chat, User } from '@bleak/api-client';
  import { locale, translate } from '#lib/i18n/locale';
  import { relativeTime } from '#lib/people/view';
  import PixelAvatar from '#lib/components/PixelAvatar.svelte';
  import Chip from '#lib/components/Chip.svelte';

  interface Props {
    chat: Chat;
    /** Resolved counterpart record (null → raw address shown). */
    counterpart: User | null;
    /** Counterpart address (avatar seed). */
    counterpartAddress: string | null;
    /** Participants beyond me + the first counterpart («+N»). */
    extra?: number;
    /** Poll clock — relative time refreshes with each tick (AC 3). */
    now?: number;
  }

  let { chat, counterpart, counterpartAddress, extra = 0, now = Date.now() }: Props = $props();

  const name = $derived(counterpart?.name ?? counterpartAddress ?? chat.address);
  const time = $derived(relativeTime(chat.created_at, now, $locale));
  const aria = $derived(
    translate($locale, 'chats.card.aria', {
      name,
      phase: chat.phase,
      scenario: chat.scenario
    })
  );
</script>

<li class="chat-item">
  <a
    class="chat-card pixel-corners"
    href={resolve('/chats/[address]', { address: chat.address })}
    aria-label={aria}
  >
    <PixelAvatar address={counterpartAddress ?? ''} size={56} label={name} />
    <div class="main">
      <p class="name">{name}</p>
      <div class="chips">
        <Chip variant="outline-muted">{chat.phase}</Chip>
        <Chip variant="outline-muted">{chat.scenario}</Chip>
        {#if extra > 0}
          <span class="extra">+{extra}</span>
        {/if}
      </div>
    </div>
    <!-- time is decoration: title fallback, hidden from AT (§3.3 pattern) -->
    <span class="time" title={time} aria-hidden="true">{time}</span>
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
  .chips {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: var(--space-2);
    min-width: 0;
  }
  .chips :global(.chip) {
    max-width: 160px;
  }
  .chips :global(.chip-body) {
    max-width: 150px;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .extra {
    font-size: 14px;
    color: var(--color-text-muted);
  }
  .time {
    flex-shrink: 0;
    font-size: 14px;
    color: var(--color-text-muted);
  }
</style>
