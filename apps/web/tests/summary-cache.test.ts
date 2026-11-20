/** Summary cache tests (Concept §18.3, DESIGN §4.15.3.3 — owner
 * microchange): the session-scoped summary cache behind the lazy
 * background fetch for FINISHED chats — entries keyed by chat address as a
 * small state machine (ready / pending / failed) with the owner-persona
 * stamp, the in-flight guard against the poll cadence, the no-aggressive-
 * re-post rule (a failed entry blocks the background cadence; only a
 * forced retry re-fetches), the 401 gate classification and the
 * stale-persona drop — the same cache semantics as the matchScores store
 * (stores/matchScores.ts). */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { get } from 'svelte/store';
import { ApiError, NetworkError, type Summary } from '@bleak/api-client';
import {
  classifySummaryFailure,
  ensureSummary,
  summaries,
  type SummaryFailure,
  type SummaryRequest
} from '../src/lib/stores/summaryCache';

const ROOM = '0xroom';
const ME = '0xme';

function summaryFixture(chat = '0xchat1'): Summary {
  return {
    chat,
    checkpoints: [
      { key: 'introductions', label: 'Both introduced themselves', closed: true }
    ],
    created_at: '2026-11-20T10:00:00Z',
    description: 'You discussed ceramics.',
    room: ROOM,
    score: 66,
    user_a: ME,
    user_b: '0xa'
  };
}

const request = (address = '0xchat1', counterpart = '0xa'): SummaryRequest => ({
  address,
  room: ROOM,
  counterpart
});

/** The failure payload of a cache entry, or null when it has none (TS-safe). */
function getEntryFailure(address: string): SummaryFailure | null {
  const entry = get(summaries).get(address);
  return entry?.status === 'failed' ? entry.failure : null;
}

beforeEach(() => {
  summaries.set(new Map());
});

describe('ensureSummary (DESIGN §4.15.3.3 — the summary cache)', () => {
  it('caches the Summary under the chat address, stamped with the owner persona (ready)', async () => {
    await ensureSummary([request()], ME, async () => summaryFixture());
    const entry = get(summaries).get('0xchat1');
    expect(entry).toEqual({ status: 'ready', owner: ME, summary: summaryFixture() });
  });

  it('a cached (ready) entry is a cache hit — the fetch is never re-posted', async () => {
    const fetchSummary = vi.fn(async () => summaryFixture());
    await ensureSummary([request()], ME, fetchSummary);
    await ensureSummary([request()], ME, fetchSummary);
    await ensureSummary([request()], ME, fetchSummary);
    expect(fetchSummary).toHaveBeenCalledTimes(1);
  });

  it('an in-flight (pending) fetch blocks a second request — the cadence never piles up', async () => {
    let releaseFetch: ((value: Summary) => void) | undefined;
    const fetchSummary = vi.fn(
      () =>
        new Promise<Summary>((resolve) => {
          releaseFetch = resolve;
        })
    );

    const first = ensureSummary([request()], ME, fetchSummary);
    // the pending entry is observable — the sheet's loading state reads it
    expect(get(summaries).get('0xchat1')).toEqual({ status: 'pending', owner: ME });
    const second = ensureSummary([request()], ME, fetchSummary);
    releaseFetch?.(summaryFixture());
    await Promise.all([first, second]);

    expect(fetchSummary).toHaveBeenCalledTimes(1);
    expect(get(summaries).get('0xchat1')?.status).toBe('ready');
  });

  it('a failure lands as a failed entry (network kind) and never throws', async () => {
    const fetchSummary = vi.fn(async () => {
      throw new NetworkError('/api/hard-match', new Error('offline'));
    });
    await expect(ensureSummary([request()], ME, fetchSummary)).resolves.toBeUndefined();
    expect(get(summaries).get('0xchat1')).toEqual({
      status: 'failed',
      owner: ME,
      failure: { kind: 'network', message: null, gate: false }
    });
  });

  it('an ApiError classifies as api with its message; a 401 flags the §2.8 global gate', async () => {
    await ensureSummary([request()], ME, async () => {
      throw new ApiError(400, '/api/hard-match', 'bad pair');
    });
    expect(get(summaries).get('0xchat1')?.status).toBe('failed');
    expect(get(summaries).get('0xchat1')?.owner).toBe(ME);
    const failure = getEntryFailure('0xchat1');
    expect(failure?.kind).toBe('api');
    expect(failure?.message).toContain('bad pair');
    expect(failure?.gate).toBe(false);

    summaries.set(new Map());
    await ensureSummary([request()], ME, async () => {
      throw new ApiError(401, '/api/hard-match', 'no token');
    });
    const gate = getEntryFailure('0xchat1');
    expect(gate?.kind).toBe('api');
    expect(gate?.gate).toBe(true); // the §2.8 global gate owns a 401
  });

  it('a failed entry blocks the background cadence (no aggressive re-post); only a forced retry re-fetches', async () => {
    const fetchSummary = vi.fn()
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce(summaryFixture());
    await ensureSummary([request()], ME, fetchSummary);
    expect(get(summaries).get('0xchat1')?.status).toBe('failed');

    // background ticks pass again — nothing re-posts
    await ensureSummary([request()], ME, fetchSummary);
    await ensureSummary([request()], ME, fetchSummary);
    expect(fetchSummary).toHaveBeenCalledTimes(1);

    // the sheet's retry affordance forces the re-fetch (still guarded while
    // a fetch would be pending — force never bypasses the in-flight entry)
    await ensureSummary([request()], ME, fetchSummary, { force: true });
    expect(fetchSummary).toHaveBeenCalledTimes(2);
    expect(get(summaries).get('0xchat1')?.status).toBe('ready');
  });

  it('a ready entry is never re-posted even under force (force only lifts the failed guard)', async () => {
    const fetchSummary = vi.fn(async () => summaryFixture());
    await ensureSummary([request()], ME, fetchSummary);
    await ensureSummary([request()], ME, fetchSummary, { force: true });
    expect(fetchSummary).toHaveBeenCalledTimes(1);
  });

  it('drops snapshots owned by a previous persona of the same browser session', async () => {
    await ensureSummary([request()], '0xold', async () => summaryFixture());
    await ensureSummary([request()], ME, async () => summaryFixture('0xchat1'));
    const cache = get(summaries);
    expect(cache.get('0xchat1')?.owner).toBe(ME); // foreign persona's entry dropped + refetched
  });

  it('multiple chats settle independently (a failure never blocks the others)', async () => {
    await ensureSummary(
      [request('0xchat1'), request('0xchat2', '0xb')],
      ME,
      (req) =>
        req.address === '0xchat1'
          ? Promise.reject(new Error('x'))
          : Promise.resolve(summaryFixture('0xchat2'))
    );
    const cache = get(summaries);
    expect(cache.get('0xchat1')?.status).toBe('failed');
    expect(cache.get('0xchat2')?.status).toBe('ready');
  });
});

describe('classifySummaryFailure (the sheet error classification)', () => {
  it('maps the error families onto the sheet contract', () => {
    expect(classifySummaryFailure(new NetworkError('/x', new Error('offline')))).toEqual({
      kind: 'network',
      message: null,
      gate: false
    });
    expect(classifySummaryFailure(new ApiError(500, '/x', 'boom')).kind).toBe('api');
    expect(classifySummaryFailure(new ApiError(500, '/x', 'boom')).message).toContain('boom');
    expect(classifySummaryFailure(new Error('generic')).kind).toBe('api');
    expect(classifySummaryFailure('weird').message).toBeNull();
    expect(classifySummaryFailure('weird').gate).toBe(false);
  });
});
