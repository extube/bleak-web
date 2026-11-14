/** Identity guard (TZ-03): requireIdentityOrRedirect reads the identity
 * store and redirects to `/` when it is null — the shared guard for every
 * attendee page (§1.3). */
import { describe, expect, it, vi } from 'vitest';
import { identity } from '../src/lib/stores/identity';
import { requireIdentityOrRedirect } from '../src/lib/nav/guard';

describe('requireIdentityOrRedirect', () => {
  it('returns true and does not redirect with an identity', () => {
    identity.set({ roomAddress: '0xroom123', userAddress: '0xme' });
    const redirect = vi.fn();
    expect(requireIdentityOrRedirect(redirect)).toBe(true);
    expect(redirect).not.toHaveBeenCalled();
    identity.set(null);
  });

  it('returns false and redirects to / when identity is null', () => {
    identity.set(null);
    const redirect = vi.fn();
    expect(requireIdentityOrRedirect(redirect)).toBe(false);
    expect(redirect).toHaveBeenCalledTimes(1);
  });
});
