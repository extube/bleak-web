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

  it('creates a room via POST /api/room with a JSON body', async () => {
    const room = { address: '0xroom1' };
    const req = { name: 'Meta Room', language: 'ru' };
    const { client, calls } = makeClient(201, room);
    await expect(client.createRoom(req)).resolves.toEqual(room);
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
