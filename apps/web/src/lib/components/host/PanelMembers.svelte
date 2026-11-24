<script lang="ts">
  /**
   * PanelMembers (DESIGN rev. 4 §3.7.2 region 1): the live members region
   * of the `/host/[room_address]` panel. Summary tile «Участники
   * {n}/{max_user}» (listRoomUsers.length vs getRoom.max_user), member
   * rows (avatar, name, joined time from created_at); a row tap opens the
   * member drill-down sheet (on-demand, NEVER polled — the page fetches).
   * Presentational: the page owns the 5 s Poller and all API calls.
   * Public reads only here — no handshake counts anywhere (rule B).
   */
  import type { Room, User } from '@bleak/api-client';
  import { locale, translate } from '#lib/i18n/locale';
  import { relativeTime, stableRoster } from '#lib/people/view';
  import StatTile from '#lib/components/StatTile.svelte';
  import ErrorBanner from '#lib/components/ErrorBanner.svelte';
  import EmptyState from '#lib/components/EmptyState.svelte';
  import PixelAvatar from '#lib/components/PixelAvatar.svelte';
  import SkeletonBlock from '#lib/components/SkeletonBlock.svelte';

  interface Props {
    room: Room | null;
    members: readonly User[];
    loading: boolean;
    pollError: null | { kind: 'network' | 'api'; message: string | null };
    onopenMember: (user: User) => void;
    onretry: () => void;
  }

  let { room, members, loading, pollError, onopenMember, onretry }: Props = $props();

  let now = $state(Date.now());

  const roster = $derived(stableRoster(members));
  const membersTileLabel = $derived(translate($locale, 'host.stats.members_only'));
  const emptyMessage = $derived(translate($locale, 'host.empty_live'));

  function memberLabel(user: User): string {
    return translate($locale, 'host.member.open', { name: user.name });
  }

  function joinedAt(user: User): string {
    return relativeTime(user.created_at, now, $locale);
  }
</script>

<section class="members" aria-label={translate($locale, 'host.stats.members')}>
  {#if pollError}
    <ErrorBanner kind={pollError.kind} message={pollError.message} onretry={() => onretry()} />
  {/if}

  <div class="tiles">
    <StatTile value={`${roster.length}/${room?.max_user ?? '—'}`} label={membersTileLabel} />
  </div>

  {#if loading && roster.length === 0}
    <ul class="rows" aria-hidden="true">
      {#each [0, 1, 2] as skeleton (skeleton)}
        <li class="row skeleton">
          <SkeletonBlock width="40px" height="40px" round />
          <SkeletonBlock width="45%" height="16px" />
        </li>
      {/each}
    </ul>
  {:else if roster.length === 0}
    <EmptyState message={emptyMessage} icon="face" />
  {:else}
    <ul class="rows" class:dimmed={pollError !== null}>
      {#each roster as user (user.address)}
        <li>
          <button
            type="button"
            class="row"
            aria-label={memberLabel(user)}
            onclick={() => onopenMember(user)}
          >
            <PixelAvatar address={user.address} size={40} label="" />
            <span class="name">{user.name}</span>
            <span class="joined" title={user.created_at}>{joinedAt(user)}</span>
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</section>

<style>
  .members {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }
  .tiles {
    display: grid;
    grid-template-columns: 1fr;
    gap: var(--space-3);
  }
  .rows {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    transition: opacity 200ms ease-out;
  }
  .rows.dimmed {
    opacity: 0.5;
  }
  .row {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    width: 100%;
    min-height: var(--touch-target);
    padding: var(--space-2) var(--space-3);
    background: var(--color-surface);
    border: none;
    border-radius: var(--radius-md);
    color: var(--color-text);
    text-align: left;
    font-family: var(--font-body);
    font-size: 16px;
    transition: opacity 120ms ease-out;
  }
  .row.skeleton {
    background: var(--color-surface);
  }
  .name {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .joined {
    font-size: 14px;
    color: var(--color-text-muted);
  }
</style>
