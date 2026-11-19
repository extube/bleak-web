<script lang="ts">
  /**
   * /contacts — the contacts shared WITH the user (DESIGN §4.14.2,
   * Concept §14.1.2): the PRIMARY "shared with you" surface, superseding
   * the §4.13.3 minimal settings-side list (removed from
   * /profile/settings in favor of this tab).
   *
   * One Poller (route file only, §2.2): the recipient-only
   * `listContactsSharedWith(me)` (the attendee's own persona Bearer,
   * auto-injected) + cached `listRoomUsers` (sharer-name resolution) at
   * 4 s, refresh() on mount and visibility regain, stop() on teardown.
   * The endpoint returns the rows NEWEST FIRST — the order is preserved.
   * Rows: the sharer's name (resolved against the room roster; the raw
   * address is the fallback), the content, relative time.
   *
   * Visiting /contacts writes the per-persona contactsSeen store
   * (lib/stores/contactsSeen.ts) — the TabBar badge dot clears
   * (§1.2 / §4.14.2); the layout's one mount-time read feeds the dot on
   * the other tabs.
   */
  import { get } from 'svelte/store';
  import { ApiError, NetworkError, type Contact, type User } from '@bleak/api-client';
  import { identity, initIdentity } from '#lib/stores/identity';
  import { requireIdentityOrRedirect } from '#lib/nav/guard';
  import { api } from '#lib/api/client';
  import { Poller } from '#lib/polling/poller';
  import { markContactsSeen } from '#lib/stores/contactsSeen';
  import { relativeTime } from '#lib/people/view';
  import { locale, translate } from '#lib/i18n/locale';
  import SkeletonBlock from '#lib/components/SkeletonBlock.svelte';
  import ErrorBanner from '#lib/components/ErrorBanner.svelte';
  import EmptyState from '#lib/components/EmptyState.svelte';

  // Hard reload on a tab route: hydrate identity defensively (idempotent)
  // so the guard sees the persisted identity instead of bouncing to /.
  initIdentity();

  // --- polled live data (last-known snapshots survive failures) ----------
  let contacts = $state<readonly Contact[]>([]);
  let users = $state<readonly User[]>([]);
  let loading = $state(true);
  let pollError = $state<null | { kind: 'network' | 'api'; message: string | null }>(null);

  function errorFrom(cause: unknown): { kind: 'network' | 'api'; message: string | null } {
    if (cause instanceof ApiError) return { kind: 'api', message: cause.message };
    if (cause instanceof NetworkError) return { kind: 'network', message: null };
    return { kind: 'api', message: cause instanceof Error ? cause.message : null };
  }

  async function pollTick(): Promise<void> {
    const id = get(identity);
    if (!id) throw new Error('identity missing');
    const [nextContacts, nextUsers] = await Promise.all([
      api.listContactsSharedWith(id.userAddress),
      api.listRoomUsers(id.roomAddress)
    ]);
    // Poll diff: identical sequence keeps its reference (no re-render, §2.2).
    if (!sameContacts(contacts, nextContacts)) contacts = nextContacts;
    users = nextUsers;
    loading = false;
    pollError = null;
  }

  function sameContacts(
    a: readonly Contact[],
    b: readonly Contact[]
  ): boolean {
    return (
      a.length === b.length &&
      a.every((row, i) => row.from === b[i]?.from && row.content === b[i]?.content && row.created_at === b[i]?.created_at)
    );
  }

  const poller = new Poller({
    intervalMs: 4000,
    backoffMs: 12_000,
    tick: pollTick,
    onStall: (cause) => (pollError = errorFrom(cause))
  });

  // Identity guard (TZ-03) + poller lifecycle (route file only, §2.2).
  $effect(() => {
    if (!requireIdentityOrRedirect()) return;
    // Visiting /contacts clears the badge dot (§1.2, §4.14.2) — per persona.
    const id = get(identity);
    if (id) markContactsSeen(id.roomAddress, id.userAddress);
    poller.start();
    void poller.refresh();
    return () => poller.stop();
  });

  // Poller refresh on visibility regain (§2.2).
  function onVisibilityChange(): void {
    if (document.visibilityState === 'visible' && poller.isRunning) void poller.refresh();
  }
  $effect(() => {
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  });

  // --- derived view --------------------------------------------------------
  const me = $derived($identity);
  const userByAddress = $derived(new Map(users.map((user) => [user.address, user])));

  /** The sharer's roster name when known — the raw address is the fallback. */
  function sharerName(address: string): string {
    return userByAddress.get(address)?.name ?? address;
  }

  /** Relative «2 мин» / "2 min" time (the people-view helper, §3.3). */
  function ago(iso: string): string {
    return relativeTime(iso, Date.now(), $locale);
  }
</script>

<svelte:head>
  <title>{translate($locale, 'contacts.title')}</title>
</svelte:head>

<main class="contacts-page">
  <header class="header">
    <h1>{translate($locale, 'contacts.title')}</h1>
    <p class="subtitle">{translate($locale, 'contacts.subtitle')}</p>
  </header>

  {#if pollError}
    <ErrorBanner
      kind={pollError.kind}
      message={pollError.message}
      onretry={() => void poller.refresh()}
    />
  {/if}

  {#if loading && contacts.length === 0}
    <ul class="rows" aria-hidden="true">
      {#each [0, 1] as skeleton (skeleton)}
        <li class="skeleton-row">
          <div class="skeleton-bars">
            <SkeletonBlock width="55%" height="16px" />
            <SkeletonBlock width="75%" height="14px" />
          </div>
        </li>
      {/each}
    </ul>
  {:else if me && !loading && contacts.length === 0}
    <EmptyState
      message={translate($locale, 'contacts.empty')}
      icon="contact-card"
    />
  {:else}
    <ul class="rows" class:dimmed={pollError !== null}>
      {#each contacts as row (row.from + row.created_at)}
        <li class="row">
          <span class="sharer">{sharerName(row.from)}</span>
          <span class="content">{row.content}</span>
          <span class="time">{ago(row.created_at)}</span>
        </li>
      {/each}
    </ul>
  {/if}
</main>

<style>
  .contacts-page {
    flex: 1;
    width: 100%;
    max-width: 720px;
    margin: 0 auto;
    padding: var(--space-5) var(--space-4) calc(var(--bottom-tabbar-height) + var(--space-5));
    display: flex;
    flex-direction: column;
  }
  .header h1 {
    font-size: 32px;
  }
  .subtitle {
    margin: var(--space-1) 0 0;
    font-size: 14px;
    color: var(--color-text-muted);
  }
  .rows {
    list-style: none;
    margin: var(--space-4) 0 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    transition: opacity 200ms ease-out;
  }
  .rows.dimmed {
    opacity: 0.5;
  }
  .row {
    background: var(--color-surface);
    border-radius: var(--radius-md);
    padding: var(--space-4);
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }
  .sharer {
    font-size: 14px;
    font-weight: 600;
    overflow-wrap: anywhere;
  }
  .content {
    font-size: 14px;
    color: var(--color-text);
    overflow-wrap: anywhere;
  }
  .time {
    font-size: 12px;
    color: var(--color-text-muted);
  }
  .skeleton-row {
    background: var(--color-surface);
    border-radius: var(--radius-md);
    padding: var(--space-4);
  }
  .skeleton-bars {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
</style>
