<script lang="ts">
  /**
   * /profile — Persona badge (DESIGN §3.6, TZ-08).
   *
   * Fetch on mount + after mutations, NO Poller (§2.2 — /profile is not in
   * the cadence table): getRoomUser + listHandshakesOfUser + listChatsOfUser
   * compute the badge data and the stat tiles. Editors swap the badge card
   * inline (one screen at a time); the canonical greeting for the editor
   * comes from getUserGreeting (regenerate fills the editor, Save persists).
   * Interests are the client-side mock (architecture §8.1 — no network).
   * Leave room → ConfirmDialog → deleteRoomUser → clearIdentity → `/`.
   */
  import { get } from 'svelte/store';
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { ApiError, NetworkError, type Handshake, type User } from '@bleak/api-client';
  import { identity, initIdentity, clearIdentity, type Identity } from '#lib/stores/identity';
  import { requireIdentityOrRedirect } from '#lib/nav/guard';
  import { api } from '#lib/api/client';
  import type { PersonaDraft } from '#lib/join';
  import { locale, translate } from '#lib/i18n/locale';
  import {
    loadInterestIds,
    selectedInterests
  } from '#lib/stores/interests';
  import ProfileBadge from '#lib/components/profile/ProfileBadge.svelte';
  import PersonaEditor from '#lib/components/profile/PersonaEditor.svelte';
  import GreetingEditor from '#lib/components/profile/GreetingEditor.svelte';
  import InterestsEditor from '#lib/components/profile/InterestsEditor.svelte';
  import ErrorBanner from '#lib/components/ErrorBanner.svelte';
  import ConfirmDialog from '#lib/components/ConfirmDialog.svelte';
  import SkeletonBlock from '#lib/components/SkeletonBlock.svelte';
  import PixelAvatar from '#lib/components/PixelAvatar.svelte';
  import LocaleControl from '#lib/components/join/LocaleControl.svelte';

  // Hard reload on /profile: the layout hydrates identity in its onMount,
  // which runs after this page's script — hydrate defensively (idempotent)
  // so the guard sees the persisted identity instead of bouncing to /.
  initIdentity();
  const guarded = requireIdentityOrRedirect();

  type View = 'badge' | 'persona' | 'greeting' | 'interests';

  const me = $derived($identity);

  let view = $state<View>('badge');
  let loading = $state(true);
  let notFound = $state(false);
  let banner = $state<{ kind: 'network' | 'api'; text: string | null } | null>(null);
  let user = $state<User | null>(null);
  let handshakes = $state<readonly Handshake[]>([]);
  let chatCount = $state(0);

  // Interests re-derive on locale change and on badge re-entry after editing
  // (the mock store is read from localStorage — cheap, client-side only).
  let interestsEpoch = $state(0);
  const interests = $derived.by(() => {
    void interestsEpoch; // dependency: re-read after interest edits
    return selectedInterests(loadInterestIds(), $locale);
  });

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

  // --- mount fetch (no Poller on /profile, §2.2) ----------------------------
  async function fetchAll(id: Identity): Promise<void> {
    try {
      const [u, hs, chats] = await Promise.all([
        api.getRoomUser(id.roomAddress, id.userAddress),
        api.listHandshakesOfUser(id.userAddress),
        api.listChatsOfUser(id.userAddress)
      ]);
      user = u;
      handshakes = hs;
      chatCount = chats.length;
      banner = null;
      notFound = false;
      loading = false;
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 404) {
        // Persona deleted elsewhere → full-card state with the exit path.
        notFound = true;
      } else {
        banner = bannerOf(cause);
      }
      loading = false;
    }
  }

  $effect(() => {
    const id = me;
    if (!id || !guarded) return;
    void fetchAll(id);
  });

  function refresh(): void {
    const id = get(identity);
    if (id) void fetchAll(id);
  }

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
      refresh(); // stats may lag behind the rename; refresh everything
      view = 'badge';
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
      refresh();
      view = 'badge';
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

  function exitNotFound(): void {
    clearIdentity();
    void goto(resolve('/'));
  }

  // --- derived labels ----------------------------------------------------------
  const handshakesTotal = $derived(handshakes.length);
  const addedYou = $derived(handshakes.filter((h) => h.to_address === (me?.userAddress ?? '')).length);
  const dialogsTotal = $derived(chatCount);
</script>

<main class="profile-page">
  <header class="header">
    <h1>{translate($locale, 'profile.title')}</h1>
  </header>

  {#if banner}
    <ErrorBanner kind={banner.kind} message={banner.text} onretry={refresh} />
  {/if}

  {#if savedFlash && view === 'badge'}
    <p class="saved-flash" aria-live="polite">✓ {translate($locale, 'profile.saved')}</p>
  {/if}

  {#if loading && user === null}
    <div class="badge skeleton pixel-corners" aria-hidden="true">
      <div class="identity-row">
        <SkeletonBlock width="96px" height="96px" round />
        <div class="bars">
          <SkeletonBlock width="60%" height="24px" />
          <SkeletonBlock width="40%" height="14px" />
        </div>
      </div>
      <SkeletonBlock width="100%" height="56px" />
      <SkeletonBlock width="100%" height="40px" />
      <div class="stat-row">
        <SkeletonBlock width="100%" height="88px" />
        <SkeletonBlock width="100%" height="88px" />
      </div>
    </div>
  {:else if notFound}
    <div class="badge not-found pixel-corners">
      <div class="not-found-row">
        <PixelAvatar size={48} />
        <h2>{translate($locale, 'profile.not_found')}</h2>
      </div>
      <button type="button" class="cta" onclick={exitNotFound}>
        {translate($locale, 'profile.exit')}
      </button>
    </div>
  {:else if user}
    {#if view === 'badge'}
      <ProfileBadge
        {user}
        {interests}
        handshakes={handshakesTotal}
        dialogs={dialogsTotal}
        addedYou={addedYou}
        oneditpersona={() => {
          view = 'persona';
          personaError = null;
        }}
        oneditgreeting={openGreeting}
        oneditinterests={() => (view = 'interests')}
      />
      <section class="settings pixel-corners">
        <div class="setting">
          <span class="setting-label">{translate($locale, 'common.locale')}</span>
          <LocaleControl />
        </div>
        <button type="button" class="leave" onclick={() => (leaveOpen = true)}>
          {translate($locale, 'profile.leave')}
        </button>
        {#if leaveError}
          <p class="field-error" role="alert" aria-live="polite">{leaveError}</p>
        {/if}
      </section>
    {:else if view === 'persona'}
      <PersonaEditor
        {user}
        pending={pendingPersona}
        error={personaError}
        onsave={savePersona}
        oncancel={() => (view = 'badge')}
      />
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
          oncancel={() => (view = 'badge')}
        />
      {/key}
    {:else if view === 'interests'}
      <InterestsEditor
        ondone={() => {
          view = 'badge';
          interestsEpoch += 1;
        }}
      />
    {/if}
  {/if}
</main>

<ConfirmDialog
  bind:open={leaveOpen}
  title={translate($locale, 'profile.leave')}
  body={translate($locale, 'profile.leave.confirm_body')}
  confirmLabel={translate($locale, 'profile.leave')}
  onconfirm={leaveRoom}
/>

<style>
  .profile-page {
    flex: 1;
    width: 100%;
    max-width: 720px;
    margin: 0 auto;
    padding: var(--space-5) var(--space-4) calc(var(--bottom-tabbar-height) + var(--space-5));
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }
  .header h1 {
    font-size: 32px;
  }
  .saved-flash {
    margin: 0;
    font-size: 14px;
    color: var(--color-accent);
  }
  .badge,
  .settings {
    background: var(--color-surface);
    border-radius: var(--radius-lg);
    padding: var(--space-5);
  }
  .skeleton {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }
  .identity-row {
    display: flex;
    align-items: center;
    gap: var(--space-4);
  }
  .bars {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  .stat-row {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: var(--space-3);
  }
  .not-found {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    align-items: flex-start;
  }
  .not-found-row {
    display: flex;
    align-items: center;
    gap: var(--space-4);
  }
  .not-found h2 {
    font-size: 24px;
  }
  .cta {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: var(--touch-target);
    padding: 0 var(--space-5);
    background: var(--color-accent);
    color: var(--color-accent-ink);
    border: none;
    border-radius: var(--radius-pill);
    font-weight: 600;
    font-size: 14px;
    transition: opacity 120ms ease-out;
  }
  .settings {
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
  .leave {
    align-self: flex-start;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: var(--touch-target);
    padding: 0 var(--space-5);
    background: transparent;
    border: 1px solid var(--color-text-disabled-strong);
    color: var(--color-text);
    border-radius: var(--radius-pill);
    font-weight: 600;
    font-size: 14px;
    transition:
      border-color 120ms ease-out,
      color 120ms ease-out;
  }
  .field-error {
    margin: 0;
    color: var(--color-accent);
    font-size: 14px;
  }
  @media (min-width: 720px) {
    /* Badge card max-width 560px centered (§3.6 responsive). */
    .badge,
    .settings {
      max-width: 560px;
      width: 100%;
      align-self: center;
    }
  }
</style>
