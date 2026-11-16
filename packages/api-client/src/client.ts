import type {
  Chat,
  ClearChatResponse,
  CreateHandshakeRequest,
  CreateRoomRequestV2,
  CreateRoomResponse,
  CreateUserRequest,
  CreateUserRequestV2,
  Greeting,
  Handshake,
  Invite,
  InviteMintRequest,
  KickoffResponse,
  Message,
  MutualHandshakeRequest,
  MutualHandshakeResponse,
  Room,
  SendMessageRequest,
  TokenRotationRequest,
  UpdateRoomRequest,
  UpdateUserRequest,
  User
} from './types.js';
import { ApiError, NetworkError } from './errors.js';

export * from './types.js';
export { ApiError, NetworkError } from './errors.js';

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
 * Typed client for the bleak-node REST API (v0.1.0, Swagger 2.0 + the v2
 * credential endpoints of CONCEPT §7 — TBD(WP-6) names are marked in place).
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
    return (await readJsonBody(response)) as T;
  }
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
