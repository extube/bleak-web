<script lang="ts">
  /**
   * /profile/settings — profile sub-page (Concept §8.1.3, DESIGN §4.9.3).
   *
   * The settings block moved here from the bottom of /profile — a pure
   * logic move: the same handlers, stores and dialogs (locale
   * SegmentedControl, token-rotation row + its ConfirmDialog, and the
   * leave-room button + its ConfirmDialog + error display).
   *
   * Concept §10.1.4 / DESIGN §4.11.4: ALL persona editing lives here — the
   * PersonaEditor (name/public/private bio), the GreetingEditor and the
   * PersonaEditor (name/public/private bio), the GreetingEditor and the
   * interests picker (InterestsEditor, DESIGN §4.13.1: real upsert/delete
   * endpoints + the local mirror) moved wholesale from /profile — the same
   * inline-swap pattern (one editor at a time), returning to the settings
   * rows after save/cancel.
   *
   * Token rotation (§3.6 settings): confirm dialog (other-device lockout
   * copy) → generate the new secret → `rotateUserToken` (Bearer = current,
   * body = new raw) → replace `identity.token` + rewrite the matching
   * `bleak.tokenVault` entry in place — written ONLY after a 2xx. 401 → the
   * §2.8 global gate; 403 → inline server text, identity kept.
   *
   * Leave room is PURELY LOCAL (Concept §11.1.1, DESIGN §4.12.1): no server
   * delete — `clearIdentity` clears the identity + the one-time mutual code;
   * `bleak.tokenVault` keeps the entry, so return-to-event (§10.1.1) always
   * works. → `/`.
   *
   * Sub-page chrome (DESIGN §4.9.3): the identity guard is the same shared
   * `requireIdentityOrRedirect` as every guarded route; there is NO tab
   * bar (the /chats/[address] scoped-style pattern) and a back control —
   * history back with a /profile fallback (§1.3).
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
  import type { PersonaDraft } from '#lib/join';
  import { locale, translate } from '#lib/i18n/locale';
  import ConfirmDialog from '#lib/components/ConfirmDialog.svelte';
  import PixelIcon from '#lib/components/icons/PixelIcon.svelte';
  import LocaleControl from '#lib/components/join/LocaleControl.svelte';
  import PersonaEditor from '#lib/components/profile/PersonaEditor.svelte';
  import GreetingEditor from '#lib/components/profile/GreetingEditor.svelte';
  import InterestsEditor from '#lib/components/profile/InterestsEditor.svelte';
  import ErrorBanner from '#lib/components/ErrorBanner.svelte';

  // Hard reload on a guarded route: hydrate identity defensively (idempotent).
  initIdentity();
  const guarded = requireIdentityOrRedirect();

  const me = $derived($identity);

  // --- persona editing (moved from /profile, Concept §10.1.4) ------------------
  type View = 'rows' | 'persona' | 'greeting' | 'interests';

  let view = $state<View>('rows');
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

  /** The persona editors prefill from the persona record (§3.6) — one
   *  mount-time fetch (no poller on this sub-page; §2.2 cadence table). */
  async function loadUser(): Promise<void> {
    const id = get(identity);
    if (!id) return;
    try {
      user = await api.getRoomUser(id.roomAddress, id.userAddress);
      loadError = null;
    } catch (cause) {
      loadError = bannerOf(cause);
    }
  }

  $effect(() => {
    if (!guarded) return;
    void loadUser();
  });

  // --- transient inline success (no toast system in v1) ---------------------
  let savedFlash = $state(false);
  let flashTimer: ReturnType<typeof setTimeout> | null = null;

  function flashSaved(): void {
    savedFlash = true;
    if (flashTimer) clearTimeout(flashTimer);
    flashTimer = setTimeout(() => (savedFlash = false), 2000);
  }

  // --- persona editor --------------------------------------------------------
  let personaError = $state<{ kind: 'network' | 'api'; text: string | null } | null>(null);
  let pendingPersona = $state(false);

  function openPersona(): void {
    view = 'persona';
    personaError = null;
  }

  async function savePersona(draft: PersonaDraft): Promise<void> {
    const id = me;
    if (!id || pendingPersona) return; // double-submit prevented
    pendingPersona = true;
    personaError = null;
    try {
      // Omitted-field semantics: send ALL THREE fields (DESIGN §3.6).
      const updated = await api.updateRoomUser(id.roomAddress, id.userAddress, {
        name: draft.name,
        public_bio: draft.publicBio,
        private_bio: draft.privateBio
      });
      user = updated;
      view = 'rows';
      flashSaved();
    } catch (cause) {
      personaError = bannerOf(cause);
    } finally {
      pendingPersona = false;
    }
  }

  // --- greeting editor --------------------------------------------------------
  let greetingText = $state('');
  let greetingLoading = $state(false);
  let greetingError = $state<{
    kind: 'network' | 'api' | 'no_questions';
    text: string | null;
  } | null>(null);
  let pendingGreeting = $state(false);
  let pendingRegenerate = $state(false);

  async function openGreeting(): Promise<void> {
    const id = me;
    if (!id) return;
    view = 'greeting';
    greetingError = null;
    // Fallback display while the canonical greeting loads.
    greetingText = user?.greeting ?? '';
    greetingLoading = true;
    try {
      const greeting = await api.getUserGreeting(id.roomAddress, id.userAddress);
      greetingText = greeting.greeting;
    } catch (cause) {
      greetingError = bannerOf(cause);
    } finally {
      greetingLoading = false;
    }
  }

  async function saveGreeting(next: string): Promise<void> {
    const id = me;
    if (!id || pendingGreeting) return;
    pendingGreeting = true;
    greetingError = null;
    try {
      const greeting = await api.putUserGreeting(id.roomAddress, id.userAddress, next);
      greetingText = greeting.greeting;
      if (user) user = { ...user, greeting: greeting.greeting };
      view = 'rows';
      flashSaved();
    } catch (cause) {
      // Server 400 (question-free rule slipping through) → the same copy.
      greetingError =
        cause instanceof ApiError && cause.status === 400
          ? { kind: 'no_questions', text: null }
          : bannerOf(cause);
    } finally {
      pendingGreeting = false;
    }
  }

  async function regenerate(): Promise<void> {
    const id = me;
    if (!id || pendingRegenerate) return;
    pendingRegenerate = true;
    greetingError = null;
    try {
      const greeting = await api.regenerateGreeting(id.roomAddress, id.userAddress);
      // Fills the editor only — NOT saved until Save is pressed (§3.6).
      greetingText = greeting.greeting;
    } catch (cause) {
      greetingError = bannerOf(cause);
    } finally {
      pendingRegenerate = false;
    }
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
    void goto(resolve('/'));
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

    {#if savedFlash && view === 'rows'}
      <p class="saved-flash" aria-live="polite">✓ {translate($locale, 'profile.saved')}</p>
    {/if}

    {#if view === 'rows'}
      <!-- Persona editing section (Concept §10.1.4, DESIGN §4.11.4): the
           editors moved here wholesale from /profile — one editor at a
           time via the inline-swap pattern; the rows return after
           save/cancel. -->
      <section class="persona pixel-corners" aria-label={translate($locale, 'profile.settings.persona')}>
        <h2 class="section-title">{translate($locale, 'profile.settings.persona')}</h2>
        <button type="button" class="row" onclick={openPersona}>
          {translate($locale, 'profile.persona.edit')}
        </button>
        <button type="button" class="row" onclick={openGreeting}>
          {translate($locale, 'profile.greeting.edit')}
        </button>
        <button type="button" class="row" onclick={() => (view = 'interests')}>
          {translate($locale, 'profile.interests.edit')}
        </button>
      </section>

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
      </section>
    {:else if view === 'persona'}
      {#if user}
        <PersonaEditor
          {user}
          pending={pendingPersona}
          error={personaError}
          onsave={savePersona}
          oncancel={() => (view = 'rows')}
        />
      {:else if loadError}
        <ErrorBanner kind={loadError.kind} message={loadError.text} onretry={loadUser} />
      {/if}
    {:else if view === 'greeting'}
      {#key greetingText}
        <GreetingEditor
          greeting={greetingText}
          loading={greetingLoading}
          pending={pendingGreeting}
          regeneratePending={pendingRegenerate}
          error={greetingError}
          onsave={saveGreeting}
          onregenerate={regenerate}
          oncancel={() => (view = 'rows')}
        />
      {/key}
    {:else if view === 'interests'}
      <InterestsEditor ondone={() => (view = 'rows')} />
    {/if}
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
  .settings,
  .persona {
    background: var(--color-surface);
    border-radius: var(--radius-lg);
    padding: var(--space-5);
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }
  .section-title {
    margin: 0;
    font-size: 20px;
  }
  .row {
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
  .saved-flash {
    margin: 0;
    font-size: 14px;
    color: var(--color-accent);
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
    .settings,
    .persona {
      max-width: 560px;
      width: 100%;
      align-self: center;
    }
  }
</style>
