<script module lang="ts">
  /**
   * Profile tab key (DESIGN §4.29.A.6): the three pill tabs over real
   * content — About / Interests / QR code. The default tab on mount is
   * About; the /profile page header's QR affordance switches to the QR tab.
   */
  export type ProfileTab = 'about' | 'interests' | 'qr';
</script>

<script lang="ts">
  /**
   * ProfileBadge (DESIGN §4.29.A — v3.23 profile redesign): the "My
   * profile" card. Centered identity block (96px square PixelAvatar, name,
   * read-only agent language), the exactly-three StatTile row (Concept
   * §8.1.5) placed ABOVE the tabs, and three pill tabs (real
   * `tablist`/`tab`/`tabpanel` semantics, A.7) over the real content:
   * About = greeting + public/private bio, Interests = the display-only
   * mirror chips (§23.2 5.6 — no editor, no add affordance), QR = the live
   * badge QR block (§6.3 contract carried: badge skeleton until a code
   * exists, both captions, the transient «QR обновлён» note).
   *
   * The card is READ-ONLY (Concept §42.3, DESIGN §4.29.A): no edit
   * affordance exists anywhere — persona editing lives on /profile/edit.
   * `activeTab` is bindable (the page header's QR affordance + the live
   * rotation switch the tab from outside); `scrollQrIntoView` is exported
   * for the header-affordance's "already on the QR tab" branch (A.2).
   *
   * Purely presentational: data comes from the route.
   */
  import type { User } from '@bleak/api-client';
  import type { InterestChip } from '#lib/stores/interests';
  import { locale, translate } from '#lib/i18n/locale';
  import PixelAvatar from '#lib/components/PixelAvatar.svelte';
  import PixelIcon from '#lib/components/icons/PixelIcon.svelte';
  import Chip from '#lib/components/Chip.svelte';
  import StatTile from '#lib/components/StatTile.svelte';
  import SkeletonBlock from '#lib/components/SkeletonBlock.svelte';
  import QrCodeBadge from './QrCodeBadge.svelte';
  import { personaQrPayload } from './qr';

  interface Props {
    user: User;
    interests: InterestChip[];
    handshakes: number;
    dialogs: number;
    addedYou: number;
    /** Raw one-time mutual code backing the live QR (null → badge skeleton). */
    mutualCode: string | null;
    /** Transient «QR обновлён» note (auto-hide owned by the page). */
    qrRefreshed?: boolean;
    /** The active pill tab (bindable — the page header switches it too). */
    activeTab?: ProfileTab;
  }

  let {
    user,
    interests,
    handshakes,
    dialogs,
    addedYou,
    mutualCode,
    qrRefreshed = false,
    activeTab = $bindable('about')
  }: Props = $props();

  let qrPanel: HTMLElement | null = $state(null);

  const languageMeta = $derived(
    translate($locale, 'profile.language.meta', { language: user.language })
  );
  // §4.35.B: the composed pair — label + ": " + on|off, from the
  // server-provided `user.active` only (no local write path on this page).
  const autoHandshakeLabel = $derived(
    `${translate($locale, 'profile.auto_handshake.label')}: ${
      user.active ? translate($locale, 'profile.auto_handshake.on') : translate($locale, 'profile.auto_handshake.off')
    }`
  );
  const qrAlt = $derived(translate($locale, 'profile.qr.aria'));
  const qrCaption = $derived(translate($locale, 'profile.qr.caption'));
  const qrOnetime = $derived(translate($locale, 'profile.qr.onetime'));
  const qrRefreshedLabel = $derived(translate($locale, 'profile.qr.refreshed'));
  const qrPayload = $derived(
    mutualCode !== null ? personaQrPayload(user.address, mutualCode) : ''
  );

  /** A.2: the header-affordance branch when the QR tab is ALREADY active —
   * scroll the QR block into view (instant under reduced motion). */
  export function scrollQrIntoView(): void {
    if (!qrPanel) return;
    let smooth = false;
    try {
      smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch {
      // No matchMedia (old engines): stay instant.
    }
    try {
      qrPanel.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'start' });
    } catch {
      // happy-dom / old engines: no scrollIntoView — the tab is already
      // visible, nothing else to do.
    }
  }
</script>

<article class="profile-card">
  <header class="identity">
    <PixelAvatar address={user.address} size={96} own label={user.name} />
    <h2 class="name">{user.name}</h2>
    <!-- §4.29.A.4 amended (DESIGN §4.35.B): the auto-handshake status line
         is the identity block's LAST element, a tight space-1 stack under
         the language-meta line. Indicator only — no control on /profile
         (the toggle lives on /profile/settings, §4.35.C). -->
    <div class="meta-stack">
      <p class="meta">{languageMeta}</p>
      <p class="auto-handshake">
        <PixelIcon name="status-active" size={16} />
        <span>{autoHandshakeLabel}</span>
      </p>
    </div>
  </header>

  <div class="stats">
    <!-- Concept §8.1.5: exactly three metrics, all rendered at every width —
         Sent (ex "Handshakes"), Added you, Chatting (ex "Dialogs"). The row
         sits above the pill tabs (the reference's stats position, A.5). -->
    <StatTile value={handshakes} label={translate($locale, 'profile.stats.handshakes_label')} />
    <StatTile value={addedYou} label={translate($locale, 'profile.stats.added_label')} />
    <StatTile value={dialogs} label={translate($locale, 'profile.stats.dialogs_label')} />
  </div>

  <!-- A.7 pill tabs: real tablist semantics; active = fill-accent, inactive
       = outline-muted; plain tabbable buttons in DOM order (no roving
       tabindex); the active-state morph is a 120 ms color transition and
       the panel switch is an instant content swap (F.1). -->
  <div class="tabs" role="tablist" aria-label={translate($locale, 'profile.title')}>
    <button
      type="button"
      role="tab"
      id="profile-tab-about"
      class="tab"
      class:active={activeTab === 'about'}
      aria-selected={activeTab === 'about'}
      aria-controls="profile-panel-about"
      onclick={() => (activeTab = 'about')}
    >
      {translate($locale, 'profile.tab.about')}
    </button>
    <button
      type="button"
      role="tab"
      id="profile-tab-interests"
      class="tab"
      class:active={activeTab === 'interests'}
      aria-selected={activeTab === 'interests'}
      aria-controls="profile-panel-interests"
      onclick={() => (activeTab = 'interests')}
    >
      {translate($locale, 'profile.tab.interests')}
    </button>
    <button
      type="button"
      role="tab"
      id="profile-tab-qr"
      class="tab"
      class:active={activeTab === 'qr'}
      aria-selected={activeTab === 'qr'}
      aria-controls="profile-panel-qr"
      onclick={() => (activeTab = 'qr')}
    >
      {translate($locale, 'profile.tab.qr')}
    </button>
  </div>

  <!-- A.6 About: greeting block (accent 3px left bar) + public bio +
       private bio (the muted-red caption above the content) — one surface
       card. -->
  <div
    id="profile-panel-about"
    class="panel"
    role="tabpanel"
    aria-labelledby="profile-tab-about"
    hidden={activeTab !== 'about'}
  >
    <div class="card pixel-corners">
      <section class="greeting" aria-label={translate($locale, 'profile.greeting.label')}>
        <blockquote>
          <p>{user.greeting}</p>
          <footer class="caption">{translate($locale, 'profile.greeting.caption')}</footer>
        </blockquote>
      </section>

      <section class="bios">
        <div class="bio">
          <h3 class="bio-label">{translate($locale, 'profile.badge.about')}</h3>
          <p class="bio-text">{user.public_bio === '' ? '—' : user.public_bio}</p>
        </div>
        <div class="bio">
          <h3 class="bio-label">{translate($locale, 'profile.badge.for_agent')}</h3>
          <!-- Concept §9.1.1 / DESIGN §4.10.3: the «only your agent sees
               this» heading keeps its position above the private content
               but reads in the body face (Inter) in a MUTED red, still
               distinct from the content below it (uppercase, weight). -->
          <p class="private-bio-heading">{translate($locale, 'profile.private_bio.caption')}</p>
          <p class="bio-text">{user.private_bio === '' ? '—' : user.private_bio}</p>
        </div>
      </section>
    </div>
  </div>

  <!-- A.6 Interests: the local mirror chips — DISPLAY-ONLY (§23.2 5.6): no
       editor, no add affordance; empty state carried. -->
  <div
    id="profile-panel-interests"
    class="panel"
    role="tabpanel"
    aria-labelledby="profile-tab-interests"
    hidden={activeTab !== 'interests'}
  >
    <div class="card pixel-corners">
      <section class="interests" aria-label={translate($locale, 'profile.interests.title')}>
        <div class="row-head">
          <h3 class="bio-label">{translate($locale, 'profile.interests.title')}</h3>
        </div>
        {#if interests.length === 0}
          <p class="caption empty-interests">{translate($locale, 'profile.interests.empty')}</p>
        {:else}
          <ul class="chips">
            {#each interests as interest (interest.key)}
              <li>
                <Chip variant="outline-muted"><span aria-hidden="true">{interest.emoji}</span> {interest.title}</Chip>
              </li>
            {/each}
          </ul>
        {/if}
      </section>
    </div>
  </div>

  <!-- A.6 QR: the live QR block — EXACTLY ONE QrCodeBadge instance on the
       page (A.2); the badge skeleton until a code exists; both captions;
       the rotation note renders here, under the QR (A.3). The panel stays
       MOUNTED while hidden (hidden attribute, not an {#if}) so a rotation
       firing on another tab keeps the two-phase swap intact. -->
  <div
    id="profile-panel-qr"
    class="panel"
    role="tabpanel"
    aria-labelledby="profile-tab-qr"
    hidden={activeTab !== 'qr'}
    bind:this={qrPanel}
  >
    <div class="card pixel-corners">
      <div class="qr-block">
        {#if mutualCode === null}
          <!-- No code yet (first load / stale store): badge skeleton until
               the fresh code is registered — never a broken payload (§3.6). -->
          <div class="qr-skeleton pixel-corners" aria-hidden="true">
            <SkeletonBlock width="176px" height="176px" />
          </div>
        {:else}
          <QrCodeBadge payload={qrPayload} alt={qrAlt} />
        {/if}
        {#if qrRefreshed}
          <p class="qr-refreshed" aria-live="polite">✓ {qrRefreshedLabel}</p>
        {/if}
        <p class="caption center">{qrCaption}</p>
        <p class="caption center">{qrOnetime}</p>
      </div>
    </div>
  </div>
</article>

<style>
  /* The card wrapper is TRANSPARENT — the identity block, stats and tabs
   * sit directly on the page background (the reference's first screen);
   * each tab panel is its own surface card below (A.6: one surface card
   * per tab). */
  .profile-card {
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
  }
  /* A.4: the identity block is a CENTERED column — avatar, name, meta. */
  .identity {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: var(--space-2);
  }
  .name {
    margin: 0;
    font-size: 28px;
    overflow-wrap: anywhere;
  }
  .meta {
    margin: 0;
    font-size: 14px;
    color: var(--color-text-muted);
  }
  /* §4.35.B: the meta line + the auto-handshake indicator form a tight
   * sub-column (gap space-1) inside the identity column (which keeps its
   * space-2 rhythm for avatar → name → meta). */
  .meta-stack {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-1);
  }
  /* The indicator line: 14px body regular, muted in BOTH states (the state
   * word carries the meaning — §4.3 accent discipline, no accent fill);
   * the leading glyph is muted + aria-hidden; wraps like the name. */
  .auto-handshake {
    margin: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-1);
    font-family: var(--font-body);
    font-size: 14px;
    color: var(--color-text-muted);
    overflow-wrap: anywhere;
  }
  .stats {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: var(--space-3);
  }
  /* A.7: the pill-tab row on the Chip vocabulary — active fill-accent,
     inactive outline-muted; NEVER .pixel-corners (pills stay smooth). */
  .tabs {
    display: flex;
    gap: var(--space-2);
  }
  .tab {
    flex: 1;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: var(--touch-target);
    padding: 0 var(--space-4);
    background: transparent;
    border: 1px solid var(--color-text-disabled-strong);
    border-radius: var(--radius-pill);
    color: var(--color-text-muted);
    font-family: var(--font-body);
    font-size: 14px;
    font-weight: 600;
    white-space: nowrap;
    /* F.1: the 120 ms active-state morph (background/color only). */
    transition:
      background-color 120ms ease-out,
      color 120ms ease-out,
      border-color 120ms ease-out;
  }
  .tab.active {
    background: var(--color-accent);
    border-color: var(--color-accent);
    color: var(--color-accent-ink);
  }
  @media (prefers-reduced-motion: reduce) {
    .tab {
      transition: none;
    }
  }
  .panel {
    margin: 0;
  }
  .card {
    background: var(--color-surface);
    border-radius: var(--radius-lg);
    padding: var(--space-5);
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }
  .greeting blockquote {
    margin: 0;
    padding: 0 0 0 var(--space-4);
    border-left: 3px solid var(--color-accent);
    font-style: italic;
    color: var(--color-text-muted);
  }
  .greeting blockquote p {
    margin: 0;
    overflow-wrap: anywhere;
    white-space: pre-wrap;
  }
  .caption {
    margin: var(--space-1) 0 0;
    font-size: 14px;
    color: var(--color-text-muted);
  }
  .caption.center {
    text-align: center;
  }
  .bios {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }
  .bio-label {
    font-family: var(--font-body);
    font-size: 14px;
    font-weight: 600;
    letter-spacing: 0.02em;
    color: var(--color-text);
    margin: 0 0 var(--space-1);
  }
  .bio-text {
    margin: 0;
    font-size: 14px;
    color: var(--color-text-muted);
    overflow-wrap: anywhere;
    white-space: pre-wrap;
  }
  /* Concept §10.1.3 / DESIGN §4.11.3: the private-bio heading keeps the
   * v2.2 position (caption above the private content), the body face
   * (Inter) and a MUTED red (danger color mixed toward transparency,
   * never solid), but drops the uppercase and becomes SMALLER than the
   * bio text below it — size contrast alone provides the hierarchy. */
  .private-bio-heading {
    margin: 0 0 var(--space-1);
    font-family: var(--font-body);
    font-size: 11px;
    font-weight: 600;
    text-transform: none;
    color: color-mix(in srgb, var(--color-danger-text) 70%, transparent);
  }
  /* Concept §9.1.4 / DESIGN §4.10.4: a clear vertical gap between the
   * «Interests» title row and the interest chips below it (--space-3). */
  .row-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    margin-bottom: var(--space-3);
  }
  .empty-interests {
    margin: 0 0 var(--space-2);
  }
  .chips {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }
  .qr-block {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    align-items: center;
  }
  .qr-skeleton {
    background: var(--color-qr-frame);
    padding: var(--space-2);
  }
  .qr-refreshed {
    margin: 0;
    font-size: 14px;
    color: var(--color-accent);
  }
  /* §4.12.1 item 5 carried (§4.29.G.6): at phone widths the panel cards
   * become the page — no rounded floating chrome. */
  @media (max-width: 719px) {
    .card {
      border-radius: 0;
      clip-path: none;
    }
  }
</style>
