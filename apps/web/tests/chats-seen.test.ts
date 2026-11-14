/** chatsSeen store: newer-than-seen ⇒ badge dot (DESIGN §1.2). */
import { afterEach, describe, expect, it } from 'vitest';
import { get } from 'svelte/store';
import {
  chatsUnseen,
  evaluateChatsUnseen,
  getChatsSeen,
  hasNewerChat,
  markChatsSeen
} from '../src/lib/stores/chatsSeen';

afterEach(() => {
  localStorage.clear();
  chatsUnseen.set(false);
});

describe('chatsSeen', () => {
  it('treats empty storage as never-seen', () => {
    expect(getChatsSeen()).toBe(0);
  });

  it('newer-than-seen ⇒ dot; markChatsSeen clears it', () => {
    const chats = [{ created_at: '2026-11-14T12:00:00Z' }];
    // no seen marker → anything exists ⇒ unseen
    expect(hasNewerChat(chats)).toBe(true);
    expect(evaluateChatsUnseen(chats)).toBe(true);
    expect(get(chatsUnseen)).toBe(true);

    markChatsSeen(Date.parse('2026-11-14T13:00:00Z'));
    expect(get(chatsUnseen)).toBe(false);
    expect(hasNewerChat(chats)).toBe(false);
  });

  it('ignores chats at or before the seen timestamp', () => {
    markChatsSeen(Date.parse('2026-11-14T12:00:00Z'));
    expect(hasNewerChat([{ created_at: '2026-11-14T12:00:00Z' }])).toBe(false);
    expect(hasNewerChat([{ created_at: '2026-11-14T11:59:59Z' }])).toBe(false);
    expect(hasNewerChat([{ created_at: '2026-11-14T12:00:01Z' }])).toBe(true);
  });

  it('corrupt storage values are ignored (fall back to never-seen)', () => {
    localStorage.setItem('bleak.chatsSeen', 'not-a-number');
    expect(getChatsSeen()).toBe(0);
    expect(hasNewerChat([{ created_at: '2026-11-14T12:00:00Z' }])).toBe(true);
  });

  it('invalid timestamps never count as newer', () => {
    markChatsSeen(Date.parse('2026-11-14T12:00:00Z'));
    expect(hasNewerChat([{ created_at: 'garbage' }])).toBe(false);
  });

  it('handles empty chat lists', () => {
    expect(evaluateChatsUnseen([])).toBe(false);
    expect(get(chatsUnseen)).toBe(false);
  });
});
