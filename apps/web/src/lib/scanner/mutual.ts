/**
 * Server-mediated mutual-handshake routine (DESIGN §3.8 context *b*, v2;
 * ARCHITECTURE §10.7; Concept §6.4) — replaces the v1 two-POST client
 * routine (`lib/scanner/mutualHandshake.ts`, deleted).
 *
 * A scanned persona QR (`?u={userAddress}&m={oneTimeCode}`) is confirmed
 * with a SINGLE `POST /api/handshake/mutual` call carrying the scanner's
 * own persona Bearer (auto-injected by the `api` context — the module stays
 * pure and receives the injected surface) plus the scanned `u` and `m`.
 * The backend creates both directed handshakes and BURNS the one-time code
 * (bleak-node §7.3) — even for already-mutual pairs, so there is
 * deliberately NO client already-mutual precheck: the endpoint is called
 * and success is success (no second chat is created server-side).
 *
 * A `?u=` deep link WITHOUT `m` degrades to the single-direction variant:
 * one idempotent `POST /api/handshake` (`from` = me, my Bearer).
 *
 * Retry semantics (bleak-node §7.3.4): a FAILED attempt (NetworkError,
 * 403, 410 …) never burns the one-time code — only successful server
 * verification does — so a NetworkError retry may safely re-send `u` + `m`.
 * A 410 means the code is dead: the state copy offers no Retry.
 *
 * The v2 UI still interprets handshake DIRECTION only — `Handshake.status`
 * is never read (DESIGN §6.1). Pure and unit-testable: the component only
 * renders the returned states.
 */
import type { Chat, CreateHandshakeRequest, User } from '@bleak/api-client';
import { ApiError, NetworkError } from '@bleak/api-client';
import { findChatWith } from '#lib/room/relationships';
import { apiErrorText } from '#lib/join';

/** The slice of the bleak-node surface the routine needs (injectable). */
export interface ScannerApi {
  /** `POST /api/handshake/mutual` (the scanner's Bearer is auto-injected). */
  createMutualHandshake(request: { user_address: string; mutual_code: string }): Promise<unknown>;
  /** Single-direction idempotent handshake (the `?u=`-without-`m` variant). */
  createHandshake(request: CreateHandshakeRequest): Promise<unknown>;
  /** Gated read (auto Bearer): resolve the created/existing chat. */
  listChatsOfUser(address: string): Promise<Chat[]>;
}

export interface PersonaEnv {
  /** My user address (the scanner's own persona). */
  myAddress: string;
  /** Current room member list as passed by the hosting page. */
  memberList: readonly User[];
  /**
   * The one-time mutual code parsed from the scanned/deep-linked `m`
   * parameter. `null` selects the single-direction variant.
   */
  mutualCode: string | null;
  api: ScannerApi;
}

/**
 * §3.8 prechecks (client-side UX only, no request):
 * 1. own QR (`u === myAddress`) → info state, no request;
 * 2. foreign persona (not in the member list) → error state, no request;
 * 3. known persona → the confirm card (regardless of any existing
 *    handshake/chat — there is NO already-mutual precheck; the code burns
 *    server-side even for existing pairs).
 *
 * Membership note: an EMPTY member list means membership is unknown (the
 * `/` deep-link path fetches members once and may fail) — the check is
 * skipped rather than rejecting every scan.
 */
export function classifyPersonaScan(
  userAddress: string,
  env: PersonaEnv
): { kind: 'own' | 'foreign' | 'confirm' } {
  if (userAddress === env.myAddress) return { kind: 'own' };
  const known =
    env.memberList.length === 0 ||
    env.memberList.some((member) => member.address === userAddress && !member.deleted_at);
  if (!known) return { kind: 'foreign' };
  return { kind: 'confirm' };
}

/**
 * State-machine results rendered by the scanner's result panel (§3.8
 * states summary). The processing spinner during the call is component
 * state, not a routine outcome.
 */
export type ScanOutcome =
  | { kind: 'own' }
  | { kind: 'foreign' }
  | { kind: 'confirm' }
  /** Mutual success — the chat address (or null = the /chats fallback). */
  | { kind: 'success'; chatAddress: string | null }
  /** Single-direction success (the pair is pending; no chat yet). */
  | { kind: 'sent' }
  /** 410 — the one-time code is dead: no Retry, only scan-again. */
  | { kind: 'error-stale' }
  /** 403 — the income>outcome rule; the code was NOT consumed. */
  | { kind: 'error-income'; message: string | null }
  /** 401 — the §2.8 global gate (the gate already queued the redirect). */
  | { kind: 'error-auth' }
  /** NetworkError — retry re-sends `u` + `m` safely. */
  | { kind: 'error-network' }
  /** Other ApiError (incl. 404 unknown user) — server text + retry. */
  | { kind: 'error-api'; message: string };

/** The newest chat whose participants include me and the user (or null). */
export async function resolveChatAddress(
  userAddress: string,
  env: PersonaEnv
): Promise<string | null> {
  const chats = await env.api.listChatsOfUser(env.myAddress);
  const chat: Chat | null = findChatWith(chats, env.myAddress, userAddress);
  return chat ? chat.address : null;
}

/**
 * §3.8 steps 3–5, v2: the confirm CTA fires ONE
 * `POST /api/handshake/mutual` with the scanned `u` + `m`; on success the
 * chat is located from a refreshed gated `listChatsOfUser` (a refresh
 * failure after a successful call is eventual consistency, not a failure →
 * success with the `/chats` fallback — never a dead link).
 */
export async function sendMutualHandshake(
  userAddress: string,
  env: PersonaEnv
): Promise<ScanOutcome> {
  try {
    await env.api.createMutualHandshake({
      user_address: userAddress,
      mutual_code: env.mutualCode ?? ''
    });
  } catch (err) {
    return mutualFailureOf(err);
  }
  const chatAddress = await resolveChatAddress(userAddress, env).catch(() => null);
  return { kind: 'success', chatAddress };
}

/**
 * The `?u=`-without-`m` variant (§3.8 step 3, single-direction): the
 * standard confirm card → one idempotent `POST /api/handshake`
 * (`from` = me, my Bearer). When a chat with the counterpart already
 * exists, the success state links to it; otherwise the plain "sent" state
 * (the agents are not talking yet — no fake success).
 */
export async function sendSingleDirectionHandshake(
  userAddress: string,
  env: PersonaEnv
): Promise<ScanOutcome> {
  try {
    await env.api.createHandshake({
      from_address: env.myAddress,
      to_address: userAddress,
      status: 1
    });
  } catch (err) {
    return mutualFailureOf(err);
  }
  const chatAddress = await resolveChatAddress(userAddress, env).catch(() => null);
  if (chatAddress !== null) return { kind: 'success', chatAddress };
  return { kind: 'sent' };
}

/** Map one failed handshake call to the §2.9/§3.8 result states. */
function mutualFailureOf(err: unknown): ScanOutcome {
  if (err instanceof ApiError) {
    if (err.status === 410) return { kind: 'error-stale' };
    if (err.status === 403) return { kind: 'error-income', message: apiErrorText(err) };
    if (err.status === 401) return { kind: 'error-auth' }; // §2.8 gate already fired
    return { kind: 'error-api', message: apiErrorText(err) };
  }
  if (err instanceof NetworkError) return { kind: 'error-network' };
  return {
    kind: 'error-api',
    message: err instanceof Error ? err.message : String(err)
  };
}
