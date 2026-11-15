/**
 * Invite-code resolution seam (ARCHITECTURE §10.6, Concept §6.9b).
 *
 * The helper's code→room-address mapping was retired in v2 (§10.10); the
 * join flow resolves the 6-digit code through THIS single function. Its
 * implementation adapts to whatever bleak-node ships (§6.9b candidates: a
 * small public resolve endpoint, or globally-unique codes resolved another
 * way) — no page rewrite needed when the backend shape lands: this one
 * function changes.
 *
 * Errors map to the join flow's §3.1 kinds: `malformed` (400 / non-6-digit
 * input) and `not_found` (404 / unknown code). Network failures surface as
 * the api-client `NetworkError` (banner state); other server errors as
 * `ApiError`.
 */
import { ApiError, NetworkError } from '@bleak/api-client';
import { API_BASE } from '#lib/config';

export interface InviteResolution {
  roomAddress: string;
}

export type InviteResolveKind = 'malformed' | 'not_found';

export class InviteResolveError extends Error {
  readonly kind: InviteResolveKind;
  constructor(kind: InviteResolveKind, message?: string) {
    super(message ?? (kind === 'malformed' ? 'invite code must be 6 digits' : 'unknown invite code'));
    this.name = 'InviteResolveError';
    this.kind = kind;
  }
}

const CODE_PATTERN = /^\d{6}$/;

// TBD(WP-6)/flag 6.9b: bleak-node's public code→room resolution is pending
// (swagger is still v0.1.0). The adapter targets the proposed public resolve
// route; when the real shape lands, THIS is the one function that changes.
const RESOLVE_PATH = '/api/invite';

/** Resolve a 6-digit invite code to its room address (§10.6). */
export async function resolveInviteCode(code: string): Promise<InviteResolution> {
  if (!CODE_PATTERN.test(code)) {
    // Client-side strictness: malformed input never issues a request.
    throw new InviteResolveError('malformed');
  }
  const path = `${RESOLVE_PATH}/${encodeURIComponent(code)}`;
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`);
  } catch (cause) {
    throw new NetworkError(path, cause);
  }
  if (response.status === 400) throw new InviteResolveError('malformed');
  if (response.status === 404) throw new InviteResolveError('not_found');
  if (response.status < 200 || response.status >= 300) {
    const body = await response.text().catch(() => '');
    throw new ApiError(response.status, path, body.length > 0 ? body : response.statusText);
  }
  const raw = await response.text().catch(() => '');
  if (raw.length === 0) throw new InviteResolveError('not_found');
  let parsed: { room_address?: unknown };
  try {
    parsed = JSON.parse(raw) as { room_address?: unknown };
  } catch {
    throw new InviteResolveError('not_found');
  }
  if (typeof parsed.room_address !== 'string' || parsed.room_address === '') {
    throw new InviteResolveError('not_found');
  }
  return { roomAddress: parsed.room_address };
}
