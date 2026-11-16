/** QR scannability roundtrip (TZ-08, DESIGN §3.6 AC 12): the badge QR —
 * `uqr` encode with the same options as QrCodeBadge (border 4, ecc M) —
 * decodes via the real jsqr decoder back to `{base}?u={address}`, i.e. the
 * §3.8 scanner resolves the correct user address from the badge. */
import { describe, expect, it } from 'vitest';
import { encode, renderSVG } from 'uqr';
import jsQR from 'jsqr';
import { personaQrPayload } from '../src/lib/components/profile/qr';

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

/** Same options as QrCodeBadge.svelte (quiet zone 4, ecc M). */
function encodeBadge(payload: string): { data: boolean[][]; size: number } {
  const qr = encode(payload, { border: 4, ecc: 'M' });
  return { data: qr.data, size: qr.size };
}

describe('badge QR decode roundtrip (AC 12)', () => {
  it('decodes the persona payload back to {base}?u={address}&m={code}', () => {
    const payload = personaQrPayload('0xagent42', 'one-time-code', 'http://localhost:5173');
    const { data, size } = encodeBadge(payload);

    // Quiet zone of 4 modules on all four sides (DESIGN §3.6).
    for (let i = 0; i < 4; i++) {
      expect(data[i]!.every((module) => module === false)).toBe(true);
      expect(data[size - 1 - i]!.every((module) => module === false)).toBe(true);
      expect(data.every((row) => row[i] === false)).toBe(true);
      expect(data.every((row) => row[size - 1 - i] === false)).toBe(true);
    }

    const decoded = jsQR(matrixToRgba(data, size), size, size);
    expect(decoded?.data).toBe('http://localhost:5173/?u=0xagent42&m=one-time-code');
  });

  it('decodes an escaped address AND mutual code intact (the scanner reads u + m)', () => {
    const address = '0xbandersnatch';
    const code = '4/ty+Z8';
    const payload = personaQrPayload(address, code, 'https://bleak.example/app');
    const { data, size } = encodeBadge(payload);
    const decoded = jsQR(matrixToRgba(data, size), size, size);
    expect(decoded?.data).toBe(`https://bleak.example/app/?u=${address}&m=4%2Fty%2BZ8`);
    // The §3.8 scanner parses BOTH the user address and the mutual code
    // from the decoded payload (AC 12 — decoding yields u AND m).
    const params = new URLSearchParams(
      (decoded?.data ?? '').slice((decoded?.data ?? '').indexOf('?') + 1)
    );
    expect(params.get('u')).toBe(address);
    expect(params.get('m')).toBe('4/ty+Z8');
  });

  it('the SVG rendering carries the token colors (dark on light frame)', () => {
    // Same call the component makes — the inline SVG must reference the
    // tokens (no hardcoded hex, §2.4) so dark modules sit on the light
    // --color-qr-frame backdrop.
    const svg = renderSVG('http://localhost:5173/?u=0x1', {
      border: 4,
      ecc: 'M',
      pixelSize: 8,
      whiteColor: 'var(--color-qr-frame)',
      blackColor: 'var(--color-surface)'
    });
    expect(svg).toContain('fill="var(--color-qr-frame)"');
    expect(svg).toContain('fill="var(--color-surface)"');
    expect(svg).toContain('<svg xmlns="http://www.w3.org/2000/svg"');
  });
});
