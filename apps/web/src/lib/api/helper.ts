import { HELPER_BASE } from '#lib/config';

/**
 * Thin client for the helper service (v2 — ARCHITECTURE §10.10): the helper
 * is now stateless; its ONLY remaining endpoint used by the SPA is the
 * invite-QR PNG. The v1 mapping endpoints (`GET /rooms/:code`) and
 * host-token room creation (`POST /rooms`) are retired — code resolution
 * moved to the `#lib/api/invite-resolve` seam and room creation to the host
 * console against bleak-node directly (`#lib/api/client` `hostApi`).
 */

/** Host: QR PNG encoding the invite URL for a code (stateless — any
 * well-formed 6-digit code is renderable). */
export function inviteQrUrl(code: string): string {
  return `${HELPER_BASE}/rooms/${encodeURIComponent(code)}/qr`;
}
