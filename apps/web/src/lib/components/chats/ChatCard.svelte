<script lang="ts">
  /**
   * ChatCard (DESIGN §3.4 as amended by §4.11.5–7, then §4.12.2 /
   * Concept §11.1.2): one stacked dialog card. Presentational — the route
   * owns the polled data and passes the chat, the resolved counterpart
   * user and the «+N» extra count in as data.
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
   * The state still derives from the AUTHORITATIVE Chat.done signal
   * (CONCEPT §13 R2 / DESIGN §4.13.2) via `chatStatus(chat)`
   * (missing/undefined → active); the `status` prop stays as a
   * presentation-level override for direct-card tests. The accessible
   * name drops the removed theme words
   * and carries the status instead.
   *
   * §4.15.2.2 (owner microchange, Concept §17.2+17.3): the right-side
   * STATUS MARKS (the finished reminder glyph / the active loading icon,
   * §4.11.7 lineage) are REMOVED and replaced by a COLOR DOT rendered on
   * FINISHED dialogs only (owner correction: an UNFINISHED item shows NO
   * dot — only the §4.13.4 loading circle; the dot and the spinner never
   * coexist). The §10.1.7-era ROTATED-DOTS loading indicator (the animated
   * `status-active` glyph spin) went away with the marks.
   *
   * §4.12.2 / Concept §11.1.2 (owner change request, 2026-11-18) — the LIST
   * role of the Deepa coding is amended (DIALOG bubbles keep their colors):
   * the card returns to the NEUTRAL surface (`--color-surface`, standard
   * `--color-text`/`--color-text-muted` text hierarchy — no Deepa
   * background, no ink pairing) and the color-coding lives on the item's
   * AVATAR, exactly like /people (PersonCard): the plain PixelAvatar whose
   * Deepa-derived art (hair hues + the dark Deepa backdrop token, both
   * deterministic from the counterpart address) carries the coding.
   *
   * §4.15.2.2: the color dot renders in the REMINDERS' color lineage — the
   * INTERLOCUTOR'S Deepa hue (`--color-deepa-<n>` via codeHue
   * (counterpartAddress), the `fnv1a(address) % 5` contract pinned by
   * tests), the chat's message color. The dot is decoration: the
   * accessible name carries the status (aria-hidden pattern). A missing
   * counterpart address (degenerate 0-participant case) leaves the dot
   * on currentColor (the neutral surface's text color).
   *
   * §4.15.3.2 (owner microchange, Concept §18.2): the finished-dot GROWS
   * to the loading circle's size — the dot's width/height now match the
   * §4.13.4 loader's outer diameter (14px, border-box) exactly; the hue
   * coloring and position stay untouched.
   *
   * §4.13.4 (owner change request, Concept §13.1.4): UNFINISHED dialogs
   * (the active state) render DARKER WITH OPACITY — a distinct muted
   * treatment (`chat-card.unfinished`; opacity only, on this dark theme
   * the card blends toward the darker page background) — plus the
   * ANIMATED CIRCULAR LOADER (`.loader`, a small standard spinning
   * circle, transform-only CSS; reduced-motion respected by the
   * base.css catch-all). Finished cards render at full emphasis — the
   * default card styles, no loader. The Deepa hue coding (avatar, the
   * color dot, the muted preview line) is untouched by this round.
   */
  import { resolve } from '$app/paths';
  import type { Chat, User } from '@bleak/api-client';
  import { locale, translate } from '#lib/i18n/locale';
  import { messageTime, chatStatus, type ChatStatus } from '#lib/chats/view';
  import type { LastMessageEntry } from '#lib/stores/lastMessage';
  import { codeHue } from '#lib/avatar/traits';
  import PixelAvatar from '#lib/components/PixelAvatar.svelte';

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
  // §4.12.2: the card itself is neutral; the INTERLOCUTOR'S Deepa hue
  // (fnv1a(address) % 5, pinned by tests) colors only the color dot (the
  // chat's message color). The hue string IS the class name
  // (deepa-1…deepa-5); a missing counterpart address (degenerate
  // 0-participant case) leaves the dot on currentColor.
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
    class="chat-card pixel-corners"
    class:unfinished={state === 'active'}
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
    <!-- §4.13.4: the unfinished dialog's circular loader is decoration too
         (the accessible name already carries the ACTIVE status) -->
    {#if state === 'finished'}
      <!-- §4.15.2.2 (owner correction, Concept §17.2): the COLOR DOT
           renders on FINISHED dialogs only; an UNFINISHED item shows NO
           dot — only the §4.13.4 loading circle below. The dot and the
           spinner never coexist. Decoration: the accessible name carries
           the status (§4.11.7; the aria-hidden pattern matches the
           retired marks). -->
      <span class="dot {hueClass}" aria-hidden="true" title={statusLabel}></span>
    {:else}
      <span class="loader" aria-hidden="true"></span>
    {/if}
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
  /* §4.13.4: UNFINISHED dialogs render DARKER WITH OPACITY — the muted
   * treatment for dialogs whose agents are still talking (on this dark
   * theme the opacity blends the card toward the darker page background).
   * Finished cards render at full emphasis (the default styles above).
   * Declared after the press state so the muted value wins for unfinished
   * cards; a pressed unfinished card dips a touch further. */
  .chat-card.unfinished {
    opacity: 0.6;
  }
  .chat-card.unfinished:active {
    opacity: 0.5;
  }
  /* §4.12.2 / Concept §11.1.2: the LIST role of the Deepa coding is
   * amended — the card stays on the NEUTRAL surface (no Deepa background,
   * no ink pairing); the color-coding lives on the item's AVATAR (the
   * plain PixelAvatar's Deepa-derived art, exactly like PersonCard on
   * /people) and on the color dot (the chat's message color, below).
   * Dialog bubbles (MessageBubble) keep their hues untouched. */
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
  /* §4.15.2.2 (owner correction): the color dot renders on FINISHED
   * dialogs only — it renders in the CHAT'S MESSAGE COLOR, the
   * interlocutor's Deepa hue (`--color-deepa-<n>` via codeHue), the
   * lineage of the retired reminder marks. Unfinished items show NO dot
   * (the §4.13.4 loader circle instead) — the two never coexist.
   * Declared after the base so the hue wins.
   * §4.15.3.2 (owner microchange, Concept §18.2): the dot's SIZE matches
   * the §4.13.4 loader's outer diameter exactly (14px, border-box — the
   * loader's width/height with its 2px ring included). Hue and position
   * untouched. */
  .dot {
    flex-shrink: 0;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: currentColor;
  }
  .dot.deepa-1 {
    color: var(--color-deepa-1);
  }
  .dot.deepa-2 {
    color: var(--color-deepa-2);
  }
  .dot.deepa-3 {
    color: var(--color-deepa-3);
  }
  .dot.deepa-4 {
    color: var(--color-deepa-4);
  }
  .dot.deepa-5 {
    color: var(--color-deepa-5);
  }
  /* §4.13.4: the ANIMATED CIRCULAR LOADER on unfinished dialogs — a small
   * standard spinning circle (border ring with a transparent top arc,
   * transform-only rotation, §4.6 motion rule; disabled under
   * prefers-reduced-motion by the base.css catch-all). The outer diameter
   * is 14px (border-box) — the size the §4.15.3.2 dot matches. */
  .loader {
    flex-shrink: 0;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    border: 2px solid var(--color-text-muted);
    border-top-color: transparent;
    animation: loader-spin 0.9s linear infinite;
  }
  @keyframes loader-spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
