<script lang="ts">
  /**
   * ProfileBadge (DESIGN rev. 3 §3.6): the persona badge card — avatar (accent
   * backdrop, own persona), name, read-only agent language, greeting block,
   * bio rows, mock-interest chips, stat tiles and the LIVE personal QR
   * (`u` + one-time `m` from the mutualCode store; badge skeleton until a
   * code exists — never a broken payload). Purely presentational: data +
   * edit callbacks come from the route.
   */
  import type { User } from '@bleak/api-client';
  import type { Interest } from '#lib/stores/interests';
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
    interests: Interest[];
    handshakes: number;
    dialogs: number;
    addedYou: number;
    /** Raw one-time mutual code backing the live QR (null → badge skeleton). */
    mutualCode: string | null;
    /** Transient «QR обновлён» note (auto-hide owned by the page). */
    qrRefreshed?: boolean;
    oneditpersona?: () => void;
    oneditgreeting?: () => void;
    oneditinterests?: () => void;
  }

  let {
    user,
    interests,
    handshakes,
    dialogs,
    addedYou,
    mutualCode,
    qrRefreshed = false,
    oneditpersona,
    oneditgreeting,
    oneditinterests
  }: Props = $props();

  const languageMeta = $derived(
    translate($locale, 'profile.language.meta', { language: user.language })
  );
  const greetingEditLabel = $derived(translate($locale, 'profile.greeting.edit'));
  const interestsEditLabel = $derived(translate($locale, 'profile.interests.edit'));
  const qrAlt = $derived(translate($locale, 'profile.qr.aria'));
  const qrCaption = $derived(translate($locale, 'profile.qr.caption'));
  const qrOnetime = $derived(translate($locale, 'profile.qr.onetime'));
  const qrRefreshedLabel = $derived(translate($locale, 'profile.qr.refreshed'));
  const qrPayload = $derived(
    mutualCode !== null ? personaQrPayload(user.address, mutualCode) : ''
  );
</script>

<article class="badge pixel-corners">
  <header class="identity">
    <PixelAvatar address={user.address} size={96} own label={user.name} />
    <div class="who">
      <h2 class="name">{user.name}</h2>
      <p class="meta">{languageMeta}</p>
    </div>
    <button
      type="button"
      class="icon-button"
      aria-label={translate($locale, 'profile.persona.edit')}
      onclick={() => oneditpersona?.()}
    >
      <PixelIcon name="edit" size={16} />
    </button>
  </header>

  <section class="greeting" aria-label={greetingEditLabel}>
    <blockquote>
      <p>{user.greeting}</p>
      <footer class="caption">{translate($locale, 'profile.greeting.caption')}</footer>
    </blockquote>
    <button
      type="button"
      class="icon-button"
      aria-label={greetingEditLabel}
      onclick={() => oneditgreeting?.()}
    >
      <PixelIcon name="edit" size={16} />
    </button>
  </section>

  <section class="bios">
    <div class="bio">
      <h3 class="bio-label">{translate($locale, 'profile.badge.about')}</h3>
      <p class="bio-text">{user.public_bio === '' ? '—' : user.public_bio}</p>
    </div>
    <div class="bio">
      <h3 class="bio-label">{translate($locale, 'profile.badge.for_agent')}</h3>
      <!-- Concept §9.1.1 / DESIGN §4.10.3: the «only your agent sees this»
           heading keeps its position above the private content but reads in
           the body face (Inter) in a MUTED red, still distinct from the
           content below it (uppercase, weight). -->
      <p class="private-bio-heading">{translate($locale, 'profile.private_bio.caption')}</p>
      <p class="bio-text">{user.private_bio === '' ? '—' : user.private_bio}</p>
    </div>
  </section>

  <section class="interests" aria-label={interestsEditLabel}>
    <div class="row-head">
      <h3 class="bio-label">{translate($locale, 'profile.interests.title')}</h3>
      <button
        type="button"
        class="icon-button"
        aria-label={interestsEditLabel}
        onclick={() => oneditinterests?.()}
      >
        <PixelIcon name="edit" size={16} />
      </button>
    </div>
    {#if interests.length === 0}
      <p class="caption empty-interests">{translate($locale, 'profile.interests.empty')}</p>
      <button type="button" class="add-chip" onclick={() => oneditinterests?.()}>
        <PixelIcon name="plus" size={14} />
        {translate($locale, 'profile.interests.add')}
      </button>
    {:else}
      <ul class="chips">
        {#each interests as interest (interest.id)}
          <li>
            <Chip variant="outline-muted"><span aria-hidden="true">{interest.emoji}</span> {interest.label}</Chip>
          </li>
        {/each}
      </ul>
    {/if}
  </section>

  <div class="stats">
    <!-- Concept §8.1.5: exactly three metrics, all rendered at every width —
         Sent (ex "Handshakes"), Added you, Chatting (ex "Dialogs"). -->
    <StatTile value={handshakes} label={translate($locale, 'profile.stats.handshakes_label')} />
    <StatTile value={addedYou} label={translate($locale, 'profile.stats.added_label')} />
    <StatTile value={dialogs} label={translate($locale, 'profile.stats.dialogs_label')} />
  </div>

  <div class="qr-block">
    {#if mutualCode === null}
      <!-- No code yet (first load / stale store): badge skeleton until the
           fresh code is registered — never a broken payload (§3.6). -->
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
</article>

<style>
  .badge {
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
    background: var(--color-surface);
    border-radius: var(--radius-lg);
    padding: var(--space-5);
  }
  .identity {
    display: flex;
    align-items: center;
    gap: var(--space-4);
  }
  .who {
    flex: 1;
    min-width: 0;
  }
  .name {
    font-size: 28px;
    overflow-wrap: anywhere;
  }
  .meta {
    margin: var(--space-1) 0 0;
    font-size: 14px;
    color: var(--color-text-muted);
  }
  .icon-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: var(--touch-target);
    height: var(--touch-target);
    border: 1px solid var(--color-text-disabled-strong);
    /* Concept §8.1.4: the persona/avatar edit control is no longer a full
       circle — a rounded square (--radius-md), consistent with the tiles. */
    border-radius: var(--radius-md);
    background: transparent;
    color: var(--color-text-muted);
    transition:
      border-color 120ms ease-out,
      color 120ms ease-out;
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
  .greeting {
    display: flex;
    align-items: flex-start;
    gap: var(--space-3);
  }
  .greeting blockquote {
    flex: 1;
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
  .add-chip {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    min-height: 40px;
    padding: 0 var(--space-4);
    border: 1px dashed var(--color-text-disabled-strong);
    border-radius: var(--radius-pill);
    background: transparent;
    color: var(--color-text-muted);
    font-size: 14px;
    transition:
      border-color 120ms ease-out,
      color 120ms ease-out;
  }
  .chips {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }
  .stats {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: var(--space-3);
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
</style>
