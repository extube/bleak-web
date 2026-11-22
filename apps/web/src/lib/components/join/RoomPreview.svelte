<script lang="ts">
  /**
   * Step 2 — room preview card (DESIGN §3.1): room name/description, the
   * agents-language + member-count meta row, the create option and the
   * "change code" exit back to Step 1.
   *
   * v2.4 (Concept §10.1.1): the device-vault screen is RETURN TO EVENT —
   * reachable from Step 1; the old "Import from this device" copy-flow
   * option is removed from the room preview.
   *
   * Concept §30 (DESIGN §4.19): the form mounts the SHARED FormShell —
   * header (fixed): app icon + language switch; middle (the ONLY
   * scrollable region): the mascot, the room name, the description text
   * and the meta row (top-anchored, text ≤ 75% of the form width);
   * footer (fixed): the buttons for the user to pick — BOTH the
   * create-profile and change-code actions (the multi-button footer
   * case; existing styles reused).
   */
  import { locale, translate } from '#lib/i18n/locale';
  import type { Room } from '@bleak/api-client';
  import BleakMascot from '#lib/components/BleakMascot.svelte';
  import FormShell from './FormShell.svelte';

  interface Props {
    room: Room;
    memberCount: number;
    oncreate?: () => void;
    onchange?: () => void;
  }

  let { room, memberCount, oncreate, onchange }: Props = $props();
</script>

<FormShell>
  <div class="body">
    <!-- §23.1 item 3 content order (now the §30 MIDDLE block): mascot
         → title → content. -->
    <div class="mascot-row">
      <BleakMascot size={96} idle />
    </div>
    <h2 class="room-name">{room.name}</h2>
    {#if room.description}
      <p class="description">{room.description}</p>
    {/if}
    <p class="meta">
      {translate($locale, 'join.room.language', { language: room.language })}
      <span aria-hidden="true">·</span>
      {translate($locale, 'join.room.members', { n: String(memberCount) })}
    </p>
  </div>
  {#snippet footer()}
    <!-- §30 footer: 1..n action buttons — BOTH choices live here. -->
    <button type="button" class="cta" onclick={() => oncreate?.()}>
      {translate($locale, 'join.create_persona')}
    </button>
    <button type="button" class="link" onclick={() => onchange?.()}>
      {translate($locale, 'join.change_code')}
    </button>
  {/snippet}
</FormShell>

<style>
  .body {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    align-items: stretch;
    text-align: left;
  }
  .mascot-row {
    display: flex;
    justify-content: center;
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
