<script lang="ts">
  /**
   * `/income/[income_code]` — the room intro route (DESIGN §4.34.A route
   * map; Concept §48 item 2, owner bug batch 2026-11-23): the
   * create-profile / change-code choice page on its OWN route. The route
   * param IS the 6-digit invite code (§4.34.F.1 supersedes §4.31.D's
   * room-address value — the room address is only ever a resolved value
   * inside the page).
   *
   * - The §4.34.C contract: the param code is resolved on mount with the
   *   existing resolve logic (JoinFlow's intro mode — resolving treatment
   *   = shell + inline spinner, no skeleton; dead/invalid param = the
   *   existing code-error treatments with Change code back to /income).
   * - "Create profile" → /income/[income_code]/create with NO query
   *   string (§4.34.D — the income code travels in the path param only).
   * - /income stays the 6-digit entry page (§31/§47: the default form
   *   ALWAYS shows) — a successful resolve there NAVIGATES here
   *   (§4.34.B), superseding §3.1's in-card Step-2 swap.
   *
   * Pre-room screen, no tab bar (layout); the §30 FormShell instantiation
   * is the one RoomPreview mounts (mascot 96 idle at top; the
   * multi-button footer — create profile + change code, §4.22.E).
   */
  import { page } from '$app/state';
  import JoinFlow from '#lib/components/join/JoinFlow.svelte';

  // The param IS the income code (the 6-digit invite code); the route
  // never reads a query string (§4.34.A/D — no query parameters on the
  // parametrized entry routes, ever).
  const introParam = $derived(page.params.income_code ?? null);
</script>

<div class="join">
  <JoinFlow introParam={introParam} />
</div>

<style>
  /* The page-level .join wrapper — the SAME wrapper geometry the income
   * entry / create pages give JoinFlow (the §24–§30 gates key on
   * `.app-shell > .join:has(> .form-step)`): a flex conduit between the
   * app-shell and the flow root. */
  .join {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-5);
    padding: var(--space-7) var(--space-5) var(--space-6);
    width: 100%;
    max-width: 480px;
    margin: 0 auto;
  }
  @media (min-width: 720px) {
    .join {
      justify-content: center;
    }
  }
  /* v2.6 (Concept §12, DESIGN §4.12.1 item 5): phone (<720px) full-screen
   * forms — the wrapper drops its own gutter (the JoinFlow card keeps its
   * own chrome-dropping overrides). Desktop (min-width: 720px) is
   * unchanged. */
  @media (max-width: 719px) {
    .join {
      max-width: none;
      padding: 0;
    }
  }
</style>
