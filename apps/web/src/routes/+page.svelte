<script lang="ts">
  /**
   * `/` — Join (DESIGN §3.1 rev. 3, TZ-03 + TZ2-06 Part B). Pre-room
   * screen, no tab bar (layout).
   *
   * - §2.8 global-401 notice: the `bleak.authNotice` sessionStorage flag is
   *   consumed on mount and rendered as the NoticeCard above the flow
   *   (binding Concept §6.1 copy, aria-live polite, no retry control).
   * - Deep links: ?code=NNNNNN → the JoinFlow code entry (prefill +
   *   auto-submit). ?u={userAddress}&m={code} / ?u={userAddress} with an
   *   identity run the §3.8 handshake routines — full routine including
   *   the confirm card (DeepLinkHandshake, no camera); without an identity
   *   both are ignored (AC 19) and the normal join card renders.
   * - Resume card: "join another event" clears the identity AND the
   *   one-time mutual code (clearIdentity, §10.4) but keeps the vault.
   */
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { page } from '$app/state';
  import { locale, translate } from '#lib/i18n/locale';
  import { identity, clearIdentity } from '#lib/stores/identity';
  import { parseJoinDeepLink } from '#lib/join';
  import { api, AUTH_NOTICE_KEY } from '#lib/api/client';
  import type { User } from '@bleak/api-client';
  import JoinFlow from '#lib/components/join/JoinFlow.svelte';
  import NoticeCard from '#lib/components/join/NoticeCard.svelte';
  import DeepLinkHandshake from '#lib/components/join/DeepLinkHandshake.svelte';
  import LocaleControl from '#lib/components/join/LocaleControl.svelte';

  const deepLink = $derived(parseJoinDeepLink(page.url.searchParams));
  const me = $derived($identity);

  // §2.8: consume the auth-notice flag on mount — render once, then clear
  // (a reload does not show it again). No retry/reload control exists.
  let authNotice = $state(false);
  $effect(() => {
    let flagged = false;
    try {
      flagged = sessionStorage.getItem(AUTH_NOTICE_KEY) === '1';
    } catch {
      /* storage unavailable — no notice */
    }
    if (flagged) {
      authNotice = true;
      try {
        sessionStorage.removeItem(AUTH_NOTICE_KEY);
      } catch {
        /* ignore */
      }
    }
  });

  // Resume card: the room name for «Продолжить в «{room}»» (one fetch per
  // identity; no Poller on `/`, §2.2).
  let resumeRoomName = $state<string | null>(null);
  $effect(() => {
    const id = me;
    resumeRoomName = null;
    if (!id) return;
    let alive = true;
    api
      .getRoom(id.roomAddress)
      .then((room) => {
        if (alive) resumeRoomName = room.name;
      })
      .catch(() => {
        /* unreachable/deleted room: the address stands in as the label */
      });
    return () => {
      alive = false;
    };
  });

  // Persona deep link (AC 19): only meaningful with an existing identity —
  // without one both parameter sets are ignored (normal join card).
  const personaLink = $derived(
    me !== null && deepLink?.kind === 'user'
      ? { userAddress: deepLink.userAddress, mutualCode: deepLink.mutualCode }
      : null
  );
  let personaPanelDismissed = $state(false);

  // Member list for the foreign-persona precheck (§3.8 step 2); fetched
  // once while the panel is active (public read, no token).
  let personaMembers = $state<readonly User[]>([]);
  $effect(() => {
    const id = me;
    if (!id || personaLink === null) return;
    let alive = true;
    api
      .listRoomUsers(id.roomAddress)
      .then((users) => {
        if (alive) personaMembers = users;
      })
      .catch(() => {
        /* empty list = membership unknown — the routine skips the check */
      });
    return () => {
      alive = false;
    };
  });

  function continueToRoom(): void {
    void goto(resolve('/room'));
  }

  function joinAnother(): void {
    // Clears the identity AND the one-time mutual code (§10.4); the
    // device token vault is KEPT (Concept §6.2).
    clearIdentity();
  }
</script>

{#if me}
  <div class="join">
    <span class="logo pixel-corners">{translate($locale, 'app.title')}</span>
    <section class="card pixel-corners resume">
      <h1 class="resume-title">
        {translate($locale, 'join.resume.title', { room: resumeRoomName ?? me.roomAddress })}
      </h1>
      <button type="button" class="cta" onclick={continueToRoom}>
        {translate($locale, 'join.enter')}
      </button>
      <button type="button" class="secondary" onclick={joinAnother}>
        {translate($locale, 'join.resume.another')}
      </button>
      <div class="footer">
        <LocaleControl />
      </div>
    </section>
  </div>

  <!-- §3.8 routine via deep link (no camera): the full mutual/single-
       direction flow including the confirm card, result states reused. -->
  {#if personaLink}
    <DeepLinkHandshake
      open={!personaPanelDismissed}
      userAddress={personaLink.userAddress}
      mutualCode={personaLink.mutualCode}
      members={personaMembers}
      onClosed={() => (personaPanelDismissed = true)}
    />
  {/if}
{:else}
  <div class="join">
    <span class="logo pixel-corners">{translate($locale, 'app.title')}</span>
    {#if authNotice}
      <NoticeCard />
    {/if}
    <JoinFlow deepLinkCode={deepLink?.kind === 'code' ? deepLink.code : null} />
  </div>
{/if}

<style>
  .join {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-5);
    padding: var(--space-7) var(--space-5) var(--space-6);
    width: 100%;
    max-width: 480px;
    margin: 0 auto;
  }
  .logo {
    font-family: var(--font-pixel);
    font-size: 40px;
    line-height: 1;
    background: var(--color-surface);
    padding: var(--space-3) var(--space-5);
  }
  .resume {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }
  .resume-title {
    font-size: 32px;
    overflow-wrap: anywhere;
  }
  .secondary {
    background: transparent;
    border: 1px solid var(--color-text-disabled-strong);
    color: var(--color-text);
    border-radius: var(--radius-pill);
    min-height: var(--touch-target);
    padding: 0 var(--space-5);
    font-size: 14px;
    font-weight: 600;
  }
  .footer {
    display: flex;
  }
  @media (min-width: 720px) {
    .join {
      justify-content: center;
    }
  }
</style>
