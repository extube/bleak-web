<script lang="ts">
  /**
   * SearchingBadge (DESIGN §4.37, Concept §51): the "searching new contacts"
   * badge on /people — the FIRST <li> of the `.cards` list, styled in the
   * PersonCard footprint (§3.3 card family: surface card, pixel-corners,
   * 56px left slot, .row gap) but NOT a user: no navigation, no PersonCard
   * behavior, no relationship data, no real user fields. Content = the
   * §4.13.4 circular loader (at the §3.1 .spinner standard 16px diameter)
   * + the muted title (the .name family 16px/600 in --color-text-muted —
   * the "muted/secondary styling" that reads as a system state).
   *
   * Presentational: the route derives the §49 `active` flag from the
   * already-polled listRoomUsers roster (self entry) and conditionally
   * renders this badge; no props beyond the locale machinery. It is not
   * part of the `cards` derived array — pure markup as the first list child
   * (§4.37.B), never reordered, never filtered by the search (§4.37.C).
   *
   * Non-interactive guarantees (§4.37.A): no button, no link, no
   * role="button", no tabindex, no tap handler, no expand panel, no
   * dismissal semantics — focus is never involved, it never navigates, no
   * `cursor: pointer`.
   */
  import { locale, translate } from '#lib/i18n/locale';

  const title = $derived(translate($locale, 'people.searching'));
</script>

<li class="searching-badge pixel-corners">
  <div class="row">
    <!-- The 56px PixelAvatar slot — NO avatar, NO placeholder box; the
         16px loader is centered in it (§4.37.A). -->
    <div class="slot">
      <span class="loader" aria-hidden="true"></span>
    </div>
    <p class="title">{title}</p>
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
  /* §4.13.4 construction (ChatCard lines 309–322) at the §3.1 .spinner
   * standard 16px diameter: border ring with a transparent top arc,
   * transform-only rotation (§4.6). Under prefers-reduced-motion: reduce
   * the base.css catch-all completes the rotation instantly — the ring
   * freezes as a static circle; no component-scoped @media block (§4.37.D). */
  .loader {
    width: 16px;
    height: 16px;
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
  /* The .name family (PersonCard lines 235–240) in the muted tone — a
   * system state, not a user (§4.37.A). */
  .title {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: var(--color-text-muted);
  }
</style>
