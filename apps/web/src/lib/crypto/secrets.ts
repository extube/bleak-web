/**
 * Credential secrets (ARCHITECTURE §10.5): client-side generation of persona
 * tokens, room tokens, and one-time mutual codes, plus SHA-256 hashing for
 * mutual-code registration (Concept §6.3: the registration call carries the
 * code's HASH — never the raw code). Zero external dependencies — WebCrypto
 * only; randomness is ≥32 bytes per bleak-node CONCEPT §7.4.
 *
 * **Secure-context note (binding, ARCH §10.5):** `crypto.subtle` (and
 * full-strength `crypto.getRandomValues`) require a SECURE CONTEXT — HTTPS,
 * or localhost for development. This is the SAME requirement as the camera
 * scanner (DESIGN §2.7): a plain-HTTP LAN preview loses credential
 * generation entirely, not just scanning. There is deliberately NO polyfill
 * and NO degraded fallback — faking this module's randomness or digest would
 * fake a security property. Callers surface the thrown descriptive error.
 */

/** Length of a generated persona/room token secret in bytes (§7.4: ≥ 32). */
export const TOKEN_SECRET_BYTES = 32;

/** Length of a one-time mutual code in bytes (ARCH §10.5: 16 B base64url). */
export const MUTUAL_CODE_BYTES = 16;

/**
 * Injectable randomness/digest source (ARCH §10.5). The default source is
 * WebCrypto; tests inject a fixed fake for determinism.
 */
export interface SecretSource {
  /** `length` cryptographically random bytes (default: crypto.getRandomValues). */
  randomBytes(length: number): Uint8Array;
  /** Lowercase-hex SHA-256 of the given bytes (default: crypto.subtle.digest). */
  digestHex(data: Uint8Array): Promise<string>;
}

/** RFC 4648 §5 alphabet (URL-safe: `-` and `_`, `+`/`/` excluded). */
const BASE64URL_ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

/**
 * Base64url-encode bytes per RFC 4648 §5 with padding stripped (§10.1:
 * "encoded base64url, padding stripped"). Self-contained bit math — no
 * `btoa` dependency, correct in every evergreen target and in Node.
 */
export function bytesToBase64Url(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i] ?? 0;
    const b1 = i + 1 < bytes.length ? bytes[i + 1] : undefined;
    const b2 = i + 2 < bytes.length ? bytes[i + 2] : undefined;
    out += BASE64URL_ALPHABET[b0 >> 2];
    out += BASE64URL_ALPHABET[((b0 & 0x03) << 4) | ((b1 ?? 0) >> 4)];
    if (b1 === undefined) break;
    out += BASE64URL_ALPHABET[((b1 & 0x0f) << 2) | ((b2 ?? 0) >> 6)];
    if (b2 === undefined) break;
    out += BASE64URL_ALPHABET[b2 & 0x3f];
  }
  return out;
}

function bytesToHex(bytes: Uint8Array): string {
  let out = '';
  for (const byte of bytes) {
    out += byte.toString(16).padStart(2, '0');
  }
  return out;
}

/**
 * The WebCrypto default source, resolved lazily at call time (the global
 * exists in every target browser and in Node ≥ 19; tests never rely on it —
 * they inject fixed fakes per ARCH §10.5's test strategy).
 */
const webCryptoSource: SecretSource = {
  randomBytes(length: number): Uint8Array {
    const c = globalThis.crypto;
    if (!c || typeof c.getRandomValues !== 'function') {
      throw new Error(
        'crypto.getRandomValues is unavailable — a secure context (HTTPS or localhost) is required for credential generation.'
      );
    }
    const bytes = new Uint8Array(length);
    c.getRandomValues(bytes);
    return bytes;
  },
  async digestHex(data: Uint8Array): Promise<string> {
    const c = globalThis.crypto;
    if (!c?.subtle) {
      throw new Error(
        'crypto.subtle is unavailable — a secure context (HTTPS or localhost) is required for hashing (no polyfill by design, ARCH §10.5).'
      );
    }
    const digest = await c.subtle.digest('SHA-256', data as BufferSource);
    return bytesToHex(new Uint8Array(digest));
  }
};

/**
 * Generate a persona/room token secret: 32 random bytes, base64url-encoded,
 * padding stripped → exactly 43 characters (§7.4: ≥ 32 random bytes,
 * base64url). Sent RAW only at creation/rotation; the server stores its
 * SHA-256 hash (§10.1).
 */
export function generateTokenSecret(source: SecretSource = webCryptoSource): string {
  return bytesToBase64Url(source.randomBytes(TOKEN_SECRET_BYTES));
}

/**
 * Generate a one-time mutual code for the live badge QR (§10.1): 16 random
 * bytes base64url (~22 chars, URL-safe — it becomes the `m` query parameter
 * of `{INVITE_URL_BASE}?u={userAddress}&m={mutualCode}`). The server only
 * ever sees its SHA-256 hash; the format is client-chosen.
 */
export function generateMutualCode(source: SecretSource = webCryptoSource): string {
  return bytesToBase64Url(source.randomBytes(MUTUAL_CODE_BYTES));
}

/**
 * SHA-256 of a UTF-8 string as lowercase hex (§10.5). Used ONLY to hash the
 * one-time mutual code for registration — the refresh body carries the
 * hash, never the raw code (§7.4).
 */
export async function sha256Hex(input: string, source: SecretSource = webCryptoSource): Promise<string> {
  return source.digestHex(new TextEncoder().encode(input));
}
