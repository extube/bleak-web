/**
 * One-time mutual-code persistence (v2 badge QR, ARCHITECTURE §10.4): the raw
 * one-time code backing the personal badge QR lives in localStorage under the
 * single key `bleak.mutualCode`, next to the identity — the server keeps only
 * its SHA-256 hash, so the client must persist the raw code to re-render the
 * QR after a reload. The code is validated against the identity's
 * `userAddress` on load: a mismatched/stale entry is treated as "no code".
 * Cleared with the identity (identity.ts `clearIdentity` calls
 * `clearMutualCode`); never logged, never rendered as text (§10.11 — the raw
 * code is visible only inside the badge QR image).
 */
import { get, writable } from 'svelte/store';
import { identity } from './identity';

export interface MutualCode {
  userAddress: string;
  code: string;
}

const STORAGE_KEY = 'bleak.mutualCode';

export const mutualCode = writable<MutualCode | null>(null);

function readStorage(): MutualCode | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return null;
    const parsed = JSON.parse(raw) as Partial<MutualCode>;
    if (
      typeof parsed.userAddress === 'string' &&
      typeof parsed.code === 'string' &&
      parsed.code !== ''
    ) {
      return { userAddress: parsed.userAddress, code: parsed.code };
    }
  } catch {
    /* corrupted or unavailable storage — treated as no code */
  }
  return null;
}

function writeStorage(entry: MutualCode | null): void {
  try {
    if (entry === null) {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entry));
    }
  } catch {
    /* ignore */
  }
}

/**
 * Load + validate the persisted code against the CURRENT identity. Call after
 * `initIdentity()` (the identity store must be hydrated first).
 *
 * - stored code owned by the current persona → restored;
 * - stored code owned by another persona → dropped AND removed (stale);
 * - stored code with no identity to validate against → store stays null but
 *   the stored blob is kept for a later init (never destroy on missing info);
 * - no stored blob → null.
 */
export function initMutualCode(): void {
  const stored = readStorage();
  if (stored === null) {
    mutualCode.set(null);
    return;
  }
  const me = get(identity);
  if (me === null) {
    // Cannot validate yet — surface no code, keep the blob for a later init.
    mutualCode.set(null);
    return;
  }
  if (stored.userAddress !== me.userAddress) {
    mutualCode.set(null);
    writeStorage(null);
    return;
  }
  mutualCode.set(stored);
}

export function saveMutualCode(userAddress: string, code: string): void {
  const entry: MutualCode = { userAddress, code };
  mutualCode.set(entry);
  writeStorage(entry);
}

export function clearMutualCode(): void {
  mutualCode.set(null);
  writeStorage(null);
}
