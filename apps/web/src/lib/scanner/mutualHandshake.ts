/**
 * The ruling-3 mutual-handshake routine (DESIGN §3.8 "Processing — context
 * (b)", Concept §1c ruling 3): scanning a persona QR sends BOTH handshake
 * calls (A→B, then B→A — the second creates the chat) from the client.
 * Pure and unit-testable: the component only renders the returned states.
 *
 * The v1 UI interprets handshake DIRECTION only — `Handshake.status` is
 * never read (DESIGN §6.1). Idempotency (existing directed pair → 200) makes
 * every retry safe; 200 and 201 are both success (§3.2 criterion 7).
 */
import type { Chat, CreateHandshakeRequest, User } from '@bleak/api-client';
import { ApiError, NetworkError } from '@bleak/api-client';
import { findChatWith } from '#lib/room/relationships';

/** The slice of the bleak-node client the routine needs (injectable). */
export interface ScannerApi {
  createHandshake(input: CreateHandshakeRequest): Promise<unknown>;
  listChatsOfUser(address: string): Promise<Chat[]>;
}

export interface PersonaEnv {
  /** My user address (the scanner's own persona). */
  myAddress: string;
  /** Current room member list as passed by the hosting page. */
  memberList: readonly User[];
  /** User addresses I already have a chat with (TZ-02 relationships). */
  existingChatCounterparts: ReadonlySet<string>;
  api: ScannerApi;
}

/**
 * State-machine results rendered by the scanner's result panel:
 * own-QR info / foreign-persona error / confirm card / success (chat
 * address or the /chats fallback) / retry errors. The processing spinner
 * during the two POSTs is component state (trading flag), not a routine
 * outcome.
 */
export type ScanOutcome =
  | { kind: 'own' }
  | { kind: 'foreign' }
  | { kind: 'confirm' }
  | { kind: 'success'; chatAddress: string | null }
  | { kind: 'error-network' }
  | { kind: 'error-api'; message: string };

/** What classifyPersonaScan can return (pre-confirm states + skipped-to success). */
export type ScanPrecheck = Extract<
  ScanOutcome,
  { kind: 'own' } | { kind: 'foreign' } | { kind: 'confirm' } | { kind: 'success' }
>;

/**
 * §3.8 steps 1–3 + 6: own QR → info (no request); foreign persona (not in
 * the member list) → error (no request); already mutual → skip the POSTs
 * entirely and resolve the chat from a refreshed chat list; else → confirm.
 *
 * Membership note (the `/` deep-link path fetches members once and may fail
 * → an EMPTY list means membership is unknown, not foreign — the check is
 * skipped rather than rejecting every scan).
 */
export async function classifyPersonaScan(
  userAddress: string,
  env: PersonaEnv
): Promise<ScanPrecheck> {
  // Step 1 — own QR: info state, no request.
  if (userAddress === env.myAddress) return { kind: 'own' };

  // Step 2 — foreign persona: not in the current room's member list.
  const known =
    env.memberList.length === 0 ||
    env.memberList.some((member) => member.address === userAddress && !member.deleted_at);
  if (!known) return { kind: 'foreign' };

  // Step 6 — already mutual: skip the POSTs, jump straight to success.
  if (env.existingChatCounterparts.has(userAddress)) {
    // Refresh failure is eventual consistency here (no mutation pending) —
    // the CTA falls back to /chats; never surface a fake error.
    const chatAddress = await resolveChatAddress(userAddress, env).catch(() => null);
    return { kind: 'success', chatAddress };
  }

  // Step 3 — known persona: show the confirm card.
  return { kind: 'confirm' };
}

/**
 * §3.8 steps 3–5: send BOTH handshakes in order (A→B, then B→A — the second
 * call creates the chat), then locate the created chat from a refreshed
 * `listChatsOfUser`. NetworkError/ApiError → retry states (idempotent retry
 * re-sends the pair safely). A chat-refresh failure after successful POSTs
 * is eventual consistency, not a failure → success with the `/chats`
 * fallback (never a dead link).
 */
export async function sendMutualHandshakes(
  userAddress: string,
  env: PersonaEnv
): Promise<ScanOutcome> {
  try {
    await env.api.createHandshake({
      from_address: env.myAddress,
      to_address: userAddress,
      status: 1
    });
    await env.api.createHandshake({
      from_address: userAddress,
      to_address: env.myAddress,
      status: 1
    });
  } catch (err) {
    if (err instanceof NetworkError) return { kind: 'error-network' };
    if (err instanceof ApiError) return { kind: 'error-api', message: err.message };
    return { kind: 'error-api', message: err instanceof Error ? err.message : String(err) };
  }

  const chatAddress = await resolveChatAddress(userAddress, env).catch(() => null);
  return { kind: 'success', chatAddress };
}

/** The newest chat whose participants include me and the user (or null). */
export async function resolveChatAddress(
  userAddress: string,
  env: PersonaEnv
): Promise<string | null> {
  const chats = await env.api.listChatsOfUser(env.myAddress);
  const chat: Chat | null = findChatWith(chats, env.myAddress, userAddress);
  return chat ? chat.address : null;
}
