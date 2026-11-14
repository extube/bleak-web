/**
 * Host-session persistence (DESIGN §3.7, TZ-09): the host token and the last
 * created room (share-kit restore) live in localStorage under the single keys
 * `bleak.hostToken` / `bleak.hostRoom`. The token is never logged and is
 * written nowhere else; both keys are runtime state an operator can wipe.
 */
import { writable } from 'svelte/store';

export interface HostRoomRef {
  code: string;
  roomAddress: string;
  roomName: string;
  /** invite_url as returned by the helper at creation time. */
  inviteUrl: string;
}

const TOKEN_KEY = 'bleak.hostToken';
const ROOM_KEY = 'bleak.hostRoom';

export const hostToken = writable('');
export const hostRoom = writable<HostRoomRef | null>(null);

function readToken(): string {
  try {
    return localStorage.getItem(TOKEN_KEY) ?? '';
  } catch {
    /* storage unavailable */
    return '';
  }
}

function readRoom(): HostRoomRef | null {
  try {
    const raw = localStorage.getItem(ROOM_KEY);
    if (raw === null) return null;
    const parsed = JSON.parse(raw) as Partial<HostRoomRef>;
    if (typeof parsed.code === 'string' && typeof parsed.roomAddress === 'string') {
      return {
        code: parsed.code,
        roomAddress: parsed.roomAddress,
        roomName: typeof parsed.roomName === 'string' ? parsed.roomName : '',
        inviteUrl: typeof parsed.inviteUrl === 'string' ? parsed.inviteUrl : ''
      };
    }
  } catch {
    /* corrupted or unavailable storage — treat as no room */
  }
  return null;
}

/** Load persisted host session; call once from the /host route on mount. */
export function initHostSession(): void {
  hostToken.set(readToken());
  hostRoom.set(readRoom());
}

export function saveHostToken(token: string): void {
  hostToken.set(token);
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    /* ignore */
  }
}

export function forgetHostToken(): void {
  hostToken.set('');
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

export function saveHostRoom(room: HostRoomRef): void {
  hostRoom.set(room);
  try {
    localStorage.setItem(ROOM_KEY, JSON.stringify(room));
  } catch {
    /* ignore */
  }
}

export function clearHostRoom(): void {
  hostRoom.set(null);
  try {
    localStorage.removeItem(ROOM_KEY);
  } catch {
    /* ignore */
  }
}
