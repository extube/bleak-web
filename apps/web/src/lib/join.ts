/**
 * Join-flow domain module (DESIGN §3.1 rev. 3, TZ-03 + TZ2-06 Part B):
 * invite-code validation, the pure step machine for the Step 1 → 3a/3b
 * flow, deep-link parsing, the API orchestration services (mount-time
 * fetches only — no Poller on `/`, §2.2) and the error mappings for every
 * §3.1 interaction state.
 *
 * v2 (Concept §6.2, ARCHITECTURE §10.6):
 * - code resolution goes through the `resolveInviteCode` seam (§6.9b);
 * - persona creation carries `invite_code` + a client-generated raw token
 *   in the body (NO auth header) and writes the identity + the device
 *   token vault ONLY after a 2xx;
 * - the vault picker is the RETURN screen (Concept §10.1.1, DESIGN
 *   §4.11.1 — amends §6.2 import semantics): selecting a saved persona
 *   enters THAT room with its stored token — identity restore, no
 *   re-creation (no helper copy call, no persona POST). The picker lists
 *   `bleak.tokenVault` entries — NEVER `GET /api/room` or any server-side
 *   persona picker — and validates the stored token with the documented
 *   explicit-token read (a stale token's 401 still hits the global §2.8
 *   gate; the row shows the dead-note treatment and does not enter).
 */
import type { CreateUserRequestV2, Room, User } from '@bleak/api-client';
import { ApiError, NetworkError } from '@bleak/api-client';
import { api } from '#lib/api/client';
import { InviteResolveError, resolveInviteCode } from '#lib/api/invite-resolve';
import { generateTokenSecret } from '#lib/crypto/secrets';
import type { VaultEntry } from '#lib/stores/tokenVault';

const CODE_PATTERN = /^\d{6}$/;

/** The 6-digit invite code is not the room address (Concept §1). */
export function isValidInviteCode(code: string): boolean {
  return CODE_PATTERN.test(code);
}

// ---------------------------------------------------------------------------
// API surface (dependency-injected for tests; defaults are the real clients)
// ---------------------------------------------------------------------------

export interface JoinClients {
  resolveInvite: (code: string) => Promise<{ roomAddress: string }>;
  getRoom: (address: string) => Promise<Room>;
  listRoomUsers: (room: string) => Promise<User[]>;
  /**
   * Credentialed persona read — the join layer passes the credential
   * explicitly (the vault entry's stored token, §10.6 return-flow
   * validation). The attendee context's global 401 gate still applies.
   */
  getRoomUser: (room: string, address: string, options?: { token?: string }) => Promise<User>;
  /** Persona creation: NO auth header — the body carries the credentials. */
  createRoomUser: (room: string, request: CreateUserRequestV2) => Promise<User>;
  /** The client-side token generator (injectable for deterministic tests). */
  generateToken: () => string;
}

const defaultClients: JoinClients = {
  resolveInvite: resolveInviteCode,
  getRoom: (address) => api.getRoom(address),
  listRoomUsers: (room) => api.listRoomUsers(room),
  getRoomUser: (room, address, options) => api.getRoomUser(room, address, options),
  createRoomUser: (room, request) => api.createRoomUser(room, request),
  generateToken: () => generateTokenSecret()
};

/**
 * A persona form value (Step 3a fields). `contact` (DESIGN §4.14.3,
 * Concept §14.1.3) is CLIENT-LOCAL data: the backend user model has no
 * contact field, so createPersona never sends it — the caller persists it
 * to the contactCard store after the 2xx.
 */
export interface PersonaDraft {
  name: string;
  publicBio: string;
  privateBio: string;
  /** Optional: only the creation form (PersonaForm) collects it — the
   * edit flow (PersonaEditor + ContactCardEditor) does not duplicate the
   * editor, so an edit-save never carries contact data. */
  contact?: string;
}

/**
 * Resolve a code to the room preview: invite-resolve seam → room → member
 * count. Three sequential reads; each is awaited before the card swaps
 * (§3.1 step 2). All reads are public (no token, §10.2).
 */
export async function resolveRoomByCode(
  code: string,
  clients: JoinClients = defaultClients
): Promise<{ room: Room; members: User[] }> {
  const info = await clients.resolveInvite(code);
  const [room, members] = await Promise.all([
    clients.getRoom(info.roomAddress),
    clients.listRoomUsers(info.roomAddress)
  ]);
  return { room, members };
}

/**
 * Create the persona in the target room (§3.1 step 3a): a client-generated
 * raw token rides in the body together with `invite_code`; NO auth header
 * (join, §10.2). Returns the created persona AND the generated token so
 * the caller can persist identity + vault entry — both writes happen ONLY
 * after this 2xx.
 */
export async function createPersona(
  roomAddress: string,
  inviteCode: string,
  draft: PersonaDraft,
  clients: JoinClients = defaultClients
): Promise<{ user: User; token: string }> {
  const name = draft.name.trim();
  const token = clients.generateToken();
  // NOTE: draft.contact is deliberately NOT sent — local-only contact card
  // (§4.14.3); the caller writes it to the contactCard store after the 2xx.
  const user = await clients.createRoomUser(roomAddress, {
    name,
    ...(draft.publicBio.trim() !== '' ? { public_bio: draft.publicBio.trim() } : {}),
    ...(draft.privateBio.trim() !== '' ? { private_bio: draft.privateBio.trim() } : {}),
    invite_code: inviteCode,
    token
  });
  return { user, token };
}

/**
 * Return-flow validation read (Concept §10.1.1 / DESIGN §4.11.1): fetch
 * the saved persona WITH its stored token (the documented explicit-token
 * override, §10.6). One credentialed read per selection; a 2xx means the
 * stored credential is live → the caller restores the identity from the
 * entry and enters the room. The vault entry itself is never mutated or
 * removed (append-only); a 404/403/401 surfaces the dead-entry treatment
 * on the row (401 also trips the global §2.8 gate underneath).
 */
export function verifyVaultEntry(
  entry: VaultEntry,
  clients: JoinClients = defaultClients
): Promise<User> {
  return clients.getRoomUser(entry.roomAddress, entry.userAddress, { token: entry.token });
}

// ---------------------------------------------------------------------------
// Error mapping (§3.1 interaction states + §2.9 credential states)
// ---------------------------------------------------------------------------

/** Code-resolution errors: inline under the cells (malformed/not_found),
 * banner (network/api) or the gone-card state (room deleted meanwhile, 404 on
 * getRoom/createRoomUser). */
export type CodeError = 'malformed' | 'not_found' | 'network' | 'api' | 'gone';

export function codeErrorOf(err: unknown): { kind: CodeError; text: string | null } {
  if (err instanceof NetworkError) return { kind: 'network', text: null };
  if (err instanceof InviteResolveError) {
    // The seam's mapped kinds are exactly the inline error kinds (§3.1).
    return { kind: err.kind, text: null };
  }
  if (err instanceof ApiError) {
    if (err.status === 404) return { kind: 'gone', text: null }; // room deleted meanwhile
    return { kind: 'api', text: apiErrorText(err) };
  }
  return { kind: 'api', text: err instanceof Error ? err.message : null };
}

/**
 * Persona-submit errors (§3.1 state table): field-level inline (400), the
 * 409 name-taken copy, the gone card — and the §2.9 invite-code state:
 * the creation rejected OVER the code (401/403/410 on create — the code is
 * the creation credential; there is no auth header to be invalidated).
 */
export type PersonaError = 'name_required' | 'name_taken' | 'invite' | 'gone' | 'network' | 'api';

export function personaErrorOf(err: unknown): { kind: PersonaError; text: string | null } {
  if (err instanceof NetworkError) return { kind: 'network', text: null };
  if (err instanceof ApiError) {
    if (err.status === 409) return { kind: 'name_taken', text: null };
    if (err.status === 404) return { kind: 'gone', text: null };
    if (err.status === 401 || err.status === 403 || err.status === 410) {
      return { kind: 'invite', text: null };
    }
    return { kind: 'api', text: apiErrorText(err) };
  }
  return { kind: 'api', text: err instanceof Error ? err.message : null };
}

/**
 * Return-read errors: a dead/stale entry (server 404/401/403 or another
 * rejection on the credentialed read) surfaces honestly on the row (the
 * entry is never removed, append-only vault); the entry stays listed and
 * the flow does NOT enter. A 401 has additionally tripped the global §2.8
 * gate (identity cleared, notice flag set) — on `/` that is the stale-
 * token path, and the row still shows the dead-note.
 */
export type VaultError = 'dead' | 'network';

export function vaultErrorOf(err: unknown): { kind: VaultError; text: string | null } {
  if (err instanceof NetworkError) return { kind: 'network', text: null };
  if (err instanceof ApiError) return { kind: 'dead', text: apiErrorText(err) };
  return { kind: 'dead', text: err instanceof Error ? err.message : String(err) };
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
// Deep links (§3.1: ?code=NNNNNN invite link · ?u={userAddress}&m={code} and
// ?u={userAddress} persona QR — the single-use mutual code is optional;
// its absence selects the single-direction handshake variant, §3.8)
// ---------------------------------------------------------------------------

export type DeepLink =
  | { kind: 'code'; code: string }
  | { kind: 'user'; userAddress: string; mutualCode: string | null }
  | null;

/** Accepts URLSearchParams or SvelteKit's ReadonlyURLSearchParams. */
export function parseJoinDeepLink(params: { get(name: string): string | null }): DeepLink {
  const code = params.get('code');
  if (code !== null && isValidInviteCode(code)) return { kind: 'code', code };
  const user = params.get('u');
  if (user !== null && user !== '') {
    const mutual = params.get('m');
    return {
      kind: 'user',
      userAddress: user,
      mutualCode: mutual !== null && mutual !== '' ? mutual : null
    };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Step machine (pure, unit-tested)
// ---------------------------------------------------------------------------

export type JoinStep = 'code' | 'room' | 'persona' | 'vault';

export interface JoinState {
  step: JoinStep;
  /** Entered digits (kept verbatim on failures — §3.1 AC 4/5). */
  code: string;
  /** Resolved room preview (Step 2). */
  room: Room | null;
  /** Members of the target room (count only, §3.1). */
  members: User[];
}

export const initialJoinState: JoinState = {
  step: 'code',
  code: '',
  room: null,
  members: []
};

export type JoinEvent =
  | { type: 'code-input'; code: string }
  | { type: 'resolved'; room: Room; members: User[] }
  | { type: 'choose-create' }
  | { type: 'choose-return' }
  | { type: 'change-code' }
  | { type: 'back' };

/** Back navigation per step: persona → room preview, vault (the return
 * screen) → code entry, room → code entry. */
function previousStep(state: JoinState): JoinStep {
  switch (state.step) {
    case 'persona':
      return 'room';
    case 'vault':
      return 'code';
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
      return { ...state, step: 'persona' };
    case 'choose-return':
      return { ...state, step: 'vault' };
    case 'change-code':
      return { ...initialJoinState };
    case 'back':
      return { ...state, step: previousStep(state) };
  }
}
