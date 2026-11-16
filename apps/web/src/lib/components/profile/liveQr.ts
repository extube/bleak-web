/**
 * Live badge-QR logic (DESIGN rev. 3 §3.6 live rotation; ARCHITECTURE §10.8):
 * pure decision + injectable registration for the one-time mutual code.
 *
 * Decision table (§3.6):
 * - no code yet (first load / stale store)  → register a fresh one;
 * - a code exists but `mutual_code_live` is false (a scan burned it)
 *                                            → rotate (register a fresh one);
 * - otherwise (code live or flag unknown)    → keep the current QR.
 *
 * A registration FAILURE keeps the last QR — the caller retries on the next
 * poll tick (the flag still reads false). The registration body carries the
 * SHA-256 HASH of the new code, never the raw code (CONCEPT §7.4).
 */
import type { CredentialOptions } from '@bleak/api-client';
import { generateMutualCode, sha256Hex } from '#lib/crypto/secrets';

export type BadgeAction = 'register' | 'rotate' | 'keep';

/** `live` is the derived `mutual_code_live` flag of the token-gated read. */
export function decideBadgeAction(
  storedCode: string | null,
  live: boolean | undefined
): BadgeAction {
  if (storedCode === null || storedCode === '') return 'register';
  if (live === false) return 'rotate';
  return 'keep';
}

/** Injectable API surface (tests stub these; production wires the web `api`). */
export interface BadgeRegistrationDeps {
  register: (room: string, address: string, mutualCodeHash: string) => Promise<void>;
  /** 16-byte one-time code generator (default: the secrets module). */
  generate?: () => string;
  /** Lowercase-hex SHA-256 (default: the secrets module). */
  hash?: (input: string) => Promise<string>;
}

/**
 * Generate a fresh one-time code, register ONLY its hash, and return the raw
 * code for the badge payload + the `mutualCode` store. The raw code never
 * reaches a request body — `register` receives the hash only (§7.4).
 */
export async function registerFreshMutualCode(
  room: string,
  address: string,
  options: CredentialOptions,
  deps: BadgeRegistrationDeps
): Promise<string> {
  const code = (deps.generate ?? generateMutualCode)();
  const digest = await (deps.hash ?? sha256Hex)(code);
  await deps.register(room, address, digest);
  return code;
}
