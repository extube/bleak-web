<script lang="ts">
  /**
   * MessageBubble (DESIGN §3.5 as amended by Concept §9.1.5 /
   * DESIGN §4.10.5; generalized in §4.18 — tz11-09): ONE transcript
   * entry — the single bubble implementation for every chat surface.
   * mine (my persona is a speaker when agents quote it) right-aligned;
   * theirs left. Only THEIR bubbles carry the speaker's Deepa hue —
   * fnv1a(seed) % 5 (lib/avatar/traits.ts) → full-opacity
   * `--color-deepa-<n>` background; the bubble text pairs with the
   * hue's ink token (`--color-deepa-ink-<n>`, AA ≥4.5:1 — verified in
   * tests/bubble-contrast.test.ts). OWN bubbles stay muted
   * (--color-surface-elevated with --color-text, unchanged from tz4-06);
   * mine never take MY code hue. Both .pixel-corners, 14px Inter,
   * max-width 80%. Plain text only — pre-wrap.
   *
   * The line model is surface-agnostic (ChatTranscript.ChatLine, the
   * §4.18 shared chat machinery): the main room passes the speaker
   * address as the hue seed + the meta row (11px muted speaker name +
   * absolute hh:mm time under the bubble, Concept §8.1.8) and the
   * accessible <li> name «{speaker}: {first 60 chars}»
   * (lib/chats/view.bubbleAriaLabel); the creation wizard passes the
   * mascot's stable id as the seed and asks for the mascot avatar row
   * beside its agent bubbles (tz11-09) with no meta (the interviewer
   * has no message times).
   */
  import { codeHue } from '#lib/avatar/traits';
  import BleakMascot from '#lib/components/BleakMascot.svelte';

  interface Props {
    /** The line's plain text (the bubble content). */
    text: string;
    /** mine → right-aligned muted bubble; theirs → left. */
    mine: boolean;
    /** The Deepa hue seed for THEIR bubbles (theirs only — mine never
     *  take a hue): the speaker's address in the main room, the
     *  mascot's stable id in the creation chat. */
    hueSeed?: string;
    /** The meta row under the bubble: speaker name + hh:mm time (the
     *  main room). The creation chat omits it. */
    meta?: { speaker: string; time: string } | null;
    /** The creation mascot avatar beside agent bubbles (tz11-09). */
    mascot?: boolean;
    /** Accessible name: «{speaker}: {first 60 chars}». */
    label?: string;
  }

  let { text, mine, hueSeed = undefined, meta = null, mascot = false, label = undefined }: Props = $props();

  // §4.10.5: the Deepa hue applies to theirs only; mine stays muted — no
  // `deepa-*` class is emitted for own bubbles at all. The hue string IS
  // the class name (deepa-1…deepa-5).
  const hueClass = $derived(mine || hueSeed === undefined ? '' : codeHue(hueSeed));
</script>

<li class="row" class:mine class:animated={mascot && !mine} aria-label={label}>
  {#if mascot && !mine}
    <span class="avatar" aria-hidden="true">
      <BleakMascot size={28} idle />
    </span>
  {/if}
  <div class="bubble pixel-corners {hueClass}" class:mine class:theirs={!mine}>
    <p class="content">{text}</p>
  </div>
  {#if meta}
    <p class="meta">
      <span class="speaker">{meta.speaker}</span>
      <span class="time" title={meta.time} aria-hidden="true">{meta.time}</span>
    </p>
  {/if}
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
  /* The creation mascot avatar row (tz11-09): pulled left to hug the
   * bubble edge, the interviewer is present in every question. */
  .avatar {
    margin-left: calc(var(--space-2) * -1);
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
  /* The shared bubbles' entrance: the creation chat's small rise —
   * carried by the mascot-gated class so the main room's transcript
   * never animates on poll arrivals (behavior-neutral). */
  .row.animated {
    animation: bubble-in 180ms ease-out;
  }
  @keyframes bubble-in {
    from {
      opacity: 0;
      transform: translateY(6px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
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
