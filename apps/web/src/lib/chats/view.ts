/**
 * Chats view logic (TZ-07, DESIGN §3.4/§3.5; chat status per CONCEPT §13 R2
 * / DESIGN §4.13.2) — pure and unit-tested.
 * Chat-card derivation (counterpart + «+N»), stable ordering and poll
 * diffing, transcript alignment + speaker resolution, accessible bubble
 * names, bottom-stickiness for auto-scroll, and the back-target rule (§1.3).
 *
 * Owner ruling 4 (Concept §1c): transcripts are read-only — there is no
 * message composer anywhere; `POST /api/message` is never wired into the UI.
 * This module only classifies and formats what the server returns.
 */
import type { Chat, Message, User } from '@bleak/api-client';
import { counterpartAddress } from '#lib/room/relationships';

export interface ChatCardData {
  chat: Chat;
  /** First participant who is not me (chats are 1:1 in v1, §3.4). */
  counterpart: string | null;
  /** Participants beyond me + the first counterpart («+N», §3.4 AC 2). */
  extra: number;
}

export function describeChat(chat: Chat, myAddress: string): ChatCardData {
  return {
    chat,
    counterpart: counterpartAddress(chat, myAddress),
    extra: Math.max(0, chat.participants.length - 2)
  };
}

function timestampAt(iso: string): number {
  const at = Date.parse(iso);
  return Number.isFinite(at) ? at : 0;
}

/**
 * THE list order (Concept §20, DESIGN §4.15.7): chat items are sorted by
 * time — newest `Chat.created_at` FIRST — a single time-based sort that
 * supersedes the §4.13.4 score-first ordering (finished-by-score first is
 * retired); finished and unfinished chats sort together by the same
 * comparator. Dedupe by address preserves the poll snapshot pipeline.
 */
export function stableChats(chats: readonly Chat[]): Chat[] {
  const byAddress = new Map<string, Chat>();
  for (const chat of chats) byAddress.set(chat.address, chat);
  return [...byAddress.values()].sort(
    (a, b) => timestampAt(b.created_at) - timestampAt(a.created_at)
  );
}

/**
 * Poll diff for the chat list: an identical (address, created_at) content
 * keeps the current array reference so Svelte's keyed each does not re-diff
 * (§2.2 poll-first etiquette). The comparison is order-insensitive (sorted
 * key sequences); a changed `created_at` or membership swaps the snapshot
 * in, which is also how the relative card time updates on polls (§3.4 AC 3).
 */
export function mergeChats(
  current: readonly Chat[],
  incoming: readonly Chat[]
): readonly Chat[] {
  if (current.length === incoming.length) {
    const keys = (list: readonly Chat[]): string[] =>
      list.map((chat) => `${chat.address}|${chat.created_at}`).sort();
    const a = keys(current);
    const b = keys(incoming);
    if (a.every((key, i) => key === b[i])) return current;
  }
  return incoming;
}

/**
 * Poll diff for the transcript. `listChatMessages` returns every message
 * oldest-first (client contract); the diff compares the tx_id sequence.
 */
export function mergeMessages(
  current: readonly Message[],
  incoming: readonly Message[]
): readonly Message[] {
  if (
    current.length === incoming.length &&
    current.every((message, i) => message.tx_id === incoming[i]?.tx_id)
  ) {
    return current;
  }
  return incoming;
}

/** mine → right-aligned elevated bubble (§3.5): `message.from` vs my address. */
export function isMyMessage(message: Pick<Message, 'from'>, myAddress: string): boolean {
  return message.from === myAddress;
}

/** Speaker display name from the room roster; raw address fallback (§3.5). */
export function speakerName(address: string, users: readonly User[]): string {
  return users.find((user) => user.address === address)?.name ?? address;
}

/** Accessible bubble name: «{speaker}: {first 60 chars of content}» (§3.5). */
export function bubbleAriaLabel(speaker: string, content: string): string {
  const text = content.length > 60 ? content.slice(0, 60) : content;
  return `${speaker}: ${text}`;
}

function localeTag(locale: 'ru' | 'en'): string {
  return locale === 'ru' ? 'ru-RU' : 'en-GB';
}

/**
 * Message time (Concept §8.1.8, DESIGN §4.9.8): absolute 24-hour hh:mm
 * formatted with Intl for the active locale («14:05» / "14:05") — the
 * former relative «2 мин» wording is retired. No date libraries (TZ rule).
 */
export function messageTime(iso: string, locale: 'ru' | 'en'): string {
  return new Intl.DateTimeFormat(localeTag(locale), {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).format(new Date(timestampAt(iso)));
}

/**
 * Dialog date label (Concept §8.1.8): a locale day+month label
 * («8 сентября» / "8 September") shown centered at the top of the
 * transcript. Intl with the active locale — no date libraries.
 */
export function chatDateLabel(iso: string, locale: 'ru' | 'en'): string {
  return new Intl.DateTimeFormat(localeTag(locale), {
    day: 'numeric',
    month: 'long'
  }).format(new Date(timestampAt(iso)));
}

// ---------------------------------------------------------------------------
// Chat status (CONCEPT §13 R2 / DESIGN §4.13.2, replacing the §10.1.7 gap)
// ---------------------------------------------------------------------------

/** Chat lifecycle state behind the list-card status icon. */
export type ChatStatus = 'active' | 'finished';

/**
 * The AUTHORITATIVE finished signal (CONCEPT §13 R2, DESIGN §4.13.2):
 * `Chat.done` — the farewell turn stamps it server-side, a kickoff resets
 * it to false. The former §10.1.7 default-active fallback is retired.
 *
 * A missing / undefined `done` means NOT finished (the client type keeps
 * `done?: boolean` only so existing fixtures stay source-compatible;
 * `model.Chat` always serializes the field). Pure and deterministic: the
 * sole input is the Chat itself — tz5-04 gates the contact-share slide
 * control on this selector, tz5-05 keys the list ordering off `chatStatus`.
 */
export function isChatDone(chat: Chat): boolean {
  return chat.done === true;
}

/**
 * Chat status derivation (DESIGN §4.13.2): done === true → 'finished' (the
 * reminder-style mark, v2.4/v2.5 status-mark design), anything else →
 * 'active' (the animated loading glyph). A missing `done` (old fixtures /
 * clients that have not parsed the field) is NOT finished.
 */
export function chatStatus(chat: Chat): ChatStatus {
  return isChatDone(chat) ? 'finished' : 'active';
}

/**
 * Bottom-stickiness (§3.5 transcript): within `thresholdPx` of the bottom ⇒
 * the view auto-scrolls on new messages; scrolled up ⇒ the floating
 * «scroll to bottom» chip appears.
 */
export function isNearBottom(
  scrollTop: number,
  clientHeight: number,
  scrollHeight: number,
  thresholdPx = 80
): boolean {
  return scrollHeight - scrollTop - clientHeight <= thresholdPx;
}

/** Back rule (§1.3): meaningful history → history back, else → /chats. */
export function backTarget(historyLength: number): 'history' | 'list' {
  return historyLength > 1 ? 'history' : 'list';
}
