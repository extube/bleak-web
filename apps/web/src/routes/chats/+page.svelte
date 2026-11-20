<script lang="ts">
  /**
   * /chats — Dialog list (DESIGN §3.4 as amended by §4.11.5–7, TZ-07).
   *
   * One Poller (route file only, §2.2): listChatsOfUser + cached
   * listRoomUsers (name resolution) at 4 s, refresh() on mount and
   * visibility regain, stop() on teardown. Visiting /chats writes the
   * chatsSeen store — the TabBar badge dot clears (§1.2, AC 6). Cards show
   * the counterpart (participants minus me; «+N» when ≠ 2) with the
   * v2.4 §4.11.5–7 item content: NO theme text; instead the LAST-MESSAGE
   * preview + its time — per the owner's 2026-11-18 frontend-only decision
   * each listed chat's transcript is fetched (`api.listChatMessages`,
   * light: chats are capped ≈26 messages) and the last message lands in
   * the session-local `lastMessages` cache. Cadence (owner ruling: mount +
   * every poll cycle for the visible list is acceptable): on mount and on
   * EVERY poll tick the visible chat addresses are refreshed through
   * `refreshLastMessages` — the store's in-flight guard keeps the 4 s
   * cadence from piling up requests, failures keep the previous cached
   * entry, and an empty transcript (fresh/cleared chat) shows no preview.
   *
   * §4.15.7 time sort (owner change, Concept §20): the list is ordered by
   * `stableChats` — a single time-based sort, newest `created_at` first —
   * superseding the §4.13.4 score-first ordering. The match/v2 score
   * fetch/cache (stores/matchScores) retired with it; the match/match-v2
   * API methods stay for the summary sheet (hard-match merges it there).
   */
  import { get } from 'svelte/store';
  import { ApiError, NetworkError, type Chat, type User } from '@bleak/api-client';
  import { identity, initIdentity } from '#lib/stores/identity';
  import { requireIdentityOrRedirect } from '#lib/nav/guard';
  import { api } from '#lib/api/client';
  import { Poller } from '#lib/polling/poller';
  import { markChatsSeen } from '#lib/stores/chatsSeen';
  import { refreshLastMessages, lastMessages } from '#lib/stores/lastMessage';
  import { describeChat, mergeChats, stableChats } from '#lib/chats/view';
  import { locale, translate } from '#lib/i18n/locale';
  import ChatCard from '#lib/components/chats/ChatCard.svelte';
  import SkeletonBlock from '#lib/components/SkeletonBlock.svelte';
  import ErrorBanner from '#lib/components/ErrorBanner.svelte';
  import EmptyState from '#lib/components/EmptyState.svelte';

  // Hard reload on a tab route: hydrate identity defensively (idempotent)
  // so the guard sees the persisted identity instead of bouncing to /.
  initIdentity();

  // --- polled live data (last-known snapshots survive failures) ----------
  let chats = $state<readonly Chat[]>([]);
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
    const [nextChats, nextUsers] = await Promise.all([
      api.listChatsOfUser(id.userAddress),
      api.listRoomUsers(id.roomAddress)
    ]);
    // Poll diff: identical sequence keeps its reference (no re-render, §2.2).
    chats = mergeChats(chats, nextChats);
    users = nextUsers;
    loading = false;
    pollError = null;
    // §4.11.6 last-message previews: refresh the visible list's cache every
    // tick (best-effort — failures never surface on the page itself).
    void refreshLastMessages(
      stableChats(chats).map((chat) => chat.address),
      id.userAddress,
      (address) => api.listChatMessages(address)
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
    // Visiting /chats clears the badge dot (§1.2, §3.4 AC 6).
    markChatsSeen();
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
  const lastByAddress = $derived($lastMessages);
  const cards = $derived(
    me
      ? // §4.15.7: a single time sort — newest created_at first (the
        // score-first ordering and its cache are retired).
        stableChats(chats).map((chat) => {
          const data = describeChat(chat, me.userAddress);
          return {
            ...data,
            user: data.counterpart ? (userByAddress.get(data.counterpart) ?? null) : null,
            lastMessage: lastByAddress.get(chat.address) ?? null
          };
        })
      : []
  );
</script>

<svelte:head>
  <title>{translate($locale, 'chats.title')}</title>
</svelte:head>

<main class="chats-page">
  <header class="header">
    <h1>{translate($locale, 'chats.title')}</h1>
    <p class="subtitle">{translate($locale, 'chats.subtitle')}</p>
  </header>

  {#if pollError}
    <ErrorBanner
      kind={pollError.kind}
      message={pollError.message}
      onretry={() => void poller.refresh()}
    />
  {/if}

  {#if loading && chats.length === 0}
    <ul class="cards" aria-hidden="true">
      {#each [0, 1] as skeleton (skeleton)}
        <li class="skeleton-card">
          <div class="skeleton-row">
            <SkeletonBlock width="56px" height="56px" round />
            <div class="skeleton-bars">
              <SkeletonBlock width="55%" height="16px" />
              <SkeletonBlock width="35%" height="14px" />
            </div>
          </div>
        </li>
      {/each}
    </ul>
  {:else if me && !loading && chats.length === 0}
    <EmptyState
      message={translate($locale, 'chats.empty')}
      icon="dialog-lines"
      ctaLabel={translate($locale, 'chats.find_people')}
      href="/people"
    />
  {:else}
    <ul class="cards" class:dimmed={pollError !== null}>
      {#each cards as card (card.chat.address)}
        <ChatCard
          chat={card.chat}
          counterpart={card.user}
          counterpartAddress={card.counterpart}
          extra={card.extra}
          lastMessage={card.lastMessage}
        />
      {/each}
    </ul>
  {/if}
</main>

<style>
  .chats-page {
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
  }
</style>
