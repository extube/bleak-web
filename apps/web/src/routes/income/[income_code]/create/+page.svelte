<script lang="ts">
  /**
   * `/income/[income_code]/create` — the creation process (tz12-02 route
   * re-homing, Concept §31; §4.34.D, Concept §48 owner bug batch
   * 2026-11-23): the creation wizard flow under its own route. The param
   * IS the 6-digit invite code (§4.34.F.1 supersedes §4.31.D's
   * room-address value) and the route takes NO QUERY PARAMETERS, ever —
   * the `?code=` seed is removed; the same JoinFlow is seeded directly
   * into its persona (wizard) step and RESOLVES the param code on mount
   * (§4.34.D — a 6-digit code is not a room address; the seeded
   * Room-from-param shortcut is superseded).
   *
   * - Reached from the room intro (/income/[income_code], §4.34.C):
   *   "Create profile" navigates here with the income code in the PATH
   *   only — the clean redirect (§4.34.D).
   * - Direct open without a valid 6-digit income_code param → the entry
   *   page /income (replaceState — the §4.31.D rule, carried by §4.34.D).
   * - Back from the wizard → the INTRO route /income/[income_code]
   *   (param-only — §4.34.D; the /income?code= round-trip is superseded).
   */
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { page } from '$app/state';
  import { isValidInviteCode } from '#lib/join';
  import JoinFlow from '#lib/components/join/JoinFlow.svelte';

  const incomeCodeParam = $derived(page.params.income_code ?? null);
  // §4.34.D: seeding = the param only (a valid 6-digit invite code). The
  // route NEVER reads ?code= — deep links (?code=/?u=/ handshakes) target
  // the entry surface only (§4.34.D reconciliation).
  const seeded = $derived(
    incomeCodeParam !== null && incomeCodeParam !== '' && isValidInviteCode(incomeCodeParam)
  );

  // Not seedable (direct open without the param context) → the entry
  // page. The valid-seed case never fires the redirect.
  $effect(() => {
    if (!seeded) {
      void goto(resolve('/income'), { replaceState: true });
    }
  });
</script>

{#if seeded}
  <div class="join">
    <JoinFlow incomeCodeParam={incomeCodeParam} />
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
