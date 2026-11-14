/** People-list pure view tests (TZ-06): filter chips, search, stable roster
 * ordering + poll diffing (no duplicates), relative time, dismissal rule
 * (owner ruling 2 — local collapse only). */
import { describe, expect, it } from 'vitest';
import type { Chat, Handshake, User } from '@bleak/api-client';
import { deriveRelationship } from '../src/lib/room/relationships';
import {
  isDismissed,
  matchesFilter,
  matchesQuery,
  mergeRoster,
  relativeTime,
  stableRoster,
  type PeopleFilter
} from '../src/lib/people/view';

const NOW = Date.parse('2026-11-14T12:00:00Z');

function user(address: string, name: string, created_at: string, public_bio = ''): User {
  return {
    address,
    room: '0xroom',
    name,
    greeting: '',
    public_bio,
    private_bio: '',
    language: 'ru',
    created_at,
    updated_at: created_at,
    deleted_at: null
  };
}

function handshake(from: string, to: string, created_at: string): Handshake {
  return {
    tx_id: `${from}-${to}`,
    from_address: from,
    to_address: to,
    room: '0xroom',
    status: 1,
    value: 1,
    created_at
  };
}

function chat(address: string, participants: string[], created_at: string): Chat {
  return {
    address,
    room: '0xroom',
    phase: 'networking',
    phase_started_at: created_at,
    scenario: 'ai-future',
    language: 'ru',
    created_at,
    participants: participants.map((user) => ({ chat: address, user }))
  };
}

describe('matchesFilter (§3.3 chips)', () => {
  it('maps the four chips to the relationship states', () => {
    expect(matchesFilter('chat', 'chatting')).toBe(true);
    expect(matchesFilter('incoming', 'chatting')).toBe(false);
    expect(matchesFilter('outgoing', 'sent')).toBe(true);
    expect(matchesFilter('incoming', 'sent')).toBe(false);
    expect(matchesFilter('incoming', 'added')).toBe(true);
    expect(matchesFilter('outgoing', 'added')).toBe(false);
    for (const state of ['chat', 'incoming', 'outgoing', 'none'] as const) {
      expect(matchesFilter(state, 'all')).toBe(true);
    }
  });
});

describe('matchesQuery (§3.3 search)', () => {
  const alice = user('0xa', 'Алиса', '', 'Поттер из Питера');

  it('matches name and public_bio case-insensitively', () => {
    expect(matchesQuery(alice, 'алис')).toBe(true);
    expect(matchesQuery(alice, 'АЛИС')).toBe(true);
    expect(matchesQuery(alice, 'поттер')).toBe(true);
    expect(matchesQuery(alice, 'POTTER')).toBe(true);
  });

  it('rejects non-matching queries and passes empty/blank ones', () => {
    expect(matchesQuery(alice, 'борис')).toBe(false);
    expect(matchesQuery(alice, '')).toBe(true);
    expect(matchesQuery(alice, '   ')).toBe(true);
  });
});

describe('stableRoster (§3.3 item 4 — stable order, no duplicates)', () => {
  it('orders newest created_at first and is deterministic', () => {
    const roster = [
      user('0xa', 'A', '2026-11-14T10:00:00Z'),
      user('0xb', 'B', '2026-11-14T11:00:00Z'),
      user('0xc', 'C', '2026-11-14T09:00:00Z')
    ];
    expect(stableRoster(roster).map((u) => u.address)).toEqual(['0xb', '0xa', '0xc']);
    expect(stableRoster(roster).map((u) => u.address)).toEqual(['0xb', '0xa', '0xc']);
  });

  it('deduplicates by address — no duplicate cards ever render (AC 8)', () => {
    const roster = [
      user('0xa', 'A', '2026-11-14T10:00:00Z'),
      user('0xa', 'A (stale)', '2026-11-14T10:00:00Z'),
      user('0xb', 'B', '2026-11-14T11:00:00Z')
    ];
    const merged = stableRoster(roster);
    expect(merged).toHaveLength(2);
    expect(merged.every((u, i, all) => all.findIndex((x) => x.address === u.address) === i)).toBe(
      true
    );
  });
});

describe('mergeRoster (poll diffing)', () => {
  const a = user('0xa', 'A', '2026-11-14T10:00:00Z');
  const b = user('0xb', 'B', '2026-11-14T11:00:00Z');
  const current = stableRoster([a, b]);

  it('keeps the current reference when the poll returns identical data', () => {
    const incoming = stableRoster([{ ...a }, { ...b }]);
    expect(mergeRoster(current, incoming)).toBe(current);
  });

  it('recomputes when a user is deleted from the room (AC 8)', () => {
    expect(mergeRoster(current, stableRoster([b]))).not.toBe(current);
    expect(mergeRoster(current, stableRoster([b]))).toHaveLength(1);
  });

  it('recomputes when a new attendee joins or the order changes', () => {
    const c = user('0xc', 'C', '2026-11-14T12:00:00Z');
    expect(mergeRoster(current, stableRoster([a, b, c]))).not.toBe(current);
    expect(mergeRoster(current, stableRoster([b, a]))).not.toBe(current);
  });
});

describe('relativeTime (§3.3 «2 мин» / "2 min")', () => {
  it('buckets minutes, hours and days in both locales', () => {
    const twoMinAgo = new Date(NOW - 2 * 60_000).toISOString();
    expect(relativeTime(twoMinAgo, NOW, 'ru')).toBe('2 мин');
    expect(relativeTime(twoMinAgo, NOW, 'en')).toBe('2 min');

    const threeHoursAgo = new Date(NOW - 3 * 3_600_000).toISOString();
    expect(relativeTime(threeHoursAgo, NOW, 'ru')).toBe('3 ч');
    expect(relativeTime(threeHoursAgo, NOW, 'en')).toBe('3 h');

    const fiveDaysAgo = new Date(NOW - 5 * 86_400_000).toISOString();
    expect(relativeTime(fiveDaysAgo, NOW, 'ru')).toBe('5 д');
    expect(relativeTime(fiveDaysAgo, NOW, 'en')).toBe('5 d');

    expect(relativeTime(new Date(NOW - 30_000).toISOString(), NOW, 'ru')).toBe('1 мин');
  });
});

describe('isDismissed (ruling 2 — local dismissal only)', () => {
  const ME = '0xme';
  const THEM = '0xthem';
  const AT = '2026-11-14T10:00:00Z';
  const rel = (incomingAt: string | null) => {
    const handshakes = incomingAt ? [handshake(THEM, ME, incomingAt)] : [];
    return deriveRelationship(THEM, ME, handshakes, []);
  };

  it('is false before any dismissal', () => {
    expect(isDismissed(new Map(), rel(AT))).toBe(false);
  });

  it('stays dismissed for the SAME incoming request after collapse', () => {
    const dismissals = new Map([[THEM, AT]]);
    expect(isDismissed(dismissals, rel(AT))).toBe(true);
  });

  it('re-expands when a NEWER incoming handshake arrives on a poll tick', () => {
    const dismissals = new Map([[THEM, AT]]);
    expect(isDismissed(dismissals, rel('2026-11-14T11:00:00Z'))).toBe(false);
  });

  it('does not apply once the state changed (e.g. mutual chat)', () => {
    const dismissals = new Map([[THEM, AT]]);
    const chatted = { ...rel(AT), state: 'chat' as const, chatAddress: '0xchat' };
    expect(isDismissed(dismissals, chatted)).toBe(false);
  });
});

describe('filter × relationship end-to-end', () => {
  it('classifies every state the chips can select', () => {
    const ME = '0xme';
    const chats = [chat('0xchat1', [ME, '0xpeer'], '2026-11-14T10:00:00Z')];
    expect(deriveRelationship('0xpeer', ME, [], chats).state).toBe('chat');
    expect(
      deriveRelationship('0xin', ME, [handshake('0xin', ME, AT)], []).state
    ).toBe('incoming');
    expect(
      deriveRelationship('0xout', ME, [handshake(ME, '0xout', AT)], []).state
    ).toBe('outgoing');
    expect(deriveRelationship('0xnone', ME, [], []).state).toBe('none');
  });
});

describe('PeopleFilter exhaustiveness', () => {
  it('has exactly the four chip values', () => {
    const all: PeopleFilter[] = ['all', 'sent', 'added', 'chatting'];
    for (const filter of all) expect(matchesFilter('none', filter)).toBe(filter === 'all');
  });
});
