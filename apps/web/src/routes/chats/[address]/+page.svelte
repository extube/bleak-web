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
   * (participant drift). v2.2 polish (Concept §8.1.8/9/10): the kickoff
   * button + confirm left the dialog view entirely (host drill-down keeps
   * its own), message times are absolute hh:mm, a locale date label sits
   * atop the transcript, and the theme chips gave way to the counterpart's
   * public bio in the header. §4.13.2 (CONCEPT §13 R2): the dialog reflects
   * the AUTHORITATIVE Chat.done — a subtle finished indicator beside the
   * header name (the attendee dialog displays only; kickoff resets done
   * server-side via the host drill-down). §4.13.5 (CONCEPT §13.1.5): opening
   * a FINISHED chat triggers the ONCE-ONLY hardMatch — the server stores one
   * Summary per pair, so a repeat opening returns the stored record (200/201
   * both carry the body) and the sheet re-shows it without re-summarizing;
   * closing the sheet returns the dialog to its normal rendering. The call
   * happens on open, never per poll.
   */
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { get } from 'svelte/store';
  import { ApiError, NetworkError, ValidationError, type Chat, type Message, type Summary, type User } from '@bleak/api-client';
  import { identity, initIdentity } from '#lib/stores/identity';
  import { requireIdentityOrRedirect } from '#lib/nav/guard';
  import { api, apiRaw, HOST_RESET_KEY } from '#lib/api/client';
  import { hostRoom, clearHostRoom } from '#lib/stores/hostSession';
  import { Poller } from '#lib/polling/poller';
  import {
    backTarget,
    bubbleAriaLabel,
    chatDateLabel,
    chatStatus,
    isChatDone,
    isMyMessage,
    isNearBottom,
    mergeMessages,
    messageTime,
    speakerName
  } from '#lib/chats/view';
  import { locale, translate } from '#lib/i18n/locale';
  import { counterpartAddress } from '#lib/room/relationships';
  import {
    isPairShared,
    loadContactCard,
    markPairShared
  } from '#lib/stores/contactCard';
  import ShareContactSlide from '#lib/components/ShareContactSlide.svelte';
  import SummarySheet from '#lib/components/SummarySheet.svelte';
  import MessageBubble from '#lib/components/chats/MessageBubble.svelte';
  import PixelAvatar from '#lib/components/PixelAvatar.svelte';
  import PixelIcon from '#lib/components/icons/PixelIcon.svelte';
  import Chip from '#lib/components/Chip.svelte';
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
  let banner = $state<null | { kind: 'network' | 'api'; message: string | null }>(null);

  // --- transcript scroll state (§3.5) --------------------------------------
  let scrollEl: HTMLElement | null = $state(null);
  /** Near the bottom ⇒ auto-scroll on new messages; else the chip shows. */
  let stick = $state(true);
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
  /**
   * The interlocutor's public bio replaces the theme chips in the header
   * (Concept §8.1.10). Unresolved counterpart or empty bio → nothing extra
   * renders (no placeholder dash).
   */
  const publicBio = $derived(
    counterpart !== null && counterpart.public_bio.trim() !== ''
      ? counterpart.public_bio.trim()
      : null
  );
  /**
   * Dialog UI state (CONCEPT §13 R2 / DESIGN §4.13.2): the dialog reflects
   * the AUTHORITATIVE Chat.done signal — finished → the status chip near
   * the header (reuses the list's status wording; minimal treatment). The
   * attendee dialog has NO kickoff (removed in v2.2): kickoff resets done
   * SERVER-side via the host drill-down only — the attendee side displays.
   */
  const dialogStatus = $derived(chat === null ? null : chatStatus(chat));

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
  const warmingUp = $derived(!loading && !notFound && messages.length === 0);
  const showChip = $derived(!stick && messages.length > 0);

  /** hh:mm message time (Concept §8.1.8) — absolute, active locale. */
  function timeOf(iso: string): string {
    return messageTime(iso, $locale);
  }

  /** Locale day+month date label above the first message (Concept §8.1.8). */
  const dateLabel = $derived(
    messages[0] ? chatDateLabel(messages[0].created_at, $locale) : null
  );

  // --- contact share (DESIGN §4.13.3, Concept §13.1.3) ----------------------
  //
  // The footer's swipe-right slide shares MY contact card with the
  // counterpart (shareContact(to=counterpart, content=card, from=me)). It is
  // ENABLED ONLY when the dialog is finished (the authoritative
  // `isChatDone` gate, tz5-03) AND the local contact card is non-empty
  // (profile/settings); the 255-symbol cap is enforced client-side (store +
  // tz5-01 pre-flight). 201 AND 409 (once per pair) both land the control
  // in the shared state — the local mark (bleak.contactShared) mirrors it;
  // server truth is the 409 on any later attempt.
  let card = $state('');
  let cardShared = $state(false);
  let sharing = $state(false);
  let shareError = $state<string | null>(null);

  $effect(() => {
    const id = me;
    if (!id) return;
    // Re-hydrate on mount and when the identity/chat counterpart changes —
    // the card + the pair marks are local stores, read directly.
    card = loadContactCard(id.roomAddress, id.userAddress);
    cardShared =
      counterpartAddr !== null &&
      isPairShared(id.roomAddress, id.userAddress, counterpartAddr);
  });

  const done = $derived(chat !== null && isChatDone(chat));
  const hasCard = $derived(card.trim() !== '');
  const slideDisabled = $derived(!done || !hasCard);
  const slideHint = $derived(
    !done ? 'chat.contact_share.locked' : 'chat.contact_share.no_card'
  );

  async function shareCard(): Promise<void> {
    const id = me;
    if (!id || !counterpartAddr || sharing) return; // double-submit prevented
    sharing = true;
    shareError = null;
    try {
      await api.shareContact(counterpartAddr, card.trim(), id.userAddress);
      markPairShared(id.roomAddress, id.userAddress, counterpartAddr);
      cardShared = true;
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 409) {
        // ONCE PER PAIR: the server says already shared — the shared state,
        // never an error (server truth over the local mark).
        markPairShared(id.roomAddress, id.userAddress, counterpartAddr);
        cardShared = true;
      } else if (cause instanceof NetworkError || cause instanceof ValidationError) {
        shareError = translate(get(locale), 'common.error.network');
      } else {
        // 400 (empty/overlong content slipping through) + anything else —
        // the transcript page's existing api-error pattern: server text if
        // any, the generic share copy otherwise.
        shareError =
          cause instanceof ApiError && cause.message
            ? cause.message
            : translate(get(locale), 'chat.contact_share.error');
      }
    } finally {
      sharing = false;
    }
  }

  // --- finished-chat summary sheet (DESIGN §4.13.5, Concept §13.1.5) --------
  //
  // Opening a FINISHED chat triggers the ONCE-ONLY hardMatch: the caller
  // passes ITSELF as `first` (me) with the counterpart as `second` — the
  // pair is order-agnostic server-side and stored once per pair (201
  // created / 200 stored, both carry the Summary). The call fires on open
  // (when the authoritative `done` lands), NEVER per poll; the
  // `summaryRequested` flag is reset per chat address so a repeat open
  // re-shows the stored record (the server answers 200 without
  // re-summarizing). Failure surfaces inline in the sheet with a retry
  // affordance — a 401 is the §2.8 global gate and renders no sheet error.
  let summary = $state<Summary | null>(null);
  let summaryOpen = $state(false);
  let summaryLoading = $state(false);
  let summaryError = $state<'network' | 'api' | null>(null);
  let summaryErrorMessage = $state<string | null>(null);
  let summaryRequested = $state(false);

  async function requestSummary(): Promise<void> {
    const id = me;
    if (!id || !counterpartAddr || summaryLoading) return;
    summaryLoading = true;
    summaryError = null;
    summaryErrorMessage = null;
    try {
      const result = await api.hardMatch(id.roomAddress, id.userAddress, counterpartAddr);
      summary = result.summary;
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 401) return; // global gate
      summaryError = cause instanceof NetworkError ? 'network' : 'api';
      summaryErrorMessage = cause instanceof ApiError ? cause.message : null;
    } finally {
      summaryLoading = false;
    }
  }

  // Per-chat reset (the mount effect below owns it) + the once-per-open
  // trigger: fires when the chat is (or becomes) finished while open.
  $effect(() => {
    const addr = address;
    if (!addr) return;
    summary = null;
    summaryOpen = false;
    summaryLoading = false;
    summaryError = null;
    summaryErrorMessage = null;
    summaryRequested = false;
  });

  $effect(() => {
    if (!done || !me || !counterpartAddr || summaryRequested) return;
    summaryRequested = true;
    summaryOpen = true; // the sheet opens itself over the transcript
    void requestSummary();
  });
</script>

<svelte:head>
  <title>{translate($locale, 'chats.title')}</title>
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
          <div class="name-row">
            <h1 class="name">{headerName}</h1>
            {#if chat}
              <Chip variant="outline-muted">{chat.language}</Chip>
            {/if}
            {#if hostView}
              <!-- The room-token viewer fallback served this transcript
                   (ARCHITECTURE §10.3 escape hatch, §3.5). -->
              <Chip variant="outline-muted">{translate($locale, 'chat.host_view')}</Chip>
            {/if}
            {#if dialogStatus === 'finished'}
              <!-- §4.13.2 dialog finished state: the status icon/wording
                   reused near the header (the list card's status wording). -->
              <span
                class="finished-indicator"
                title={translate($locale, 'chats.status.finished')}
              >
                <PixelIcon name="status-finished" size={12} />
                {translate($locale, 'chats.status.finished')}
              </span>
            {/if}
          </div>
          {#if publicBio !== null}
            <!-- Concept §8.1.10: the interlocutor's public info replaces the
                 theme (phase/scenario) display in the header. -->
            <p class="public-bio">{publicBio}</p>
          {/if}
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
            {#if dateLabel !== null}
              <!-- Concept §8.1.8: the locale date label sits centered at the
                   top of the transcript, above the first message. -->
              <p class="date-label">{dateLabel}</p>
            {/if}
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
      <!-- §4.13.3 contact share: the slide is armed only when the dialog is
           finished (isChatDone) and my local contact card is non-empty;
           shared (201 or the once-per-pair 409) is terminal for the view. -->
      <ShareContactSlide
        label={translate($locale, 'chat.contact_share.label')}
        sharedLabel={translate($locale, 'chat.contact_share.shared')}
        disabledHint={translate($locale, slideHint)}
        disabled={slideDisabled}
        pending={sharing}
        shared={cardShared}
        oncomplete={() => void shareCard()}
      />
      {#if shareError}
        <p class="share-error" role="alert" aria-live="polite">{shareError}</p>
      {/if}
    </footer>

    <!-- §4.13.5 summary sheet: the overlay over the transcript; closing it
         (X / Escape / scrim-less close) returns the dialog to its normal
         rendering. The embedded slide shares to the same counterpart — the
         same request + shared state as the footer's control. -->
    <SummarySheet
      bind:open={summaryOpen}
      user={counterpart}
      summary={summary}
      loading={summaryLoading}
      error={summaryError}
      errorMessage={summaryErrorMessage}
      slideLabel={translate($locale, 'chat.contact_share.label')}
      slideSharedLabel={translate($locale, 'chat.contact_share.shared')}
      slideDisabledHint={translate($locale, 'chat.contact_share.no_card')}
      slideDisabled={!hasCard}
      slidePending={sharing}
      slideShared={cardShared}
      onshare={() => void shareCard()}
      onretry={() => void requestSummary()}
    />

    <!-- NO-COMPOSER (ruling 4): no input/textarea/send control anywhere —
         the interactive elements are the back control, the scroll chip and
         the share-contact slide (the kickoff button left the dialog view,
         Concept §8.1.9; the contact share is the owner-approved §13.1.3
         change, not a composer). -->

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
  .name-row {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    min-width: 0;
    overflow: hidden;
  }
  .name-row :global(.chip) {
    flex-shrink: 0;
    font-size: 11px;
    min-height: 20px;
    padding: 1px var(--space-2);
  }
  .name {
    font-family: var(--font-body);
    font-size: 16px;
    font-weight: 600;
    letter-spacing: 0.02em;
    line-height: 1.2;
    margin: 0;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .public-bio {
    margin: 0;
    font-size: 11px;
    line-height: 1.3;
    color: var(--color-text-muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  /* §4.13.2: the dialog finished indicator — the status glyph + wording
   * beside the name row; muted so it stays a subtle state mark (the
   * interactive accent discipline is untouched: it is not a control). */
  .finished-indicator {
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    font-size: 11px;
    color: var(--color-text-muted);
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
  .date-label {
    margin: 0 0 var(--space-3);
    text-align: center;
    font-size: 12px;
    color: var(--color-text-muted);
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
  .share-error {
    margin: 0;
    font-size: 14px;
    color: var(--color-danger-text);
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
