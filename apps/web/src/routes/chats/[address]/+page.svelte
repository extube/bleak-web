<script lang="ts">
  /**
   * /chats/[address] — Dialog transcript (DESIGN §3.5, TZ-07).
   *
   * READ-ONLY by strict owner ruling (Concept §1c ruling 4, permanent):
   * humans never send messages — only agents communicate. There is NO
   * message composer, no input, no send control anywhere in this UI (the
   * component test asserts the absence); `POST /api/message` is never wired.
   *
   * One Poller (route file only, §2.2): listChatMessages at 2 s (backoff 6 s),
   * stop() on teardown, refresh() on mount and visibility regain; getChat +
   * listRoomUsers on mount and when a poll reveals an unknown speaker
   * (participant drift). Kickoff (the only dialog action) goes through the
   * ConfirmDialog kit component with the exact §3.5 copy.
   */
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { get } from 'svelte/store';
  import { ApiError, NetworkError, type Chat, type Message, type User } from '@bleak/api-client';
  import { identity, initIdentity } from '#lib/stores/identity';
  import { requireIdentityOrRedirect } from '#lib/nav/guard';
  import { api, apiRaw, HOST_RESET_KEY } from '#lib/api/client';
  import { hostRoom, clearHostRoom } from '#lib/stores/hostSession';
  import { Poller } from '#lib/polling/poller';
  import {
    backTarget,
    bubbleAriaLabel,
    isMyMessage,
    isNearBottom,
    mergeMessages,
    speakerName
  } from '#lib/chats/view';
  import { locale, translate } from '#lib/i18n/locale';
  import { relativeTime } from '#lib/people/view';
  import { counterpartAddress } from '#lib/room/relationships';
  import MessageBubble from '#lib/components/chats/MessageBubble.svelte';
  import PixelAvatar from '#lib/components/PixelAvatar.svelte';
  import PixelIcon from '#lib/components/icons/PixelIcon.svelte';
  import Chip from '#lib/components/Chip.svelte';
  import ConfirmDialog from '#lib/components/ConfirmDialog.svelte';
  import ContactStub from '#lib/components/ContactStub.svelte';
  import ErrorBanner from '#lib/components/ErrorBanner.svelte';
  import SkeletonBlock from '#lib/components/SkeletonBlock.svelte';

  // Hard reload on a guarded route: hydrate identity defensively (idempotent).
  initIdentity();
  const guarded = requireIdentityOrRedirect();

  const address = $derived(page.params.address ?? '');

  // --- polled data (last-known snapshots survive failures) ----------------
  let chat = $state<Chat | null>(null);
  let users = $state<readonly User[]>([]);
  let messages = $state<readonly Message[]>([]);
  let loading = $state(true);
  let notFound = $state(false);
  let nowMs = $state(Date.now());
  let banner = $state<null | { kind: 'network' | 'api'; message: string | null }>(null);

  // --- transcript scroll state (§3.5) --------------------------------------
  let scrollEl: HTMLElement | null = $state(null);
  /** Near the bottom ⇒ auto-scroll on new messages; else the chip shows. */
  let stick = $state(true);

  // --- kickoff state --------------------------------------------------------
  let confirmOpen = $state(false);
  let kickingOff = $state(false);
  /** Speaker of the last kickoff (shown until the first message arrives). */
  let kickoffSpeaker = $state<string | null>(null);
  /** aria-live announcement for newly polled messages. */
  let announcedName = $state<string | null>(null);

  const me = $derived($identity);
  const counterpartAddr = $derived(
    chat && me ? counterpartAddress(chat, me.userAddress) : null
  );
  const counterpart = $derived(
    counterpartAddr ? (users.find((user) => user.address === counterpartAddr) ?? null) : null
  );
  const headerName = $derived(
    counterpart?.name ?? counterpartAddr ?? address
  );

  // --- transcript viewer fallback (ARCHITECTURE §10.3 escape hatch) --------
  //
  // The transcript is normally read with the attendee's persona Bearer.
  // When that read fails with 401/403 AND a stored room token exists, the
  // page retries ONCE with the room token via the raw ungated client — the
  // ONLY code path in the app allowed to catch a 401 before the global
  // gate. A successful fallback engages host-view mode for the page
  // session: subsequent ticks go straight to the room token (never
  // re-tripping the attendee gate). A host-context 401/403 there replicates
  // the hostApi gate (clear `bleak.hostRoom` + `bleak.hostReset` flag) and
  // renders the error state — it NEVER touches the attendee identity.
  // Without a stored room token a 401 is NOT caught: the §2.8 global gate
  // applies (identity cleared, redirect to `/`).
  let hostView = $state(false);

  function storedRoomToken(): string | undefined {
    const room = get(hostRoom);
    return room?.roomToken !== undefined && room.roomToken !== '' ? room.roomToken : undefined;
  }

  function hostReset(): void {
    clearHostRoom();
    try {
      sessionStorage.setItem(HOST_RESET_KEY, '1');
    } catch {
      /* storage unavailable — the console notice is best-effort */
    }
    hostView = false; // no room credential left to observe with
  }

  /**
   * The persona-context read with the host fallback. `retry` re-issues the
   * same read against `apiRaw` with the stored room token.
   */
  async function withViewerFallback<T>(
    personaRead: () => Promise<T>,
    retry: (token: string) => Promise<T>
  ): Promise<T> {
    if (hostView) {
      const token = storedRoomToken();
      if (token === undefined) {
        // Host session cleared mid-session: no room credential to observe
        // with — the persona read resumes (the gate owns a 401 there).
        hostView = false;
        return personaRead();
      }
      try {
        return await retry(token);
      } catch (hostCause) {
        if (
          hostCause instanceof ApiError &&
          (hostCause.status === 401 || hostCause.status === 403)
        ) {
          hostReset(); // host gate — attendee identity never touched
        }
        throw hostCause;
      }
    }
    try {
      return await personaRead();
    } catch (cause) {
      if (
        cause instanceof ApiError &&
        (cause.status === 401 || cause.status === 403) &&
        storedRoomToken() !== undefined
      ) {
        // ONE retry with the room token (host observing a member's dialog).
        hostView = true;
        try {
          return await retry(storedRoomToken() as string);
        } catch (hostCause) {
          if (
            hostCause instanceof ApiError &&
            (hostCause.status === 401 || hostCause.status === 403)
          ) {
            hostReset();
          }
          throw hostCause;
        }
      }
      throw cause;
    }
  }

  function errorFrom(cause: unknown): { kind: 'network' | 'api'; message: string | null } | null {
    // A 401 without a room token is the §2.8 global gate (identity cleared,
    // redirect queued) — no transcript error UI renders first (AC 15).
    if (cause instanceof ApiError && cause.status === 401) return null;
    if (cause instanceof NetworkError) return { kind: 'network', message: null };
    if (cause instanceof ApiError) return { kind: 'api', message: cause.message };
    return { kind: 'api', message: cause instanceof Error ? cause.message : null };
  }

  // --- chat metadata: on mount + when a poll reveals an unknown speaker ----
  async function syncChat(): Promise<void> {
    const id = me;
    if (!id || !address) return;
    const [chatData, roster] = await Promise.all([
      withViewerFallback(
        () => api.getChat(address),
        (token) => apiRaw.getChat(address, { token })
      ),
      api.listRoomUsers(id.roomAddress)
    ]);
    chat = chatData;
    users = roster;
  }

  $effect(() => {
    if (!guarded) return;
    const id = me;
    const addr = address;
    if (!id || !addr) return;
    let alive = true;
    // (Re)mount: reset per-chat state, then load chat + name roster.
    chat = null;
    messages = [];
    users = [];
    loading = true;
    notFound = false;
    banner = null;
    kickoffSpeaker = null;
    stick = true;
    (async () => {
      try {
        await syncChat();
        if (!alive) return;
        loading = false;
        banner = null;
      } catch (cause) {
        if (!alive) return;
        if (cause instanceof ApiError && cause.status === 404) {
          notFound = true;
          loading = false;
          poller.stop();
          return;
        }
        banner = errorFrom(cause);
      }
    })();
    return () => {
      alive = false;
    };
  });

  // --- the 2 s message poller (route file only, §2.2) ----------------------
  async function pollTick(): Promise<void> {
    if (!address || notFound) return;
    const incoming = await withViewerFallback(
      () => api.listChatMessages(address),
      (token) => apiRaw.listChatMessages(address, { token })
    );
    const previous = messages;
    messages = mergeMessages(previous, incoming);
    nowMs = Date.now();
    loading = false;
    banner = null;
    // Participant drift (§3.5: getChat when participants of a poll differ):
    // a speaker outside the known roster means the chat metadata is stale.
    const myAddress = me?.userAddress ?? '';
    const drifted = incoming.some(
      (message) => message.from !== myAddress && !users.some((user) => user.address === message.from)
    );
    if (drifted) void syncChat().catch(() => undefined);
    // New-message announcement (§3.5 a11y): polite, newest speaker. The
    // first (mount-time) batch is not "new" — announce only subsequent
    // arrivals, and only when the roster can name the speaker.
    if (previous.length > 0 && incoming.length > previous.length) {
      const last = incoming[incoming.length - 1];
      if (last) announcedName = speakerName(last.from, users);
    }
    // The kickoff note + warming row retire with the first message.
    if (incoming.length > 0) kickoffSpeaker = null;
  }

  const poller = new Poller({
    intervalMs: 2000,
    backoffMs: 6000,
    tick: pollTick,
    onStall: (cause) => (banner = errorFrom(cause))
  });

  // Poller lifecycle (§2.2): route file only; stop() on teardown.
  $effect(() => {
    if (!guarded || !me || !address || notFound) return;
    poller.start();
    void poller.refresh();
    return () => poller.stop();
  });

  // Poller refresh on visibility regain (§2.2).
  function onVisibilityChange(): void {
    if (document.visibilityState === 'visible' && poller.isRunning && !notFound) {
      void poller.refresh();
    }
  }
  $effect(() => {
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  });

  // --- auto-scroll (AC 3) ---------------------------------------------------
  function onScroll(): void {
    const el = scrollEl;
    if (!el) return;
    stick = isNearBottom(el.scrollTop, el.clientHeight, el.scrollHeight);
  }
  $effect(() => {
    const el = scrollEl;
    if (!el) return;
    void messages; // dependency: auto-scroll when new messages land
    if (stick) el.scrollTop = el.scrollHeight;
  });

  function jumpToBottom(): void {
    const el = scrollEl;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    stick = true;
  }

  // --- kickoff (the only dialog action; §3.5) --------------------------------
  // Persona Bearer normally; the room token in host-observation context
  // (§3.5 endpoint table) — the viewer fallback decides per session.
  async function runKickoff(): Promise<void> {
    if (kickingOff || !address) return;
    kickingOff = true;
    banner = null;
    try {
      const result = await withViewerFallback(
        () => api.kickoffChat(address),
        (token) => apiRaw.kickoffChat(address, { token })
      );
      messages = [];
      stick = true;
      kickoffSpeaker = result.speaker;
      announcedName = null;
      await poller.refresh();
    } catch (cause) {
      banner = errorFrom(cause);
    } finally {
      kickingOff = false;
    }
  }

  // --- back control (§1.3): history back, fallback /chats --------------------
  function goBack(): void {
    if (backTarget(globalThis.history.length) === 'history') {
      globalThis.history.back();
    } else {
      void goto(resolve('/chats'));
    }
  }

  // --- derived presentation ---------------------------------------------------
  const nameOf = $derived((addr: string): string => speakerName(addr, users));
  const kickoffSpeakerName = $derived(
    kickoffSpeaker ? nameOf(kickoffSpeaker) : null
  );
  const warmingUp = $derived(!loading && !notFound && messages.length === 0);
  const showChip = $derived(!stick && messages.length > 0);

  function timeOf(iso: string): string {
    return relativeTime(iso, nowMs, $locale);
  }
</script>

<svelte:head>
  <title>bleak-web</title>
  <!-- §1.1/§3.5: the transcript page has NO tab bar (the scaffold layout
       renders it for every non-join route; scoped here, restored on unmount). -->
  <style>
    nav.tabbar {
      display: none !important;
    }
  </style>
</svelte:head>

{#if guarded}
  <div class="page">
    <header class="top-bar">
      <button
        type="button"
        class="back"
        aria-label={translate($locale, 'common.back')}
        onclick={goBack}
      >
        <PixelIcon name="back" size={16} />
      </button>
      <div class="who">
        <PixelAvatar address={counterpartAddr ?? ''} size={32} />
        <div class="texts">
          <h1 class="name">{headerName}</h1>
          <div class="chips">
            {#if chat}
              <Chip variant="outline-muted">{chat.phase}</Chip>
              <Chip variant="outline-muted">{chat.scenario}</Chip>
              <Chip variant="outline-muted">{chat.language}</Chip>
            {/if}
            {#if hostView}
              <!-- The room-token viewer fallback served this transcript
                   (ARCHITECTURE §10.3 escape hatch, §3.5). -->
              <Chip variant="outline-muted">{translate($locale, 'chat.host_view')}</Chip>
            {/if}
          </div>
        </div>
      </div>
    </header>

    {#if banner}
      <div class="banner">
        <ErrorBanner
          kind={banner.kind}
          message={banner.message}
          onretry={() => void poller.refresh()}
        />
      </div>
    {/if}

    <main class="scroll" bind:this={scrollEl} onscroll={onScroll}>
      <div class="column">
        {#if notFound}
          <div class="not-found">
            <PixelIcon name="close" size={16} />
            <p>{translate($locale, 'chat.not_found')}</p>
            <button type="button" class="back-to-list" onclick={() => void goto(resolve('/chats'))}>
              {translate($locale, 'chat.back_to_list')}
            </button>
          </div>
        {:else if loading && messages.length === 0}
          <!-- skeleton bubbles: 3, alternating alignment (§3.5 states) -->
          <ul class="transcript" aria-hidden="true">
            {#each [0, 1, 2] as skeleton (skeleton)}
              <li class="row {skeleton % 2 === 0 ? '' : 'mine'}">
                <SkeletonBlock width={skeleton % 2 === 0 ? '70%' : '60%'} height="48px" />
              </li>
            {/each}
          </ul>
        {:else}
          {#if warmingUp}
            <div class="warming" role="status">
              <span class="warming-glyph"><PixelIcon name="dialog-lines" size={16} /></span>
              <p>{translate($locale, 'chat.warming_up')}</p>
            </div>
          {:else}
            <ol class="transcript">
              {#each messages as message (message.tx_id)}
                {@const mine = me !== null && isMyMessage(message, me.userAddress)}
                {@const speaker = nameOf(message.from)}
                <MessageBubble
                  {message}
                  {mine}
                  speaker={speaker}
                  time={timeOf(message.created_at)}
                  label={bubbleAriaLabel(speaker, message.content)}
                />
              {/each}
            </ol>
          {/if}
        {/if}
      </div>
      {#if showChip}
        <button type="button" class="jump-chip" onclick={jumpToBottom}>
          <PixelIcon name="back" size={16} />
          {translate($locale, 'chat.scroll_bottom')}
        </button>
      {/if}
    </main>

    <footer class="footer">
      {#if kickoffSpeakerName && messages.length === 0}
        <p class="kickoff-note" aria-live="polite">
          {translate($locale, 'chat.kickoff.speaker', { name: kickoffSpeakerName })}
        </p>
      {/if}
      <button
        type="button"
        class="kickoff"
        disabled={kickingOff}
        onclick={() => (confirmOpen = true)}
      >
        {translate($locale, 'chat.kickoff')}
      </button>
      <ContactStub />
    </footer>

    <!-- NO-COMPOSER (ruling 4): the only interactive elements in this UI are
         the back control, the kickoff button (+ its confirm dialog), the
         scroll chip and the disabled contact stub. -->
    <ConfirmDialog
      bind:open={confirmOpen}
      title={translate($locale, 'chat.kickoff.confirm_title')}
      body={translate($locale, 'chat.kickoff.confirm_body')}
      confirmLabel={translate($locale, 'chat.kickoff.confirm_run')}
      cancelLabel={translate($locale, 'common.cancel')}
      onconfirm={() => void runKickoff()}
    />

    <div class="vh" aria-live="polite">
      {#if announcedName}
        {translate($locale, 'chat.new_message', { name: announcedName })}
      {/if}
    </div>
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
    gap: var(--space-2);
    padding: 0 var(--space-2);
    background: var(--color-surface);
    z-index: 20;
  }
  .back {
    width: var(--touch-target);
    height: var(--touch-target);
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    color: var(--color-text-muted);
    border-radius: var(--radius-pill);
    transition: color 120ms ease-out;
  }
  .who {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    min-width: 0;
    flex: 1;
    padding-right: var(--space-3);
  }
  .texts {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .name {
    font-family: var(--font-body);
    font-size: 16px;
    font-weight: 600;
    letter-spacing: 0.02em;
    line-height: 1.2;
    margin: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .chips {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    overflow: hidden;
  }
  .chips :global(.chip) {
    font-size: 11px;
    min-height: 20px;
    padding: 1px var(--space-2);
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
  .scroll {
    position: relative;
    flex: 1;
    margin-top: 56px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    padding: var(--space-4) var(--space-4) var(--space-3);
  }
  .column {
    flex: 1;
    display: flex;
    flex-direction: column;
    margin: 0 auto;
    width: 100%;
  }
  .transcript {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }
  .warming {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--space-3);
    color: var(--color-text-muted);
    text-align: center;
  }
  .warming p {
    margin: 0;
    font-size: 14px;
  }
  .warming-glyph {
    display: inline-flex;
    animation: warm-pulse 1.6s ease-in-out infinite;
  }
  @keyframes warm-pulse {
    0%,
    100% {
      opacity: 1;
      transform: scale(1);
    }
    50% {
      opacity: 0.4;
      transform: scale(0.85);
    }
  }
  .not-found {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--space-4);
    color: var(--color-text-muted);
    text-align: center;
    padding: var(--space-5);
  }
  .not-found p {
    margin: 0;
    font-size: 14px;
    max-width: 30ch;
  }
  .back-to-list {
    background: var(--color-accent);
    border: none;
    color: var(--color-accent-ink);
    border-radius: var(--radius-pill);
    min-height: var(--touch-target);
    padding: 0 var(--space-5);
    font-weight: 600;
    font-size: 14px;
    transition: opacity 120ms ease-out;
  }
  .jump-chip {
    position: sticky;
    bottom: var(--space-2);
    align-self: center;
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    min-height: 40px;
    padding: 0 var(--space-4);
    background: var(--color-surface-elevated);
    border: 1px solid var(--color-text-disabled-strong);
    color: var(--color-text);
    border-radius: var(--radius-pill);
    font-size: 14px;
    font-weight: 600;
    transition: opacity 120ms ease-out;
  }
  .footer {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    padding: var(--space-3) var(--space-4) calc(var(--space-4) + env(safe-area-inset-bottom, 0px));
    max-width: 720px;
    width: 100%;
    margin: 0 auto;
  }
  .kickoff-note {
    margin: 0;
    font-size: 14px;
    color: var(--color-accent);
    text-align: center;
  }
  .kickoff {
    min-height: var(--touch-target);
    border-radius: var(--radius-pill);
    background: transparent;
    border: 1px solid var(--color-text-disabled-strong);
    color: var(--color-text);
    font-weight: 600;
    font-size: 14px;
    transition: opacity 120ms ease-out;
  }
  .kickoff:disabled {
    opacity: 0.6;
    cursor: default;
  }
  .footer > :global(.contact-stub) {
    width: 100%;
  }
  @media (min-width: 720px) {
    .column {
      max-width: 640px;
    }
    .top-bar {
      padding: 0 max(var(--space-2), calc((100% - 640px) / 2));
    }
    .footer {
      max-width: 640px;
    }
  }
</style>
