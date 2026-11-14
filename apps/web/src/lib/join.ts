/**
 * Join-flow domain module (DESIGN §3.1, TZ-03): invite-code validation, the
 * pure step machine for the Step 1 → 3a/3b flow, deep-link parsing, the
 * API orchestration services (mount-time fetches only — no Poller on `/`,
 * §2.2) and the error mappings for every §3.1 interaction state.
 */
import type { CreateUserRequest, Room, User } from '@bleak/api-client';
import { ApiError, NetworkError } from '@bleak/api-client';
import { HelperError, resolveInvite } from '#lib/api/helper';
import { api } from '#lib/api/client';

const CODE_PATTERN = /^\d{6}$/;

/** The 6-digit invite code is not the room address (Concept §1). */
export function isValidInviteCode(code: string): boolean {
  return CODE_PATTERN.test(code);
}

// ---------------------------------------------------------------------------
// API surface (dependency-injected for tests; defaults are the real clients)
// ---------------------------------------------------------------------------

export interface JoinClients {
  resolveInvite: (code: string) => Promise<{ code: string; room_address: string }>;
  getRoom: (address: string) => Promise<Room>;
  listRooms: () => Promise<Room[]>;
  listRoomUsers: (room: string) => Promise<User[]>;
  getRoomUser: (room: string, address: string) => Promise<User>;
  createRoomUser: (room: string, request: CreateUserRequest) => Promise<User>;
}

const defaultClients: JoinClients = {
  resolveInvite,
  getRoom: (address) => api.getRoom(address),
  listRooms: () => api.listRooms(),
  listRoomUsers: (room) => api.listRoomUsers(room),
  getRoomUser: (room, address) => api.getRoomUser(room, address),
  createRoomUser: (room, request) => api.createRoomUser(room, request)
};

/** A persona form value (Step 3a fields; import prefills these). */
export interface PersonaDraft {
  name: string;
  publicBio: string;
  privateBio: string;
}

/**
 * Resolve a code to the room preview: helper mapping → room → member count.
 * Three sequential reads; each is awaited before the card swaps (§3.1 step 2).
 */
export async function resolveRoomByCode(
  code: string,
  clients: JoinClients = defaultClients
): Promise<{ room: Room; members: User[] }> {
  const info = await clients.resolveInvite(code);
  const [room, members] = await Promise.all([
    clients.getRoom(info.room_address),
    clients.listRoomUsers(info.room_address)
  ]);
  return { room, members };
}

/** Import picker: all non-deleted rooms (GET /api/room). */
export function listImportRooms(clients: JoinClients = defaultClients): Promise<Room[]> {
  return clients.listRooms();
}

/**
 * Import step 2: personas of the chosen old room (read 1 of the copy — the
 * persona list). Import is a client-side copy (architecture §8.4): exactly
 * two reads (listRoomUsers + getRoomUser) + one create per import.
 */
export function listImportPersonas(
  roomAddress: string,
  clients: JoinClients = defaultClients
): Promise<User[]> {
  return clients.listRoomUsers(roomAddress);
}

/** Import prefill source: the old persona (read 2 of the copy). */
export function readImportPersona(
  roomAddress: string,
  userAddress: string,
  clients: JoinClients = defaultClients
): Promise<User> {
  return clients.getRoomUser(roomAddress, userAddress);
}

/**
 * Create the persona in the target room (the one create of the copy when
 * importing — a NEW user, never the old address, ruling 5 / §8.4).
 */
export async function createPersona(
  roomAddress: string,
  draft: PersonaDraft,
  clients: JoinClients = defaultClients
): Promise<User> {
  const name = draft.name.trim();
  return clients.createRoomUser(roomAddress, {
    name,
    ...(draft.publicBio.trim() !== '' ? { public_bio: draft.publicBio.trim() } : {}),
    ...(draft.privateBio.trim() !== '' ? { private_bio: draft.privateBio.trim() } : {})
  });
}

// ---------------------------------------------------------------------------
// Error mapping (§3.1 interaction states)
// ---------------------------------------------------------------------------

/** Code-resolution errors: inline under the cells (400/404), banner
 * (network/api) or the gone-card state (room deleted meanwhile, 404 on
 * getRoom/createRoomUser). */
export type CodeError = 'malformed' | 'not_found' | 'network' | 'api' | 'gone';

export function codeErrorOf(err: unknown): { kind: CodeError; text: string | null } {
  if (err instanceof NetworkError) return { kind: 'network', text: null };
  if (err instanceof HelperError) {
    if (err.status === 400) return { kind: 'malformed', text: null };
    if (err.status === 404) return { kind: 'not_found', text: null };
    return { kind: 'api', text: err.message };
  }
  if (err instanceof ApiError) {
    if (err.status === 404) return { kind: 'gone', text: null }; // room deleted meanwhile
    return { kind: 'api', text: apiErrorText(err) };
  }
  return { kind: 'api', text: err instanceof Error ? err.message : null };
}

/** Persona-submit errors: field-level inline (§3.1 state table). */
export type PersonaError = 'name_required' | 'name_taken' | 'gone' | 'network' | 'api';

export function personaErrorOf(err: unknown): { kind: PersonaError; text: string | null } {
  if (err instanceof NetworkError) return { kind: 'network', text: null };
  if (err instanceof ApiError) {
    if (err.status === 409) return { kind: 'name_taken', text: null };
    if (err.status === 404) return { kind: 'gone', text: null };
    return { kind: 'api', text: apiErrorText(err) };
  }
  return { kind: 'api', text: err instanceof Error ? err.message : null };
}

/** Import/room-list errors surface through the same banner as resolution. */
export type ListError = 'network' | 'api';

export function listErrorOf(err: unknown): { kind: ListError; text: string | null } {
  if (err instanceof NetworkError) return { kind: 'network', text: null };
  return { kind: 'api', text: err instanceof ApiError ? apiErrorText(err) : String(err) };
}

/** ApiError.message = "bleak-node <status> on <endpoint>: <server text>" —
 * the UI surfaces only the server's plain-text body. */
export function apiErrorText(err: ApiError): string {
  const marker = ': ';
  const idx = err.message.indexOf(marker);
  return idx >= 0 ? err.message.slice(idx + marker.length) : err.message;
}

// ---------------------------------------------------------------------------
// Deep links (§3.1: ?code=NNNNNN invite link · ?u={userAddress} persona QR)
// ---------------------------------------------------------------------------

export type DeepLink = { kind: 'code'; code: string } | { kind: 'user'; userAddress: string } | null;

export function parseJoinDeepLink(params: URLSearchParams): DeepLink {
  const code = params.get('code');
  if (code !== null && isValidInviteCode(code)) return { kind: 'code', code };
  const user = params.get('u');
  if (user !== null && user !== '') return { kind: 'user', userAddress: user };
  return null;
}

// ---------------------------------------------------------------------------
// Step machine (pure, unit-tested)
// ---------------------------------------------------------------------------

export type JoinStep = 'code' | 'room' | 'persona' | 'rooms' | 'users';

export interface JoinState {
  step: JoinStep;
  /** Entered digits (kept verbatim on failures — §3.1 AC 4/5). */
  code: string;
  /** Resolved room preview (Step 2). */
  room: Room | null;
  /** Members of the target room (count only, §3.1). */
  members: User[];
  /** Chosen old room in the import flow. */
  importRoom: Room | null;
  /** Personas of the chosen old room. */
  importUsers: User[];
  /** Prefilled persona form (import) + the copy notice. */
  prefill: PersonaDraft | null;
}

export const initialJoinState: JoinState = {
  step: 'code',
  code: '',
  room: null,
  members: [],
  importRoom: null,
  importUsers: [],
  prefill: null
};

export type JoinEvent =
  | { type: 'code-input'; code: string }
  | { type: 'resolved'; room: Room; members: User[] }
  | { type: 'choose-create' }
  | { type: 'choose-import' }
  | { type: 'import-room-picked'; room: Room; users: User[] }
  | { type: 'import-user-picked'; user: User }
  | { type: 'change-code' }
  | { type: 'back' };

/** Back navigation per step: persona → (import users | room), users → rooms,
 * rooms → room preview, room → code entry. */
function previousStep(state: JoinState): JoinStep {
  switch (state.step) {
    case 'persona':
      return state.prefill !== null ? 'users' : 'room';
    case 'users':
      return 'rooms';
    case 'rooms':
      return 'room';
    default:
      return 'code';
  }
}

export function reduce(state: JoinState, event: JoinEvent): JoinState {
  switch (event.type) {
    case 'code-input':
      return { ...state, code: event.code };
    case 'resolved':
      return { ...state, step: 'room', room: event.room, members: event.members };
    case 'choose-create':
      return { ...state, step: 'persona', prefill: null };
    case 'choose-import':
      return { ...state, step: 'rooms', importRoom: null, importUsers: [], prefill: null };
    case 'import-room-picked':
      return { ...state, step: 'users', importRoom: event.room, importUsers: event.users };
    case 'import-user-picked':
      return {
        ...state,
        step: 'persona',
        prefill: {
          name: event.user.name,
          publicBio: event.user.public_bio,
          privateBio: event.user.private_bio
        }
      };
    case 'change-code':
      return { ...initialJoinState };
    case 'back':
      return { ...state, step: previousStep(state) };
  }
}
