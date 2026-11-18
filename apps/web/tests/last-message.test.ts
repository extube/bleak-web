/** Last-message cache tests (Concept §10.1.6, DESIGN §4.11.6 — owner
 * decision 2026-11-18): the /chats list preview needs each listed chat's
 * last message; bleak-node has no last-message field, so the client fetches
 * transcripts (`listChatMessages`, light per the owner's cap ruling) into
 * this small session-local store keyed by chat address.
 *
 * Growth reason for a dedicated suite: NEW per-chat transcript cache
 * behavior (lazy fetch of the visible list, in-flight guard, owner scoping,
 * empty-transcript and failure semantics). */
import { beforeEach, describe, expect, it } from 'vitest';
import { get } from 'svelte/store';
import type { Message } from '@bleak/api-client';
import {
  lastMessages,
  refreshLastMessages,
  toLastMessageEntry
} from '../src/lib/stores/lastMessage';

const OWNER = '0xme';

function message(txId: string, content: string, createdAt: string): Message {
  return { tx_id: txId, chat: '0xchat1', from: '0xa', to: '0xme', content, created_at: createdAt };
}

function fakeFetcher(
  transcripts: ReadonlyMap<string, Message[]>,
  calls: { list: string[] }
): (address: string) => Promise<readonly Message[]> {
  return async (address: string) => {
    calls.list.push(address);
    const transcript = transcripts.get(address);
    if (transcript === undefined) throw new Error('not found');
    return transcript;
  };
}

beforeEach(() => {
  lastMessages.set(new Map());
});

describe('toLastMessageEntry', () => {
  it('takes the LAST message of the oldest-first transcript', () => {
    const entry = toLastMessageEntry(
      [message('tx1', 'первое', '2026-01-01T00:00:00Z'), message('tx2', 'второе', '2026-01-01T00:01:00Z')],
      OWNER
    );
    expect(entry).toEqual({
      owner: OWNER,
      content: 'второе',
      from: '0xa',
      created_at: '2026-01-01T00:01:00Z'
    });
  });

  it('an empty transcript (fresh or cleared chat) → no entry', () => {
    expect(toLastMessageEntry([], OWNER)).toBeNull();
  });
});

describe('refreshLastMessages (lazy fetch of the visible list)', () => {
  it('fetches exactly the requested (visible) addresses and caches the last message', async () => {
    const calls = { list: [] as string[] };
    const transcripts = new Map([
      ['0xchat1', [message('tx1', 'привет', '2026-01-01T00:00:00Z')]],
      ['0xchat2', [message('tx2', 'hello', '2026-01-01T00:02:00Z')]]
    ]);
    await refreshLastMessages(['0xchat1', '0xchat2'], OWNER, fakeFetcher(transcripts, calls));
    expect(calls.list.sort()).toEqual(['0xchat1', '0xchat2']);
    const cache = get(lastMessages);
    expect(cache.get('0xchat1')?.content).toBe('привет');
    expect(cache.get('0xchat2')?.content).toBe('hello');
  });

  it('an address left out of the visible list is never fetched', async () => {
    const calls = { list: [] as string[] };
    const transcripts = new Map([['0xchat1', [message('tx1', 'привет', '')]]]);
    await refreshLastMessages(['0xchat1'], OWNER, fakeFetcher(transcripts, calls));
    expect(calls.list).toEqual(['0xchat1']);
    expect(get(lastMessages).has('0xchat9')).toBe(false);
  });

  it('an empty transcript leaves no entry (card renders without preview)', async () => {
    const calls = { list: [] as string[] };
    await refreshLastMessages(['0xchat1'], OWNER, fakeFetcher(new Map([['0xchat1', []]]), calls));
    expect(calls.list).toEqual(['0xchat1']);
    expect(get(lastMessages).has('0xchat1')).toBe(false);
  });

  it('a failed fetch never throws and keeps the previous cached entry', async () => {
    lastMessages.set(
      new Map([
        [
          '0xchat1',
          { owner: OWNER, content: 'старое', from: '0xa', created_at: '2026-01-01T00:00:00Z' }
        ]
      ])
    );
    const failing = async (): Promise<readonly Message[]> => {
      throw new Error('offline');
    };
    await expect(refreshLastMessages(['0xchat1'], OWNER, failing)).resolves.toBeUndefined();
    expect(get(lastMessages).get('0xchat1')?.content).toBe('старое');
  });

  it('a chat already in flight is not re-requested by a concurrent refresh', async () => {
    const calls = { list: [] as string[] };
    let release: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => (release = resolve));
    let invocations = 0;
    const slowFetcher = async (address: string): Promise<readonly Message[]> => {
      invocations += 1;
      calls.list.push(address);
      await gate;
      return [message('tx1', 'привет', '')];
    };
    const first = refreshLastMessages(['0xchat1'], OWNER, slowFetcher);
    const second = refreshLastMessages(['0xchat1'], OWNER, slowFetcher);
    release?.();
    await Promise.all([first, second]);
    // The overlapping second refresh skipped the in-flight address — the
    // 4 s poll cadence never piles up requests for one chat.
    expect(calls.list).toEqual(['0xchat1']);
    expect(invocations).toBe(1);
  });

  it('entries from a previous session persona are dropped on the next refresh', async () => {
    lastMessages.set(
      new Map([
        [
          '0xchat1',
          { owner: '0xprevious', content: 'чужое', from: '0xa', created_at: '' }
        ]
      ])
    );
    const transcripts = new Map([['0xchat2', [message('tx2', 'моё', '')]]]);
    await refreshLastMessages(['0xchat2'], OWNER, fakeFetcher(transcripts, { list: [] }));
    const cache = get(lastMessages);
    expect(cache.has('0xchat1')).toBe(false); // stale foreign preview gone
    expect(cache.get('0xchat2')?.content).toBe('моё');
  });
});
