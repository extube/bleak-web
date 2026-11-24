/**
 * Identity guard (TZ-03): requireIdentityOrRedirect reads the identity
 * store and redirects to `/` when it is null — the shared guard for every
 * attendee page (§1.3).
 */
import { readFileSync } from 'node:fs';
import { join, sep } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { identity } from '../src/lib/stores/identity';
import { requireIdentityOrRedirect } from '../src/lib/nav/guard';

const WEB_ROOT = process.cwd().endsWith(sep + 'apps' + sep + 'web')
  ? process.cwd()
  : join(process.cwd(), 'apps', 'web');

describe('requireIdentityOrRedirect', () => {
  it('returns true and does not redirect with an identity', () => {
    identity.set({ roomAddress: '0xroom123', userAddress: '0xme', token: 't' });
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

  it('every guarded attendee route (incl. /contacts, §4.14.2) calls the shared guard', () => {
    const guardedRoutes = [
      'src/routes/room/+page.svelte',
      'src/routes/people/+page.svelte',
      'src/routes/contacts/+page.svelte',
      'src/routes/chats/+page.svelte',
      'src/routes/chats/[address]/+page.svelte',
      'src/routes/profile/+page.svelte',
      'src/routes/profile/settings/+page.svelte',
      // v3.23 (DESIGN §4.29.C): the new editing route is guarded too.
      'src/routes/profile/edit/+page.svelte'
    ];
    for (const route of guardedRoutes) {
      const source = readFileSync(join(WEB_ROOT, route), 'utf8');
      expect(source, `${route} must use requireIdentityOrRedirect`).toContain(
        'requireIdentityOrRedirect'
      );
    }
  });
});
