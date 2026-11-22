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
   * server-side via the host drill-down). §4.13.5 (CONCEPT §13.1.5) →
   * §4.15.3.3 (Concept §18.3, owner microchange): opening a FINISHED chat
   * no longer fires the hard-match at open — the Summary is fetched LAZILY
   * IN THE BACKGROUND (when the chat is known finished, the
   * lastMessage/matchScores cadence pattern) and cached per chat in the
   * session store; the sheet still auto-opens for finished chats, reads the
   * cached Summary when present and shows the animated loading state while
   * the fetch is pending. §4.15.B (Concept §15.2): the footer
   * share slide is REMOVED — the slide lives only inside the sheet — and
   * the footer slot holds the SUMMARIZATION BUTTON (done → enabled, opens
   * the sheet on demand; !done → disabled with the in-progress phrase);
   * the tz5-06 auto-open trigger stays as landed.
   */
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { get } from 'svelte/store';
  import { ApiError, NetworkError, type Chat, type Message, type Summary, type User } from '@bleak/api-client';
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
    mergeMessages,
    messageTime,
    speakerName
  } from '#lib/chats/view';
  // §4.18 (tz11-09): the transcript core — the message list rendering +
  // the scrolling/autoscroll machinery + the jump chip — is the SHARED
  // ChatTranscript (the same machinery the creation chat drives). The
  // page keeps its own .scroll/.column chrome (page-owned geometry, the
  // §4.14.4 sheet width contract) and the states around the transcript.
  import ChatTranscript, { type ChatLine } from '#lib/components/chats/ChatTranscript.svelte';
  import { locale, translate } from '#lib/i18n/locale';
  import { counterpartAddress } from '#lib/room/relationships';
  import {
    isPairShared,
    loadContactCard,
    markPairShared
  } from '#lib/stores/contactCard';
  import { ensureSummary, summaries, type SummaryRequest } from '#lib/stores/summaryCache';
  import SummarySheet from '#lib/components/SummarySheet.svelte';
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

  // --- transcript scroll container (§3.5) -----------------------------------
  // The element is BOUND by the page (the .scroll chrome stays page-owned)
  // and handed to the shared ChatTranscript, which owns the stick/autoscroll
  // machinery on it (§4.18).
  let scrollEl: HTMLElement | null = $state(null);
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

  // --- transcript rendering: the shared ChatTranscript (§4.18) ------------
  // The stick/autoscroll machinery (isNearBottom, the instant bottom pin,
  // the jump chip) lives in the shared component, wired onto scrollEl.

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

  /** hh:mm message time (Concept §8.1.8) — absolute, active locale. */
  function timeOf(iso: string): string {
    return messageTime(iso, $locale);
  }

  /** Locale day+month date label above the first message (Concept §8.1.8). */
  const dateLabel = $derived(
    messages[0] ? chatDateLabel(messages[0].created_at, $locale) : null
  );

  /**
   * The transcript lines, mapped onto the shared ChatLine model (§4.18):
   * mine → right-aligned muted; theirs → the speaker's Deepa hue with
   * the speaker + hh:mm meta row and the «speaker: text» accessible
   * name — exactly the rendering the page owned before the extraction.
   */
  const chatLines = $derived.by(
    (): ChatLine[] =>
      messages.map((message) => {
        const speaker = nameOf(message.from);
        return {
          key: message.tx_id,
          who:
            me !== null && isMyMessage(message, me.userAddress) ? ('me' as const) : ('agent' as const),
          text: message.content,
          hueSeed: message.from,
          meta: { speaker, time: timeOf(message.created_at) },
          label: bubbleAriaLabel(speaker, message.content)
        };
      })
  );

  // --- contact share (§4.13.3 → §4.15.B / Concept §15.2 cutover) ------------
  //
  // The dialog-footer slide instance is REMOVED (§4.15.B.1 supersedes the
  // §4.13.3 footer placement): the slide lives ONLY inside the summary
  // sheet. The page keeps the share plumbing the sheet's embedded slide
  // consumes — the local contact card, the pair marks and the shareCard
  // handler (shareContact(to=counterpart, content=card, from=me)). The
  // sheet arms its own slide variant (disabled only when the local card is
  // non-empty check fails). 201 AND 409 (once per pair) both land the
  // shared state — the local mark (bleak.contactShared) mirrors it; server
  // truth is the 409 on any later attempt. Any other failure leaves the
  // sheet's slide armed for a retry — the share error surfaces exclusively
  // through the sheet (§4.15.B.1; the footer alert is gone with the slide).
  let card = $state('');
  let cardShared = $state(false);
  let sharing = $state(false);

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

  async function shareCard(): Promise<void> {
    const id = me;
    if (!id || !counterpartAddr || sharing) return; // double-submit prevented
    sharing = true;
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
      }
      // Other failures (network / 400 / …): no footer alert — the sheet's
      // slide returns to its armed state and stays available for a retry
      // (§4.15.B.1: the share error surfaces exclusively through the sheet).
    } finally {
      sharing = false;
    }
  }

  // --- finished-chat summary sheet (DESIGN §4.13.5 → §4.15.3.3) -------------
  //
  // LAZY BACKGROUND FETCH (owner microchange, Concept §18.3): for a FINISHED
  // chat the once-only hardMatch runs in the BACKGROUND — the caller passes
  // ITSELF as `first` (me) with the counterpart as `second`; the pair is
  // order-agnostic server-side and stored once per pair (201 created / 200
  // stored, both carry the Summary). The fetch starts when the chat is known
  // finished (the tick that observes `done`, like the lastMessage/matchScores
  // background-cadence pattern) and caches per chat in the session store —
  // the store's guards (ready / pending / failed entries) keep it ONE fetch
  // per finished chat unless it failed. Opening the sheet (auto-open or the
  // footer button) NEVER fires the request: the sheet reads the cached
  // Summary when present and shows the animated loading state while the
  // background fetch is pending, swapping to the content when it lands.
  // Failure surfaces inline in the sheet with a retry affordance (a force
  // re-fetch through the same store); a 401 is the §2.8 global gate and
  // renders no sheet error (`failure.gate`).
  const summaryEntry = $derived(
    me && counterpartAddr ? ($summaries.get(address) ?? null) : null
  );
  const summary = $derived(
    summaryEntry !== null && summaryEntry.status === 'ready' ? summaryEntry.summary : null
  );
  /** Pending = no entry yet or the background fetch is running. */
  const summaryLoading = $derived(
    summaryEntry === null || summaryEntry.status === 'pending'
  );
  const summaryError = $derived(
    summaryEntry !== null &&
    summaryEntry.status === 'failed' &&
    !summaryEntry.failure.gate
      ? summaryEntry.failure.kind
      : null
  );
  const summaryErrorMessage = $derived(
    summaryEntry !== null &&
    summaryEntry.status === 'failed' &&
    !summaryEntry.failure.gate
      ? summaryEntry.failure.message
      : null
  );

  /** The injected hardMatch call — the store owns the guards, not the page. */
  function fetchSummaryFor(first: string): (request: SummaryRequest) => Promise<Summary> {
    return (request) =>
      api
        .hardMatch(request.room, first, request.counterpart)
        .then((result) => result.summary);
  }

  /**
   * The sheet's retry affordance (§4.15.3.3): a failed background fetch
   * re-runs ON DEMAND — `force` bypasses the store's failed-entry guard
   * (never the in-flight one), so a retry while pending stays a no-op.
   */
  function retrySummary(): void {
    const id = me;
    if (!id || !counterpartAddr) return;
    void ensureSummary(
      [{ address, room: id.roomAddress, counterpart: counterpartAddr }],
      id.userAddress,
      fetchSummaryFor(id.userAddress),
      { force: true }
    );
  }

  // Per-chat reset (the mount effect below owns it) + the auto-open trigger:
  // the sheet opens itself over the transcript when the chat is (or becomes)
  // finished — the tz5-06 landed behavior — but it no longer fires the fetch
  // (§4.15.3.3: opening never blocks on the background call).
  let summaryOpen = $state(false);
  let summaryAutoOpened = $state(false);

  $effect(() => {
    const addr = address;
    if (!addr) return;
    summaryOpen = false;
    summaryAutoOpened = false;
  });

  // The lazy background fetch: fires when the chat is known finished — NOT
  // at sheet open. The store's entry guards make repeat ticks no-ops.
  $effect(() => {
    const id = me;
    if (!done || !id || !counterpartAddr) return;
    void ensureSummary(
      [{ address, room: id.roomAddress, counterpart: counterpartAddr }],
      id.userAddress,
      fetchSummaryFor(id.userAddress)
    );
  });

  $effect(() => {
    if (!done || !me || !counterpartAddr || summaryAutoOpened) return;
    summaryAutoOpened = true;
    summaryOpen = true; // the sheet opens itself over the transcript
  });

  /**
   * §4.15.B.2 (Concept §15.2): the footer summarization button — the
   * ON-DEMAND re-open path beside the auto-open trigger. It opens the sheet
   * over the pending/arrived state and NEVER forces a second request
   * (§4.15.3.3): a cached Summary re-shows instantly; a pending background
   * fetch keeps the loading state; a failed one shows the inline error with
   * the sheet's retry affordance.
   */
  function openSummary(): void {
    if (!done) return;
    summaryOpen = true;
  }
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

    <main class="scroll" bind:this={scrollEl}>
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
        {:else if warmingUp}
          <div class="warming" role="status">
            <span class="warming-glyph"><PixelIcon name="dialog-lines" size={16} /></span>
            <p>{translate($locale, 'chat.warming_up')}</p>
          </div>
        {:else}
          <!-- §4.18 (tz11-09): the shared transcript core — the date label,
               the message list and the jump chip render here; the stick/
               autoscroll machinery is wired onto THIS page's .scroll
               container (behavior-neutral: the same DOM the page rendered
               before the extraction). -->
          <ChatTranscript
            lines={chatLines}
            scroller={scrollEl}
            dateLabel={dateLabel}
            resetKey={address}
          />
        {/if}
      </div>
    </main>

    <footer class="footer">
      <!-- §4.15.B.2 (Concept §15.2): the summarization button took the
           footer slot from the removed share slide (the slide lives only
           inside the sheet now). `done` → enabled, opens the sheet again
           on demand — over the cached/pending/failed summary state with NO
           new hard-match call (§4.15.3.3: the background cadence owns the
           fetch); `!done` → disabled with the "dialog in progress" phrase. -->
      <button
        type="button"
        class="summary-open"
        disabled={!done}
        onclick={openSummary}
      >
        {done
          ? translate($locale, 'chat.summary.open')
          : translate($locale, 'chat.summary.open.disabled')}
      </button>
    </footer>

    <!-- §4.13.5 → §4.15.C summary sheet: the overlay over the transcript;
         closing it (X / Escape) returns the dialog to its normal rendering.
         The embedded slide shares to the same counterpart via the page's
         shareCard handler — the ONLY slide instance since the §4.15.B.1
         footer cutover. -->
    <SummarySheet
      bind:open={summaryOpen}
      user={counterpart}
      summary={summary}
      loading={summaryLoading}
      error={summaryError}
      errorMessage={summaryErrorMessage}
      slideSharedLabel={translate($locale, 'chat.contact_share.shared')}
      slideDisabledHint={translate($locale, 'chat.contact_share.no_card')}
      slideDisabled={!hasCard}
      slidePending={sharing}
      slideShared={cardShared}
      onshare={() => void shareCard()}
      onretry={retrySummary}
    />

    <!-- NO-COMPOSER (ruling 4): no input/textarea/send control anywhere —
         the interactive elements are the back control, the scroll chip and
         the summarization button (the footer share slide left in the
         §4.15.B cutover; the kickoff button left the dialog view, Concept
         §8.1.9 — none of these is a composer). -->

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
  /* The skeleton transcript list (§3.5 states): the real transcript
   * styling lives in the shared ChatTranscript (§4.18); this rule only
   * dresses the skeleton's placeholder list while loading. */
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
  .footer {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    padding: var(--space-3) var(--space-4) calc(var(--space-4) + env(safe-area-inset-bottom, 0px));
    max-width: 720px;
    width: 100%;
    margin: 0 auto;
  }
  /* §4.15.B.2: the summarization button — the footer slot the slide
   * occupied (below the transcript scroll, above the tab bar), the page's
   * standard inset width. 48px touch target, pill radius. Disabled:
   * transparent surface + 1px --color-text-disabled-strong border + the
   * disabled-strong ink; enabled: the accent-soft treatment (the yellow
   * interactive/active discipline holds — it IS a control). */
  .summary-open {
    width: 100%;
    min-height: var(--touch-target);
    padding: 0 var(--space-4);
    border-radius: var(--radius-pill);
    border: 1px solid transparent;
    background: var(--color-accent-soft);
    color: var(--color-text);
    font-size: 14px;
    font-weight: 600;
    transition: opacity 120ms ease-out;
  }
  .summary-open:disabled {
    background: transparent;
    border-color: var(--color-text-disabled-strong);
    color: var(--color-text-disabled-strong);
    cursor: default;
  }
  .summary-open:not(:disabled):active {
    opacity: 0.85;
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
