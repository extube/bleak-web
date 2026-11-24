/** InviteQr tests (TZ13-01, DESIGN rev. 4 §4.2 / §3.7.4 item 1): the shared
 * client-side SVG renderer — ZERO network requests (no helper PNG), the QR
 * encodes the absolute invite deep link `{INVITE_URL_BASE}?code={code}` and
 * decodes back to it, and the ariaLabel/size props land on the frame. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/svelte';
import { encode } from 'uqr';
import jsQR from 'jsqr';
import InviteQr from '../src/lib/components/qr/InviteQr.svelte';
import { inviteQrPayload, svgQr } from '../src/lib/qr/svgQr';

const BASE = 'http://localhost:5173';
const CODE = '123456';

/** uqr boolean matrix → RGBA buffer jsqr accepts (black=true → 0,0,0,255). */
function matrixToRgba(data: boolean[][], size: number): Uint8ClampedArray {
  const rgba = new Uint8ClampedArray(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const offset = (y * size + x) * 4;
      const dark = data[y]![x]!;
      rgba[offset] = dark ? 0 : 255;
      rgba[offset + 1] = dark ? 0 : 255;
      rgba[offset + 2] = dark ? 0 : 255;
      rgba[offset + 3] = 255;
    }
  }
  return rgba;
}

beforeEach(() => {
  // Zero-network contract: any network access during render FAILS the test —
  // the invite QR is computed client-side only (§3.7.4, rev. 4 decision).
  vi.stubGlobal(
    'fetch',
    vi.fn(() => {
      throw new Error('InviteQr must not issue network requests');
    })
  );
  vi.stubGlobal(
    'XMLHttpRequest',
    vi.fn(function () {
      throw new Error('InviteQr must not issue network requests');
    })
  );
  vi.stubGlobal(
    'Image',
    vi.fn(function () {
      throw new Error('InviteQr must not load images');
    })
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('InviteQr (shared uqr renderer, TZ13-01)', () => {
  it('renders the client-side SVG with ZERO network requests (fetch/XHR/Image never touched)', () => {
    const { container } = render(InviteQr, {
      props: { code: CODE, size: 280, ariaLabel: 'QR-код приглашения 123456', baseUrl: BASE }
    });
    const frame = container.querySelector('.frame');
    expect(frame).toBeTruthy();
    expect(frame?.querySelector('svg')).toBeTruthy();
    // No network access happened — the stubs would have thrown on any use.
    expect(vi.mocked(fetch).mock.calls.length).toBe(0);
  });

  it('encodes the absolute invite deep link {base}/?code={code} — decodes back via jsqr', () => {
    const payload = inviteQrPayload(CODE, BASE);
    expect(payload).toBe('http://localhost:5173/?code=123456');
    // The SAME encode options the shared renderer uses (border 4, ecc M).
    const qr = encode(payload, { border: 4, ecc: 'M' });
    const decoded = jsQR(matrixToRgba(qr.data, qr.size), qr.size, qr.size);
    expect(decoded?.data).toBe('http://localhost:5173/?code=123456');
  });

  it('renders EXACTLY the shared SVG of the invite deep link (same renderer, same payload)', () => {
    const { container } = render(InviteQr, {
      props: { code: CODE, size: 280, ariaLabel: 'aria', baseUrl: BASE }
    });
    const frame = container.querySelector('.frame');
    // happy-dom serializes self-closing SVG elements expanded; normalize the
    // DOM markup back to the raw renderer's `/>` form before comparing.
    const dom = (frame?.innerHTML ?? '').trim().replace(/><\/(rect|path)>/g, '/>');
    expect(dom).toBe(svgQr(inviteQrPayload(CODE, BASE)));
  });

  it('carries the aria-label and the size prop on the pixel-cornered frame', () => {
    const { container, getByRole } = render(InviteQr, {
      props: { code: CODE, size: 280, ariaLabel: 'Invite QR code 123456', baseUrl: BASE }
    });
    const img = getByRole('img', { name: 'Invite QR code 123456' });
    expect(img).toBeTruthy();
    expect(img.getAttribute('aria-label')).toBe('Invite QR code 123456');
    const frame = container.querySelector('.frame') as HTMLElement;
    expect(frame.style.width).toBe('280px');
    expect(frame.style.height).toBe('280px');
    expect(frame.className).toContain('pixel-corners');
  });

  it('token-colored dark-on-light SVG (no hardcoded hex, §2.4) and code-escaped payload', () => {
    const svg = svgQr(inviteQrPayload(CODE, BASE));
    expect(svg).toContain('fill="var(--color-qr-frame)"');
    expect(svg).toContain('fill="var(--color-surface)"');
    expect(svg).toContain('<svg xmlns="http://www.w3.org/2000/svg"');
    // A code with URL-special characters stays ONE `code` parameter.
    expect(inviteQrPayload('12/4+6', 'https://bleak.example')).toBe(
      'https://bleak.example/?code=12%2F4%2B6'
    );
  });

  it('defaults the base to the shared {INVITE_URL_BASE} resolution (dev origin fallback)', () => {
    // happy-dom test window origin — the SPA-origin fallback of profile/qr.ts.
    expect(inviteQrPayload(CODE)).toBe(`${window.location.origin}/?code=${CODE}`);
  });
});
