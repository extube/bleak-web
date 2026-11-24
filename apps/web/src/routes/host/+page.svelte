<script lang="ts">
  /**
   * `/host` — Host console v2 (DESIGN rev. 3 §3.7, TZ2-07 Part B;
   * ARCHITECTURE §10.9). Fully reworks the mechanical v1→v2 adaptation:
   *
   * - **Creation-token gate:** the operator-granted ONE-TIME creation token
   *   is typed into a masked input (type=password, autocomplete=off) and is
   *   NEVER persisted anywhere — it lives in memory for the duration of the
   *   create call and is consumed server-side. A 401/403 → «Токен
   *   отклонён.» + server text under the field, value kept masked, nothing
   *   stored.
   * - **Create room:** the client generates the room token
   *   (`generateTokenSecret`) → `hostApi.createRoomWithInvite` (creation
   *   token in the header + room token in the body, first invite minted with
   *   the room token — the delivered TZ2-05 composite) →
   *   `bleak.hostRoom = { roomAddress, roomToken, code }`.
   * - **Share kit:** restored from `bleak.hostRoom`; room name via public
   *   `getRoom`; invite link computed client-side
   *   (`{INVITE_URL_BASE}?code={code}`); QR `<img>` from the STATELESS
   *   helper endpoint.
   * - **Invite management (room-token authority):** list / mint (expiry
   *   presets 1 h · 24 h default · 7 d + custom datetime-local) / revoke
   *   (no confirm — reversible); failures inline with retry. The mint
   *   response shape is a TBD(WP-6) mapping point — the block consumes only
   *   the api-client's public `Invite` methods (§8.4.1).
   * - **Live view:** public 5 s Poller (listRoomUsers + getRoom) —
   *   instantiated HERE only, stopped on teardown, refreshed on visibility
   *   regain. Member drill-down is ON-DEMAND (never polled): chat discovery
   *   is 6.9a-blocked — the sheet renders the honest empty state + the muted
   *   flag hint, never invented listings; NO handshake counts anywhere
   *   (AC 11).
   * - **Host settings:** updateRoom (room token); «Сгенерировать ключ
   *   комнаты» → confirm → rotateRoomToken → in-place `bleak.hostRoom`
   *   update; danger-zone delete → confirm → deleteRoom → clear
   *   `bleak.hostRoom` → create form.
   * - **Host reset state:** the `bleak.hostNotice` flag (set by the hostApi
   *   gate on 401/403; TZ13-01 renamed it from the retired host-reset key)
   *   renders the
   *   §3.7 reset notice above the
   *   creation-token gate, consumed on render; `getRoom` 404 → «Комната
   *   удалена.» reset.
   *
   * This page NEVER requires an attendee identity (§1.3).
   */
  import { get } from 'svelte/store';
  import { ApiError, NetworkError, type Invite, type Room, type User } from '@bleak/api-client';
  import { hostApi, HOST_NOTICE_KEY } from '#lib/api/client';
  import { inviteQrUrl } from '#lib/api/helper';
  import { generateTokenSecret } from '#lib/crypto/secrets';
  import { apiErrorText } from '#lib/join';
  import { Poller } from '#lib/polling/poller';
  import { locale, translate } from '#lib/i18n/locale';
  import {
    clearHostRoom,
    hostRoom,
    initHostSession,
    saveHostRoom,
    updateHostRoomToken
  } from '#lib/stores/hostSession';
  import { inviteUrlBase } from '#lib/components/profile/qr';
  import { mergeRoster } from '#lib/people/view';
  import { inviteLink } from '#lib/components/host/hostLogic';
  import TokenGate from '#lib/components/host/TokenGate.svelte';
  import CreateRoomForm from '#lib/components/host/CreateRoomForm.svelte';
  import ShareKit from '#lib/components/host/ShareKit.svelte';
  import InviteManager from '#lib/components/host/InviteManager.svelte';
  import LiveRoom from '#lib/components/host/LiveRoom.svelte';
  import MemberDrillDown, { type DrillDialog } from '#lib/components/host/MemberDrillDown.svelte';

  type Stage = 'gate' | 'form' | 'share';

  // --- host session (boot reads localStorage once) ---------------------------
  let booted = $state(false);
  let stage = $state<Stage>('gate');
  /** The one-time CREATION token — memory only, never persisted (§10.11). */
  let tokenValue = $state('');
  let resetNotice = $state(false);
  const currentRoom = $derived($hostRoom);

  $effect(() => {
    if (booted) return;
    initHostSession();
    // Consume the host-reset flag (set by the hostApi gate — possibly while
    // the console was closed): render the §3.7 notice once, then drop it.
    try {
      if (sessionStorage.getItem(HOST_NOTICE_KEY) === '1') {
        resetNotice = true;
        sessionStorage.removeItem(HOST_NOTICE_KEY);
      }
    } catch {
      /* storage unavailable */
    }
    stage = $hostRoom !== null ? 'share' : 'gate';
    booted = true;
  });

  // --- create-room flow -------------------------------------------------------
  let tokenGateError = $state<string | null>(null);
  let creating = $state(false);
  let createError = $state<string | null>(null);
  let deletedNotice = $state(false);

  function submitToken(token: string): void {
    tokenValue = token; // memory only — never written to any storage
    tokenGateError = null;
    stage = 'form';
  }

  function backToGate(): void {
    stage = 'gate';
    tokenGateError = null;
  }

  async function onCreate(draft: { name: string; description: string; language: 'ru' | 'en' }): Promise<void> {
    if (creating) return;
    creating = true;
    createError = null;
    deletedNotice = false;
    try {
      // v2 (ARCHITECTURE §10.9): the client generates the room token, room
      // creation authenticates with the one-time creation token in the
      // header, and the room's first invite code is minted with that room
      // token (the delivered TZ2-05 composite).
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
      saveHostRoom({ code, roomAddress: created.address, roomToken });
      tokenValue = ''; // consumed server-side — the gate value is not kept
      stage = 'share';
    } catch (cause: unknown) {
      if (cause instanceof ApiError && (cause.status === 401 || cause.status === 403)) {
        // Wrong/consumed creation token: back to the gate, the entered value
        // stays masked, NOTHING is stored (§3.7 states).
        tokenGateError = translate($locale, 'host.token.rejected');
        const detail = apiErrorText(cause);
        if (detail !== '' && detail !== cause.message) tokenGateError = `${tokenGateError} ${detail}`;
        stage = 'gate';
      } else if (cause instanceof NetworkError || cause instanceof TypeError) {
        createError = translate($locale, 'common.error.network');
      } else {
        // Surface the server's plain-text body (400/409 — e.g. duplicate name).
        createError = cause instanceof ApiError ? apiErrorText(cause) : cause instanceof Error ? cause.message : String(cause);
      }
    } finally {
      creating = false;
    }
  }

  /**
   * Host-gate aftermath: the hostApi gate already cleared `bleak.hostRoom`
   * and set `bleak.hostNotice` on a 401/403 — when the room session is gone,
   * the console resets to the creation-token gate with the §3.7 notice.
   * Attendee identity is never touched (the gate is host-scoped).
   */
  function handleHostReset(): void {
    if (get(hostRoom) === null) {
      resetNotice = true;
      try {
        sessionStorage.removeItem(HOST_NOTICE_KEY);
      } catch {
        /* ignore */
      }
      stage = 'gate';
      room = null;
      members = [];
      loadingLive = true;
      roomDeleted = false;
    }
  }

  // --- live room view (5 s Poller — route file only, §2.2) --------------------
  let room = $state<Room | null>(null);
  let members = $state<readonly User[]>([]);
  let loadingLive = $state(true);
  let pollError = $state<null | { kind: 'network' | 'api'; message: string | null }>(null);
  let roomDeleted = $state(false);
  /** Seconds clock shared by the invite rows (expiry display). */
  let now = $state(Date.now());

  function errorFrom(cause: unknown): { kind: 'network' | 'api'; message: string | null } {
    if (cause instanceof ApiError) return { kind: 'api', message: apiErrorText(cause) };
    return { kind: 'network', message: null };
  }

  async function pollTick(): Promise<void> {
    const current = get(hostRoom);
    if (!current) throw new Error('no host room');
    const [nextRoom, nextMembers] = await Promise.all([
      hostApi.getRoom(current.roomAddress),
      hostApi.listRoomUsers(current.roomAddress)
    ]);
    room = nextRoom;
    now = Date.now();
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
      handleHostReset();
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

  // --- invite management (room-token authority) --------------------------------
  let invites = $state<Invite[] | null>(null);
  let invitesError = $state<'network' | 'api' | null>(null);
  let invitesErrorMessage = $state<string | null>(null);
  let mintPending = $state(false);
  let revokedNote = $state(false);
  let revokedTimer: ReturnType<typeof setTimeout> | null = null;

  async function loadInvites(): Promise<void> {
    const current = get(hostRoom);
    if (!current) return;
    invitesError = null;
    invitesErrorMessage = null;
    try {
      invites = await hostApi.listInvites(current.roomAddress);
    } catch (cause: unknown) {
      const mapped = errorFrom(cause);
      invitesError = mapped.kind;
      invitesErrorMessage = mapped.message;
      handleHostReset();
    }
  }

  $effect(() => {
    if (stage === 'share' && currentRoom !== null && invites === null) {
      void loadInvites();
    }
  });

  async function onMint(expiresAt?: string): Promise<void> {
    const current = get(hostRoom);
    if (!current || mintPending) return;
    mintPending = true;
    invitesError = null;
    try {
      await hostApi.mintInvite(current.roomAddress, expiresAt ? { expires_at: expiresAt } : {});
      // The new code appears at the top of the list (activeInvites sorts by
      // created_at desc) with its own copy/QR/link actions.
      await loadInvites();
    } catch (cause: unknown) {
      const mapped = errorFrom(cause);
      invitesError = mapped.kind;
      invitesErrorMessage = mapped.message;
      handleHostReset();
    } finally {
      mintPending = false;
    }
  }

  async function onRevoke(code: string): Promise<void> {
    const current = get(hostRoom);
    if (!current) return;
    invitesError = null;
    try {
      // No confirm — revocation is reversible by minting again (§3.7).
      await hostApi.revokeInvite(current.roomAddress, code);
      await loadInvites();
      revokedNote = true;
      if (revokedTimer) clearTimeout(revokedTimer);
      revokedTimer = setTimeout(() => (revokedNote = false), 2000);
    } catch (cause: unknown) {
      const mapped = errorFrom(cause);
      invitesError = mapped.kind;
      invitesErrorMessage = mapped.message;
      handleHostReset();
    }
  }

  // --- settings + room-token rotation + delete ---------------------------------
  let settingsPending = $state(false);
  let settingsError = $state<string | null>(null);
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
      const updated = await hostApi.updateRoom(current.roomAddress, {
        name,
        ...(description !== '' ? { description } : {})
      });
      room = updated;
    } catch (cause: unknown) {
      settingsError = cause instanceof Error ? cause.message : translate($locale, 'common.error');
      handleHostReset();
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
      handleHostReset();
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
      room = null;
      members = [];
      invites = null;
      loadingLive = true;
      clearHostRoom();
      roomDeleted = false;
      deletedNotice = true;
      stage = 'form';
    } catch (cause: unknown) {
      settingsError = cause instanceof Error ? cause.message : translate($locale, 'common.error');
      handleHostReset();
    } finally {
      deletePending = false;
    }
  }

  function resetToCreateForm(): void {
    clearHostRoom();
    room = null;
    members = [];
    invites = null;
    loadingLive = true;
    roomDeleted = false;
    stage = 'form';
  }

  function backToCreateForm(): void {
    // «Создать другую комнату» keeps the stored room until a new one exists.
    stage = 'form';
    createError = null;
  }

  // --- member drill-down (on-demand, never polled; 6.9a-blocked discovery) -----
  let drillMember = $state<User | null>(null);
  /**
   * Chat knowledge the console already holds — v2: NONE (chat discovery is
   * 6.9a-blocked). The sheet therefore renders the honest empty state + the
   * muted flag hint; listings are never invented client side. The reads
   * themselves (clear/kickoff) use the room token via the host context.
   */
  let drillChats = $state<DrillDialog[] | null>(null);
  let drillError = $state<'network' | 'api' | null>(null);
  let drillErrorMessage = $state<string | null>(null);

  function openMember(user: User): void {
    drillMember = user;
    drillChats = null; // no discoverable chat addresses in v2 (flag 6.9a)
    drillError = null;
    drillErrorMessage = null;
  }

  function retryDrillDown(): void {
    const user = drillMember;
    if (user) openMember(user);
  }

  function closeDrillDown(): void {
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
      handleHostReset();
    }
  }

  async function onKickoffChat(chatAddress: string): Promise<void> {
    drillError = null;
    drillErrorMessage = null;
    try {
      await hostApi.kickoffChat(chatAddress); // room token, host context
    } catch (cause: unknown) {
      const mapped = errorFrom(cause);
      drillError = mapped.kind;
      drillErrorMessage = mapped.message;
      handleHostReset();
    }
  }

  // --- copy -------------------------------------------------------------------
  const title = $derived(translate($locale, 'host.title'));
  const subtitle = $derived(translate($locale, 'host.subtitle'));
  const deletedMessage = $derived(translate($locale, 'host.room_deleted'));
  const anotherLabel = $derived(translate($locale, 'host.create_another'));
  const resetMessage = $derived(translate($locale, 'host.session_reset'));
  const qrSrc = $derived(currentRoom ? inviteQrUrl(currentRoom.code) : '');
  const inviteUrl = $derived(currentRoom ? inviteLink(currentRoom.code, inviteUrlBase()) : '');
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
    {#if resetNotice}
      <p class="reset-notice" aria-live="polite" role="status">{resetMessage}</p>
    {/if}
    <TokenGate initial={tokenValue} rejected={tokenGateError} onsubmit={submitToken} />
  {:else if stage === 'form'}
    {#if deletedNotice}
      <p class="deleted-notice" role="status">{deletedMessage}</p>
    {/if}
    <button type="button" class="back-link" onclick={backToGate}>
      {translate($locale, 'common.back')}
    </button>
    <CreateRoomForm pending={creating} error={createError} onsubmit={onCreate} />
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
          {inviteUrl}
          qrSrc={qrSrc}
          oncreateAnother={backToCreateForm}
        />
        <InviteManager
          {invites}
          error={invitesError}
          errorMessage={invitesErrorMessage}
          {mintPending}
          revokedNote={revokedNote}
          baseUrl={inviteUrlBase()}
          {now}
          onmint={(expiresAt) => void onMint(expiresAt)}
          onrevoke={(code) => void onRevoke(code)}
          onretry={() => void loadInvites()}
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
          {rotatePending}
          rotateDone={rotateDone}
          onretry={() => void poller.refresh()}
          onopenMember={openMember}
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
    error={drillError}
    errorMessage={drillErrorMessage}
    onretry={retryDrillDown}
    onclose={closeDrillDown}
    onclear={(chat) => void onClearChat(chat)}
    onkickoff={(chat) => void onKickoffChat(chat)}
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
  .reset-notice {
    margin: 0;
    padding: var(--space-2) var(--space-3);
    background: var(--color-accent-soft);
    border-radius: var(--radius-md);
    font-size: 14px;
  }
  .deleted-notice {
    margin: 0;
    padding: var(--space-2) var(--space-3);
    background: var(--color-accent-soft);
    border-radius: var(--radius-md);
    font-size: 14px;
  }
  .back-link {
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
  .left {
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
