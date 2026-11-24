/** Host-tree PURE helper tests (hostLogic). TZ13-02 restructured the rev. 3
 * single-page console into the §3.7.1 route tree:
 * - the ENTRY-route cases (creation gate, create/store, login probe, resume
 *   probe, finder) moved into `host-entry.test.ts` against the rewritten
 *   `/host` page (TZ §9.4.6);
 * - the panel / invite-management / live-view / drill-down / settings cases
 *   belong to the TZ13-03/TZ13-04 route files (`/host/[room_address]…`),
 *   which re-home them against their own routes;
 * - the route-independent helpers keep their logic assertions here. */
import { describe, expect, it } from 'vitest';

import {
  activeInvites,
  customExpiry,
  expiresIn,
  inviteLink,
  presetExpiry,
  spelledDigits
} from '../src/lib/components/host/hostLogic';

describe('pure helpers (hostLogic v2)', () => {
  it('link/expiry computation: inviteLink, presets, custom validation, digit spelling', () => {
    expect(inviteLink('123456', 'http://localhost:5173')).toBe('http://localhost:5173/?code=123456');
    expect(inviteLink('123456', 'https://bleak.example/app/')).toBe(
      'https://bleak.example/app/?code=123456'
    );
    const now = Date.UTC(2026, 10, 15, 10, 0, 0);
    expect(presetExpiry('1h', now)).toBe(new Date(now + 3_600_000).toISOString());
    expect(presetExpiry('24h', now)).toBe(new Date(now + 24 * 3_600_000).toISOString());
    expect(presetExpiry('7d', now)).toBe(new Date(now + 7 * 24 * 3_600_000).toISOString());
    expect(customExpiry('2026-11-15T09:00', now)).toBeNull();
    expect(customExpiry('not-a-date', now)).toBeNull();
    expect(customExpiry('2026-11-15T12:00', now)).toBe(new Date(Date.UTC(2026, 10, 15, 12, 0)).toISOString());
    expect(expiresIn(new Date(now + 30 * 60_000).toISOString(), now)).toBe('30');
    expect(expiresIn(new Date(now + 5 * 3_600_000).toISOString(), now)).toBe('5');
    expect(expiresIn(new Date(now + 3 * 24 * 3_600_000).toISOString(), now)).toBe('3');
    expect(spelledDigits('123456')).toBe('1 2 3 4 5 6');
  });

  it('activeInvites filters expired codes and sorts newest first (revoked/expired never render)', () => {
    const now = Date.UTC(2026, 10, 15, 10, 0, 0);
    const list = [
      { code: '111111', created_at: new Date(now - 120_000).toISOString(), expires_at: new Date(now - 60_000).toISOString() },
      { code: '222222', created_at: new Date(now - 10_000).toISOString(), expires_at: new Date(now + 60_000).toISOString() },
      { code: '333333', created_at: new Date(now - 5_000).toISOString(), expires_at: new Date(now + 120_000).toISOString() }
    ];
    expect(activeInvites(list, now).map((i) => i.code)).toEqual(['333333', '222222']);
  });
});
