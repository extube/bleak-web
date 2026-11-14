<script lang="ts">
  /**
   * ProfileBadge (DESIGN §3.6): the persona badge card — avatar (accent
   * backdrop, own persona), name, read-only agent language, greeting block,
   * bio rows, mock-interest chips, stat tiles and the personal QR. Purely
   * presentational: data + edit callbacks come from the route.
   */
  import type { User } from '@bleak/api-client';
  import type { Interest } from '#lib/stores/interests';
  import { locale, translate } from '#lib/i18n/locale';
  import PixelAvatar from '#lib/components/PixelAvatar.svelte';
  import PixelIcon from '#lib/components/icons/PixelIcon.svelte';
  import Chip from '#lib/components/Chip.svelte';
  import StatTile from '#lib/components/StatTile.svelte';
  import QrCodeBadge from './QrCodeBadge.svelte';
  import { personaQrPayload } from './qr';

  interface Props {
    user: User;
    interests: Interest[];
    handshakes: number;
    dialogs: number;
    addedYou: number;
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
    oneditpersona,
    oneditgreeting,
    oneditinterests
  }: Props = $props();

  const languageMeta = $derived(
    translate($locale, 'profile.language.meta', { language: user.language })
  );
  const greetingEditLabel = $derived(translate($locale, 'profile.greeting.edit'));
  const interestsEditLabel = $derived(translate($locale, 'profile.interests.edit'));
  const qrAlt = $derived(translate($locale, 'profile.qr.alt'));
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
      <p class="bio-text">{user.private_bio === '' ? '—' : user.private_bio}</p>
      <p class="caption">{translate($locale, 'profile.private_bio.caption')}</p>
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
    <StatTile value={handshakes} label={translate($locale, 'profile.stats.handshakes_label')} />
    <StatTile value={dialogs} label={translate($locale, 'profile.stats.dialogs_label')} />
    <div class="added-tile">
      <StatTile value={addedYou} label={translate($locale, 'profile.stats.added_label')} />
    </div>
  </div>

  <div class="qr-block">
    <QrCodeBadge payload={personaQrPayload(user.address)} alt={qrAlt} />
    <p class="caption center">{translate($locale, 'profile.qr.caption')}</p>
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
    border-radius: var(--radius-pill);
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
  .row-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
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
    grid-template-columns: repeat(2, 1fr);
    gap: var(--space-3);
  }
  .added-tile {
    display: none;
  }
  .qr-block {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    align-items: center;
  }
  @media (min-width: 720px) {
    .stats {
      grid-template-columns: repeat(3, 1fr);
    }
    .added-tile {
      display: block;
    }
  }
</style>
