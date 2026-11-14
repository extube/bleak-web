import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp, type AppDeps } from '../src/app.js';
import { InviteStore } from '../src/db.js';
import { loadEnv, inviteUrlFor, type HelperEnv } from '../src/env.js';

function testEnv(overrides: Partial<HelperEnv> = {}): HelperEnv {
  return {
    port: 8787,
    hostToken: 'test-token',
    bleakNodeUrl: 'http://node.test',
    dbPath: ':memory:',
    inviteUrlBase: 'http://localhost:5173/',
    ...overrides
  };
}

const fakeQr: AppDeps['qrPng'] = async () => Buffer.from('fake-png');

function makeApp(
  options: {
    bleak?: (path: string, init?: RequestInit) => Promise<{ status: number; body: unknown }>;
  } = {}
) {
  const invites = new InviteStore(':memory:');
  const storeClose = () => invites.close();
  const bleakCalls: Array<{ path: string; init?: RequestInit }> = [];
  const bleakFetch = (async (input: string | URL, init?: RequestInit) => {
    const path = String(input).replace(/^https?:\/\/[^/]+/, '');
    bleakCalls.push({ path, init });
    const outcome =
      options.bleak?.(path, init) ?? { status: 201, body: { address: '0xroomABC', name: 'x' } };
    return new Response(JSON.stringify(outcome.body), { status: outcome.status });
  }) as unknown as typeof fetch;
  const app = createApp({
    env: testEnv(),
    invites,
    bleakFetch,
    qrPng: fakeQr
  });
  return { app, invites, storeClose, bleakCalls };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('helper: code -> room resolution', () => {
  it('persists and resolves the mapping', () => {
    const store = new InviteStore(':memory:');
    store.save('000001', '0xroomABC');
    expect(store.resolve('000001')).toMatchObject({
      code: '000001',
      roomAddress: '0xroomABC'
    });
    expect(store.resolve('999999')).toBeNull();
    store.close();
  });

  it('rejects duplicate codes', () => {
    const store = new InviteStore(':memory:');
    store.save('123456', '0xroomABC');
    expect(() => store.save('123456', '0xroomXYZ')).toThrow();
    store.close();
  });

  it('join lookup maps a code to its room address', async () => {
    const { app, invites, storeClose } = makeApp();
    invites.save('543210', '0xroomABC');
    const res = await app.request('/rooms/543210');
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ code: '543210', room_address: '0xroomABC' });
    storeClose();
  });

  it('404 for unknown codes, 400 for malformed ones', async () => {
    const { app, storeClose } = makeApp();
    expect((await app.request('/rooms/111111')).status).toBe(404);
    const bad = await app.request('/rooms/0xroom');
    expect(bad.status).toBe(400);
    storeClose();
  });
});

describe('helper: host-token-gated room creation', () => {
  const goodBody = JSON.stringify({ name: 'Meetup Room', language: 'ru' });

  it('creates the room in bleak-node, mints a code, returns the invite URL', async () => {
    const { app, invites, storeClose, bleakCalls } = makeApp();
    const res = await app.request('/rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-host-token': 'test-token' },
      body: goodBody
    });
    expect(res.status).toBe(201);
    const payload = (await res.json()) as { room: { address: string }; code: string; invite_url: string };
    expect(payload.room.address).toBe('0xroomABC');
    expect(payload.code).toMatch(/^\d{6}$/);
    expect(payload.invite_url).toBe(`http://localhost:5173/?code=${payload.code}`);
    // mapping round-trips
    expect(invites.resolve(payload.code)?.roomAddress).toBe('0xroomABC');
    // room was created via the bleak-node REST API, not any direct DB access
    expect(bleakCalls[0]?.path).toBe('/api/room');
    storeClose();
  });

  it('rejects missing/wrong host token with 403', async () => {
    const { app, storeClose } = makeApp();
    const noToken = await app.request('/rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: goodBody
    });
    expect(noToken.status).toBe(403);
    const wrongToken = await app.request('/rooms', {
      method: 'POST',
      headers: { 'x-host-token': 'attacker' },
      body: goodBody
    });
    expect(wrongToken.status).toBe(403);
    storeClose();
  });

  it('400 on missing name, 502 when bleak-node rejects the room', async () => {
    const { app, storeClose } = makeApp();
    const noName = await app.request('/rooms', {
      method: 'POST',
      headers: { 'x-host-token': 'test-token', 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    expect(noName.status).toBe(400);

    const { app: app2, storeClose: close2 } = makeApp({
      bleak: () => ({ status: 400, body: 'bad room' })
    });
    const rejected = await app2.request('/rooms', {
      method: 'POST',
      headers: { 'x-host-token': 'test-token', 'Content-Type': 'application/json' },
      body: goodBody
    });
    expect(rejected.status).toBe(502);
    close2();
    storeClose();
  });
});

describe('helper: QR endpoint', () => {
  it('returns a PNG for a known code', async () => {
    const { app, invites, storeClose } = makeApp();
    invites.save('777777', '0xroomABC');
    const res = await app.request('/rooms/777777/qr');
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('image/png');
    const buf = Buffer.from(await res.arrayBuffer());
    expect(buf.toString()).toBe('fake-png');
    storeClose();
  });
});

describe('helper: env defaults', () => {
  it('exposes sane defaults', () => {
    const env = loadEnv();
    expect(env.port).toBeGreaterThan(0);
    expect(env.hostToken.length).toBeGreaterThan(0);
    expect(env.bleakNodeUrl).toMatch(/^https?:\/\//);
  });

  it('builds invite URLs with ?code=', () => {
    expect(inviteUrlFor(testEnv(), '123456')).toBe('http://localhost:5173/?code=123456');
    expect(inviteUrlFor(testEnv({ inviteUrlBase: 'https://x.y/join' }), '123456')).toBe(
      'https://x.y/join?code=123456'
    );
  });
});
