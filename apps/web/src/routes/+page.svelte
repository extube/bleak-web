<script lang="ts">
  /**
   * `/` — Join (DESIGN §3.1, TZ-03). Pre-room screen, no tab bar (layout).
   * Deep links: ?code=NNNNNN → the JoinFlow code entry (prefill +
   * auto-submit); ?u={userAddress} with an identity → the §3.8 scanner
   * mutual-handshake routine (context *b*; the QrScanner owns the routine —
   * TZ-04 replaces the placeholder body in place, so this wiring needs no
   * consumer changes). Without an identity a persona deep link is ignored
   * (AC 14) and the normal join card renders.
   */
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { page } from '$app/state';
  import { locale, translate } from '#lib/i18n/locale';
  import { identity, clearIdentity } from '#lib/stores/identity';
  import { parseJoinDeepLink } from '#lib/join';
  import { api } from '#lib/api/client';
  import type { User } from '@bleak/api-client';
  import JoinFlow from '#lib/components/join/JoinFlow.svelte';
  import QrScanner from '#lib/components/QrScanner.svelte';
  import LocaleControl from '#lib/components/join/LocaleControl.svelte';

  const deepLink = $derived(parseJoinDeepLink(page.url.searchParams));
  const me = $derived($identity);

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

  // Persona deep link (AC 14): only meaningful with an existing identity.
  // Open state is a derived (overlay cannot be bound to a derived — the
  // placeholder sets its local open on close, we just record the dismissal).
  const personaLink = $derived(
    me !== null && deepLink?.kind === 'user' ? deepLink.userAddress : null
  );
  let personaScanDismissed = $state(false);
  const personaScannerOpen = $derived(personaLink !== null && !personaScanDismissed);

  // Member list for the persona-context scanner (§3.8 checks scan targets
  // against the room's members); fetched once while the overlay is active.
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
        /* scanner (TZ-04) treats an empty list as unknown members */
      });
    return () => {
      alive = false;
    };
  });

  function continueToRoom(): void {
    void goto(resolve('/room'));
  }

  function joinAnother(): void {
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

  <!-- §3.8 context (b) via deep link: the scanner runs the ruling-3
       mutual-handshake routine (placeholder panel until TZ-04). -->
  <QrScanner
    open={personaScannerOpen}
    context="persona"
    members={personaMembers}
    onClosed={() => (personaScanDismissed = true)}
  />
{:else}
  <JoinFlow deepLinkCode={deepLink?.kind === 'code' ? deepLink.code : null} />
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
