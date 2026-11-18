<script lang="ts">
  /**
   * Step 2 — room preview card (DESIGN §3.1): room name/description, the
   * agents-language + member-count meta row, the create option and the
   * "change code" exit back to Step 1.
   *
   * v2.4 (Concept §10.1.1): the device-vault screen is RETURN TO EVENT —
   * reachable from Step 1; the old "Import from this device" copy-flow
   * option is removed from the room preview.
   */
  import { locale, translate } from '#lib/i18n/locale';
  import type { Room } from '@bleak/api-client';

  interface Props {
    room: Room;
    memberCount: number;
    oncreate?: () => void;
    onchange?: () => void;
  }

  let { room, memberCount, oncreate, onchange }: Props = $props();
</script>

<div class="step">
  <h2 class="room-name">{room.name}</h2>
  {#if room.description}
    <p class="description">{room.description}</p>
  {/if}
  <p class="meta">
    {translate($locale, 'join.room.language', { language: room.language })}
    <span aria-hidden="true">·</span>
    {translate($locale, 'join.room.members', { n: String(memberCount) })}
  </p>

  <button type="button" class="cta" onclick={() => oncreate?.()}>
    {translate($locale, 'join.create_persona')}
  </button>
  <button type="button" class="link" onclick={() => onchange?.()}>
    {translate($locale, 'join.change_code')}
  </button>
</div>

<style>
  .step {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    align-items: stretch;
    text-align: left;
  }
  .room-name {
    font-size: 36px;
  }
  .description {
    margin: 0;
    color: var(--color-text-muted);
    font-size: 14px;
  }
  .meta {
    margin: 0;
    color: var(--color-text-muted);
    font-size: 14px;
    display: flex;
    gap: var(--space-2);
  }
  .link {
    align-self: center;
    background: transparent;
    border: none;
    color: var(--color-text-muted);
    min-height: var(--touch-target);
    font-size: 14px;
    text-decoration: underline;
  }
</style>
