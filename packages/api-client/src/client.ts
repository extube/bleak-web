import type {
  Chat,
  ClearChatResponse,
  Contact,
  CreateHandshakeRequest,
  CreateRoomRequestV2,
  CreateRoomResponse,
  CreateUserRequest,
  CreateUserRequestV2,
  Greeting,
  AddInterestsRequest,
  DeleteInterestsRequest,
  Handshake,
  HardMatchRequest,
  HardMatchResult,
  Interest,
  InterestInput,
  Invite,
  InviteMintRequest,
  KickoffResponse,
  MatchRequest,
  MatchResult,
  MatchV2Request,
  Message,
  MutualHandshakeRequest,
  MutualHandshakeResponse,
  Room,
  SendMessageRequest,
  ShareContactRequest,
  Summary,
  TokenRotationRequest,
  UpdateRoomRequest,
  UpdateUserRequest,
  User
} from './types.js';
import { ApiError, NetworkError, ValidationError } from './errors.js';

export * from './types.js';
export { ApiError, NetworkError, ValidationError } from './errors.js';

/**
 * Per-call credential: attach a persona or room token to a credentialed
 * endpoint. When present, the transport sends `Authorization: Bearer <token>`
 * (CONCEPT §7.4 / ARCHITECTURE §10.2). Public reads have NO such parameter at
 * all — the attachment policy is enforced at the type level and mirrored by
 * the attachment-policy test.
 */
export interface CredentialOptions {
  token?: string;
}

/**
 * Typed client for the bleak-node REST API (Swagger 2.0 + the v2 credential
 * endpoints of CONCEPT §7 + the v3 contract of CONCEPT §13 / DESIGN §4.13 —
 * interests, matching, hard-match, shared contacts).
 *
 * One method per endpoint, in swagger path order. The client is
 * transport-agnostic: pass a custom `fetch` in tests (or for proxies); it
 * defaults to the global fetch in the browser. The client is pure: it never
 * reads stores/localStorage and accepts credentials only as arguments
 * (credential custody lives in the web layer, ARCHITECTURE §10.3/§10.11).
 */
export class BleakClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: { baseUrl?: string; fetch?: typeof fetch } = {}) {
    this.baseUrl = (options.baseUrl ?? '').replace(/\/+$/, '');
    this.fetchImpl = options.fetch ?? fetch.bind(globalThis);
  }

  // --- rooms ---------------------------------------------------------------

  /** GET /api/room — all non-deleted rooms. Public read: no token parameter. */
  async listRooms(): Promise<Room[]> {
    return this.getJson<Room[]>('/api/room');
  }

  /**
   * POST /api/room — host room creation (CONCEPT §7.1). The operator-granted
   * one-time creation token travels in the header and is consumed on use; the
   * client-generated room token is inside the body. This is the ONLY endpoint
   * with a non-Bearer credential header.
   */
  // Reconciled 2026-11-16 (WP-6): header name confirmed (`x-create-token`,
  // per swagger parameter + owner's landed-contract header). The response is
  // `server.CreateRoomResponse` — the room plus the FIRST minted invite code;
  // the web layer reads that field for its host-console display.
  async createRoom(request: CreateRoomRequestV2, createToken: string): Promise<CreateRoomResponse> {
    return this.request<CreateRoomResponse>('POST', '/api/room', request, {
      'x-create-token': createToken
    });
  }

  /** GET /api/room/{address}. Public read: no token parameter. */
  async getRoom(address: string): Promise<Room> {
    return this.getJson<Room>(`/api/room/${enc(address)}`);
  }

  /** PUT /api/room/{address} — omitted fields keep their value. Room token. */
  async updateRoom(
    address: string,
    request: UpdateRoomRequest,
    options?: CredentialOptions
  ): Promise<Room> {
    return this.putJson<Room>(`/api/room/${enc(address)}`, request, options);
  }

  /** DELETE /api/room/{address} — soft-deletes the room and its users. Room token. */
  async deleteRoom(address: string, options?: CredentialOptions): Promise<Room> {
    return this.deleteJson<Room>(`/api/room/${enc(address)}`, options);
  }

  // --- room users ----------------------------------------------------------

  /** GET /api/room/{room}/user — all non-deleted users of the room. Public read. */
  async listRoomUsers(room: string): Promise<User[]> {
    return this.getJson<User[]>(`/api/room/${enc(room)}/user`);
  }

  /**
   * POST /api/room/{room}/user — persona creation (join). No auth header: the
   * body carries `invite_code` + the RAW client-generated persona token
   * (CreateUserRequestV2, hashed server-side). The v1 body shape (name/bios
   * only) is still the documented v0.1.0 swagger contract and stays accepted
   * until the join flow is migrated and WP-6 lands.
   */
  async createRoomUser(
    room: string,
    request: CreateUserRequestV2 | CreateUserRequest
  ): Promise<User> {
    return this.postJson<User>(`/api/room/${enc(room)}/user`, request);
  }

  /**
   * GET /api/room/{room}/user/{address} — without a token a public read
   * (public fields only); WITH the persona token a gated read that also
   * returns `private_bio` and the derived `mutual_code_live` (CONCEPT §7.4).
   */
  async getRoomUser(
    room: string,
    address: string,
    options?: CredentialOptions
  ): Promise<User> {
    return this.getJson<User>(`/api/room/${enc(room)}/user/${enc(address)}`, options);
  }

  /** PUT /api/room/{room}/user/{address} — omitted fields keep their value. Persona token. */
  async updateRoomUser(
    room: string,
    address: string,
    request: UpdateUserRequest,
    options?: CredentialOptions
  ): Promise<User> {
    return this.putJson<User>(
      `/api/room/${enc(room)}/user/${enc(address)}`,
      request,
      options
    );
  }

  /** DELETE /api/room/{room}/user/{address} — soft-deletes the user. Persona token. */
  async deleteRoomUser(
    room: string,
    address: string,
    options?: CredentialOptions
  ): Promise<void> {
    await this.deleteJson<unknown>(`/api/room/${enc(room)}/user/${enc(address)}`, options);
  }

  // --- greetings -----------------------------------------------------------

  /** GET /api/room/{room}/user/{address}/greeting. Persona token. */
  async getUserGreeting(
    room: string,
    address: string,
    options?: CredentialOptions
  ): Promise<Greeting> {
    return this.getJson<Greeting>(
      `/api/room/${enc(room)}/user/${enc(address)}/greeting`,
      options
    );
  }

  /** PUT /api/room/{room}/user/{address}/greeting — non-empty, question-free. Persona token. */
  async putUserGreeting(
    room: string,
    address: string,
    greeting: string,
    options?: CredentialOptions
  ): Promise<Greeting> {
    return this.putJson<Greeting>(
      `/api/room/${enc(room)}/user/${enc(address)}/greeting`,
      { greeting },
      options
    );
  }

  /** POST /api/room/{room}/user/{address}/greeting/regenerate. Persona token. */
  async regenerateGreeting(
    room: string,
    address: string,
    options?: CredentialOptions
  ): Promise<Greeting> {
    return this.postJson<Greeting>(
      `/api/room/${enc(room)}/user/${enc(address)}/greeting/regenerate`,
      {},
      options
    );
  }

  // --- handshakes ----------------------------------------------------------

  /**
   * POST /api/handshake — registers a directed handshake. Idempotent per pair:
   * 201 when created, 200 when the live handshake already exists (both parsed
   * the same way here). A repeat for a pair without a live chat re-creates it.
   * Persona token (the `from` persona's).
   */
  async createHandshake(
    request: CreateHandshakeRequest,
    options?: CredentialOptions
  ): Promise<Handshake> {
    return this.postJson<Handshake>('/api/handshake', request, options);
  }

  /**
   * POST /api/handshake/mutual — server-mediated mutual handshake (CONCEPT
   * §7.3): the scanner's persona token authenticates; the backend creates
   * both directed handshakes and burns the one-time mutual code. 410 = code
   * already used, 403 = income-rule rejection (the code is NOT consumed on a
   * rule rejection), 404 = unknown user, 401 = invalid token.
   */
  async createMutualHandshake(
    token: string,
    request: MutualHandshakeRequest
  ): Promise<MutualHandshakeResponse> {
    return this.postJson<MutualHandshakeResponse>('/api/handshake/mutual', request, { token });
  }

  /** GET /api/handshake/user/{address} — newest first. Gated read: persona token. */
  async listHandshakesOfUser(address: string, options?: CredentialOptions): Promise<Handshake[]> {
    return this.getJson<Handshake[]>(`/api/handshake/user/${enc(address)}`, options);
  }

  // --- chats ---------------------------------------------------------------

  /** GET /api/chat/{address} — participant persona token OR room token. */
  async getChat(address: string, options?: CredentialOptions): Promise<Chat> {
    return this.getJson<Chat>(`/api/chat/${enc(address)}`, options);
  }

  /**
   * POST /api/chat/{address}/kickoff — clears history, returns to the queue.
   * Participant persona token OR room token.
   */
  async kickoffChat(address: string, options?: CredentialOptions): Promise<KickoffResponse> {
    return this.postJson<KickoffResponse>(`/api/chat/${enc(address)}/kickoff`, {}, options);
  }

  /** DELETE /api/chat/{address}/message — clears history; chat remains. Participant OR room token. */
  async clearChatHistory(address: string, options?: CredentialOptions): Promise<ClearChatResponse> {
    return this.deleteJson<ClearChatResponse>(`/api/chat/${enc(address)}/message`, options);
  }

  /** GET /api/user/{address}/chat — newest first. Gated read: persona token. */
  async listChatsOfUser(address: string, options?: CredentialOptions): Promise<Chat[]> {
    return this.getJson<Chat[]>(`/api/user/${enc(address)}/chat`, options);
  }

  /**
   * GET /api/room/{room}/user/{address}/chat — room-scoped equivalent of the
   * per-user listing. Per WP-3 the member's persona token authenticates;
   * accepting the room token is the flag-6.9a amendment (default: yes) — the
   * caller decides which credential to pass.
   */
  async listChatsOfRoomUser(
    room: string,
    address: string,
    options?: CredentialOptions
  ): Promise<Chat[]> {
    return this.getJson<Chat[]>(`/api/room/${enc(room)}/user/${enc(address)}/chat`, options);
  }

  // --- messages ------------------------------------------------------------

  /** GET /api/chat/{address}/message — every message, oldest first. Participant OR room token. */
  async listChatMessages(address: string, options?: CredentialOptions): Promise<Message[]> {
    return this.getJson<Message[]>(`/api/chat/${enc(address)}/message`, options);
  }

  /**
   * GET /api/room/{room}/user/{address}/chat/{chat}/messages — oldest first.
   * Gated read (room-scoped equivalent, see listChatsOfRoomUser).
   */
  async listRoomUserChatMessages(
    room: string,
    address: string,
    chat: string,
    options?: CredentialOptions
  ): Promise<Message[]> {
    return this.getJson<Message[]>(
      `/api/room/${enc(room)}/user/${enc(address)}/chat/${enc(chat)}/messages`,
      options
    );
  }

  /**
   * POST /api/message — from→to inside their (mutual) chat, ≤255 symbols.
   * NEVER wired into any UI (owner ruling 4: humans never send messages);
   * kept for contract completeness. No credential parameter in v2.
   */
  async sendMessage(request: SendMessageRequest): Promise<Message> {
    return this.postJson<Message>('/api/message', request);
  }

  // --- mutual code registration (CONCEPT §7.3.3) ----------------------------

  /**
   * POST /api/room/{room}/user/{address}/mutual-code — registers the badge's
   * one-time mutual code. Persona token authenticates. The body carries the
   * SHA-256 HASH of the code — NEVER the raw code (CONCEPT §7.4; enforced by
   * the attachment-policy test).
   */
  // TBD(WP-6): confirm the body field name (`mutual_code_hash`) and the
  // response shape (currently tolerated as an empty body).
  async registerMutualCode(
    room: string,
    address: string,
    token: string,
    mutualCodeHash: string
  ): Promise<void> {
    await this.postJson<unknown>(
      `/api/room/${enc(room)}/user/${enc(address)}/mutual-code`,
      { mutual_code_hash: mutualCodeHash },
      { token }
    );
  }

  // --- token rotation (CONCEPT §7.1.6) ---------------------------------------

  /**
   * POST /api/room/{room}/user/{address}/token — persona token rotation:
   * Bearer = the CURRENT persona token, body = the NEW raw secret (the
   * server stores only its hash). The old token dies server-side.
   */
  // TBD(WP-6): confirm the body field name (`token`) and the response shape.
  async rotateUserToken(
    room: string,
    address: string,
    currentToken: string,
    newRawToken: string
  ): Promise<void> {
    await this.postJson<unknown>(
      `/api/room/${enc(room)}/user/${enc(address)}/token`,
      { token: newRawToken } satisfies TokenRotationRequest,
      { token: currentToken }
    );
  }

  /**
   * POST /api/room/{address}/token — room token rotation: Bearer = the
   * CURRENT room token, body = the NEW raw secret.
   */
  // TBD(WP-6): confirm the body field name (`token`) and the response shape.
  async rotateRoomToken(address: string, currentRoomToken: string, newRawToken: string): Promise<void> {
    await this.postJson<unknown>(
      `/api/room/${enc(address)}/token`,
      { token: newRawToken } satisfies TokenRotationRequest,
      { token: currentRoomToken }
    );
  }

  // --- invite management (CONCEPT §7.2) --------------------------------------

  /** GET /api/room/{address}/invite — active invite codes. Room token. */
  async listInvites(address: string, roomToken: string): Promise<Invite[]> {
    return this.getJson<Invite[]>(`/api/room/${enc(address)}/invite`, { token: roomToken });
  }

  /** POST /api/room/{address}/invite — mints a code (default expiry 24 h server-side). Room token. */
  async mintInvite(
    address: string,
    roomToken: string,
    request: InviteMintRequest = {}
  ): Promise<Invite> {
    return this.postJson<Invite>(`/api/room/${enc(address)}/invite`, request, {
      token: roomToken
    });
  }

  /** DELETE /api/room/{address}/invite/{code} — revokes a code. Room token. */
  async revokeInvite(address: string, code: string, roomToken: string): Promise<void> {
    await this.deleteJson<unknown>(`/api/room/${enc(address)}/invite/${enc(code)}`, {
      token: roomToken
    });
  }

  // --- interests + matching + hard-match + shared contacts (v3, #34/#35) ----

  /**
   * POST /api/room/{room}/user/{address}/interest — bulk upsert of a
   * persona's interests (CONCEPT §13 / DESIGN §4.13). Requires THAT
   * persona's Bearer token. Body `{interests: [...]}` (server.
   * AddInterestsRequest), 1..50 rows, each title 1..64 symbols and
   * group/key ≥ 0 — mirrored client-side below (the server answers 400).
   * Responds 201 with the user's FULL resulting list; there is NO
   * interests GET endpoint, so UI mirrors feed from these responses.
   */
  async addUserInterests(
    room: string,
    address: string,
    interests: InterestInput[],
    options?: CredentialOptions
  ): Promise<Interest[]> {
    if (interests.length === 0 || interests.length > MAX_INTERESTS_PER_REQUEST) {
      throw new ValidationError(
        `interests must hold 1..${MAX_INTERESTS_PER_REQUEST} rows`
      );
    }
    for (const interest of interests) {
      if (symbolCount(interest.title) < 1 || symbolCount(interest.title) > MAX_INTEREST_TITLE_LEN) {
        throw new ValidationError(
          `interest title must be 1..${MAX_INTEREST_TITLE_LEN} symbols`
        );
      }
      if (interest.group < 0 || interest.key < 0) {
        throw new ValidationError('interest group and key must be >= 0');
      }
    }
    return this.postJson<Interest[]>(
      `/api/room/${enc(room)}/user/${enc(address)}/interest`,
      { interests } satisfies AddInterestsRequest,
      options
    );
  }

  /**
   * DELETE /api/room/{room}/user/{address}/interest — bulk delete by keys
   * (the DELETE carries a JSON body `{keys: [...]}`, per the bleak-node
   * tests). That persona's Bearer token; 1..50 keys, unknown keys ignored
   * (idempotent). Responds 200 with the user's REMAINING interests.
   */
  async deleteUserInterests(
    room: string,
    address: string,
    keys: number[],
    options?: CredentialOptions
  ): Promise<Interest[]> {
    if (keys.length === 0 || keys.length > MAX_INTERESTS_PER_REQUEST) {
      throw new ValidationError(`keys must hold 1..${MAX_INTERESTS_PER_REQUEST} entries`);
    }
    return this.request<Interest[]>(
      'DELETE',
      `/api/room/${enc(room)}/user/${enc(address)}/interest`,
      { keys } satisfies DeleteInterestsRequest,
      undefined,
      options
    );
  }

  /**
   * POST /api/match — legacy time-dependent matching score. Requires the
   * FIRST persona's Bearer token (the score is computed AS that persona;
   * the pair order is otherwise agnostic server-side). Responds 200 with
   * `db.MatchResult`; a mutual handshake grades 100 instantly.
   */
  async match(
    room: string,
    first: string,
    second: string,
    timeMs: number,
    options?: CredentialOptions
  ): Promise<MatchResult> {
    return this.postJson<MatchResult>(
      '/api/match',
      {
        room_address: room,
        first_user_address: first,
        second_user_address: second,
        time: timeMs
      } satisfies MatchRequest,
      options
    );
  }

  /**
   * POST /api/match/v2 — time-independent matching score (same pair always
   * grades the same value, strictly inside (0, 100)). Requires the FIRST
   * persona's Bearer token: the caller passes ITSELF as `first`
   * (DESIGN §4.13 R4 sorts finished chats by this score, fetched per
   * finished pair as self-first).
   */
  async matchV2(
    room: string,
    first: string,
    second: string,
    options?: CredentialOptions
  ): Promise<MatchResult> {
    return this.postJson<MatchResult>(
      '/api/match/v2',
      {
        room_address: room,
        first_user_address: first,
        second_user_address: second
      } satisfies MatchV2Request,
      options
    );
  }

  /**
   * POST /api/hard-match — runs (once per pair) the hard match: summarizes
   * the pair's chat, grades the 5 networking checkpoints and stores one
   * `model.Summary`. Requires the FIRST persona's Bearer token (the caller
   * passes ITSELF as `first`). The response body is the Summary for BOTH
   * status codes; the client maps 201 created → `created: true` and
   * 200 stored → `created: false` so the UI can honor the once-only gate.
   */
  async hardMatch(
    room: string,
    first: string,
    second: string,
    options?: CredentialOptions
  ): Promise<HardMatchResult> {
    const { status, body } = await this.requestWithStatus<Summary>(
      'POST',
      '/api/hard-match',
      {
        room_address: room,
        first_user_address: first,
        second_user_address: second
      } satisfies HardMatchRequest,
      undefined,
      options
    );
    return { summary: body, created: status === 201 };
  }

  /**
   * POST /api/contact — one persona shares its contact details with
   * another. Requires the FROM persona's Bearer token. Content is limited
   * to 1..255 symbols (mirrored client-side); the (from, to) pair is
   * unique — a REPEATED share answers 409, which surfaces as `ApiError`
   * with `status 409` (DESIGN §4.13 R3 maps it to "already shared").
   * Responds 201 with the stored `model.Contact`.
   */
  async shareContact(
    to: string,
    content: string,
    from: string,
    options?: CredentialOptions
  ): Promise<Contact> {
    const n = symbolCount(content);
    if (n < 1 || n > MAX_CONTACT_CONTENT_LEN) {
      throw new ValidationError(
        `content must be 1..${MAX_CONTACT_CONTENT_LEN} symbols`
      );
    }
    return this.postJson<Contact>(
      '/api/contact',
      { from, to, content } satisfies ShareContactRequest,
      options
    );
  }

  /**
   * GET /api/contact/{address} — every contact shared WITH the persona,
   * newest first. ONLY the RECIPIENT has access: the Bearer must be that
   * recipient's persona token (the sender reading its outgoing shares gets
   * 401/403 — pass the recipient's credential).
   */
  async listContactsSharedWith(address: string, options?: CredentialOptions): Promise<Contact[]> {
    return this.getJson<Contact[]>(`/api/contact/${enc(address)}`, options);
  }

  // --- transport -----------------------------------------------------------

  private async getJson<T>(path: string, credential?: CredentialOptions): Promise<T> {
    return this.request<T>('GET', path, undefined, undefined, credential);
  }

  private async postJson<T>(
    path: string,
    body: unknown,
    credential?: CredentialOptions
  ): Promise<T> {
    return this.request<T>('POST', path, body, undefined, credential);
  }

  private async putJson<T>(
    path: string,
    body: unknown,
    credential?: CredentialOptions
  ): Promise<T> {
    return this.request<T>('PUT', path, body, undefined, credential);
  }

  private async deleteJson<T>(path: string, credential?: CredentialOptions): Promise<T> {
    return this.request<T>('DELETE', path, undefined, undefined, credential);
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    extraHeaders?: Record<string, string>,
    credential?: CredentialOptions
  ): Promise<T> {
    const { body: parsed } = await this.requestWithStatus<T>(
      method,
      path,
      body,
      extraHeaders,
      credential
    );
    return parsed;
  }

  /**
   * Transport core; returns the parsed body TOGETHER with the status so
   * the few endpoints that distinguish 200/201 on the same body shape
   * (hard-match) can map both responses.
   */
  private async requestWithStatus<T>(
    method: string,
    path: string,
    body?: unknown,
    extraHeaders?: Record<string, string>,
    credential?: CredentialOptions
  ): Promise<{ status: number; body: T }> {
    const headers: Record<string, string> = { ...extraHeaders };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (credential?.token !== undefined && credential.token !== '') {
      headers['Authorization'] = `Bearer ${credential.token}`;
    }
    let response: Response;
    try {
      response = await this.fetchImpl(`${this.baseUrl}${path}`, {
        method,
        headers,
        ...(body !== undefined ? { body: JSON.stringify(body) } : {})
      });
    } catch (cause) {
      throw new NetworkError(path, cause);
    }
    if (response.status < 200 || response.status >= 300) {
      throw new ApiError(response.status, path, await readErrorBody(response));
    }
    return { status: response.status, body: (await readJsonBody(response)) as T };
  }
}

// Client-side mirrors of the bleak-node validation caps
// (internal/model: MaxInterestsPerRequest, MaxInterestTitleLen,
// MaxContactContentLen) — doomed bodies are rejected before the wire.
const MAX_INTERESTS_PER_REQUEST = 50;
const MAX_INTEREST_TITLE_LEN = 64;
const MAX_CONTACT_CONTENT_LEN = 255;

/** The server counts SYMBOLS (UTF-8 runes), not UTF-16 code units. */
function symbolCount(value: string): number {
  return [...value].length;
}

function enc(value: string): string {
  return encodeURIComponent(value);
}

/** bleak-node error bodies are plain text (e.g. "room not found"). */
async function readErrorBody(response: Response): Promise<string> {
  try {
    const text = await response.text();
    return text.length > 0 ? text : response.statusText;
  } catch {
    return response.statusText;
  }
}

/**
 * Credential endpoints may answer 204/empty (rotation, code registration);
 * an empty body parses to `undefined` instead of throwing on `response.json()`.
 */
async function readJsonBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (text.length === 0) return undefined;
  return JSON.parse(text) as unknown;
}
