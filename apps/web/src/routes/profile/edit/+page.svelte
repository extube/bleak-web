<script lang="ts">
  /**
   * /profile/edit — "Edit profile" screen (DESIGN §4.29.C — v3.23 profile
   * redesign; Concept §42.3). NEW route: persona editing moved here from
   * /profile/settings (G.3 — §4.11.4 item 4 superseded); /profile itself
   * stays READ-ONLY and edit-button-free.
   *
   * Field groups (the reference's key-value rows — C.3): the three
   * existing editors re-host as sections of ONE form — PersonaEditor
   * (name/public/private bio), GreetingEditor (textarea ≤255 + counter +
   * rule helper + inline Regenerate that fills WITHOUT saving) and the
   * LOCAL contact-card row (ContactCardEditor, §4.13.3: `bleak.contactCard`,
   * no backend field). Their individual Save/Cancel CTAs are retired — the
   * route owns the ONE full-width primary Save Changes (I-rec 3). Their
   * validators and helper copy carry verbatim.
   *
   * Save model (C.4): ONE full-width accent button. Submit sequence:
   * (1) `updateRoomUser` (name + public_bio + private_bio — ALL THREE
   * fields, omitted-field semantics), (2) `putUserGreeting`, (3) the local
   * `contactCard` save. FIRST FAILURE ABORTS the sequence — the failing
   * group shows the inline error (server text; network →
   * `common.error.network`; greeting 400 → `profile.greeting.no_questions`),
   * the already-applied steps stand, and a retry re-saves idempotently
   * (both PUTs send full values). The greeting question-mark rule blocks
   * the WHOLE save client-side: any `?`/`？` disables Save (`aria-disabled`)
   * with the reason inline at the greeting field. Double-submit prevented.
   * Success: the transient «Сохранено» flash (2 s, aria-live) — the page
   * STAYS on /profile/edit (C.5); the back control returns to /profile,
   * which re-fetches on mount (C.6: navigation discards unsaved input
   * WITHOUT a confirm — the same semantics as today's editors' Cancel,
   * I-rec 11).
   *
   * Mount (C.7): prefill from one `getRoomUser` fetch; the greeting field
   * additionally re-fetches the canonical greeting via `getUserGreeting`
   * (the `getRoomUser` value is the loading fallback). Load error →
   * `ErrorBanner` + retry. NO poller — the §6.3 live-QR contract stays
   * bound to /profile only (§2.2 cadence table).
   *
   * NO interests editor — §23.2 5.6 (interests are set at creation only;
   * the /profile Interests tab is display-only over the mirror; I-rec 12).
   *
   * Sub-page chrome (§4.29.C.1): no tab bar; back control top-left
   * (history back with a /profile fallback, §1.3); the h1 CENTERED =
   * `profile.edit.title` («Редактировать профиль» / "Edit profile" — the
   * one screen title the owner's reference names explicitly, I-rec 9/G.8).
   * The centered 96px square avatar is DISPLAY-ONLY — no camera badge (the
   * API has no avatar-upload endpoint, I-rec 6).
   */
  import { get } from 'svelte/store';
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { ApiError, NetworkError, type User } from '@bleak/api-client';
  import { identity, initIdentity } from '#lib/stores/identity';
  import { requireIdentityOrRedirect } from '#lib/nav/guard';
  import { api } from '#lib/api/client';
  import { backTarget } from '#lib/chats/view';
  import {
    loadContactCard,
    saveContactCard
  } from '#lib/stores/contactCard';
  import { containsQuestionMark } from '#lib/components/profile/greeting';
  import { locale, translate } from '#lib/i18n/locale';
  import PersonaEditor from '#lib/components/profile/PersonaEditor.svelte';
  import GreetingEditor from '#lib/components/profile/GreetingEditor.svelte';
  import ContactCardEditor from '#lib/components/profile/ContactCardEditor.svelte';
  import ErrorBanner from '#lib/components/ErrorBanner.svelte';
  import SkeletonBlock from '#lib/components/SkeletonBlock.svelte';
  import PixelAvatar from '#lib/components/PixelAvatar.svelte';
  import PixelIcon from '#lib/components/icons/PixelIcon.svelte';

  // Hard reload on a guarded route: hydrate identity defensively (idempotent).
  initIdentity();
  const guarded = requireIdentityOrRedirect();

  const me = $derived($identity);

  // --- load (mount prefill; NO poller, C.7) -----------------------------------
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

  async function loadUser(): Promise<void> {
    const id = get(identity);
    if (!id) return;
    try {
      const u = await api.getRoomUser(id.roomAddress, id.userAddress);
      user = u;
      loadError = null;
      // Prefill the field groups once, at load time — NOT reactively off
      // `user` (the save sequence updates `user` mid-flight and must not
      // clobber the editor values).
      name = u.name;
      publicBio = u.public_bio;
      privateBio = u.private_bio;
      contact = loadContactCard(id.roomAddress, id.userAddress);
      // The canonical greeting re-fetch (C.7); the getRoomUser value is the
      // loading fallback.
      greeting = u.greeting;
      greetingLoading = true;
      greetingError = null;
      try {
        const greetingRecord = await api.getUserGreeting(id.roomAddress, id.userAddress);
        greeting = greetingRecord.greeting;
      } catch (cause) {
        const mapped = bannerOf(cause);
        greetingError = { kind: mapped.kind, text: mapped.text };
      } finally {
        greetingLoading = false;
      }
    } catch (cause) {
      loadError = bannerOf(cause);
    }
  }

  // --- field state (the editors bind into these) ------------------------------
  let name = $state('');
  let publicBio = $state('');
  let privateBio = $state('');
  let greeting = $state('');
  let greetingLoading = $state(false);
  let contact = $state('');

  // --- validation (carried verbatim) ------------------------------------------
  let nameError = $state<string | null>(null);
  const greetingInvalid = $derived(containsQuestionMark(greeting));

  // --- the ONE Save Changes (C.4) ----------------------------------------------
  let pending = $state(false);
  let savedFlash = $state(false);
  let flashTimer: ReturnType<typeof setTimeout> | null = null;
  let personaError = $state<{ kind: 'network' | 'api'; text: string | null } | null>(null);
  let greetingError = $state<{
    kind: 'network' | 'api' | 'no_questions';
    text: string | null;
  } | null>(null);

  function flashSaved(): void {
    savedFlash = true;
    if (flashTimer) clearTimeout(flashTimer);
    flashTimer = setTimeout(() => (savedFlash = false), 2000);
  }

  /**
   * Save sequence (C.4): persona → greeting → local contact card. The
   * first failure aborts — the failing group keeps its inline error, the
   * already-applied steps stand, and a retry re-saves idempotently (both
   * PUTs send full values). Double-submit prevented by `pending`.
   */
  async function save(): Promise<void> {
    const id = me;
    if (!id || pending || greetingInvalid) return;
    personaError = null;
    greetingError = null;
    nameError = null;
    const trimmedName = name.trim();
    if (trimmedName === '') {
      // Required name (carried validator): inline reason at the name field.
      nameError = translate(get(locale), 'join.error.name_required');
      return;
    }
    pending = true;
    try {
      // (1) Persona — ALL THREE fields (omitted-field semantics, §3.6).
      const updated = await api.updateRoomUser(id.roomAddress, id.userAddress, {
        name: trimmedName,
        public_bio: publicBio,
        private_bio: privateBio
      });
      user = updated;
    } catch (cause) {
      personaError = bannerOf(cause);
      pending = false;
      return; // first failure aborts the sequence
    }
    try {
      // (2) Greeting — the full current value (idempotent on retry).
      const greetingRecord = await api.putUserGreeting(id.roomAddress, id.userAddress, greeting);
      greeting = greetingRecord.greeting;
    } catch (cause) {
      // Server 400 (question-free rule slipping through) → the same copy.
      greetingError =
        cause instanceof ApiError && cause.status === 400
          ? { kind: 'no_questions', text: null }
          : bannerOf(cause);
      pending = false;
      return; // first failure aborts the sequence
    }
    // (3) Local contact card — a purely local write, no API call (§4.13.3).
    saveContactCard(id.roomAddress, id.userAddress, contact);
    pending = false;
    // Success: the «Сохранено» flash; the page STAYS on /profile/edit (C.5).
    flashSaved();
  }

  /** Inline Regenerate (C.3): fills the textarea WITHOUT saving (§3.6). */
  let pendingRegenerate = $state(false);
  async function regenerate(): Promise<void> {
    const id = me;
    if (!id || pendingRegenerate) return;
    pendingRegenerate = true;
    greetingError = null;
    try {
      const greetingRecord = await api.regenerateGreeting(id.roomAddress, id.userAddress);
      greeting = greetingRecord.greeting;
    } catch (cause) {
      greetingError = bannerOf(cause);
    } finally {
      pendingRegenerate = false;
    }
  }

  $effect(() => {
    if (!guarded) return;
    void loadUser();
  });

  // --- back control (§1.3): history back, fallback /profile --------------------
  // C.6: navigation discards unsaved input WITHOUT a confirm dialog.
  function goBack(): void {
    if (backTarget(globalThis.history.length) === 'history') {
      globalThis.history.back();
    } else {
      void goto(resolve('/profile'));
    }
  }
</script>

<svelte:head>
  <!-- Route-neutral document title: the edit heading key (§4.29.C.1). -->
  <title>{translate($locale, 'profile.edit.title')}</title>
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
  <main class="edit-page">
    <!-- §4.29.C.1: back control top-left, the CENTERED h1 in the middle
         grid column (48px 1fr 48px) — the same chrome as /profile/settings. -->
    <header class="top-bar">
      <button
        type="button"
        class="back"
        aria-label={translate($locale, 'common.back')}
        onclick={goBack}
      >
        <PixelIcon name="back" size={16} />
      </button>
      <h1>{translate($locale, 'profile.edit.title')}</h1>
      <span class="spacer" aria-hidden="true"></span>
    </header>

    {#if loadError}
      <ErrorBanner kind={loadError.kind} message={loadError.text} onretry={loadUser} />
    {/if}

    {#if user}
      <form class="form" onsubmit={(event) => { event.preventDefault(); void save(); }}>
        <!-- §4.29.C.2: the centered 96px square avatar is DISPLAY-ONLY —
             no camera badge (the API has no avatar-upload endpoint). -->
        <div class="avatar-row">
          <PixelAvatar address={user.address} size={96} own label={user.name} />
        </div>

        <!-- Field groups (C.3): the three editors re-host as sections of
             ONE form; their validators and helper copy carry verbatim. -->
        <PersonaEditor
          bind:name
          bind:publicBio
          bind:privateBio
          nameError={nameError}
          error={personaError}
        />
        <GreetingEditor
          bind:greeting
          invalid={greetingInvalid}
          loading={greetingLoading}
          error={greetingError}
          regeneratePending={pendingRegenerate}
          onregenerate={() => void regenerate()}
        />
        <ContactCardEditor bind:text={contact} />

        <!-- §4.29.C.4: ONE full-width primary Save Changes. Pending → the
             spinner in the button; double-submit prevented; the greeting
             question-mark rule disables it (aria-disabled) with the reason
             inline at the greeting field. -->
        <button
          type="submit"
          class="save"
          disabled={pending || greetingInvalid}
          aria-disabled={greetingInvalid || undefined}
        >
          {#if pending}<span class="spinner" aria-hidden="true"></span>{/if}
          {translate($locale, 'profile.edit.save')}
        </button>

        {#if savedFlash}
          <p class="saved-flash" aria-live="polite">✓ {translate($locale, 'profile.saved')}</p>
        {/if}
      </form>
    {:else if !loadError}
      <!-- The form shape while the persona record loads. -->
      <div class="form" aria-hidden="true">
        <div class="avatar-row">
          <SkeletonBlock width="96px" height="96px" />
        </div>
        <SkeletonBlock width="100%" height="120px" />
        <SkeletonBlock width="100%" height="140px" />
        <SkeletonBlock width="100%" height="80px" />
        <SkeletonBlock width="100%" height="48px" />
      </div>
    {/if}
  </main>
{/if}

<style>
  .edit-page {
    flex: 1;
    width: 100%;
    max-width: 720px;
    margin: 0 auto;
    padding: var(--space-5) var(--space-4) var(--space-7);
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }
  /* §4.29.C.1: the centered title — grid [48px 1fr 48px] (B.1 pattern). */
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
  .form {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }
  /* §4.29.C.2: the display-only centered avatar. */
  .avatar-row {
    display: flex;
    justify-content: center;
  }
  /* §4.29.C.4: ONE full-width accent Save Changes button — pill, 48px,
   * accent background + accent-ink text, body face 16px/600. */
  .save {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    width: 100%;
    min-height: var(--touch-target);
    padding: 0 var(--space-5);
    background: var(--color-accent);
    color: var(--color-accent-ink);
    border: none;
    border-radius: var(--radius-pill);
    font-weight: 600;
    font-size: 16px;
    font-family: var(--font-body);
    transition: opacity 120ms ease-out;
  }
  .save:disabled {
    cursor: default;
    filter: saturate(0.4);
  }
  .saved-flash {
    margin: 0;
    font-size: 14px;
    color: var(--color-accent);
    text-align: center;
  }
  .spinner {
    width: 16px;
    height: 16px;
    border: 2px solid var(--color-accent-ink);
    border-right-color: transparent;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
  @media (min-width: 720px) {
    /* Centered column max-width 560px (§4.29.C.8 — consistent with the
     * other profile screens). */
    .form {
      max-width: 560px;
      width: 100%;
      align-self: center;
    }
  }
  /* §4.12.1 item 5 carried (§4.29.G.6/C.8): at phone widths the form
   * fills the viewport — no floating card chrome; the groups keep their
   * full-bleed surface treatment; the header keeps its own gutter. */
  @media (max-width: 719px) {
    .edit-page {
      padding: 0 0 var(--space-7);
    }
    .top-bar {
      padding: var(--space-5) var(--space-5) 0;
    }
    .form :global(.card) {
      border-radius: 0;
      clip-path: none;
    }
    .save {
      /* Concept §50 phone-overflow fix: width:auto (not 100%) under the
       * side margins — the flex column stretches the button to the
       * container minus 2×space-5, so the border box stays inside and the
       * page has NO horizontal overflow at phone widths (375/390/320px);
       * the inset pill look is kept. */
      width: auto;
      margin: 0 var(--space-5);
    }
  }
  /* Concept §50 shared key-value row spec: ONE label width for every
   * single-line kv row of the form, so the name row (PersonaEditor) and
   * the contact-card row (ContactCardEditor) align their value inputs at
   * one common left edge — no ragged offsets between the groups. The
   * components consume `var(--kv-label-width)`; the page owns the value
   * (custom properties inherit into the scoped component styles). */
  .form {
    --kv-label-width: 148px;
  }
</style>
