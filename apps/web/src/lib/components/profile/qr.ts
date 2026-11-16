/**
 * Persona-QR payload (DESIGN rev. 3 §3.6 / §3.8 binding format): the badge
 * encodes the v2 binding payload (bleak-node §7.3.5)
 * `{INVITE_URL_BASE}?u={userAddress}&m={mutualCode}` — the user address plus
 * the ONE-TIME mutual code from the `mutualCode` store (ARCHITECTURE §10.8).
 * The raw code is visible only inside this QR image — never as copyable
 * text (§10.11).
 *
 * INVITE_URL_BASE is helper-side runtime env (apps/helper/src/env.ts) and is
 * NOT baked into the SPA build — the web app has no runtime source for it.
 * Resolution order:
 *   1. build-time `VITE_INVITE_URL_BASE` (optional bake for split
 *      deployments, mirroring VITE_BLEAK_NODE_URL in lib/config.ts);
 *   2. the SPA's own origin (`window.location.origin`) — in dev this is
 *      `http://localhost:5173/`, exactly the helper's INVITE_URL_BASE
 *      default and the target the dev proxy serves, so the payload points
 *      at the join page like the helper-generated links;
 *   3. non-browser fallback (tests/SSR): the same dev default.
 */
export function inviteUrlBase(): string {
  const baked = import.meta.env.VITE_INVITE_URL_BASE;
  if (typeof baked === 'string' && baked.trim() !== '') {
    return baked.trim().replace(/\/+$/, '');
  }
  if (typeof window !== 'undefined' && typeof window.location?.origin === 'string') {
    return window.location.origin;
  }
  return 'http://localhost:5173';
}

/**
 * `{base}/?u={address}&m={mutualCode}` — base without trailing slashes +
 * single path root; both params escaped. The mutual code is REQUIRED: the
 * badge is the one-time handshake capability, so a payload without `m` must
 * never be rendered (the page shows the badge skeleton until a code exists).
 */
export function personaQrPayload(
  userAddress: string,
  mutualCode: string,
  base: string = inviteUrlBase()
): string {
  return `${base.replace(/\/+$/, '')}/?u=${encodeURIComponent(userAddress)}&m=${encodeURIComponent(mutualCode)}`;
}
