<script lang="ts">
  /**
   * Live room view (DESIGN §3.7 item 5): summary tiles (members n/max,
   * language), member rows (tap → on-demand drill-down), a collapsible
   * settings section (name/description → updateRoom) and the danger zone
   * (delete room → confirm dialog). Presentational — the page owns the
   * Poller (5 s) and all API calls; the drill-down sheet fetches on demand
   * (never polled).
   */
  import type { Room, User } from '@bleak/api-client';
  import { locale, translate } from '#lib/i18n/locale';
  import { relativeTime, stableRoster } from '#lib/people/view';
  import StatTile from '#lib/components/StatTile.svelte';
  import ErrorBanner from '#lib/components/ErrorBanner.svelte';
  import EmptyState from '#lib/components/EmptyState.svelte';
  import PixelAvatar from '#lib/components/PixelAvatar.svelte';
  import SkeletonBlock from '#lib/components/SkeletonBlock.svelte';
  import ConfirmDialog from '#lib/components/ConfirmDialog.svelte';

  interface Props {
    room: Room | null;
    members: readonly User[];
    loading: boolean;
    pollError: { kind: 'network' | 'api'; message: string | null } | null;
    settingsPending: boolean;
    settingsError: string | null;
    deletePending: boolean;
    onretry: () => void;
    onopenMember: (user: User) => void;
    onupdateRoom: (name: string, description: string) => void;
    ondeleteRoom: () => void;
  }

  let {
    room,
    members,
    loading,
    pollError,
    settingsPending,
    settingsError,
    deletePending,
    onretry,
    onopenMember,
    onupdateRoom,
    ondeleteRoom
  }: Props = $props();

  let settingsOpen = $state(false);
  let settingsName = $state('');
  let settingsDescription = $state('');
  let confirmOpen = $state(false);
  let now = $state(Date.now());

  const roster = $derived(stableRoster(members));
  const membersTileLabel = $derived(translate($locale, 'host.stats.members_only'));
  const languageTileLabel = $derived(translate($locale, 'host.stats.language_only'));
  const emptyMessage = $derived(translate($locale, 'host.empty_live'));
  const settingsTitle = $derived(translate($locale, 'host.settings.title'));
  const nameLabel = $derived(translate($locale, 'host.form.name'));
  const descriptionLabel = $derived(translate($locale, 'host.form.description'));
  const saveLabel = $derived(translate($locale, 'common.save'));
  const errorTitle = $derived(translate($locale, 'common.error.api'));
  const dangerTitle = $derived(translate($locale, 'host.danger.title'));
  const deleteLabel = $derived(translate($locale, 'host.delete_room'));
  const deleteWarning = $derived(translate($locale, 'host.delete_warning'));
  const cancelLabel = $derived(translate($locale, 'common.cancel'));

  function memberLabel(user: User): string {
    return translate($locale, 'host.member.open', { name: user.name });
  }

  function joinedAt(user: User): string {
    return relativeTime(user.created_at, now, $locale);
  }

  function toggleSettings(): void {
    settingsOpen = !settingsOpen;
    if (settingsOpen) {
      // Prefill from the room at open time; polls never clobber edits.
      settingsName = room?.name ?? '';
      settingsDescription = room?.description ?? '';
    }
  }

  function saveSettings(event: SubmitEvent): void {
    event.preventDefault();
    onupdateRoom(settingsName.trim(), settingsDescription.trim());
  }
</script>

<section class="live">
  {#if room}
    <h2>{room.name}</h2>
  {/if}

  {#if pollError}
    <ErrorBanner
      kind={pollError.kind}
      message={pollError.message}
      onretry={() => onretry()}
    />
  {/if}

  <div class="tiles">
    <StatTile
      value={`${roster.length}/${room?.max_user ?? '—'}`}
      label={membersTileLabel}
    />
    <StatTile value={room?.language ?? '—'} label={languageTileLabel} />
  </div>

  {#if loading && roster.length === 0}
    <ul class="rows" aria-hidden="true">
      {#each [0, 1, 2] as skeleton (skeleton)}
        <li class="row skeleton">
          <SkeletonBlock width="40px" height="40px" round />
          <SkeletonBlock width="45%" height="16px" />
        </li>
      {/each}
    </ul>
  {:else if roster.length === 0}
    <EmptyState message={emptyMessage} icon="face" />
  {:else}
    <ul class="rows" class:dimmed={pollError !== null}>
      {#each roster as user (user.address)}
        <li>
          <button
            type="button"
            class="row"
            aria-label={memberLabel(user)}
            onclick={() => onopenMember(user)}
          >
            <PixelAvatar address={user.address} size={40} label="" />
            <span class="name">{user.name}</span>
            <span class="joined" title={user.created_at}>{joinedAt(user)}</span>
          </button>
        </li>
      {/each}
    </ul>
  {/if}

  <div class="settings">
    <button
      type="button"
      class="settings-toggle"
      aria-expanded={settingsOpen}
      aria-controls="host-settings"
      onclick={toggleSettings}
    >
      {settingsTitle}
    </button>

    {#if settingsOpen}
      <form id="host-settings" class="settings-body" onsubmit={saveSettings}>
        <div class="field">
          <label for="settings-name">{nameLabel}</label>
          <input id="settings-name" type="text" maxlength={255} bind:value={settingsName} />
        </div>
        <div class="field">
          <label for="settings-description">{descriptionLabel}</label>
          <input
            id="settings-description"
            type="text"
            maxlength={255}
            bind:value={settingsDescription}
          />
        </div>

        {#if settingsError}
          <p class="settings-error" role="alert" aria-live="polite">
            {errorTitle}{settingsError ? ` — ${settingsError}` : ''}
          </p>
        {/if}

        <button type="submit" class="cta save" disabled={settingsPending}>
          {#if settingsPending}<span class="spinner" aria-hidden="true"></span>{/if}
          {saveLabel}
        </button>

        <div class="danger">
          <h3>{dangerTitle}</h3>
          <button
            type="button"
            class="delete"
            disabled={deletePending}
            onclick={() => (confirmOpen = true)}
          >
            {deleteLabel}
          </button>
        </div>
      </form>
    {/if}
  </div>

  <ConfirmDialog
    bind:open={confirmOpen}
    title={deleteLabel}
    body={deleteWarning}
    confirmLabel={deleteLabel}
    cancelLabel={cancelLabel}
    danger
    onconfirm={() => ondeleteRoom()}
  />
</section>

<style>
  .live {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }
  h2 {
    font-size: 28px;
  }
  .tiles {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-3);
  }
  .rows {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    transition: opacity 200ms ease-out;
  }
  .rows.dimmed {
    opacity: 0.5;
  }
  .row {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    width: 100%;
    min-height: var(--touch-target);
    padding: var(--space-2) var(--space-3);
    background: var(--color-surface);
    border: none;
    border-radius: var(--radius-md);
    color: var(--color-text);
    text-align: left;
    font-family: var(--font-body);
    font-size: 16px;
    transition: opacity 120ms ease-out;
  }
  .row.skeleton {
    background: var(--color-surface);
  }
  .name {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .joined {
    font-size: 14px;
    color: var(--color-text-muted);
  }
  .settings {
    margin-top: var(--space-2);
  }
  .settings-toggle {
    width: 100%;
    min-height: var(--touch-target);
    background: transparent;
    border: none;
    color: var(--color-text-muted);
    font-size: 14px;
    text-align: left;
    border-bottom: 1px solid var(--color-text-disabled);
  }
  .settings-body {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    padding-top: var(--space-3);
  }
  .field {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }
  label {
    color: var(--color-text-muted);
    font-size: 14px;
  }
  input {
    background: var(--color-surface);
    color: var(--color-text);
    border: 1px solid var(--color-text-disabled-strong);
    border-radius: var(--radius-md);
    min-height: var(--touch-target);
    padding: 0 var(--space-4);
    font-size: 16px;
  }
  .settings-error {
    margin: 0;
    font-size: 14px;
    color: var(--color-text-muted);
  }
  .cta {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    background: var(--color-accent);
    color: var(--color-accent-ink);
    border: none;
    border-radius: var(--radius-pill);
    min-height: var(--touch-target);
    padding: 0 var(--space-5);
    font-weight: 600;
    transition: opacity 120ms ease-out;
  }
  .cta:disabled {
    opacity: 0.6;
  }
  .spinner {
    width: 16px;
    height: 16px;
    border: 2px solid var(--color-accent-ink);
    border-right-color: transparent;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  .danger {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    border-top: 1px solid var(--color-text-disabled);
    margin-top: var(--space-2);
    padding-top: var(--space-3);
  }
  .danger h3 {
    font-family: var(--font-pixel);
    font-size: 24px;
    letter-spacing: 0.04em;
  }
  .delete {
    min-height: var(--touch-target);
    border: 1px solid var(--color-text-disabled-strong);
    border-radius: var(--radius-pill);
    background: transparent;
    color: var(--color-text);
    font-weight: 600;
    font-size: 14px;
  }
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
