/**
 * Host-session persistence (v2: ARCHITECTURE §10.4/§10.9): the host's created
 * room reference — room address, client-generated room token and the invite
 * code — lives in localStorage under the single key `bleak.hostRoom`. The
 * room token is written nowhere else; the one-time CREATION token is never
 * persisted anywhere (consumed server-side on use). Both are runtime state an
 * operator can wipe.
 *
 * TRANSITION SHIM (to be removed by TZ2-11, host console v2): the v1 host
 * console (`routes/host/+page.svelte`) and its tests still use the v1
 * `hostToken` writable + persisted `bleak.hostToken` key and the v1
 * `roomName`/`inviteUrl` display fields. They are kept as clearly marked
 * `@deprecated` members so the v1 suite stays green on this branch; TZ2-11's
 * rewrite stops using them (the v2 console takes the creation token per
 * session and computes the invite link client-side), after which this file
 * carries exactly `HostRoomRef { roomAddress, roomToken, code }`.
 */
import { writable } from 'svelte/store';

export interface HostRoomRef {
  code: string;
  roomAddress: string;
  /**
   * v2 room credential (client-generated raw token, hashed server-side,
   * §10.4). Optional only during the transition: the v1 console still saves
   * references created before the credential model (and its tests seed
   * storage without it); TZ2-11 makes it required with its rewrite.
   */
  roomToken?: string;
  /** @deprecated v1 share-kit display field — removed by TZ2-11. */
  roomName: string;
  /** @deprecated v1 helper-supplied invite URL — removed by TZ2-11 (v2
   * computes the link client-side from the code). */
  inviteUrl: string;
}

const ROOM_KEY = 'bleak.hostRoom';
/** @deprecated v1 host-token key — removed by TZ2-11 together with the shim. */
const TOKEN_KEY = 'bleak.hostToken';

export const hostRoom = writable<HostRoomRef | null>(null);
/** @deprecated v1 host-token writable — removed by TZ2-11 (the v2 gate takes
 * the one-time creation token per session and never stores it). */
export const hostToken = writable('');

function readRoom(): HostRoomRef | null {
  try {
    const raw = localStorage.getItem(ROOM_KEY);
    if (raw === null) return null;
    const parsed = JSON.parse(raw) as Partial<HostRoomRef>;
    if (typeof parsed.code === 'string' && typeof parsed.roomAddress === 'string') {
      return {
        code: parsed.code,
        roomAddress: parsed.roomAddress,
        ...(typeof parsed.roomToken === 'string' && parsed.roomToken !== ''
          ? { roomToken: parsed.roomToken }
          : {}),
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
  hostRoom.set(readRoom());
  try {
    hostToken.set(localStorage.getItem(TOKEN_KEY) ?? '');
  } catch {
    /* storage unavailable */
    hostToken.set('');
  }
}

/**
 * Save/overwrite the room reference — room-token rotation rewrites the entry
 * in place through this same call (read current → `{ ...current, roomToken }`
 * → `saveHostRoom`), so the stored entry never holds a dead credential.
 */
export function saveHostRoom(room: HostRoomRef): void {
  hostRoom.set(room);
  try {
    localStorage.setItem(ROOM_KEY, JSON.stringify(room));
  } catch {
    /* ignore */
  }
}

/**
 * Room-token rotation (v2): rewrite the stored entry's `roomToken` in place.
 * No-op when no room session is stored.
 */
export function updateHostRoomToken(roomToken: string): void {
  const current = readRoom();
  if (current === null) return;
  saveHostRoom({ ...current, roomToken });
}

export function clearHostRoom(): void {
  hostRoom.set(null);
  try {
    localStorage.removeItem(ROOM_KEY);
  } catch {
    /* ignore */
  }
}

/** @deprecated v1 shim — removed by TZ2-11 (the creation token is never
 * stored in v2). Persists under `bleak.hostToken` only. */
export function saveHostToken(token: string): void {
  hostToken.set(token);
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    /* ignore */
  }
}

/** @deprecated v1 shim — removed by TZ2-11. */
export function forgetHostToken(): void {
  hostToken.set('');
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}
