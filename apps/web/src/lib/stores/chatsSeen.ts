/**
 * Chats-seen bookkeeping (DESIGN §1.2): the Chats tab shows an accent dot
 * when a chat is newer than the last time the user visited /chats.
 * Timestamp is persisted in localStorage (`bleak.chatsSeen`); the
 * `chatsUnseen` writable is what the TabBar subscribes to. Pages that poll
 * `listChatsOfUser` call `evaluateChatsUnseen`; /chats calls `markChatsSeen`.
 */
import { writable } from 'svelte/store';

const STORAGE_KEY = 'bleak.chatsSeen';

/** Reactive flag rendered by the TabBar badge dot. */
export const chatsUnseen = writable(false);

function readSeen(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw !== null) {
      const value = Number(raw);
      if (Number.isFinite(value)) return value;
    }
  } catch {
    /* storage unavailable — treated as never-seen */
  }
  return 0;
}

export function getChatsSeen(): number {
  return readSeen();
}

/** Called when /chats is visited: the dot clears immediately. */
export function markChatsSeen(at: number = Date.now()): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(at));
  } catch {
    /* ignore */
  }
  chatsUnseen.set(false);
}

/** True when any chat was created after the stored seen timestamp. */
export function hasNewerChat(chats: readonly { created_at: string }[], seenAt?: number): boolean {
  const seen = seenAt ?? readSeen();
  return chats.some((chat) => {
    const at = Date.parse(chat.created_at);
    return Number.isFinite(at) && at > seen;
  });
}

/**
 * Pages that poll chat lists feed their newest snapshot here; the TabBar
 * dot state updates accordingly. Returns the new flag value.
 */
export function evaluateChatsUnseen(chats: readonly { created_at: string }[]): boolean {
  const unseen = hasNewerChat(chats);
  chatsUnseen.set(unseen);
  return unseen;
}
