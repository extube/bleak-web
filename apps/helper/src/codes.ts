/**
 * 6-digit invite codes (v2): the format validator only. Minting moved to
 * bleak-node (CONCEPT §7.2 — the host console mints/revokes codes through
 * the room-token API), and the helper-side mapping store was retired
 * (ARCHITECTURE §10.10); the helper keeps the strict format check to
 * validate QR-route input.
 */

export const CODE_PATTERN = /^\d{6}$/;

export function isValidCode(code: string): boolean {
  return CODE_PATTERN.test(code);
}
