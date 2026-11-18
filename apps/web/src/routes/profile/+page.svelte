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
   * Token rotation and the leave-room exit live on the /profile/settings
   * sub-page (Concept §8.1.3, DESIGN §4.9.3); this page links to it via a
   * settings button in the page header's TOP-RIGHT corner (Concept §9.1.2,
   * DESIGN §4.10.2) — the body-level row from the relocation task is
   * absorbed into that corner entry.
   *
   * Concept §10.1.4 / DESIGN §4.11.4: this page is READ-ONLY display —
   * the persona-edit affordances (badge edit buttons + the inline editors)
   * left /profile; ALL persona editing (name/bios, greeting, interests)
   * lives on /profile/settings.
   *
   * Interests are the client-side mock (architecture §8.1 — no network).
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
    loadInterestIds,
    selectedInterests
  } from '#lib/stores/interests';
  import { decideBadgeAction, registerFreshMutualCode } from '#lib/components/profile/liveQr';
  import ProfileBadge from '#lib/components/profile/ProfileBadge.svelte';
  import ErrorBanner from '#lib/components/ErrorBanner.svelte';
  import SkeletonBlock from '#lib/components/SkeletonBlock.svelte';
  import PixelAvatar from '#lib/components/PixelAvatar.svelte';

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

  // The raw one-time mutual code backing this persona's badge QR
  // (`bleak.mutualCode`, validated against the identity on load).
  const badgeCode = $derived.by(() => {
    const entry = $mutualCode;
    const id = $identity;
    if (entry === null || id === null) return null;
    return entry.userAddress === id.userAddress ? entry.code : null;
  });

  // Interests re-derive on locale change (the mock store is read from
  // localStorage — cheap, client-side only).
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

  // --- token rotation + leave room (moved to /profile/settings, §8.1.3) -------

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
  <!-- Settings corner entry (Concept §9.1.2, DESIGN §4.10.2): a real link
       (§2.6) at the header level, top-right, above the content column. -->
  <header class="header">
    <h1>{translate($locale, 'profile.title')}</h1>
    <a class="settings-corner" href={resolve('/profile/settings')}>
      {translate($locale, 'profile.settings.title')}
    </a>
  </header>

  {#if banner}
    <ErrorBanner kind={banner.kind} message={banner.text} onretry={refresh} />
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
    <ProfileBadge
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
    /* Wrapping keeps the corner entry clear of the title at phone widths. */
    flex-wrap: wrap;
    gap: var(--space-3);
  }
  .header h1 {
    font-size: 32px;
  }
  .settings-corner {
    /* Compact labeled button in the header's top-right corner (§4.10.2):
     * the rounded-square treatment of the other icon buttons, tokens
     * only, full touch target. */
    display: inline-flex;
    align-items: center;
    min-height: var(--touch-target);
    padding: 0 var(--space-4);
    border: 1px solid var(--color-text-disabled-strong);
    border-radius: var(--radius-md);
    background: transparent;
    color: var(--color-text-muted);
    font-family: var(--font-body);
    font-size: 14px;
    font-weight: 600;
    white-space: nowrap;
    transition:
      border-color 120ms ease-out,
      color 120ms ease-out;
  }
  .badge {
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
  @media (min-width: 720px) {
    /* Badge card max-width 560px centered (§3.6 responsive). */
    .badge {
      max-width: 560px;
      width: 100%;
      align-self: center;
    }
  }
  /* v2.6 (Concept §12, DESIGN §4.12.1 item 5): phone (<720px) full-screen
   * form — the badge card becomes the page: full width/height, no rounded
   * floating chrome. The container drops its side padding; the header
   * keeps its own gutter (spacing scale), the bottom tab-bar clearance
   * stays (functional, not chrome), and the card's --space-5 padding is
   * the content gutter. Desktop (min-width: 720px) is unchanged. */
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
