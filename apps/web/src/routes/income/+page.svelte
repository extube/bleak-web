<script lang="ts">
  /**
   * `/income` — the room-income (entry) page (tz12-02 route re-homing,
   * Concept §31): the whole pre-room join flow re-homed here from `/` —
   * the §2.8 notice card, the deep-link handshake and JoinFlow (the
   * 6-digit code entry → room intro → creation/vault).
   * Pre-room screen, no tab bar (layout).
   *
   * - §2.8 global-401 notice: the `bleak.authNotice` sessionStorage flag is
   *   consumed on mount and rendered as the NoticeCard above the flow
   *   (binding Concept §6.1 copy, aria-live polite, no retry control).
   * - Deep links: ?code=NNNNNN → the JoinFlow code entry (prefill +
   *   auto-submit). ?u={userAddress}&m={code} / ?u={userAddress} with an
   *   identity run the §3.8 handshake routines — full routine including
   *   the confirm card (DeepLinkHandshake, no camera); without an identity
   *   both are ignored (AC 19) and the normal join card renders.
   *   (`/` forwards these query strings here — the persona QR / invite
   *   links land on the landing page first, tz12-02.)
   * - Resume card: REMOVED (Concept §47, 2026-11-23) — the default form
   *   with the 6-digit input ALWAYS shows; JoinFlow renders
   *   unconditionally, there is no stored-session resume variant on the
   *   entry surface. The identity read stays: the §3.8 persona panel is
   *   still gated on an existing identity.
   * - The creation wizard itself lives under /income/[income_code]/create
   *   (JoinFlow navigates there when "Create profile" is chosen).
   */
  import { page } from '$app/state';
  import { identity } from '#lib/stores/identity';
  import { parseJoinDeepLink } from '#lib/join';
  import { api, AUTH_NOTICE_KEY } from '#lib/api/client';
  import type { User } from '@bleak/api-client';
  import JoinFlow from '#lib/components/join/JoinFlow.svelte';
  import NoticeCard from '#lib/components/join/NoticeCard.svelte';
  import DeepLinkHandshake from '#lib/components/join/DeepLinkHandshake.svelte';

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
</script>

<!-- §3.8 routine via deep link (no camera): the full mutual/single-
     direction flow including the confirm card, result states reused.
     Gated on an EXISTING identity (personaLink ⇒ me !== null). -->
{#if personaLink}
  <DeepLinkHandshake
    open={!personaPanelDismissed}
    userAddress={personaLink.userAddress}
    mutualCode={personaLink.mutualCode}
    members={personaMembers}
    onClosed={() => (personaPanelDismissed = true)}
  />
{/if}

<!-- Concept §47 (2026-11-23): the 6-digit entry form is the ONLY form on
     the entry surface — JoinFlow renders unconditionally (no stored-
     session resume variant). -->
<div class="join">
  {#if authNotice}
    <NoticeCard />
  {/if}
  <JoinFlow deepLinkCode={deepLink?.kind === 'code' ? deepLink.code : null} />
</div>

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
  @media (min-width: 720px) {
    .join {
      justify-content: center;
    }
  }
  /* v2.6 (Concept §12, DESIGN §4.12.1 item 5): phone (<720px) full-screen
   * forms — the join container drops its own gutter and the JoinFlow form
   * becomes the page. The form's --space-5 padding is the content gutter.
   * Desktop (min-width: 720px) is unchanged. */
  @media (max-width: 719px) {
    .join {
      max-width: none;
      padding: 0;
    }
  }
</style>
