/**
 * Shared SVG-QR renderer (DESIGN rev. 4 §4.2 `InviteQr` row / §3.7.4; TZ13-01
 * extraction): the §3.6 `uqr` renderer lifted out of QrCodeBadge.svelte so
 * the persona badge AND the host tree's `InviteQr` share ONE renderer —
 * no helper PNG call anywhere on the host tree, the QR is computed
 * client-side with ZERO network requests. `uqr` (~3 kB, zero-dep, MIT,
 * synchronous) stays lazy/code-split as a shared chunk of the profile +
 * host routes (TZ §9.4.4 bundle-rule amendment — the only file in the app
 * allowed to import `uqr` statically is this module).
 *
 * Dark modules use the `--color-surface` token value on the light
 * `--color-qr-frame` backdrop — the one declared functional light exception
 * (§4.1); both colors are token references that resolve once the inline SVG
 * joins the DOM (no hardcoded hex, §2.4).
 */
import { renderSVG } from 'uqr';
// The {INVITE_URL_BASE} resolution is shared with the persona badge — ONE
// resolution order (bake → SPA origin → dev fallback), no duplicated env
// reading (§10.9).
import { inviteUrlBase } from '#lib/components/profile/qr';

/** uqr render options, pinned to the §3.6 badge contract by default. */
export interface SvgQrOptions {
  /** Quiet zone in modules (§3.6: 4). */
  border?: number;
  /** Error-correction level (§3.6: M for scannability on glossy badges). */
  ecc?: 'L' | 'M' | 'Q' | 'H';
  /** Module size in the SVG viewBox (the frame CSS scales to the caller's size). */
  pixelSize?: number;
}

/** Default options shared by the badge and the invite QR (§3.6 values). */
const DEFAULTS: Required<SvgQrOptions> = {
  border: 4,
  ecc: 'M',
  pixelSize: 8
};

/**
 * Render `payload` as an inline SVG string — token-colored dark-on-light,
 * quiet zone 4, ecc M. Synchronous, offline, no network access.
 */
export function svgQr(payload: string, options: SvgQrOptions = {}): string {
  return renderSVG(payload, {
    ...DEFAULTS,
    ...options,
    whiteColor: 'var(--color-qr-frame)',
    blackColor: 'var(--color-surface)'
  });
}

/**
 * `{base}/?code={code}` — the absolute invite deep link the host-tree QR
 * encodes (§3.7.4; the same payload the helper's `GET /h/rooms/{code}/qr`
 * PNG encodes — kept for external parity only, never called from the host
 * tree). `base` defaults to the shared `{INVITE_URL_BASE}` resolution
 * (bake → SPA origin → dev fallback, profile/qr.ts semantics).
 */
export function inviteQrPayload(code: string, base: string = inviteUrlBase()): string {
  return `${base.replace(/\/+$/, '')}/?code=${encodeURIComponent(code)}`;
}
