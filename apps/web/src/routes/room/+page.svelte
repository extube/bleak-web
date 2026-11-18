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
    layoutRadarNodes,
    moreCounterPlacement,
    nodePosition,
    radarPlacement,
    radarStageSize,
    RING_ORBIT_DURATIONS_S
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
    if (!hasLoaded) {
      hasLoaded = true;
      // §4.9.2: the phase epoch for the per-ring orbit layers — every
      // orbit unit back-dates its spin to this moment (see orbitDelayFor).
      orbitEpoch = performance.now();
    }
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
  let stageWrapEl: HTMLElement | null = $state(null);

  // Measured once per mount + on resize (no ResizeObserver dependency);
  // px math in lib/room/radar.ts uses these (fraction of the max dimension).
  // §4.10.1 (Concept §9.1.3): the stage element is a SQUARE of side
  // max(clientWidth, clientHeight) of the measured box — the radar spans
  // the larger viewport dimension; the clipping wrapper below hides the
  // overflow beyond the viewport edge (no horizontal scrollbar).
  $effect(() => {
    const el = stageWrapEl;
    if (!el) return;
    const measure = (): void => {
      const rect = el.getBoundingClientRect();
      const stage = radarStageSize(rect.width, rect.height);
      stageW = stage.width;
      stageH = stage.height;
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
  // Collision-avoided layout (§4.8.3): one deterministic pass resolves
  // every node's final position (center exclusion, on-canvas, no overlap).
  const layout = $derived(
    me
      ? layoutRadarNodes(
          capped.shown.map((user) => {
            const rel = relMap.get(user.address) as Relationship;
            return { address: user.address, state: rel.state };
          }),
          stageW,
          stageH
        )
      : []
  );
  const nodes = $derived(
    layout.map((point) => {
      const user = capped.shown.find((u) => u.address === point.address) as User;
      return { user, rel: relMap.get(point.address) as Relationship, point };
    })
  );
  const aroundCount = $derived(others.length);

  // --- §4.9.1/4.9.2/4.9.12: per-ring orbit speeds, upright riding --------
  // Each node (and the «+N ещё» counter) rides inside its own full-stage
  // rotating .orbit-unit whose spin duration is its ring's speed
  // (RING_ORBIT_DURATIONS_S: ring 1 60s, ring 2 90s, ring 3 20s — one
  // rotating layer per ring, §4.9.2). Units mount at different moments
  // (first tick, later joiners), so each unit gets a negative
  // animation-delay back-dating its start to the radar's common epoch
  // (the first successful tick): every unit's spin phase becomes
  // (t − epoch)/duration — same-ring nodes always form one rigid rotating
  // group, cross-ring speeds stay distinct. The node content
  // counter-rotates inside (RadarNode §4.9.1) with the same vars, so
  // icons stay upright. Node elements are keyed stable, so a ring-level
  // change only swaps the unit's duration/left-top — the button's CSS
  // left/top transition (§4.9.12) glides it to the new ring smoothly.
  // Plain-object memoization (deliberately NOT reactive state: re-renders
  // must never touch a unit's phase once set).
  let orbitEpoch: number | null = null;
  const orbitDelays: Record<string, number> = {};
  const MORE_ORBIT_KEY = '__radar-more__';

  // Negative delay (seconds) that phase-locks a unit mounting NOW to the
  // common epoch; memoized per key so re-renders never touch the phase.
  function orbitDelayFor(key: string): number {
    const memo = orbitDelays[key];
    if (memo !== undefined) return memo;
    const delay =
      orbitEpoch === null ? 0 : Math.round((performance.now() - orbitEpoch) / 1000 * 1000) / 1000;
    orbitDelays[key] = delay;
    return delay;
  }

  // Prune delay entries of nodes that left the radar (they re-enter
  // phase-locked: the epoch formula is independent of mount time).
  $effect(() => {
    const live: Record<string, true> = {};
    for (const node of nodes) live[node.user.address] = true;
    if (capped.extra > 0) live[MORE_ORBIT_KEY] = true;
    for (const key of Object.keys(orbitDelays)) {
      if (!(key in live)) delete orbitDelays[key];
    }
  });

  interface OrbitItem {
    key: string;
    ring: 0 | 1 | 2;
    durationS: number;
    delayS: number;
    node: (typeof nodes)[number];
  }

  const orbitItems = $derived.by(() => {
    // Set-once memoization of the phase delays (see orbitDelayFor).
    return nodes.map((node): OrbitItem => {
      const ring = node.point.ring;
      return {
        key: node.user.address,
        ring,
        durationS: RING_ORBIT_DURATIONS_S[ring],
        delayS: orbitDelayFor(node.user.address),
        node
      };
    });
  });
  const moreOrbit = $derived.by(() => {
    if (capped.extra <= 0) return null;
    return {
      durationS: RING_ORBIT_DURATIONS_S[2],
      delayS: orbitDelayFor(MORE_ORBIT_KEY)
    };
  });

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

    <main class="stage" bind:this={stageWrapEl}>
      <!-- §4.10.1: the radar stage is a SQUARE of side max(w, h), centered
           in the clipping wrapper; the wrapper (overflow: hidden) clips the
           overflow beyond the viewport edge — no horizontal scrollbar. -->
      <div class="radar-stage" style:width="{stageW}px" style:height="{stageH}px">
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
        {:else if nodes.length > 0}
          <!-- §4.9.1/4.9.2: one rotating orbit layer per ring speed. Each
               node rides its own full-stage .orbit-unit at its ring's
               duration (60s/90s/20s, RING_ORBIT_DURATIONS_S), phase-locked
               to the common epoch via a negative --orbit-delay; the node
               content counter-rotates inside (RadarNode §4.9.1) so icons
               stay upright while riding. §4.9.12: elements are keyed
               stable, so ring-level changes glide via the button's CSS
               left/top transition. The «+N ещё» counter rides the outer
               (ring 3) speed and stays upright too. -->
          <div class="nodes-orbit" class:dimmed={banner !== null}>
            {#each orbitItems as item (item.key)}
              <div
                class="orbit-unit"
                class:ring-0={item.ring === 0}
                class:ring-1={item.ring === 1}
                class:ring-2={item.ring === 2}
                style:--orbit-duration="{item.durationS}s"
                style:--orbit-delay="-{item.delayS}s"
              >
                <RadarNode
                  user={item.node.user}
                  relationship={item.node.rel}
                  x={item.node.point.x}
                  y={item.node.point.y}
                  onclick={() => openNode(item.node.user)}
                />
              </div>
            {/each}
            {#if moreOrbit}
              <div
                class="orbit-unit ring-2"
                style:--orbit-duration="{moreOrbit.durationS}s"
                style:--orbit-delay="-{moreOrbit.delayS}s"
              >
                <span
                  class="more-counter"
                  style:left="{morePos.x}px"
                  style:top="{morePos.y}px"
                >{moreLabel}</span>
              </div>
            {/if}
          </div>
        {/if}
      </div>
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
  /* §4.10.1 (Concept §9.1.3): the radar stage element is a SQUARE of side
   * max(clientWidth, clientHeight) — the radar spans the larger viewport
   * dimension. Centered on the page; the clipping wrapper above hides the
   * overflow beyond the viewport edge (no horizontal scrollbar). All
   * placement guarantees (lib/room/radar.ts) stay relative to the STAGE. */
  .radar-stage {
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
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
  /* §4.9.1/4.9.2: the nodes layer groups the per-ring orbit units (and
   * dims as a whole during a banner). Static — the rotation lives on the
   * units below. */
  .nodes-orbit {
    position: absolute;
    inset: 0;
    transition: opacity 200ms ease-out;
  }
  .nodes-orbit.dimmed {
    opacity: 0.5;
  }
  /* One rotating orbit layer per ring speed (§4.9.2, transform-only —
   * §4.6; disabled under prefers-reduced-motion by the base.css
   * catch-all): a full-stage layer spinning at the ring's duration, with
   * the negative --orbit-delay back-dating it to the radar's common epoch
   * so units mounting later stay phase-locked with their ring group.
   * Layers stack full-stage and never intercept pointers — the node
   * buttons stay the only hit targets (§2.6). */
  .orbit-unit {
    position: absolute;
    inset: 0;
    pointer-events: none;
    animation: orbit-spin var(--orbit-duration, 90s) linear infinite;
    animation-delay: var(--orbit-delay, 0s);
  }
  /* The «+N ещё» counter rides the outer ring (ring 3 speed, §4.9.2) and
   * stays upright (§4.9.1): the composed keyframes keep the centering
   * translate while counter-rotating against its unit's spin (same
   * inherited duration/delay vars ⇒ phase-locked at mount). */
  .more-counter {
    position: absolute;
    /* Base centering translate (the animated keyframes compose the same
     * translate + counter-rotation while the spin runs; under reduced
     * motion the animation ends instantly and this base applies). */
    transform: translate(-50%, -50%);
    font-size: 14px;
    color: var(--color-text-muted);
    animation: orbit-counter-tx var(--orbit-duration, 20s) linear infinite;
    animation-delay: var(--orbit-delay, 0s);
  }
  @keyframes orbit-spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }
  @keyframes orbit-counter-tx {
    from {
      transform: translate(-50%, -50%) rotate(0deg);
    }
    to {
      transform: translate(-50%, -50%) rotate(-360deg);
    }
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
