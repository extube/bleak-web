/** Pure chats view logic tests (TZ-07, DESIGN §3.4/§3.5): chat-card
 * derivation (counterpart, «+N»), stable ordering + poll diffs (reference
 * identity preserved on identical snapshots), transcript alignment, speaker
 * resolution with raw-address fallback, accessible bubble names (60 chars),
 * bottom-stickiness for auto-scroll, the back-target rule (§1.3), and the
 * v2.2 Intl time/date formatters (Concept §8.1.8 — the kickoff speaker
 * wording is retired). */
import { describe, expect, it } from 'vitest';
import type { Chat, Message, User } from '@bleak/api-client';
import {
  backTarget,
  bubbleAriaLabel,
  chatDateLabel,
  chatStatus,
  describeChat,
  isChatDone,
  isMyMessage,
  isNearBottom,
  mergeChats,
  mergeMessages,
  messageTime,
  speakerName,
  stableChats
} from '../src/lib/chats/view';
import { deriveRelationship } from '../src/lib/room/relationships';

const ME = '0xme';

function chat(address: string, participants: string[], createdAt: string): Chat {
  return {
    address,
    room: '0xroom',
    phase: 'networking',
    phase_started_at: createdAt,
    scenario: 'ai-future',
    language: 'ru',
    created_at: createdAt,
    participants: participants.map((user) => ({ chat: address, user }))
  };
}

function message(txId: string, from: string, content: string, createdAt: string): Message {
  return {
    tx_id: txId,
    chat: '0xchat1',
    from,
    to: '0xsomeone',
    content,
    created_at: createdAt
  };
}

function person(address: string, name: string): User {
  return {
    address,
    room: '0xroom',
    name,
    greeting: '',
    public_bio: '',
    private_bio: '',
    language: 'ru',
    created_at: '',
    updated_at: '',
    deleted_at: null
  };
}

describe('describeChat (§3.4)', () => {
  it('counterpart = participants minus my address (1:1)', () => {
    const data = describeChat(chat('0xchat1', [ME, '0xa'], '2026-01-01T00:00:00Z'), ME);
    expect(data.counterpart).toBe('0xa');
    expect(data.extra).toBe(0);
  });

  it('≠2 participants → first counterpart + «+N» extras', () => {
    const data = describeChat(
      chat('0xchat2', ['0xb', ME, '0xa', '0xc'], '2026-01-01T00:00:00Z'),
      ME
    );
    expect(data.counterpart).toBe('0xb'); // first participant who is not me
    expect(data.extra).toBe(2);
  });

  it('relationships contract interop: chat relationship carries the chat address', () => {
    const chats = [chat('0xchat1', [ME, '0xa'], '2026-01-01T00:00:00Z')];
    const rel = deriveRelationship('0xa', ME, [], chats);
    expect(rel.state).toBe('chat');
    expect(rel.chatAddress).toBe('0xchat1');
  });
});

describe('stableChats + mergeChats (poll diffing, §2.2)', () => {
  const older = chat('0xchat1', [ME, '0xa'], '2026-01-01T00:00:00Z');
  const newer = chat('0xchat2', [ME, '0xb'], '2026-01-02T00:00:00Z');

  it('newest created_at first, deduped by address', () => {
    const ordered = stableChats([older, newer, { ...older }]);
    expect(ordered.map((c) => c.address)).toEqual(['0xchat2', '0xchat1']);
  });

  it('single time sort (Concept §20, DESIGN §4.15.7): finished chats do NOT float first — done and active sort together, newest first', () => {
    const a1 = chat('0xa1', [ME, '0xc'], '2026-01-01T00:00:00Z');
    const a2 = chat('0xa2', [ME, '0xd'], '2026-01-03T00:00:00Z');
    const d1 = { ...chat('0xd1', [ME, '0xe'], '2026-01-02T00:00:00Z'), done: true };
    const d2 = { ...chat('0xd2', [ME, '0xf'], '2026-01-04T00:00:00Z'), done: true };
    // input order deliberately scrambled across the done/active split
    const ordered = stableChats([a1, d2, a2, d1]);
    // pure created_at DESCENDING: 0xd2 (Jan 4) → 0xa2 (Jan 3) → 0xd1 (Jan 2,
    // FINISHED — it does not float above the newer active 0xa2) → 0xa1 (Jan 1)
    expect(ordered.map((c) => c.address)).toEqual(['0xd2', '0xa2', '0xd1', '0xa1']);
  });

  it('identical (address, created_at) sequence keeps the current reference (no re-render)', () => {
    const current = stableChats([older, newer]);
    const incoming = structuredClone([older, newer]);
    expect(mergeChats(current, incoming)).toBe(current);
  });

  it('changed sequence or changed created_at returns the incoming snapshot', () => {
    const current = stableChats([older]);
    expect(mergeChats(current, [older, newer])).not.toBe(current);
    const moved = chat('0xchat1', [ME, '0xa'], '2026-01-03T00:00:00Z');
    expect(mergeChats([older], [moved])).not.toBe(current);
  });
});

describe('mergeMessages (transcript diff)', () => {
  const m1 = message('tx1', '0xa', 'привет', '2026-01-01T00:00:00Z');
  const m2 = message('tx2', ME, 'привет-привет', '2026-01-01T00:00:01Z');

  it('identical tx sequence keeps the current reference', () => {
    const current = [m1, m2];
    expect(mergeMessages(current, structuredClone([m1, m2]))).toBe(current);
  });

  it('a new message swaps the snapshot in', () => {
    const current = [m1];
    const next = mergeMessages(current, [m1, m2]);
    expect(next).toHaveLength(2);
    expect(next[1]?.tx_id).toBe('tx2');
  });
});

describe('alignment + speaker resolution (§3.5 AC 1/2)', () => {
  it('mine ⇔ message.from === my address (mine → right/elevated)', () => {
    expect(isMyMessage(message('tx1', ME, 'x', ''), ME)).toBe(true);
    expect(isMyMessage(message('tx1', '0xa', 'x', ''), ME)).toBe(false);
  });

  it('speaker resolves from the roster; unknown address falls back to raw', () => {
    const users = [person('0xa', 'Алиса'), person('0xb', 'Борис')];
    expect(speakerName('0xa', users)).toBe('Алиса');
    expect(speakerName('0xunknown', users)).toBe('0xunknown');
  });

  it('multi-participant chats still resolve each speaker', () => {
    const users = [person('0xa', 'Алиса'), person('0xb', 'Борис')];
    expect(speakerName('0xb', users)).toBe('Борис');
  });
});

describe('bubbleAriaLabel (§3.5 a11y: «{speaker}: {first 60 chars}»)', () => {
  it('short content is used verbatim', () => {
    expect(bubbleAriaLabel('Алиса', 'Привет!')).toBe('Алиса: Привет!');
  });

  it('long content truncates to 60 characters', () => {
    const long = 'x'.repeat(200);
    expect(bubbleAriaLabel('Алиса', long)).toBe(`Алиса: ${'x'.repeat(60)}`);
  });
});

describe('isNearBottom (auto-scroll, AC 3)', () => {
  it('at the bottom (within threshold) ⇒ stick, auto-scroll', () => {
    expect(isNearBottom(720, 300, 1000)).toBe(true); // 20px gap
  });

  it('scrolled up ⇒ chip (no auto-scroll)', () => {
    expect(isNearBottom(0, 300, 1000)).toBe(false); // 700px gap
  });

  it('custom threshold is honored', () => {
    expect(isNearBottom(0, 300, 1000, 800)).toBe(true);
  });
});

describe('backTarget (§1.3: history back → fallback /chats)', () => {
  it('meaningful history → history back', () => {
    expect(backTarget(3)).toBe('history');
  });

  it('no meaningful history → /chats', () => {
    expect(backTarget(1)).toBe('list');
  });
});

describe('chatStatus + isChatDone (CONCEPT §13 R2, DESIGN §4.13.2 — Chat.done is the AUTHORITATIVE finished signal)', () => {
  it('done === true → FINISHED (the reminder mark)', () => {
    const finished = { ...chat('0xchat1', [ME, '0xa'], '2026-01-01T00:00:00Z'), done: true };
    expect(chatStatus(finished)).toBe('finished');
    expect(isChatDone(finished)).toBe(true);
  });

  it('done false / missing / undefined → ACTIVE (missing means not-finished)', () => {
    const started = chat('0xchat1', [ME, '0xa'], '2026-01-01T00:00:00Z');
    // explicit false
    expect(chatStatus({ ...started, done: false })).toBe('active');
    expect(isChatDone({ ...started, done: false })).toBe(false);
    // missing (the type keeps done optional only for fixture compatibility)
    expect(chatStatus(started)).toBe('active');
    expect(isChatDone(started)).toBe(false);
    // explicit undefined
    expect(chatStatus({ ...started, done: undefined })).toBe('active');
    expect(isChatDone({ ...started, done: undefined })).toBe(false);
    // the free agent-work `phase` («networking»/«debate») is a theme, not a
    // lifecycle state — it never flips the status (the §10.1.7 phase-era
    // assumption is retired; done alone decides)
    expect(chatStatus({ ...started, phase: 'debate' })).toBe('active');
    expect(chatStatus({ ...started, phase: '' })).toBe('active');
  });

  it('kickoff reset semantics: done false after true returns to ACTIVE', () => {
    const finished = { ...chat('0x1', [ME, '0xa'], '2026-01-01T00:00:00Z'), done: true };
    const reset = { ...finished, done: false };
    expect(chatStatus(finished)).toBe('finished');
    expect(chatStatus(reset)).toBe('active');
  });

  it('isChatDone is the tz5-04 contact-share gate selector (done-derived, pure)', () => {
    expect(isChatDone({ ...chat('0x2', [ME, '0xa'], '2026-01-01T00:00:00Z'), done: true })).toBe(true);
    expect(isChatDone({ ...chat('0x3', [ME, '0xa'], '2026-01-01T00:00:00Z'), done: false })).toBe(false);
  });
});

describe('messageTime + chatDateLabel (Concept §8.1.8, DESIGN §4.9.8)', () => {
  it('message time is absolute 24-hour hh:mm via Intl with the active locale', () => {
    const at = new Date(2026, 8, 8, 14, 5).toISOString();
    expect(messageTime(at, 'ru')).toMatch(/^\d{2}:\d{2}$/);
    expect(messageTime(at, 'en')).toMatch(/^\d{2}:\d{2}$/);
    const morning = new Date(2026, 8, 8, 9, 30).toISOString();
    expect(messageTime(morning, 'ru')).toMatch(/^09:30$/);
    // Not the retired relative wording.
    expect(messageTime(at, 'ru')).not.toContain('мин');
  });

  it('date label is a locale day+month label (day-first: «8 сентября» / "8 September")', () => {
    const at = new Date(2026, 8, 8, 14, 5).toISOString();
    // en-GB is day-first with the long month name ("8 September").
    expect(chatDateLabel(at, 'en')).toBe('8 September');
    // The RU glyphs follow the runtime ICU data (full in browsers; some
    // Node builds restrict locales and fall back), so the helper is pinned
    // to the same Intl formatter it uses with the active-locale tag.
    const expected = new Intl.DateTimeFormat('ru-RU', {
      day: 'numeric',
      month: 'long'
    }).format(new Date(at));
    expect(chatDateLabel(at, 'ru')).toBe(expected);
  });
});
