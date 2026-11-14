<script lang="ts">
  /**
   * `/people` — Attendee list (DESIGN §3.3, TZ-06). The canonical, accessible
   * list backing the radar: search, status filters, per-card handshake
   * actions, 4 s poller trio (users + handshakes + chats), stable in-place
   * updates. Dismiss on an incoming card is a LOCAL collapse only (owner
   * ruling 2 — nothing is sent to the server). Chats-badge write-through on
   * every chats poll (§1.2).
   */
  import { get } from 'svelte/store';
  import { SvelteMap } from 'svelte/reactivity';
  import { ApiError, type Chat, type Handshake, type User } from '@bleak/api-client';
  import { identity } from '#lib/stores/identity';
  import { requireIdentityOrRedirect } from '#lib/nav/guard';
  import { api } from '#lib/api/client';
  import { Poller } from '#lib/polling/poller';
  import { deriveRelationships } from '#lib/room/relationships';
  import { evaluateChatsUnseen } from '#lib/stores/chatsSeen';
  import { locale, translate } from '#lib/i18n/locale';
  import {
    isDismissed,
    matchesFilter,
    matchesQuery,
    mergeRoster,
    stableRoster,
    type PeopleFilter
  } from '#lib/people/view';
  import PersonCard from '#lib/components/people/PersonCard.svelte';
  import type { Relationship } from '#lib/room/relationships';
  import SkeletonBlock from '#lib/components/SkeletonBlock.svelte';
  import ErrorBanner from '#lib/components/ErrorBanner.svelte';
  import EmptyState from '#lib/components/EmptyState.svelte';
  import SegmentedControl from '#lib/components/SegmentedControl.svelte';
  import PixelIcon from '#lib/components/icons/PixelIcon.svelte';

  // --- live data (polled snapshots stay in the owning route) ----------------
  let users = $state<readonly User[]>([]);
  let handshakes = $state<readonly Handshake[]>([]);
  let chats = $state<readonly Chat[]>([]);
  let loading = $state(true);
  let pollError = $state<null | { kind: 'network' | 'api'; message: string | null }>(null);

  // --- search + filter chips (§3.3) -----------------------------------------
  let query = $state('');
  let debouncedQuery = $state('');
  let filter = $state<PeopleFilter>('all');

  // --- per-card interaction state (component state, per page visit) ---------
  let expandedAddress = $state<string | null>(null);
  let sendingAddress = $state<string | null>(null);
  let actionError = $state<null | { address: string; kind: 'network' | 'api'; message: string | null }>(
    null
  );
  /** address → incomingAt recorded at dismiss time (ruling 2). */
  const dismissals = new SvelteMap<string, string>();

  // Debounced search input (150 ms, §3.3).
  $effect(() => {
    const value = query;
    const timer = setTimeout(() => (debouncedQuery = value), 150);
    return () => clearTimeout(timer);
  });

  async function pollTick(): Promise<void> {
    const id = get(identity);
    if (!id) throw new Error('identity missing');
    const [nextUsers, nextHandshakes, nextChats] = await Promise.all([
      api.listRoomUsers(id.roomAddress),
      api.listHandshakesOfUser(id.userAddress),
      api.listChatsOfUser(id.userAddress)
    ]);
    // Poll diffing: identical roster keeps its array reference (no re-render);
    // keyed each handles in-place updates / deletions; no duplicates (view.ts).
    users = mergeRoster(users, nextUsers);
    handshakes = nextHandshakes;
    chats = nextChats;
    evaluateChatsUnseen(nextChats);
    loading = false;
    pollError = null;
  }

  function errorFrom(cause: unknown): { kind: 'network' | 'api'; message: string | null } {
    if (cause instanceof ApiError) return { kind: 'api', message: cause.message };
    return { kind: 'network', message: null };
  }

  const poller = new Poller({
    intervalMs: 4000,
    backoffMs: 12_000,
    tick: pollTick,
    onStall: (cause) => (pollError = errorFrom(cause))
  });

  type RelationshipMap = Map<string, Relationship>;

  // Identity guard (TZ-03) + poller lifecycle (route file only, §2.2).
  $effect(() => {
    if (!requireIdentityOrRedirect()) return;
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

  // --- derived view ----------------------------------------------------------
  const me = $derived($identity);
  const relationships = $derived<RelationshipMap>(
    me ? deriveRelationships(me.userAddress, users, handshakes, chats) : new Map()
  );

  const memberCount = $derived(users.filter((user) => !user.deleted_at).length);
  const otherCount = $derived(
    me
      ? stableRoster(users).filter((user) => !user.deleted_at && user.address !== me.userAddress)
          .length
      : 0
  );

  const cards = $derived(
    me
      ? stableRoster(users)
          .filter((user) => !user.deleted_at && user.address !== me.userAddress)
          .filter((user) => {
            const relationship = relationships.get(user.address);
            return relationship ? matchesFilter(relationship.state, filter) : false;
          })
          .filter((user) => matchesQuery(user, debouncedQuery))
      : []
  );

  // Collapse the expanded card when its state stops being actionable.
  $effect(() => {
    const address = expandedAddress;
    if (address === null) return;
    const relationship = relationships.get(address);
    if (
      !relationship ||
      relationship.state !== 'incoming' ||
      isDismissed(dismissals, relationship)
    ) {
      expandedAddress = null;
    }
  });

  // --- actions ----------------------------------------------------------------
  function handshake(toAddress: string): void {
    const id = get(identity);
    if (!id || sendingAddress !== null) return;
    sendingAddress = toAddress;
    actionError = null;
    api
      .createHandshake({ from_address: id.userAddress, to_address: toAddress, status: 1 })
      .then(() => {
        // 200/201 identical (§3.2 criterion 7): the poll reflects the flip.
        return poller.refresh();
      })
      .catch((cause: unknown) => {
        actionError = { address: toAddress, ...errorFrom(cause) };
      })
      .finally(() => {
        sendingAddress = null;
      });
  }

  function toggleExpand(address: string): void {
    expandedAddress = expandedAddress === address ? null : address;
  }

  /** Local dismissal ONLY (ruling 2): collapse + record; no server call. */
  function dismiss(address: string, incomingAt: string | null): void {
    if (incomingAt) dismissals.set(address, incomingAt);
    if (expandedAddress === address) expandedAddress = null;
  }

  function resetSearch(): void {
    query = '';
    debouncedQuery = '';
    filter = 'all';
  }

  const filterOptions = $derived([
    { value: 'all', label: translate($locale, 'people.filter.all') },
    { value: 'sent', label: translate($locale, 'people.filter.sent') },
    { value: 'added', label: translate($locale, 'people.filter.added') },
    { value: 'chatting', label: translate($locale, 'people.filter.chatting') }
  ]);
  const searchPlaceholder = $derived(translate($locale, 'people.search.placeholder'));
  const searchLabel = $derived(translate($locale, 'people.search.label'));
  const filtersLabel = $derived(translate($locale, 'people.filters'));
  const emptyRoomMessage = $derived(translate($locale, 'people.empty'));
  const emptySearchMessage = $derived(
    translate($locale, 'people.empty_search', { q: debouncedQuery })
  );
  const resetLabel = $derived(translate($locale, 'people.reset'));
  const membersLabel = $derived(
    translate($locale, 'join.room.members', { n: String(memberCount) })
  );
</script>

<main class="people-page">
  <header class="header">
    <h1>{translate($locale, 'people.title')}</h1>
    <p class="count" aria-live="polite">{membersLabel}</p>
  </header>

  {#if pollError}
    <ErrorBanner
      kind={pollError.kind}
      message={pollError.message}
      onretry={() => void poller.refresh()}
    />
  {/if}

  <div class="controls">
    <div class="search pill">
      <PixelIcon name="search" size={16} />
      <input type="search" placeholder={searchPlaceholder} aria-label={searchLabel} bind:value={query} />
    </div>
    <div class="filters">
      <SegmentedControl options={filterOptions} value={filter} label={filtersLabel} onchange={(next) => (filter = next as PeopleFilter)} />
    </div>
  </div>

  {#if loading && users.length === 0}
    <ul class="cards" aria-hidden="true">
      {#each [0, 1, 2] as skeleton (skeleton)}
        <li class="skeleton-card">
          <div class="skeleton-row">
            <SkeletonBlock width="56px" height="56px" round />
            <div class="skeleton-bars">
              <SkeletonBlock width="60%" height="16px" />
              <SkeletonBlock width="40%" height="14px" />
            </div>
          </div>
        </li>
      {/each}
    </ul>
  {:else if me && cards.length === 0 && otherCount === 0}
    <EmptyState message={emptyRoomMessage} icon="face" />
  {:else if cards.length === 0 && debouncedQuery.trim() !== ''}
    <EmptyState message={emptySearchMessage} icon="search" />
    <div class="reset-row">
      <button type="button" class="reset" onclick={resetSearch}>{resetLabel}</button>
    </div>
  {:else}
    <ul class="cards" class:dimmed={pollError !== null}>
      {#each cards as user (user.address)}
        {@const relationship = relationships.get(user.address) ?? null}
        {@const dismissed = relationship ? isDismissed(dismissals, relationship) : false}
        {@const cardError =
          actionError !== null && actionError.address === user.address ? actionError : null}
        <PersonCard
          {user}
          {relationship}
          expanded={!dismissed && expandedAddress === user.address}
          sending={sendingAddress === user.address}
          error={cardError?.kind ?? null}
          errorMessage={cardError?.message ?? null}
          onsend={() => handshake(user.address)}
          onback={() => handshake(user.address)}
          ontoggle={() => toggleExpand(user.address)}
          ondismiss={() => dismiss(user.address, relationship?.incomingAt ?? null)}
        />
      {/each}
    </ul>
  {/if}
</main>

<style>
  .people-page {
    flex: 1;
    width: 100%;
    max-width: 720px;
    margin: 0 auto;
    padding: var(--space-5) var(--space-4) calc(var(--bottom-tabbar-height) + var(--space-5));
    display: flex;
    flex-direction: column;
  }
  .header {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--space-4);
  }
  .header h1 {
    font-size: 32px;
  }
  .count {
    margin: 0;
    font-size: 14px;
    color: var(--color-text-muted);
  }
  .controls {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    margin-top: var(--space-4);
  }
  .search {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    min-height: var(--touch-target);
    padding: 0 var(--space-4);
    background: var(--color-surface);
    border-radius: var(--radius-pill);
    color: var(--color-text-muted);
  }
  .search input {
    flex: 1;
    min-width: 0;
    background: transparent;
    border: none;
    color: var(--color-text);
    font-size: 14px;
    font-family: var(--font-body);
    letter-spacing: 0.02em;
    min-height: var(--touch-target);
  }
  .search input:focus {
    outline: none;
  }
  .search input::placeholder {
    color: var(--color-text-muted);
  }
  .filters {
    overflow-x: auto;
  }
  .cards {
    list-style: none;
    margin: var(--space-4) 0 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    transition: opacity 200ms ease-out;
  }
  .cards.dimmed {
    opacity: 0.5;
  }
  .reset-row {
    display: flex;
    justify-content: center;
    margin-top: var(--space-3);
  }
  .reset {
    background: transparent;
    border: 1px solid var(--color-text-disabled-strong);
    color: var(--color-text);
    border-radius: var(--radius-pill);
    min-height: var(--touch-target);
    padding: 0 var(--space-5);
    font-size: 14px;
    font-weight: 600;
  }
  .skeleton-card {
    background: var(--color-surface);
    border-radius: var(--radius-md);
    padding: var(--space-4);
  }
  .skeleton-row {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }
  .skeleton-bars {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  @media (min-width: 720px) {
    .cards {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
      align-items: start;
    }
    .skeleton-card {
      grid-column: span 1;
    }
  }
</style>
