/**
 * Local contact card + shared-pair marks (DESIGN §4.13.3 item 3, Concept
 * §13.1.3): the contact card is a CLIENT-LOCAL field — the backend has NO
 * user field for it. One free-text string (≤255 symbols, e.g.
 * "telegram: @handle") per persona, persisted per room|user under
 * `bleak.contactCard` — the same scope mapping as the interests mirror
 * (stores/interests.ts). The card content is composed into
 * `POST /api/contact`; the 1..255 cap mirrors the server MaxContactContentLen
 * and matches the tz5-01 client pre-flight (`ValidationError`).
 *
 * The second small store marks the pairs this persona has ALREADY shared
 * its card with: `bleak.contactShared`, scope room|user (me) → counterpart
 * → the ISO time of the share. The slide control reads it to land in the
 * shared state after a 201 or a 409 — the SERVER truth is the 409 (once
 * per pair), so any later 409 is treated as "already shared", never an
 * error; a local mark is a per-device convenience, not authority.
 */

/** Client-side mirror of the server's 1..255-symbol content cap. */
export const MAX_CONTACT_CARD = 255;

const CARD_KEY = 'bleak.contactCard';
const SHARED_KEY = 'bleak.contactShared';

/** Card map: `${roomAddress}|${userAddress}` → the persona's card text. */
type CardMap = Record<string, string>;

/** Shared marks: `${roomAddress}|${myUserAddress}` → counterpart → ISO time. */
type SharedMap = Record<string, Record<string, string>>;

function scopeKey(room: string, user: string): string {
  return `${room}|${user}`;
}

function readMap<T>(key: string): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return {} as T;
    const parsed: unknown = JSON.parse(raw);
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {} as T;
    }
    return parsed as T;
  } catch {
    /* corrupted or unavailable storage — treat as empty */
    return {} as T;
  }
}

function writeMap(key: string, map: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

// --- contact card -----------------------------------------------------------

/** The persona's stored card text (empty string when none). */
export function loadContactCard(room: string, user: string): string {
  return readMap<CardMap>(CARD_KEY)[scopeKey(room, user)] ?? '';
}

/**
 * Persist the card text: trimmed, clamped to the 255-symbol cap (a longer
 * value can never be shared — the tz5-01 pre-flight would throw). Returns
 * the stored text.
 */
export function saveContactCard(room: string, user: string, text: string): string {
  const next = text.trim().slice(0, MAX_CONTACT_CARD);
  const map = readMap<CardMap>(CARD_KEY);
  const scope = scopeKey(room, user);
  if (next === '') delete map[scope];
  else map[scope] = next;
  writeMap(CARD_KEY, map);
  return next;
}

/** Remove one persona's card (used by tests; a persona keeps its card). */
export function clearContactCard(room: string, user: string): void {
  const map = readMap<CardMap>(CARD_KEY);
  delete map[scopeKey(room, user)];
  writeMap(CARD_KEY, map);
}

// --- shared-pair marks --------------------------------------------------------

/**
 * The counterparts this persona has already shared its card with, in this
 * room (a Set of addresses; empty when none).
 */
export function loadSharedPairs(room: string, user: string): Set<string> {
  return new Set(Object.keys(readMap<SharedMap>(SHARED_KEY)[scopeKey(room, user)] ?? {}));
}

/** Has the card already been shared with this counterpart (locally marked)? */
export function isPairShared(room: string, user: string, counterpart: string): boolean {
  return loadSharedPairs(room, user).has(counterpart);
}

/** Mark the (me → counterpart) pair as shared (after a 201 or a 409). */
export function markPairShared(room: string, user: string, counterpart: string): void {
  const scope = scopeKey(room, user);
  const map = readMap<SharedMap>(SHARED_KEY);
  const pairs = map[scope] ?? {};
  if (pairs[counterpart] === undefined) pairs[counterpart] = new Date().toISOString();
  map[scope] = pairs;
  writeMap(SHARED_KEY, map);
}

/** Remove one persona's shared marks (used by tests). */
export function clearSharedPairs(room: string, user: string): void {
  const map = readMap<SharedMap>(SHARED_KEY);
  delete map[scopeKey(room, user)];
  writeMap(SHARED_KEY, map);
}
