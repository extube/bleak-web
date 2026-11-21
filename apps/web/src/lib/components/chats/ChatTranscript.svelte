<script module lang="ts">
  /**
   * ChatLine — the ONE transcript line model for every chat surface
   * (DESIGN §4.18): the main room derives it from the polled Message
   * snapshot; the creation wizard FEEDS its interview lines (the
   * mascot's questions + the sent answers) straight into the same
   * model — the wizard is a driver over the real chat, no replica.
   */
  export interface ChatLine {
    /** `me` = the user's own line (right, muted); `agent` = the other
     *  speaker's line (left, the speaker's Deepa hue). */
    who: 'agent' | 'me';
    text: string;
    /** Accessible name: «{speaker}: {first 60 chars}»
     *  (lib/chats/view.bubbleAriaLabel). The main room names every row;
     *  the creation chat names only the interviewer's questions — the
     *  user's answers carry no speaker name yet, so their rows announce
     *  their content (no redundant aria-label). */
    label?: string;
    /** The Deepa hue seed for agent bubbles — /chats: the speaker's
     *  address; the creation chat: the mascot's stable id. Ignored for
     *  mine (own bubbles never take a hue). */
    hueSeed?: string;
    /** The meta row under the bubble (speaker + hh:mm) — the main
     *  room only; the creation chat omits it. */
    meta?: { speaker: string; time: string };
    /** The creation mascot avatar on agent rows (tz11-09). */
    mascot?: boolean;
    /** Keyed each identity (tx_id in the main room). */
    key?: string | number;
  }
</script>

<script lang="ts">
  /**
   * ChatTranscript (DESIGN §4.18, tz11-09): THE real main-room chat
   * machinery — message-list rendering + scrolling/autoscroll + the
   * scroll-to-bottom chip, extracted from routes/chats/[address] and
   * shared with the creation chat. The creation dialog inherits the
   * PROVEN chat behavior (including autoscroll) instead of the removed
   * simulated replica (Concept §26).
   *
   * The CALLER owns the scroll container: /chats keeps its own
   * `.scroll`/`.column` chrome (page-owned geometry, pinned by the
   * §4.14.4 sheet width contract) and binds it here; the creation
   * wizard binds its `.log` scroller (the task-107/109 bounded
   * persona-step chain stays as the container infrastructure the real
   * chat mounts into). The component renders ONLY the transcript
   * fragment (date label + the message list + the jump chip) directly
   * into that column, so the /chats DOM is byte-equivalent — the
   * extraction is behavior-neutral for the main room.
   *
   * Two PROVEN pin behaviors, one per surface:
   * - default (main room, §3.5 AC 3): stick tracking via
   *   lib/chats/view.isNearBottom on the caller's scroll events — new
   *   messages auto-pin while near the bottom; scrolled up, the
   *   «scroll to bottom» chip appears instead (instant scrollTop pin).
   * - `smooth` (creation chat, §24 item 12 / tasks 107+109): every new
   *   line AND step swap re-pins the newest message right above the
   *   composer with a SMOOTH scroll (instant under
   *   prefers-reduced-motion) plus the bounded settled-layout
   *   re-assert (one more pin two rAFs later, cancelled on re-run or
   *   unmount); no stick tracking, no chip.
   */
  import MessageBubble from './MessageBubble.svelte';
  import PixelIcon from '#lib/components/icons/PixelIcon.svelte';
  import { isNearBottom } from '#lib/chats/view';
  import { locale, translate } from '#lib/i18n/locale';

  interface Props {
    /** The transcript lines, oldest-first. */
    lines: readonly ChatLine[];
    /** The CALLER'S scroll container (bound with bind:this). */
    scroller: HTMLElement | null;
    /** The creation chat's smooth §24-item-12 pin (tasks 107/109);
     *  default: the main room's instant stick behavior. */
    smooth?: boolean;
    /** Locale date label above the first message (main room). */
    dateLabel?: string | null;
    /** A new transcript starts stuck at the bottom (the chat address
     *  swap in the main room). */
    resetKey?: string;
    /** Extra pin dependency — the creation chat's composer step swaps
     *  (the panel remount changes the visible height). */
    pinKey?: unknown;
  }

  let {
    lines,
    scroller,
    smooth = false,
    dateLabel = null,
    resetKey = '',
    pinKey = undefined
  }: Props = $props();

  // --- auto-scroll (§3.5 AC 3, verbatim from the main room) ----------------
  /** Near the bottom ⇒ auto-scroll on new messages; else the chip shows. */
  let stick = $state(true);

  // A new transcript (the chat address swap) starts stuck at the bottom.
  $effect(() => {
    void resetKey;
    stick = true;
  });

  function onScroll(): void {
    const el = scroller;
    if (!el) return;
    stick = isNearBottom(el.scrollTop, el.clientHeight, el.scrollHeight);
  }

  // The scroll listener binds to the caller's scroll container — the
  // main room's stick contract lives here, on the shared element ref.
  $effect(() => {
    const el = scroller;
    if (!el || smooth) return;
    el.addEventListener('scroll', onScroll);
    return () => el.removeEventListener('scroll', onScroll);
  });

  // Smooth pinning (the creation chat) honors prefers-reduced-motion:
  // instant under the media query (the base.css catch-all only covers
  // CSS animations, not JS scrolling).
  const reducedMotion =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /** One bottom-pin scroll — the effect's real call (spied in tests). */
  function pinToBottom(el: HTMLElement): void {
    try {
      el.scrollTo({
        top: el.scrollHeight,
        behavior: reducedMotion ? 'auto' : 'smooth'
      });
    } catch {
      /* no scroll available (tests) — visual nicety only */
    }
  }

  /**
   * THE pin. Main room (instant): on every new message while near the
   * bottom. Creation chat (smooth): on every new line AND composer
   * step swap (pinKey), plus the bounded settled-layout re-assert —
   * one more pin two rAFs later (the keyed composer swap remounts the
   * panel and late font/metric shifts reflow the bubbles after the
   * first pin), cancelled when this effect re-runs (every content
   * change re-pins immediately anyway) or the component unmounts.
   */
  $effect(() => {
    void lines; // dependency: auto-scroll when new lines land
    void pinKey;
    const el = scroller;
    if (!el) return;
    if (smooth) {
      pinToBottom(el);
      if (reducedMotion) return;
      let frame = 0;
      try {
        frame = requestAnimationFrame(() => {
          frame = requestAnimationFrame(() => {
            if (el.isConnected) pinToBottom(el);
          });
        });
      } catch {
        /* no rAF available (tests) — the synchronous pin above already ran */
      }
      return () => {
        try {
          cancelAnimationFrame(frame);
        } catch {
          /* no rAF available (tests) */
        }
      };
    }
    if (stick) el.scrollTop = el.scrollHeight;
  });

  function jumpToBottom(): void {
    const el = scroller;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    stick = true;
  }

  /** The floating chip — the main room only (the creation chat always
   *  pins, so `stick` never leaves true there). */
  const showChip = $derived(!smooth && !stick && lines.length > 0);
</script>

{#if dateLabel !== null}
  <!-- Concept §8.1.8: the locale date label sits centered at the top of
       the transcript, above the first message. -->
  <p class="date-label">{dateLabel}</p>
{/if}
<ol class="transcript">
  {#each lines as line, i (line.key ?? i)}
    <MessageBubble
      text={line.text}
      mine={line.who === 'me'}
      hueSeed={line.hueSeed}
      meta={line.meta ?? null}
      mascot={line.mascot === true}
      label={line.label}
    />
  {/each}
</ol>
{#if showChip}
  <button type="button" class="jump-chip" onclick={jumpToBottom}>
    <PixelIcon name="back" size={16} />
    {translate($locale, 'chat.scroll_bottom')}
  </button>
{/if}

<style>
  /* The transcript list (extracted from the main room, §3.5): a flex
   * column of bubbles with a caller-tunable gap (the creation chat
   * keeps its tighter --space-2 rhythm via --transcript-gap). flex: 1
   * keeps the list growing inside the caller's bounded column so the
   * trailing jump chip lands at the column's bottom edge exactly where
   * the chip sat as the scroll container's direct child. */
  .transcript {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--transcript-gap, var(--space-3));
    flex: 1;
  }
  .date-label {
    margin: 0 0 var(--space-3);
    text-align: center;
    font-size: 12px;
    color: var(--color-text-muted);
  }
  .jump-chip {
    position: sticky;
    bottom: var(--space-2);
    align-self: center;
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    min-height: 40px;
    padding: 0 var(--space-4);
    background: var(--color-surface-elevated);
    border: 1px solid var(--color-text-disabled-strong);
    color: var(--color-text);
    border-radius: var(--radius-pill);
    font-size: 14px;
    font-weight: 600;
    transition: opacity 120ms ease-out;
  }
</style>
