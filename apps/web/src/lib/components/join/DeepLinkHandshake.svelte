<script lang="ts">
  /**
   * DeepLinkHandshake (DESIGN §3.1 AC 19 / §3.8, TZ2-06 Part B): the
   * `/?u={userAddress}&m={mutualCode}` / `/?u={userAddress}` deep-link
   * panel on `/` — runs the SAME pure routine as the scanner
   * (lib/scanner/mutual.ts) WITHOUT the camera, full routine including the
   * confirm card. Result states reused verbatim: success («Агенты уже
   * общаются» + chat link), single-direction «sent», the §2.9 stale-code
   * (410, no Retry) and income-rule (403) states, network/api retry, own-QR
   * info, foreign-persona error.
   *
   * A11y: focus-trapped `role="dialog"` (ConfirmDialog semantics), Escape
   * closes, state changes announce via `aria-live="polite"`.
   */
  import { resolve } from '$app/paths';
  import { tick } from 'svelte';
  import type { User } from '@bleak/api-client';
  import { api } from '#lib/api/client';
  import { identity } from '#lib/stores/identity';
  import {
    classifyPersonaScan,
    sendMutualHandshake,
    sendSingleDirectionHandshake,
    type PersonaEnv,
    type ScanOutcome
  } from '#lib/scanner/mutual';
  import { locale, translate } from '#lib/i18n/locale';
  import PixelAvatar from '#lib/components/PixelAvatar.svelte';

  interface Props {
    open?: boolean;
    /** The scanned/deep-linked user address (the `u` parameter). */
    userAddress: string;
    /** The one-time mutual code (`m`); null = single-direction variant. */
    mutualCode: string | null;
    /** Current room member list (foreign-persona check, §3.8 step 2). */
    members: readonly User[];
    onClosed?: () => void;
  }

  let { open = false, userAddress, mutualCode, members, onClosed }: Props = $props();

  type PanelState =
    | { kind: 'confirm'; name: string }
    | { kind: 'own' }
    | { kind: 'foreign' }
    | { kind: 'success'; chatAddress: string | null }
    | { kind: 'sent' }
    | { kind: 'stale' }
    | { kind: 'income'; message: string | null }
    | { kind: 'error-network' }
    | { kind: 'error-api'; message: string };

  let panel = $state<PanelState | null>(null);
  let trading = $state(false);
  let cardEl: HTMLElement | null = $state(null);

  const me = $derived($identity);
  const confirmTitle = $derived(translate($locale, 'scan.confirm.title'));
  const confirmCta = $derived(translate($locale, 'scan.confirm.cta'));
  const cancelLabel = $derived(translate($locale, 'scan.confirm.cancel'));
  const retryLabel = $derived(translate($locale, 'common.retry'));
  const dialogLabel = $derived(translate($locale, 'hs.open_dialog'));
  const findPeople = $derived(translate($locale, 'chats.find_people'));

  const announcement = $derived.by(() => {
    if (!panel) return '';
    switch (panel.kind) {
      case 'confirm':
        return confirmTitle;
      case 'own':
        return translate($locale, 'scan.own_qr');
      case 'foreign':
        return translate($locale, 'scan.foreign_persona');
      case 'success':
        return translate($locale, 'hs.agents_talking');
      case 'sent':
        return translate($locale, 'hs.sent');
      case 'stale':
        return translate($locale, 'scan.code_used');
      case 'income':
        return translate($locale, 'hs.income_limit');
      case 'error-network':
        return translate($locale, 'scan.error.network');
      case 'error-api':
        return `${translate($locale, 'common.error.api')}: ${panel.message}`;
    }
  });

  $effect(() => {
    if (!open) return;
    let alive = true;
    panel = null;
    trading = false;
    void tick().then(() => cardEl?.focus());
    (async () => {
      const mine = me;
      const env: PersonaEnv | null = mine
        ? { myAddress: mine.userAddress, memberList: members, mutualCode, api }
        : null;
      if (!env) {
        if (alive) panel = { kind: 'foreign' };
        return;
      }
      // Prechecks are client-side UX only (no request).
      const precheck = classifyPersonaScan(userAddress, env);
      if (precheck.kind === 'own') {
        if (alive) panel = { kind: 'own' };
        return;
      }
      if (precheck.kind === 'foreign') {
        if (alive) panel = { kind: 'foreign' };
        return;
      }
      if (alive) panel = { kind: 'confirm', name: memberName(userAddress) };
    })();
    return () => {
      alive = false;
    };
  });

  function memberName(address: string): string {
    const match = members.find((member) => member.address === address);
    return match && !match.deleted_at ? match.name : address;
  }

  function applyOutcome(outcome: ScanOutcome): void {
    switch (outcome.kind) {
      case 'success':
        panel = { kind: 'success', chatAddress: outcome.chatAddress };
        break;
      case 'sent':
        panel = { kind: 'sent' };
        break;
      case 'error-stale':
        panel = { kind: 'stale' };
        break;
      case 'error-income':
        panel = { kind: 'income', message: outcome.message };
        break;
      case 'error-auth':
        // 401 → the §2.8 global gate already cleared the identity and
        // queued the redirect to `/`; yield without a stale error UI.
        close();
        break;
      case 'error-network':
        panel = { kind: 'error-network' };
        break;
      case 'error-api':
        panel = { kind: 'error-api', message: outcome.message };
        break;
      default:
        break;
    }
  }

  async function confirm(): Promise<void> {
    const mine = me;
    if (!mine || trading) return;
    trading = true;
    try {
      const env: PersonaEnv = {
        myAddress: mine.userAddress,
        memberList: members,
        mutualCode,
        api
      };
      const outcome =
        mutualCode === null
          ? await sendSingleDirectionHandshake(userAddress, env)
          : await sendMutualHandshake(userAddress, env);
      applyOutcome(outcome);
    } finally {
      trading = false;
    }
  }

  function close(): void {
    onClosed?.();
  }

  function cardKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
      return;
    }
    if (event.key !== 'Tab' || !cardEl) return;
    const focusables = Array.from(
      cardEl.querySelectorAll<HTMLElement>('button, a[href]')
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
</script>

<svelte:window onkeydown={(event) => (open ? cardKeydown(event) : undefined)} />

{#if open}
  <div
    class="scrim"
    role="dialog"
    aria-modal="true"
    aria-label={confirmTitle}
    tabindex="-1"
    bind:this={cardEl}
  >
    <div class="card pixel-corners">
      {#if panel?.kind === 'confirm'}
        <PixelAvatar address={userAddress} size={56} />
        <h2>{panel.name}</h2>
        <p>{confirmTitle}</p>
        <div class="actions">
          <button type="button" class="secondary" disabled={trading} onclick={close}>
            {cancelLabel}
          </button>
          <button type="button" class="cta" disabled={trading} onclick={() => void confirm()}>
            {#if trading}<span class="spinner" aria-hidden="true"></span>{/if}
            {confirmCta}
          </button>
        </div>
      {:else if panel?.kind === 'own'}
        <PixelAvatar address={me?.userAddress ?? ''} size={56} own />
        <p>{translate($locale, 'scan.own_qr')}</p>
        <button type="button" class="secondary" onclick={close}>
          {translate($locale, 'common.close')}
        </button>
      {:else if panel?.kind === 'foreign'}
        <PixelAvatar address={userAddress} size={56} />
        <p>{translate($locale, 'scan.foreign_persona')}</p>
        <button type="button" class="secondary" onclick={close}>
          {translate($locale, 'common.close')}
        </button>
      {:else if panel?.kind === 'success'}
        <div class="pair" aria-hidden="true">
          <PixelAvatar address={me?.userAddress ?? ''} size={44} own />
          <PixelAvatar address={userAddress} size={44} />
        </div>
        <p>{translate($locale, 'hs.agents_talking')}</p>
        <a
          class="cta"
          href={panel.chatAddress
            ? resolve('/chats/[address]', { address: panel.chatAddress })
            : resolve('/chats')}
          onclick={close}
        >
          {dialogLabel}
        </a>
      {:else if panel?.kind === 'sent'}
        <PixelAvatar address={userAddress} size={56} />
        <p>{translate($locale, 'hs.sent')}</p>
        <a class="cta" href={resolve('/people')} onclick={close}>{findPeople}</a>
      {:else if panel?.kind === 'stale'}
        <!-- 410: the one-time code is dead — NO Retry for the same code. -->
        <PixelAvatar address={userAddress} size={56} />
        <p>{translate($locale, 'scan.code_used')}</p>
        <button type="button" class="secondary" onclick={close}>
          {translate($locale, 'common.close')}
        </button>
      {:else if panel?.kind === 'income'}
        <!-- 403 income rule (§2.9): the code was NOT consumed. -->
        <PixelAvatar address={userAddress} size={56} />
        <p>{translate($locale, 'hs.income_limit')}</p>
        {#if panel.message}
          <p class="note">{panel.message}</p>
        {/if}
        <button type="button" class="secondary" onclick={close}>
          {translate($locale, 'common.close')}
        </button>
      {:else if panel?.kind === 'error-network' || panel?.kind === 'error-api'}
        <PixelAvatar address={userAddress} size={56} />
        {#if panel.kind === 'error-network'}
          <p>{translate($locale, 'scan.error.network')}</p>
        {:else}
          <p>{panel.message}</p>
        {/if}
        <!-- Retry re-sends `u` + `m` safely (a failed attempt never burned
             the one-time code). -->
        <button type="button" class="cta" disabled={trading} onclick={() => void confirm()}>
          {#if trading}<span class="spinner" aria-hidden="true"></span>{/if}
          {retryLabel}
        </button>
      {/if}
    </div>
    <p class="vh" aria-live="polite">{announcement}</p>
  </div>
{/if}

<style>
  .scrim {
    position: fixed;
    inset: 0;
    background: var(--color-scrim);
    z-index: 40;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--space-5);
  }
  .card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-3);
    background: var(--color-surface);
    padding: var(--space-5);
    max-width: 340px;
    width: 100%;
    text-align: center;
    color: var(--color-text-muted);
    outline: none;
  }
  .card p {
    margin: 0;
    font-size: 14px;
  }
  .card h2 {
    font-family: var(--font-body);
    font-weight: 600;
    font-size: 16px;
    letter-spacing: 0.02em;
    color: var(--color-text);
    margin: 0;
  }
  .card .note {
    color: var(--color-text-disabled-strong);
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
  .cta {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    min-height: var(--touch-target);
    border-radius: var(--radius-pill);
    font-weight: 600;
    font-size: 16px;
    text-align: center;
    background: var(--color-accent);
    color: var(--color-accent-ink);
    text-decoration: none;
  }
  .cta:disabled {
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
  .vh {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
  }
</style>
