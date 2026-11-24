<script lang="ts">
  /**
   * `/host/[room_address]/invite` — invite codes, active and expired/revoked
   * (DESIGN rev. 4 §3.7.3, TZ13-04 Part A).
   *
   * - **Guard** (as §3.7.2): the stored `bleak.hostRoom.roomAddress` must
   *   equal the URL param, else redirect `/host`; missing entry → `/host`.
   * - **Top bar:** back (→ panel), h1 «Коды приглашения», muted hint.
   *   Single column, max-width 720px.
   * - **Active codes:** room-token `listInvites` on a 15 s Poller; one
   *   `InviteRow` per code (copy chip / QR link → the per-code QR page /
   *   invite-link copy / «Отозвать» — no confirm).
   * - **Mint control:** «Выпустить код» → inline expiry chooser (presets
   *   1 ч / 24 ч pre-selected default / 7 дней + «Своё время…») →
   *   `mintInvite({ expires_at? })` → the code appears at the top of the
   *   active list AND is recorded in the ledger (rule C).
   * - **Rule C (Concept §54.2-C):** the per-room device ledger
   *   `bleak.hostInvites.<room address>` records every successful mint and
   *   revoke response of THIS device; the server list is authoritative for
   *   active codes, the ledger contributes history (entries missing from
   *   the server list render as expired/revoked — collapsed disclosure,
   *   non-interactive rows, ledger caveat). Merge/reconcile runs on every
   *   poll tick; entries still in the server list are never
   *   double-rendered; a failure records NOTHING.
   * - **States:** loading skeletons on first arrival (poll refreshes swap
   *   in place); empty (no active AND no ledger) → EmptyState + mint CTA;
   *   errors inline muted with retry (the ledger section still renders);
   *   mint/revoke failures inline near the control; room 404 → «Комната
   *   удалена.» + redirect (host reset semantics).
   * - **Host session reset:** a hostApi 401/403 clears `bleak.hostRoom`,
   *   sets `bleak.hostNotice` and lands on `/host`; attendee identity is
   *   never touched (§2.8/§3.7 reset semantics).
   */
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { get } from 'svelte/store';
  import { ApiError, type Invite } from '@bleak/api-client';
  import { hostApi, HOST_NOTICE_KEY } from '#lib/api/client';
  import { apiErrorText } from '#lib/join';
  import { Poller } from '#lib/polling/poller';
  import { locale, translate } from '#lib/i18n/locale';
  import { clearHostRoom, hostRoom, initHostSession } from '#lib/stores/hostSession';
  import {
    hostInviteLedger,
    type HostInviteLedger,
    type LedgerHistoryEntry
  } from '#lib/stores/hostInviteLedger';
  import { inviteUrlBase } from '#lib/components/profile/qr';
  import InviteManager from '#lib/components/host/InviteManager.svelte';

  // --- guard (§3.7.2): the stored room must match the URL param -----------
  const roomParam = $derived(page.params.room_address ?? '');
  const currentRoom = $derived($hostRoom);
  const guardOk = $derived(currentRoom !== null && currentRoom.roomAddress === roomParam);

  let booted = $state(false);
  let redirecting = $state(false);

  $effect(() => {
    if (booted) return;
    initHostSession();
    booted = true;
    const stored = get(hostRoom);
    if (!stored || stored.roomAddress !== roomParam) {
      // Missing or mismatched entry → /host (§1.3).
      redirecting = true;
      void goto(resolve('/host'));
      return;
    }
    ledger = hostInviteLedger(stored.roomAddress);
  });

  // --- rule-C ledger (one per room, created after the guard) --------------
  let ledger: HostInviteLedger | null = null;

  // --- polled active list (15 s; last-known snapshots survive failures) ---
  let invites = $state<Invite[] | null>(null);
  let history = $state<LedgerHistoryEntry[]>([]);
  let pollError = $state<null | { kind: 'network' | 'api'; message: string | null }>(null);
  let roomDeleted = $state(false);
  /** Seconds clock shared by the invite rows (expiry display). */
  let now = $state(Date.now());

  function errorFrom(cause: unknown): { kind: 'network' | 'api'; message: string | null } {
    if (cause instanceof ApiError) return { kind: 'api', message: apiErrorText(cause) };
    return { kind: 'network', message: null };
  }

  /**
   * Merge rule (rule C): the server list is authoritative for active
   * codes; the ledger contributes history. Every server answer (poll
   * tick, mint, revoke) is re-merged — entries still in the server list
   * are never double-rendered.
   */
  function applyServer(list: Invite[]): void {
    if (!ledger) return;
    const merged = ledger.merge(list);
    invites = merged.active;
    history = merged.history;
  }

  /**
   * Host session reset: a 401/403 on a room-token call means revoked
   * access — the hostApi gate already cleared `bleak.hostRoom` and set
   * `bleak.hostNotice`; this page clears again (idempotent), keeps the
   * flag and lands on `/host`. Attendee identity is NEVER touched.
   */
  function handleHostReset(cause: unknown): void {
    if (cause instanceof ApiError && (cause.status === 401 || cause.status === 403)) {
      clearHostRoom();
      try {
        sessionStorage.setItem(HOST_NOTICE_KEY, '1');
      } catch {
        /* storage unavailable — the notice is best-effort */
      }
      poller.stop();
      void goto(resolve('/host'));
    }
  }

  async function pollTick(): Promise<void> {
    const current = get(hostRoom);
    if (!current) throw new Error('no host room');
    applyServer(await hostApi.listInvites(current.roomAddress));
    now = Date.now();
    pollError = null;
  }

  const poller = new Poller({
    intervalMs: 15000,
    backoffMs: 30000,
    tick: pollTick,
    onStall: (cause) => {
      if (cause instanceof ApiError && cause.status === 404) {
        // Room deleted elsewhere: full-page state → cleared + redirect.
        roomDeleted = true;
        pollError = null;
        clearHostRoom();
        poller.stop();
        void goto(resolve('/host'));
        return;
      }
      pollError = errorFrom(cause);
      // The ledger section still renders during errors (it is local):
      // with no prior server snapshot, merge against an empty list so the
      // known expired/revoked codes stay visible (last-known data survives
      // failures otherwise — no flicker on refresh).
      if (invites === null) applyServer([]);
      handleHostReset(cause);
    }
  });

  $effect(() => {
    if (!booted || redirecting || !guardOk) return;
    poller.start();
    void poller.refresh();
    return () => poller.stop();
  });

  function onVisibilityChange(): void {
    if (document.visibilityState === 'visible' && poller.isRunning) void poller.refresh();
  }
  $effect(() => {
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  });

  // --- mint (rule C: record AFTER success — a failure records nothing) ----
  let mintPending = $state(false);
  let actionError = $state<string | null>(null);

  async function onMint(expiresAt?: string): Promise<void> {
    const current = get(hostRoom);
    if (!current || !ledger || mintPending) return;
    mintPending = true;
    actionError = null;
    try {
      const response = await hostApi.mintInvite(
        current.roomAddress,
        expiresAt ? { expires_at: expiresAt } : {}
      );
      ledger.recordMint(response);
      // The new code appears at the top of the active list (the InviteRow
      // list sorts by created_at desc) — the next poll tick reconciles.
      applyServer([...(invites ?? []), response]);
    } catch (cause: unknown) {
      actionError = cause instanceof Error ? cause.message : translate($locale, 'common.error');
      handleHostReset(cause);
    } finally {
      mintPending = false;
    }
  }

  // --- revoke (no confirm — reversible; rule C stamps the ledger) ---------
  let revokedNote = $state(false);
  let revokedTimer: ReturnType<typeof setTimeout> | null = null;

  async function onRevoke(code: string): Promise<void> {
    const current = get(hostRoom);
    if (!current || !ledger) return;
    actionError = null;
    try {
      await hostApi.revokeInvite(current.roomAddress, code);
      ledger.recordRevoke(code);
      applyServer((invites ?? []).filter((invite) => invite.code !== code));
      revokedNote = true;
      if (revokedTimer) clearTimeout(revokedTimer);
      revokedTimer = setTimeout(() => (revokedNote = false), 2000);
    } catch (cause: unknown) {
      actionError = cause instanceof Error ? cause.message : translate($locale, 'common.error');
      handleHostReset(cause);
    }
  }

  // --- derived copy ---------------------------------------------------------
  const title = $derived(translate($locale, 'host.invites.title'));
  const hint = $derived(translate($locale, 'host.invites.hint'));
  const backLabel = $derived(translate($locale, 'common.back'));
  const deletedMessage = $derived(translate($locale, 'host.room.deleted'));
</script>

<svelte:head>
  <title>{title} — bleak-web</title>
</svelte:head>

<main class="invite-page">
  {#if roomDeleted}
    <!-- listInvites 404: the room was deleted while the page was open. -->
    <section class="deleted card pixel-corners">
      <p role="status">{deletedMessage}</p>
    </section>
  {:else if booted && !redirecting && guardOk}
    <header class="topbar">
      <!-- The panel route (`/host/[room_address]`) lands with TZ13-03's
           merge — its route-id typing does not exist on this branch's tree
           yet. A route-param href is exempted from
           svelte/no-navigation-without-resolve (the delivered ShareKit
           precedent — the rule cannot express the param target here). -->
      <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
      <a class="back" href={`/host/${roomParam}`}>{backLabel}</a>
      <h1>{title}</h1>
      <p class="hint">{hint}</p>
    </header>

    <InviteManager
      invites={invites}
      {history}
      roomAddress={roomParam}
      error={pollError?.kind ?? null}
      errorMessage={pollError?.message ?? null}
      {mintPending}
      {actionError}
      {revokedNote}
      baseUrl={inviteUrlBase()}
      {now}
      onmint={(expiresAt) => void onMint(expiresAt)}
      onrevoke={(code) => void onRevoke(code)}
      onretry={() => {
        pollError = null;
        void poller.refresh();
      }}
    />
  {/if}
</main>

<style>
  .invite-page {
    flex: 1;
    width: 100%;
    max-width: 720px;
    margin: 0 auto;
    padding: var(--space-5) var(--space-4) calc(var(--bottom-tabbar-height) + var(--space-5));
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }
  .topbar {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  .back {
    align-self: flex-start;
    color: var(--color-text-muted);
    min-height: var(--touch-target);
    font-size: 14px;
    text-decoration: none;
    display: inline-flex;
    align-items: center;
  }
  h1 {
    font-size: 32px;
    margin: 0;
  }
  .hint {
    margin: 0;
    font-size: 14px;
    color: var(--color-text-muted);
  }
  .deleted {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    align-items: flex-start;
    max-width: 480px;
  }
  .deleted p {
    margin: 0;
    font-size: 14px;
    color: var(--color-text-muted);
  }
</style>
