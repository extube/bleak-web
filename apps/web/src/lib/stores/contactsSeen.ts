/**
 * Contacts-seen bookkeeping (DESIGN §4.14.2): the Contacts tab shows an
 * accent dot when a contact was shared with the user after the last time
 * they visited /contacts — the same pattern as lib/stores/chatsSeen.ts.
 * The seen timestamp is recorded PER PERSONA under the localStorage key
 * `bleak.contactsSeen` (the token vault holds several personas per device;
 * one persona's visit must not clear another persona's dot). The
 * `contactsUnseen` writable is what the TabBar subscribes to: the layout
 * evaluates one mount-time contacts read, /contacts calls `markContactsSeen`.
 */
import { writable } from 'svelte/store';

const STORAGE_KEY = 'bleak.contactsSeen';

/** Reactive flag rendered by the TabBar badge dot. */
export const contactsUnseen = writable(false);

/** Per-persona storage key inside the `bleak.contactsSeen` map. */
export function personaSeenKey(room: string, user: string): string {
  return `${room}|${user}`;
}

function readSeenMap(): Record<string, number> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw !== null) {
      const parsed = JSON.parse(raw) as unknown;
      if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, number>;
      }
    }
  } catch {
    /* corrupt storage — treated as never-seen */
  }
  return {};
}

export function getContactsSeen(room: string, user: string): number {
  const value = readSeenMap()[personaSeenKey(room, user)];
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

/** Called when /contacts is visited: the dot clears immediately. */
export function markContactsSeen(room: string, user: string, at: number = Date.now()): void {
  try {
    const map = readSeenMap();
    map[personaSeenKey(room, user)] = at;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
  contactsUnseen.set(false);
}

/** True when any contact was shared after the stored seen timestamp. */
export function hasNewerContact(
  contacts: readonly { created_at: string }[],
  seenAt?: number
): boolean {
  const seen = seenAt ?? 0;
  return contacts.some((contact) => {
    const at = Date.parse(contact.created_at);
    return Number.isFinite(at) && at > seen;
  });
}

/**
 * The layout's one mount-time read feeds its newest snapshot here; the
 * TabBar dot state updates accordingly. Returns the new flag value.
 */
export function evaluateContactsUnseen(
  room: string,
  user: string,
  contacts: readonly { created_at: string }[]
): boolean {
  const unseen = hasNewerContact(contacts, getContactsSeen(room, user));
  contactsUnseen.set(unseen);
  return unseen;
}
