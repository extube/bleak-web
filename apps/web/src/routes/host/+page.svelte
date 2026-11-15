<script lang="ts">
  /**
   * `/host` — Host console (DESIGN §3.7, TZ-09). Token gate → create room
   * (v2, mechanical adaptation: client-generated room token + one-time
   * creation-token header via `hostApi.createRoomWithInvite`) → share kit
   * (code + QR + invite link) restored from `bleak.hostRoom` on revisit →
   * live room view on a 5 s Poller (listRoomUsers + getRoom — instantiated
   * HERE only, stopped on teardown, refreshed on visibility regain). Member
   * drill-down fetches ON DEMAND (never polled) via the host `hostApi`
   * context. Room settings save via updateRoom; the danger-zone delete
   * clears `bleak.hostRoom` and returns to the create form. This page NEVER
   * requires an attendee identity (§1.3). Full v2 console rework: TZ2-07.
   */
  import { get } from 'svelte/store';
  import { resolve } from '$app/paths';
  import { ApiError, type Chat, type Handshake, type Room, type User } from '@bleak/api-client';
  import { api, hostApi } from '#lib/api/client';
  import { inviteQrUrl } from '#lib/api/helper';
  import { generateTokenSecret } from '#lib/crypto/secrets';
  import { apiErrorText } from '#lib/join';
  import { Poller } from '#lib/polling/poller';
  import { locale, translate } from '#lib/i18n/locale';
  import {
    clearHostRoom,
    forgetHostToken,
    hostRoom,
    hostToken,
    initHostSession,
    saveHostRoom,
    saveHostToken,
    type HostRoomRef
  } from '#lib/stores/hostSession';
  import { mergeRoster } from '#lib/people/view';
  import { handshakeCounts, parseHelperErrorText } from '#lib/components/host/hostLogic';
  import TokenGate from '#lib/components/host/TokenGate.svelte';
  import CreateRoomForm from '#lib/components/host/CreateRoomForm.svelte';
  import ShareKit from '#lib/components/host/ShareKit.svelte';
  import LiveRoom from '#lib/components/host/LiveRoom.svelte';
  import MemberDrillDown from '#lib/components/host/MemberDrillDown.svelte';

  type Stage = 'gate' | 'form' | 'share';

  // --- host session (boot reads localStorage once) ---------------------------
  let booted = $state(false);
  let stage = $state<Stage>('gate');
  let tokenValue = $state('');
  const currentRoom = $derived($hostRoom);

  $effect(() => {
    if (booted) return;
    initHostSession();
    tokenValue = $hostToken;
    stage = $hostRoom !== null ? 'share' : $hostToken !== '' ? 'form' : 'gate';
    booted = true;
  });

  // --- create-room flow -------------------------------------------------------
  let tokenGateError = $state<string | null>(null);
  let creating = $state(false);
  let createError = $state<string | null>(null);
  let deletedNotice = $state(false);

  function submitToken(token: string): void {
    tokenValue = token;
    saveHostToken(token);
    tokenGateError = null;
    stage = 'form';
  }

  function forgetToken(): void {
    forgetHostToken();
    tokenValue = '';
    tokenGateError = null;
    stage = 'gate';
  }

  async function onCreate(draft: { name: string; description: string; language: 'ru' | 'en' }): Promise<void> {
    if (creating) return;
    creating = true;
    createError = null;
    deletedNotice = false;
    try {
      // v2 (ARCHITECTURE §10.9, mechanical replacement of the retired helper
      // `POST /h/rooms`): the client generates the room token, room creation
      // authenticates with the one-time creation token in the header, and the
      // room's first invite code is minted with that room token. The full
      // v2 console (creation-token gate UX, invite management) is TZ2-07.
      const roomToken = generateTokenSecret();
      const { room: created, code } = await hostApi.createRoomWithInvite(
        {
          name: draft.name,
          ...(draft.description !== '' ? { description: draft.description } : {}),
          language: draft.language,
          token: roomToken
        },
        tokenValue
      );
      const ref: HostRoomRef = {
        code,
        roomAddress: created.address,
        roomToken,
        roomName: created.name ?? draft.name,
        // v2: the invite link is computed client-side from the code (§10.9).
        inviteUrl: `${resolve('/')}?code=${code}`
      };
      saveHostRoom(ref);
      stage = 'share';
    } catch (cause: unknown) {
      if (cause instanceof ApiError && (cause.status === 401 || cause.status === 403)) {
        // Wrong/consumed creation token: back to the gate, value kept masked,
        // server text appended. The creation token is never stored.
        tokenGateError = translate($locale, 'host.token.rejected');
        const detail = parseHelperErrorText(apiErrorText(cause));
        if (detail !== '' && detail !== cause.message) tokenGateError = `${tokenGateError} ${detail}`;
        stage = 'gate';
      } else if (cause instanceof TypeError) {
        createError = translate($locale, 'common.error.network');
      } else {
        // Surface only the server's plain-text body (the v1 helper behavior).
        const serverText = cause instanceof ApiError ? apiErrorText(cause) : cause instanceof Error ? cause.message : String(cause);
        createError = parseHelperErrorText(serverText);
      }
    } finally {
      creating = false;
    }
  }

  // --- live room view (5 s Poller — route file only, §2.2) --------------------
  let room = $state<Room | null>(null);
  let members = $state<readonly User[]>([]);
  let loadingLive = $state(true);
  let pollError = $state<null | { kind: 'network' | 'api'; message: string | null }>(null);
  let roomDeleted = $state(false);

  function errorFrom(cause: unknown): { kind: 'network' | 'api'; message: string | null } {
    if (cause instanceof ApiError) return { kind: 'api', message: cause.message };
    return { kind: 'network', message: null };
  }

  async function pollTick(): Promise<void> {
    const current = get(hostRoom);
    if (!current) throw new Error('no host room');
    const [nextRoom, nextMembers] = await Promise.all([
      api.getRoom(current.roomAddress),
      api.listRoomUsers(current.roomAddress)
    ]);
    room = nextRoom;
    // Poll diffing: identical roster keeps its array reference (no re-render).
    members = mergeRoster(members, nextMembers);
    loadingLive = false;
    pollError = null;
  }

  const poller = new Poller({
    intervalMs: 5000,
    backoffMs: 15_000,
    tick: pollTick,
    onStall: (cause) => {
      if (cause instanceof ApiError && cause.status === 404) {
        // Room deleted elsewhere: full-section state + reset to the form.
        roomDeleted = true;
        pollError = null;
        return;
      }
      pollError = errorFrom(cause);
    }
  });

  // Poller lifecycle: only while the share kit + live view are shown.
  $effect(() => {
    if (!booted) return;
    if (stage === 'share' && currentRoom !== null) {
      poller.start();
      void poller.refresh();
      return () => poller.stop();
    }
  });

  function onVisibilityChange(): void {
    if (document.visibilityState === 'visible' && poller.isRunning) void poller.refresh();
  }
  $effect(() => {
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  });

  // --- settings + delete ------------------------------------------------------
  let settingsPending = $state(false);
  let settingsError = $state<string | null>(null);
  let deletePending = $state(false);

  async function onUpdateRoom(name: string, description: string): Promise<void> {
    const current = get(hostRoom);
    if (!current || settingsPending) return;
    settingsPending = true;
    settingsError = null;
    try {
      const updated = await hostApi.updateRoom(current.roomAddress, {
        name,
        ...(description !== '' ? { description } : {})
      });
      room = updated;
    } catch (cause: unknown) {
      settingsError = cause instanceof Error ? cause.message : translate($locale, 'common.error');
    } finally {
      settingsPending = false;
    }
  }

  async function onDeleteRoom(): Promise<void> {
    const current = get(hostRoom);
    if (!current || deletePending) return;
    deletePending = true;
    try {
      await hostApi.deleteRoom(current.roomAddress);
      room = null;
      members = [];
      loadingLive = true;
      clearHostRoom();
      roomDeleted = true;
      deletedNotice = true;
      stage = 'form';
    } catch (cause: unknown) {
      settingsError = cause instanceof Error ? cause.message : translate($locale, 'common.error');
    } finally {
      deletePending = false;
    }
  }

  function resetToCreateForm(): void {
    clearHostRoom();
    room = null;
    members = [];
    loadingLive = true;
    roomDeleted = false;
    stage = 'form';
  }

  function backToCreateForm(): void {
    // «Создать другую комнату» keeps the stored room until a new one exists.
    stage = 'form';
    createError = null;
  }

  // --- member drill-down (on-demand fetches, never polled) --------------------
  let drillMember = $state<User | null>(null);
  let drillCounts = $state<{ sent: number; received: number } | null>(null);
  let drillChats = $state<Chat[] | null>(null);
  let drillError = $state<'network' | 'api' | null>(null);
  let drillErrorMessage = $state<string | null>(null);

  async function openMember(user: User): Promise<void> {
    const current = get(hostRoom);
    if (!current) return;
    drillMember = user;
    drillCounts = null;
    drillChats = null;
    drillError = null;
    drillErrorMessage = null;
    try {
      // Host context (v2): the drill-down reads go through the hostApi
      // context (member drill-down, ARCHITECTURE §10.3) — never the
      // attendee persona credential.
      const [handshakes, chats]: [Handshake[], Chat[]] = await Promise.all([
        hostApi.listHandshakesOfUser(user.address),
        hostApi.listChatsOfRoomUser(current.roomAddress, user.address)
      ]);
      drillCounts = handshakeCounts(handshakes, user.address);
      drillChats = chats;
    } catch (cause: unknown) {
      const mapped = errorFrom(cause);
      drillError = mapped.kind;
      drillErrorMessage = mapped.message;
    }
  }

  function retryDrillDown(): void {
    const user = drillMember;
    if (user) void openMember(user);
  }

  function closeDrillDown(): void {
    drillMember = null;
  }

  // --- copy -------------------------------------------------------------------
  const title = $derived(translate($locale, 'host.title'));
  const subtitle = $derived(translate($locale, 'host.subtitle'));
  const deletedMessage = $derived(translate($locale, 'host.room_deleted'));
  const anotherLabel = $derived(translate($locale, 'host.create_another'));
  const qrSrc = $derived(currentRoom ? inviteQrUrl(currentRoom.code) : '');
  const forgetLabel = $derived(translate($locale, 'host.token.forget'));
  const inviteUrlFallback = $derived(
    `${resolve('/')}?code=${currentRoom?.code ?? ''}`
  );
</script>

<svelte:head>
  <title>{title} — bleak-web</title>
</svelte:head>

<main class="host-page">
  <header class="header">
    <h1>{title}</h1>
    <p class="subtitle">{subtitle}</p>
  </header>

  {#if stage === 'gate'}
    <TokenGate
      initial={tokenValue}
      rejected={tokenGateError}
      onsubmit={submitToken}
      onforget={forgetToken}
    />
  {:else if stage === 'form'}
    {#if deletedNotice}
      <p class="deleted-notice" role="status">{deletedMessage}</p>
    {/if}
    <CreateRoomForm pending={creating} error={createError} onsubmit={onCreate} />
    {#if tokenValue !== ''}
      <button type="button" class="forget" onclick={forgetToken}>{forgetLabel}</button>
    {/if}
  {:else if roomDeleted || currentRoom === null}
    <section class="deleted card pixel-corners">
      <p role="status">{deletedMessage}</p>
      <button type="button" class="cta" onclick={resetToCreateForm}>{anotherLabel}</button>
    </section>
  {:else if currentRoom}
    <div class="columns">
      <div class="left">
        <ShareKit
          code={currentRoom.code}
          inviteUrl={currentRoom.inviteUrl !== '' ? currentRoom.inviteUrl : inviteUrlFallback}
          qrSrc={qrSrc}
          oncreateAnother={backToCreateForm}
        />
      </div>
      <div class="right">
        <LiveRoom
          {room}
          {members}
          loading={loadingLive}
          {pollError}
          {settingsPending}
          {settingsError}
          {deletePending}
          onretry={() => void poller.refresh()}
          onopenMember={(user) => void openMember(user)}
          onupdateRoom={(name, description) => void onUpdateRoom(name, description)}
          ondeleteRoom={() => void onDeleteRoom()}
        />
      </div>
    </div>
  {/if}

  <MemberDrillDown
    member={drillMember}
    counts={drillCounts}
    chats={drillChats}
    error={drillError}
    errorMessage={drillErrorMessage}
    onretry={retryDrillDown}
    onclose={closeDrillDown}
  />
</main>

<style>
  .host-page {
    flex: 1;
    width: 100%;
    max-width: 1080px;
    margin: 0 auto;
    padding: var(--space-5) var(--space-4) calc(var(--bottom-tabbar-height) + var(--space-5));
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }
  .header h1 {
    font-size: 32px;
  }
  .subtitle {
    margin: 0;
    font-size: 14px;
    color: var(--color-text-muted);
  }
  .deleted-notice {
    margin: 0;
    padding: var(--space-2) var(--space-3);
    background: var(--color-accent-soft);
    border-radius: var(--radius-md);
    font-size: 14px;
  }
  .forget {
    align-self: flex-start;
    background: transparent;
    border: none;
    color: var(--color-text-muted);
    min-height: var(--touch-target);
    font-size: 14px;
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
  .cta {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: var(--color-accent);
    color: var(--color-accent-ink);
    border: none;
    border-radius: var(--radius-pill);
    min-height: var(--touch-target);
    padding: 0 var(--space-5);
    font-weight: 600;
    text-decoration: none;
  }
  .columns {
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
  }
  @media (min-width: 900px) {
    .columns {
      display: grid;
      grid-template-columns: minmax(360px, 460px) 1fr;
      gap: var(--space-6);
      align-items: start;
    }
    .left {
      position: sticky;
      top: var(--space-5);
    }
  }
</style>
