/**
 * "Who am I in this room" persistence (Concept §2): the attendee's room and
 * their user address, kept in localStorage. No accounts/auth in v1.
 */
import { writable } from 'svelte/store';

export interface Identity {
  roomAddress: string;
  userAddress: string;
}

const STORAGE_KEY = 'bleak.identity';

function readStorage(): Identity | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return null;
    const parsed = JSON.parse(raw) as Partial<Identity>;
    if (typeof parsed.roomAddress === 'string' && typeof parsed.userAddress === 'string') {
      return { roomAddress: parsed.roomAddress, userAddress: parsed.userAddress };
    }
  } catch {
    /* corrupted or unavailable storage — treat as anonymous */
  }
  return null;
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

/** Load persisted identity; call once from the root layout. */
export function initIdentity(): void {
  identity.set(readStorage());
}

export function saveIdentity(next: Identity): void {
  identity.set(next);
  writeStorage(next);
}

export function clearIdentity(): void {
  identity.set(null);
  writeStorage(null);
}
