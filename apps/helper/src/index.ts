import { serve } from '@hono/node-server';
import QRCode from 'qrcode';
import { createApp } from './app.js';
import { InviteStore } from './db.js';
import { loadEnv } from './env.js';

const env = loadEnv();
const invites = new InviteStore(env.dbPath);
const app = createApp({
  env,
  invites,
  bleakFetch: fetch.bind(globalThis),
  qrPng: (text) =>
    QRCode.toBuffer(text, {
      type: 'png',
      width: 512,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: { dark: '#1A1C20', light: '#F0F0F0' }
    })
});

serve({ fetch: app.fetch, port: env.port }, (info) => {
  console.log(`[helper] listening on http://localhost:${info.port} (db: ${env.dbPath})`);
});
