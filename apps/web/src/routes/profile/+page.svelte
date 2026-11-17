<script lang="ts">
  /**
   * /profile — Persona badge (DESIGN rev. 3 §3.6, TZ2-07 Part A).
   *
   * All calls go through the attendee `api` context — the persona Bearer is
   * auto-injected on every credentialed call (ARCHITECTURE §10.8).
   *
   * Live badge QR (Concept §6.3): a 4 s Poller polls the token-gated
   * `getRoomUser` (own address → persona Bearer, returns `private_bio` and
   * the derived `mutual_code_live` flag). No code yet (first load / stale
   * store) → register a fresh one immediately; flag false (a scan burned
   * the code) → generate a fresh code, register ONLY its hash
   * (`registerMutualCode` body = SHA-256 hash), update the `mutualCode`
   * store, and re-render with the rotation micro-animation + the transient
   * «QR обновлён» note. A registration failure keeps the last QR; the next
   * tick retries. Stats are fetched on mount + after mutations (§2.2 row).
   *
   * Token rotation (§3.6 settings): confirm dialog (other-device lockout
   * copy) → generate the new secret → `rotateUserToken` (Bearer = current,
   * body = new raw) → replace `identity.token` + rewrite the matching
   * `bleak.tokenVault` entry in place — written ONLY after a 2xx. 401 → the
   * §2.8 global gate; 403 → inline server text, identity kept.
   *
   * Leave room clears identity AND the mutual code (`clearIdentity` does
   * both) → `/`. Editors swap the badge card inline (one screen at a time).
   * Interests are the client-side mock (architecture §8.1 — no network).
   */
  import { get } from 'svelte/store';
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { ApiError, NetworkError, type Handshake, type User } from '@bleak/api-client';
  import { identity, initIdentity, clearIdentity, saveIdentity, type Identity } from '#lib/stores/identity';
  import { initMutualCode, mutualCode, saveMutualCode } from '#lib/stores/mutualCode';
  import { updateVaultEntryToken } from '#lib/stores/tokenVault';
  import { requireIdentityOrRedirect } from '#lib/nav/guard';
  import { api } from '#lib/api/client';
  import { generateTokenSecret } from '#lib/crypto/secrets';
  import { Poller } from '#lib/polling/poller';
  import type { PersonaDraft } from '#lib/join';
  import { locale, translate } from '#lib/i18n/locale';
  import {
    loadInterestIds,
    selectedInterests
  } from '#lib/stores/interests';
  import { decideBadgeAction, registerFreshMutualCode } from '#lib/components/profile/liveQr';
  import ProfileBadge from '#lib/components/profile/ProfileBadge.svelte';
  import PersonaEditor from '#lib/components/profile/PersonaEditor.svelte';
  import GreetingEditor from '#lib/components/profile/GreetingEditor.svelte';
  import InterestsEditor from '#lib/components/profile/InterestsEditor.svelte';
  import ErrorBanner from '#lib/components/ErrorBanner.svelte';
  import ConfirmDialog from '#lib/components/ConfirmDialog.svelte';
  import SkeletonBlock from '#lib/components/SkeletonBlock.svelte';
  import PixelAvatar from '#lib/components/PixelAvatar.svelte';
  import PixelIcon from '#lib/components/icons/PixelIcon.svelte';
  import LocaleControl from '#lib/components/join/LocaleControl.svelte';

  // Hard reload on /profile: the layout hydrates identity in its onMount,
  // which runs after this page's script — hydrate defensively (idempotent)
  // so the guard sees the persisted identity instead of bouncing to /.
  initIdentity();
  initMutualCode();
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

  // The raw one-time mutual code backing this persona's badge QR
  // (`bleak.mutualCode`, validated against the identity on load).
  const badgeCode = $derived.by(() => {
    const entry = $mutualCode;
    const id = $identity;
    if (entry === null || id === null) return null;
    return entry.userAddress === id.userAddress ? entry.code : null;
  });

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

  // --- live badge QR (poller tick; registration failure keeps the QR) -------
  let registering = $state(false);
  let qrRefreshed = $state(false);
  let qrFlashTimer: ReturnType<typeof setTimeout> | null = null;

  function flashQrRefreshed(): void {
    qrRefreshed = true;
    if (qrFlashTimer) clearTimeout(qrFlashTimer);
    qrFlashTimer = setTimeout(() => (qrRefreshed = false), 2000);
  }

  /**
   * Badge action per the §3.6 table: register (no code yet), rotate
   * (flag false — a scan burned the code), keep. The registration body
   * carries the code's HASH only (§7.4); the raw code is stored client-side
   * and re-rendered through the rotation micro-animation.
   */
  async function ensureBadge(id: Identity, live: boolean | undefined): Promise<void> {
    const action = decideBadgeAction(badgeCode, live);
    if (action === 'keep' || registering) return;
    registering = true;
    try {
      const code = await registerFreshMutualCode(id.roomAddress, id.userAddress, {}, {
        register: (room, address, hash) => api.registerMutualCode(room, address, hash)
      });
      saveMutualCode(id.userAddress, code);
      if (action === 'rotate') flashQrRefreshed();
    } catch {
      // Keep the last QR; the next poll tick retries (the flag still reads
      // false, §3.6 AC 14).
    } finally {
      registering = false;
    }
  }

  /** Poller tick: token-gated getRoomUser (badge data + liveness flag). */
  async function pollBadge(): Promise<void> {
    const id = get(identity);
    if (!id) throw new Error('no identity');
    const u = await api.getRoomUser(id.roomAddress, id.userAddress);
    user = u;
    notFound = false;
    banner = null;
    loading = false;
    await ensureBadge(id, u.mutual_code_live);
  }

  // --- stats: mount + after mutations (§2.2 row) ----------------------------
  async function fetchStats(id: Identity): Promise<void> {
    try {
      const [hs, chats] = await Promise.all([
        api.listHandshakesOfUser(id.userAddress),
        api.listChatsOfUser(id.userAddress)
      ]);
      handshakes = hs;
      chatCount = chats.length;
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 404) {
        notFound = true;
      } else if (banner === null) {
        banner = bannerOf(cause);
      }
    }
  }

  const poller = new Poller({
    intervalMs: 4000,
    backoffMs: 12_000,
    tick: pollBadge,
    onStall: (cause) => {
      if (cause instanceof ApiError && cause.status === 404) {
        // Persona deleted elsewhere → full-card state with the exit path.
        notFound = true;
        loading = false;
        return;
      }
      banner = bannerOf(cause);
      loading = false;
    }
  });

  $effect(() => {
    const id = me;
    if (!id || !guarded) return;
    poller.start();
    void poller.refresh();
    void fetchStats(id);
    return () => poller.stop();
  });

  function refresh(): void {
    const id = get(identity);
    if (id) {
      void poller.refresh();
      void fetchStats(id);
    }
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
        mutualCode={badgeCode}
        qrRefreshed={qrRefreshed}
        oneditpersona={() => {
          view = 'persona';
          personaError = null;
        }}
        oneditgreeting={openGreeting}
        oneditinterests={() => (view = 'interests')}
      />
      <section class="settings pixel-corners" aria-label={translate($locale, 'profile.settings.title')}>
        <h2 class="settings-title">{translate($locale, 'profile.settings.title')}</h2>
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
  /* Concept §7.1.6 / DESIGN §4.8.4: the settings block is visibly titled —
   * locale, token rotation and the red exit-room live inside it. */
  .settings-title {
    margin: 0;
    font-size: 20px;
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
    /* Exit-room (Concept §7.1.6, DESIGN §4.8.4): the one destructive
     * action renders RED — --color-danger fill with light --color-text
     * text (AA ≥4.5:1, verified numerically in tests). */
    background: var(--color-danger);
    color: var(--color-text);
    border: none;
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
    /* Badge card max-width 560px centered (§3.6 responsive). */
    .badge,
    .settings {
      max-width: 560px;
      width: 100%;
      align-self: center;
    }
  }
</style>
