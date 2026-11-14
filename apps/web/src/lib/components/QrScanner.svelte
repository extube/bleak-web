<script lang="ts">
  /**
   * QrScanner (DESIGN §3.8, TZ-04) — the shared full-screen camera scanner
   * overlay, two contexts: (a) invite — mounted on `/`, reads an invite QR
   * (`?code=NNNNNN`) and feeds the join flow; (b) persona — mounted on
   * `/room` (and the `/?u=` deep link), reads a persona QR (`?u=`) and runs
   * the ruling-3 mutual-handshake routine (lib/scanner/mutualHandshake.ts).
   *
   * Camera lifecycle (binding): the stream starts ONLY on the «Включить
   * камеру» tap; every track is stopped on close, on result, and on
   * unmount/navigation — the camera light always goes off. The decoder
   * (BarcodeDetector, else lazy jsqr) is loaded only in the granted path —
   * no QR module cost until the overlay actually scans.
   */
  import { resolve } from '$app/paths';
  import { tick } from 'svelte';
  import type { User } from '@bleak/api-client';
  import { api } from '#lib/api/client';
  import { identity } from '#lib/stores/identity';
  import { chatCounterparts } from '#lib/room/relationships';
  import { parseQrPayload } from '#lib/scanner/payload';
  import {
    classifyPersonaScan,
    sendMutualHandshakes,
    type PersonaEnv,
    type ScanOutcome
  } from '#lib/scanner/mutualHandshake';
  import type { FrameDecoder } from '#lib/scanner/decode';
  import { locale, translate } from '#lib/i18n/locale';
  import PixelIcon from './icons/PixelIcon.svelte';
  import PixelAvatar from './PixelAvatar.svelte';

  interface Props {
    open?: boolean;
    context?: 'invite' | 'persona';
    members?: readonly User[];
    onInviteCode?: (code: string) => void;
    onPersonaScanned?: (userAddress: string) => void;
    onClosed?: () => void;
  }

  let {
    open = $bindable(false),
    context = 'invite',
    members,
    onInviteCode,
    onPersonaScanned,
    onClosed
  }: Props = $props();

  type CameraPhase = 'unasked' | 'requesting' | 'granted' | 'denied' | 'no-camera';

  type ScanResult =
    | { kind: 'invalid' }
    | { kind: 'own' }
    | { kind: 'foreign'; address: string }
    | { kind: 'confirm'; address: string; name: string }
    | { kind: 'success'; address: string; chatAddress: string | null }
    | { kind: 'error-network'; address: string }
    | { kind: 'error-api'; address: string; message: string };

  let phase = $state<CameraPhase>('unasked');
  let result = $state<ScanResult | null>(null);
  let insecureOrigin = $state(false);
  let trading = $state(false);
  let flash = $state(false);
  let overlayEl: HTMLDivElement | null = $state(null);
  let videoEl: HTMLVideoElement | null = $state(null);

  const me = $derived($identity);

  // Non-reactive camera handles (plain lets — never rendered directly).
  let stream: MediaStream | null = null;
  let loopToken = 0;
  let flashTimer = 0;
  let personaEnv: PersonaEnv | null = null;
  let focusReturn: HTMLElement | null = null;

  const titleLabel = $derived(translate($locale, 'scan.title'));
  const closeLabel = $derived(translate($locale, 'scan.close'));
  const scannerLabel = $derived(translate($locale, 'scan.aria'));
  const turnOnLabel = $derived(translate($locale, 'scan.turn_on'));
  const tryAgainLabel = $derived(translate($locale, 'scan.try_again'));
  const againLabel = $derived(translate($locale, 'scan.again'));
  const retryLabel = $derived(translate($locale, 'common.retry'));
  const fallbackLabel = $derived(
    translate($locale, context === 'invite' ? 'scan.fallback.enter_code' : 'scan.fallback.find_list')
  );
  const hintText = $derived(
    translate($locale, context === 'invite' ? 'scan.hint.join' : 'scan.hint.person')
  );
  const granted = $derived(phase === 'granted' && result === null);
  const announcement = $derived(announce(phase, result));

  function announce(phase: CameraPhase, result: ScanResult | null): string {
    if (result) {
      switch (result.kind) {
        case 'invalid':
          return translate($locale, 'scan.invalid_qr');
        case 'own':
          return translate($locale, 'scan.own_qr');
        case 'foreign':
          return translate($locale, 'scan.foreign_persona');
        case 'confirm':
          return translate($locale, 'scan.confirm.title');
        case 'success':
          return translate($locale, 'hs.agents_talking');
        case 'error-network':
          return translate($locale, 'scan.error.network');
        case 'error-api':
          return `${translate($locale, 'common.error.api')}: ${result.message}`;
      }
    }
    switch (phase) {
      case 'unasked':
        return translate($locale, 'scan.permission.intro');
      case 'requesting':
        return translate($locale, 'scan.turn_on');
      case 'granted':
        return hintText;
      case 'denied':
        return translate($locale, 'scan.permission.denied');
      case 'no-camera':
        return translate($locale, 'scan.no_camera');
    }
  }

  // --- overlay lifecycle ----------------------------------------------------

  $effect(() => {
    if (open) {
      focusReturn = document.activeElement as HTMLElement | null;
      phase = 'unasked';
      result = null;
      insecureOrigin = false;
      flash = false;
      trading = false;
      personaEnv = null;
      void tick().then(() => overlayEl?.focus());
      return () => {
        // Stop the loop and every camera track on close and on route
        // unmount (the camera light must always go off), restore focus.
        stopLoop();
        stopCamera();
        if (flashTimer) window.clearTimeout(flashTimer);
        flashTimer = 0;
        restoreFocus();
      };
    }
  });

  function close(): void {
    open = false;
    // §3.8 focus return — but only while focus still sits inside the
    // overlay: an explicit consumer refocus (e.g. the join page's digit
    // cells) is called right after and must win.
    restoreFocus();
    onClosed?.();
  }

  function restoreFocus(): void {
    if (!focusReturn) return;
    const active = document.activeElement;
    const inside =
      active instanceof Node && overlayEl !== null && (active === overlayEl || overlayEl.contains(active));
    if (inside) focusReturn.focus();
    focusReturn = null;
  }

  function overlayKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
      return;
    }
    if (event.key !== 'Tab' || !overlayEl) return;
    const focusables = Array.from(
      overlayEl.querySelectorAll<HTMLElement>('button, a[href], [tabindex]:not([tabindex="-1"])')
    ).filter((el) => !el.hasAttribute('disabled'));
    if (focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  // --- camera lifecycle (§3.8 state machine) ---------------------------------

  function stopCamera(): void {
    if (stream) {
      for (const track of stream.getTracks()) track.stop();
      stream = null;
    }
    if (videoEl) videoEl.srcObject = null;
  }

  function stopLoop(): void {
    loopToken += 1;
  }

  async function startCamera(): Promise<void> {
    phase = 'requesting';
    result = null;
    const media = navigator.mediaDevices;
    if (!media || typeof media.getUserMedia !== 'function' || !window.isSecureContext) {
      // Insecure origin / unsupported: degrade to the no-camera state.
      insecureOrigin = !window.isSecureContext;
      phase = 'no-camera';
      return;
    }
    try {
      stream = await media.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
      if (!open || !stream) {
        stopCamera(); // closed while requesting — light off immediately
        return;
      }
      insecureOrigin = false;
      phase = 'granted';
      await tick();
      const video = videoEl;
      if (video && stream) {
        // Viewfinder wiring is non-fatal: a srcObject/play failure must not
        // mask an already-granted camera permission (stream stays live).
        try {
          video.srcObject = stream;
          const played = video.play();
          if (played && typeof played.then === 'function') played.catch(() => undefined);
        } catch {
          /* autoplay/validation guards are non-fatal */
        }
      }
      void startLoop();
    } catch (err) {
      stream = null;
      const name = err instanceof Error ? err.name : '';
      phase = name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : 'no-camera';
    }
  }

  // --- detection loop (§3.8): decoder loaded ONLY in the granted path -------

  const DECODE_MIN_INTERVAL_MS = 250; // ≤4 decode attempts per second

  async function startLoop(): Promise<void> {
    const token = ++loopToken;
    let decoder: FrameDecoder | null = null;
    try {
      const { loadDecoder } = await import('#lib/scanner/decode');
      decoder = await loadDecoder();
    } catch {
      decoder = null; // decoder unavailable — viewfinder still shows
    }
    if (token !== loopToken || phase !== 'granted') return;

    let lastAttempt = 0;

    const scheduleNext = (): void => {
      if (token !== loopToken) return;
      const video = videoEl as
        | (HTMLVideoElement & { requestVideoFrameCallback?: (cb: () => void) => void })
        | null;
      if (video && typeof video.requestVideoFrameCallback === 'function') {
        video.requestVideoFrameCallback(() => void step());
      } else {
        requestAnimationFrame(() => void step());
      }
    };

    const step = async (): Promise<void> => {
      if (token !== loopToken || phase !== 'granted') return;
      const now = performance.now();
      if (now - lastAttempt >= DECODE_MIN_INTERVAL_MS) {
        lastAttempt = now;
        const video = videoEl;
        const text = video && decoder ? await decoder.decodeFrame(video) : null;
        if (token !== loopToken || phase !== 'granted') return;
        if (text) {
          onDecoded(text);
          return;
        }
      }
      scheduleNext();
    };

    void step();
  }

  /** Successful decode: stop everything, flash, then process the payload. */
  function onDecoded(text: string): void {
    stopLoop();
    stopCamera();
    flash = true;
    const delay = reducedMotion() ? 0 : 120;
    flashTimer = window.setTimeout(() => {
      flashTimer = 0;
      flash = false;
      processPayload(text);
    }, delay);
  }

  function reducedMotion(): boolean {
    return (
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
  }

  // --- payload routing (§3.8 processing) -------------------------------------

  function processPayload(text: string): void {
    const payload = parseQrPayload(text);
    if (!payload) {
      result = { kind: 'invalid' };
      return;
    }
    if (payload.kind === 'invite') {
      if (context === 'invite') {
        // The scanner closes and hands the code to the join flow exactly
        // as manual entry (§3.1 step 1); it does not reopen on failure.
        onInviteCode?.(payload.code);
        open = false;
        onClosed?.();
      } else {
        result = { kind: 'invalid' };
      }
      return;
    }
    if (context === 'persona') {
      void beginPersonaRoutine(payload.userAddress);
    } else {
      result = { kind: 'invalid' };
    }
  }

  // --- persona routine (ruling 3; the module owns the logic) -----------------

  function memberName(address: string): string {
    const match = members?.find((member) => member.address === address);
    return match && !match.deleted_at ? match.name : address;
  }

  async function beginPersonaRoutine(userAddress: string): Promise<void> {
    onPersonaScanned?.(userAddress); // persona QR resolved (API contract)
    const mine = me;
    if (!mine) {
      // Unreachable in practice (both persona entries require an identity);
      // never send handshakes without an own persona.
      result = { kind: 'foreign', address: userAddress };
      return;
    }
    let counterparts: ReadonlySet<string> = new Set();
    try {
      counterparts = chatCounterparts(await api.listChatsOfUser(mine.userAddress), mine.userAddress);
    } catch {
      /* chat list unknown — idempotent POSTs keep the flow safe */
    }
    const env: PersonaEnv = {
      myAddress: mine.userAddress,
      memberList: members ?? [],
      existingChatCounterparts: counterparts,
      api
    };
    personaEnv = env;
    applyOutcome(userAddress, await classifyPersonaScan(userAddress, env));
  }

  function applyOutcome(address: string, outcome: ScanOutcome): void {
    switch (outcome.kind) {
      case 'own':
        result = { kind: 'own' };
        break;
      case 'foreign':
        result = { kind: 'foreign', address };
        break;
      case 'confirm':
        result = { kind: 'confirm', address, name: memberName(address) };
        break;
      case 'success':
        result = { kind: 'success', address, chatAddress: outcome.chatAddress };
        break;
      case 'error-network':
        result = { kind: 'error-network', address };
        break;
      case 'error-api':
        result = { kind: 'error-api', address, message: outcome.message };
        break;
    }
  }

  async function tradeHandshakes(): Promise<void> {
    const current = result;
    if (!current || trading) return;
    const addressable =
      current.kind === 'confirm' || current.kind === 'error-network' || current.kind === 'error-api';
    if (!addressable) return;
    const env = personaEnv;
    if (!env) return;
    trading = true;
    try {
      applyOutcome(current.address, await sendMutualHandshakes(current.address, env));
    } finally {
      trading = false;
    }
  }

  function scanAgain(): void {
    result = null;
    personaEnv = null;
    void startCamera();
  }
</script>

<svelte:window onkeydown={(event) => (open ? overlayKeydown(event) : undefined)} />

{#if open}
  <div
    class="overlay"
    role="dialog"
    aria-modal="true"
    aria-label={scannerLabel}
    tabindex="-1"
    bind:this={overlayEl}
  >
    <header class="top-bar pixel-corners">
      <button type="button" class="close" aria-label={closeLabel} onclick={close}>
        <PixelIcon name="close" size={16} />
      </button>
      <h2>{titleLabel}</h2>
    </header>

    <div class="stage">
      {#if granted}
        <!-- Viewfinder (§3.8 layout 2): live video, scan frame, context hint. -->
        <div class="viewfinder">
          <video class="video" playsinline muted autoplay aria-hidden="true" bind:this={videoEl}></video>
          <div class="frame" class:flash aria-hidden="true">
            <span class="bracket tl"></span>
            <span class="bracket tr"></span>
            <span class="bracket bl"></span>
            <span class="bracket br"></span>
          </div>
          <p class="hint">{hintText}</p>
        </div>
      {:else}
        <!-- Permission / capability / result panels (§3.8 state machine). -->
        <div class="panel">
          <div class="panel-card pixel-corners">
            {#if result === null && (phase === 'unasked' || phase === 'requesting')}
              <PixelIcon name="scan" size={16} />
              <p>{translate($locale, 'scan.permission.intro')}</p>
              <button type="button" class="cta" disabled={phase === 'requesting'} onclick={startCamera}>
                {#if phase === 'requesting'}<span class="spinner" aria-hidden="true"></span>{/if}
                {turnOnLabel}
              </button>
            {:else if result === null && phase === 'denied'}
              <PixelIcon name="lock" size={16} />
              <p>{translate($locale, 'scan.permission.denied')}</p>
              <button type="button" class="secondary" onclick={startCamera}>{tryAgainLabel}</button>
            {:else if result === null && phase === 'no-camera'}
              <PixelIcon name="lock" size={16} />
              <p>{translate($locale, 'scan.no_camera')}</p>
              {#if insecureOrigin}
                <p class="note">{translate($locale, 'scan.insecure')}</p>
              {/if}
            {:else if result?.kind === 'invalid'}
              <PixelIcon name="scan" size={16} />
              <p>{translate($locale, 'scan.invalid_qr')}</p>
              <button type="button" class="secondary" onclick={scanAgain}>{againLabel}</button>
            {:else if result?.kind === 'own'}
              <PixelAvatar address={me?.userAddress ?? ''} size={56} own />
              <p>{translate($locale, 'scan.own_qr')}</p>
              <button type="button" class="secondary" onclick={scanAgain}>{againLabel}</button>
            {:else if result?.kind === 'foreign'}
              <PixelAvatar address={result.address} size={56} />
              <p>{translate($locale, 'scan.foreign_persona')}</p>
              <button type="button" class="secondary" onclick={scanAgain}>{againLabel}</button>
            {:else if result?.kind === 'confirm'}
              <PixelAvatar address={result.address} size={56} />
              <h3>{result.name}</h3>
              <p>{translate($locale, 'scan.confirm.title')}</p>
              <div class="actions">
                <button type="button" class="secondary" disabled={trading} onclick={scanAgain}>
                  {translate($locale, 'scan.confirm.cancel')}
                </button>
                <button type="button" class="cta" disabled={trading} onclick={tradeHandshakes}>
                  {#if trading}<span class="spinner" aria-hidden="true"></span>{/if}
                  {translate($locale, 'scan.confirm.cta')}
                </button>
              </div>
              <button type="button" class="link" onclick={scanAgain}>{againLabel}</button>
            {:else if result?.kind === 'error-network' || result?.kind === 'error-api'}
              <PixelAvatar address={result.address} size={56} />
              {#if result.kind === 'error-network'}
                <p>{translate($locale, 'scan.error.network')}</p>
              {:else}
                <p>{result.message}</p>
              {/if}
              <button type="button" class="cta" disabled={trading} onclick={tradeHandshakes}>
                {#if trading}<span class="spinner" aria-hidden="true"></span>{/if}
                {retryLabel}
              </button>
              <button type="button" class="link" onclick={scanAgain}>{againLabel}</button>
            {:else if result?.kind === 'success'}
              <div class="pair" aria-hidden="true">
                <PixelAvatar address={me?.userAddress ?? ''} size={44} own />
                <PixelAvatar address={result.address} size={44} />
              </div>
              <p>{translate($locale, 'hs.agents_talking')}</p>
              <a
                class="cta"
                href={result.chatAddress
                  ? resolve('/chats/[address]', { address: result.chatAddress })
                  : resolve('/chats')}
                onclick={close}
              >
                {translate($locale, 'hs.open_dialog')}
              </a>
              <button type="button" class="link" onclick={scanAgain}>{againLabel}</button>
            {/if}
          </div>
        </div>
      {/if}
    </div>

    <footer class="bottom">
      <button type="button" class="fallback" onclick={close}>{fallbackLabel}</button>
    </footer>

    <p class="vh" aria-live="polite">{announcement}</p>
  </div>
{/if}

<style>
  .overlay {
    position: fixed;
    inset: 0;
    background: var(--color-bg);
    z-index: 50;
    display: flex;
    flex-direction: column;
  }
  .top-bar {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    min-height: 56px;
    padding: 0 var(--space-3);
    background: var(--color-surface);
  }
  .top-bar h2 {
    font-size: 20px;
    margin: 0;
  }
  .close {
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
  .close:hover {
    color: var(--color-text);
  }

  .stage {
    flex: 1;
    display: flex;
    min-height: 0;
  }
  .viewfinder {
    position: relative;
    flex: 1;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .video {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  /* Scan frame: four accent pixel corner brackets (§3.8) — the interior is
   * untouched video. Transform/opacity motion only (§4.6). */
  .frame {
    position: relative;
    width: 240px;
    height: 240px;
    pointer-events: none;
  }
  .bracket {
    position: absolute;
    width: 48px;
    height: 48px;
  }
  .bracket::before,
  .bracket::after {
    content: '';
    position: absolute;
    background: var(--color-accent);
    opacity: 0.85;
    transition: opacity 120ms ease-out;
  }
  .bracket::before {
    width: 100%;
    height: 8px;
  }
  .bracket::after {
    width: 8px;
    height: 100%;
  }
  .frame.flash .bracket::before,
  .frame.flash .bracket::after {
    opacity: 1;
  }
  .tl {
    top: 0;
    left: 0;
  }
  .tr {
    top: 0;
    right: 0;
  }
  .bl {
    bottom: 0;
    left: 0;
  }
  .br {
    bottom: 0;
    right: 0;
  }
  .hint {
    position: absolute;
    bottom: var(--space-6);
    left: 0;
    right: 0;
    margin: 0;
    padding: 0 var(--space-5);
    text-align: center;
    color: var(--color-text-muted);
    font-size: 14px;
  }

  .panel {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--space-5);
  }
  .panel-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-3);
    background: var(--color-surface);
    border-radius: var(--radius-lg);
    padding: var(--space-5);
    max-width: 340px;
    width: 100%;
    text-align: center;
    color: var(--color-text-muted);
  }
  .panel-card p {
    margin: 0;
    font-size: 14px;
  }
  .panel-card .note {
    color: var(--color-text-disabled-strong);
  }
  .panel-card h3 {
    font-family: var(--font-body);
    font-weight: 600;
    font-size: 16px;
    letter-spacing: 0.02em;
    color: var(--color-text);
    margin: 0;
  }
  .pair {
    display: flex;
    gap: var(--space-2);
  }
  .actions {
    display: flex;
    gap: var(--space-3);
    width: 100%;
  }
  .actions > button {
    flex: 1;
  }
  .panel-card .cta {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
  }
  .panel-card .cta:disabled {
    cursor: default;
    filter: saturate(0.4);
  }
  .secondary {
    min-height: var(--touch-target);
    border: 1px solid var(--color-text-disabled-strong);
    background: transparent;
    color: var(--color-text);
    border-radius: var(--radius-pill);
    padding: 0 var(--space-4);
    font-size: 14px;
    font-weight: 600;
  }
  .secondary:disabled {
    color: var(--color-text-disabled);
    cursor: default;
  }
  .link {
    background: transparent;
    border: none;
    color: var(--color-text-muted);
    min-height: var(--touch-target);
    font-size: 14px;
    font-weight: 600;
    transition: color 120ms ease-out;
  }
  .link:hover {
    color: var(--color-text);
  }
  .spinner {
    width: 16px;
    height: 16px;
    border: 2px solid currentColor;
    border-right-color: transparent;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .bottom {
    padding: var(--space-3) var(--space-5) calc(var(--space-4) + env(safe-area-inset-bottom, 0px));
    display: flex;
    justify-content: center;
  }
  .fallback {
    background: transparent;
    border: 1px solid var(--color-text-disabled-strong);
    color: var(--color-text);
    border-radius: var(--radius-pill);
    min-height: var(--touch-target);
    padding: 0 var(--space-5);
    font-size: 14px;
    font-weight: 600;
  }

  .vh {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
  }

  @media (min-width: 720px) {
    .viewfinder {
      max-height: 640px;
    }
  }
</style>
