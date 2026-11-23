<script lang="ts">
  /**
   * /profile — "My profile" screen (DESIGN rev. 3 §3.6 → REDESIGNED by
   * §4.29, v3.23 profile redesign; Concept §42).
   *
   * All calls go through the attendee `api` context — the persona Bearer is
   * auto-injected on every credentialed call (ARCHITECTURE §10.8).
   *
   * Header (§4.29.A.1): the h1 left («Мой профиль»), the top-right cluster
   * holds two icon-only buttons — the QR affordance (A.2: tab-switch, NOT a
   * second QR; the live badge QR lives EXACTLY ONCE, inside the QR tab
   * panel) and the settings gear → /profile/settings (§4.10.2 carried, G.5:
   * labeled button → icon button).
   *
   * Live badge QR (Concept §6.3): a 4 s Poller polls the token-gated
   * `getRoomUser` (own address → persona Bearer, returns `private_bio` and
   * the derived `mutual_code_live` flag). No code yet (first load / stale
   * store) → register a fresh one immediately; flag false (a scan burned
   * the code) → generate a fresh code, register ONLY its hash
   * (`registerMutualCode` body = SHA-256 hash), update the `mutualCode`
   * store, and re-render with the rotation micro-animation + the transient
   * «QR обновлён» note. A registration failure keeps the last QR; the next
   * tick retries. When the rotation fires while another tab is active, the
   * app switches to the QR tab first (§4.29.A.3 — the rotation is visible
   * by design). Stats are fetched on mount + after mutations (§2.2 row).
   *
   * Concept §10.1.4 / §42.3 / DESIGN §4.29.A: this page is READ-ONLY — no
   * edit affordance exists on it (G.3); persona editing lives on
   * /profile/edit, app settings on /profile/settings.
   *
   * Interests are the local mirror of the real interest endpoints
   * (DESIGN §4.13.1 — the API has no interests GET); the Interests tab is
   * DISPLAY-ONLY over the mirror (§23.2 5.6, §4.29 I-rec 12).
   */
  import { get } from 'svelte/store';
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { ApiError, NetworkError, type Handshake, type User } from '@bleak/api-client';
  import { identity, initIdentity, clearIdentity, type Identity } from '#lib/stores/identity';
  import { initMutualCode, mutualCode, saveMutualCode } from '#lib/stores/mutualCode';
  import { requireIdentityOrRedirect } from '#lib/nav/guard';
  import { api } from '#lib/api/client';
  import { Poller } from '#lib/polling/poller';
  import { locale, translate } from '#lib/i18n/locale';
  import {
    displayInterests,
    loadInterests
  } from '#lib/stores/interests';
  import { decideBadgeAction, registerFreshMutualCode } from '#lib/components/profile/liveQr';
  import ProfileBadge, { type ProfileTab } from '#lib/components/profile/ProfileBadge.svelte';
  import ErrorBanner from '#lib/components/ErrorBanner.svelte';
  import SkeletonBlock from '#lib/components/SkeletonBlock.svelte';
  import PixelAvatar from '#lib/components/PixelAvatar.svelte';
  import PixelIcon from '#lib/components/icons/PixelIcon.svelte';

  // Hard reload on /profile: the layout hydrates identity in its onMount,
  // which runs after this page's script — hydrate defensively (idempotent)
  // so the guard sees the persisted identity instead of bouncing to /.
  initIdentity();
  initMutualCode();
  const guarded = requireIdentityOrRedirect();

  const me = $derived($identity);

  let loading = $state(true);
  let notFound = $state(false);
  let banner = $state<{ kind: 'network' | 'api'; text: string | null } | null>(null);
  let user = $state<User | null>(null);
  let handshakes = $state<readonly Handshake[]>([]);
  let chatCount = $state(0);

  // The pill tabs (§4.29.A.6/A.7): the default tab on mount is About; the
  // header QR affordance and the live rotation switch it from outside.
  let activeTab = $state<ProfileTab>('about');
  // Component ref for the A.2 "already on the QR tab → scroll into view".
  let card = $state<{ scrollQrIntoView(): void } | null>(null);

  // The raw one-time mutual code backing this persona's badge QR
  // (`bleak.mutualCode`, validated against the identity on load).
  const badgeCode = $derived.by(() => {
    const entry = $mutualCode;
    const id = $identity;
    if (entry === null || id === null) return null;
    return entry.userAddress === id.userAddress ? entry.code : null;
  });

  // Interests re-derive on locale change (DESIGN §4.13.1: the badge reads
  // the per-device mirror — cheap, client-side only; titles re-localize
  // through the catalog).
  const interests = $derived.by(() => {
    const id = me;
    if (!id) return [];
    return displayInterests(loadInterests(id.roomAddress, id.userAddress), $locale);
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
   * Header QR affordance (§4.29.A.2): if the active tab is not QR →
   * activate the QR tab; if it already is → scroll the QR block into view
   * (instant under prefers-reduced-motion — the card handles that).
   */
  function openQrTab(): void {
    if (activeTab !== 'qr') {
      activeTab = 'qr';
      return;
    }
    card?.scrollQrIntoView();
  }

  /**
   * Badge action per the §3.6 table: register (no code yet), rotate
   * (flag false — a scan burned the code), keep. The registration body
   * carries the code's HASH only (§7.4); the raw code is stored client-side
   * and re-rendered through the rotation micro-animation. On a ROTATION the
   * app switches to the QR tab first (§4.29.A.3) so the swap is visible.
   */
  async function ensureBadge(id: Identity, live: boolean | undefined): Promise<void> {
    const action = decideBadgeAction(badgeCode, live);
    if (action === 'keep' || registering) return;
    if (action === 'rotate') activeTab = 'qr';
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

  // --- persona editing + token rotation + leave room (§4.29) ------------------
  // Persona editing lives on /profile/edit (entered from the settings entry
  // row); token rotation + the leave-room exit live on /profile/settings.

  function exitNotFound(): void {
    clearIdentity();
    void goto(resolve('/income'));
  }

  // --- derived labels ----------------------------------------------------------
  const handshakesTotal = $derived(handshakes.length);
  const addedYou = $derived(handshakes.filter((h) => h.to_address === (me?.userAddress ?? '')).length);
  const dialogsTotal = $derived(chatCount);
</script>

<main class="profile-page">
  <!-- Header (§4.29.A.1): the h1 left + the top-right cluster — the QR
       affordance icon button and the settings gear (a real link styled as
       an icon button, §2.6), both 48px touch targets. -->
  <header class="header">
    <h1>{translate($locale, 'profile.title')}</h1>
    <div class="corner">
      <button
        type="button"
        class="icon-btn"
        aria-label={translate($locale, 'profile.header.qr')}
        onclick={openQrTab}
      >
        <PixelIcon name="scan" size={16} />
      </button>
      <a
        class="icon-btn"
        href={resolve('/profile/settings')}
        aria-label={translate($locale, 'profile.settings.title')}
      >
        <PixelIcon name="gear" size={16} />
      </a>
    </div>
  </header>

  {#if banner}
    <ErrorBanner kind={banner.kind} message={banner.text} onretry={refresh} />
  {/if}

  {#if loading && user === null}
    <!-- §4.29.A.8: the skeleton adapted to the new shape — centered avatar
         block + name bar + 3 stat-tile skeletons + the tab row. -->
    <div class="skeleton" aria-hidden="true">
      <div class="identity">
        <SkeletonBlock width="96px" height="96px" />
        <SkeletonBlock width="60%" height="24px" />
        <SkeletonBlock width="40%" height="14px" />
      </div>
      <div class="stat-row">
        <SkeletonBlock width="100%" height="88px" />
        <SkeletonBlock width="100%" height="88px" />
        <SkeletonBlock width="100%" height="88px" />
      </div>
      <div class="tab-row">
        <SkeletonBlock width="100%" height="48px" />
        <SkeletonBlock width="100%" height="48px" />
        <SkeletonBlock width="100%" height="48px" />
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
    <ProfileBadge
      bind:this={card}
      bind:activeTab
      {user}
      {interests}
      handshakes={handshakesTotal}
      dialogs={dialogsTotal}
      addedYou={addedYou}
      mutualCode={badgeCode}
      qrRefreshed={qrRefreshed}
    />
  {/if}
</main>

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
  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
  }
  .header h1 {
    font-size: 32px;
  }
  /* §4.29.A.1: the top-right cluster — two icon-only buttons, muted glyph,
   * hover/active → --color-text, full touch targets, tokens only. */
  .corner {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
  }
  .icon-btn {
    width: var(--touch-target);
    height: var(--touch-target);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    color: var(--color-text-muted);
    transition: color 120ms ease-out;
  }
  .icon-btn:hover,
  .icon-btn:active {
    color: var(--color-text);
  }
  .skeleton {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }
  .identity {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-2);
  }
  .stat-row {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: var(--space-3);
  }
  .tab-row {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: var(--space-2);
  }
  .badge {
    background: var(--color-surface);
    border-radius: var(--radius-lg);
    padding: var(--space-5);
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
  @media (min-width: 720px) {
    /* Content column max-width 560px centered (§4.29.A.9). */
    .badge,
    .skeleton {
      max-width: 560px;
      width: 100%;
      align-self: center;
    }
  }
  /* §4.12.1 item 5 (carried, §4.29.G.6): phone (<720px) full-screen
   * treatment — the container drops its side padding; the header keeps its
   * own gutter; the tab-bar clearance stays (functional, not chrome); the
   * panel cards lose the floating chrome. The ProfileBadge card drops ITS
   * chrome in the component's own scoped styles (same 719px query). */
  @media (max-width: 719px) {
    .profile-page {
      padding: 0 0 calc(var(--bottom-tabbar-height) + var(--space-5));
    }
    .header {
      padding: var(--space-5) var(--space-5) 0;
    }
    .badge {
      border-radius: 0;
      clip-path: none;
      flex: 1;
    }
  }
</style>
