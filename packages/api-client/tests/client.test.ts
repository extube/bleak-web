/**
 * Tests for the BleakClient transport/mapping layer.
 * fetch is injected, so no server is needed: we assert that every endpoint
 * maps to the exact method+path from /mount/bleak-node/docs/swagger.json and
 * that bodies/errors are handled per the contract.
 */
import { describe, expect, it, vi } from 'vitest';
import { ApiError, BleakClient, NetworkError, ValidationError } from '../src/index.js';

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
    },
    // --- v3 (bleak-node #34/#35): persona-gated writes + recipient read ------
    {
      name: 'addUserInterests (that persona token)',
      call: (client) =>
        client.addUserInterests(R, U, [{ title: 'Chess', group: 1, key: 7 }], { token: TOKEN }),
      expectedPath: `/api/room/${R}/user/${U}/interest`
    },
    {
      name: 'deleteUserInterests (that persona token, DELETE with body)',
      call: (client) => client.deleteUserInterests(R, U, [7], { token: TOKEN }),
      expectedPath: `/api/room/${R}/user/${U}/interest`
    },
    {
      name: 'match (FIRST persona token, self as first_user_address)',
      call: (client) => client.match(R, U, '0xuser2', 3600000, { token: TOKEN }),
      expectedPath: '/api/match'
    },
    {
      name: 'matchV2 (FIRST persona token, self as first_user_address)',
      call: (client) => client.matchV2(R, U, '0xuser2', { token: TOKEN }),
      expectedPath: '/api/match/v2'
    },
    {
      name: 'hardMatch (FIRST persona token, self as first_user_address)',
      call: (client) => client.hardMatch(R, U, '0xuser2', { token: TOKEN }),
      expectedPath: '/api/hard-match'
    },
    {
      name: 'shareContact (FROM persona token)',
      call: (client) => client.shareContact('0xuser2', 'telegram: @me', U, { token: TOKEN }),
      expectedPath: '/api/contact'
    },
    {
      name: 'listContactsSharedWith (RECIPIENT persona token only)',
      call: (client) => client.listContactsSharedWith(U, { token: TOKEN }),
      expectedPath: `/api/contact/${U}`
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
    },
    // --- v3 (bleak-node #34/#35) --------------------------------------------
    {
      status: 409,
      body: 'contact already shared',
      call: (client: BleakClient) =>
        client.shareContact('0xu2', 'telegram: @me', '0xu1', { token: 'tok' }),
      what: 'the repeated contact share (once per pair)'
    },
    {
      status: 400,
      body: 'first_user_address and second_user_address must differ',
      call: (client: BleakClient) => client.matchV2('0xr', '0xu1', '0xu1', { token: 'tok' }),
      what: 'a match request validation shape'
    },
    {
      status: 401,
      body: 'invalid token',
      call: (client: BleakClient) => client.listContactsSharedWith('0xu1', { token: 'wrong' }),
      what: 'the recipient-only contacts read (wrong Bearer)'
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

// ---------------------------------------------------------------------------
// v3 contract (2026-11-19, Concept §13 / DESIGN §4.13, bleak-node #34/#35)
// ---------------------------------------------------------------------------

describe('BleakClient v3 endpoint mapping (interests / match / hard-match / contacts)', () => {
  const R = '0xroom1';
  const U = '0xuser1';

  it('addUserInterests POSTs {interests} to …/user/{address}/interest', async () => {
    const rows = [{ title: 'Chess', group: 1, key: 7 }];
    const { client, calls } = makeClient(201, [
      { title: 'Chess', group: 1, key: 7, user_address: U }
    ]);
    await client.addUserInterests(R, U, rows, { token: 'tok' });
    expect(nth(calls, 0)).toEqual({
      method: 'POST',
      path: `/api/room/${R}/user/${U}/interest`,
      body: { interests: rows }
    });
  });

  it('deleteUserInterests sends the DELETE with a JSON body {keys}', async () => {
    const remaining = [{ title: 'Watercolor', group: 2, key: 3, user_address: U }];
    const { client, calls } = makeClient(200, remaining);
    await expect(client.deleteUserInterests(R, U, [7, 9], { token: 'tok' })).resolves.toEqual(
      remaining
    );
    expect(nth(calls, 0)).toEqual({
      method: 'DELETE',
      path: `/api/room/${R}/user/${U}/interest`,
      body: { keys: [7, 9] }
    });
  });

  it('match POSTs /api/match with the time in milliseconds', async () => {
    const result = {
      points: 61.5,
      exact_interest_matches: 1,
      shared_groups: 2,
      handshake: true,
      mutual_handshake: false
    };
    const { client, calls } = makeClient(200, result);
    await expect(client.match(R, U, '0xuser2', 3600000, { token: 'tok' })).resolves.toEqual(result);
    expect(nth(calls, 0)).toEqual({
      method: 'POST',
      path: '/api/match',
      body: {
        room_address: R,
        first_user_address: U,
        second_user_address: '0xuser2',
        time: 3600000
      }
    });
  });

  it('matchV2 POSTs /api/match/v2 with no time field', async () => {
    const result = {
      points: 79.14,
      exact_interest_matches: 0,
      shared_groups: 0,
      handshake: true,
      mutual_handshake: true
    };
    const { client, calls } = makeClient(200, result);
    await expect(client.matchV2(R, U, '0xuser2', { token: 'tok' })).resolves.toEqual(result);
    expect(nth(calls, 0)).toEqual({
      method: 'POST',
      path: '/api/match/v2',
      body: { room_address: R, first_user_address: U, second_user_address: '0xuser2' }
    });
  });

  it('hardMatch maps 201 → created: true and 200 → created: false (same Summary body)', async () => {
    const summary = {
      chat: '0xchat1',
      checkpoints: [{ key: 'introductions', label: 'Both introduced themselves', closed: true }],
      created_at: '2026-11-19T00:00:00Z',
      description: 'Alice and Bob introduced themselves.',
      room: R,
      score: 66.4,
      user_a: U,
      user_b: '0xuser2'
    };
    for (const [status, created] of [[201, true], [200, false]] as const) {
      const { client, calls } = makeClient(status, summary);
      const result = await client.hardMatch(R, U, '0xuser2', { token: 'tok' });
      expect(result).toEqual({ summary, created });
      expect(nth(calls, 0)).toEqual({
        method: 'POST',
        path: '/api/hard-match',
        body: { room_address: R, first_user_address: U, second_user_address: '0xuser2' }
      });
    }
  });

  it('shareContact POSTs /api/contact with {from, to, content}', async () => {
    const contact = {
      content: 'telegram: @me',
      created_at: '2026-11-19T00:00:00Z',
      from: U,
      to: '0xuser2'
    };
    const { client, calls } = makeClient(201, contact);
    await expect(
      client.shareContact('0xuser2', 'telegram: @me', U, { token: 'tok' })
    ).resolves.toEqual(contact);
    expect(nth(calls, 0)).toEqual({
      method: 'POST',
      path: '/api/contact',
      body: { from: U, to: '0xuser2', content: 'telegram: @me' }
    });
  });

  it('listContactsSharedWith GETs /api/contact/{address}', async () => {
    const contacts = [
      { content: 'telegram: @me', created_at: '2026-11-19T00:00:00Z', from: '0xuser2', to: U }
    ];
    const { client, calls } = makeClient(200, contacts);
    await expect(client.listContactsSharedWith(U, { token: 'tok' })).resolves.toEqual(contacts);
    expect(nth(calls, 0)).toEqual({ method: 'GET', path: `/api/contact/${U}`, body: undefined });
  });
});

describe('BleakClient v3 client-side validation (server 400 caps mirrored pre-flight)', () => {
  const R = '0xroom1';
  const U = '0xuser1';
  const row = (title: string, group: number, key: number) => ({ title, group, key });

  it.each([
    { name: 'an empty interests list', rows: [] as { title: string; group: number; key: number }[] },
    { name: '51 interest rows', rows: Array.from({ length: 51 }, (_, i) => row('t', 1, i)) }
  ])('addUserInterests rejects $name', async ({ rows }) => {
    const { client, calls } = makeRecordingClient(201, []);
    await expect(client.addUserInterests(R, U, rows, { token: 'tok' })).rejects.toBeInstanceOf(
      ValidationError
    );
    expect(calls).toHaveLength(0);
  });

  it.each([
    { name: 'an empty title', title: '' },
    { name: 'a 65-symbol title', title: 'x'.repeat(65) },
    { name: 'a 65-RUNE title (symbols, not code units)', title: 'é'.repeat(65) }
  ])('addUserInterests rejects $name', async ({ title }) => {
    const { client, calls } = makeRecordingClient(201, []);
    await expect(
      client.addUserInterests(R, U, [row(title, 1, 7)], { token: 'tok' })
    ).rejects.toBeInstanceOf(ValidationError);
    expect(calls).toHaveLength(0);
  });

  it.each([
    { name: 'a negative group', group: -1, key: 1 },
    { name: 'a negative key', group: 1, key: -1 }
  ])('addUserInterests rejects $name', async ({ group, key }) => {
    const { client, calls } = makeRecordingClient(201, []);
    await expect(
      client.addUserInterests(R, U, [row('Chess', group, key)], { token: 'tok' })
    ).rejects.toBeInstanceOf(ValidationError);
    expect(calls).toHaveLength(0);
  });

  it('addUserInterests accepts a 64-rune title, group/key ≥ 0 and 50 rows', async () => {
    const { client, calls } = makeRecordingClient(201, []);
    await expect(
      client.addUserInterests(R, U, Array.from({ length: 50 }, (_, i) => row('é'.repeat(64), 0, i)), {
        token: 'tok'
      })
    ).resolves.toEqual([]);
    expect(calls).toHaveLength(1);
  });

  it.each([
    { name: 'an empty keys list', keys: [] as number[] },
    { name: '51 keys', keys: Array.from({ length: 51 }, (_, i) => i) }
  ])('deleteUserInterests rejects $name', async ({ keys }) => {
    const { client, calls } = makeRecordingClient(200, []);
    await expect(client.deleteUserInterests(R, U, keys, { token: 'tok' })).rejects.toBeInstanceOf(
      ValidationError
    );
    expect(calls).toHaveLength(0);
  });

  it.each([
    { name: 'an empty content', content: '' },
    { name: 'a 256-symbol content', content: 'x'.repeat(256) },
    { name: 'a 256-rune content', content: 'é'.repeat(256) }
  ])('shareContact rejects $name', async ({ content }) => {
    const { client, calls } = makeRecordingClient(201, []);
    await expect(
      client.shareContact('0xuser2', content, U, { token: 'tok' })
    ).rejects.toBeInstanceOf(ValidationError);
    expect(calls).toHaveLength(0);
  });

  it('shareContact accepts a 255-rune content', async () => {
    const { client, calls } = makeRecordingClient(201, []);
    await expect(
      client.shareContact('0xuser2', 'é'.repeat(255), U, { token: 'tok' })
    ).resolves.toEqual([]);
    expect(calls).toHaveLength(1);
  });
});

describe('BleakClient v3 — Chat.done (CONCEPT §13 R2)', () => {
  it('parses done from a chat payload (farewell stamps it, kickoff resets it server-side)', async () => {
    const chat = {
      address: '0xchat1',
      room: '0xr',
      phase: 'networking',
      phase_started_at: '2026-11-19T00:00:00Z',
      scenario: 'ai-future',
      language: 'en',
      done: true,
      created_at: '2026-11-19T00:00:00Z',
      participants: [{ chat: '0xchat1', user: '0xuser1' }]
    };
    const { client } = makeClient(200, chat);
    const parsed = await client.getChat('0xchat1');
    expect(parsed.done).toBe(true);
  });

  it('parses done on every chat of a gated listing', async () => {
    const chats = [
      { address: '0xchat1', done: true },
      { address: '0xchat2', done: false }
    ];
    const { client } = makeClient(200, chats);
    const parsed = await client.listChatsOfUser('0xuser1');
    expect(parsed[0]?.done).toBe(true);
    expect(parsed[1]?.done).toBe(false);
  });
});
