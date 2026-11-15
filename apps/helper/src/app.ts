/**
 * Helper API surface (v2 — ARCHITECTURE §10.10):
 *
 *   GET  /health            → liveness probe
 *   GET  /rooms/:code/qr    → PNG QR encoding the invite URL (STATELESS)
 *
 * Everything else was retired in v2: bleak-node resolves invite codes
 * natively (CONCEPT §7.2), so the code→room-address mapping, the
 * host-token-gated room creation and the bleak-node client dependency are
 * gone. The helper is a stateless QR-image service — the ONLY server-side
 * component bleak-web owns — and it never talks to bleak-node and never
 * handles credentials (§10.11).
 */
import { Hono } from 'hono';
import { isValidCode } from './codes.js';
import { inviteUrlFor, type HelperEnv } from './env.js';

export interface AppDeps {
  env: HelperEnv;
  /** QR PNG encoder; injectable for tests. */
  qrPng: (text: string) => Promise<Buffer>;
}

export function createApp(deps: AppDeps): Hono {
  const app = new Hono();
  const { env } = deps;

  app.get('/health', (c) => c.json({ ok: true, service: 'bleak-helper' }));

  app.get('/rooms/:code/qr', async (c) => {
    const code = c.req.param('code');
    if (!isValidCode(code)) {
      return c.json({ error: 'invite code must be 6 digits' }, 400);
    }
    // Stateless: no mapping lookup — unknown codes are renderable (§10.10);
    // the payload is the invite deep link the SPA resolves via its own seam.
    const png = await deps.qrPng(inviteUrlFor(env, code));
    return c.body(new Uint8Array(png), 200, { 'Content-Type': 'image/png', 'Cache-Control': 'no-store' });
  });

  return app;
}
