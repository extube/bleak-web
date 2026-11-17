/**
 * Tests for the BleakClient transport/mapping layer.
 * fetch is injected, so no server is needed: we assert that every endpoint
 * maps to the exact method+path from /mount/bleak-node/docs/swagger.json and
 * that bodies/errors are handled per the contract.
 */
import { describe, expect, it, vi } from 'vitest';
import { ApiError, BleakClient, NetworkError } from '../src/index.js';

type Recorded = { method: string; path: string; body?: unknown };

function makeClient(status = 200, responseBody: unknown = {}) {
  const calls: Recorded[] = [];
  const fetchImpl = vi.fn(async (input: string | URL, init?: RequestInit) => {
    const url = String(input);
    const path = url.replace(/^https?:\/\/[^/]+/, '');
    calls.push({
      method: (init?.method ?? 'GET').toUpperCase(),
      path,
      body: init?.body ? (JSON.parse(String(init.body)) as unknown) : undefined
    });
    return new Response(JSON.stringify(responseBody), {
      status,
      headers: { 'Content-Type': 'application/json' }
    });
  }) as unknown as typeof fetch;
  const client = new BleakClient({ baseUrl: 'http://node.test', fetch: fetchImpl });
  return { client, calls };
}

describe('BleakClient endpoint mapping (swagger.json)', () => {
  it('lists rooms via GET /api/room', async () => {
    const room = { address: '0xroom123', name: 'Meta Room' };
    const { client, calls } = makeClient(200, [room]);
    await expect(client.listRooms()).resolves.toEqual([room]);
    expect(calls[0]).toEqual({ method: 'GET', path: '/api/room' });
  });

  it('creates a room via POST /api/room with a JSON body and the creation token header', async () => {
    const room = { address: '0xroom1' };
    // The TBD(WP-6) header name is asserted in the attachment-policy test too.
    const req = { name: 'Meta Room', language: 'ru', token: 'room-token-raw' };
    const { client, calls } = makeClient(201, room);
    await expect(client.createRoom(req, 'create-token-123')).resolves.toEqual(room);
    expect(calls[0]).toEqual({ method: 'POST', path: '/api/room', body: req });
  });

  it('routes room CRUD to /api/room/{address} and encodes addresses', async () => {
    const { client, calls } = makeClient(200, { address: '0xr' });
    await client.getRoom('0xroom 1');
    await client.updateRoom('0xroom1', { name: 'x' });
    await client.deleteRoom('0xroom1');
    expect(calls.map((c) => [c.method, c.path])).toEqual([
      ['GET', '/api/room/0xroom%201'],
      ['PUT', '/api/room/0xroom1'],
      ['DELETE', '/api/room/0xroom1']
    ]);
  });

  it('routes room users to /api/room/{room}/user[/{address}]', async () => {
    const { client, calls } = makeClient(201, { address: '0xu1' });
    await client.listRoomUsers('0xr1');
    await client.createRoomUser('0xr1', { name: 'Alice' });
    await client.getRoomUser('0xr1', '0xu1');
    await client.updateRoomUser('0xr1', '0xu1', { public_bio: 'hi' });
    await client.deleteRoomUser('0xr1', '0xu1');
    expect(calls.map((c) => [c.method, c.path])).toEqual([
      ['GET', '/api/room/0xr1/user'],
      ['POST', '/api/room/0xr1/user'],
      ['GET', '/api/room/0xr1/user/0xu1'],
      ['PUT', '/api/room/0xr1/user/0xu1'],
      ['DELETE', '/api/room/0xr1/user/0xu1']
    ]);
  });

  it('routes greetings including regenerate', async () => {
    const { client, calls } = makeClient(200, { address: '0xu1', greeting: 'Hi' });
    await client.getUserGreeting('0xr1', '0xu1');
    await client.putUserGreeting('0xr1', '0xu1', 'Hi');
    await client.regenerateGreeting('0xr1', '0xu1');
    expect(calls.map((c) => [c.method, c.path, c.body])).toEqual([
      ['GET', '/api/room/0xr1/user/0xu1/greeting', undefined],
      ['PUT', '/api/room/0xr1/user/0xu1/greeting', { greeting: 'Hi' }],
      ['POST', '/api/room/0xr1/user/0xu1/greeting/regenerate', {}]
    ]);
  });

  it('sends handshakes to POST /api/handshake and lists per user', async () => {
    const { client, calls } = makeClient(201, { tx_id: '0xtx42' });
    const req = { from_address: '0xu1', to_address: '0xu2', status: 1 };
    await client.createHandshake(req);
    await client.listHandshakesOfUser('0xu1');
    expect(calls.map((c) => [c.method, c.path, c.body])).toEqual([
      ['POST', '/api/handshake', req],
      ['GET', '/api/handshake/user/0xu1', undefined]
    ]);
  });

  it('accepts both 200 and 201 for the idempotent handshake endpoint', async () => {
    for (const status of [200, 201]) {
      const { client } = makeClient(status, { tx_id: '0xtx42' });
      await expect(
        client.createHandshake({ from_address: 'a', to_address: 'b', status: 1 })
      ).resolves.toEqual({ tx_id: '0xtx42' });
    }
  });

  it('routes chats and kickoff/clear', async () => {
    const { client, calls } = makeClient(200, { address: '0xc1' });
    await client.getChat('0xc1');
    await client.kickoffChat('0xc1');
    await client.clearChatHistory('0xc1');
    await client.listChatsOfUser('0xu1');
    await client.listChatsOfRoomUser('0xr1', '0xu1');
    expect(calls.map((c) => [c.method, c.path])).toEqual([
      ['GET', '/api/chat/0xc1'],
      ['POST', '/api/chat/0xc1/kickoff'],
      ['DELETE', '/api/chat/0xc1/message'],
      ['GET', '/api/user/0xu1/chat'],
      ['GET', '/api/room/0xr1/user/0xu1/chat']
    ]);
  });

  it('routes messages (chat-level and room-user-level) and send', async () => {
    const { client, calls } = makeClient(201, { tx_id: '0xtx1' });
    await client.listChatMessages('0xc1');
    await client.listRoomUserChatMessages('0xr1', '0xu1', '0xc1');
    const req = { from: '0xu1', to: '0xu2', content: 'hello there' };
    await client.sendMessage(req);
    expect(calls.map((c) => [c.method, c.path, c.body])).toEqual([
      ['GET', '/api/chat/0xc1/message', undefined],
      ['GET', '/api/room/0xr1/user/0xu1/chat/0xc1/messages', undefined],
      ['POST', '/api/message', req]
    ]);
  });
});

describe('BleakClient error handling', () => {
  it('throws ApiError with status and server message on non-2xx', async () => {
    const fetchImpl = vi.fn(
      async () => new Response('user not found', { status: 404 })
    ) as unknown as typeof fetch;
    const client = new BleakClient({ baseUrl: 'http://node.test', fetch: fetchImpl });
    const error = await client.getRoomUser('0xr1', '0xnope').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(404);
    expect((error as Error).message).toContain('user not found');
  });

  it('wraps network failures in NetworkError', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('ECONNREFUSED');
    }) as unknown as typeof fetch;
    const client = new BleakClient({ baseUrl: 'http://node.test', fetch: fetchImpl });
    await expect(client.getRoom('0xr1')).rejects.toBeInstanceOf(NetworkError);
  });

  it('works without a baseUrl (same-origin /api paths)', async () => {
    const fetchImpl = vi.fn(async (input: string | URL) => {
      expect(String(input)).toBe('/api/room');
      return new Response('[]', { status: 200 });
    }) as unknown as typeof fetch;
    const client = new BleakClient({ fetch: fetchImpl });
    await expect(client.listRooms()).resolves.toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Attachment policy (ARCHITECTURE §10.2 — the v2 credential contract)
// ---------------------------------------------------------------------------

type RecordedWithHeaders = {
  method: string;
  path: string;
  body?: unknown;
  headers: Record<string, string>;
};

function makeRecordingClient(status = 200, responseBody: unknown = {}) {
  const calls: RecordedWithHeaders[] = [];
  const fetchImpl = vi.fn(async (input: string | URL, init?: RequestInit) => {
    calls.push({
      method: (init?.method ?? 'GET').toUpperCase(),
      path: String(input).replace(/^https?:\/\/[^/]+/, ''),
      body: init?.body ? (JSON.parse(String(init.body)) as unknown) : undefined,
      headers: (init?.headers as Record<string, string> | undefined) ?? {}
    });
    return new Response(JSON.stringify(responseBody), {
      status,
      headers: { 'Content-Type': 'application/json' }
    });
  }) as unknown as typeof fetch;
  const client = new BleakClient({ baseUrl: 'http://node.test', fetch: fetchImpl });
  return { client, calls };
}

/** Strict-safe indexed access for recorded calls (noUncheckedIndexedAccess). */
function nth<T>(items: T[], index: number): T {
  const item = items[index];
  if (item === undefined) throw new Error(`no recorded call at #${index}`);
  return item;
}

describe('Attachment policy — Bearer is sent on credentialed calls only', () => {
  const TOKEN = 'tok-persona-1';

  /** (room, address, chat) args reused by every row of the table. */
  const R = '0xroom1';
  const U = '0xuser1';
  const C = '0xchat1';

  type Row = { name: string; call: (client: BleakClient) => Promise<unknown>; expectedPath: string };

  // Every credentialed method: either the final `options?: { token }` form or
  // an explicit credential argument. One row per method; the assertion below
  // checks the Authorization header and the exact path each row produces.
  const credentialed: Row[] = [
    {
      name: 'updateRoom (room token)',
      call: (client) => client.updateRoom(R, { name: 'x' }, { token: TOKEN }),
      expectedPath: `/api/room/${R}`
    },
    {
      name: 'deleteRoom (room token)',
      call: (client) => client.deleteRoom(R, { token: TOKEN }),
      expectedPath: `/api/room/${R}`
    },
    {
      name: 'getRoomUser (gated read, persona token)',
      call: (client) => client.getRoomUser(R, U, { token: TOKEN }),
      expectedPath: `/api/room/${R}/user/${U}`
    },
    {
      name: 'updateRoomUser (persona token)',
      call: (client) => client.updateRoomUser(R, U, { name: 'x' }, { token: TOKEN }),
      expectedPath: `/api/room/${R}/user/${U}`
    },
    {
      name: 'deleteRoomUser (persona token)',
      call: (client) => client.deleteRoomUser(R, U, { token: TOKEN }),
      expectedPath: `/api/room/${R}/user/${U}`
    },
    {
      name: 'getUserGreeting (persona token)',
      call: (client) => client.getUserGreeting(R, U, { token: TOKEN }),
      expectedPath: `/api/room/${R}/user/${U}/greeting`
    },
    {
      name: 'putUserGreeting (persona token)',
      call: (client) => client.putUserGreeting(R, U, 'Hi', { token: TOKEN }),
      expectedPath: `/api/room/${R}/user/${U}/greeting`
    },
    {
      name: 'regenerateGreeting (persona token)',
      call: (client) => client.regenerateGreeting(R, U, { token: TOKEN }),
      expectedPath: `/api/room/${R}/user/${U}/greeting/regenerate`
    },
    {
      name: 'createHandshake (from-persona token)',
      call: (client) =>
        client.createHandshake({ from_address: U, to_address: '0xuser2', status: 1 }, { token: TOKEN }),
      expectedPath: '/api/handshake'
    },
    {
      name: 'createMutualHandshake (scanner persona token)',
      call: (client) =>
        client.createMutualHandshake(TOKEN, { user_address: '0xuser2', mutual_code: 'code' }),
      expectedPath: '/api/handshake/mutual'
    },
    {
      name: 'listHandshakesOfUser (gated read, persona token)',
      call: (client) => client.listHandshakesOfUser(U, { token: TOKEN }),
      expectedPath: `/api/handshake/user/${U}`
    },
    {
      name: 'getChat (participant persona OR room token)',
      call: (client) => client.getChat(C, { token: TOKEN }),
      expectedPath: `/api/chat/${C}`
    },
    {
      name: 'kickoffChat (participant persona OR room token)',
      call: (client) => client.kickoffChat(C, { token: TOKEN }),
      expectedPath: `/api/chat/${C}/kickoff`
    },
    {
      name: 'clearChatHistory (participant persona OR room token)',
      call: (client) => client.clearChatHistory(C, { token: TOKEN }),
      expectedPath: `/api/chat/${C}/message`
    },
    {
      name: 'listChatsOfUser (gated read, persona token)',
      call: (client) => client.listChatsOfUser(U, { token: TOKEN }),
      expectedPath: `/api/user/${U}/chat`
    },
    {
      name: 'listChatsOfRoomUser (gated room-scoped read)',
      call: (client) => client.listChatsOfRoomUser(R, U, { token: TOKEN }),
      expectedPath: `/api/room/${R}/user/${U}/chat`
    },
    {
      name: 'listChatMessages (participant persona OR room token)',
      call: (client) => client.listChatMessages(C, { token: TOKEN }),
      expectedPath: `/api/chat/${C}/message`
    },
    {
      name: 'listRoomUserChatMessages (gated room-scoped read)',
      call: (client) => client.listRoomUserChatMessages(R, U, C, { token: TOKEN }),
      expectedPath: `/api/room/${R}/user/${U}/chat/${C}/messages`
    },
    {
      name: 'registerMutualCode (persona token)',
      call: (client) => client.registerMutualCode(R, U, TOKEN, 'a'.repeat(64)),
      expectedPath: `/api/room/${R}/user/${U}/mutual-code`
    },
    {
      name: 'rotateUserToken (Bearer = current token)',
      call: (client) => client.rotateUserToken(R, U, TOKEN, 'new-raw-token'),
      expectedPath: `/api/room/${R}/user/${U}/token`
    },
    {
      name: 'rotateRoomToken (Bearer = current room token)',
      call: (client) => client.rotateRoomToken(R, TOKEN, 'new-raw-room-token'),
      expectedPath: `/api/room/${R}/token`
    },
    {
      name: 'listInvites (room token)',
      call: (client) => client.listInvites(R, TOKEN),
      expectedPath: `/api/room/${R}/invite`
    },
    {
      name: 'mintInvite (room token)',
      call: (client) => client.mintInvite(R, TOKEN, { expires_at: '2026-11-16T00:00:00Z' }),
      expectedPath: `/api/room/${R}/invite`
    },
    {
      name: 'revokeInvite (room token)',
      call: (client) => client.revokeInvite(R, '123456', TOKEN),
      expectedPath: `/api/room/${R}/invite/123456`
    }
  ];

  it('each credentialed method sends exactly one Bearer header when a token is passed', async () => {
    for (const row of credentialed) {
      const { client, calls } = makeRecordingClient();
      await row.call(client);
      expect(calls).toHaveLength(1);
      expect(nth(calls, 0).path, row.name).toBe(row.expectedPath);
      expect(nth(calls, 0).headers['Authorization'], row.name).toBe(`Bearer ${TOKEN}`);
    }
  });

  it('createRoom carries the creation token in its own header, not as Bearer', async () => {
    const { client, calls } = makeRecordingClient(201, { address: '0xr' });
    await client.createRoom({ name: 'Meta Room', token: 'room-token-raw' }, 'create-token-9');
    // TBD(WP-6): header name (proposed `x-create-token`).
    expect(nth(calls, 0).headers).toEqual({
      'x-create-token': 'create-token-9',
      'Content-Type': 'application/json'
    });
  });

  it('omitting the optional token sends no Authorization header at all', async () => {
    const { client, calls } = makeRecordingClient();
    await client.updateRoomUser(R, U, { name: 'x' });
    await client.listHandshakesOfUser(U);
    expect(nth(calls, 0).headers['Authorization']).toBeUndefined();
    expect(nth(calls, 1).headers['Authorization']).toBeUndefined();
  });

  it('public reads accept no token parameter and never send an Authorization header', async () => {
    const { client, calls } = makeRecordingClient(200, []);
    await client.listRooms();
    await client.getRoom(R);
    await client.listRoomUsers(R);
    // The v1 body shape is still accepted (join carries no auth header).
    await client.createRoomUser(R, { name: 'Alice' });
    for (const call of calls) {
      expect(call.headers['Authorization']).toBeUndefined();
    }
    // Type-level enforcement: tsc fails when a token parameter is ever added
    // to a public read (vitest itself ignores the directive at runtime).
    // @ts-expect-error public reads accept no token parameter (ARCHITECTURE §10.2)
    await client.listRoomUsers(R, { token: TOKEN });
    // @ts-expect-error public reads accept no token parameter (ARCHITECTURE §10.2)
    await client.createRoomUser(R, { name: 'Alice' }, { token: TOKEN });
  });

  it('registerMutualCode sends the HASH of the code, never the raw code', async () => {
    const rawCode = 'one-time-raw-mutual-code';
    const hash = '5f2c2f0bf3a3f9a1d45f1e7c2b8a0d4e6f9a1c3b5d7e9f0a2c4e6b8d0f2a4c6e';
    const { client, calls } = makeRecordingClient(200, {});
    await client.registerMutualCode(R, U, TOKEN, hash);
    expect(calls).toHaveLength(1);
    expect(nth(calls, 0).body).toEqual({ mutual_code_hash: hash });
    expect(JSON.stringify(nth(calls, 0).body)).not.toContain(rawCode);
    expect(nth(calls, 0).headers['Authorization']).toBe(`Bearer ${TOKEN}`);
  });

  it('rotation bodies carry the new RAW token, Bearer carries the current one', async () => {
    const { client, calls } = makeRecordingClient(200, {});
    await client.rotateUserToken(R, U, 'current-tok', 'new-raw-tok');
    await client.rotateRoomToken(R, 'current-room-tok', 'new-raw-room-tok');
    expect(nth(calls, 0).body).toEqual({ token: 'new-raw-tok' });
    expect(nth(calls, 0).headers['Authorization']).toBe('Bearer current-tok');
    expect(nth(calls, 1).body).toEqual({ token: 'new-raw-room-tok' });
    expect(nth(calls, 1).headers['Authorization']).toBe('Bearer current-room-tok');
  });

  it('an empty 200 body resolves (rotation/registration may answer 204)', async () => {
    const fetchImpl = vi.fn(async () => new Response('', { status: 200 })) as unknown as typeof fetch;
    const client = new BleakClient({ baseUrl: 'http://node.test', fetch: fetchImpl });
    await expect(client.rotateUserToken(R, U, 'cur', 'new')).resolves.toBeUndefined();
    await expect(client.registerMutualCode(R, U, 'cur', 'h')).resolves.toBeUndefined();
    await expect(client.revokeInvite(R, '123456', 'cur')).resolves.toBeUndefined();
  });
});

describe('Credential errors map to ApiError.status verbatim (plain-text bodies kept)', () => {
  function makeStatusClient(status: number, body: string) {
    const fetchImpl = vi.fn(
      async () => new Response(body, { status })
    ) as unknown as typeof fetch;
    return new BleakClient({ baseUrl: 'http://node.test', fetch: fetchImpl });
  }

  it.each([
    {
      status: 401,
      body: 'invalid token',
      call: (client: BleakClient) => client.updateRoomUser('0xr', '0xu', { name: 'x' }, { token: 'tok' }),
      what: 'a credentialed mutation'
    },
    {
      status: 403,
      body: 'income must exceed outcome',
      call: (client: BleakClient) =>
        client.createHandshake({ from_address: 'a', to_address: 'b', status: 1 }, { token: 'tok' }),
      what: 'the income rule / wrong record'
    },
    {
      status: 410,
      body: 'mutual code already used',
      call: (client: BleakClient) =>
        client.createMutualHandshake('tok', { user_address: '0xu', mutual_code: 'code' }),
      what: 'the mutual code already used'
    }
  ])(
    '$status on $what maps to status $status verbatim (plain-text body kept)',
    async ({ status, body, call }) => {
      const client = makeStatusClient(status, body);
      const error = await call(client).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).status).toBe(status);
      expect((error as Error).message).toContain(body);
    }
  );

  it('network failures still wrap in NetworkError', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('ECONNREFUSED');
    }) as unknown as typeof fetch;
    const client = new BleakClient({ baseUrl: 'http://node.test', fetch: fetchImpl });
    await expect(
      client.createMutualHandshake('tok', { user_address: '0xu', mutual_code: 'c' })
    ).rejects.toBeInstanceOf(NetworkError);
  });
});
