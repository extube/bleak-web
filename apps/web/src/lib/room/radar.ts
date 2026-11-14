/**
 * Radar placement (DESIGN §3.2, TZ-05): pure, deterministic layout math for
 * the /room radar — ring by relationship state, angle and radius jitter
 * derived from the user address hash. Same address ⇒ same position across
 * polls (AC 2); no DOM access here (unit tests: tests/radar-placement.test.ts).
 *
 * TZ §7.3 pin: ">14 attendees → 14 lowest" means LOWEST NUMERIC HASH VALUES
 * ascending (not lexicographic).
 */
import type { User } from '@bleak/api-client';
import { fnv1a } from '#lib/avatar/traits';
import type { RelationshipState } from './relationships';

/** >14 attendees: only these render on the radar; the full list is /people. */
export const MAX_RADAR_NODES = 14;

/**
 * Ring radii as fractions of the radar's half min-dimension (DESIGN §3.2:
 * "~28% / 56% / 84% of the available min-dimension" — measured from the
 * center, so the outer ring at 0.84 × half keeps nodes with their name
 * labels inside the viewport; the ±6% jitter peaks at 0.89).
 */
export const RING_FRACTIONS: readonly [number, number, number] = [0.28, 0.56, 0.84];

/** Radius jitter span: ±6% of the ring radius, derived from the hash. */
const JITTER_HALF_STEPS = 6; // (hash >>> 8) % 13 - 6 → -6..+6

export type RingIndex = 0 | 1 | 2;

/**
 * Ring semantics (DESIGN §3.2, inner → outer): an existing chat with me
 * (mutual handshake) → inner; a pending handshake in either direction →
 * middle; no interaction yet → outer. Exactly one ring per attendee.
 */
export function ringFor(state: RelationshipState): RingIndex {
  if (state === 'chat') return 0;
  if (state === 'incoming' || state === 'outgoing') return 1;
  return 2;
}

export interface RadarPlacement {
  ring: RingIndex;
  /** Angle in degrees 0..359 (0° right of center, clockwise on screen). */
  angle: number;
  /** Radius as a fraction of the radar's half min-dimension (0 < r < 1). */
  radiusFrac: number;
}

/**
 * Deterministic placement for one attendee: angle = fnv1a(address) % 360°,
 * radius = ring base ±6% jitter from another hash slice. Depends only on
 * (address, state) — positions never jump between polls with unchanged
 * data (AC 2).
 */
export function radarPlacement(address: string, state: RelationshipState): RadarPlacement {
  const hash = fnv1a(address);
  const angle = hash % 360;
  const ring = ringFor(state);
  const jitterPercent = ((hash >>> 8) % (JITTER_HALF_STEPS * 2 + 1)) - JITTER_HALF_STEPS;
  const radiusFrac = RING_FRACTIONS[ring] * (1 + jitterPercent / 100);
  return { ring, angle, radiusFrac };
}

/** Convert a placement to stage pixels (center + polar offset). */
export function nodePosition(
  placement: RadarPlacement,
  stageWidth: number,
  stageHeight: number
): { x: number; y: number } {
  const radius = placement.radiusFrac * (Math.min(stageWidth, stageHeight) / 2);
  const angleRad = (placement.angle * Math.PI) / 180;
  return {
    x: stageWidth / 2 + Math.cos(angleRad) * radius,
    y: stageHeight / 2 + Math.sin(angleRad) * radius
  };
}

/**
 * Cap (DESIGN §3.2 AC 10): with more than 14 attendees, the 14 lowest
 * NUMERIC hash values ascending render on the radar; the rest are covered
 * by a muted «+N ещё» counter on the outer ring.
 */
export function capRadarNodes(users: readonly User[]): { shown: User[]; extra: number } {
  if (users.length <= MAX_RADAR_NODES) {
    return { shown: [...users], extra: 0 };
  }
  const sorted = [...users].sort((a, b) => fnv1a(a.address) - fnv1a(b.address));
  return { shown: sorted.slice(0, MAX_RADAR_NODES), extra: users.length - MAX_RADAR_NODES };
}

/**
 * Fixed outer-ring position for the «+N ещё» overflow counter (AC 10).
 * Deterministic via the same placement math applied to a stable sentinel.
 */
export function moreCounterPlacement(): RadarPlacement {
  return radarPlacement('__radar-more__', 'none');
}
