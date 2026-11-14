<script lang="ts">
  /**
   * RadarNode (DESIGN §3.2): one attendee on the radar — a real button
   * (§2.6: never a div-onclick) with a deterministic position, a 44px
   * PixelAvatar and a 12px muted name label. Markers on the middle ring:
   * outgoing → small accent dot on the avatar; incoming → accent ring
   * around the avatar. The accessible name carries the relationship state
   * («Алиса — хендшейк ещё не отправлен» …). Colors via tokens only.
   */
  import type { User } from '@bleak/api-client';
  import type { Relationship, RelationshipState } from '#lib/room/relationships';
  import { nodePosition, type RadarPlacement } from '#lib/room/radar';
  import { locale, translate, type MessageKey } from '#lib/i18n/locale';
  import PixelAvatar from '#lib/components/PixelAvatar.svelte';

  interface Props {
    user: User;
    relationship: Relationship;
    placement: RadarPlacement;
    /** Radar stage size in px (bind:clientWidth/clientHeight of the page). */
    stageWidth: number;
    stageHeight: number;
    onclick?: () => void;
  }

  const NODE_LABEL_KEYS: Record<RelationshipState, MessageKey> = {
    chat: 'room.node.chat',
    incoming: 'room.node.incoming',
    outgoing: 'room.node.outgoing',
    none: 'room.node.none'
  };

  let { user, relationship, placement, stageWidth, stageHeight, onclick }: Props = $props();

  const position = $derived(nodePosition(placement, stageWidth, stageHeight));
  const ariaLabel = $derived(
    translate($locale, NODE_LABEL_KEYS[relationship.state], { name: user.name })
  );
  const marker = $derived(relationship.state === 'outgoing' || relationship.state === 'incoming'
    ? relationship.state
    : null);
</script>

<button
  type="button"
  class="node"
  style:left="{position.x}px"
  style:top="{position.y}px"
  aria-label={ariaLabel}
  onclick={onclick}
>
  <span class="avatar-box" aria-hidden="true">
    <PixelAvatar address={user.address} size={44} />
    {#if marker === 'outgoing'}
      <span class="out-dot"></span>
    {:else if marker === 'incoming'}
      <span class="in-ring"></span>
    {/if}
  </span>
  <span class="name">{user.name}</span>
</button>

<style>
  .node {
    position: absolute;
    transform: translate(-50%, -50%);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    padding: var(--space-1);
    min-width: var(--touch-target);
    min-height: var(--touch-target);
    background: transparent;
    border: none;
    border-radius: var(--radius-md);
    color: inherit;
    /* Entrance: opacity only — the centering translate stays untouched
     * (§4.6 entrance is opacity + scale; the scale variant is skipped so
     * the placement transform is never animated). */
    animation: node-in 180ms ease-out;
  }
  .avatar-box {
    position: relative;
    display: inline-flex;
    border-radius: 50%;
  }
  /* Outgoing pending: small accent dot on the avatar (§3.2). */
  .out-dot {
    position: absolute;
    top: 0;
    right: 0;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--color-accent);
  }
  /* Incoming pending: accent ring around the avatar (§3.2). */
  .in-ring {
    position: absolute;
    inset: -3px;
    border: 2px solid var(--color-accent);
    border-radius: 50%;
  }
  .name {
    font-size: 12px;
    color: var(--color-text-muted);
    max-width: 76px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  @keyframes node-in {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }
</style>
