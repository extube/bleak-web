/**
 * Summary cache (Concept §18.3, DESIGN §4.15.3.3 — owner microchange):
 * for FINISHED chats the hard-match Summary is fetched LAZILY IN THE
 * BACKGROUND — never blocking the chat open. The client starts the fetch
 * when the chat is known finished (the poll tick that observes `done`,
 * like the lastMessage/matchScores background-cadence pattern) and caches
 * the result per chat here; the sheet reads the cached entry when present
 * and shows the animated loading state while the fetch is pending.
 *
 * This store mirrors the matchScores cache pattern (stores/matchScores.ts,
 * which itself mirrors stores/lastMessage.ts), with one growth: entries are
 * a small state machine (ready / pending / failed) because the sheet renders
 * DIRECTLY from them — loading-while-pending and inline failure + retry are
 * observable cache states, not page-local flags:
 *
 * - entries carry the `owner` (the session persona that fetched them) —
 *   entries from a previous persona of the same browser session are
 *   dropped on the next refresh, so a rejoin never shows a foreign
 *   persona's summary;
 * - `ensureSummary` is the only writer: a `ready` entry is a cache hit
 *   (never re-posted), a `pending` entry is the in-flight guard (the poll
 *   cadence never piles up requests) and a `failed` entry blocks the
 *   background cadence from re-posting aggressively — once-only semantics
 *   stay server-side (200/201 both carry the Summary), so one fetch per
 *   finished chat unless it FAILED; a failed chat re-fetches only through
 *   the sheet's explicit retry affordance (`force: true`);
 * - a 401 classifies as the §2.8 global gate (`failure.gate`) — the page
 *   suppresses the sheet error there (identity is cleared, redirect runs);
 * - caching is session-local only — no persistence beyond the existing
 *   writable-store pattern (constraint: no localStorage here).
 */
import { get, writable } from 'svelte/store';
import { ApiError, NetworkError, type Summary } from '@bleak/api-client';

/** One hard-match request: the chat (cache key) + the body's pair. */
export interface SummaryRequest {
  /** Chat address — the cache key (one Summary per dialog). */
  address: string;
  /** Room address (HardMatchRequest.room_address). */
  room: string;
  /** The OTHER participant (second_user_address; the caller is `first`). */
  counterpart: string;
}

/** Classification of a failed background fetch (the sheet's inline error). */
export interface SummaryFailure {
  kind: 'network' | 'api';
  /** ApiError.message when kind === 'api' (null for network / unknown). */
  message: string | null;
  /** 401 — the §2.8 global gate owns it; the page renders no sheet error. */
  gate: boolean;
}

/**
 * One chat's summary cache state: the fetched Summary (`ready`), the
 * in-flight marker (`pending` — the loading state while summarizing) or
 * the last failure (`failed` — the inline error + retry affordance).
 */
export type SummaryEntry =
  | { status: 'ready'; owner: string; summary: Summary }
  | { status: 'pending'; owner: string }
  | { status: 'failed'; owner: string; failure: SummaryFailure };

/** Reactive cache: chat address → summary entry. */
export const summaries = writable<ReadonlyMap<string, SummaryEntry>>(new Map());

/** Map a thrown cause into the sheet's failure classification. */
export function classifySummaryFailure(cause: unknown): SummaryFailure {
  if (cause instanceof NetworkError) {
    return { kind: 'network', message: null, gate: false };
  }
  if (cause instanceof ApiError) {
    return { kind: 'api', message: cause.message, gate: cause.status === 401 };
  }
  return { kind: 'api', message: cause instanceof Error ? cause.message : null, gate: false };
}

/**
 * Ensure the cached Summary for the given FINISHED chats, owned by the
 * given session persona. `fetchSummary` is injected (the page passes its
 * `api.hardMatch` wrapper) so the cache logic stays independently testable.
 * Cached (`ready`), in-flight (`pending`) and failed entries are skipped —
 * unless `force` retries a failed one — so the background cadence never
 * re-posts aggressively. Never throws; individual failures land as
 * `failed` entries the sheet surfaces inline.
 */
export async function ensureSummary(
  requests: readonly SummaryRequest[],
  owner: string,
  fetchSummary: (request: SummaryRequest) => Promise<Summary>,
  options: { force?: boolean } = {}
): Promise<void> {
  // Drop snapshots owned by a previous persona of this browser session.
  summaries.update((current) => {
    let stale = false;
    for (const entry of current.values()) {
      if (entry.owner !== owner) {
        stale = true;
        break;
      }
    }
    if (!stale) return current;
    const next = new Map<string, SummaryEntry>();
    for (const [address, entry] of current) {
      if (entry.owner === owner) next.set(address, entry);
    }
    return next;
  });

  await Promise.all(
    requests.map(async (request) => {
      const existing = get(summaries).get(request.address);
      if (existing && existing.owner === owner) {
        if (existing.status === 'ready') return; // cache hit — one fetch per chat
        if (existing.status === 'pending') return; // a fetch is running
        if (existing.status === 'failed' && !options.force) return; // no aggressive re-post
      }
      summaries.update((current) => {
        const next = new Map(current);
        next.set(request.address, { status: 'pending', owner });
        return next;
      });
      try {
        const summary = await fetchSummary(request);
        summaries.update((current) => {
          const next = new Map(current);
          next.set(request.address, { status: 'ready', owner, summary });
          return next;
        });
      } catch (cause) {
        summaries.update((current) => {
          const next = new Map(current);
          next.set(request.address, {
            status: 'failed',
            owner,
            failure: classifySummaryFailure(cause)
          });
          return next;
        });
      }
    })
  );
}
