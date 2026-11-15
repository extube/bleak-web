/**
 * "Who am I in this room" persistence (Concept §2; v2: ARCHITECTURE §10.4):
 * the attendee's room, their user address and the persona access token
 * (client-generated raw secret, hashed server-side) live in localStorage
 * under the single key `bleak.identity`. The token is written nowhere else
 * (§10.11 custody rule). No accounts/auth beyond the token.
 */
import { writable } from 'svelte/store';
import { clearMutualCode } from './mutualCode';

export interface Identity {
  roomAddress: string;
  userAddress: string;
  /**
   * v2 persona access token (client-generated, base64url; §10.4/§10.5).
   *
   * Optional at the type level ONLY as a transition shim: the v1 join flow
   * (`lib/components/join/JoinFlow.svelte`) still saves a token-less identity
   * until TZ2-07 rewrites persona creation to generate + send the token.
   * The §10.4 legacy rule still holds — `initIdentity()` drops any persisted
   * identity without a token, so a token-less identity never survives a
   * reload. TZ2-07 tightens this field to required when the join flow ships.
   */
  token?: string;
}

const STORAGE_KEY = 'bleak.identity';

function isValidIdentity(value: Partial<Identity>): value is Identity {
  return (
    typeof value.roomAddress === 'string' &&
    typeof value.userAddress === 'string' &&
    typeof value.token === 'string' &&
    value.token !== ''
  );
}

/**
 * Returns the parsed identity plus a `legacy` marker: a blob that parses but
 * carries no token is a v1 persona (v2 drops it at init, §10.4 — legacy
 * personas predate credentials and are unrecoverable by owner decision).
 */
function readRaw(): { identity: Identity | null; legacy: boolean } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return { identity: null, legacy: false };
    const parsed = JSON.parse(raw) as Partial<Identity>;
    if (isValidIdentity(parsed)) return { identity: parsed, legacy: false };
    if (
      typeof parsed.roomAddress === 'string' &&
      typeof parsed.userAddress === 'string'
    ) {
      // Parses as a persona reference but has no token → v1 legacy blob.
      return { identity: null, legacy: true };
    }
  } catch {
    /* corrupted or unavailable storage — treated below as no identity */
  }
  return { identity: null, legacy: false };
}

function writeStorage(identity: Identity | null): void {
  try {
    if (identity === null) {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(identity));
    }
  } catch {
    /* ignore */
  }
}

export const identity = writable<Identity | null>(null);

/**
 * Load persisted identity; call once from the root layout (and defensively
 * per guarded route, as v1 does). Semantics (§10.4 legacy drop):
 * - a persisted identity WITH a token is restored as-is;
 * - a persisted v1 identity WITHOUT a token is dropped when no live identity
 *   is held (fresh boot): the store stays null and the stale blob is removed;
 * - when the store already holds a live identity (in-session defensive
 *   re-init on route mounts), the live session is kept untouched — a token-
 *   less identity freshly saved by the v1 join flow must survive until the
 *   next reload (TZ2-07 removes this shim with the v2 join flow);
 * - no blob or corrupted JSON → null (v1 semantics).
 */
export function initIdentity(): void {
  const { identity: persisted, legacy } = readRaw();
  if (persisted !== null) {
    identity.set(persisted);
    return;
  }
  if (legacy) {
    let current: Identity | null = null;
    const unsubscribe = identity.subscribe((value) => {
      current = value;
    });
    unsubscribe();
    if (current === null) {
      // Fresh boot onto a persisted v1 persona: drop it, earlier and quieter
      // than waiting for the first credentialed 401 (§10.4).
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        /* ignore */
      }
    }
    // Live identity held: keep it (in-session re-init; see doc above).
    return;
  }
  identity.set(null);
}

export function saveIdentity(next: Identity): void {
  identity.set(next);
  writeStorage(next);
}

/** Clear the identity — the one-time mutual code is cleared with it (§10.4). */
export function clearIdentity(): void {
  identity.set(null);
  writeStorage(null);
  clearMutualCode();
}
