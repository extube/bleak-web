/** parseQrPayload tests (TZ-04, DESIGN §3.8 binding payload formats). */
import { describe, expect, it } from 'vitest';
import { parseQrPayload } from '../src/lib/scanner/payload';

describe('parseQrPayload', () => {
  it('parses an invite QR (any path prefix)', () => {
    expect(parseQrPayload('http://localhost:5173/?code=123456')).toEqual({
      kind: 'invite',
      code: '123456'
    });
    expect(parseQrPayload('https://bleak.example/join?code=000000')).toEqual({
      kind: 'invite',
      code: '000000'
    });
  });

  it('parses a persona QR (any path prefix)', () => {
    expect(parseQrPayload('http://localhost:5173/?u=0xbob')).toEqual({
      kind: 'persona',
      userAddress: '0xbob'
    });
    expect(parseQrPayload('https://bleak.example/badge?u=0xalice')).toEqual({
      kind: 'persona',
      userAddress: '0xalice'
    });
  });

  it('rejects a malformed (non-6-digit) code', () => {
    expect(parseQrPayload('http://localhost:5173/?code=12345')).toBeNull();
    expect(parseQrPayload('http://localhost:5173/?code=12a456')).toBeNull();
  });

  it('rejects content with neither ?code= nor ?u= (invalid state)', () => {
    expect(parseQrPayload('http://localhost:5173/')).toBeNull();
    expect(parseQrPayload('https://example.com/something?x=1')).toBeNull();
  });

  it('rejects non-URL garbage and empty text', () => {
    expect(parseQrPayload('')).toBeNull();
    expect(parseQrPayload('   ')).toBeNull();
    expect(parseQrPayload('hello bleak-web')).toBeNull();
  });
});
