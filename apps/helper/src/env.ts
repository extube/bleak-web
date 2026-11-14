/** Process environment for the helper service, with dev defaults. */

export interface HelperEnv {
  port: number;
  /** Host token: only holders may create rooms (POST /rooms). */
  hostToken: string;
  /** bleak-node REST base, e.g. http://localhost:8080 (bleak-node is read/write only via its own API). */
  bleakNodeUrl: string;
  /** SQLite file for the code -> room-address mapping (never bleak-node's DB). */
  dbPath: string;
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
    hostToken: envOr('HELPER_HOST_TOKEN', 'dev-host-token-change-me'),
    bleakNodeUrl: envOr('BLEAK_NODE_URL', 'http://localhost:8080').replace(/\/+$/, ''),
    dbPath: envOr('HELPER_DB_PATH', 'data/helper.db'),
    inviteUrlBase: envOr('INVITE_URL_BASE', 'http://localhost:5173/')
  };
}

/** Invite URL for a code, e.g. http://localhost:5173/?code=123456 */
export function inviteUrlFor(env: HelperEnv, code: string): string {
  const separator = env.inviteUrlBase.includes('?') ? '&' : '?';
  return `${env.inviteUrlBase}${separator}code=${encodeURIComponent(code)}`;
}
