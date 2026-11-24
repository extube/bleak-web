<script lang="ts">
  /**
   * `/host/[room_address]/invite/[code]/qr` — invite QR page (DESIGN rev. 4
   * §3.7.4, TZ13-04 Part B). Show or hand out ONE invite code: a scannable
   * QR of the invite deep link, the 6-digit code to read aloud or copy, and
   * a share-or-copy-link control.
   *
   * - **Guard** (as §3.7.2): the stored `bleak.hostRoom.roomAddress` must
   *   equal the URL param, else redirect `/host`. An unknown `[code]` (in
   *   neither the server list nor the ledger) still renders the page with
   *   the warning line — the host may hold a printout of a still-valid
   *   code this device does not know.
   * - **QR:** client-side `InviteQr` (the shared §3.6 `uqr` renderer) of the
   *   absolute invite deep link `{INVITE_URL_BASE}?code={code}` — NO
   *   network QR call (rev. 4 decision). 280px, pixel-cornered light frame.
   * - **Hard ruling (Concept §54.1):** the link text is NEVER rendered —
   *   no text node, no `title`, no tooltip; buttons only. The payload
   *   exists only as a clipboard/share value in component state.
   * - **No Poller:** ONE liveness recheck on mount (room-token
   *   `listInvites`), then idle. Unknown-code warning after the recheck;
   *   loading skeleton during it; inline error with retry.
   * - **Share-or-copy-link:** «Скопировать ссылку» (clipboard gets the
   *   URL) + «Поделиться» only where `navigator.share` exists (same URL).
   *   «Скопировано» confirmations are announced `aria-live="polite"`.
   */
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { get } from 'svelte/store';
  import { ApiError } from '@bleak/api-client';
  import { hostApi, HOST_NOTICE_KEY } from '#lib/api/client';
  import { apiErrorText } from '#lib/join';
  import { locale, translate } from '#lib/i18n/locale';
  import { hostRoom, clearHostRoom, initHostSession } from '#lib/stores/hostSession';
  import { readLedger } from '#lib/stores/hostInviteLedger';
  import { inviteQrPayload } from '#lib/qr/svgQr';
  import InviteQr from '#lib/components/qr/InviteQr.svelte';
  import ErrorBanner from '#lib/components/ErrorBanner.svelte';
  import SkeletonBlock from '#lib/components/SkeletonBlock.svelte';

  // --- guard (§3.7.2): the stored room must match the URL param -----------
  const roomParam = $derived(page.params.room_address ?? '');
  const code = $derived(page.params.code ?? '');
  const currentRoom = $derived($hostRoom);
  const guardOk = $derived(currentRoom !== null && currentRoom.roomAddress === roomParam);

  let booted = $state(false);
  let redirecting = $state(false);

  $effect(() => {
    if (booted) return;
    initHostSession();
    booted = true;
    const stored = get(hostRoom);
    if (!stored || stored.roomAddress !== roomParam) {
      // Missing or mismatched entry → /host (§1.3).
      redirecting = true;
      void goto(resolve('/host'));
    }
  });

  // --- the ONE liveness recheck on mount — no Poller (§3.7.4 item 4) ------
  let recheckStarted = $state(false);
  let checking = $state(true);
  let unknownCode = $state(false);
  let recheckError = $state<null | { kind: 'network' | 'api'; message: string | null }>(null);

  function errorFrom(cause: unknown): { kind: 'network' | 'api'; message: string | null } {
    if (cause instanceof ApiError) return { kind: 'api', message: apiErrorText(cause) };
    return { kind: 'network', message: null };
  }

  /**
   * Host session reset: a 401/403 on the room-token recheck means revoked
   * access — clear `bleak.hostRoom`, keep the `bleak.hostNotice` flag and
   * land on `/host`. Attendee identity is NEVER touched.
   */
  function handleHostReset(cause: unknown): void {
    if (cause instanceof ApiError && (cause.status === 401 || cause.status === 403)) {
      clearHostRoom();
      try {
        sessionStorage.setItem(HOST_NOTICE_KEY, '1');
      } catch {
        /* storage unavailable — the notice is best-effort */
      }
      void goto(resolve('/host'));
    }
  }

  async function recheck(): Promise<void> {
    const current = get(hostRoom);
    if (!current) return;
    checking = true;
    recheckError = null;
    try {
      const list = await hostApi.listInvites(current.roomAddress);
      // Known when the server lists the code — or THIS device's ledger
      // records it (an expired/revoked code of this device is still known).
      const known =
        list.some((invite) => invite.code === code) ||
        readLedger(current.roomAddress).some((entry) => entry.code === code);
      unknownCode = !known;
      checking = false;
    } catch (cause: unknown) {
      recheckError = errorFrom(cause);
      checking = false;
      handleHostReset(cause);
    }
  }

  $effect(() => {
    if (!booted || redirecting || !guardOk) return;
    if (recheckStarted) return;
    recheckStarted = true;
    void recheck();
  });

  // --- the invite deep link — a COPY/SHARE PAYLOAD ONLY (hard ruling) -----
  // Never rendered: no text node, no title, no tooltip anywhere below.
  const payload = $derived(code !== '' ? inviteQrPayload(code) : '');

  /** Share renders only where the Web Share API exists (§3.7.4 item 3). */
  const canShare = typeof navigator.share === 'function';

  // --- copy / share (the «Скопировано» confirmations are polite) ----------
  let copiedNote = $state(false);
  let copiedTimer: ReturnType<typeof setTimeout> | null = null;

  function fallbackCopy(text: string): void {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', 'readonly');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand('copy');
    } catch {
      /* clipboard unavailable — nothing else we can do in-place */
    }
    textarea.remove();
  }

  async function copyText(value: string): Promise<void> {
    try {
      if (navigator.clipboard) await navigator.clipboard.writeText(value);
      else fallbackCopy(value);
    } catch {
      fallbackCopy(value);
    }
    copiedNote = true;
    if (copiedTimer) clearTimeout(copiedTimer);
    copiedTimer = setTimeout(() => (copiedNote = false), 2000);
  }

  function onShare(): void {
    void navigator.share({ url: payload });
  }

  // --- derived copy ---------------------------------------------------------
  const title = $derived(translate($locale, 'host.qr.title'));
  const backLabel = $derived(translate($locale, 'host.qr.back'));
  const qrAria = $derived(translate($locale, 'host.qr.aria', { code }));
  const copyCodeLabel = $derived(translate($locale, 'host.qr.copy_code'));
  const copyCodeAria = $derived(translate($locale, 'host.qr.copy_code_aria', { code }));
  const copyLinkLabel = $derived(translate($locale, 'host.qr.copy_link'));
  const copyLinkAria = $derived(translate($locale, 'host.qr.copy_link_aria'));
  const shareLabel = $derived(translate($locale, 'host.qr.share'));
  const warningLabel = $derived(translate($locale, 'host.qr.warning'));
  const copiedLabel = $derived(translate($locale, 'common.copied'));
</script>

<svelte:head>
  <title>{title} — bleak-web</title>
</svelte:head>

<main class="qr-page">
  {#if booted && !redirecting && guardOk}
    <header class="topbar">
      <a
        class="back"
        href={resolve('/host/[room_address]/invite', { room_address: roomParam })}
      >
        {backLabel}
      </a>
      <h1>{title}</h1>
    </header>

    <section class="card pixel-corners" aria-label={title}>
      {#if checking}
        <!-- Loading: skeleton card during the one liveness recheck. -->
        <div class="skeleton" aria-hidden="true">
          <SkeletonBlock width="280px" height="280px" />
          <SkeletonBlock width="200px" height="48px" />
        </div>
      {:else}
        {#if recheckError}
          <!-- Inline muted error with retry; the QR cannot fail on network. -->
          <ErrorBanner
            kind={recheckError.kind}
            message={recheckError.message}
            onretry={() => void recheck()}
          />
        {:else if unknownCode}
          <!-- Unknown [code]: not in the server list nor the ledger. -->
          <p class="warning" role="status">{warningLabel}</p>
        {/if}

        <InviteQr {code} size={280} ariaLabel={qrAria} />

        <div class="code-row">
          <span class="code">{code}</span>
          <button
            type="button"
            class="chip"
            aria-label={copyCodeAria}
            onclick={() => void copyText(code)}
          >
            {copyCodeLabel}
          </button>
        </div>

        <div class="link-actions">
          <button
            type="button"
            class="chip"
            aria-label={copyLinkAria}
            onclick={() => void copyText(payload)}
          >
            {copyLinkLabel}
          </button>
          {#if canShare}
            <button type="button" class="chip" onclick={onShare}>{shareLabel}</button>
          {/if}
        </div>

        {#if copiedNote}
          <p class="copied" role="status" aria-live="polite">{copiedLabel}</p>
        {/if}
      {/if}
    </section>
  {/if}
</main>

<style>
  .qr-page {
    flex: 1;
    width: 100%;
    max-width: 480px;
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
  h1 {
    font-size: 32px;
    margin: 0;
  }
  .card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-4);
    padding: var(--space-5) var(--space-4);
    background: var(--color-surface);
  }
  .skeleton {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-4);
  }
  .warning {
    margin: 0;
    font-size: 14px;
    color: var(--color-text-muted);
    text-align: center;
  }
  .code-row {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }
  .code {
    font-family: var(--font-pixel);
    font-size: 40px;
    letter-spacing: 0.2em;
    color: var(--color-text);
  }
  .link-actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: var(--space-2);
  }
  .chip {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: var(--touch-target);
    padding: 0 var(--space-4);
    border: 1px solid var(--color-text-disabled-strong);
    background: transparent;
    color: var(--color-text);
    border-radius: var(--radius-pill);
    font-size: 14px;
    font-weight: 600;
    transition:
      border-color 120ms ease-out,
      color 120ms ease-out;
  }
  .copied {
    margin: 0;
    font-size: 14px;
    color: var(--color-accent);
  }
</style>
