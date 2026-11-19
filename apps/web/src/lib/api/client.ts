/**
 * Web API layer (v2 credentials, ARCHITECTURE §10.3): two credential
 * contexts over the delivered TZ2-02 `@bleak/api-client` transport.
 *
 * - `api`     — the attendee (persona) context: every persona-credentialed
 *               call auto-carries `identity.token` (`Authorization: Bearer`).
 * - `hostApi` — the host (room) context: room-token calls auto-carry
 *               `bleak.hostRoom.roomToken`.
 * - `apiRaw`  — the ungated underlying client. RESTRICTED (§10.3 escape
 *               hatch): only the web api module itself and (from TZ2-06
 *               Part D) the transcript's host-view fallback may import it —
 *               enforced by a grep test.
 *
 * Pages never pass tokens manually: the injection maps below are the single
 * place the §10.2 attachment policy lives in the web app, mirrored by the
 * api-contexts unit test. The ONLY documented explicit-token override is
 * the vault-import read (a stale vault persona's stored token, §3.1) — an
 * override does NOT bypass the 401 gate.
 *
 * Global 401 gate (Concept §6.1): any 401 on an attendee-credentialed call
 * clears the identity (+ the one-time mutual code with it, §10.4), sets the
 * `bleak.authNotice` sessionStorage flag, navigates to `/` and rethrows —
 * no stale error UI flashes under the redirect. The host gate is symmetric
 * without navigation: 401/403 on a room-token call clears `bleak.hostRoom`
 * and sets `bleak.hostReset` (§3.7 host reset) — attendee identity is never
 * touched. Room creation is NOT gated (its credential is the one-time
 * creation token, consumed on use — a rejection is the §3.7 token-gate
 * state, not a revoked-room reset).
 */
import { get } from 'svelte/store';
import { goto } from '$app/navigation';
import { resolve } from '$app/paths';
import { BleakClient, ApiError } from '@bleak/api-client';
import type {
  Chat,
  ClearChatResponse,
  Contact,
  CreateHandshakeRequest,
  CreateRoomRequestV2,
  CreateUserRequest,
  CreateUserRequestV2,
  CredentialOptions,
  Greeting,
  Handshake,
  Interest,
  InterestInput,
  Invite,
  InviteMintRequest,
  KickoffResponse,
  MatchResult,
  Message,
  MutualHandshakeRequest,
  MutualHandshakeResponse,
  Room,
  UpdateRoomRequest,
  UpdateUserRequest,
  User
} from '@bleak/api-client';
import { API_BASE } from '#lib/config';
import { clearIdentity, identity } from '#lib/stores/identity';
import { hostRoom, clearHostRoom } from '#lib/stores/hostSession';

/** Late-binding fetch: tests can stub the global AFTER this module loads. */
const lateFetch: typeof fetch = (...args) => globalThis.fetch(...args);

/** The ungated underlying client. RESTRICTED — see the module doc. */
export const apiRaw = new BleakClient({ baseUrl: API_BASE, fetch: lateFetch });

// ---------------------------------------------------------------------------
// Injection maps (the §10.2 attachment policy, web-layer form)
// ---------------------------------------------------------------------------

/**
 * Methods whose calls auto-carry the persona Bearer (`identity.token`) on
 * the attendee `api` context. Mirrors ARCHITECTURE §10.2:
 * persona mutations, gated reads, handshake sends, the mutual call,
 * rotations and (attendee-context) chat reads/clear/kickoff, plus the v3
 * interests upsert/delete (DESIGN §4.13.1 — the persona's own rows).
 * `getRoomUser` is the documented context-dependent case: the Bearer is
 * attached only for the attendee's OWN address (the gated read returning
 * `private_bio` / `mutual_code_live`); reads of other personas stay public
 * (no token), and the explicit-token override always wins (vault import).
 */
export const PERSONA_TOKEN_METHODS = [
  'createMutualHandshake',
  'createHandshake',
  'registerMutualCode',
  'rotateUserToken',
  'updateRoomUser',
  'deleteRoomUser',
  'getUserGreeting',
  'putUserGreeting',
  'regenerateGreeting',
  'getRoomUser',
  'listHandshakesOfUser',
  'listChatsOfUser',
  'getChat',
  'listChatMessages',
  'kickoffChat',
  'clearChatHistory',
  // v3 interests (DESIGN §4.13.1): the persona's own rows
  'addUserInterests',
  'deleteUserInterests',
  // v3 contact share (DESIGN §4.13.3): the FROM persona's Bearer on the
  // share; the RECIPIENT-only read is called with the attendee's own
  // persona token ("me") — both auto-inject the identity token.
  'shareContact',
  'listContactsSharedWith',
  // v3 match score (DESIGN §4.13.4): the caller grades AS itself — the
  // persona passes ITSELF as first_user_address, its own Bearer auto-injected.
  'matchV2'
] as const;

/**
 * Methods whose calls auto-carry the room Bearer (`bleak.hostRoom.roomToken`)
 * on the host `hostApi` context: room settings/delete, invite management,
 * room rotation and (host-context) chat reads/clear/kickoff — the member
 * drill-down surface. `listHandshakesOfUser` is deliberately NOT mapped:
 * it is a persona-scoped gated read with no room-token endpoint (flag 6.9a);
 * the v2 console ships counts-less (the transitional token-less host
 * listing was dropped from the host context with the v2 console — TZ2-07).
 */
export const ROOM_TOKEN_METHODS = [
  'updateRoom',
  'deleteRoom',
  'listInvites',
  'mintInvite',
  'revokeInvite',
  'rotateRoomToken',
  'listChatsOfRoomUser',
  'listRoomUserChatMessages',
  'getChat',
  'listChatMessages',
  'kickoffChat',
  'clearChatHistory'
] as const;

// ---------------------------------------------------------------------------
// 401 gates (Concept §6.1 / ARCHITECTURE §10.3)
// ---------------------------------------------------------------------------

/** Consumed by the `/` join page on mount (§2.8 notice card). */
export const AUTH_NOTICE_KEY = 'bleak.authNotice';
/** Consumed by the `/host` console on mount (§3.7 reset notice). */
export const HOST_RESET_KEY = 'bleak.hostReset';

function setFlag(key: string): void {
  try {
    sessionStorage.setItem(key, '1');
  } catch {
    /* storage unavailable — the page-level notices are best-effort */
  }
}

/** Global attendee gate: clear identity (+ mutual code), flag, navigate, rethrow. */
async function personaGate<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (cause) {
    if (cause instanceof ApiError && cause.status === 401) {
      clearIdentity(); // also clears the one-time mutual code (§10.4)
      setFlag(AUTH_NOTICE_KEY);
      await goto(resolve('/')); // navigation queued; the error is rethrown below
    }
    throw cause;
  }
}

/** Host gate: clear the room session + flag, rethrow (no navigation). */
async function roomGate<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (cause) {
    if (cause instanceof ApiError && (cause.status === 401 || cause.status === 403)) {
      clearHostRoom();
      setFlag(HOST_RESET_KEY);
    }
    throw cause;
  }
}

// ---------------------------------------------------------------------------
// Credential resolution (explicit override wins; else the context's token)
// ---------------------------------------------------------------------------

type CredentialSource = () => string | undefined;

const personaCredential: CredentialSource = () => get(identity)?.token;
const roomCredential: CredentialSource = () => get(hostRoom)?.roomToken;

function credential(
  source: CredentialSource,
  options?: CredentialOptions
): CredentialOptions | undefined {
  const explicit = options?.token;
  if (explicit !== undefined && explicit !== '') return options;
  const injected = source();
  if (injected === undefined || injected === '') return options; // nothing held → v1 behavior
  return { ...options, token: injected };
}

/** Own-address predicate for the context-dependent `getRoomUser`. */
function ownAddress(address: string): boolean {
  return get(identity)?.userAddress === address;
}

// ---------------------------------------------------------------------------
// api — attendee (persona) context
// ---------------------------------------------------------------------------

/** Attendee context: persona-credentialed calls auto-carry `identity.token`. */
export const api = {
  // Public reads — MUST NOT carry a token (§10.2 policy table).
  listRooms(): Promise<Room[]> {
    return apiRaw.listRooms();
  },
  getRoom(address: string): Promise<Room> {
    return apiRaw.getRoom(address);
  },
  listRoomUsers(room: string): Promise<User[]> {
    return apiRaw.listRoomUsers(room);
  },
  /** Persona creation (join): NO auth header — the body carries
   * `invite_code` + the raw client-generated token (§10.2). */
  createRoomUser(room: string, request: CreateUserRequestV2 | CreateUserRequest): Promise<User> {
    return apiRaw.createRoomUser(room, request);
  },
  /**
   * Context-dependent gated read: WITH the persona token for the attendee's
   * own address (`private_bio` + `mutual_code_live`), public (no token) for
   * other personas. The explicit-token override is the documented vault-import
   * path (the old persona's stored token — its 401 still hits the global gate).
   */
  getRoomUser(room: string, address: string, options?: CredentialOptions): Promise<User> {
    const token = options?.token ?? (ownAddress(address) ? personaCredential() : undefined);
    return personaGate(() =>
      apiRaw.getRoomUser(room, address, token !== undefined ? { token } : undefined)
    );
  },

  // Persona-credentialed mutations (auto Bearer; explicit override wins).
  updateRoomUser(
    room: string,
    address: string,
    request: UpdateUserRequest,
    options?: CredentialOptions
  ): Promise<User> {
    return personaGate(() =>
      apiRaw.updateRoomUser(room, address, request, credential(personaCredential, options))
    );
  },
  deleteRoomUser(room: string, address: string, options?: CredentialOptions): Promise<void> {
    return personaGate(() =>
      apiRaw.deleteRoomUser(room, address, credential(personaCredential, options))
    );
  },
  getUserGreeting(room: string, address: string, options?: CredentialOptions): Promise<Greeting> {
    return personaGate(() =>
      apiRaw.getUserGreeting(room, address, credential(personaCredential, options))
    );
  },
  putUserGreeting(
    room: string,
    address: string,
    greeting: string,
    options?: CredentialOptions
  ): Promise<Greeting> {
    return personaGate(() =>
      apiRaw.putUserGreeting(room, address, greeting, credential(personaCredential, options))
    );
  },
  regenerateGreeting(room: string, address: string, options?: CredentialOptions): Promise<Greeting> {
    return personaGate(() =>
      apiRaw.regenerateGreeting(room, address, credential(personaCredential, options))
    );
  },

  // Handshakes (the `from` persona's token — auto-injected).
  createHandshake(
    request: CreateHandshakeRequest,
    options?: CredentialOptions
  ): Promise<Handshake> {
    return personaGate(() =>
      apiRaw.createHandshake(request, credential(personaCredential, options))
    );
  },
  /** Server-mediated mutual handshake (scanner): the scanner's persona
   * Bearer is auto-injected. 410 = stale code, 403 = income rule. */
  createMutualHandshake(request: MutualHandshakeRequest): Promise<MutualHandshakeResponse> {
    return personaGate(() => apiRaw.createMutualHandshake(personaCredential() ?? '', request));
  },

  // Gated reads (auto Bearer).
  listHandshakesOfUser(address: string, options?: CredentialOptions): Promise<Handshake[]> {
    return personaGate(() =>
      apiRaw.listHandshakesOfUser(address, credential(personaCredential, options))
    );
  },
  listChatsOfUser(address: string, options?: CredentialOptions): Promise<Chat[]> {
    return personaGate(() =>
      apiRaw.listChatsOfUser(address, credential(personaCredential, options))
    );
  },

  // Chat reads / actions — attendee context → persona token (§10.3).
  getChat(address: string, options?: CredentialOptions): Promise<Chat> {
    return personaGate(() => apiRaw.getChat(address, credential(personaCredential, options)));
  },
  listChatMessages(address: string, options?: CredentialOptions): Promise<Message[]> {
    return personaGate(() =>
      apiRaw.listChatMessages(address, credential(personaCredential, options))
    );
  },
  kickoffChat(address: string, options?: CredentialOptions): Promise<KickoffResponse> {
    return personaGate(() =>
      apiRaw.kickoffChat(address, credential(personaCredential, options))
    );
  },
  clearChatHistory(address: string, options?: CredentialOptions): Promise<ClearChatResponse> {
    return personaGate(() =>
      apiRaw.clearChatHistory(address, credential(personaCredential, options))
    );
  },

  // Badge live-QR: the body carries the code's HASH only (§7.4).
  registerMutualCode(room: string, address: string, mutualCodeHash: string): Promise<void> {
    return personaGate(() =>
      apiRaw.registerMutualCode(room, address, personaCredential() ?? '', mutualCodeHash)
    );
  },

  // Token rotation: Bearer = the CURRENT persona token, body = the new raw.
  rotateUserToken(room: string, address: string, newRawToken: string): Promise<void> {
    return personaGate(() =>
      apiRaw.rotateUserToken(room, address, personaCredential() ?? '', newRawToken)
    );
  },

  // Interests (DESIGN §4.13.1): bulk upsert (→ 201 FULL list) and delete by
  // keys (→ 200 REMAINING, idempotent) — the persona's own Bearer, and the
  // only writes feeding the local mirror (the API has no interests GET).
  addUserInterests(
    room: string,
    address: string,
    interests: InterestInput[],
    options?: CredentialOptions
  ): Promise<Interest[]> {
    return personaGate(() =>
      apiRaw.addUserInterests(room, address, interests, credential(personaCredential, options))
    );
  },
  deleteUserInterests(
    room: string,
    address: string,
    keys: number[],
    options?: CredentialOptions
  ): Promise<Interest[]> {
    return personaGate(() =>
      apiRaw.deleteUserInterests(room, address, keys, credential(personaCredential, options))
    );
  },

  // Contact share (DESIGN §4.13.3): POST /api/contact carries the FROM
  // persona's Bearer (auto-injected); GET /api/contact/{me} is the
  // recipient-only read — the attendee's own persona token (auto-injected).
  // A repeated share answers 409 (once per pair) — pages map it to the
  // "already shared" state, never an error.
  shareContact(
    to: string,
    content: string,
    from: string,
    options?: CredentialOptions
  ): Promise<Contact> {
    return personaGate(() =>
      apiRaw.shareContact(to, content, from, credential(personaCredential, options))
    );
  },
  listContactsSharedWith(address: string, options?: CredentialOptions): Promise<Contact[]> {
    return personaGate(() =>
      apiRaw.listContactsSharedWith(address, credential(personaCredential, options))
    );
  },

  // Match score (DESIGN §4.13.4): POST /api/match/v2 graded AS the caller —
  // the attendee passes ITSELF as `first_user_address` (its own Bearer,
  // auto-injected). Feeds the score-first /chats ordering (finished pairs
  // only, fetched from the matchScores session cache's refresh cadence).
  matchV2(room: string, first: string, second: string): Promise<MatchResult> {
    return personaGate(() => apiRaw.matchV2(room, first, second, credential(personaCredential)));
  }
};

// ---------------------------------------------------------------------------
// hostApi — host (room) context
// ---------------------------------------------------------------------------

/** Host context: room-credentialed calls auto-carry the room token. */
export const hostApi = {
  // Public reads — no token.
  getRoom(address: string): Promise<Room> {
    return apiRaw.getRoom(address);
  },
  listRoomUsers(room: string): Promise<User[]> {
    return apiRaw.listRoomUsers(room);
  },
  /** Public-fields read in the host context (no persona credential here). */
  getRoomUser(room: string, address: string): Promise<User> {
    return apiRaw.getRoomUser(room, address);
  },

  /**
   * Room creation — NOT gated by the room-token gate: its credential is the
   * one-time creation token (header, consumed on use) + the client-generated
   * room token in the body. A 401/403 is the §3.7 token-gate rejection.
   */
  createRoom(request: CreateRoomRequestV2, createToken: string): Promise<Room> {
    return apiRaw.createRoom(request, createToken);
  },

  /**
   * Host create flow composite (the mechanical v2 replacement of the retired
   * helper `POST /h/rooms`): creates the room, then mints the room's first
   * invite code with the just-generated room token (CONCEPT §7.2). Returns
   * `{ room, code }`; the invite link is computed client-side from the code.
   */
  async createRoomWithInvite(
    request: CreateRoomRequestV2,
    createToken: string
  ): Promise<{ room: Room; code: string }> {
    const room = await apiRaw.createRoom(request, createToken);
    const invite = await roomGate(() => apiRaw.mintInvite(room.address, request.token));
    return { room, code: invite.code };
  },

  // Room settings / delete (room Bearer, gated).
  updateRoom(address: string, request: UpdateRoomRequest): Promise<Room> {
    return roomGate(() => apiRaw.updateRoom(address, request, credential(roomCredential)));
  },
  deleteRoom(address: string): Promise<Room> {
    return roomGate(() => apiRaw.deleteRoom(address, credential(roomCredential)));
  },

  // Invite management (room Bearer, gated) — CONCEPT §7.2.
  listInvites(address: string): Promise<Invite[]> {
    return roomGate(() => apiRaw.listInvites(address, roomCredential() ?? ''));
  },
  mintInvite(address: string, request: InviteMintRequest = {}): Promise<Invite> {
    return roomGate(() => apiRaw.mintInvite(address, roomCredential() ?? '', request));
  },
  revokeInvite(address: string, code: string): Promise<void> {
    return roomGate(() => apiRaw.revokeInvite(address, code, roomCredential() ?? ''));
  },

  // Room-token rotation: Bearer = the CURRENT room token, body = the new raw.
  rotateRoomToken(address: string, newRawToken: string): Promise<void> {
    return roomGate(() =>
      apiRaw.rotateRoomToken(address, roomCredential() ?? '', newRawToken)
    );
  },

  // Member drill-down (room Bearer, gated) — plain chat reads, the
  // amendment-independent path (ARCHITECTURE §10.3; flag 6.9a).
  listChatsOfRoomUser(room: string, address: string): Promise<Chat[]> {
    return roomGate(() =>
      apiRaw.listChatsOfRoomUser(room, address, credential(roomCredential))
    );
  },
  listRoomUserChatMessages(room: string, address: string, chat: string): Promise<Message[]> {
    return roomGate(() =>
      apiRaw.listRoomUserChatMessages(room, address, chat, credential(roomCredential))
    );
  },

  // Chat reads / actions — host context → room token (§10.3).
  getChat(address: string): Promise<Chat> {
    return roomGate(() => apiRaw.getChat(address, credential(roomCredential)));
  },
  listChatMessages(address: string): Promise<Message[]> {
    return roomGate(() => apiRaw.listChatMessages(address, credential(roomCredential)));
  },
  kickoffChat(address: string): Promise<KickoffResponse> {
    return roomGate(() => apiRaw.kickoffChat(address, credential(roomCredential)));
  },
  clearChatHistory(address: string): Promise<ClearChatResponse> {
    return roomGate(() => apiRaw.clearChatHistory(address, credential(roomCredential)));
  }
};
