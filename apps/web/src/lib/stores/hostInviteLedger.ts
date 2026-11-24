/**
 * Rule-C invite ledger (Concept §54.2-C, DESIGN rev. 4 §3.7.3): the invite
 * list endpoint returns only unexpired + unrevoked codes, so expiry history
 * is device-local. Each room the host operated from THIS device keeps an
 * append-only localStorage ledger under `bleak.hostInvites.<room address>`,
 * recording every mint and revoke response of this device. `merge` pairs the
 * ledger with the server's active list: the server list is authoritative for
 * active codes; ledger entries missing from it render as expired/revoked
 * history. Nothing is recorded on a failed mint/revoke (the caller records
 * only after a successful await; invalid responses are rejected here too).
 * Recorded caveat: codes minted on OTHER devices cannot be reconstructed as
 * expired — they simply vanish from the invite page when they expire.
 */
import type { Invite } from '@bleak/api-client';

/** One ledger row: a mint/revoke record of THIS device. */
export interface LedgerEntry {
  code: string;
  created_at: string;
  expires_at: string;
  revoked_at?: string;
}

/** A history row: a ledger entry missing from the server's active list. */
export type LedgerHistoryEntry = LedgerEntry & {
  classification: 'expired' | 'revoked';
};

export interface InviteLedgerMerge {
  /** The server list, authoritative — passed through unchanged. */
  active: Invite[];
  /** Ledger entries missing from the server list, classified. */
  history: LedgerHistoryEntry[];
}

const LEDGER_KEY_PREFIX = 'bleak.hostInvites.';

/** Injectable clock (unit tests pin the "now" of expiry classification). */
type Clock = () => string;
let clock: Clock = () => new Date().toISOString();

/** Override the ledger clock — returns the previous clock (restorable). */
export function setLedgerClock(next: Clock): Clock {
  const previous = clock;
  clock = next;
  return previous;
}

function ledgerKey(roomAddress: string): string {
  return `${LEDGER_KEY_PREFIX}${roomAddress}`;
}

function isCompleteEntry(value: unknown): value is LedgerEntry {
  if (typeof value !== 'object' || value === null) return false;
  const entry = value as Partial<LedgerEntry>;
  return (
    typeof entry.code === 'string' &&
    entry.code !== '' &&
    typeof entry.created_at === 'string' &&
    entry.created_at !== '' &&
    typeof entry.expires_at === 'string' &&
    entry.expires_at !== ''
  );
}

/** Read one room's ledger (corrupted storage → an empty ledger). */
export function readLedger(roomAddress: string): LedgerEntry[] {
  try {
    const raw = localStorage.getItem(ledgerKey(roomAddress));
    if (raw === null) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isCompleteEntry);
  } catch {
    return [];
  }
}

function writeLedger(roomAddress: string, entries: LedgerEntry[]): void {
  try {
    localStorage.setItem(ledgerKey(roomAddress), JSON.stringify(entries));
  } catch {
    /* storage unavailable — the ledger is best-effort device state */
  }
}

/**
 * A mint response is recordable only when it carries the full Invite shape
 * — a failed/garbage response records NOTHING (rule C guard).
 */
function isInvite(value: unknown): value is Invite {
  if (typeof value !== 'object' || value === null) return false;
  const invite = value as Partial<Invite>;
  return (
    typeof invite.code === 'string' &&
    invite.code !== '' &&
    typeof invite.created_at === 'string' &&
    invite.created_at !== '' &&
    typeof invite.expires_at === 'string' &&
    invite.expires_at !== ''
  );
}

/**
 * The per-room ledger API (Concept §54.2-C). `recordMint(response)`,
 * `recordRevoke(code, at)` and `merge(serverInvites)` operate the
 * `bleak.hostInvites.<room address>` key of the given room.
 */
export interface HostInviteLedger {
  /** Append a successful mint response to the ledger (idempotent per code). */
  recordMint(response: Invite): void;
  /**
   * Stamp a successful revoke: the entry for `code` gains `revoked_at`. A
   * code this device never minted (e.g. revoked from another device of the
   * same room) is appended as a revoked-only entry — the revoke response is
   * still recorded (rule C), it just has no expiry of its own to show.
   */
  recordRevoke(code: string, at?: string): void;
  /**
   * Reconcile the ledger against the server's active list: codes still in
   * the server list are never double-rendered (active is the server list);
   * missing entries are history, classified expired (expires_at past, no
   * revoked_at) or revoked (revoked_at set — or the server omitted an
   * otherwise-live code, which only revocation does).
   */
  merge(serverInvites: Invite[]): InviteLedgerMerge;
  /** Current ledger rows (chronological; append-only storage). */
  entries(): LedgerEntry[];
}

export function hostInviteLedger(roomAddress: string): HostInviteLedger {
  const stamp = (): string => clock();

  return {
    recordMint(response: Invite): void {
      if (!isInvite(response)) return; // failed/garbage mint — record nothing
      const entries = readLedger(roomAddress);
      if (entries.some((entry) => entry.code === response.code)) return; // idempotent
      writeLedger(roomAddress, [
        ...entries,
        {
          code: response.code,
          created_at: response.created_at,
          expires_at: response.expires_at
        }
      ]);
    },

    recordRevoke(code: string, at?: string): void {
      if (code === '') return;
      const when = at ?? stamp();
      const entries = readLedger(roomAddress);
      const index = entries.findIndex((entry) => entry.code === code);
      if (index === -1) {
        // Revoked a code this device has no mint record of: append a
        // revoked-only entry (revocation date is the only known date).
        writeLedger(roomAddress, [
          ...entries,
          { code, created_at: when, expires_at: when, revoked_at: when }
        ]);
        return;
      }
      const existing = entries[index]!;
      if (existing.revoked_at !== undefined) return; // already stamped
      const stamped: LedgerEntry = { ...existing, revoked_at: when };
      writeLedger(roomAddress, [
        ...entries.slice(0, index),
        stamped,
        ...entries.slice(index + 1)
      ]);
    },

    merge(serverInvites: Invite[]): InviteLedgerMerge {
      const now = stamp();
      const serverCodes = new Set(serverInvites.map((invite) => invite.code));
      // Dedupe by code, keeping the row's LATEST state (append-order).
      const byCode = new Map<string, LedgerEntry>();
      for (const entry of readLedger(roomAddress)) byCode.set(entry.code, entry);
      const history: LedgerHistoryEntry[] = [];
      for (const entry of byCode.values()) {
        if (serverCodes.has(entry.code)) continue; // server-active — never double-rendered
        history.push({
          ...entry,
          classification:
            entry.revoked_at !== undefined
              ? 'revoked'
              : entry.expires_at <= now
                ? 'expired'
                : // Missing from the server list while unexpired and unstamped:
                  // the server returns only unexpired+unrevoked codes, so this
                  // code was revoked elsewhere (revocation date unknown here).
                  'revoked'
            }
        );
      }
      return { active: serverInvites, history };
    },

    entries(): LedgerEntry[] {
      return readLedger(roomAddress);
    }
  };
}
