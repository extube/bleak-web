<script lang="ts">
  /**
   * /room — Radar "Around me" (DESIGN §3.2, TZ-05).
   *
   * One Poller (route file only, §2.2): listRoomUsers + listHandshakesOfUser
   * + listChatsOfUser at 4 s, refresh() on mount and visibility regain,
   * stop() on teardown. getRoom runs once per mount for the header name.
   * Node placement is deterministic (lib/room/radar.ts + relationships);
   * each chat-list tick is written through to the chatsSeen store (§1.2
   * badge contract). The scan icon-button mounts the QrScanner (context *b*,
   * placeholder until TZ-04 — public API only); closing forces a refresh so
   * a scanner-success counterpart lands on the inner ring (AC 14).
   */
  import { ApiError, NetworkError } from '@bleak/api-client';
  import type { Chat, Handshake, User } from '@bleak/api-client';
  import { api } from '#lib/api/client';
  import { locale, translate } from '#lib/i18n/locale';
  import { identity, initIdentity, type Identity } from '#lib/stores/identity';
  import { requireIdentityOrRedirect } from '#lib/nav/guard';
  import { Poller } from '#lib/polling/poller';
  import { evaluateChatsUnseen } from '#lib/stores/chatsSeen';
  import { deriveRelationships, type Relationship } from '#lib/room/relationships';
  import {
    capRadarNodes,
    moreCounterPlacement,
    nodePosition,
    radarPlacement
  } from '#lib/room/radar';
  import PixelIcon from '#lib/components/icons/PixelIcon.svelte';
  import PixelAvatar from '#lib/components/PixelAvatar.svelte';
  import ErrorBanner from '#lib/components/ErrorBanner.svelte';
  import HandshakeSheet from '#lib/components/HandshakeSheet.svelte';
  import QrScanner from '#lib/components/QrScanner.svelte';
  import RadarRings from '#lib/components/radar/RadarRings.svelte';
  import RadarNode from '#lib/components/radar/RadarNode.svelte';

  // Hard reload on /room: the layout hydrates identity in its onMount,
  // which runs after this page's script — hydrate defensively (idempotent)
  // so the guard sees the persisted identity instead of bouncing to /.
  initIdentity();
  const guarded = requireIdentityOrRedirect();

  const me = $derived($identity);

  // --- polled live data (last-known snapshots survive failures) ----------
  let hasLoaded = $state(false);
  let roomUsers = $state<readonly User[]>([]);
  let myHandshakes = $state<readonly Handshake[]>([]);
  let myChats = $state<readonly Chat[]>([]);
  let banner = $state<{ kind: 'network' | 'api'; text: string | null } | null>(null);

  // --- header (one getRoom per mount) ------------------------------------
  let roomName = $state<string | null>(null);
  $effect(() => {
    const id = me;
    if (!id || !guarded) return;
    let alive = true;
    api
      .getRoom(id.roomAddress)
      .then((room) => {
        if (alive) roomName = room.name;
      })
      .catch(() => {
        /* the address stands in as the label; poll failures surface via banner */
      });
    return () => {
      alive = false;
    };
  });

  // --- error mapping (§2.1: banner copy, recovery per poll tick) ---------
  function serverText(err: unknown): string | null {
    if (!(err instanceof ApiError)) return err instanceof Error ? err.message : null;
    const marker = ': ';
    const idx = err.message.indexOf(marker);
    return idx >= 0 ? err.message.slice(idx + marker.length) : err.message;
  }

  function bannerOf(err: unknown): { kind: 'network' | 'api'; text: string | null } {
    return err instanceof NetworkError
      ? { kind: 'network', text: null }
      : { kind: 'api', text: serverText(err) };
  }

  // --- the page Poller (route file only, architecture §5) ----------------
  let pollerRef: Poller | null = null;

  async function runTick(id: Identity): Promise<void> {
    const [users, handshakes, chats] = await Promise.all([
      api.listRoomUsers(id.roomAddress),
      api.listHandshakesOfUser(id.userAddress),
      api.listChatsOfUser(id.userAddress)
    ]);
    roomUsers = users;
    myHandshakes = handshakes;
    myChats = chats;
    // Badge-dot write-through (§1.2): each chats poll feeds chatsSeen.
    evaluateChatsUnseen(chats);
    hasLoaded = true;
    banner = null; // recovery auto-dismisses the banner (AC 9)
  }

  $effect(() => {
    const id = me;
    if (!id || !guarded) return;
    const poller = new Poller({
      intervalMs: 4000,
      tick: () => runTick(id),
      onStall: (err) => (banner = bannerOf(err))
    });
    pollerRef = poller;
    poller.start();
    void poller.refresh(); // immediate tick on route mount (§2.2)
    const onVisibility = (): void => {
      if (document.visibilityState === 'visible') void poller.refresh();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      poller.stop();
      if (pollerRef === poller) pollerRef = null;
    };
  });

  // --- radar stage geometry ----------------------------------------------
  let stageW = $state(0);
  let stageH = $state(0);
  let stageEl: HTMLElement | null = $state(null);

  // Measured once per mount + on resize (no ResizeObserver dependency);
  // px math in lib/room/radar.ts uses these (fraction of the min dimension).
  $effect(() => {
    const el = stageEl;
    if (!el) return;
    const measure = (): void => {
      const rect = el.getBoundingClientRect();
      stageW = rect.width;
      stageH = rect.height;
    };
    measure();
    window.addEventListener('resize', measure);
    return () => {
      window.removeEventListener('resize', measure);
    };
  });

  const relMap = $derived(
    me
      ? deriveRelationships(me.userAddress, roomUsers, myHandshakes, myChats)
      : new Map<string, Relationship>()
  );
  const others = $derived(me ? roomUsers.filter((user) => relMap.has(user.address)) : []);
  const capped = $derived(capRadarNodes(others));
  const nodes = $derived(
    capped.shown.map((user) => {
      const rel = relMap.get(user.address) as Relationship;
      return { user, rel, placement: radarPlacement(user.address, rel.state) };
    })
  );
  const aroundCount = $derived(others.length);
  const myUser = $derived(
    me ? (roomUsers.find((user) => user.address === me.userAddress) ?? null) : null
  );
  const morePos = $derived(nodePosition(moreCounterPlacement(), stageW, stageH));
  const moreLabel = $derived(translate($locale, 'room.members_more', { n: String(capped.extra) }));
  const healthy = $derived(hasLoaded && banner === null);
  // Top-bar member count: non-deleted members (soft-deleted rows are not
  // "in the room" any more; the radar excludes them too).
  const activeMembers = $derived(roomUsers.filter((user) => !user.deleted_at).length);

  // Loading skeleton dots on the rings (no ring animation until data).
  const loadingDots = $derived(
    [0, 1, 2, 3].map((i) => nodePosition(radarPlacement(`__loading-${i}__`, 'none'), stageW, stageH))
  );

  // --- HandshakeSheet (§3.2 bottom sheet; single source of actions) ------
  let sheetOpen = $state(false);
  let selectedAddress = $state<string | null>(null);
  let sheetSending = $state(false);
  let sheetError = $state<'network' | 'api' | 'income' | null>(null);
  let sheetErrorText = $state<string | null>(null);

  const selectedUser = $derived(
    selectedAddress ? (roomUsers.find((user) => user.address === selectedAddress) ?? null) : null
  );
  const selectedRel = $derived(selectedAddress ? (relMap.get(selectedAddress) ?? null) : null);

  function openNode(user: User): void {
    selectedAddress = user.address;
    sheetError = null;
    sheetErrorText = null;
    sheetOpen = true;
  }

  async function sendToSelected(): Promise<void> {
    const id = me;
    const user = selectedUser;
    if (!id || !user || sheetSending) return;
    sheetSending = true;
    sheetError = null;
    sheetErrorText = null;
    try {
      // 200 and 201 are treated identically (idempotent per directed pair).
      await api.createHandshake({
        from_address: id.userAddress,
        to_address: user.address,
        status: 1
      });
      // The node moves to the middle/inner ring within one refresh (AC 5/6).
      await pollerRef?.refresh();
    } catch (err) {
      // Inline recovery in the sheet: the button returns to its active
      // state. A 403 is the §2.9 income-rule state — no optimistic "sent"
      // flip, the node stays on its ring (AC 15), nothing was sent.
      if (err instanceof ApiError && err.status === 403) {
        sheetError = 'income';
        sheetErrorText = serverText(err);
      } else {
        sheetError = err instanceof NetworkError ? 'network' : 'api';
        sheetErrorText = err instanceof NetworkError ? null : serverText(err);
      }
    } finally {
      sheetSending = false;
    }
  }

  // --- scanner (context *b*; placeholder until TZ-04) --------------------
  let scanOpen = $state(false);
  function onScannerClosed(): void {
    // Scanner success (or any close) → force a refresh so a mutual
    // counterpart lands on the inner ring within one refresh (AC 14).
    void pollerRef?.refresh();
  }
</script>

<svelte:head>
  <title>{translate($locale, 'room.title')}</title>
</svelte:head>

{#if guarded && me}
  <div class="page">
    <h1 class="vh">{translate($locale, 'room.title')}</h1>

    <header class="top-bar">
      <h2 class="room-name">{roomName ?? me.roomAddress}</h2>
      <div class="tools">
        <button
          type="button"
          class="scan"
          aria-label={translate($locale, 'room.scan.open')}
          onclick={() => (scanOpen = true)}
        >
          <PixelIcon name="scan" size={16} />
        </button>
        <span class="live-dot" class:stalled={!healthy} aria-hidden="true"></span>
        <span class="members">{activeMembers}</span>
      </div>
    </header>

    {#if banner}
      <div class="banner">
        <ErrorBanner kind={banner.kind} message={banner.text} onretry={() => void pollerRef?.refresh()} />
      </div>
    {/if}

    <main class="stage" bind:this={stageEl}>
      <RadarRings animate={hasLoaded} />

      <div class="center">
        <div class="me-chip pixel-corners">
          <PixelAvatar address={me.userAddress} size={64} own label={myUser?.name ?? me.userAddress} />
          <span class="me-name">{myUser?.name ?? me.userAddress}</span>
        </div>
        <p class="around" aria-live="polite">
          {translate($locale, 'room.around', { n: String(aroundCount) })}
        </p>
        {#if hasLoaded && aroundCount === 0}
          <p class="empty-copy">{translate($locale, 'room.empty')}</p>
        {/if}
      </div>

      {#if !hasLoaded}
        {#each loadingDots as dot, i (i)}
          <span
            class="skel-dot"
            style:left="{dot.x}px"
            style:top="{dot.y}px"
            aria-hidden="true"
          ></span>
        {/each}
      {:else}
        <div class="nodes" class:dimmed={banner !== null}>
          {#each nodes as node (node.user.address)}
            <RadarNode
              user={node.user}
              relationship={node.rel}
              placement={node.placement}
              stageWidth={stageW}
              stageHeight={stageH}
              onclick={() => openNode(node.user)}
            />
          {/each}
          {#if capped.extra > 0}
            <span
              class="more-counter"
              style:left="{morePos.x}px"
              style:top="{morePos.y}px"
            >{moreLabel}</span>
          {/if}
        </div>
      {/if}
    </main>

    <HandshakeSheet
      bind:open={sheetOpen}
      user={selectedUser}
      relationship={selectedRel}
      sending={sheetSending}
      error={sheetError}
      errorMessage={sheetErrorText}
      onsend={() => void sendToSelected()}
      onclose={() => (selectedAddress = null)}
    />

    <QrScanner
      bind:open={scanOpen}
      context="persona"
      members={roomUsers}
      onClosed={onScannerClosed}
    />
  </div>
{/if}

<style>
  .vh {
    position: absolute;
    width: 1px;
    height: 1px;
    margin: -1px;
    clip-path: inset(50%);
    overflow: hidden;
    white-space: nowrap;
  }
  .page {
    display: flex;
    flex-direction: column;
    height: 100dvh;
  }
  .top-bar {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    height: 56px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    padding: 0 var(--space-3);
    background: var(--color-surface);
    z-index: 20;
  }
  .room-name {
    font-size: 24px;
    margin: 0;
    min-width: 0;
    max-width: 60%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .tools {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    flex-shrink: 0;
  }
  .scan {
    width: var(--touch-target);
    height: var(--touch-target);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    color: var(--color-text-muted);
    border-radius: var(--radius-pill);
    transition: color 120ms ease-out;
  }
  /* Live dot: pulsing accent while the poller is healthy; solid muted
   * in error/backoff (§3.2 top bar). Opacity/scale only (§4.6). */
  .live-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--color-accent);
    animation: live-pulse 1.6s ease-in-out infinite;
  }
  .live-dot.stalled {
    background: var(--color-text-muted);
    animation: none;
  }
  .members {
    font-size: 14px;
    color: var(--color-text-muted);
    min-width: 1.5em;
    text-align: right;
  }
  .banner {
    position: fixed;
    top: calc(56px + var(--space-3));
    left: var(--space-3);
    right: var(--space-3);
    z-index: 15;
  }
  .banner > :global(*) {
    margin-bottom: 0;
  }
  .stage {
    position: relative;
    flex: 1;
    margin-top: 56px;
    margin-bottom: var(--bottom-tabbar-height);
    overflow: hidden;
  }
  .center {
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-2);
    z-index: 2;
    max-width: 80%;
    text-align: center;
  }
  .me-chip {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-1);
    background: var(--color-surface);
    padding: var(--space-3) var(--space-4);
  }
  .me-name {
    font-size: 14px;
    color: var(--color-text);
    max-width: 120px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .around {
    margin: 0;
    font-size: 14px;
    color: var(--color-text-muted);
  }
  .empty-copy {
    margin: var(--space-2) 0 0;
    font-size: 14px;
    color: var(--color-text-muted);
    max-width: 260px;
  }
  .skel-dot {
    position: absolute;
    width: 20px;
    height: 20px;
    transform: translate(-50%, -50%);
    border-radius: 50%;
    background: var(--color-surface-elevated);
    animation: skel-pulse 1.2s ease-in-out infinite;
  }
  .nodes {
    transition: opacity 200ms ease-out;
  }
  .nodes.dimmed {
    opacity: 0.5;
  }
  .more-counter {
    position: absolute;
    transform: translate(-50%, -50%);
    font-size: 14px;
    color: var(--color-text-muted);
  }
  @keyframes live-pulse {
    0%,
    100% {
      opacity: 1;
      transform: scale(1);
    }
    50% {
      opacity: 0.4;
      transform: scale(0.75);
    }
  }
  @keyframes skel-pulse {
    0%,
    100% {
      opacity: 0.4;
    }
    50% {
      opacity: 0.8;
    }
  }
</style>
