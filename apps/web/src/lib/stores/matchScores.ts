/**
 * Match-score cache (CONCEPT §13.1.4, DESIGN §4.13.4 — owner change
 * request): the /chats list sorts FINISHED chats by their match/v2 score
 * descending, so the client fetches `POST /api/match/v2` per FINISHED pair
 * (the caller passes ITSELF as `first_user_address` with its own persona
 * Bearer — the tz5-01 `matchV2` method) and caches `MatchResult.points`
 * here. Unfinished dialogs are NEVER fetched: the score surface stays
 * bounded to the finished group (no N+1 over active chats).
 *
 * This store mirrors the lastMessage cache pattern (stores/lastMessage.ts):
 *
 * - entries carry the `owner` (the session persona that fetched them) —
 *   entries from a previous persona of the same browser session are
 *   dropped on the next refresh, so a rejoin never sorts with a foreign
 *   persona's scores;
 * - `refreshMatchScores` is the only writer: it skips chats already in
 *   flight (the 4 s poll cadence never piles up requests), swallows
 *   failures (a chat whose score failed keeps its previous entry — the
 *   ordering treats it as unscored until a later tick, no crash) and is
 *   session-local only — no persistence beyond the writable-store pattern
 *   (constraint: no localStorage here).
 */
import { writable } from 'svelte/store';
import type { MatchResult } from '@bleak/api-client';

/** One pair-score request: the chat (cache key) + the v2 body's pair. */
export interface MatchScoreRequest {
  /** Chat address — the cache key (one score per dialog). */
  address: string;
  /** Room address (MatchV2Request.room_address). */
  room: string;
  /** The OTHER participant (second_user_address; the caller is `first`). */
  counterpart: string;
}

export interface MatchScoreEntry {
  /** The session persona (user address) this snapshot belongs to. */
  owner: string;
  /** MatchResult.points — strictly inside (0, 100) for match/v2. */
  points: number;
}

/** Reactive cache: chat address → match-score entry. */
export const matchScores = writable<ReadonlyMap<string, MatchScoreEntry>>(new Map());

/** Chat addresses with a request already running (guards the 4 s cadence). */
const inFlight = new Set<string>();

/**
 * Refresh the cached match scores for the given FINISHED chats, owned by
 * the given session persona. `fetchScore` is injected (the page passes
 * `api.matchV2`) so the cache logic stays independently testable. Resolves
 * when every non-in-flight chat settled; individual failures never throw —
 * they keep the previous entry (or none) in place.
 */
export async function refreshMatchScores(
  requests: readonly MatchScoreRequest[],
  owner: string,
  fetchScore: (request: MatchScoreRequest) => Promise<MatchResult>
): Promise<void> {
  // Drop snapshots owned by a previous persona of this browser session.
  matchScores.update((current) => {
    let stale = false;
    for (const entry of current.values()) {
      if (entry.owner !== owner) {
        stale = true;
        break;
      }
    }
    if (!stale) return current;
    const next = new Map<string, MatchScoreEntry>();
    for (const [address, entry] of current) {
      if (entry.owner === owner) next.set(address, entry);
    }
    return next;
  });

  await Promise.all(
    requests.map(async (request) => {
      if (inFlight.has(request.address)) return; // a fetch for this chat is running
      inFlight.add(request.address);
      try {
        const result = await fetchScore(request);
        matchScores.update((current) => {
          const next = new Map(current);
          next.set(request.address, { owner, points: result.points });
          return next;
        });
      } catch {
        /* best-effort score: keep whatever the cache holds */
      } finally {
        inFlight.delete(request.address);
      }
    })
  );
}
