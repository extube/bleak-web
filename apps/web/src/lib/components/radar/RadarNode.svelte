<script lang="ts">
  /**
   * RadarNode (DESIGN §3.2 + §4.8.3 + §4.9 amendments): one attendee on the
   * radar — a real button (§2.6: never a div-onclick) at a collision-avoided
   * position resolved by lib/room/radar.ts (layoutRadarNodes). §4.8.3a: NO
   * visible name label on other users' icons — only the "you" chip keeps a
   * name; the accessible name carries the relationship state
   * («Алиса — хендшейк ещё не отправлен» …, room.node.* keys). Markers on
   * the middle ring: outgoing → small accent dot on the avatar; incoming →
   * small accent dot at the avatar's top-right corner (§4.9.11: the former
   * accent ring is replaced by the dot, same visual language as the
   * outgoing marker). Colors via tokens only.
   *
   * §4.9.1 upright riding: the parent orbit layer rotates, so the node's
   * content (.avatar-box) counter-rotates with the same duration/delay
   * (inherited --orbit-duration / --orbit-delay vars) — icons travel with
   * the rings but never spin on their own axis. §4.9.12: the button keeps
   * the same element across ring-level changes (keyed stable in the page),
   * so its left/top transition glides the icon to its new ring smoothly.
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
      <span class="in-dot"></span>
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
    /* The parent .orbit-unit layer is pointer-events: none (full-stage
     * rotating layers stack); the button is the only hit target. */
    pointer-events: auto;
    /* §4.9.12: smooth ring-level transitions — the icon glides to its new
     * radius/angle when the placement changes (e.g. a relationship state
     * moves it between rings). Deterministic layout ⇒ unchanged data never
     * touches left/top ⇒ no jitter between polls. */
    transition: left 700ms ease, top 700ms ease;
    /* Entrance: opacity only — the centering translate stays untouched
     * (§4.6 entrance is opacity + scale; the scale variant is skipped so
     * the placement transform is never animated). */
    animation: node-in 180ms ease-out;
  }
  .avatar-box {
    position: relative;
    display: inline-flex;
    border-radius: 50%;
    /* §4.9.1 upright riding: counter-rotate against the parent orbit layer
     * with the SAME duration and delay (inherited vars set by the page's
     * .orbit-unit) — both animations start together at element mount and
     * stay phase-locked, so the icon's orientation is upright at all times
     * (transform-only; disabled under prefers-reduced-motion by base.css). */
    animation: orbit-counter var(--orbit-duration, 90s) linear infinite;
    animation-delay: var(--orbit-delay, 0s);
    transform-origin: 50% 50%;
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
  /* Incoming pending ("added you"): small accent dot at the avatar's
   * top-right corner (§4.9.11 — replaces the former accent ring; same
   * visual language as .out-dot). Lives inside the counter-rotating
   * .avatar-box, so it rides upright with the avatar and does not affect
   * the button's hit area (markers are aria-hidden with the box). */
  .in-dot {
    position: absolute;
    /* Slight offset outside the corner (§4.9.11: overlapping the avatar
     * edge is fine) — distinguishes it from .out-dot, which sits inside
     * the same corner. */
    top: -2px;
    right: -2px;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--color-accent);
  }
  @keyframes node-in {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }
  /* §4.9.1: reverse of the orbit spin — same duration ⇒ the two rotations
   * cancel exactly and the content never appears to spin. */
  @keyframes orbit-counter {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(-360deg);
    }
  }
</style>
