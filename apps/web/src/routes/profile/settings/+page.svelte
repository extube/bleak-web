<script lang="ts">
  /**
   * /profile/settings — profile sub-page (Concept §8.1.3, DESIGN §4.9.3).
   *
   * The settings block moved here from the bottom of /profile — a pure
   * logic move: the same handlers, stores and dialogs (locale
   * SegmentedControl, token-rotation row + its ConfirmDialog, and the
   * leave-room button + its ConfirmDialog + error display).
   *
   * Token rotation (§3.6 settings): confirm dialog (other-device lockout
   * copy) → generate the new secret → `rotateUserToken` (Bearer = current,
   * body = new raw) → replace `identity.token` + rewrite the matching
   * `bleak.tokenVault` entry in place — written ONLY after a 2xx. 401 → the
   * §2.8 global gate; 403 → inline server text, identity kept.
   *
   * Leave room clears identity AND the mutual code (`clearIdentity` does
   * both) → `/`.
   *
   * Sub-page chrome (DESIGN §4.9.3): the identity guard is the same shared
   * `requireIdentityOrRedirect` as every guarded route; there is NO tab
   * bar (the /chats/[address] scoped-style pattern) and a back control —
   * history back with a /profile fallback (§1.3).
   */
  import { get } from 'svelte/store';
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { ApiError } from '@bleak/api-client';
  import { identity, initIdentity, clearIdentity, saveIdentity } from '#lib/stores/identity';
  import { updateVaultEntryToken } from '#lib/stores/tokenVault';
  import { requireIdentityOrRedirect } from '#lib/nav/guard';
  import { api } from '#lib/api/client';
  import { generateTokenSecret } from '#lib/crypto/secrets';
  import { backTarget } from '#lib/chats/view';
  import { locale, translate } from '#lib/i18n/locale';
  import ConfirmDialog from '#lib/components/ConfirmDialog.svelte';
  import PixelIcon from '#lib/components/icons/PixelIcon.svelte';
  import LocaleControl from '#lib/components/join/LocaleControl.svelte';

  // Hard reload on a guarded route: hydrate identity defensively (idempotent).
  initIdentity();
  const guarded = requireIdentityOrRedirect();

  const me = $derived($identity);

  // --- error mapping (§2.1) ------------------------------------------------
  function serverText(err: unknown): string | null {
    if (!(err instanceof ApiError)) return err instanceof Error ? err.message : null;
    const marker = ': ';
    const idx = err.message.indexOf(marker);
    return idx >= 0 ? err.message.slice(idx + marker.length) : err.message;
  }

  // --- token rotation (v2, §3.6 settings) --------------------------------------
  let rotateOpen = $state(false);
  let pendingRotate = $state(false);
  let rotateError = $state<string | null>(null);
  let rotatedFlash = $state(false);
  let rotatedTimer: ReturnType<typeof setTimeout> | null = null;

  /**
   * Rotation: Bearer = the CURRENT persona token (auto-injected), body = the
   * new raw secret. `identity.token` + the matching vault entry are written
   * ONLY after a 2xx — a 401 abandons the attempt through the §2.8 gate with
   * no partial client writes (§8.4 caveat), a 403 shows inline server text
   * with the identity kept.
   */
  async function rotateToken(): Promise<void> {
    const id = me;
    if (!id || pendingRotate) return;
    pendingRotate = true;
    rotateError = null;
    try {
      const newRaw = generateTokenSecret();
      await api.rotateUserToken(id.roomAddress, id.userAddress, newRaw);
      saveIdentity({ roomAddress: id.roomAddress, userAddress: id.userAddress, token: newRaw });
      updateVaultEntryToken(id.roomAddress, id.userAddress, newRaw);
      rotatedFlash = true;
      if (rotatedTimer) clearTimeout(rotatedTimer);
      rotatedTimer = setTimeout(() => (rotatedFlash = false), 2000);
    } catch (cause) {
      rotateError = serverText(cause) ?? translate(get(locale), 'common.error');
    } finally {
      pendingRotate = false;
    }
  }

  // --- leave room -------------------------------------------------------------
  let leaveOpen = $state(false);
  let pendingLeave = $state(false);
  let leaveError = $state<string | null>(null);

  async function leaveRoom(): Promise<void> {
    const id = me;
    if (!id || pendingLeave) return;
    pendingLeave = true;
    leaveError = null;
    try {
      await api.deleteRoomUser(id.roomAddress, id.userAddress);
      // clearIdentity also clears the one-time mutual code (§10.4).
      clearIdentity();
      leaveOpen = false;
      void goto(resolve('/'));
    } catch (cause) {
      // Identity kept — the persona still exists in the room.
      leaveError = serverText(cause) ?? translate(get(locale), 'common.error');
    } finally {
      pendingLeave = false;
    }
  }

  // --- back control (§1.3): history back, fallback /profile --------------------
  function goBack(): void {
    if (backTarget(globalThis.history.length) === 'history') {
      globalThis.history.back();
    } else {
      void goto(resolve('/profile'));
    }
  }
</script>

<svelte:head>
  <!-- Route-neutral document title: the settings heading key (§4.9.3). -->
  <title>{translate($locale, 'profile.settings.title')}</title>
  <!-- Sub-page: NO tab bar (the scaffold layout renders it for every
       non-join route; scoped here, restored on unmount) — the same
       pattern as /chats/[address] (§3.5). -->
  <style>
    nav.tabbar {
      display: none !important;
    }
  </style>
</svelte:head>

{#if guarded}
  <main class="settings-page">
    <header class="top-bar">
      <button
        type="button"
        class="back"
        aria-label={translate($locale, 'common.back')}
        onclick={goBack}
      >
        <PixelIcon name="back" size={16} />
      </button>
      <h1>{translate($locale, 'profile.settings.title')}</h1>
    </header>

    <section class="settings pixel-corners" aria-label={translate($locale, 'profile.settings.title')}>
      <div class="setting">
        <span class="setting-label">{translate($locale, 'common.locale')}</span>
        <LocaleControl />
      </div>
      <button
        type="button"
        class="rotate"
        disabled={pendingRotate}
        onclick={() => (rotateOpen = true)}
      >
        <PixelIcon name="key" size={16} />
        <span>{translate($locale, 'profile.rotate.row')}</span>
        {#if pendingRotate}<span class="spinner" aria-hidden="true"></span>{/if}
      </button>
      {#if rotatedFlash && !rotateError}
        <p class="rotated-flash" aria-live="polite">
          ✓ {translate($locale, 'profile.rotate.done')}
        </p>
      {/if}
      {#if rotateError}
        <p class="field-error" role="alert" aria-live="polite">{rotateError}</p>
      {/if}
      <button type="button" class="leave" onclick={() => (leaveOpen = true)}>
        {translate($locale, 'profile.leave')}
      </button>
      {#if leaveError}
        <p class="field-error" role="alert" aria-live="polite">{leaveError}</p>
      {/if}
    </section>
  </main>

  <ConfirmDialog
    bind:open={rotateOpen}
    title={translate($locale, 'profile.rotate.title')}
    body={translate($locale, 'profile.rotate.body')}
    confirmLabel={translate($locale, 'profile.rotate.cta')}
    onconfirm={rotateToken}
  />

  <ConfirmDialog
    bind:open={leaveOpen}
    title={translate($locale, 'profile.leave')}
    body={translate($locale, 'profile.leave.confirm_body')}
    confirmLabel={translate($locale, 'profile.leave')}
    onconfirm={leaveRoom}
  />
{/if}

<style>
  .settings-page {
    flex: 1;
    width: 100%;
    max-width: 720px;
    margin: 0 auto;
    padding: var(--space-5) var(--space-4) var(--space-7);
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }
  .top-bar {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }
  .top-bar h1 {
    font-size: 32px;
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
  .settings {
    background: var(--color-surface);
    border-radius: var(--radius-lg);
    padding: var(--space-5);
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }
  .setting {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-4);
    flex-wrap: wrap;
  }
  .setting-label {
    font-size: 14px;
    color: var(--color-text-muted);
  }
  .rotate,
  .leave {
    align-self: flex-start;
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    min-height: var(--touch-target);
    padding: 0 var(--space-5);
    background: transparent;
    border: 1px solid var(--color-text-disabled-strong);
    color: var(--color-text);
    border-radius: var(--radius-pill);
    font-weight: 600;
    font-size: 14px;
    font-family: var(--font-body);
    transition:
      border-color 120ms ease-out,
      color 120ms ease-out;
  }
  .leave {
    /* Exit-room (Concept §8.1.3, DESIGN §4.9.3): outline danger style —
     * red font + red border ONLY on the transparent surface, no filled
     * red background. Roles per the architect consult: the BORDER takes
     * --color-danger (≥3:1 non-text on the surface), the FONT takes
     * --color-danger-text (≥4.5:1 AA on the surface) — values recorded
     * in tokens.css. */
    border-color: var(--color-danger);
    color: var(--color-danger-text);
  }
  .spinner {
    width: 14px;
    height: 14px;
    border: 2px solid var(--color-text-muted);
    border-right-color: transparent;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  .rotated-flash {
    margin: 0;
    font-size: 14px;
    color: var(--color-accent);
  }
  .field-error {
    margin: 0;
    color: var(--color-accent);
    font-size: 14px;
  }
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
  @media (min-width: 720px) {
    /* Settings card max-width 560px centered (§3.6 responsive). */
    .settings {
      max-width: 560px;
      width: 100%;
      align-self: center;
    }
  }
</style>
