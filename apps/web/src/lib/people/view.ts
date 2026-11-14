/**
 * People-list view logic (TZ-06, DESIGN §3.3) — pure and unit-tested.
 * Search, filter chips, stable roster ordering, poll diffing, relative
 * timestamps and the incoming-request dismissal rule.
 *
 * Owner ruling 2 (Concept §1c): a handshake is never "declined". Dismiss is a
 * LOCAL collapse only — nothing is sent to the server; the request still
 * exists there and the card becomes actionable again when a NEWER incoming
 * handshake arrives or on page re-entry (the dismissal map is component
 * state, per page visit).
 */
import type { User } from '@bleak/api-client';
import type { Relationship, RelationshipState } from '#lib/room/relationships';

export type PeopleFilter = 'all' | 'sent' | 'added' | 'chatting';

/** True when the relationship state matches the selected filter chip (§3.3). */
export function matchesFilter(state: RelationshipState, filter: PeopleFilter): boolean {
  switch (filter) {
    case 'all':
      return true;
    case 'sent':
      return state === 'outgoing';
    case 'added':
      return state === 'incoming';
    case 'chatting':
      return state === 'chat';
  }
}

/** Case-insensitive client-side search over `name` and `public_bio` (§3.3). */
export function matchesQuery(user: User, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (q === '') return true;
  return user.name.toLowerCase().includes(q) || user.public_bio.toLowerCase().includes(q);
}

function timestampAt(iso: string): number {
  const at = Date.parse(iso);
  return Number.isFinite(at) ? at : 0;
}

/**
 * Stable roster order: newest `User.created_at` first (§3.3 item 4). The
 * order is computed once per data change that actually differs — never
 * reordered on an identical poll. Deduplicates by address (keyed each): no
 * duplicate cards ever render (§3.3 AC 8).
 */
export function stableRoster(users: readonly User[]): User[] {
  const byAddress = new Map<string, User>();
  for (const user of users) byAddress.set(user.address, user);
  return [...byAddress.values()].sort(
    (a, b) => timestampAt(b.created_at) - timestampAt(a.created_at)
  );
}

/**
 * Poll diff for the roster: when the incoming snapshot has the same address
 * sequence as the current one, the current (already stable-sorted) array
 * reference is returned so Svelte's keyed each does not re-diff anything.
 */
export function mergeRoster(
  current: readonly User[],
  incoming: readonly User[]
): readonly User[] {
  if (current.length !== incoming.length) return stableRoster(incoming);
  for (let i = 0; i < incoming.length; i += 1) {
    if (incoming[i]?.address !== current[i]?.address) return stableRoster(incoming);
  }
  return current;
}

/** Muted relative time («2 мин» / "2 min", §3.3) — minute/hour/day buckets. */
export function relativeTime(iso: string, now: number, locale: 'ru' | 'en'): string {
  const diff = Math.max(0, now - timestampAt(iso));
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return locale === 'ru' ? '1 мин' : '1 min';
  if (minutes < 60) return locale === 'ru' ? `${minutes} мин` : `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return locale === 'ru' ? `${hours} ч` : `${hours} h`;
  const days = Math.floor(hours / 24);
  return locale === 'ru' ? `${days} д` : `${days} d`;
}

/**
 * Dismissal rule (ruling 2): the map holds address → `incomingAt` recorded
 * at dismiss time. A card stays dismissed while the relationship is still
 * the SAME incoming request; it re-expands when a newer incoming handshake
 * arrives (`incomingAt` moves past the recorded one) or when the state
 * changes at all (dismissal only ever applies to incoming cards).
 */
export function isDismissed(
  dismissals: ReadonlyMap<string, string>,
  relationship: Relationship
): boolean {
  const recordedAt = dismissals.get(relationship.user);
  if (recordedAt === undefined) return false;
  if (relationship.state !== 'incoming') return false;
  if (relationship.incomingAt === null) return true;
  return relationship.incomingAt <= recordedAt;
}
