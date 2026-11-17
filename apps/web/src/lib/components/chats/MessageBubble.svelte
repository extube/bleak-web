<script lang="ts">
  /**
   * MessageBubble (DESIGN §3.5, §4.8.1): one transcript entry. mine (my
   * persona is a speaker when agents quote it) right-aligned; theirs left.
   * Both take the code hue of the address that speaks — fnv1a(address) % 4
   * (lib/avatar/traits.ts) → `--color-bubble-<hue>` token background; the
   * bubble text stays --color-text (AA ≥4.5:1 on every tint, verified in
   * tests/bubble-contrast.test.ts). Both .pixel-corners, 14px Inter,
   * max-width 80%. Speaker name (11px muted) + relative time under each
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
    /** My persona address — 'mine' bubbles take MY code hue (§4.8.1). */
    myAddress: string;
    /** Resolved speaker name (raw address fallback). */
    speaker: string;
    /** Relative time of `created_at`. */
    time: string;
    /** Accessible name: «{speaker}: {first 60 chars}». */
    label: string;
  }

  let { message, mine, myAddress, speaker, time, label }: Props = $props();

  const hue = $derived(codeHue(mine ? myAddress : message.from));
</script>

<li class="row" class:mine aria-label={label}>
  <div class="bubble pixel-corners code-{hue}" class:mine class:theirs={!mine}>
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
  }
  .bubble.mine {
    background: var(--color-surface-elevated);
  }
  .bubble.theirs {
    background: var(--color-surface);
  }
  /* Code-hue tint override (§4.8.1): every bubble carries its speaker's
   * hue; text stays --color-text above. Declared after mine/theirs so the
   * hue wins. */
  .bubble.code-yellow {
    background: var(--color-bubble-yellow);
  }
  .bubble.code-orange {
    background: var(--color-bubble-orange);
  }
  .bubble.code-blue {
    background: var(--color-bubble-blue);
  }
  .bubble.code-violet {
    background: var(--color-bubble-violet);
  }
  .content {
    margin: 0;
    font-family: var(--font-body);
    font-size: 14px;
    line-height: 1.45;
    letter-spacing: 0.02em;
    color: var(--color-text);
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
