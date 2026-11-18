<script lang="ts">
  /**
   * ChatCard (DESIGN §3.4 as amended by §4.9.7 / Concept §8.1.7): one
   * stacked dialog card. Presentational — the route owns the polled data
   * and passes the chat, the resolved counterpart user and the «+N» extra
   * count in as data. No message preview in v1 (§5 performance rationale:
   * one extra request per chat per poll is too heavy on venue Wi-Fi).
   * Cards are <a>-wrapped list items with full accessible names:
   * «Диалог с {name} · {phase} · {scenario}». Per Concept §9.1.5 /
   * DESIGN §4.10.5 (supersedes §4.9.7) every card gets the bright Deepa
   * color coding: the counterpart's hue as the FULL-OPACITY card
   * background (`--color-deepa-<n>` via codeHue(counterpartAddress));
   * text on the card pairs with the hue's ink token
   * (`--color-deepa-ink-<n>` — AA ≥4.5:1, tests/bubble-contrast.test.ts):
   * name, time, «+N» extra and the outline-muted chips all switch to the
   * ink pairing (chip borders stay muted-on-hue via the ink). A missing
   * counterpart address (degenerate 0-participant case) keeps the neutral
   * surface.
   */
  import { resolve } from '$app/paths';
  import type { Chat, User } from '@bleak/api-client';
  import { locale, translate } from '#lib/i18n/locale';
  import { relativeTime } from '#lib/people/view';
  import { codeHue } from '#lib/avatar/traits';
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
  // §4.10.5: the card wears the counterpart's Deepa hue; a missing
  // counterpart address (degenerate 0-participant case) keeps the neutral
  // surface. The hue string IS the class name (deepa-1…deepa-5).
  const hueClass = $derived(counterpartAddress === null ? '' : codeHue(counterpartAddress));
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
    class="chat-card pixel-corners {hueClass}"
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
  /* Bright Deepa color coding (§4.10.5): the counterpart's hue as the
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
  /* AA on the full-opacity hue: secondary card text (time, «+N») pairs
   * with the ink token too — no muted gray on a bright hue. */
  .chat-card.deepa-1 .extra,
  .chat-card.deepa-1 .time,
  .chat-card.deepa-2 .extra,
  .chat-card.deepa-2 .time,
  .chat-card.deepa-3 .extra,
  .chat-card.deepa-3 .time,
  .chat-card.deepa-4 .extra,
  .chat-card.deepa-4 .time,
  .chat-card.deepa-5 .extra,
  .chat-card.deepa-5 .time {
    color: inherit;
  }
  /* Chips stay legible on the hue: text AND border pair with the ink
   * token (muted-on-hue via the ink — WCAG 1.4.11 non-text ≥3:1). */
  .chat-card.deepa-1 :global(.chip.outline-muted),
  .chat-card.deepa-2 :global(.chip.outline-muted),
  .chat-card.deepa-3 :global(.chip.outline-muted),
  .chat-card.deepa-4 :global(.chip.outline-muted),
  .chat-card.deepa-5 :global(.chip.outline-muted) {
    color: inherit;
  }
  .chat-card.deepa-1 :global(.chip.outline-muted) {
    border-color: var(--color-deepa-ink-1);
  }
  .chat-card.deepa-2 :global(.chip.outline-muted) {
    border-color: var(--color-deepa-ink-2);
  }
  .chat-card.deepa-3 :global(.chip.outline-muted) {
    border-color: var(--color-deepa-ink-3);
  }
  .chat-card.deepa-4 :global(.chip.outline-muted) {
    border-color: var(--color-deepa-ink-4);
  }
  .chat-card.deepa-5 :global(.chip.outline-muted) {
    border-color: var(--color-deepa-ink-5);
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
