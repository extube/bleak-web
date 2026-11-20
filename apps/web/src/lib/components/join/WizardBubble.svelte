<script module lang="ts">
  /**
   * The wizard interviewer's stable identity: the Deepa hue coding needs a
   * deterministic seed — the mascot always renders with the same hue,
   * everywhere the wizard runs (codeHue's fnv1a % 5 is stable per string).
   */
  export const WIZARD_MASCOT_ID = 'bleak-mascot';
</script>

<script lang="ts">
  /**
   * WizardBubble (Concept §22.3 item 2, DESIGN §4.16.2): one creation-wizard
   * chat line. The interviewer's (agent) bubbles reuse the MessageBubble
   * dialog styling incl. the Deepa hue coding — the mascot speaks with a
   * deterministic hue derived from its stable id (codeHue, fnv1a % 5 →
   * `--color-deepa-<n>` background paired with the hue's ink token, the
   * same AA pairing tests/bubble-contrast.test.ts pins). The user's (me)
   * bubbles stay muted (--color-surface-elevated), right-aligned — never a
   * hue of their own, mirroring the transcript rule. Both .pixel-corners,
   * 14px body font, max-width 80%; agent rows carry the small BleakMascot
   * avatar (the interviewer is present in every question).
   */
  import { locale, translate } from '#lib/i18n/locale';
  import { codeHue } from '#lib/avatar/traits';
  import BleakMascot from '#lib/components/BleakMascot.svelte';

  interface Props {
    /** `agent` = the mascot's question (left, Deepa hue); `me` = the
     * user's answer (right, muted). */
    who: 'agent' | 'me';
    text: string;
  }

  let { who, text }: Props = $props();

  const hueClass = $derived(who === 'agent' ? codeHue(WIZARD_MASCOT_ID) : '');
  const speaker = $derived(translate($locale, 'join.wizard.agent.name'));
</script>

<li class="line" class:me={who === 'me'} class:agent={who === 'agent'} aria-label={speaker + ': ' + text}>
  {#if who === 'agent'}
    <span class="avatar" aria-hidden="true">
      <BleakMascot size={28} idle />
    </span>
  {/if}
  <div class="bubble pixel-corners {hueClass}" class:mine={who === 'me'} class:theirs={who === 'agent'}>
    <p class="content">{text}</p>
  </div>
</li>

<style>
  .line {
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 2px;
    max-width: 80%;
    /* Entrance: transform/opacity only (DESIGN §4.6); the base.css
     * reduced-motion catch-all collapses it to instant. */
    animation: bubble-in 180ms ease-out;
  }
  .line.agent {
    align-self: flex-start;
    align-items: flex-start;
  }
  .line.me {
    align-self: flex-end;
    align-items: flex-end;
  }
  .avatar {
    margin-left: calc(var(--space-2) * -1);
  }
  .bubble {
    padding: var(--space-3) var(--space-4);
    border-radius: var(--radius-md);
    color: var(--color-text);
  }
  /* Muted own bubbles (MessageBubble §4.9.7): the neutral surface tint —
   * never a Deepa hue (mine never take MY code hue). */
  .bubble.mine {
    background: var(--color-surface-elevated);
  }
  .bubble.theirs {
    background: var(--color-surface);
  }
  /* Deepa-hue override (MessageBubble §4.10.5): the interviewer's bubbles
     carry the mascot's full-opacity hue; text pairs with the hue's ink
     token. Declared after mine/theirs so the hue wins. */
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
    color: inherit;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
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
</style>
