<script lang="ts">
  /**
   * `/host` — entry route (DESIGN rev. 4 §3.7.1, TZ13-02; Concept §54.1).
   * The rev. 3 single-page console is restructured into the route tree: this
   * page keeps ONLY the entry forms (create / log-in) — the panel, invites
   * and QR moved to their own routes (TZ13-03/TZ13-04).
   *
   * - **Auto-resume probe (§54.1):** on mount with a stored `bleak.hostRoom`,
   *   the stored key is validated through the invite-list GET BEFORE the
   *   entry card renders interactively: 200 → auto-navigate to
   *   `/host/<room_address>` (skeleton + «Проверяем доступ к комнате…»,
   *   `aria-busy`, meanwhile); 401/403 → clear + reset notice + entry card in
   *   the Create mode; 404 → clear + «Комната удалена.»; NetworkError → the
   *   stored entry is KEPT (a network failure proves nothing about the
   *   credential) with the §2.1 network banner + retry above the card.
   * - **Pre-credential probes (TZ §9.4.2):** the resume probe, the log-in
   *   validation and the address finder run through `hostProbes` — the raw
   *   client path with LOCAL 401 handling (the `hostApi` roomGate must not
   *   fire for expected pre-credential 401s). Post-credential room-token
   *   calls always go through `hostApi`.
   * - **Reset notice:** renders when `sessionStorage` `bleak.hostNotice` is
   *   set (the hostApi gate, §2.8) — lock glyph, `host.session_reset` copy,
   *   `aria-live="polite"`, key removed after render; its presence
   *   pre-selects the Log-in mode.
   * - **Create mode:** masked creation token (memory only — never persisted;
   *   consumed server-side on use) + room form → client generates the room
   *   token (`generateTokenSecret`) → `hostApi.createRoomWithInvite` (the
   *   delivered composite: POST /api/room carries the creation token in the
   *   `x-create-token` header and the room token in the body; the first
   *   minted `invite_code` comes from the creation response) → store
   *   `bleak.hostRoom = { roomAddress, roomToken, code }` → navigate to
   *   `/host/<room_address>`.
   * - **Log-in mode:** address + masked key → probe validation: 200 →
   *   store/overwrite `bleak.hostRoom` (`code` starts unknown and fills from
   *   the panel's first invite-list tick) → navigate; 401/403 → «Ключ
   *   комнаты отклонён.» inline, value stays masked, nothing stored (§2.9
   *   host row). 404 on the probe = the address names no room — the same
   *   honest inline rejection (nothing stored).
   * - **Address finder (F11):** «Не помните адрес?» → public room list →
   *   bounded candidate probing with the entered key (concurrency ≤ 4, cap
   *   25, stop at the first 200 — `findRoomByKey` in HostEntryCard's module
   *   script); a match fills the address and continues the normal
   *   validation; no match → «Ключ не подошёл ни к одной комнате.»; the
   *   finder NEVER writes storage.
   * - No tab bar on /host (layout); the page NEVER redirects based on
   *   attendee identity (§1.3) — nothing here reads `identity`.
   */
  import { get } from 'svelte/store';
  import { goto } from '$app/navigation';
  import { ApiError } from '@bleak/api-client';
  import { HOST_NOTICE_KEY, hostApi, hostProbes } from '#lib/api/client';
  import { generateTokenSecret } from '#lib/crypto/secrets';
  import { apiErrorText } from '#lib/join';
  import { locale, translate } from '#lib/i18n/locale';
  import ErrorBanner from '#lib/components/ErrorBanner.svelte';
  import SkeletonBlock from '#lib/components/SkeletonBlock.svelte';
  import PixelIcon from '#lib/components/icons/PixelIcon.svelte';
  import HostEntryCard, { findRoomByKey } from '#lib/components/host/HostEntryCard.svelte';
  import type { RoomDraft } from '#lib/components/host/CreateRoomForm.svelte';
  import {
    clearHostRoom,
    hostRoom,
    initHostSession,
    saveHostRoom
  } from '#lib/stores/hostSession';

  type Phase = 'boot' | 'probe' | 'entry';
  type Notice = null | 'reset' | 'deleted';
  type Banner = null | { kind: 'network' | 'api'; message: string | null };
  /** What the §2.1 banner's Retry re-runs (memory only — the creation token
   * retry payload never touches storage). */
  type Retry =
    | { kind: 'probe' }
    | { kind: 'create'; payload: { token: string; draft: RoomDraft } }
    | { kind: 'login'; pair: { address: string; key: string } }
    | { kind: 'find'; key: string };

  let phase = $state<Phase>('boot');
  let notice = $state<Notice>(null);
  let banner = $state<Banner>(null);
  let retry = $state<Retry | null>(null);
  /** The active entry mode (§3.7.1): default Create; the reset notice
   * pre-selects Log-in; a dead-key probe falls back to Create. */
  let mode = $state<'create' | 'login'>('create');

  function errorFrom(cause: unknown): Banner {
    if (cause instanceof ApiError) return { kind: 'api', message: apiErrorText(cause) };
    return { kind: 'network', message: null };
  }

  // --- boot: session init + notice consumption + auto-resume probe ------------
  $effect(() => {
    if (phase !== 'boot') return;
    initHostSession();
    // Consume the hostApi gate's flag (set while the panel was open): render
    // the §3.7.1 reset notice once, then drop the key; its presence
    // pre-selects the Log-in mode.
    try {
      if (sessionStorage.getItem(HOST_NOTICE_KEY) === '1') {
        notice = 'reset';
        sessionStorage.removeItem(HOST_NOTICE_KEY);
        mode = 'login'; // the notice's presence pre-selects the Log-in mode
      }
    } catch {
      /* storage unavailable */
    }
    if (get(hostRoom) !== null) {
      void runProbe();
    } else {
      phase = 'entry';
    }
  });

  /**
   * Auto-resume probe (§54.1, DESIGN §3.7.1 item 3): validate the STORED key
   * through the pre-credential probe path — expected 401s are handled LOCALLY
   * (the hostApi gate must not fire before a credential is accepted).
   */
  async function runProbe(): Promise<void> {
    const stored = get(hostRoom);
    if (stored === null) {
      phase = 'entry';
      return;
    }
    banner = null;
    retry = { kind: 'probe' };
    phase = 'probe';
    try {
      await hostProbes.validateKey(stored.roomAddress, stored.roomToken);
      // 200 → auto-resume straight into the panel; the skeleton stays while
      // the navigation lands (no form flash). The panel route is created by
      // TZ13-03 in this same wave — resolve() typing cannot reference it on
      // this branch yet, so the navigation is a plain (same-app) path.
      // eslint-disable-next-line svelte/no-navigation-without-resolve
      await goto(`/host/${stored.roomAddress}`);
    } catch (cause: unknown) {
      if (cause instanceof ApiError && cause.status === 404) {
        // Room deleted elsewhere → clear + «Комната удалена.» + the card.
        clearHostRoom();
        notice = 'deleted';
        phase = 'entry';
      } else if (cause instanceof ApiError && (cause.status === 401 || cause.status === 403)) {
        // Dead key → host reset semantics (§2.8): clear + notice + Create
        // fallback (log-in would repeat the failure; it stays one tap away).
        clearHostRoom();
        notice = 'reset';
        mode = 'create';
        phase = 'entry';
      } else {
        // NetworkError (or any transient failure) → KEEP the stored entry —
        // a failed probe must not destroy a possibly-valid credential.
        banner = errorFrom(cause);
        phase = 'entry';
      }
    }
  }

  function onBannerRetry(): void {
    const pending = retry;
    if (pending === null) return;
    if (pending.kind === 'probe') void runProbe();
    else if (pending.kind === 'create') void onCreate(pending.payload);
    else if (pending.kind === 'login') void onLogin(pending.pair);
    else void startFind(pending.key);
  }

  // --- create flow -------------------------------------------------------------
  let creating = $state(false);
  let createError = $state<string | null>(null); // 400/409 server text
  let tokenRejected = $state<string | null>(null); // 401/403 on the creation token

  async function onCreate(payload: { token: string; draft: RoomDraft }): Promise<void> {
    if (creating) return;
    creating = true;
    createError = null;
    tokenRejected = null;
    banner = null;
    retry = { kind: 'create', payload };
    try {
      // The client generates the room token; the creation token travels ONLY
      // in the x-create-token header (consumed server-side, never stored).
      // The delivered composite reads the creation response's first minted
      // `invite_code` (POST /api/room + a fallback mint for older backends).
      const roomToken = generateTokenSecret();
      const { room, code } = await hostApi.createRoomWithInvite(
        {
          name: payload.draft.name,
          ...(payload.draft.description !== '' ? { description: payload.draft.description } : {}),
          language: payload.draft.language,
          token: roomToken
        },
        payload.token
      );
      saveHostRoom({
        roomAddress: room.address,
        roomToken,
        code
      });
      retry = null; // consumed
      // Same-app path (see the runProbe comment — the panel route lands with
      // TZ13-03).
      // eslint-disable-next-line svelte/no-navigation-without-resolve
      await goto(`/host/${room.address}`);
    } catch (cause: unknown) {
      if (cause instanceof ApiError && (cause.status === 401 || cause.status === 403)) {
        // Wrong/consumed creation token: the entered value stays masked,
        // NOTHING is stored (§3.7.1 states).
        tokenRejected = translate($locale, 'host.token.rejected');
        const detail = cause instanceof ApiError ? apiErrorText(cause) : '';
        if (detail !== '' && detail !== cause.message) tokenRejected = `${tokenRejected} ${detail}`;
      } else if (cause instanceof ApiError) {
        // 400/409 — surface the server's plain-text body (e.g. duplicate name).
        createError = apiErrorText(cause);
      } else {
        banner = errorFrom(cause); // NetworkError → §2.1 banner + retry
      }
    } finally {
      creating = false;
    }
  }

  // --- log-in flow (pre-credential probe validation, local 401 handling) -------
  let loggingIn = $state(false);
  let loginRejected = $state<string | null>(null);
  let address = $state(''); // bindable into the card; the finder fills it

  async function onLogin(pair: { address: string; key: string }): Promise<void> {
    if (loggingIn) return;
    loggingIn = true;
    loginRejected = null;
    banner = null;
    retry = { kind: 'login', pair };
    try {
      await hostProbes.validateKey(pair.address, pair.key);
      // 200 → store/overwrite bleak.hostRoom (code starts unknown and fills
      // from the panel's first invite-list tick) → navigate to the panel.
      saveHostRoom({ roomAddress: pair.address, roomToken: pair.key, code: '' });
      retry = null;
      // Same-app path (see the runProbe comment — the panel route lands with
      // TZ13-03).
      // eslint-disable-next-line svelte/no-navigation-without-resolve
      await goto(`/host/${pair.address}`);
    } catch (cause: unknown) {
      if (cause instanceof ApiError && (cause.status === 401 || cause.status === 403 || cause.status === 404)) {
        // 401/403: the key is rejected (§2.9 host row); 404: the address
        // names no room — the same honest inline state. Nothing is stored;
        // the entered value stays masked.
        loginRejected = translate($locale, 'host.login.rejected');
        const detail = apiErrorText(cause);
        if (detail !== '' && detail !== cause.message) loginRejected = `${loginRejected} ${detail}`;
      } else {
        banner = errorFrom(cause); // NetworkError → §2.1 banner + retry
      }
    } finally {
      loggingIn = false;
    }
  }

  // --- address finder (F11; bounded probe, never writes storage) ---------------
  let finding = $state(false);
  let findMessage = $state<string | null>(null); // the no-match copy

  async function startFind(key: string): Promise<void> {
    if (finding) return;
    finding = true;
    findMessage = null;
    banner = null;
    retry = { kind: 'find', key };
    try {
      const match = await findRoomByKey(key, {
        listRooms: () => hostProbes.listRooms(),
        validateKey: (candidateAddress, candidateKey) =>
          hostProbes.validateKey(candidateAddress, candidateKey)
      });
      if (match !== null) {
        // A match fills the address and continues the NORMAL validation
        // (probe → store → navigate).
        address = match.address;
        await onLogin({ address: match.address, key });
      } else {
        findMessage = translate($locale, 'host.login.find_none');
      }
    } catch (cause: unknown) {
      banner = errorFrom(cause); // listRooms itself failed → §2.1 banner
    } finally {
      finding = false;
    }
  }

  // --- copy --------------------------------------------------------------------
  const title = $derived(translate($locale, 'host.title'));
  const subtitle = $derived(translate($locale, 'host.subtitle'));
  const resetMessage = $derived(translate($locale, 'host.session_reset'));
  const deletedMessage = $derived(translate($locale, 'host.room.deleted'));
  const checkingMessage = $derived(translate($locale, 'host.resume.checking'));
</script>

<svelte:head>
  <title>{title} — bleak-web</title>
</svelte:head>

<main class="host-page">
  <header class="header">
    <h1>{title}</h1>
    <p class="subtitle">{subtitle}</p>
  </header>

  {#if phase === 'probe'}
    <div class="probe" aria-busy="true" aria-live="polite">
      <SkeletonBlock height="220px" />
      <p class="probe-line">{checkingMessage}</p>
    </div>
  {:else if phase === 'entry'}
    {#if notice === 'reset'}
      <section class="notice pixel-corners" role="status" aria-live="polite">
        <PixelIcon name="lock" size={16} />
        <p>{resetMessage}</p>
      </section>
    {:else if notice === 'deleted'}
      <p class="deleted-notice" role="status" aria-live="polite">{deletedMessage}</p>
    {/if}

    {#if banner !== null}
      <ErrorBanner kind={banner.kind} message={banner.message} onretry={onBannerRetry} />
    {/if}

    <HostEntryCard
      {mode}
      onmodechange={(next) => (mode = next)}
      {creating}
      {createError}
      {tokenRejected}
      oncreate={(payload) => void onCreate(payload)}
      bind:address
      {loggingIn}
      {loginRejected}
      onlogin={(pair) => void onLogin(pair)}
      {finding}
      {findMessage}
      onfind={(key) => void startFind(key)}
    />
  {/if}
</main>

<style>
  .host-page {
    flex: 1;
    width: 100%;
    max-width: 640px;
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
  .probe {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    align-self: center;
    width: 100%;
    max-width: 640px;
  }
  .probe-line {
    margin: 0;
    font-size: 14px;
    color: var(--color-text-muted);
    text-align: center;
  }
  .notice {
    display: flex;
    align-items: flex-start;
    gap: var(--space-3);
    width: 100%;
    padding: var(--space-4);
    background: var(--color-surface);
    color: var(--color-text);
    text-align: left;
  }
  .notice :global(svg) {
    color: var(--color-accent);
    flex-shrink: 0;
    margin-top: 2px;
  }
  .notice p {
    margin: 0;
    font-size: 14px;
    line-height: 1.5;
  }
  .deleted-notice {
    margin: 0;
    padding: var(--space-2) var(--space-3);
    background: var(--color-accent-soft);
    border-radius: var(--radius-md);
    font-size: 14px;
  }
</style>
