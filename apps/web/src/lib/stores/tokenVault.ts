/**
 * Device token vault (v2 import flow, ARCHITECTURE §10.4): every persona
 * created on this device (join and import) is appended here with its persona
 * token, keyed `bleak.tokenVault` in localStorage. The vault is APPEND-ONLY:
 * entries are never deleted (a persona deleted server-side keeps its entry —
 * importing it surfaces the server error honestly), and the only in-place
 * mutation is token rotation (`updateVaultEntryToken`), so the vault never
 * holds a dead credential. Consumed by the join flow's vault-driven import
 * (Concept §6.2). Tokens live ONLY in this key (§10.11 custody rule).
 */
import { writable } from 'svelte/store';

export interface VaultEntry {
  roomAddress: string;
  userAddress: string;
  /** Persona access token (client-generated raw secret, hashed server-side). */
  token: string;
  name?: string;
  /** ISO timestamp of when the persona was created on this device. */
  savedAt: string;
}

const STORAGE_KEY = 'bleak.tokenVault';

export const tokenVault = writable<VaultEntry[]>([]);

function isValidEntry(value: Partial<VaultEntry>): value is VaultEntry {
  return (
    typeof value.roomAddress === 'string' &&
    typeof value.userAddress === 'string' &&
    typeof value.token === 'string' &&
    value.token !== '' &&
    typeof value.savedAt === 'string'
  );
}

function readStorage(): VaultEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return [];
    const parsed = JSON.parse(raw) as Partial<VaultEntry>[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidEntry);
  } catch {
    /* corrupted or unavailable storage — start from an empty vault */
    return [];
  }
}

function writeStorage(entries: VaultEntry[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    /* ignore */
  }
}

/** Storage is the source of truth; the store mirrors it for reactivity. */
function syncStore(entries: VaultEntry[]): void {
  tokenVault.set(entries);
}

/** Load the persisted vault into the store (idempotent; storage-first). */
export function initTokenVault(): void {
  syncStore(readStorage());
}

/** Append a persona created on this device (join or import). Never removes. */
export function appendVaultEntry(entry: VaultEntry): void {
  const next = [...readStorage(), entry];
  syncStore(next);
  writeStorage(next);
}

/**
 * Token rotation: rewrite the matching entry's token IN PLACE (keyed by
 * room + user). All other entries (and every other field) are untouched;
 * when nothing matches, this is a no-op — nothing is written.
 */
export function updateVaultEntryToken(
  roomAddress: string,
  userAddress: string,
  token: string
): void {
  const current = readStorage();
  let changed = false;
  const next = current.map((entry) => {
    if (entry.roomAddress === roomAddress && entry.userAddress === userAddress) {
      changed = true;
      return { ...entry, token };
    }
    return entry;
  });
  if (!changed) return;
  syncStore(next);
  writeStorage(next);
}

/** The vault entries, freshly read from storage (and mirrored to the store). */
export function listVaultEntries(): VaultEntry[] {
  const entries = readStorage();
  syncStore(entries);
  return entries;
}
