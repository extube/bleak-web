/**
 * Host-session persistence (v2, ARCHITECTURE §10.4/§10.9): the host's created
 * room reference — room address, client-generated room token and the invite
 * code — lives in localStorage under the single key `bleak.hostRoom`. The
 * room token is written nowhere else (§10.11 custody rule); the one-time
 * CREATION token is never persisted anywhere (consumed server-side on use).
 * The v1 `hostToken` writable / `bleak.hostToken` key and the v1
 * `roomName`/`inviteUrl` display fields are REMOVED (the v2 console computes
 * the invite link client-side and reads the room name via a public `getRoom`).
 * Both are runtime state an operator can wipe.
 */
import { writable } from 'svelte/store';

export interface HostRoomRef {
  code: string;
  roomAddress: string;
  /** v2 room credential (client-generated raw token, hashed server-side). */
  roomToken: string;
}

const ROOM_KEY = 'bleak.hostRoom';

export const hostRoom = writable<HostRoomRef | null>(null);

function readRoom(): HostRoomRef | null {
  try {
    const raw = localStorage.getItem(ROOM_KEY);
    if (raw === null) return null;
    const parsed = JSON.parse(raw) as Partial<HostRoomRef>;
    if (
      typeof parsed.code === 'string' &&
      typeof parsed.roomAddress === 'string' &&
      typeof parsed.roomToken === 'string' &&
      parsed.roomToken !== ''
    ) {
      return {
        code: parsed.code,
        roomAddress: parsed.roomAddress,
        roomToken: parsed.roomToken
      };
    }
    // Unusable blob (v1-era reference predating the credential model): the
    // v2 console cannot operate it — treat as no room session and drop it.
    try {
      localStorage.removeItem(ROOM_KEY);
    } catch {
      /* ignore */
    }
  } catch {
    /* corrupted or unavailable storage — treat as no room */
  }
  return null;
}

/** Load persisted host session; call once from the /host route on mount. */
export function initHostSession(): void {
  hostRoom.set(readRoom());
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
