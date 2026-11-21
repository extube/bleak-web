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
   *    (the shipped `static/icons/icon.svg` PWA mark) and the LocaleControl
   *    language switch on the RIGHT — RU/EN parity on every form that
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
    <!-- §30 header-LEFT: the app icon (the shipped PWA mark asset — no
         hex in source, the sweep's token discipline holds). -->
    <img class="app-icon" src="/icons/icon.svg" alt="" width="32" height="32" />
    <!-- §30 header-RIGHT: the language switch (works on these forms). -->
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
    display: block;
    flex: none;
  }
  .locale {
    display: flex;
    flex: none;
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
