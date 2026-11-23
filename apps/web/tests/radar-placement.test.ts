/**
 * Radar placement unit tests (TZ-05 + §4.8.3 amendment): determinism (AC 2),
 * exactly-one-ring ring mapping, jitter bounds, pixel conversion, the >14
 * cap with the LOWEST NUMERIC HASH VALUES ascending rule (TZ §7.3, AC 10)
 * and the collision-avoided layout: v2.4 reduced "you"-chip distance (the
 * v2.1 enlarged gap, amended per Concept §10.1.2 / DESIGN §4.11.2), no
 * node overlap, on-canvas placement at parametrized phone stage sizes.
 */
import { describe, expect, it } from 'vitest';
import { fnv1a } from '../src/lib/avatar/traits';
import {
  EDGE_MARGIN_PX,
  MAX_RADAR_NODES,
  MIN_CENTER_GAP_PX,
  MIN_NODE_DIST_PX,
  NODE_AVATAR_PX,
  NODE_HIT_DIAMETER_PX,
  RING_FRACTIONS,
  RING_ORBIT_DURATIONS_S,
  capRadarNodes,
  layoutRadarNodes,
  moreCounterPlacement,
  nodePosition,
  radarPlacement,
  radarStageSize,
  ringFor
} from '../src/lib/room/radar';
import type { RelationshipState } from '../src/lib/room/relationships';
import type { User } from '@bleak/api-client';

function user(address: string): User {
  return {
    active: true,
    address,
    room: '0xroom',
    name: `User ${address}`,
    greeting: '',
    public_bio: '',
    private_bio: '',
    language: 'ru',
    created_at: '',
    updated_at: '',
    deleted_at: null
  };
}

describe('ringFor — exactly one ring per relationship state (§3.2)', () => {
  it('chat → inner ring (0)', () => {
    expect(ringFor('chat')).toBe(0);
  });
  it('incoming and outgoing → middle ring (1)', () => {
    expect(ringFor('incoming')).toBe(1);
    expect(ringFor('outgoing')).toBe(1);
  });
  it('none → outer ring (2)', () => {
    expect(ringFor('none')).toBe(2);
  });
});

describe('radarPlacement — deterministic, stable across polls (AC 2)', () => {
  it('same address + state ⇒ identical placement', () => {
    const a = radarPlacement('0xalice', 'chat');
    const b = radarPlacement('0xalice', 'chat');
    expect(a).toEqual(b);
  });

  it('angle is fnv1a(address) % 360 within 0..359', () => {
    for (const address of ['0xa', '0xbb', '0xchat', '0xvery-long-address-value']) {
      const placement = radarPlacement(address, 'none');
      expect(placement.angle).toBe(fnv1a(address) % 360);
      expect(placement.angle).toBeGreaterThanOrEqual(0);
      expect(placement.angle).toBeLessThanOrEqual(359);
    }
  });

  it('radius stays within the ring base ±6% jitter', () => {
    for (const address of ['0xa', '0xbb', '0xc', '0xd', '0xe', '0xf', '0x10']) {
      for (const state of ['chat', 'outgoing', 'none'] as const) {
        const { ring, radiusFrac } = radarPlacement(address, state);
        const base = RING_FRACTIONS[ring];
        expect(radiusFrac).toBeGreaterThanOrEqual(base * 0.94 - Number.EPSILON);
        expect(radiusFrac).toBeLessThanOrEqual(base * 1.06 + Number.EPSILON);
        expect(radiusFrac).toBeGreaterThan(0);
        expect(radiusFrac).toBeLessThan(1); // always inside the viewport
      }
    }
  });

  it('ring follows the relationship state for the same address', () => {
    expect(radarPlacement('0xalice', 'chat').ring).toBe(0);
    expect(radarPlacement('0xalice', 'outgoing').ring).toBe(1);
    expect(radarPlacement('0xalice', 'incoming').ring).toBe(1);
    expect(radarPlacement('0xalice', 'none').ring).toBe(2);
  });

  it('different addresses spread across angles (not all identical)', () => {
    const angles = new Set(
      Array.from({ length: 30 }, (_, i) => radarPlacement(`0xuser${i}`, 'none').angle)
    );
    expect(angles.size).toBeGreaterThan(10);
  });
});

describe('nodePosition — center + polar offset in stage pixels', () => {
  it('places at the ring radius along the angle', () => {
    const stage = { width: 400, height: 400 };
    const placement = radarPlacement('0xright-angle-or-not', 'none');
    const pos = nodePosition(placement, stage.width, stage.height);
    const radius = placement.radiusFrac * (Math.min(stage.width, stage.height) / 2);
    const rad = (placement.angle * Math.PI) / 180;
    expect(pos.x).toBeCloseTo(200 + Math.cos(rad) * radius, 6);
    expect(pos.y).toBeCloseTo(200 + Math.sin(rad) * radius, 6);
  });

  it('uses HALF OF THE MAX dimension when the stage is not square (§4.10.1)', () => {
    // Concept §9.1.3: the ring diameter equals max(screen-w, screen-h) —
    // the placement math scales against half of the max stage dimension,
    // in BOTH orientations.
    for (const [width, height] of [[320, 640], [640, 320]] as const) {
      const placement = radarPlacement('0xa', 'chat');
      const pos = nodePosition({ ...placement, angle: 0 }, width, height);
      // radius = frac * (max(320,640)/2) = frac * 320
      expect(pos.x - width / 2).toBeCloseTo(placement.radiusFrac * 320, 6);
    }
    const landscape = nodePosition({ ...radarPlacement('0xa', 'chat'), angle: 90 }, 800, 200);
    // radius = frac * (max(800,200)/2) = frac * 400 → y = 100 + frac*400
    expect(landscape.y - 100).toBeCloseTo(radarPlacement('0xa', 'chat').radiusFrac * 400, 6);
  });
});

describe('radarStageSize — stage spans the max viewport dimension (§4.10.1)', () => {
  it.each([
    [320, 640, 'portrait phone 320×640: stage = 640'],
    [640, 320, 'landscape 640×320: stage = 640'],
    [390, 844, 'large portrait phone'],
    [1024, 768, 'landscape tablet'],
    [800, 800, 'already square: stage = 800'],
    [0, 0, 'unmeasured: degenerate 0×0 stage']
  ])('%s', (availWidth, availHeight, label) => {
    const side = Math.max(availWidth, availHeight);
    expect(radarStageSize(availWidth, availHeight), label).toEqual({
      width: side,
      height: side
    });
  });
});

describe('capRadarNodes — 14 lowest numeric hash values ascending (AC 10, TZ §7.3)', () => {
  it('keeps all attendees when ≤ 14, extra = 0', () => {
    const users = Array.from({ length: 14 }, (_, i) => user(`0xu${i}`));
    const { shown, extra } = capRadarNodes(users);
    expect(shown).toHaveLength(14);
    expect(extra).toBe(0);
  });

  it('caps at 14 nodes sorted by numeric hash ascending, extra counted', () => {
    const users = Array.from({ length: 20 }, (_, i) => user(`0xuser-${i}`));
    const { shown, extra } = capRadarNodes(users);
    expect(shown).toHaveLength(MAX_RADAR_NODES);
    expect(extra).toBe(6);
    const expected = [...users].sort((a, b) => fnv1a(a.address) - fnv1a(b.address)).slice(0, 14);
    expect(shown.map((u) => u.address)).toEqual(expected.map((u) => u.address));
    // numeric ascending: each next hash ≥ previous
    for (let i = 1; i < shown.length; i += 1) {
      const prev = shown[i - 1];
      const curr = shown[i];
      if (!prev || !curr) continue;
      expect(fnv1a(curr.address)).toBeGreaterThanOrEqual(fnv1a(prev.address));
    }
  });

  it('is a pure cap — it never mutates the input', () => {
    const users = Array.from({ length: 16 }, (_, i) => user(`0xm${i}`));
    const snapshot = users.map((u) => u.address);
    capRadarNodes(users);
    expect(users.map((u) => u.address)).toEqual(snapshot);
  });
});

describe('moreCounterPlacement — stable outer-ring position for «+N ещё»', () => {
  it('is deterministic and sits on the outer ring', () => {
    expect(moreCounterPlacement()).toEqual(moreCounterPlacement());
    expect(moreCounterPlacement().ring).toBe(2);
  });
});

describe('RING_FRACTIONS — §4.8.3 scaled-up inner rings', () => {
  it('inner ring clears the enlarged "you"-chip exclusion zone', () => {
    // The old 0.28 inner ring sat inside the chip on phone stages; the
    // amendment scales the rings up so the inner ring starts outside.
    expect(RING_FRACTIONS[0]).toBeGreaterThan(0.5);
    expect(RING_FRACTIONS[1]).toBeGreaterThan(RING_FRACTIONS[0]);
    expect(RING_FRACTIONS[2]).toBeGreaterThan(RING_FRACTIONS[1]);
  });
});

describe('RING_ORBIT_DURATIONS_S / sizes — v3 tuning (§13.1.6, §4.13.6)', () => {
  it('durations slowed ×1.5 with the per-ring differences preserved exactly', () => {
    // v2.2 owner example was 60/90/20; v3 scales every ring ×1.5 — ring 1
    // still fastest, ring 2 still a bit slower, ring 3 still very fast.
    expect(RING_ORBIT_DURATIONS_S[0]).toBe(90);
    expect(RING_ORBIT_DURATIONS_S[1]).toBe(135);
    expect(RING_ORBIT_DURATIONS_S[2]).toBe(30);
    expect(RING_ORBIT_DURATIONS_S[1] / RING_ORBIT_DURATIONS_S[0]).toBeCloseTo(1.5, 9);
    expect(RING_ORBIT_DURATIONS_S[0] / RING_ORBIT_DURATIONS_S[2]).toBeCloseTo(3, 9);
    // distinct speeds per ring
    expect(new Set(RING_ORBIT_DURATIONS_S).size).toBe(3);
  });

  it('node icon a little smaller, hit areas stay ≥ the 48px touch target (§2.6)', () => {
    expect(NODE_AVATAR_PX).toBe(40); // was 44
    // circular button = avatar + 2×4px padding
    expect(NODE_HIT_DIAMETER_PX).toBe(NODE_AVATAR_PX + 8);
    expect(NODE_HIT_DIAMETER_PX).toBeGreaterThanOrEqual(48);
    expect(MIN_NODE_DIST_PX).toBe(NODE_HIT_DIAMETER_PX + 8);
  });
});

/**
 * Parametrized stage sizes (§4.8.3e): the smallest phone stage first —
 * placement must stay non-overlapping and on-canvas at 320px width.
 */
const STAGES: ReadonlyArray<readonly [number, number, string]> = [
  [320, 480, 'smallest phone'],
  [360, 640, 'phone'],
  [390, 844, 'large phone'],
  [480, 800, 'tall portrait'],
  [768, 1024, 'tablet']
];

const STATES: readonly RelationshipState[] = ['chat', 'outgoing', 'incoming', 'none'];

function entries(count: number, stateOf: (i: number) => RelationshipState = () => 'none') {
  return Array.from({ length: count }, (_, i) => ({ address: `0xuser-${i}`, state: stateOf(i) }));
}

function mixedStates(i: number): RelationshipState {
  return STATES[i % STATES.length] as RelationshipState;
}

function assertInvariants(
  points: ReturnType<typeof layoutRadarNodes>,
  stageWidth: number,
  stageHeight: number
): void {
  const cx = stageWidth / 2;
  const cy = stageHeight / 2;
  for (const point of points) {
    // §4.8.3b as reduced in v2.4 (Concept §10.1.2, DESIGN §4.11.2):
    // minimum distance from the "you" chip (center).
    const gap = Math.hypot(point.x - cx, point.y - cy);
    expect(gap).toBeGreaterThanOrEqual(MIN_CENTER_GAP_PX - 1e-9);
    // §4.8.3e: the node hit disk stays fully on-canvas.
    expect(Math.abs(point.x - cx)).toBeLessThanOrEqual(stageWidth / 2 - EDGE_MARGIN_PX + 1e-9);
    expect(Math.abs(point.y - cy)).toBeLessThanOrEqual(stageHeight / 2 - EDGE_MARGIN_PX + 1e-9);
    // §4.8.3d: distinct hit area vs the reserved «+N ещё» counter slot.
    const more = nodePosition(moreCounterPlacement(), stageWidth, stageHeight);
    expect(Math.hypot(point.x - more.x, point.y - more.y)).toBeGreaterThanOrEqual(
      MIN_NODE_DIST_PX - 1e-9
    );
  }
  for (let i = 0; i < points.length; i += 1) {
    for (let j = i + 1; j < points.length; j += 1) {
      const a = points[i] as (typeof points)[number];
      const b = points[j] as (typeof points)[number];
      expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(MIN_NODE_DIST_PX - 1e-9);
    }
  }
}

describe('layoutRadarNodes — max-dimension stage (§4.10.1, parametrized)', () => {
  /**
   * Concept §9.1.3: the radar spans the LARGER viewport dimension — the
   * page sizes the stage to radarStageSize(w, h) and runs the layout on
   * that square. Both orientations must produce the same square stage and
   * keep every v2.2 guarantee relative to it.
   */
  it.each([
    [320, 640, 'portrait phone 320×640 → stage 640'],
    [640, 320, 'landscape 640×320 → stage 640']
  ])('%s: invariants hold on the square stage', (availWidth, availHeight, label) => {
    const stage = radarStageSize(availWidth, availHeight);
    expect(stage.width, label).toBe(640);
    expect(stage.height, label).toBe(640);
    const points = layoutRadarNodes(entries(14, mixedStates), stage.width, stage.height);
    expect(points, label).toHaveLength(14);
    assertInvariants(points, stage.width, stage.height);
  });

  it('a lone inner-ring node rides its ring measured from HALF OF THE MAX dimension', () => {
    const stage = radarStageSize(320, 640); // portrait phone → 640×640
    const [point] = layoutRadarNodes(
      [{ address: '0xchat-user', state: 'chat' }],
      stage.width,
      stage.height
    );
    if (!point) throw new Error('missing layout point');
    // base = RING_FRACTIONS[0] * (max(320,640)/2) = 0.56 * 320
    const base = RING_FRACTIONS[0] * (Math.max(320, 640) / 2);
    expect(point.radiusPx).toBeGreaterThanOrEqual(base * 0.94 - 1e-9);
    expect(point.radiusPx).toBeLessThanOrEqual(base * 1.06 + 1e-9);
  });
});

describe('layoutRadarNodes — collision-avoided layout (§4.8.3b/d/e)', () => {
  it('guarantees center gap, no overlap and on-canvas at every stage size', () => {
    for (const [width, height, label] of STAGES) {
      const points = layoutRadarNodes(entries(14, mixedStates), width, height);
      expect(points, label).toHaveLength(14);
      assertInvariants(points, width, height);
    }
  });

  it('worst case: 14 same-ring (outer) nodes still never overlap at 320×480', () => {
    const points = layoutRadarNodes(entries(MAX_RADAR_NODES), 320, 480);
    expect(points).toHaveLength(MAX_RADAR_NODES);
    assertInvariants(points, 320, 480);
  });

  it('v3: a node clamped to the inner exclusion edge sits at the 74px gap (§13.1.6)', () => {
    // 0xedge-4: angle 245°, jitter −6% → on the 240×240 stage the inner
    // ring base = 0.56 × 120 × 0.94 ≈ 63.2px — below the exclusion edge,
    // so the layout clamps it to MIN_CENTER_GAP_PX. Under the v2.4 value
    // (88) the same node sat farther out; the collision probing now lets
    // it use the smaller edge while every no-overlap invariant holds.
    const [point] = layoutRadarNodes([{ address: '0xedge-4', state: 'chat' }], 240, 240);
    if (!point) throw new Error('missing layout point');
    expect(point.radiusPx).toBe(MIN_CENTER_GAP_PX);
    expect(Math.hypot(point.x - 120, point.y - 120)).toBeCloseTo(MIN_CENTER_GAP_PX, 6);
    assertInvariants([point], 240, 240);
  });

  it('ring mapping is preserved through the layout pass', () => {
    const points = layoutRadarNodes(entries(8, mixedStates), 390, 844);
    for (const point of points) {
      expect(point.ring).toBe(ringFor(mixedStates(Number(point.address.slice('0xuser-'.length)))));
    }
  });

  it('a lone node rides its ring (no clamp needed when nothing collides)', () => {
    const [point] = layoutRadarNodes([{ address: '0xchat-user', state: 'chat' }], 800, 800);
    if (!point) throw new Error('missing layout point');
    const base = RING_FRACTIONS[0] * 400;
    expect(point.radiusPx).toBeGreaterThanOrEqual(base * 0.94 - 1e-9);
    expect(point.radiusPx).toBeLessThanOrEqual(base * 1.06 + 1e-9);
  });

  it('is deterministic: same data ⇒ identical layout (AC 2)', () => {
    const input = entries(14, mixedStates);
    const a = layoutRadarNodes(input, 360, 640);
    const b = layoutRadarNodes(input, 360, 640);
    expect(a).toEqual(b);
  });

  it('is deterministic regardless of input order (server order changes must not move nodes)', () => {
    const input = entries(14, mixedStates);
    const reversed = [...input].reverse();
    const a = [...layoutRadarNodes(input, 360, 640)].sort((x, y) => x.address.localeCompare(y.address));
    const b = [...layoutRadarNodes(reversed, 360, 640)].sort((x, y) =>
      x.address.localeCompare(y.address)
    );
    expect(a).toEqual(b);
    assertInvariants(a, 360, 640);
  });

  it('empty input → empty layout; zero-size stage → degenerate but defined', () => {
    expect(layoutRadarNodes([], 320, 480)).toEqual([]);
    const degenerate = layoutRadarNodes(entries(3), 0, 0);
    expect(degenerate).toHaveLength(3);
    for (const point of degenerate) {
      expect(point.x).toBe(0);
      expect(point.y).toBe(0);
    }
  });

  it('the cap constants stay intact (§4.8.3 does not change the >14 rule)', () => {
    expect(MAX_RADAR_NODES).toBe(14);
    // v2.4 reduced "you"-chip distance (Concept §10.1.2, DESIGN §4.11.2);
    // v3 closes the gap closer still (Concept §13.1.6, DESIGN §4.13.6):
    // chip's opaque avatar core (64px circle → 32px radius) + node hit
    // radius (24px) + 18px buffer = 74 — the visible avatar (20px radius)
    // keeps a 22px visible gap from the chip's avatar edge; only the
    // transparent hit-padding may graze the name line's outer end. The
    // no-overlap rule stays (hit diameter 48 + 8px gap = 56).
    expect(MIN_CENTER_GAP_PX).toBe(74);
    expect(MIN_CENTER_GAP_PX).toBeLessThan(88); // still closer than v2.4's 88
    expect(MIN_NODE_DIST_PX).toBeGreaterThanOrEqual(56);
  });
});
