/** Helper v2 tests (TZ2-05 Part B, ARCHITECTURE §10.10): the shrunken
 * stateless surface — health + QR PNG only. The QR encoder stays mocked and
 * injectable; a 6-digit code renders its invite URL; malformed input is
 * rejected. The mapping endpoints of v1 no longer exist. */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp, type AppDeps } from '../src/app.js';
import { loadEnv, inviteUrlFor, type HelperEnv } from '../src/env.js';

function testEnv(overrides: Partial<HelperEnv> = {}): HelperEnv {
  return {
    port: 8787,
    inviteUrlBase: 'http://localhost:5173/',
    ...overrides
  };
}

function makeApp(options: { env?: HelperEnv; qrPng?: AppDeps['qrPng'] } = {}) {
  const qrCalls: string[] = [];
  const qrPng: AppDeps['qrPng'] =
    options.qrPng ??
    (async (text: string) => {
      qrCalls.push(text);
      return Buffer.from(`fake-png:${text}`);
    });
  const app = createApp({ env: options.env ?? testEnv(), qrPng });
  return { app, qrCalls };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('helper: health', () => {
  it('answers the liveness probe', async () => {
    const { app } = makeApp();
    const res = await app.request('/health');
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true, service: 'bleak-helper' });
  });
});

describe('helper: stateless QR endpoint', () => {
  it('renders the invite URL for ANY well-formed 6-digit code (no mapping lookup — unknown codes are renderable)', async () => {
    const { app, qrCalls } = makeApp();
    const res = await app.request('/rooms/123456/qr');
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('image/png');
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    const buf = Buffer.from(await res.arrayBuffer());
    expect(buf.toString()).toBe('fake-png:http://localhost:5173/?code=123456');
    expect(qrCalls).toEqual(['http://localhost:5173/?code=123456']);
  });

  it('the encoded payload is the invite deep link, not a room address', async () => {
    const { app } = makeApp({ env: testEnv({ inviteUrlBase: 'https://bleak.example/join' }) });
    await app.request('/rooms/000000/qr');
    // the injected encoder received the full invite URL (asserted via the body below)
    const res = await app.request('/rooms/999999/qr');
    const buf = Buffer.from(await res.arrayBuffer());
    expect(buf.toString()).toBe('fake-png:https://bleak.example/join?code=999999');
  });

  it('400 for malformed codes (strict 6-digit validation, no DB round-trip)', async () => {
    const { app } = makeApp();
    // (An empty path segment never reaches the handler at all — Hono 404s it.)
    for (const bad of ['0xroom', '12345', '1234567', '12345a']) {
      const res = await app.request(`/rooms/${encodeURIComponent(bad)}/qr`);
      expect(res.status).toBe(400);
      await expect(res.json()).resolves.toEqual({ error: 'invite code must be 6 digits' });
    }
  });

  it('never exposes room creation, mapping resolve, or a host-token gate', async () => {
    const { app } = makeApp();
    expect((await app.request('/rooms', { method: 'POST' })).status).toBe(404);
    expect((await app.request('/rooms/123456')).status).toBe(404);
    // no auth is consulted anywhere: an x-host-token header changes nothing
    const res = await app.request('/rooms/123456/qr', { headers: { 'x-host-token': 'attacker' } });
    expect(res.status).toBe(200);
  });
});

describe('helper: env defaults', () => {
  it('exposes sane defaults (stateless: no host token, no node url, no db path)', () => {
    const env = loadEnv();
    expect(env.port).toBeGreaterThan(0);
    expect(env.inviteUrlBase).toMatch(/^https?:\/\//);
    const keys = Object.keys(env).sort();
    expect(keys).toEqual(['inviteUrlBase', 'port']);
  });

  it('builds invite URLs with ?code=', () => {
    expect(inviteUrlFor(testEnv(), '123456')).toBe('http://localhost:5173/?code=123456');
    expect(inviteUrlFor(testEnv({ inviteUrlBase: 'https://x.y/join' }), '123456')).toBe(
      'https://x.y/join?code=123456'
    );
  });
});
