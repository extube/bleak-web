/**
 * Rule-A statistics engine (DESIGN rev. 4 §3.7.5 / Concept §54.2-A): the
 * client-side fan-out aggregation run inside the page Poller's every third
 * 5 s tick (⇒ 15 s; §2.2). Bounded concurrency ≤ 4 at BOTH steps;
 * individual branch failures are retried once and then tolerated (the
 * partial-data state). Chats are DEDUPED by address across members before
 * any message fetch (a mutual chat appears under both participants) —
 * exactly ONE message fetch per unique chat, via ONE participant path
 * segment.
 *
 * Metrics 1–4 only (Concept §54.3): M1 — 12 five-minute buckets over the
 * past hour by `message.created_at`; M2 — `listRoomUsers.length`; M3 — the
 * deduped chat count; M4 — active vs finished by `Chat.done` (a kickoff
 * resets `done` server-side, so the next pass simply re-reads it).
 *
 * Metrics 5–7 (handshakes) are rule-B gated (§54.2-B, TZ §9.4.1-c): NOT
 * computed here and NOT rendered by the panel — no locked rows, no zeros,
 * no proxy metric anywhere.
 */
import type { Chat, Message, User } from '@bleak/api-client';
import { bucketize } from '../hostPanel';

export interface HostStats {
  /** M1 — 12 five-minute bucket counts over the past hour (oldest → now). */
  buckets: number[];
  /** M2 — entered users (listRoomUsers.length). */
  members: number;
  /** M3 — deduped chat count. */
  chats: number;
  /** M4 split — `Chat.done` false → active. */
  active: number;
  /** M4 split — `Chat.done` true → finished. */
  finished: number;
  /** M1 total — the chart caption's {n}. */
  total: number;
  /** Some branch failed after its retry — figures may be undercounts. */
  partial: boolean;
}

/** Injectable fetch surface (the page wires hostApi's room-token reads). */
export interface StatsDeps {
  now: number;
  listChats(room: string, address: string): Promise<Chat[]>;
  listMessages(room: string, address: string, chat: string): Promise<Message[]>;
}

/** Branch attempts before a failure counts toward the partial state. */
const BRANCH_ATTEMPTS = 2;
/** Bounded fan-out width (§3.7.5: concurrency ≤ 4 at every step). */
export const STATS_CONCURRENCY = 4;

/** All-zero M1–M4 (the empty-room result — the fan-out is skipped). */
export function emptyStats(): HostStats {
  return {
    buckets: new Array<number>(12).fill(0),
    members: 0,
    chats: 0,
    active: 0,
    finished: 0,
    total: 0,
    partial: false
  };
}

/**
 * Bounded-concurrency map: at most `limit` tasks in flight; a settled slot
 * immediately starts the next task. Results keep the input order.
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  run: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await run(items[index] as T, index);
    }
  });
  await Promise.all(workers);
  return results;
}

/**
 * One fan-out branch with a single retry — a twice-failed branch is
 * dropped and feeds the partial state (§3.7.5 states).
 */
async function withRetry<T>(run: () => Promise<T>): Promise<T | null> {
  for (let attempt = 0; attempt < BRANCH_ATTEMPTS; attempt += 1) {
    try {
      return await run();
    } catch {
      /* tolerated — retried, then dropped (partial metrics) */
    }
  }
  return null;
}

/**
 * One statistics pass (§3.7.5 engine steps): member list (the caller's
 * 5 s poll snapshot — never re-fetched) → per-member chat listings →
 * dedupe by chat address → one message fetch per unique chat → M1–M4.
 */
export async function runStatsPass(
  room: string,
  members: readonly User[],
  deps: StatsDeps
): Promise<HostStats> {
  // Empty room: the engine skips the fan-out entirely (§3.7.5 states).
  if (members.length === 0) return emptyStats();

  // Step 2 — per-member chat listings (room token), bounded, tolerant.
  const listings = await mapWithConcurrency(members, STATS_CONCURRENCY, (member) =>
    withRetry(() => deps.listChats(room, member.address))
  );
  let partial = listings.some((listing) => listing === null);

  // Step 3 — dedupe chats by address across members before any fetch.
  const unique = new Map<string, Chat>();
  for (const listing of listings) {
    for (const chat of listing ?? []) {
      if (!unique.has(chat.address)) unique.set(chat.address, chat);
    }
  }
  const chats = [...unique.values()];

  // Step 4 — one message fetch per unique chat via ONE participant path
  // segment (the chat's first participant), bounded, tolerant.
  const messageLists = await mapWithConcurrency(chats, STATS_CONCURRENCY, (chat) => {
    const participant = chat.participants[0]?.user ?? '';
    return withRetry(() => deps.listMessages(room, participant, chat.address));
  });
  partial = partial || messageLists.some((fetched) => fetched === null);

  const buckets = bucketize(
    messageLists.flatMap((fetched) => (fetched ?? []).map((message) => message.created_at)),
    deps.now
  );
  const active = chats.filter((chat) => !chat.done).length;
  const finished = chats.length - active;
  const total = buckets.reduce((sum, n) => sum + n, 0);
  return { buckets, members: members.length, chats: chats.length, active, finished, total, partial };
}
