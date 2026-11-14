/**
 * Helper API surface (v1):
 *
 *   GET  /health            → liveness probe
 *   POST /rooms             → host-token gated: creates the bleak-node room,
 *                             mints a unique 6-digit invite code, returns
 *                             { room, code, invite_url }
 *   GET  /rooms/:code       → { code, room_address } (attendee join lookup)
 *   GET  /rooms/:code/qr    → PNG QR encoding the invite URL
 *
 * The helper is the ONLY server-side component bleak-web owns. Room creation
 * is gated here because the bleak-node API itself has no auth (pragmatic v1
 * gate; see ARCHITECTURE.md).
 */
import { Hono } from 'hono';
import { isValidCode, generateCode } from './codes.js';
import type { InviteStore } from './db.js';
import { inviteUrlFor, type HelperEnv } from './env.js';

export interface AppDeps {
  env: HelperEnv;
  invites: InviteStore;
  /** bleak-node client-side fetch; injectable for tests. */
  bleakFetch: typeof fetch;
  /** QR PNG encoder; injectable for tests. */
  qrPng: (text: string) => Promise<Buffer>;
}

export interface InvitePayload {
  room: {
    address: string;
    name: string;
    description?: string;
    language?: string;
  };
  code: string;
  invite_url: string;
}

const MAX_CODE_ATTEMPTS = 10;

export function createApp(deps: AppDeps): Hono {
  const app = new Hono();
  const { env, invites, bleakFetch } = deps;

  app.get('/health', (c) => c.json({ ok: true, service: 'bleak-helper' }));

  app.post('/rooms', async (c) => {
    const token = c.req.header('x-host-token');
    if (token !== env.hostToken) {
      return c.json({ error: 'host token required to create rooms' }, 403);
    }
    const body = await c.req.json<{ name?: string; description?: string; language?: string; max_user?: number }>().catch(
      () => null
    );
    if (!body || typeof body.name !== 'string' || body.name.trim().length === 0) {
      return c.json({ error: 'name is required' }, 400);
    }

    // 1. Create the room in bleak-node (server generates the address).
    const roomResponse = await bleakFetch(`${env.bleakNodeUrl}/api/room`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: body.name,
        ...(body.description !== undefined ? { description: body.description } : {}),
        ...(body.language !== undefined ? { language: body.language } : {})
      })
    });
    if (!roomResponse.ok) {
      return c.json(
        { error: `bleak-node rejected room creation (${roomResponse.status})` },
        502
      );
    }
    const room = (await roomResponse.json()) as { address: string; name?: string };

    // 2. Mint a unique 6-digit code and persist the mapping.
    let code = '';
    for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt++) {
      const candidate = generateCode();
      if (invites.resolve(candidate) === null) {
        code = candidate;
        break;
      }
    }
    if (code === '') {
      return c.json({ error: 'could not allocate a unique invite code' }, 500);
    }
    invites.save(code, room.address);

    const payload: InvitePayload = {
      room: {
        address: room.address,
        name: body.name.trim()
      },
      code,
      invite_url: inviteUrlFor(env, code)
    };
    return c.json(payload, 201);
  });

  app.get('/rooms/:code', (c) => {
    const code = c.req.param('code');
    if (!isValidCode(code)) {
      return c.json({ error: 'invite code must be 6 digits' }, 400);
    }
    const record = invites.resolve(code);
    if (record === null) {
      return c.json({ error: 'unknown invite code' }, 404);
    }
    return c.json({ code: record.code, room_address: record.roomAddress });
  });

  app.get('/rooms/:code/qr', async (c) => {
    const code = c.req.param('code');
    if (!isValidCode(code)) {
      return c.json({ error: 'invite code must be 6 digits' }, 400);
    }
    const record = invites.resolve(code);
    if (record === null) {
      return c.json({ error: 'unknown invite code' }, 404);
    }
    const png = await deps.qrPng(inviteUrlFor(env, code));
    return c.body(new Uint8Array(png), 200, { 'Content-Type': 'image/png', 'Cache-Control': 'no-store' });
  });

  return app;
}
