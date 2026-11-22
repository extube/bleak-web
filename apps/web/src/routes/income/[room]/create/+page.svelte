<script lang="ts">
  /**
   * `/income/[room]/create` — the creation process (tz12-02 route
   * re-homing, Concept §31): the creation wizard flow under its own
   * route. The room context rides the ROUTE PARAM, the 6-digit invite
   * code rides the `?code=` query; the same JoinFlow is seeded directly
   * into its persona (wizard) step — the forms themselves are unchanged
   * (lib/join.ts untouched).
   *
   * - Reached from the room intro (the /income page): "Create profile"
   *   navigates here with the resolved room address + the entered code.
   * - Direct open without a valid code (or a missing room param) → the
   *   entry page `/income` (replaceState — the URL matches the surface).
   * - Back from the wizard → `/income?code=…` (JoinFlow): the entry page
   *   re-resolves the code and lands on the room intro again.
   */
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { page } from '$app/state';
  import { isValidInviteCode } from '#lib/join';
  import JoinFlow from '#lib/components/join/JoinFlow.svelte';

  const roomParam = $derived(page.params.room ?? null);
  const codeParam = $derived(page.url.searchParams.get('code'));
  const seeded = $derived(
    roomParam !== null && roomParam !== '' && codeParam !== null && isValidInviteCode(codeParam)
  );

  // Not seedable (direct open without the code/room context) → the entry
  // page. The valid-seed case never fires the redirect.
  $effect(() => {
    if (!seeded) {
      void goto(resolve('/income'), { replaceState: true });
    }
  });
</script>

{#if seeded}
  <div class="join">
    <JoinFlow roomParam={roomParam} deepLinkCode={codeParam} />
  </div>
{/if}

<style>
  /* The page-level .join wrapper — the SAME wrapper geometry the income
   * entry page gives JoinFlow (the §24–§30 gates key on
   * `.app-shell > .join:has(> .persona-step)`): a flex conduit between
   * the app-shell and the flow root. */
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
   * forms — the wrapper drops its own gutter (the persona gate below
   * un-bounds it again while the creation chat is mounted). */
  @media (max-width: 719px) {
    .join {
      max-width: none;
      padding: 0;
    }
  }
</style>
