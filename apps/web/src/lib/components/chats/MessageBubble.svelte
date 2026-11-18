<script lang="ts">
  /**
   * MessageBubble (DESIGN §3.5 as amended by Concept §9.1.5 /
   * DESIGN §4.10.5): one transcript entry. mine (my persona is a speaker
   * when agents quote it) right-aligned; theirs left. Only THEIR bubbles
   * carry the speaker's Deepa hue — fnv1a(address) % 5
   * (lib/avatar/traits.ts) → full-opacity `--color-deepa-<n>` background;
   * the bubble text pairs with the hue's ink token
   * (`--color-deepa-ink-<n>`, AA ≥4.5:1 — verified in
   * tests/bubble-contrast.test.ts). OWN bubbles stay muted
   * (--color-surface-elevated with --color-text, unchanged from tz4-06);
   * mine never take MY code hue. Both .pixel-corners, 14px Inter,
   * max-width 80%. Speaker name (11px muted) + absolute time under each
   * bubble. The accessible <li> name is «{speaker}: {first 60 chars}»
   * (route computes it via lib/chats/view.bubbleAriaLabel). Plain text
   * only — pre-wrap.
   */
  import type { Message } from '@bleak/api-client';
  import { codeHue } from '#lib/avatar/traits';

  interface Props {
    message: Message;
    /** `message.from === identity.userAddress` (mine → right). */
    mine: boolean;
    /** Resolved speaker name (raw address fallback). */
    speaker: string;
    /** Absolute time of `created_at`. */
    time: string;
    /** Accessible name: «{speaker}: {first 60 chars}». */
    label: string;
  }

  let { message, mine, speaker, time, label }: Props = $props();

  // §4.10.5: the Deepa hue applies to theirs only; mine stays muted — no
  // `deepa-*` class is emitted for own bubbles at all. The hue string IS
  // the class name (deepa-1…deepa-5).
  const hueClass = $derived(mine ? '' : codeHue(message.from));
</script>

<li class="row" class:mine aria-label={label}>
  <div class="bubble pixel-corners {hueClass}" class:mine class:theirs={!mine}>
    <p class="content">{message.content}</p>
  </div>
  <p class="meta">
    <span class="speaker">{speaker}</span>
    <span class="time" title={time} aria-hidden="true">{time}</span>
  </p>
</li>

<style>
  .row {
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 2px;
    max-width: 80%;
  }
  .row.mine {
    align-self: flex-end;
    align-items: flex-end;
  }
  .row:not(.mine) {
    align-self: flex-start;
    align-items: flex-start;
  }
  .bubble {
    padding: var(--space-3) var(--space-4);
    border-radius: var(--radius-md);
    color: var(--color-text);
  }
  /* Muted own bubbles (§4.9.7, unchanged by §4.10.5): the pre-tz3-02
   * neutral surface tint — NOT a Deepa hue. --color-text on it measures
   * ≈12.3:1 (AA ≥4.5). */
  .bubble.mine {
    background: var(--color-surface-elevated);
  }
  .bubble.theirs {
    background: var(--color-surface);
  }
  /* Deepa-hue override (§4.10.5): only the INTERLOCUTOR'S bubbles carry
   * their speaker's full-opacity hue; text pairs with the hue's ink
   * token. Declared after mine/theirs so the hue wins. */
  .bubble.deepa-1 {
    background: var(--color-deepa-1);
    color: var(--color-deepa-ink-1);
  }
  .bubble.deepa-2 {
    background: var(--color-deepa-2);
    color: var(--color-deepa-ink-2);
  }
  .bubble.deepa-3 {
    background: var(--color-deepa-3);
    color: var(--color-deepa-ink-3);
  }
  .bubble.deepa-4 {
    background: var(--color-deepa-4);
    color: var(--color-deepa-ink-4);
  }
  .bubble.deepa-5 {
    background: var(--color-deepa-5);
    color: var(--color-deepa-ink-5);
  }
  .content {
    margin: 0;
    font-family: var(--font-body);
    font-size: 14px;
    line-height: 1.45;
    letter-spacing: 0.02em;
    color: inherit; /* the bubble's pairing: --color-text (mine) / ink token (theirs) */
    white-space: pre-wrap; /* plain text; a 255-symbol message never overflows (AC 10) */
    overflow-wrap: anywhere;
  }
  .meta {
    margin: 0;
    display: flex;
    align-items: baseline;
    gap: var(--space-2);
    font-size: 11px;
    color: var(--color-text-muted);
  }
  .speaker {
    font-weight: 600;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 180px;
  }
</style>
