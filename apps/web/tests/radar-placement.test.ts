/**
 * Radar placement unit tests (TZ-05 + §4.8.3 amendment): determinism (AC 2),
 * exactly-one-ring ring mapping, jitter bounds, pixel conversion, the >14
 * cap with the LOWEST NUMERIC HASH VALUES ascending rule (TZ §7.3, AC 10)
 * and the collision-avoided layout: increased "you"-chip distance, no node
 * overlap, on-canvas placement at parametrized phone stage sizes.
 */
import { describe, expect, it } from 'vitest';
import { fnv1a } from '../src/lib/avatar/traits';
import {
  EDGE_MARGIN_PX,
  MAX_RADAR_NODES,
  MIN_CENTER_GAP_PX,
  MIN_NODE_DIST_PX,
  RING_FRACTIONS,
  capRadarNodes,
  layoutRadarNodes,
  moreCounterPlacement,
  nodePosition,
  radarPlacement,
  ringFor
} from '../src/lib/room/radar';
import type { RelationshipState } from '../src/lib/room/relationships';
import type { User } from '@bleak/api-client';

function user(address: string): User {
  return {
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

  it('uses the min dimension when the stage is not square', () => {
    const placement = radarPlacement('0xa', 'chat');
    const pos = nodePosition({ ...placement, angle: 0 }, 800, 200);
    // radius = frac * (min(800,200)/2) = frac * 100 → x = 400 + radius, y = 100
    expect(pos.y).toBe(100);
    expect(pos.x).toBeCloseTo(400 + placement.radiusFrac * 100, 6);
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
    // §4.8.3b: increased minimum distance from the "you" chip (center).
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
    // The increased "you"-chip distance: chip block half-diagonal (~101px)
    // + node hit radius (26px), rounded up.
    expect(MIN_CENTER_GAP_PX).toBeGreaterThanOrEqual(127);
    expect(MIN_NODE_DIST_PX).toBeGreaterThanOrEqual(60);
  });
});
