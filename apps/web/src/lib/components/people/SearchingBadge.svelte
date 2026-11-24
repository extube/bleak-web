<script lang="ts">
  /**
   * SearchingBadge (DESIGN §4.38, Concept §52): the "searching new contacts"
   * badge on /people — the FIRST <li> of the `.cards` list, styled in the
   * PersonCard footprint (§3.3 card family: surface card, pixel-corners,
   * 56px left slot, .row gap) but NOT a user: no navigation, no PersonCard
   * behavior, no relationship data, no real user fields. Content = the
   * blinking light-bulb pixel glyph (§4.38.B — the §4.13.4 spinner was
   * superseded) + the muted title (the .name family 16px/600 in
   * --color-text-muted — the "muted/secondary styling" that reads as a
   * system state) + the settings remark link (§4.38.C).
   *
   * Presentational: the route derives the §49 `active` flag from the
   * already-polled listRoomUsers roster (self entry) and conditionally
   * renders this badge; no props beyond the locale machinery. It is not
   * part of the `cards` derived array — pure markup as the first list child
   * (§4.37.B), never reordered, never filtered by the search (§4.37.C).
   *
   * Interactivity guarantees (§4.38.C — supersedes the §4.37.A blanket):
   * the badge's ONLY interactive element is the settings remark link (a
   * real <a>, natively focusable, SvelteKit intercepts it) — no button, no
   * role="button", no tabindex, no other anchor, no tap handler, no
   * `cursor: pointer` on the root; clicking anywhere outside the link does
   * nothing.
   */
  import { resolve } from '$app/paths';
  import PixelIcon from '#lib/components/icons/PixelIcon.svelte';
  import { locale, translate } from '#lib/i18n/locale';

  const title = $derived(translate($locale, 'people.searching'));
  const remark = $derived(translate($locale, 'people.searching_settings'));
</script>

<li class="searching-badge pixel-corners">
  <div class="row">
    <!-- The 56px PixelAvatar slot — NO avatar, NO placeholder box; the
         blinking bulb is centered in it (§4.38.A/B). -->
    <div class="slot">
      <span class="bulb" aria-hidden="true">
        <PixelIcon name="bulb" size={32} />
      </span>
    </div>
    <div class="main">
      <p class="title">{title}</p>
      <a class="remark" href={resolve('/profile/settings')}>{remark}</a>
    </div>
  </div>
</li>

<style>
  /* The .person-card footprint (PersonCard lines 203–211): surface card,
   * --radius-md, --space-4 padding; pixel-corners per the §3.3 card family. */
  .searching-badge {
    display: flex;
    flex-direction: column;
    background: var(--color-surface);
    border-radius: var(--radius-md);
    padding: var(--space-4);
    min-width: 0;
  }
  /* The .row (PersonCard lines 212–217). */
  .row {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    min-width: 0;
  }
  .slot {
    flex-shrink: 0;
    width: 56px;
    height: 56px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
  /* §4.38.B: the blinking bulb — an opacity-only pulse (§4.6): the "off"
   * phase dips to 0.3, the glyph tone never changes. No animation-fill-mode,
   * so under prefers-reduced-motion: reduce the base.css catch-all completes
   * the pulse instantly and the bulb rests STATIC at full opacity (the "on"
   * state); no component-scoped @media block (§4.38.B). */
  .bulb {
    display: inline-flex;
    animation: bulb-blink 1.2s ease-in-out infinite;
  }
  @keyframes bulb-blink {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.3;
    }
  }
  /* The PersonCard .main (PersonCard lines 231–234) — REQUIRED so the title
   * and the remark stack instead of sitting side-by-side in the .row (§4.38.A). */
  .main {
    flex: 1;
    min-width: 0;
  }
  /* The .name family (PersonCard lines 235–240) in the muted tone — a
   * system state, not a user (§4.37.A). */
  .title {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: var(--color-text-muted);
  }
  /* §4.38.C: the settings remark — the FULL line is ONE anchor. The .bio
   * family values (PersonCard lines 241–248) plus an underline (the
   * RoomPreview muted-underlined link precedent, lines 90–97): the
   * underline overrides the global `a` accent/no-underline defaults
   * (base.css lines 37–40). The badge's ONLY interactive element. */
  .remark {
    display: block;
    margin: 2px 0 0;
    font-size: 14px;
    color: var(--color-text-muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    text-decoration: underline;
  }
</style>
