/** Rule-A statistics engine tests (TZ13-03 Part B, DESIGN rev. 4 §3.7.5):
 * bounded fan-out (≤ 4 in flight at every step, mock-queue tracked), the
 * dedupe rule (a mutual chat's messages fetched exactly once, one fetch
 * per unique chat via a participant path segment), M1 bucketing by
 * message.created_at (12 × 5 min over the past hour), the M4 split by
 * Chat.done with the kickoff semantics (a kicked-off chat re-reads as
 * active), branch failures (retry → tolerated → partial), the empty-room
 * skip, and the caller-side diff helpers. NO handshake metrics anywhere
 * (rule B — the engine simply has no handshake surface). */
import { describe, expect, it, vi } from 'vitest';
import type { Chat, Message, User } from '@bleak/api-client';
import {
  emptyStats,
  mapWithConcurrency,
  runStatsPass,
  STATS_CONCURRENCY,
  type StatsDeps
} from '../src/lib/components/host/stats/hostStats';
import {
  bucketIndex,
  bucketize,
  guardRoomAddress,
  isStatsTick,
  peakBucketLabel,
  statsEqual
} from '../src/lib/components/host/hostPanel';

const ROOM = '0xroom';

function member(address: string): User {
  return {
    active: true,
    address,
    room: ROOM,
    name: `M${address}`,
    greeting: '',
    public_bio: '',
    private_bio: '',
    language: 'ru',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    deleted_at: null
  };
}

function chat(address: string, participants: string[], done = false): Chat {
  return {
    address,
    room: ROOM,
    phase: 'networking',
    phase_started_at: new Date().toISOString(),
    scenario: 'ai-future',
    language: 'ru',
    done,
    created_at: new Date().toISOString(),
    participants: participants.map((user) => ({ chat: address, user }))
  };
}

function message(chatAddress: string, minutesAgo: number, now: number): Message {
  return {
    tx_id: `tx-${chatAddress}-${minutesAgo}`,
    chat: chatAddress,
    from: '0xa',
    to: '0xb',
    content: 'привет',
    created_at: new Date(now - minutesAgo * 60_000).toISOString()
  };
}

function deps(overrides: Partial<StatsDeps> & { now: number }): StatsDeps & {
  listChats: ReturnType<typeof vi.fn>;
  listMessages: ReturnType<typeof vi.fn>;
} {
  return {
    listChats: vi.fn(),
    listMessages: vi.fn(),
    ...overrides
  } as StatsDeps & {
    listChats: ReturnType<typeof vi.fn>;
    listMessages: ReturnType<typeof vi.fn>;
  };
}

describe('engine steps: member list → per-member chats → dedupe → messages', () => {
  it('dedupes chats by address across members and fetches each unique chat once', async () => {
    const now = Date.now();
    // A mutual chat (C1) appears under BOTH participants.
    const d = deps({
      now,
      listChats: vi.fn(async (_room: string, address: string) =>
        address === '0xa' ? [chat('0xc1', ['0xa', '0xb']), chat('0xc2', ['0xa'])] : [chat('0xc1', ['0xb', '0xa'])]
      ),
      listMessages: vi.fn(async () => [])
    });
    const result = await runStatsPass(ROOM, [member('0xa'), member('0xb')], d);
    // M3 = the deduped count (2 unique chats, not 3 listings).
    expect(result.chats).toBe(2);
    expect(d.listMessages).toHaveBeenCalledTimes(2);
    // One fetch per unique chat via ONE participant path segment.
    const called = d.listMessages.mock.calls.map((c) => c.join('|')).sort();
    expect(called).toEqual([`${ROOM}|0xa|0xc1`, `${ROOM}|0xa|0xc2`].sort());
  });

  it('keeps fan-out concurrency ≤ 4 at every step (mock queue)', async () => {
    const now = Date.now();
    const members = Array.from({ length: 10 }, (_, i) => member(`0xm${i}`));
    const chatsFor = (address: string) => [chat(`0xc-${address}`, [address])];
    let chatsInFlight = 0;
    let chatsMax = 0;
    let messagesInFlight = 0;
    let messagesMax = 0;
    const d = deps({
      now,
      listChats: vi.fn(async (room: string, address: string) => {
        chatsInFlight += 1;
        chatsMax = Math.max(chatsMax, chatsInFlight);
        await new Promise((resolve) => setTimeout(resolve, 1));
        chatsInFlight -= 1;
        return chatsFor(address);
      }),
      listMessages: vi.fn(async (room: string, address: string, chatAddr: string) => {
        messagesInFlight += 1;
        messagesMax = Math.max(messagesMax, messagesInFlight);
        await new Promise((resolve) => setTimeout(resolve, 1));
        messagesInFlight -= 1;
        return [message(chatAddr, 5, now)];
      })
    });
    const result = await runStatsPass(ROOM, members, d);
    expect(chatsMax).toBeLessThanOrEqual(4);
    expect(messagesMax).toBeLessThanOrEqual(4);
    // AND actually parallel (the queue is bounded, not serial).
    expect(chatsMax).toBe(4);
    expect(messagesMax).toBe(4);
    expect(result.chats).toBe(10);
    expect(STATS_CONCURRENCY).toBe(4);
  });
});

describe('M1 bucketing (12 × 5 min over the past hour)', () => {
  it('buckets by created_at: newest bucket = now, oldest = 60…55 min ago, outside the hour excluded', () => {
    const now = Date.parse('2026-11-24T12:00:00Z');
    expect(bucketIndex(new Date(now - 0).toISOString(), now)).toBe(11);
    expect(bucketIndex(new Date(now - 4 * 60_000).toISOString(), now)).toBe(11);
    expect(bucketIndex(new Date(now - 5 * 60_000).toISOString(), now)).toBe(10);
    expect(bucketIndex(new Date(now - 55 * 60_000).toISOString(), now)).toBe(0);
    expect(bucketIndex(new Date(now - 60 * 60_000).toISOString(), now)).toBe(-1);
    // Clock skew into the future lands in «сейчас».
    expect(bucketIndex(new Date(now + 10 * 60_000).toISOString(), now)).toBe(11);

    const buckets = bucketize(
      [
        new Date(now - 1 * 60_000).toISOString(),
        new Date(now - 2 * 60_000).toISOString(),
        new Date(now - 57 * 60_000).toISOString(),
        new Date(now - 90 * 60_000).toISOString()
      ],
      now
    );
    expect(buckets).toEqual([1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2]);
  });

  it('M1 renders from message fetches; total = the bucket sum', async () => {
    const now = Date.now();
    const d = deps({
      now,
      listChats: vi.fn(async () => [chat('0xc1', ['0xa'])]),
      listMessages: vi.fn(async () => [message('0xc1', 2, now), message('0xc1', 30, now)])
    });
    const result = await runStatsPass(ROOM, [member('0xa')], d);
    expect(result.total).toBe(2);
    expect(result.buckets[11]).toBe(1);
    expect(result.buckets[5]).toBe(1);
    expect(result.members).toBe(1);
  });
});

describe('M4 split by Chat.done + kickoff semantics', () => {
  it('splits active vs finished by Chat.done (missing done = active)', async () => {
    const now = Date.now();
    const doneChat = chat('0xc1', ['0xa'], true);
    const doneOptional = { ...chat('0xc2', ['0xa']), done: undefined };
    const d = deps({
      now,
      listChats: vi.fn(async () => [doneChat, doneOptional]),
      listMessages: vi.fn(async () => [])
    });
    const result = await runStatsPass(ROOM, [member('0xa')], d);
    expect(result.chats).toBe(2);
    expect(result.active).toBe(1);
    expect(result.finished).toBe(1);
  });

  it('kickoff resets a chat to active: the next pass re-reads done=false', async () => {
    const now = Date.now();
    let done = true; // finished before the kickoff
    const d = deps({
      now,
      listChats: vi.fn(async () => [chat('0xc1', ['0xa'], done)]),
      listMessages: vi.fn(async () => [])
    });
    const before = await runStatsPass(ROOM, [member('0xa')], d);
    expect(before.finished).toBe(1);
    expect(before.active).toBe(0);
    // The host drill-down kickoff (server-side reset) happened:
    done = false;
    const after = await runStatsPass(ROOM, [member('0xa')], d);
    expect(after.active).toBe(1);
    expect(after.finished).toBe(0);
  });
});

describe('partial + empty states', () => {
  it('a twice-failed branch is tolerated: subset metrics + partial=true', async () => {
    const now = Date.now();
    const d = deps({
      now,
      listChats: vi.fn(async (_room: string, address: string) => {
        if (address === '0xbad') throw new Error('boom');
        return [chat('0xc1', ['0xa'])];
      }),
      listMessages: vi.fn(async () => [])
    });
    const result = await runStatsPass(ROOM, [member('0xa'), member('0xbad')], d);
    expect(result.partial).toBe(true);
    expect(result.chats).toBe(1); // the fetched subset
    // The failed branch was retried (2 attempts), not silently skipped.
    expect(d.listChats).toHaveBeenCalledTimes(3);
  });

  it('a branch failing once succeeds on its retry: no partial flag', async () => {
    const now = Date.now();
    let failed = false;
    const d = deps({
      now,
      listChats: vi.fn(async () => {
        if (!failed) {
          failed = true;
          throw new Error('transient');
        }
        return [chat('0xc1', ['0xa'])];
      }),
      listMessages: vi.fn(async () => [])
    });
    const result = await runStatsPass(ROOM, [member('0xa')], d);
    expect(result.partial).toBe(false);
    expect(result.chats).toBe(1);
  });

  it('a failed message branch marks partial; message totals become undercounts', async () => {
    const now = Date.now();
    const d = deps({
      now,
      listChats: vi.fn(async () => [chat('0xc1', ['0xa']), chat('0xc2', ['0xa'])]),
      listMessages: vi.fn(async (_room: string, _a: string, chatAddr: string) => {
        if (chatAddr === '0xc2') throw new Error('boom');
        return [message(chatAddr, 3, now)];
      })
    });
    const result = await runStatsPass(ROOM, [member('0xa')], d);
    expect(result.partial).toBe(true);
    expect(result.total).toBe(1);
  });

  it('empty room: the engine skips the fan-out entirely (zero stats, zero calls)', async () => {
    const d = deps({ now: Date.now(), listChats: vi.fn(), listMessages: vi.fn() });
    const result = await runStatsPass(ROOM, [], d);
    expect(result).toEqual(emptyStats());
    expect(d.listChats).not.toHaveBeenCalled();
    expect(d.listMessages).not.toHaveBeenCalled();
  });
});

describe('caller-side helpers (hostPanel)', () => {
  it('isStatsTick: every third 5 s Poller tick (⇒ 15 s cadence)', () => {
    expect(isStatsTick(0)).toBe(true);
    expect(isStatsTick(1)).toBe(false);
    expect(isStatsTick(2)).toBe(false);
    expect(isStatsTick(3)).toBe(true);
    expect(isStatsTick(6)).toBe(true);
    expect(isStatsTick(7)).toBe(false);
  });

  it('guardRoomAddress: stored room must exist and match the URL param', () => {
    expect(guardRoomAddress({ roomAddress: '0xroom' }, '0xroom')).toBe(true);
    expect(guardRoomAddress({ roomAddress: '0xroom' }, '0xother')).toBe(false);
    expect(guardRoomAddress({ roomAddress: '0xroom' }, undefined)).toBe(false);
    expect(guardRoomAddress(null, '0xroom')).toBe(false);
  });

  it('statsEqual: identical stats compare equal (identical ticks never re-render)', () => {
    const a = { ...emptyStats(), members: 2, chats: 1, active: 1 };
    const b = { ...emptyStats(), members: 2, chats: 1, active: 1 };
    expect(statsEqual(a, b)).toBe(true);
    expect(statsEqual(null, null)).toBe(true);
    expect(statsEqual(null, a)).toBe(false);
    const c = { ...b, buckets: [...b.buckets.slice(0, 11), 1] };
    expect(statsEqual(a, c)).toBe(false);
    const d2 = { ...b, partial: true };
    expect(statsEqual(a, d2)).toBe(false);
  });

  it('peakBucketLabel: the peak bucket maps to its relative axis label', () => {
    const labels: [string, string, string, string, string] = ['−60 мин', '−45 мин', '−30 мин', '−15 мин', 'сейчас'];
    const buckets = new Array<number>(12).fill(0);
    buckets[0] = 5; // oldest bucket → «−60 мин»
    expect(peakBucketLabel(buckets, labels)).toBe('−60 мин');
    const mid = new Array<number>(12).fill(0);
    mid[3] = 2;
    mid[9] = 7; // peak → «−15 мин»
    expect(peakBucketLabel(mid, labels)).toBe('−15 мин');
    const newest = new Array<number>(12).fill(0);
    newest[11] = 3; // → «сейчас»
    expect(peakBucketLabel(newest, labels)).toBe('сейчас');
  });
});

describe('mapWithConcurrency (bounded queue primitive)', () => {
  it('runs at most `limit` tasks in flight and preserves input order', async () => {
    let inFlight = 0;
    let max = 0;
    const result = await mapWithConcurrency(
      [1, 2, 3, 4, 5, 6, 7],
      3,
      async (n: number) => {
        inFlight += 1;
        max = Math.max(max, inFlight);
        await new Promise((resolve) => setTimeout(resolve, 1));
        inFlight -= 1;
        return n * 2;
      }
    );
    expect(max).toBeLessThanOrEqual(3);
    expect(max).toBe(3);
    expect(result).toEqual([2, 4, 6, 8, 10, 12, 14]);
  });

  it('handles an empty list and a limit larger than the list', async () => {
    expect(await mapWithConcurrency([], 4, async (n: number) => n)).toEqual([]);
    expect(await mapWithConcurrency([1, 2], 4, async (n: number) => n + 1)).toEqual([2, 3]);
  });
});
