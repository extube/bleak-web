/**
 * Last-message cache (Concept §10.1.6, DESIGN §4.11.6 — owner decision
 * 2026-11-18): the /chats list shows each dialog's LAST MESSAGE preview +
 * its time. bleak-node has no last-message field on the chat, so the client
 * fetches each listed chat's transcript (`listChatMessages` — the messages
 * endpoint; chats are capped ≈26 messages, so the owner ruled the fetch
 * light) and takes the last message.
 *
 * This store is the small per-session cache keyed by the CHAT address:
 *
 * - entries carry the `owner` (the session persona that fetched them) —
 *   entries from a previous persona of the same browser session are dropped
 *   on the next refresh, so a rejoin never shows a stale foreign preview;
 * - `refreshLastMessages` is the only writer: it skips addresses already
 *   in flight (the 4 s poll cadence never piles up requests), swallows
 *   failures (a chat whose transcript failed simply renders without a
 *   preview until a later tick) and treats an EMPTY transcript (fresh chat,
 *   agents not started, or a cleared history) as "no preview yet";
 * - caching is session-local only — no persistence beyond the existing
 *   writable-store pattern (constraint: no localStorage here).
 */
import { writable } from 'svelte/store';
import type { Message } from '@bleak/api-client';

export interface LastMessageEntry {
  /** The session persona (user address) this snapshot belongs to. */
  owner: string;
  /** Content of the last message (≤255 symbols, server-validated). */
  content: string;
  /** Author of the last message (raw address). */
  from: string;
  /** Server timestamp of the last message (ISO string). */
  created_at: string;
}

/** Reactive cache: chat address → last-message entry. */
export const lastMessages = writable<ReadonlyMap<string, LastMessageEntry>>(new Map());

/** Last entry of an oldest-first transcript; empty transcript → null. */
export function toLastMessageEntry(
  messages: readonly Message[],
  owner: string
): LastMessageEntry | null {
  const last = messages[messages.length - 1];
  if (!last) return null;
  return { owner, content: last.content, from: last.from, created_at: last.created_at };
}

/** Addresses with a request already running (guards the 4 s poll cadence). */
const inFlight = new Set<string>();

/**
 * Refresh the cached last messages for the listed (visible) chats, owned by
 * the given session persona. `fetchTranscript` is injected (the page passes
 * `api.listChatMessages`) so the cache logic stays independently testable.
 * Resolves when every non-in-flight address settled; individual failures
 * never throw — they leave the previous entry (or none) in place.
 */
export async function refreshLastMessages(
  addresses: readonly string[],
  owner: string,
  fetchTranscript: (address: string) => Promise<readonly Message[]>
): Promise<void> {
  // Drop snapshots owned by a previous persona of this browser session.
  lastMessages.update((current) => {
    let stale = false;
    for (const entry of current.values()) {
      if (entry.owner !== owner) {
        stale = true;
        break;
      }
    }
    if (!stale) return current;
    const next = new Map<string, LastMessageEntry>();
    for (const [address, entry] of current) {
      if (entry.owner === owner) next.set(address, entry);
    }
    return next;
  });

  await Promise.all(
    addresses.map(async (address) => {
      if (inFlight.has(address)) return; // a fetch for this chat is running
      inFlight.add(address);
      try {
        const entry = toLastMessageEntry(await fetchTranscript(address), owner);
        lastMessages.update((current) => {
          const next = new Map(current);
          if (entry === null) next.delete(address);
          else next.set(address, entry);
          return next;
        });
      } catch {
        /* best-effort preview: keep whatever the cache holds */
      } finally {
        inFlight.delete(address);
      }
    })
  );
}
