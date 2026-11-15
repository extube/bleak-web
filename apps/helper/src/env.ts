/** Process environment for the helper service (v2, ARCHITECTURE §10.10).
 *
 * The helper is stateless: no host token, no bleak-node URL, no database —
 * room creation lives in the host console against bleak-node directly and
 * invite codes are resolved natively by the backend (CONCEPT §7.2).
 */

export interface HelperEnv {
  port: number;
  /** Base of the join page used in invite links and QR payloads. */
  inviteUrlBase: string;
}

function envOr(name: string, fallback: string): string {
  const value = process.env[name];
  return value !== undefined && value.length > 0 ? value : fallback;
}

export function loadEnv(): HelperEnv {
  return {
    port: Number(envOr('HELPER_PORT', '8787')),
    inviteUrlBase: envOr('INVITE_URL_BASE', 'http://localhost:5173/')
  };
}

/** Invite URL for a code, e.g. http://localhost:5173/?code=123456 */
export function inviteUrlFor(env: HelperEnv, code: string): string {
  const separator = env.inviteUrlBase.includes('?') ? '&' : '?';
  return `${env.inviteUrlBase}${separator}code=${encodeURIComponent(code)}`;
}
