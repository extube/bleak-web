/** Match-score cache tests (CONCEPT §13.1.4, DESIGN §4.13.4): the
 * session-scoped score cache behind the score-first /chats ordering —
 * entries keyed by chat address with the owner-persona stamp
 * (MatchResult.points is the sort key), the in-flight guard against the
 * 4 s poll cadence, failure tolerance (the previous entry kept, never
 * throws), and the stale-persona drop — the same cache semantics as the
 * lastMessage store (stores/lastMessage.ts). */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { get } from 'svelte/store';
import type { MatchResult } from '@bleak/api-client';
import {
  matchScores,
  refreshMatchScores,
  type MatchScoreRequest
} from '../src/lib/stores/matchScores';

const result = (points: number): MatchResult => ({
  points,
  exact_interest_matches: 0,
  shared_groups: 0,
  handshake: false,
  mutual_handshake: false
});

const request = (address: string, counterpart = '0xa'): MatchScoreRequest => ({
  address,
  room: '0xroom',
  counterpart
});

beforeEach(() => {
  matchScores.set(new Map());
});

describe('refreshMatchScores (DESIGN §4.13.4 — the score cache)', () => {
  it('caches MatchResult.points under the chat address, stamped with the owner persona', async () => {
    await refreshMatchScores([request('0xchat1')], '0xme', async () => result(87.5));
    const entry = get(matchScores).get('0xchat1');
    expect(entry).toEqual({ owner: '0xme', points: 87.5 });
  });

  it('skips chats already in flight — the poll cadence never piles up requests', async () => {
    let releaseFetch: ((value: MatchResult) => void) | undefined;
    const fetchScore = vi.fn(
      () =>
        new Promise<MatchResult>((resolve) => {
          releaseFetch = resolve;
        })
    );

    const first = refreshMatchScores([request('0xchat1')], '0xme', fetchScore);
    const second = refreshMatchScores([request('0xchat1')], '0xme', fetchScore);
    releaseFetch?.(result(60));
    await Promise.all([first, second]);

    expect(fetchScore).toHaveBeenCalledTimes(1);
    expect(get(matchScores).get('0xchat1')?.points).toBe(60);
  });

  it('a failing fetch keeps the previous entry in place and never throws', async () => {
    await refreshMatchScores([request('0xchat1')], '0xme', async () => result(42));
    await refreshMatchScores(
      [request('0xchat1'), request('0xchat2')],
      '0xme',
      (req) =>
        req.address === '0xchat1'
          ? Promise.reject(new Error('network down'))
          : Promise.resolve(result(70))
    );
    const cache = get(matchScores);
    // the failed chat keeps its stale-but-honest previous score…
    expect(cache.get('0xchat1')).toEqual({ owner: '0xme', points: 42 });
    // …the fresh success lands.
    expect(cache.get('0xchat2')).toEqual({ owner: '0xme', points: 70 });
  });

  it('a failed FIRST fetch caches nothing (the chat renders unscored)', async () => {
    await refreshMatchScores([request('0xchat1')], '0xme', async () => {
      throw new Error('offline');
    });
    expect(get(matchScores).get('0xchat1')).toBeUndefined();
  });

  it('drops snapshots owned by a previous persona of the same browser session', async () => {
    await refreshMatchScores([request('0xchat1')], '0xold', async () => result(50));
    await refreshMatchScores([request('0xchat2')], '0xme', async () => result(80));
    const cache = get(matchScores);
    expect(cache.get('0xchat1')).toBeUndefined(); // foreign persona's score dropped
    expect(cache.get('0xchat2')).toEqual({ owner: '0xme', points: 80 });
  });

  it('an empty request list still performs the stale-persona sweep', async () => {
    await refreshMatchScores([request('0xchat1')], '0xold', async () => result(50));
    await refreshMatchScores([], '0xme', async () => result(1));
    expect(get(matchScores).size).toBe(0);
  });

  it('resolves only when every non-in-flight chat settled (individual failures included)', async () => {
    const fetchScore = vi.fn<(request: MatchScoreRequest) => Promise<MatchResult>>(
      (req: MatchScoreRequest) =>
        req.address === '0xchat1' ? Promise.reject(new Error('x')) : Promise.resolve(result(10))
    );
    await expect(
      refreshMatchScores([request('0xchat1'), request('0xchat2')], '0xme', fetchScore)
    ).resolves.toBeUndefined();
    expect(fetchScore).toHaveBeenCalledTimes(2);
  });
});
