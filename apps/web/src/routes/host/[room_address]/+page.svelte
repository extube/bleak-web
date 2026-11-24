<script lang="ts">
  /**
   * `/host/[room_address]` — main admin panel (DESIGN rev. 4 §3.7.2,
   * TZ13-03 Part A) + the rule-A statistics region (§3.7.5, Part B).
   * Both render on ONE route sharing its Poller (§2.2 rev. 4 row:
   * members 5 s, stats every third tick ⇒ 15 s).
   *
   * - **Guard:** the stored `bleak.hostRoom.roomAddress` must equal the
   *   URL param, else redirect `/host`; missing entry → `/host`.
   * - **Top bar:** back control (→ `/host`), live room `h1` from public
   *   `getRoom`, muted address chip, read-only data chips «Язык
   *   агентов…» / «Вместимость…» (F9: data display, NEVER controls) with
   *   the server-amendment hint under them.
   * - **Region 1 — members** (5 s public poll): tile «Участники
   *   {n}/{max_user}», member rows; row tap → member drill-down sheet
   *   (on-demand, never polled): the room-token `listChatsOfRoomUser`
   *   REAL listing; rows link to the read-only /chats/{address}
   *   transcript and carry «Очистить историю» (confirm →
   *   `clearChatHistory`) and «Запустить заново» (§3.5 kickoff copy →
   *   `kickoffChat`; the KickoffResponse speaker line). Kickoff is
   *   per-dialog only — no room-level batch restart exists and none is
   *   faked. The rule-D locked row renders at the sheet's bottom — NO
   *   `deleteRoomUser` call anywhere in host code (§9.4.1-d).
   * - **Region 2 — statistics:** the StatsPanel (rule-A engine inside
   *   this page's Poller; handshake metrics 5–7 are rule-B gated — the
   *   hint line only, no proxy, §9.4.1-c).
   * - **Region 3 — share:** ShareKit (big Handjet code + copy chip,
   *   client-side `InviteQr`, join deep link, «Все коды приглашения»).
   * - **Region 4 — settings** (collapsible, last): updateRoom (room
   *   token; `{ name, description }` ONLY) → transient «Сохранено»,
   *   header refreshes from the PUT response; 400 → server-text field
   *   error; «Сгенерировать ключ комнаты» → confirm → rotateRoomToken →
   *   the stored token replaced IN PLACE; danger zone «Удалить комнату»
   *   → confirm → deleteRoom → `bleak.hostRoom` cleared → `/host`.
   * - **Host session reset:** hostApi 401/403 on any room-token call →
   *   `bleak.hostRoom` cleared, `bleak.hostNotice` set, lands on `/host`
   *   (log-in mode + notice); attendee identity never touched. `getRoom`
   *   404 → «Комната удалена.» full-page state → cleared + redirect.
   * - NO handshake counts anywhere (rule B negative, AC 8).
   * - **Responsive:** ≥ 900px two-column (main ≈ 58% scrolls, sticky
   *   side ≈ 42% holds share + invite shortcut; max 1080px); below,
   *   regions stack in the specified order.
   */
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { get } from 'svelte/store';
  import { ApiError, type Room, type User } from '@bleak/api-client';
  import { hostApi, HOST_NOTICE_KEY } from '#lib/api/client';
  import { apiErrorText } from '#lib/join';
  import { Poller } from '#lib/polling/poller';
  import { locale, translate } from '#lib/i18n/locale';
  import {
    clearHostRoom,
    hostRoom,
    initHostSession,
    updateHostRoomToken
  } from '#lib/stores/hostSession';
  import { generateTokenSecret } from '#lib/crypto/secrets';
  import { mergeRoster } from '#lib/people/view';
  import { speakerName } from '#lib/chats/view';
  import { guardRoomAddress, isStatsTick, statsEqual } from '#lib/components/host/hostPanel';
  import { runStatsPass, type HostStats } from '#lib/components/host/stats/hostStats';
  import PanelMembers from '#lib/components/host/PanelMembers.svelte';
  import MemberDrillDown, { type DrillDialog } from '#lib/components/host/MemberDrillDown.svelte';
  import ShareKit from '#lib/components/host/ShareKit.svelte';
  import PanelSettings from '#lib/components/host/PanelSettings.svelte';
  import StatsPanel from '#lib/components/host/stats/StatsPanel.svelte';
  import Chip from '#lib/components/Chip.svelte';

  // --- guard (§3.7.2): the stored room must match the URL param -----------
  const roomParam = $derived(page.params.room_address ?? '');
  let booted = $state(false);
  let redirecting = $state(false);

  $effect(() => {
    if (booted) return;
    initHostSession();
    booted = true;
    if (!guardRoomAddress(get(hostRoom), roomParam)) {
      // Missing or mismatched entry → /host (§1.3).
      redirecting = true;
      void goto(resolve('/host'));
    }
  });

  // --- polled live data (last-known snapshots survive failures) -----------
  let room = $state<Room | null>(null);
  let members = $state<readonly User[]>([]);
  let loadingLive = $state(true);
  let pollError = $state<null | { kind: 'network' | 'api'; message: string | null }>(null);
  let roomDeleted = $state(false);

  function errorFrom(cause: unknown): { kind: 'network' | 'api'; message: string | null } {
    if (cause instanceof ApiError) return { kind: 'api', message: apiErrorText(cause) };
    return { kind: 'network', message: null };
  }

  /**
   * Host session reset: a 401/403 on any room-token call means revoked
   * access — the hostApi gate already cleared `bleak.hostRoom` and set
   * `bleak.hostNotice`; the panel clears again (idempotent), keeps the
   * flag and lands on `/host` (log-in mode + notice). Attendee identity
   * is NEVER touched here.
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

  // --- region 2: rule-A statistics engine (§3.7.5) -------------------------
  let stats = $state<HostStats | null>(null);
  let statsLoading = $state(true);

  /**
   * One stats pass: the engine reuses THIS poll's latest member snapshot
   * (never re-fetches the member list), fans out with bounded
   * concurrency and the page diffs the result — identical ticks keep the
   * previous reference (no re-render, §3.7.5 AC 12).
   */
  async function runStats(): Promise<void> {
    const current = get(hostRoom);
    if (!current) return;
    try {
      const next = await runStatsPass(current.roomAddress, members, {
        now: Date.now(),
        listChats: (room, address) => hostApi.listChatsOfRoomUser(room, address),
        listMessages: (room, address, chat) => hostApi.listRoomUserChatMessages(room, address, chat)
      });
      statsLoading = false;
      if (!statsEqual(stats, next)) stats = next;
    } catch {
      /* the pass never rethrows past branch tolerance — keep last-known */
    }
  }

  // --- the ONE page Poller (§2.2): members 5 s, stats every third tick -----
  let tickNo = 0;

  async function pollTick(): Promise<void> {
    const current = get(hostRoom);
    if (!current) throw new Error('no host room');
    const [nextRoom, nextMembers] = await Promise.all([
      hostApi.getRoom(current.roomAddress),
      hostApi.listRoomUsers(current.roomAddress)
    ]);
    room = nextRoom;
    // Poll diffing: identical roster keeps its array reference.
    members = mergeRoster(members, nextMembers);
    loadingLive = false;
    pollError = null;
    const tick = tickNo;
    tickNo += 1;
    if (isStatsTick(tick)) await runStats();
  }

  const poller = new Poller({
    intervalMs: 5000,
    backoffMs: 15_000,
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
      handleHostReset(cause);
    }
  });

  $effect(() => {
    if (!booted || redirecting) return;
    if (currentRoom === null || !guardRoomAddress(currentRoom, roomParam)) return;
    poller.start();
    void poller.refresh();
    return () => poller.stop();
  });

  function onVisibilityChange(): void {
    if (document.visibilityState === 'visible' && poller.isRunning) {
      void poller.refresh();
      void runStats(); // the engine refreshes on visibility regain (§3.7.5)
    }
  }
  $effect(() => {
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  });

  // --- region 1: member drill-down (on-demand, never polled) ---------------
  let drillMember = $state<User | null>(null);
  let drillChats = $state<DrillDialog[] | null>(null);
  let drillLoading = $state(false);
  let drillError = $state<'network' | 'api' | null>(null);
  let drillErrorMessage = $state<string | null>(null);
  /** Transient KickoffResponse speaker line (resolved name). */
  let kickoffSpeaker = $state<string | null>(null);
  /** Guards against a stale listing answer after re-opening the sheet. */
  let drillSeq = 0;

  async function openMember(user: User): Promise<void> {
    const seq = (drillSeq += 1);
    drillMember = user;
    drillChats = null;
    drillLoading = true;
    drillError = null;
    drillErrorMessage = null;
    kickoffSpeaker = null;
    const current = get(hostRoom);
    if (!current) return;
    try {
      // The rev. 4 REAL listing (room token; no 6.9a hint on the panel).
      const chats = await hostApi.listChatsOfRoomUser(current.roomAddress, user.address);
      if (seq !== drillSeq) return;
      drillChats = chats.map((chat) => ({
        address: chat.address,
        phase: chat.phase,
        scenario: chat.scenario
      }));
    } catch (cause: unknown) {
      if (seq !== drillSeq) return;
      const mapped = errorFrom(cause);
      drillError = mapped.kind;
      drillErrorMessage = mapped.message;
      handleHostReset(cause);
    } finally {
      if (seq === drillSeq) drillLoading = false;
    }
  }

  function retryDrillDown(): void {
    const user = drillMember;
    if (user) void openMember(user);
  }

  function closeDrillDown(): void {
    drillSeq += 1;
    drillMember = null;
  }

  async function onClearChat(chatAddress: string): Promise<void> {
    drillError = null;
    drillErrorMessage = null;
    try {
      await hostApi.clearChatHistory(chatAddress); // room token, host context
    } catch (cause: unknown) {
      const mapped = errorFrom(cause);
      drillError = mapped.kind;
      drillErrorMessage = mapped.message;
      handleHostReset(cause);
    }
  }

  async function onKickoffChat(chatAddress: string): Promise<void> {
    drillError = null;
    drillErrorMessage = null;
    try {
      const response = await hostApi.kickoffChat(chatAddress); // room token
      // KickoffResponse speaker line — resolved from the roster when the
      // speaker is a known member (raw address fallback).
      kickoffSpeaker = speakerName(response.speaker, members);
    } catch (cause: unknown) {
      const mapped = errorFrom(cause);
      drillError = mapped.kind;
      drillErrorMessage = mapped.message;
      handleHostReset(cause);
    }
  }

  // --- region 4: settings + rotation + delete -------------------------------
  let settingsPending = $state(false);
  let settingsError = $state<string | null>(null);
  let savedNote = $state(false);
  let savedTimer: ReturnType<typeof setTimeout> | null = null;
  let deletePending = $state(false);
  let rotatePending = $state(false);
  let rotateDone = $state(false);
  let rotateTimer: ReturnType<typeof setTimeout> | null = null;

  async function onUpdateRoom(name: string, description: string): Promise<void> {
    const current = get(hostRoom);
    if (!current || settingsPending) return;
    settingsPending = true;
    settingsError = null;
    try {
      // Body { name, description } ONLY — language/max_user stay
      // read-only data chips (F9, §9.4.1-a).
      const updated = await hostApi.updateRoom(current.roomAddress, {
        name,
        ...(description !== '' ? { description } : {})
      });
      room = updated; // the header refreshes from the PUT response
      savedNote = true;
      if (savedTimer) clearTimeout(savedTimer);
      savedTimer = setTimeout(() => (savedNote = false), 2000);
    } catch (cause: unknown) {
      // 400 → the server's plain-text field error (§3.7.2).
      settingsError = cause instanceof Error ? cause.message : translate($locale, 'common.error');
      handleHostReset(cause);
    } finally {
      settingsPending = false;
    }
  }

  /**
   * Room-token rotation: Bearer = the CURRENT room token (auto-injected),
   * body = the new raw secret. The stored `bleak.hostRoom.roomToken` is
   * replaced IN PLACE only after the 2xx.
   */
  async function onRotateRoomToken(): Promise<void> {
    const current = get(hostRoom);
    if (!current || rotatePending) return;
    rotatePending = true;
    settingsError = null;
    try {
      const newRaw = generateTokenSecret();
      await hostApi.rotateRoomToken(current.roomAddress, newRaw);
      updateHostRoomToken(newRaw);
      rotateDone = true;
      if (rotateTimer) clearTimeout(rotateTimer);
      rotateTimer = setTimeout(() => (rotateDone = false), 2000);
    } catch (cause: unknown) {
      settingsError = cause instanceof Error ? cause.message : translate($locale, 'common.error');
      handleHostReset(cause);
    } finally {
      rotatePending = false;
    }
  }

  async function onDeleteRoom(): Promise<void> {
    const current = get(hostRoom);
    if (!current || deletePending) return;
    deletePending = true;
    try {
      await hostApi.deleteRoom(current.roomAddress);
      clearHostRoom(); // → /host (entry card, Create mode)
      poller.stop();
      void goto(resolve('/host'));
    } catch (cause: unknown) {
      settingsError = cause instanceof Error ? cause.message : translate($locale, 'common.error');
      handleHostReset(cause);
    } finally {
      deletePending = false;
    }
  }

  // --- derived copy ---------------------------------------------------------
  const currentRoom = $derived($hostRoom);
  const backLabel = $derived(translate($locale, 'common.back'));  const deletedMessage = $derived(translate($locale, 'host.room.deleted'));
  const languageChip = $derived(
    room ? translate($locale, 'host.room.language', { language: room.language }) : ''
  );
  const maxChip = $derived(
    room ? translate($locale, 'host.room.max_user', { n: String(room.max_user) }) : ''
  );
  const readonlyHint = $derived(translate($locale, 'host.room.readonly_hint'));
  const hostTitle = $derived(translate($locale, 'host.title'));
  const guardOk = $derived(guardRoomAddress(currentRoom, roomParam));
</script>

<svelte:head>
  <title>{room?.name ?? hostTitle} — bleak-web</title>
</svelte:head>

<main class="host-panel">
  {#if roomDeleted}
    <!-- getRoom 404: the room was deleted while the panel was open. -->
    <section class="deleted card pixel-corners">
      <p role="status">{deletedMessage}</p>
    </section>
  {:else if booted && !redirecting && guardOk}
    <header class="topbar">
      <a class="back" href={resolve('/host')}>{backLabel}</a>
      <div class="titles">
        {#if room}
          <h1>{room.name}</h1>
        {/if}
        <div class="chips">
          <Chip variant="outline-muted"><span class="address">{roomParam}</span></Chip>
          {#if room}
            <!-- F9 (§9.4.1-a): data display, NEVER controls. -->
            <Chip variant="outline-muted">{languageChip}</Chip>
            <Chip variant="outline-muted">{maxChip}</Chip>
          {/if}
        </div>
        <p class="f9-hint">{readonlyHint}</p>
      </div>
    </header>

    <div class="columns">
      <div class="col-a">
        <PanelMembers
          {room}
          {members}
          loading={loadingLive}
          {pollError}
          onopenMember={(user) => void openMember(user)}
          onretry={() => void poller.refresh()}
        />
        <StatsPanel
          {stats}
          loading={statsLoading}
          error={pollError}
          onretry={() => {
            void poller.refresh();
            void runStats();
          }}
        />
      </div>
      <aside class="side">
        <ShareKit code={currentRoom?.code ?? ''} roomAddress={roomParam} />
      </aside>
      <div class="col-c">
        <PanelSettings
          {room}
          {settingsPending}
          {settingsError}
          {savedNote}
          {rotatePending}
          {rotateDone}
          {deletePending}
          onupdateRoom={(name, description) => void onUpdateRoom(name, description)}
          onrotateRoomToken={() => void onRotateRoomToken()}
          ondeleteRoom={() => void onDeleteRoom()}
        />
      </div>
    </div>
  {/if}

  <MemberDrillDown
    member={drillMember}
    chats={drillChats}
    loading={drillLoading}
    error={drillError}
    errorMessage={drillErrorMessage}
    {kickoffSpeaker}
    onretry={retryDrillDown}
    onclose={closeDrillDown}
    onclear={(chat) => void onClearChat(chat)}
    onkickoff={(chat) => void onKickoffChat(chat)}
  />
</main>

<style>
  .host-panel {
    flex: 1;
    width: 100%;
    max-width: 1080px;
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
  .titles {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  h1 {
    font-size: 32px;
    margin: 0;
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }
  .address {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 220px;
  }
  .f9-hint {
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
  /* Below 900px the regions stack in the specified order: members +
     statistics, share, settings (§3.7.2 responsive). */
  .columns {
    display: grid;
    grid-template-columns: 1fr;
    grid-template-areas:
      'a'
      'b'
      'c';
    gap: var(--space-5);
  }
  .col-a {
    grid-area: a;
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
  }
  .side {
    grid-area: b;
  }
  .col-c {
    grid-area: c;
  }
  @media (min-width: 900px) {
    /* Two-column: the main column (≈ 58%) holds members + statistics +
       settings and scrolls; the sticky side column (≈ 42%) holds the
       share region + the invite shortcut (§3.7.2). */
    .columns {
      grid-template-columns: minmax(0, 58fr) minmax(0, 42fr);
      grid-template-areas:
        'a b'
        'c b';
      align-items: start;
    }
    .side {
      position: sticky;
      top: var(--space-5);
    }
  }
</style>
