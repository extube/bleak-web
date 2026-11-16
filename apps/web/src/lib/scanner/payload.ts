/**
 * QR payload parsing (DESIGN §3.8, v2 binding payload of bleak-node
 * §7.3.5): the QR formats are
 *   invite QR  — `{INVITE_URL_BASE}?code=NNNNNN` (host share kit)
 *   persona QR — `{INVITE_URL_BASE}?u={userAddress}&m={mutualCode}`
 *                (profile badge; the one-time mutual code `m` is the
 *                single-use handshake capability)
 * The scanner accepts any path prefix but requires the `code` or `u` query
 * parameter. INVITE_URL_BASE is helper-side runtime config (not baked into
 * the SPA build), so the origin itself is not asserted here — the query
 * parameters are the gate; a foreign QR without them is invalid content and
 * renders the `scan.invalid_qr` error state (never a silent close).
 * `m` is optional on a persona payload: its absence selects the
 * single-direction handshake variant (§3.8).
 */
import { isValidInviteCode } from '#lib/join';

export type QrPayload =
  | { kind: 'invite'; code: string }
  | { kind: 'persona'; userAddress: string; mutualCode: string | null };

/** Parse scanned text; null = not a bleak-web QR (invalid state). */
export function parseQrPayload(text: string): QrPayload | null {
  const raw = text.trim();
  if (raw === '') return null;

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    // Not an absolute URL — allow app-relative text resolved against the
    // current origin (deep links shared without a scheme).
    try {
      url = new URL(raw, window.location.origin);
    } catch {
      return null;
    }
  }

  const code = url.searchParams.get('code');
  if (code !== null && isValidInviteCode(code.trim())) {
    return { kind: 'invite', code: code.trim() };
  }

  const user = url.searchParams.get('u');
  if (user !== null && user.trim() !== '') {
    const mutual = url.searchParams.get('m');
    return {
      kind: 'persona',
      userAddress: user.trim(),
      mutualCode: mutual !== null && mutual.trim() !== '' ? mutual.trim() : null
    };
  }

  return null;
}
