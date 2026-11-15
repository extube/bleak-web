/**
 * Crypto secrets tests (TZ2-03, ARCH §10.5 test strategy):
 * - fixed-fake determinism for generation;
 * - base64url charset / length / no-padding assertions (RFC 4648 §5);
 * - SHA-256 NIST test vectors against a tiny pure-JS SHA-256 reference
 *   (offline determinism — no dependency on the environment's crypto.subtle);
 * - WebCrypto default-path cross-check when the runtime provides subtle;
 * - generation length asserts (32 B → 43 chars, 16 B → 22 chars).
 */
import { describe, expect, it, vi } from 'vitest';
import {
  MUTUAL_CODE_BYTES,
  TOKEN_SECRET_BYTES,
  bytesToBase64Url,
  generateMutualCode,
  generateTokenSecret,
  sha256Hex
} from '../src/lib/crypto/secrets';
import type { SecretSource } from '../src/lib/crypto/secrets';

// ---------------------------------------------------------------------------
// Pure-JS SHA-256 reference (test-only): standard FIPS 180-4 implementation.
// Independent of the module under test — it validates the vectors, then the
// vectors validate the module's injected-source pass-through and (where the
// runtime has it) the WebCrypto default path.
// ---------------------------------------------------------------------------

const SHA256_K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
]);

function rotr(x: number, n: number): number {
  return ((x >>> n) | (x << (32 - n))) >>> 0;
}

function sha256ReferenceBytes(message: Uint8Array): Uint8Array {
  const H = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
  ]);
  const bitLength = message.length * 8;
  const paddedLength = Math.ceil((message.length + 9) / 64) * 64;
  const padded = new Uint8Array(paddedLength);
  padded.set(message);
  padded[message.length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(paddedLength - 8, Math.floor(bitLength / 0x100000000));
  view.setUint32(paddedLength - 4, bitLength >>> 0);

  const w = new Uint32Array(64);
  for (let offset = 0; offset < paddedLength; offset += 64) {
    for (let t = 0; t < 16; t += 1) w[t] = view.getUint32(offset + t * 4);
    for (let t = 16; t < 64; t += 1) {
      const s0 = rotr(w[t - 15]!, 7) ^ rotr(w[t - 15]!, 18) ^ (w[t - 15]! >>> 3);
      const s1 = rotr(w[t - 2]!, 17) ^ rotr(w[t - 2]!, 19) ^ (w[t - 2]! >>> 10);
      w[t] = (w[t - 16]! + s0 + w[t - 7]! + s1) >>> 0;
    }
    let a = H[0]!;
    let b = H[1]!;
    let c = H[2]!;
    let d = H[3]!;
    let e = H[4]!;
    let f = H[5]!;
    let g = H[6]!;
    let h = H[7]!;
    for (let t = 0; t < 64; t += 1) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + SHA256_K[t]! + w[t]!) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }
    H[0] = (H[0]! + a) >>> 0;
    H[1] = (H[1]! + b) >>> 0;
    H[2] = (H[2]! + c) >>> 0;
    H[3] = (H[3]! + d) >>> 0;
    H[4] = (H[4]! + e) >>> 0;
    H[5] = (H[5]! + f) >>> 0;
    H[6] = (H[6]! + g) >>> 0;
    H[7] = (H[7]! + h) >>> 0;
  }
  const out = new Uint8Array(32);
  const outView = new DataView(out.buffer);
  for (let i = 0; i < 8; i += 1) outView.setUint32(i * 4, H[i]!);
  return out;
}

/** Reference digest as lowercase hex over a UTF-8 string. */
function sha256ReferenceHex(text: string): string {
  return [...sha256ReferenceBytes(new TextEncoder().encode(text))]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

/** Injected SecretSource backed by the pure-JS reference (offline determinism). */
const referenceSource: SecretSource = {
  randomBytes: () => new Uint8Array(0),
  digestHex: async (data) => sha256ReferenceHex(new TextDecoder().decode(data))
};

// Fixed-fake sources ------------------------------------------------------------

/** xorshift32 PRNG source: same seed ⇒ same byte stream (determinism tests). */
function seededSource(seed: number): SecretSource {
  let state = seed >>> 0;
  const next = (): number => {
    state ^= (state << 13) >>> 0;
    state >>>= 0;
    state ^= state >>> 17;
    state ^= (state << 5) >>> 0;
    state >>>= 0;
    return state;
  };
  return {
    randomBytes: (length) => {
      const out = new Uint8Array(length);
      for (let i = 0; i < length; i += 1) out[i] = next() & 0xff;
      return out;
    },
    digestHex: async () => 'f'.repeat(64)
  };
}

/** Static-byte source for known-vector base64url assertions. */
function staticSource(bytes: number[]): SecretSource {
  return {
    randomBytes: (length) => Uint8Array.from(bytes.slice(0, length)),
    digestHex: async () => ''
  };
}

// bytesToBase64Url ---------------------------------------------------------------

describe('bytesToBase64Url (RFC 4648 §5, padding stripped)', () => {
  it('encodes known vectors', () => {
    expect(bytesToBase64Url(new TextEncoder().encode('foobar'))).toBe('Zm9vYmFy');
    expect(bytesToBase64Url(new TextEncoder().encode('foob'))).toBe('Zm9vYg');
    expect(bytesToBase64Url(Uint8Array.from([0xff, 0xff, 0xfe]))).toBe('___-');
    expect(bytesToBase64Url(Uint8Array.from([0xff]))).toBe('_w');
  });

  it('never emits padding or non-URL-safe characters', () => {
    for (let length = 0; length <= 10; length += 1) {
      const encoded = bytesToBase64Url(seededSource(length + 1).randomBytes(length));
      expect(encoded).toMatch(/^[A-Za-z0-9_-]*$/);
      expect(encoded).not.toContain('=');
      expect(encoded).not.toContain('+');
      expect(encoded).not.toContain('/');
    }
  });
});

// generateTokenSecret -------------------------------------------------------------

describe('generateTokenSecret', () => {
  it('produces 43 base64url characters (32 bytes → ceil(256/6), no padding)', () => {
    const token = generateTokenSecret(seededSource(1));
    expect(TOKEN_SECRET_BYTES).toBe(32);
    expect(token).toHaveLength(43);
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(token).not.toContain('=');
  });

  it('is deterministic per injected fake source (fixed-fake determinism)', () => {
    expect(generateTokenSecret(seededSource(42))).toBe(generateTokenSecret(seededSource(42)));
    expect(generateTokenSecret(seededSource(42))).not.toBe(generateTokenSecret(seededSource(43)));
  });

  it('draws exactly 32 random bytes from the source', () => {
    const source = seededSource(7);
    const spy = vi.spyOn(source, 'randomBytes');
    generateTokenSecret(source);
    expect(spy).toHaveBeenCalledWith(32);
  });

  it('default path yields the same shape with real WebCrypto randomness', () => {
    const hasGetRandomValues =
      typeof globalThis.crypto !== 'undefined' &&
      typeof globalThis.crypto.getRandomValues === 'function';
    if (!hasGetRandomValues) return; // secure-context unavailable in this runtime
    const a = generateTokenSecret();
    const b = generateTokenSecret();
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(b).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(a).not.toBe(b); // real randomness never repeats across calls
  });
});

// generateMutualCode --------------------------------------------------------------

describe('generateMutualCode', () => {
  it('produces 22 URL-safe base64url characters (16 bytes)', () => {
    const code = generateMutualCode(seededSource(5));
    expect(MUTUAL_CODE_BYTES).toBe(16);
    expect(code).toHaveLength(22);
    expect(code).toMatch(/^[A-Za-z0-9_-]{22}$/); // URL-safe: fits a `m` query param
    expect(code).not.toContain('=');
  });

  it('is deterministic per fake source and varies across seeds', () => {
    expect(generateMutualCode(seededSource(9))).toBe(generateMutualCode(seededSource(9)));
    expect(generateMutualCode(seededSource(9))).not.toBe(generateMutualCode(seededSource(10)));
  });

  it('draws exactly 16 random bytes from the source', () => {
    const source = seededSource(11);
    const spy = vi.spyOn(source, 'randomBytes');
    generateMutualCode(source);
    expect(spy).toHaveBeenCalledWith(16);
  });

  it('generates distinct codes across many calls', () => {
    const codes = Array.from({ length: 20 }, (_, i) => generateMutualCode(seededSource(i + 1)));
    expect(new Set(codes).size).toBe(20);
  });
});

// sha256Hex -----------------------------------------------------------------------

describe('sha256Hex (injected pure-JS reference)', () => {
  it('hashes the NIST test vectors', () => {
    expect(sha256ReferenceHex('')).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
    );
    expect(sha256ReferenceHex('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
    );
    expect(sha256ReferenceHex('The quick brown fox jumps over the lazy dog')).toBe(
      'd7a8fbb307d7809469ca9abcb0082e4f8d5651e46d3cdb762d02d0bf37c9e592'
    );
    // One million 'a' (multi-block + long length encoding):
    expect(sha256ReferenceHex('a'.repeat(1_000_000))).toBe(
      'cdc76e5c9914fb9281a1c7e284d73e67f1809a48a497200e046d39ccc7112cd0'
    );
  });

  it('passes the UTF-8 TextEncoder bytes to the source and returns its hex', async () => {
    const source = staticSource([]);
    const spy = vi.spyOn(source, 'digestHex');
    spy.mockImplementation(async (data) => referenceSource.digestHex(data));
    const result = await sha256Hex('привет', source);
    expect(spy).toHaveBeenCalledWith(new TextEncoder().encode('привет'));
    expect(result).toBe(sha256ReferenceHex('привет'));
    expect(result).toMatch(/^[0-9a-f]{64}$/); // lowercase hex, 64 chars
  });

  it('matches the pure-JS reference for the mutual-code round trip', async () => {
    const code = generateMutualCode(seededSource(21));
    expect(await sha256Hex(code, referenceSource)).toBe(sha256ReferenceHex(code));
  });
});

describe.skipIf(
  typeof globalThis.crypto === 'undefined' || typeof globalThis.crypto.subtle?.digest !== 'function'
)('sha256Hex (WebCrypto default path)', () => {
  it('matches the pure-JS reference (cross-check incl. non-ASCII UTF-8)', async () => {
    for (const text of ['abc', 'The quick brown fox jumps over the lazy dog', 'привет']) {
      expect(await sha256Hex(text)).toBe(sha256ReferenceHex(text));
    }
  });
});
