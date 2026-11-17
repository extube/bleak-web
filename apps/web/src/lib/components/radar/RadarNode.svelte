<script lang="ts">
  /**
   * RadarNode (DESIGN §3.2 + §4.8.3 amendment): one attendee on the radar —
   * a real button (§2.6: never a div-onclick) at a collision-avoided
   * position resolved by lib/room/radar.ts (layoutRadarNodes). §4.8.3a: NO
   * visible name label on other users' icons — only the "you" chip keeps a
   * name; the accessible name carries the relationship state
   * («Алиса — хендшейк ещё не отправлен» …, room.node.* keys). Markers on
   * the middle ring: outgoing → small accent dot on the avatar; incoming →
   * accent ring around the avatar. Colors via tokens only.
   */
  import type { User } from '@bleak/api-client';
  import type { Relationship, RelationshipState } from '#lib/room/relationships';
  import { NODE_AVATAR_PX } from '#lib/room/radar';
  import { locale, translate, type MessageKey } from '#lib/i18n/locale';
  import PixelAvatar from '#lib/components/PixelAvatar.svelte';

  interface Props {
    user: User;
    relationship: Relationship;
    /** Resolved stage position in px (layoutRadarNodes output). */
    x: number;
    y: number;
    onclick?: () => void;
  }

  const NODE_LABEL_KEYS: Record<RelationshipState, MessageKey> = {
    chat: 'room.node.chat',
    incoming: 'room.node.incoming',
    outgoing: 'room.node.outgoing',
    none: 'room.node.none'
  };

  let { user, relationship, x, y, onclick }: Props = $props();

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
  style:left="{x}px"
  style:top="{y}px"
  aria-label={ariaLabel}
  onclick={onclick}
>
  <span class="avatar-box" aria-hidden="true">
    <PixelAvatar address={user.address} size={NODE_AVATAR_PX} />
    {#if marker === 'outgoing'}
      <span class="out-dot"></span>
    {:else if marker === 'incoming'}
      <span class="in-ring"></span>
    {/if}
  </span>
</button>

<style>
  .node {
    position: absolute;
    transform: translate(-50%, -50%);
    /* Circular hit area: 52px = NODE_AVATAR_PX (44) + 2×4px padding —
     * the lib/room/radar.ts NODE_HIT_DIAMETER_PX constant (≥ 48px touch
     * target). The circle keeps every spacing guarantee from radar.ts
     * rotation-invariant — nodes ride the ring spin (§4.8.3c). */
    width: 52px;
    height: 52px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: var(--space-1);
    background: transparent;
    border: none;
    border-radius: 50%;
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
  @keyframes node-in {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }
</style>
