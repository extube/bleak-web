/**
 * Pure helpers for the /host console (TZ-09). Unit-tested in
 * tests/host-console.test.ts.
 *
 * Handshake counts (TZ flag §7.6 contract): `listHandshakesOfUser` returns
 * every handshake touching a member; the sent/received split is by
 * `from_address` direction only — `Handshake.status` is never interpreted
 * (DESIGN §6.1).
 */
import type { Handshake } from '@bleak/api-client';

export interface HandshakeCounts {
  sent: number;
  received: number;
}

export function handshakeCounts(
  handshakes: readonly Handshake[],
  memberAddress: string
): HandshakeCounts {
  let sent = 0;
  let received = 0;
  for (const handshake of handshakes) {
    if (handshake.from_address === memberAddress) sent += 1;
    if (handshake.to_address === memberAddress) received += 1;
  }
  return { sent, received };
}

/**
 * The helper answers errors as JSON (`{"error":"…"}`) but HelperError carries
 * the raw body text. Extract the human message; plain-text bodies pass
 * through untouched.
 */
export function parseHelperErrorText(raw: string): string {
  try {
    const parsed = JSON.parse(raw) as { error?: unknown };
    if (parsed && typeof parsed.error === 'string' && parsed.error.trim() !== '') {
      return parsed.error;
    }
  } catch {
    /* not JSON — plain text body */
  }
  return raw;
}

/** Screen-reader spelling of the 6-digit code («Код: 1 2 3 4 5 6», §3.7). */
export function spelledDigits(code: string): string {
  return code.split('').join(' ');
}
