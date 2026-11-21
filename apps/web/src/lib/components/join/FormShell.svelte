<script lang="ts">
  /**
   * FormShell (Concept §30, DESIGN §4.19) — the shared three-block form
   * structure for the non-chat join-surface forms, mirroring the proven
   * §28/§29 creation-dialog geometry (fixed header/footer regions, one
   * internal scroll region, viewport-bounded). The shell carries ONLY the
   * region geometry — the forms keep their own visual styles (existing
   * button/mascot/title treatments are reused, not restyled):
   *
   * 1. HEADER (flex: none — never scrolls): the web-app icon on the LEFT
   *    (the shipped PWA mark's graphic WITHOUT its background plate —
   *    owner amendment: transparent against the header background, 40px)
   *    and the LocaleControl language switch on the RIGHT — its height
   *    EQUALS the icon's height (owner amendment, §30 item 1: a 40px
   *    switcher via a header-scoped sizing of the shared control; both
   *    vertically centered in the row). RU/EN parity on every form that
   *    mounts the shell (no new copy: the control carries its own).
   * 2. MIDDLE (flex: 1 + min-height: 0 + overflow-y: auto — the ONLY
   *    scrollable region of the form): the default content — the
   *    content (mascot / title / text) plus the form's main interactive
   *    element (the 6-digit input, the scan-QR link, or the resume rows).
   *    Text paragraphs fill no more than 75% of the form width. Content
   *    is TOP-ANCHORED (owner refinement): it starts at the top and flows
   *    top-to-bottom with paddings; horizontal centering only (each form
   *    owns its alignment) — NEVER vertically centered, so long content
   *    starts at the top of the scroll region (no jump when scrolling).
   * 3. FOOTER (flex: none — never scrolls): the `footer` snippet — the
   *    buttons for the user to pick (1..n, stacked; always fully visible,
   *    never clipped — the §29 viewport rule).
   *
   * Viewport-bounded (the §29 rule): the DEFINITE viewport height comes
   * from the JoinFlow form-shell gate (the 100vh/100dvh wrapper chain —
   * the dynamic viewport IS the keyboard/visualViewport handling); the
   * shell only fills that bounded area (flex: 1 + min-height: 0) and
   * keeps the middle as the single scroll-port — the form never overlays
   * beyond the visible screen area and never grows content-driven.
   */
  import type { Snippet } from 'svelte';
  import LocaleControl from './LocaleControl.svelte';

  interface Props {
    /** Middle-block content: mascot / title / text + the main element. */
    children: Snippet;
    /** Footer action buttons (1..n — the buttons for the user to pick). */
    footer?: Snippet;
  }  let { children, footer }: Props = $props();
</script>

<div class="form-shell">
  <header class="shell-header">
    <!-- §30 header-LEFT: the app icon — the shipped PWA mark's graphic
         itself, WITHOUT the background plate (owner amendment, §30 item
         1: transparent against the header background; token fills only,
         no hex in source). Owner sizing amendment: 40px. -->
    <svg
      class="app-icon"
      viewBox="0 0 64 64"
      width="40"
      height="40"
      shape-rendering="crispEdges"
      role="img"
      aria-hidden="true"
    >
      <!-- the agent mark (the static/icons/icon.svg art, plate removed) -->
      <g fill="var(--color-accent)">
        <rect x="16" y="14" width="32" height="8" />
        <rect x="12" y="22" width="40" height="16" />
        <rect x="16" y="38" width="32" height="8" />
      </g>
      <g fill="var(--color-bg)">
        <rect x="20" y="26" width="8" height="8" />
        <rect x="36" y="26" width="8" height="8" />
        <rect x="28" y="30" width="8" height="4" />
      </g>
    </svg>
    <!-- §30 header-RIGHT: the language switch (works on these forms).
         Owner amendment (§30 item 1): its height equals the icon's
         height (40px) — header-scoped sizing of the shared control. -->
    <div class="locale"><LocaleControl /></div>
  </header>
  <div class="shell-middle">
    <div class="content">
      {@render children()}
    </div>
  </div>
  <footer class="shell-footer">
    {@render footer?.()}
  </footer>
</div>

<style>
  /* Concept §30 geometry unification (owner amendment): the FormShell's
   * container geometry is the SHARED STANDARD for every screen in the
   * join/intro/creation flow — the creation chat and the mascot intro
   * consume this same width instead of their own §25 800px rule, so all
   * screens are dimensioned and positioned IDENTICALLY (width, centering,
   * viewport bounding). */
  :global(:root) {
    --form-shell-max-width: 480px;
  }
  .form-shell {
    /* Fill the bounded card (the JoinFlow 100dvh gate chain provides the
     * definite height — the §29 viewport rule); the three regions below
     * mirror the §28/§29 creation-dialog geometry. */
    flex: 1;
    min-height: 0;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }
  .shell-header {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
  }
  .app-icon {
    /* Owner amendment (§30 item 1): NO background — the mark sits
     * transparent against the header background (no plate, no badge). */
    display: block;
    flex: none;
    background: transparent;
  }
  /* Owner amendment (§30 item 1): the language switcher's height EQUALS
   * the app icon's height (40px), both vertically centered in the header
   * row (the header's align-items: center). The shared SegmentedControl
   * is sized down ONLY here (scoped under .locale) — the profile
   * settings and every other usage keep the untouched 48px control. */
  .locale {
    display: flex;
    flex: none;
    align-items: center;
    height: 40px;
  }
  .locale :global(.segmented) {
    padding: 2px;
  }
  .locale :global(.segmented button) {
    min-height: 36px;
  }
  /* THE ONLY SCROLLABLE REGION (§30): its own scroll-port — the header
   * and the footer never scroll. */
  .shell-middle {
    flex: 1;
    min-height: 0;
    min-width: 0;
    overflow-y: auto;
  }
  /* Top-anchored content (owner refinement): plain block flow — content
   * starts at the TOP and flows top-to-bottom with paddings; horizontal
   * centering only (each form owns its alignment) — NEVER vertically
   * centered, so long content starts at the top of the scroll region. */
  .content {
    padding: var(--space-4) 0 var(--space-5);
  }
  /* §30: the middle text fills no more than 75% of the form width. */
  .content :global(p) {
    max-width: 75%;
  }
  /* Footer: 1..n action buttons (§30 amendment) — stacked, fully visible
   * (flex: none — the footer never scrolls and is never clipped). */
  .shell-footer {
    flex: none;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: var(--space-4);
    padding-top: var(--space-4);
  }
</style>
