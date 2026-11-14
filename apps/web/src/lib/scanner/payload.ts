/**
 * QR payload parsing (DESIGN §3.8): the binding QR formats are
 *   invite QR  — `{INVITE_URL_BASE}?code=NNNNNN` (host share kit)
 *   persona QR — `{INVITE_URL_BASE}?u={userAddress}` (profile badge)
 * The scanner accepts any path prefix but requires the `code` or `u` query
 * parameter. INVITE_URL_BASE is helper-side runtime config (not baked into
 * the SPA build), so the origin itself is not asserted here — the query
 * parameters are the gate; a foreign QR without them is invalid content and
 * renders the `scan.invalid_qr` error state (never a silent close).
 */
import { isValidInviteCode } from '#lib/join';

export type QrPayload =
  | { kind: 'invite'; code: string }
  | { kind: 'persona'; userAddress: string };

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
    return { kind: 'persona', userAddress: user.trim() };
  }

  return null;
}
