<script lang="ts">
  /**
   * ChatCard (DESIGN §3.4 as amended by §4.9.7 / Concept §8.1.7): one
   * stacked dialog card. Presentational — the route owns the polled data
   * and passes the chat, the resolved counterpart user and the «+N» extra
   * count in as data. No message preview in v1 (§5 performance rationale:
   * one extra request per chat per poll is too heavy on venue Wi-Fi).
   * Cards are <a>-wrapped list items with full accessible names:
   * «Диалог с {name} · {phase} · {scenario}». Per §8.1.7 every card gets
   * the BRIGHT §7.1.2 color coding: the counterpart's code hue tint
   * (`--color-bubble-<hue>` via codeHue(counterpartAddress)) as the card
   * background — the same 18% tint pairing the dialog bubbles use, so
   * --color-text on it is AA ≥4.5:1 (tests/bubble-contrast.test.ts).
   * Muted-gray text is bumped to --color-text on the tint (the muted
   * gray only measures ≈3.9:1 there), and outline-muted chips follow —
   * text --color-text, border --color-text-muted (≈3.9:1 ≥3:1 non-text).
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
  // §4.9.7: the card wears the counterpart's hue; a missing counterpart
  // address (degenerate 0-participant case) keeps the neutral surface.
  const hueClass = $derived(
    counterpartAddress === null ? '' : `code-${codeHue(counterpartAddress)}`
  );
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
  /* Bright §7.1.2 color coding (§4.9.7): the counterpart's hue tint as the
   * card background — the same --color-bubble-* pairing as the dialog
   * bubbles (18% over the surface). Declared after the base so the hue
   * wins. */
  .chat-card.code-yellow {
    background: var(--color-bubble-yellow);
  }
  .chat-card.code-orange {
    background: var(--color-bubble-orange);
  }
  .chat-card.code-blue {
    background: var(--color-bubble-blue);
  }
  .chat-card.code-violet {
    background: var(--color-bubble-violet);
  }
  /* AA on the tint: --color-text-muted only measures ≈3.9:1 on the 18%
   * hues — secondary card text bumps to --color-text (≥10:1). */
  .chat-card.code-yellow .extra,
  .chat-card.code-yellow .time,
  .chat-card.code-orange .extra,
  .chat-card.code-orange .time,
  .chat-card.code-blue .extra,
  .chat-card.code-blue .time,
  .chat-card.code-violet .extra,
  .chat-card.code-violet .time {
    color: var(--color-text);
  }
  /* Chips stay legible on the tint: text to --color-text, border up to
   * --color-text-muted (≈3.9:1 — WCAG 1.4.11 non-text ≥3:1). */
  .chat-card.code-yellow :global(.chip.outline-muted),
  .chat-card.code-orange :global(.chip.outline-muted),
  .chat-card.code-blue :global(.chip.outline-muted),
  .chat-card.code-violet :global(.chip.outline-muted) {
    color: var(--color-text);
    border-color: var(--color-text-muted);
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
