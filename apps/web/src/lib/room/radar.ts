/**
 * Radar placement (DESIGN §3.2 + §4.8.3 amendment, TZ-05): pure,
 * deterministic layout math for the /room radar — ring by relationship
 * state, angle and radius jitter derived from the user address hash, then
 * a collision-avoided layout pass that guarantees distinct hit areas (no
 * node overlap), a generous exclusion zone around the static "you" chip
 * and on-canvas placement down to phone widths. Same data ⇒ same layout
 * across polls (AC 2); no DOM access here
 * (unit tests: tests/radar-placement.test.ts).
 *
 * §4.8.3 (owner request, Concept §7.1 item 5): no name labels on other
 * users' icons (component-level), an increased minimum distance between
 * the "you" chip and the nearest icon, nodes riding the ring spin (page
 * level: upright riding + per-ring speeds, DESIGN §4.9.1/4.9.2), and
 * never-overlapping icons.
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
 * Per-ring orbit durations in seconds (DESIGN §4.9.2, owner example): ring
 * 1 (inner, chat) fastest, ring 2 (middle, pending handshakes) a bit
 * slower, ring 3 (outer, none-state) very fast. Motion constants only —
 * the placement math above is untouched; the page's orbit layers and
 * RadarRings' ring lines read this single source.
 */
export const RING_ORBIT_DURATIONS_S: readonly [number, number, number] = [60, 90, 20];

/**
 * Ring radii as fractions of the radar's half MAX-dimension (§4.8.3: the
 * rings are scaled UP from the old 0.28 / 0.56 / 0.84 so the inner ring
 * clears the enlarged exclusion zone around the "you" chip — the old
 * 0.28 ring put icons right against the chip on phone stages). Measured
 * from the center; RadarRings draws the same fractions (viewBox half = 100).
 * §4.10.1 (Concept §9.1.3): the dimension is the STAGE's max side — the
 * stage element itself is sized to the max viewport dimension, so the
 * ring diameter spans the larger viewport dimension.
 */
export const RING_FRACTIONS: readonly [number, number, number] = [0.56, 0.7, 0.84];

/** Radius jitter span: ±6% of the ring radius, derived from the hash. */
const JITTER_HALF_STEPS = 6; // (hash >>> 8) % 13 - 6 → -6..+6

/** Rendered node avatar (PixelAvatar size, DESIGN §3.2). */
export const NODE_AVATAR_PX = 44;

/**
 * Node hit area diameter: circular button = 44px avatar + 2×4px padding
 * (≥ the 48px touch target, §2.6). Circular, so every clearance below is
 * rotation-invariant — nodes ride the ring spin (§4.8.3c) without ever
 * invalidating a spacing guarantee.
 */
export const NODE_HIT_DIAMETER_PX = 52;

/** Minimum center-to-center distance between two nodes: hit area + 8px gap. */
export const MIN_NODE_DIST_PX = NODE_HIT_DIAMETER_PX + 8; // 60

/**
 * Minimum distance between the stage center and any node center
 * (§4.8.3b — increased "you"-chip distance): the chip block (64px avatar +
 * name + count line; worst case 152×134px → half-diagonal ≈ 101px) plus
 * the node hit radius (26px), rounded up. The old inner ring (0.28) sat
 * ~45px from the center on a 320px stage — inside the chip.
 */
export const MIN_CENTER_GAP_PX = 128;

/** On-canvas margin: node hit radius (26px) + 2px breathing room. */
export const EDGE_MARGIN_PX = 28;

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
  /** Radius as a fraction of the radar's half max-dimension (0 < r < 1). */
  radiusFrac: number;
}

/**
 * Deterministic base placement for one attendee: angle = fnv1a(address) %
 * 360°, radius = ring base ±6% jitter from another hash slice. Depends only
 * on (address, state) — the base never changes between polls with unchanged
 * data (AC 2). The final pixel position comes from layoutRadarNodes.
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
  // §4.10.1 (Concept §9.1.3): radii scale against HALF OF THE MAX stage
  // dimension — the stage is sized to the max viewport dimension, so the
  // ring diameter equals max(screen-width, screen-height).
  const radius = placement.radiusFrac * (Math.max(stageWidth, stageHeight) / 2);
  const angleRad = (placement.angle * Math.PI) / 180;
  return {
    x: stageWidth / 2 + Math.cos(angleRad) * radius,
    y: stageHeight / 2 + Math.sin(angleRad) * radius
  };
}

/**
 * Stage element size for a measured viewport box (§4.10.1, Concept
 * §9.1.3): the radar stage is a SQUARE of side max(width, height) — the
 * radar spans the larger viewport dimension, centered; the page container
 * clips the overflow beyond the viewport edge (no horizontal scrollbar).
 * Pure and deterministic (unit tests: tests/radar-placement.test.ts).
 */
export function radarStageSize(
  availWidth: number,
  availHeight: number
): { width: number; height: number } {
  const side = Math.max(availWidth, availHeight);
  return { width: side, height: side };
}

export interface RadarNodeInput {
  address: string;
  state: RelationshipState;
}

export interface RadarLayoutPoint {
  address: string;
  ring: RingIndex;
  /** Deterministic hash angle in degrees 0..359 (the base, never moved). */
  angle: number;
  /** Final radius in px from the stage center (after clamping). */
  radiusPx: number;
  x: number;
  y: number;
}

/** Probe span: ±120° around the base angle in 3° steps (81 candidates). */
const PROBE_STEP_DEG = 3;
const PROBE_STEPS = 40;

/**
 * Farthest usable radius along one angle: the ray from the stage center
 * must keep the node's circular hit area (radius = hit diameter / 2) fully
 * on-canvas (§4.8.3e), so it clips against the stage rectangle.
 */
function rayMaxRadius(angleDeg: number, stageWidth: number, stageHeight: number): number {
  const rad = (angleDeg * Math.PI) / 180;
  const cos = Math.abs(Math.cos(rad));
  const sin = Math.abs(Math.sin(rad));
  const rx = cos > 1e-9 ? (stageWidth / 2 - EDGE_MARGIN_PX) / cos : Infinity;
  const ry = sin > 1e-9 ? (stageHeight / 2 - EDGE_MARGIN_PX) / sin : Infinity;
  return Math.min(rx, ry);
}

function dist(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * Collision-avoided layout for the whole node set (§4.8.3d). Pure and
 * deterministic: nodes are resolved in fnv1a(address) order (same rule as
 * the >14 cap, TZ §7.3), each starting from its hash base placement and
 * probing outward only when a hard guarantee is violated:
 *
 * 1. center exclusion — node center ≥ MIN_CENTER_GAP_PX from the stage
 *    center (the static "you" chip; §4.8.3b);
 * 2. on-canvas — the node hit disk stays inside the stage rect at every
 *    angle (ray-clipped radius, §4.8.3e);
 * 3. no overlap — ≥ MIN_NODE_DIST_PX between every node pair and vs the
 *    reserved «+N» counter slot (§4.8.3d).
 *
 * All constraints are center-distance checks on circular hit areas, so they
 * hold for the whole 90 s spin (nodes rotate as a rigid layer, §4.8.3c —
 * relative distances never change). If no probed position satisfies
 * everything (only possible on absurdly small stages), the candidate with
 * the largest free distance wins — deterministic, never a random layout.
 */
export function layoutRadarNodes(
  entries: readonly RadarNodeInput[],
  stageWidth: number,
  stageHeight: number
): RadarLayoutPoint[] {
  const ordered = [...entries].sort(
    (a, b) => fnv1a(a.address) - fnv1a(b.address) || (a.address < b.address ? -1 : 1)
  );
  const center = { x: stageWidth / 2, y: stageHeight / 2 };
  if (stageWidth <= 0 || stageHeight <= 0) {
    return ordered.map((entry) => {
      const placement = radarPlacement(entry.address, entry.state);
      return { ...placement, address: entry.address, radiusPx: 0, x: center.x, y: center.y };
    });
  }

  // The «+N ещё» counter rides the same rotating layer on the outer ring;
  // reserving its slot here keeps it clear of every node for the whole spin.
  const occupied: Array<{ x: number; y: number }> = [
    nodePosition(moreCounterPlacement(), stageWidth, stageHeight)
  ];

  const points: RadarLayoutPoint[] = [];
  for (const entry of ordered) {
    const placement = radarPlacement(entry.address, entry.state);
    // §4.10.1: the designed ring radius scales against half of the MAX
    // stage dimension (the stage is the max-dimension square); the probe
    // still clips every candidate onto the stage rect (rayMaxRadius), so
    // all guarantees stay relative to the STAGE.
    const baseRadius = placement.radiusFrac * (Math.max(stageWidth, stageHeight) / 2);
    const chosen = resolvePoint(
      entry.address,
      placement,
      baseRadius,
      center,
      stageWidth,
      stageHeight,
      occupied
    );
    occupied.push({ x: chosen.x, y: chosen.y });
    points.push(chosen);
  }
  return points;
}

interface Candidate {
  angle: number;
  radiusPx: number;
  x: number;
  y: number;
}

function resolvePoint(
  address: string,
  placement: RadarPlacement,
  baseRadius: number,
  center: { x: number; y: number },
  stageWidth: number,
  stageHeight: number,
  occupied: ReadonlyArray<{ x: number; y: number }>
): RadarLayoutPoint {
  let best: Candidate | null = null;
  let bestScore = -1;
  let fallback: Candidate | null = null;

  for (let step = 0; step <= PROBE_STEPS; step += 1) {
    for (const sign of step === 0 ? [1] : [1, -1]) {
      const angle = (placement.angle + sign * step * PROBE_STEP_DEG + 360) % 360;
      const maxR = rayMaxRadius(angle, stageWidth, stageHeight);
      if (maxR < MIN_CENTER_GAP_PX) continue; // no usable annulus at this angle
      const designed = Math.min(Math.max(baseRadius, MIN_CENTER_GAP_PX), maxR);
      // Preference order: the designed (ring) radius, then the outer edge
      // (most free room), then the inner exclusion edge.
      const radii = [designed, maxR, MIN_CENTER_GAP_PX];
      const rad = (angle * Math.PI) / 180;
      for (const radiusPx of radii) {
        const candidate: Candidate = {
          angle,
          radiusPx,
          x: center.x + Math.cos(rad) * radiusPx,
          y: center.y + Math.sin(rad) * radiusPx
        };
        let score = Infinity;
        for (const other of occupied) {
          const d = dist(candidate, other);
          if (d < score) score = d;
        }
        if (score >= MIN_NODE_DIST_PX) {
          return { address, ring: placement.ring, angle, radiusPx, x: candidate.x, y: candidate.y };
        }
        if (score > bestScore) {
          bestScore = score;
          best = candidate;
        }
      }
      if (step === 0 && fallback === null) {
        const degenerateRadius = Math.max(0, Math.min(baseRadius, maxR));
        fallback = {
          angle,
          radiusPx: degenerateRadius,
          x: center.x + Math.cos(rad) * degenerateRadius,
          y: center.y + Math.sin(rad) * degenerateRadius
        };
      }
    }
  }

  // No fully clear probed spot: take the candidate with the most free
  // distance (deterministic argmax), or the unclamped base placement when
  // not even one angle offered a usable annulus (degenerate stage).
  const winner = best ?? fallback;
  if (!winner) {
    return {
      address,
      ring: placement.ring,
      angle: placement.angle,
      radiusPx: Math.max(0, baseRadius),
      x: center.x,
      y: center.y
    };
  }
  return {
    address,
    ring: placement.ring,
    angle: winner.angle,
    radiusPx: winner.radiusPx,
    x: winner.x,
    y: winner.y
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
