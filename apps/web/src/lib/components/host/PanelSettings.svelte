<script lang="ts">
  /**
   * PanelSettings (DESIGN rev. 4 §3.7.2 region 4): the collapsible
   * settings region — LAST on the panel. Room edit `name`/`description`
   * → «Сохранить» → `PUT /api/room/{address}` (room token; body
   * `{ name, description }` ONLY — `language`/`max_user` stay read-only
   * data chips in the top bar, flag F9) → the transient «Сохранено»
   * note; a 400 surfaces the server-text field error. «Сгенерировать
   * ключ комнаты» → confirm (specified copy) → `POST
   * /api/room/{address}/token` (current key as Bearer) → the page
   * replaces the stored `bleak.hostRoom.roomToken` IN PLACE. Danger
   * zone (visible warning heading): «Удалить комнату» → confirm →
   * `DELETE /api/room/{address}` → the stored room is cleared and the
   * page returns to `/host`. Presentational — the page owns the calls.
   */
  import type { Room } from '@bleak/api-client';
  import { locale, translate } from '#lib/i18n/locale';
  import ConfirmDialog from '#lib/components/ConfirmDialog.svelte';

  interface Props {
    room: Room | null;
    settingsPending: boolean;
    /** 400 → the server's plain-text field error. */
    settingsError: string | null;
    /** Transient «Сохранено» (page-owned timer). */
    savedNote: boolean;
    rotatePending: boolean;
    /** Transient «ключ обновлён» note (page-owned timer). */
    rotateDone: boolean;
    deletePending: boolean;
    onupdateRoom: (name: string, description: string) => void;
    onrotateRoomToken: () => void;
    ondeleteRoom: () => void;
  }

  let {
    room,
    settingsPending,
    settingsError,
    savedNote,
    rotatePending,
    rotateDone,
    deletePending,
    onupdateRoom,
    onrotateRoomToken,
    ondeleteRoom
  }: Props = $props();

  let settingsOpen = $state(false);
  let settingsName = $state('');
  let settingsDescription = $state('');
  let rotateConfirmOpen = $state(false);
  let deleteConfirmOpen = $state(false);

  const settingsTitle = $derived(translate($locale, 'host.settings.title'));
  const nameLabel = $derived(translate($locale, 'host.form.name'));
  const descriptionLabel = $derived(translate($locale, 'host.form.description'));
  const saveLabel = $derived(translate($locale, 'common.save'));
  const savedLabel = $derived(translate($locale, 'host.room.saved'));
  const errorTitle = $derived(translate($locale, 'common.error.api'));
  const dangerTitle = $derived(translate($locale, 'host.danger.title'));
  const deleteLabel = $derived(translate($locale, 'host.delete_room.row'));
  const deleteWarning = $derived(translate($locale, 'host.delete_room.body'));
  const cancelLabel = $derived(translate($locale, 'common.cancel'));
  const rotateRowLabel = $derived(translate($locale, 'host.rotate_room.row'));
  const rotateTitle = $derived(translate($locale, 'host.rotate_room.title'));
  const rotateBody = $derived(translate($locale, 'host.rotate_room.body'));
  const rotateCta = $derived(translate($locale, 'host.rotate_room.cta'));
  const rotateDoneLabel = $derived(translate($locale, 'host.rotate_room.done'));

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

<section class="settings" aria-label={settingsTitle}>
  <button
    type="button"
    class="settings-toggle"
    aria-expanded={settingsOpen}
    aria-controls="host-panel-settings"
    onclick={toggleSettings}
  >
    {settingsTitle}
  </button>

  {#if settingsOpen}
    <form id="host-panel-settings" class="settings-body" onsubmit={saveSettings}>
      <div class="field">
        <label for="panel-settings-name">{nameLabel}</label>
        <input id="panel-settings-name" type="text" maxlength={255} bind:value={settingsName} />
      </div>
      <div class="field">
        <label for="panel-settings-description">{descriptionLabel}</label>
        <input
          id="panel-settings-description"
          type="text"
          maxlength={255}
          bind:value={settingsDescription}
        />
      </div>

      {#if settingsError}
        <p class="settings-error" role="alert" aria-live="polite">
          {errorTitle}{settingsError ? ` — ${settingsError}` : ''}
        </p>
      {:else if savedNote}
        <p class="saved" aria-live="polite">✓ {savedLabel}</p>
      {/if}

      <button type="submit" class="cta save" disabled={settingsPending}>
        {#if settingsPending}<span class="spinner" aria-hidden="true"></span>{/if}
        {saveLabel}
      </button>

      <!-- Room-token rotation: confirm → the current key as Bearer → the
           stored bleak.hostRoom.roomToken is replaced IN PLACE (§10.9). -->
      <div class="rotate-row">
        <button
          type="button"
          class="rotate"
          disabled={rotatePending}
          onclick={() => (rotateConfirmOpen = true)}
        >
          {rotateRowLabel}
          {#if rotatePending}<span class="spinner" aria-hidden="true"></span>{/if}
        </button>
        {#if rotateDone}
          <p class="rotate-done" aria-live="polite">✓ {rotateDoneLabel}</p>
        {/if}
      </div>

      <!-- Danger zone: separated by a visible warning heading (§3.7.2). -->
      <div class="danger">
        <h3>{dangerTitle}</h3>
        <button
          type="button"
          class="delete"
          disabled={deletePending}
          onclick={() => (deleteConfirmOpen = true)}
        >
          {deleteLabel}
        </button>
      </div>
    </form>
  {/if}
</section>

<ConfirmDialog
  bind:open={rotateConfirmOpen}
  title={rotateTitle}
  body={rotateBody}
  confirmLabel={rotateCta}
  cancelLabel={cancelLabel}
  onconfirm={() => onrotateRoomToken()}
/>

<ConfirmDialog
  bind:open={deleteConfirmOpen}
  title={deleteLabel}
  body={deleteWarning}
  confirmLabel={deleteLabel}
  cancelLabel={cancelLabel}
  danger
  onconfirm={() => ondeleteRoom()}
/>

<style>
  .settings {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
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
  .saved,
  .rotate-done {
    margin: 0;
    font-size: 14px;
    color: var(--color-accent);
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
  .rotate-row {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  .rotate {
    align-self: flex-start;
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    min-height: var(--touch-target);
    padding: 0 var(--space-5);
    border: 1px solid var(--color-text-disabled-strong);
    border-radius: var(--radius-pill);
    background: transparent;
    color: var(--color-text);
    font-weight: 600;
    font-size: 14px;
  }
  .rotate:disabled {
    opacity: 0.6;
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
