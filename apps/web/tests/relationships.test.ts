/**
 * Relationship derivation tests (TZ-02): all four states, direction-only
 * semantics (Handshake.status NEVER interpreted), idempotent re-handshake.
 */
import { describe, expect, it } from 'vitest';
import type { Chat, Handshake, User } from '@bleak/api-client';
import {
  chatCounterparts,
  counterpartAddress,
  deriveRelationship,
  deriveRelationships,
  findChatWith
} from '../src/lib/room/relationships';

const ME = '0xme';
const OTHER = '0xother';
const THIRD = '0xthird';

function user(address: string): User {
  return {
    address,
    room: '0xroom',
    name: address,
    greeting: 'hi',
    public_bio: '',
    private_bio: '',
    language: 'ru',
    created_at: '2026-11-14T10:00:00Z',
    updated_at: '2026-11-14T10:00:00Z',
    deleted_at: null
  };
}

function handshake(
  from: string,
  to: string,
  status: number,
  createdAt = '2026-11-14T11:00:00Z'
): Handshake {
  return {
    tx_id: `${from}->${to}->${status}`,
    from_address: from,
    to_address: to,
    room: '0xroom',
    status,
    value: 1,
    created_at: createdAt
  };
}

function chat(participants: string[], address = '0xchat1', createdAt = '2026-11-14T12:00:00Z'): Chat {
  return {
    address,
    room: '0xroom',
    phase: 'networking',
    phase_started_at: createdAt,
    scenario: 'ai-future',
    language: 'ru',
    created_at: createdAt,
    participants: participants.map((p) => ({ chat: address, user: p }))
  };
}

describe('deriveRelationship — four states', () => {
  it('classifies no interaction as "none"', () => {
    const rel = deriveRelationship(OTHER, ME, [], []);
    expect(rel.state).toBe('none');
    expect(rel.chatAddress).toBeNull();
    expect(rel.outgoingAt).toBeNull();
    expect(rel.incomingAt).toBeNull();
  });

  it('classifies an outgoing-only handshake as "outgoing" (any status value)', () => {
    for (const status of [1, 2, 3, 4]) {
      const rel = deriveRelationship(OTHER, ME, [handshake(ME, OTHER, status)], []);
      expect(rel.state).toBe('outgoing');
      expect(rel.outgoingAt).toBe('2026-11-14T11:00:00Z');
    }
  });

  it('classifies an incoming-only handshake as "incoming" (any status value)', () => {
    for (const status of [1, 2, 3, 4]) {
      const rel = deriveRelationship(OTHER, ME, [handshake(OTHER, ME, status)], []);
      expect(rel.state).toBe('incoming');
      expect(rel.incomingAt).toBe('2026-11-14T11:00:00Z');
    }
  });

  it('classifies a chat between the pair as "chat" with the chat address', () => {
    const rel = deriveRelationship(OTHER, ME, [], [chat([ME, OTHER])]);
    expect(rel.state).toBe('chat');
    expect(rel.chatAddress).toBe('0xchat1');
    expect(rel.chatAt).toBe('2026-11-14T12:00:00Z');
  });

  it('chat existence wins over handshake direction (mutual is final state)', () => {
    const rel = deriveRelationship(OTHER, ME, [handshake(ME, OTHER, 1), handshake(OTHER, ME, 1)], [
      chat([ME, OTHER])
    ]);
    expect(rel.state).toBe('chat');
    expect(rel.outgoingAt).not.toBeNull();
    expect(rel.incomingAt).not.toBeNull();
  });

  it('both directions without a listed chat yet fall back to "incoming" (idempotent retry)', () => {
    const rel = deriveRelationship(OTHER, ME, [handshake(ME, OTHER, 1), handshake(OTHER, ME, 1)], []);
    expect(rel.state).toBe('incoming');
    expect(rel.chatAddress).toBeNull();
  });
});

describe('deriveRelationship — idempotent re-handshake', () => {
  it('duplicate outgoing handshakes stay "outgoing" and keep the newest timestamp', () => {
    const rel = deriveRelationship(
      OTHER,
      ME,
      [handshake(ME, OTHER, 1, '2026-11-14T11:00:00Z'), handshake(ME, OTHER, 1, '2026-11-14T11:05:00Z')],
      []
    );
    expect(rel.state).toBe('outgoing');
    expect(rel.outgoingAt).toBe('2026-11-14T11:05:00Z');
  });

  it('re-sending the pair after a chat was removed returns to the pending states, not an error state', () => {
    // chat gone → the directed pairs still classify by direction
    const rel = deriveRelationship(
      OTHER,
      ME,
      [handshake(ME, OTHER, 1), handshake(OTHER, ME, 1), handshake(ME, OTHER, 1)],
      []
    );
    expect(rel.state).toBe('incoming');
  });
});

describe('deriveRelationships — room sweep', () => {
  it('skips me and deleted users, classifies the rest', () => {
    const users = [user(ME), user(OTHER), user(THIRD)];
    const deleted = { ...user('0xghost'), deleted_at: '2026-11-14T13:00:00Z' };
    const rels = deriveRelationships(
      ME,
      [...users, deleted],
      [handshake(THIRD, ME, 1)],
      [chat([ME, OTHER])]
    );
    expect(rels.has(ME)).toBe(false);
    expect(rels.has('0xghost')).toBe(false);
    expect(rels.get(OTHER)?.state).toBe('chat');
    expect(rels.get(THIRD)?.state).toBe('incoming');
  });
});

describe('chat helpers', () => {
  it('counterpartAddress returns the participant who is not me', () => {
    expect(counterpartAddress(chat([ME, OTHER]), ME)).toBe(OTHER);
    expect(counterpartAddress(chat([ME, OTHER]), OTHER)).toBe(ME);
  });

  it('findChatWith matches only chats containing both addresses, newest first', () => {
    const chats = [chat([ME, THIRD], '0xchatA'), chat([ME, OTHER], '0xchatB')];
    expect(findChatWith(chats, ME, OTHER)?.address).toBe('0xchatB');
    expect(findChatWith(chats, ME, '0xstranger')).toBeNull();
  });

  it('chatCounterparts collects all chat partners', () => {
    const chats = [chat([ME, OTHER], '0xchatB'), chat([ME, THIRD], '0xchatA')];
    const set = chatCounterparts(chats, ME);
    expect(set.has(OTHER)).toBe(true);
    expect(set.has(THIRD)).toBe(true);
    expect(set.size).toBe(2);
  });
});
