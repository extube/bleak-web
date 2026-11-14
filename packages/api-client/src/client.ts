import type {
  Chat,
  ClearChatResponse,
  CreateHandshakeRequest,
  CreateRoomRequest,
  CreateUserRequest,
  Greeting,
  Handshake,
  KickoffResponse,
  Message,
  Room,
  SendMessageRequest,
  UpdateRoomRequest,
  UpdateUserRequest,
  User
} from './types.js';
import { ApiError, NetworkError } from './errors.js';

export * from './types.js';
export { ApiError, NetworkError } from './errors.js';

/**
 * Typed client for the bleak-node REST API (v0.1.0, Swagger 2.0).
 *
 * One method per swagger.json endpoint, in swagger path order. The client is
 * transport-agnostic: pass a custom `fetch` in tests (or for proxies); it
 * defaults to the global fetch in the browser.
 */
export class BleakClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: { baseUrl?: string; fetch?: typeof fetch } = {}) {
    this.baseUrl = (options.baseUrl ?? '').replace(/\/+$/, '');
    this.fetchImpl = options.fetch ?? fetch.bind(globalThis);
  }

  // --- rooms ---------------------------------------------------------------

  /** GET /api/room — all non-deleted rooms. */
  async listRooms(): Promise<Room[]> {
    return this.getJson<Room[]>('/api/room');
  }

  /** POST /api/room — creates a room with a server-generated address. */
  async createRoom(request: CreateRoomRequest): Promise<Room> {
    return this.postJson<Room>('/api/room', request);
  }

  /** GET /api/room/{address} */
  async getRoom(address: string): Promise<Room> {
    return this.getJson<Room>(`/api/room/${enc(address)}`);
  }

  /** PUT /api/room/{address} — omitted fields keep their value. */
  async updateRoom(address: string, request: UpdateRoomRequest): Promise<Room> {
    return this.putJson<Room>(`/api/room/${enc(address)}`, request);
  }

  /** DELETE /api/room/{address} — soft-deletes the room and its users. */
  async deleteRoom(address: string): Promise<Room> {
    return this.deleteJson<Room>(`/api/room/${enc(address)}`);
  }

  // --- room users ----------------------------------------------------------

  /** GET /api/room/{room}/user — all non-deleted users of the room. */
  async listRoomUsers(room: string): Promise<User[]> {
    return this.getJson<User[]>(`/api/room/${enc(room)}/user`);
  }

  /** POST /api/room/{room}/user — creates a user linked to the room. */
  async createRoomUser(room: string, request: CreateUserRequest): Promise<User> {
    return this.postJson<User>(`/api/room/${enc(room)}/user`, request);
  }

  /** GET /api/room/{room}/user/{address} */
  async getRoomUser(room: string, address: string): Promise<User> {
    return this.getJson<User>(`/api/room/${enc(room)}/user/${enc(address)}`);
  }

  /** PUT /api/room/{room}/user/{address} — omitted fields keep their value. */
  async updateRoomUser(room: string, address: string, request: UpdateUserRequest): Promise<User> {
    return this.putJson<User>(`/api/room/${enc(room)}/user/${enc(address)}`, request);
  }

  /** DELETE /api/room/{room}/user/{address} — soft-deletes the user. */
  async deleteRoomUser(room: string, address: string): Promise<void> {
    await this.deleteJson<unknown>(`/api/room/${enc(room)}/user/${enc(address)}`);
  }

  // --- greetings -----------------------------------------------------------

  /** GET /api/room/{room}/user/{address}/greeting */
  async getUserGreeting(room: string, address: string): Promise<Greeting> {
    return this.getJson<Greeting>(`/api/room/${enc(room)}/user/${enc(address)}/greeting`);
  }

  /** PUT /api/room/{room}/user/{address}/greeting — non-empty, question-free. */
  async putUserGreeting(room: string, address: string, greeting: string): Promise<Greeting> {
    return this.putJson<Greeting>(`/api/room/${enc(room)}/user/${enc(address)}/greeting`, {
      greeting
    });
  }

  /** POST /api/room/{room}/user/{address}/greeting/regenerate */
  async regenerateGreeting(room: string, address: string): Promise<Greeting> {
    return this.postJson<Greeting>(
      `/api/room/${enc(room)}/user/${enc(address)}/greeting/regenerate`,
      {}
    );
  }

  // --- handshakes ----------------------------------------------------------

  /**
   * POST /api/handshake — registers a directed handshake. Idempotent per pair:
   * 201 when created, 200 when the live handshake already exists (both parsed
   * the same way here). A repeat for a pair without a live chat re-creates it.
   */
  async createHandshake(request: CreateHandshakeRequest): Promise<Handshake> {
    return this.postJson<Handshake>('/api/handshake', request);
  }

  /** GET /api/handshake/user/{address} — newest first. */
  async listHandshakesOfUser(address: string): Promise<Handshake[]> {
    return this.getJson<Handshake[]>(`/api/handshake/user/${enc(address)}`);
  }

  // --- chats ---------------------------------------------------------------

  /** GET /api/chat/{address} */
  async getChat(address: string): Promise<Chat> {
    return this.getJson<Chat>(`/api/chat/${enc(address)}`);
  }

  /** POST /api/chat/{address}/kickoff — clears history, returns to the queue. */
  async kickoffChat(address: string): Promise<KickoffResponse> {
    return this.postJson<KickoffResponse>(`/api/chat/${enc(address)}/kickoff`, {});
  }

  /** DELETE /api/chat/{address}/message — clears history; chat remains. */
  async clearChatHistory(address: string): Promise<ClearChatResponse> {
    return this.deleteJson<ClearChatResponse>(`/api/chat/${enc(address)}/message`);
  }

  /** GET /api/user/{address}/chat — newest first. */
  async listChatsOfUser(address: string): Promise<Chat[]> {
    return this.getJson<Chat[]>(`/api/user/${enc(address)}/chat`);
  }

  /** GET /api/room/{room}/user/{address}/chat */
  async listChatsOfRoomUser(room: string, address: string): Promise<Chat[]> {
    return this.getJson<Chat[]>(`/api/room/${enc(room)}/user/${enc(address)}/chat`);
  }

  // --- messages ------------------------------------------------------------

  /** GET /api/chat/{address}/message — every message, oldest first. */
  async listChatMessages(address: string): Promise<Message[]> {
    return this.getJson<Message[]>(`/api/chat/${enc(address)}/message`);
  }

  /** GET /api/room/{room}/user/{address}/chat/{chat}/messages — oldest first. */
  async listRoomUserChatMessages(room: string, address: string, chat: string): Promise<Message[]> {
    return this.getJson<Message[]>(
      `/api/room/${enc(room)}/user/${enc(address)}/chat/${enc(chat)}/messages`
    );
  }

  /** POST /api/message — from→to inside their (mutual) chat, ≤255 symbols. */
  async sendMessage(request: SendMessageRequest): Promise<Message> {
    return this.postJson<Message>('/api/message', request);
  }

  // --- transport -----------------------------------------------------------

  private async getJson<T>(path: string): Promise<T> {
    return this.request<T>('GET', path);
  }

  private async postJson<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>('POST', path, body);
  }

  private async putJson<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>('PUT', path, body);
  }

  private async deleteJson<T>(path: string): Promise<T> {
    return this.request<T>('DELETE', path);
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    let response: Response;
    try {
      response = await this.fetchImpl(`${this.baseUrl}${path}`, {
        method,
        ...(body !== undefined
          ? { body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } }
          : {})
      });
    } catch (cause) {
      throw new NetworkError(path, cause);
    }
    if (response.status < 200 || response.status >= 300) {
      throw new ApiError(response.status, path, await readErrorBody(response));
    }
    return (await response.json()) as T;
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
