/**
 * Shared identity guard (TZ-03): every guarded attendee page calls this from
 * its route script — no group-layout restructure (TZ §2 TZ-03 item 4).
 */
import { get } from 'svelte/store';
import { goto } from '$app/navigation';
import { resolve } from '$app/paths';
import { identity } from '#lib/stores/identity';

/**
 * True when an identity exists; otherwise redirects to `/` (never a dead
 * screen, §1.3) and returns false. `redirect` is injectable for tests.
 */
export function requireIdentityOrRedirect(redirect: () => void = defaultRedirect): boolean {
  if (get(identity) !== null) return true;
  redirect();
  return false;
}

function defaultRedirect(): void {
  void goto(resolve('/'));
}
