<script lang="ts">
  /**
   * /profile/settings — "Settings" screen (DESIGN §4.29.B — v3.23 profile
   * redesign; Concept §42.3). App-level settings ONLY, restyled to the
   * reference's second screen: grouped list blocks with icon/chevron rows.
   *
   * Persona editing LEAVES this page: the one profile entry row navigates
   * to /profile/edit (§4.29.B.3.1, G.3 — §4.11.4 item 4 superseded). The
   * old internal `view = rows|persona|greeting|contact` state machine and
   * the three editor rows are GONE (the editors re-host on /profile/edit;
   * the «Saved» flash moves with them). §23.2 5.6 stands: no interests
   * editor anywhere. FAQ/Terms/policy rows: still none invented (§4.29.B.2
   * carried); the NO-toggle-rows clause is SUPERSEDED by Concept §49
   * (DESIGN §4.35.D) — the auto-handshake row is the app's first real
   * toggle-backed setting.
   *
   * Rows (the real rows only, §4.29.B.3 + §4.35.C):
   *   Block 1 — the profile entry row → /profile/edit (real link; the
   *             accessible name is `profile.edit.title`).
   *   Block 2 — the auto-handshake toggle row (FIRST — a real
   *             `<input type="checkbox" role="switch">`; optimistic PUT
   *             { active } with revert-on-error), the Language row (the
   *             RU|EN LocaleControl INLINE as the trailing control — no
   *             language sub-page, I-rec 8) and the token-rotation row
   *             (key glyph + chevron → ConfirmDialog; pending → the
   *             spinner replaces the chevron; flash/error lines under
   *             the row).
   *   Leave room — the STANDALONE full-width bottom outline-red button
   *             (§7.1.6/§4.9.3 roles verbatim: border --color-danger, font
   *             --color-danger-text, TRANSPARENT background) + its
   *             ConfirmDialog.
   *
   * Token rotation (§8.1.3 — UNTOUCHED): confirm dialog (other-device
   * lockout copy) → generate the new secret → `rotateUserToken` (Bearer =
   * current, body = new raw) → replace `identity.token` + rewrite the
   * matching `bleak.tokenVault` entry in place — written ONLY after a 2xx.
   * 401 → the §2.8 global gate; 403 → inline server text, identity kept.
   *
   * Leave room is PURELY LOCAL (Concept §11.1.1, DESIGN §4.12.1): no server
   * delete — `clearIdentity` clears the identity + the one-time mutual
   * code; `bleak.tokenVault` keeps the entry, so return-to-event (§10.1.1)
   * always works. → `/income` (tz12-02 re-homing).
   *
   * Sub-page chrome (§4.29.B.1, carried): NO tab bar (the
   * /chats/[address] scoped-style pattern), back control top-left (history
   * back with a /profile fallback, §1.3), the h1 CENTERED (grid
   * [48px 1fr 48px]).
   */
  import { get } from 'svelte/store';
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { ApiError, NetworkError, type User } from '@bleak/api-client';
  import { identity, initIdentity, clearIdentity, saveIdentity } from '#lib/stores/identity';
  import { updateVaultEntryToken } from '#lib/stores/tokenVault';
  import { requireIdentityOrRedirect } from '#lib/nav/guard';
  import { api } from '#lib/api/client';
  import { generateTokenSecret } from '#lib/crypto/secrets';
  import { backTarget } from '#lib/chats/view';
  import { locale, translate } from '#lib/i18n/locale';
  import ConfirmDialog from '#lib/components/ConfirmDialog.svelte';
  import PixelIcon from '#lib/components/icons/PixelIcon.svelte';
  import PixelAvatar from '#lib/components/PixelAvatar.svelte';
  import LocaleControl from '#lib/components/join/LocaleControl.svelte';
  import ErrorBanner from '#lib/components/ErrorBanner.svelte';
  import SkeletonBlock from '#lib/components/SkeletonBlock.svelte';

  // Hard reload on a guarded route: hydrate identity defensively (idempotent).
  initIdentity();
  const guarded = requireIdentityOrRedirect();

  const me = $derived($identity);

  // --- persona record (mount fetch only — NO poller on sub-pages, §2.2) -----
  let user = $state<User | null>(null);
  let loadError = $state<{ kind: 'network' | 'api'; text: string | null } | null>(null);

  // --- error mapping (§2.1) ------------------------------------------------
  function serverText(err: unknown): string | null {
    if (!(err instanceof ApiError)) return err instanceof Error ? err.message : null;
    const marker = ': ';
    const idx = err.message.indexOf(marker);
    return idx >= 0 ? err.message.slice(idx + marker.length) : err.message;
  }

  function bannerOf(err: unknown): { kind: 'network' | 'api'; text: string | null } {
    return err instanceof NetworkError
      ? { kind: 'network', text: null }
      : { kind: 'api', text: serverText(err) };
  }

  /** The entry row (avatar + name + address) prefills from the persona
   * record — one mount-time fetch (no poller on this sub-page; §2.2). */
  async function loadUser(): Promise<void> {
    const id = get(identity);
    if (!id) return;
    try {
      user = await api.getRoomUser(id.roomAddress, id.userAddress);
      // §4.35.C: the toggle's mount state is seeded from the SAME fetch —
      // no extra call, no poller, no fake default while it loads.
      activeFlag = user.active;
      loadError = null;
    } catch (cause) {
      loadError = bannerOf(cause);
    }
  }

  $effect(() => {
    if (!guarded) return;
    void loadUser();
  });

  // --- auto-handshake toggle (§4.35.C, Concept §49 / backend feature #36) -----
  // `activeFlag === null` while the persona record loads (disabled, no fake
  // default). Optimistic update + revert-on-error; the PUT body carries ONLY
  // `active` (name/bios omitted — omitted fields keep their value). 401 goes
  // through the §2.8 global gate (personaGate) — never handled locally. On
  // success the state STANDS (the switch is its own feedback — no «Saved»
  // flash for this row).
  let activeFlag = $state<boolean | null>(null);
  let pendingActive = $state(false);
  let activeError = $state<string | null>(null);

  async function toggleAutoHandshake(): Promise<void> {
    const id = me;
    const current = activeFlag;
    if (!id || current === null || pendingActive) return;
    const next = !current;
    activeFlag = next; // optimistic — revert to server truth on failure
    pendingActive = true;
    activeError = null;
    try {
      await api.updateRoomUser(id.roomAddress, id.userAddress, { active: next });
    } catch (cause) {
      activeFlag = current;
      // 401 → the §2.8 global gate already navigated; no local error line.
      if (cause instanceof ApiError && cause.status === 401) return;
      activeError =
        cause instanceof NetworkError
          ? translate(get(locale), 'common.error.network')
          : serverText(cause) ?? translate(get(locale), 'common.error.network');
    } finally {
      pendingActive = false;
    }
  }

  // --- token rotation (§8.1.3 — untouched) ------------------------------------
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

  /**
   * Leave is PURELY LOCAL (Concept §11.1.1, DESIGN §4.12.1): the attendee
   * exit NEVER deletes the persona on the server — no hard or soft delete.
   * `clearIdentity` clears the active identity + the one-time mutual code
   * (§10.4); the persona token stays in `bleak.tokenVault` (clearIdentity
   * never touches the vault), so return-to-event (§10.1.1) always works.
   * The backend DELETE persona endpoint stays for explicit deletion
   * elsewhere (host drill-down).
   */
  function leaveRoom(): void {
    if (!me) return;
    clearIdentity();
    leaveOpen = false;
    // tz12-02 re-homing: the return-to-event entry (the vault) lives on
    // the join entry page now.
    void goto(resolve('/income'));
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
  <!-- Route-neutral document title: the settings heading key (§4.29.B.1). -->
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
    <!-- §4.29.B.1: back control top-left, the CENTERED h1 in the middle
         grid column (48px 1fr 48px), a spacer keeps the title centered. -->
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
      <span class="spacer" aria-hidden="true"></span>
    </header>

    {#if loadError}
      <ErrorBanner kind={loadError.kind} message={loadError.text} onretry={loadUser} />
    {/if}

    {#if user}
      <!-- §4.29.B.3.1: Block 1 — the ONE profile entry row → /profile/edit
           (a real link; the accessible name is profile.edit.title). It
           REPLACES the three persona-edit rows (G.3). -->
      <a
        class="block entry"
        href={resolve('/profile/edit')}
        aria-label={translate($locale, 'profile.edit.title')}
      >
        <PixelAvatar address={user.address} size={40} own label="" />
        <span class="entry-texts">
          <span class="entry-name">{user.name}</span>
          <span class="entry-address">{user.address}</span>
        </span>
        <PixelIcon name="arrow-right" size={16} />
      </a>
    {:else if !loadError}
      <!-- The entry row while the persona record loads. -->
      <div class="block entry" aria-hidden="true">
        <SkeletonBlock width="40px" height="40px" />
        <SkeletonBlock width="60%" height="24px" />
      </div>
    {/if}

    <!-- §4.29.B.3.2 amended (DESIGN §4.35.C): Block 2 — the auto-handshake
         toggle (FIRST row; the rotation row stays LAST so its flash/error
         lines remain directly under it), the INLINE language control, and
         the token-rotation row. -->
    <section class="block" aria-label={translate($locale, 'profile.settings.title')}>
      <div class="row toggle-row">
        <PixelIcon name="status-active" size={16} />
        <label class="row-label" for="auto-handshake-switch">
          {translate($locale, 'profile.auto_handshake.row')}
        </label>
        <input
          id="auto-handshake-switch"
          type="checkbox"
          role="switch"
          class="switch"
          checked={activeFlag === true}
          aria-checked={activeFlag === true}
          disabled={activeFlag === null || pendingActive}
          onchange={toggleAutoHandshake}
        />
      </div>
      {#if activeError}
        <p class="field-error" role="alert" aria-live="polite">{activeError}</p>
      {/if}
      <div class="row">
        <span class="row-label">{translate($locale, 'common.locale')}</span>
        <LocaleControl />
      </div>
      <button
        type="button"
        class="row rotate-row"
        disabled={pendingRotate}
        onclick={() => (rotateOpen = true)}
      >
        <PixelIcon name="key" size={16} />
        <span class="row-label">{translate($locale, 'profile.rotate.row')}</span>
        {#if pendingRotate}
          <span class="spinner" aria-hidden="true"></span>
        {:else}
          <PixelIcon name="arrow-right" size={16} />
        {/if}
      </button>
      {#if rotatedFlash && !rotateError}
        <p class="rotated-flash" aria-live="polite">
          ✓ {translate($locale, 'profile.rotate.done')}
        </p>
      {/if}
      {#if rotateError}
        <p class="field-error" role="alert" aria-live="polite">{rotateError}</p>
      {/if}
    </section>

    <!-- §4.29.B.3.3: the STANDALONE full-width bottom outline-red button
         (never a filled red block; §7.1.6/§4.9.3 roles verbatim). -->
    <button type="button" class="leave" onclick={() => (leaveOpen = true)}>
      {translate($locale, 'profile.leave')}
    </button>
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
  /* §4.29.B.1: the centered title — grid [48px 1fr 48px]; the back control
   * and the spacer occupy the side columns. */
  .top-bar {
    display: grid;
    grid-template-columns: var(--touch-target) 1fr var(--touch-target);
    align-items: center;
    gap: var(--space-2);
  }
  .top-bar h1 {
    font-size: 32px;
    text-align: center;
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
  .spacer {
    width: var(--touch-target);
  }
  /* §4.29.B.2: the list-block pattern — grouped surface cards of
   * full-width rows. */
  .block {
    display: flex;
    flex-direction: column;
    background: var(--color-surface);
    border-radius: var(--radius-lg);
    padding: var(--space-4) var(--space-5);
  }
  .row {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    min-height: var(--touch-target);
    width: 100%;
    background: transparent;
    border: none;
    color: var(--color-text);
    text-align: left;
    font-family: var(--font-body);
  }
  /* The 1px divider between rows WITHIN a block. */
  .row + .row {
    border-top: 1px solid var(--color-surface-elevated);
  }
  .row-label {
    font-size: 15px;
    font-weight: 600;
    color: var(--color-text);
  }
  /* Navigational/actionable rows: the trailing chevron rides to the right. */
  .row :global(svg:last-child),
  .entry :global(svg:last-child) {
    margin-left: auto;
    color: var(--color-text-muted);
  }
  .rotate-row {
    cursor: pointer;
    transition: opacity 120ms ease-out;
  }
  .rotate-row:disabled {
    cursor: default;
    opacity: 0.6;
  }
  /* §4.35.C: the auto-handshake toggle row — leading muted glyph, the row
   * label LEFT, the switch as the trailing control. */
  .toggle-row :global(svg:first-child) {
    color: var(--color-text-muted);
    flex-shrink: 0;
  }
  /* The switch: a REAL native checkbox with role="switch" (never a
   * div-toggle, §2.6), visually drawn as a ~40×24px pill track centered in
   * the 48px (--touch-target) hit area. Tokens only — ON: accent track +
   * accent-ink knob; OFF: transparent track + 1px disabled-strong border +
   * muted knob. Smooth pill (never .pixel-corners, §4.5). */
  .switch {
    appearance: none;
    -webkit-appearance: none;
    margin: 0 0 0 auto;
    width: var(--touch-target);
    height: var(--touch-target);
    flex-shrink: 0;
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    cursor: pointer;
  }
  .switch::before {
    content: '';
    width: 40px;
    height: 24px;
    border-radius: var(--radius-pill);
    border: 1px solid var(--color-text-disabled-strong);
    background: transparent;
    transition:
      background-color 120ms ease-out,
      border-color 120ms ease-out;
  }
  .switch::after {
    content: '';
    position: absolute;
    top: 50%;
    left: 8px;
    width: 16px;
    height: 16px;
    border-radius: var(--radius-pill);
    background: var(--color-text-muted);
    transform: translateY(-50%);
    transition:
      transform 120ms ease-out,
      background-color 120ms ease-out;
  }
  .switch:checked::before {
    background: var(--color-accent);
    border-color: var(--color-accent);
  }
  .switch:checked::after {
    transform: translateY(-50%) translateX(16px);
    background: var(--color-accent-ink);
  }
  /* The accent :focus-visible outline is never removed (§2.6). */
  .switch:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: 2px;
    border-radius: var(--radius-pill);
  }
  .switch:disabled {
    cursor: default;
    opacity: 0.6;
  }
  /* §2.5/§4.6: the 120 ms morph is INSTANT under reduced motion. */
  @media (prefers-reduced-motion: reduce) {
    .switch::before,
    .switch::after {
      transition: none;
    }
  }
  /* §4.29.B.3.1: the entry row — mini square avatar + name + muted
   * address (single-line ellipsis) + chevron; a real link. */
  .entry {
    flex-direction: row;
    align-items: center;
    gap: var(--space-3);
  }
  .entry-texts {
    display: flex;
    flex-direction: column;
    min-width: 0;
    flex: 1;
  }
  .entry-name {
    font-size: 15px;
    font-weight: 600;
    color: var(--color-text);
  }
  .entry-address {
    font-size: 13px;
    color: var(--color-text-muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .entry :global(svg:last-child) {
    flex-shrink: 0;
  }
  .rotated-flash {
    margin: var(--space-2) 0 0;
    font-size: 14px;
    color: var(--color-accent);
  }
  .field-error {
    margin: var(--space-2) 0 0;
    color: var(--color-accent);
    font-size: 14px;
  }
  .spinner {
    width: 14px;
    height: 14px;
    border: 2px solid var(--color-text-muted);
    border-right-color: transparent;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
  /* §4.29.B.3.3: the standalone bottom outline-red leave button —
   * transparent background, border --color-danger, font
   * --color-danger-text (never filled; Concept §8.1.3, DESIGN §4.9.3). */
  .leave {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: var(--touch-target);
    padding: 0 var(--space-5);
    background: transparent;
    border: 1px solid var(--color-danger);
    border-radius: var(--radius-pill);
    color: var(--color-danger-text);
    font-weight: 600;
    font-size: 14px;
    font-family: var(--font-body);
    transition: opacity 120ms ease-out;
  }
  @media (min-width: 720px) {
    /* Blocks max-width 560px centered (§4.29.B.6, carried §4.9.3). */
    .block,
    .leave {
      max-width: 560px;
      width: 100%;
      align-self: center;
    }
  }
  /* §4.12.1 item 5 carried (§4.29.G.6): at phone widths the blocks become
   * the page — full-bleed, no rounded floating chrome; the header and the
   * leave button keep their own gutters. */
  @media (max-width: 719px) {
    .settings-page {
      padding: 0 0 var(--space-7);
    }
    .top-bar {
      padding: var(--space-5) var(--space-5) 0;
    }
    .block {
      border-radius: 0;
      clip-path: none;
    }
    .leave {
      margin: var(--space-3) var(--space-5) 0;
    }
  }
</style>
