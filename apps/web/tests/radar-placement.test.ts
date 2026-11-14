/**
 * Radar placement unit tests (TZ-05): determinism (AC 2), exactly-one-ring
 * ring mapping, jitter bounds, pixel conversion and the >14 cap with the
 * LOWEST NUMERIC HASH VALUES ascending rule (TZ §7.3, AC 10).
 */
import { describe, expect, it } from 'vitest';
import { fnv1a } from '../src/lib/avatar/traits';
import {
  MAX_RADAR_NODES,
  RING_FRACTIONS,
  capRadarNodes,
  moreCounterPlacement,
  nodePosition,
  radarPlacement,
  ringFor
} from '../src/lib/room/radar';
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
