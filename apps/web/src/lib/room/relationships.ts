/**
 * Relationship derivation — pure domain logic shared by the radar (/room),
 * the people list (/people) and the scanner's already-mutual check (TZ-02
 * contract, consumed by TZ-04/05/06).
 *
 * STRICT RULE (DESIGN §6.1): `Handshake.status` is NEVER interpreted —
 * direction is derived from `from_address` / `to_address` only, and
 * relationship state from handshake direction + chat existence.
 */
import type { Chat, Handshake, User } from '@bleak/api-client';

export type RelationshipState = 'chat' | 'incoming' | 'outgoing' | 'none';

export interface Relationship {
  /** The other attendee's user address. */
  user: string;
  state: RelationshipState;
  /** Address of the chat with this user (state === 'chat' only). */
  chatAddress: string | null;
  /** ISO timestamp of the most recent outgoing handshake (display data). */
  outgoingAt: string | null;
  /** ISO timestamp of the most recent incoming handshake (display data). */
  incomingAt: string | null;
  /** ISO timestamp of the chat creation (display data). */
  chatAt: string | null;
}

/** The participant of a chat who is not me (chats are 1:1 in v1). */
export function counterpartAddress(chat: Chat, myAddress: string): string | null {
  const others = chat.participants.filter((p) => p.user !== myAddress);
  const first = others[0];
  return first ? first.user : null;
}

/** Newest chat whose participants include both me and the given user. */
export function findChatWith(
  chats: readonly Chat[],
  myAddress: string,
  userAddress: string
): Chat | null {
  const matches = chats.filter((chat) => {
    const users = chat.participants.map((p) => p.user);
    return users.includes(myAddress) && users.includes(userAddress);
  });
  if (matches.length === 0) return null;
  return matches.reduce((newest, chat) => (chat.created_at > newest.created_at ? chat : newest));
}

/**
 * Classify one other attendee. Priority: an existing chat wins (mutual,
 * idempotent) → chat; a handshake in either direction → incoming (the
 * actionable state: handshake back) unless only outgoing exists → outgoing;
 * else none. Handshake.status is deliberately not read.
 */
export function deriveRelationship(
  userAddress: string,
  myAddress: string,
  handshakes: readonly Handshake[],
  chats: readonly Chat[]
): Relationship {
  let outgoingAt: string | null = null;
  let incomingAt: string | null = null;
  for (const hs of handshakes) {
    if (hs.from_address === myAddress && hs.to_address === userAddress) {
      if (outgoingAt === null || hs.created_at > outgoingAt) outgoingAt = hs.created_at;
    }
    if (hs.from_address === userAddress && hs.to_address === myAddress) {
      if (incomingAt === null || hs.created_at > incomingAt) incomingAt = hs.created_at;
    }
  }

  const chat = findChatWith(chats, myAddress, userAddress);
  if (chat) {
    return {
      user: userAddress,
      state: 'chat',
      chatAddress: chat.address,
      outgoingAt,
      incomingAt,
      chatAt: chat.created_at
    };
  }

  // Both directions present but the chat is not (yet) listed — treat as
  // incoming: the idempotent handshake-back POST returns 200 and the chat
  // appears on the next poll (DESIGN §3.2 criterion 7).
  if (outgoingAt !== null && incomingAt !== null) {
    return {
      user: userAddress,
      state: 'incoming',
      chatAddress: null,
      outgoingAt,
      incomingAt,
      chatAt: null
    };
  }
  if (incomingAt !== null) {
    return { user: userAddress, state: 'incoming', chatAddress: null, outgoingAt, incomingAt, chatAt: null };
  }
  if (outgoingAt !== null) {
    return { user: userAddress, state: 'outgoing', chatAddress: null, outgoingAt, incomingAt, chatAt: null };
  }
  return { user: userAddress, state: 'none', chatAddress: null, outgoingAt, incomingAt, chatAt: null };
}

/**
 * Classify every other attendee of the room. Skips me and (defensively) any
 * soft-deleted user record. Returns a Map keyed by user address.
 */
export function deriveRelationships(
  myAddress: string,
  users: readonly User[],
  handshakes: readonly Handshake[],
  chats: readonly Chat[]
): Map<string, Relationship> {
  const result = new Map<string, Relationship>();
  for (const user of users) {
    if (user.address === myAddress) continue;
    if (user.deleted_at) continue;
    result.set(user.address, deriveRelationship(user.address, myAddress, handshakes, chats));
  }
  return result;
}

/** Set of user addresses I already have a chat with (scanner's mutual check). */
export function chatCounterparts(chats: readonly Chat[], myAddress: string): Set<string> {
  const set = new Set<string>();
  for (const chat of chats) {
    const counterpart = counterpartAddress(chat, myAddress);
    if (counterpart) set.add(counterpart);
  }
  return set;
}
