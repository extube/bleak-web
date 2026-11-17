/** mutual.ts module tests (TZ2-06 Part A, DESIGN §3.8 v2 + §2.9): own QR,
 * foreign persona, NO already-mutual precheck (the endpoint is always
 * called), the SINGLE server-mediated mutual POST, the 410 stale-code /
 * 403 income-rule / 404 / network / api / auth branches, the
 * single-direction variant, and chat resolution from the refreshed gated
 * read. All with a mocked api. */
import { describe, expect, it, vi } from 'vitest';
import { ApiError, NetworkError, type Chat, type User } from '@bleak/api-client';
import {
  classifyPersonaScan,
  resolveChatAddress,
  sendMutualHandshake,
  sendSingleDirectionHandshake,
  type PersonaEnv
} from '../src/lib/scanner/mutual';

function user(address: string, name = address): User {
  return {
    address,
    room: '0xroom',
    name,
    greeting: '',
    public_bio: '',
    private_bio: '',
    language: 'ru',
    created_at: '2026-11-14T10:00:00Z',
    updated_at: '2026-11-14T10:00:00Z',
    deleted_at: null
  };
}

function chat(address: string, participants: [string, string]): Chat {
  return {
    address,
    room: '0xroom',
    phase: 'networking',
    phase_started_at: '',
    scenario: 'ai-future',
    language: 'ru',
    created_at: '2026-11-14T10:00:00Z',
    participants: participants.map((member) => ({ chat: address, user: member }))
  };
}

function env(
  overrides: Partial<PersonaEnv> & {
    chats?: Chat[];
    mutualError?: unknown;
    singleError?: unknown;
  } = {}
): PersonaEnv {
  const { chats = [], mutualError, singleError, ...rest } = overrides;
  return {
    myAddress: '0xme',
    memberList: [user('0xme', 'Я'), user('0xbob', 'Боб')],
    mutualCode: 'one-time-code',
    api: {
      createMutualHandshake: vi.fn(async () => {
        if (mutualError !== undefined) throw mutualError;
        return {};
      }),
      createHandshake: vi.fn(async () => {
        if (singleError !== undefined) throw singleError;
        return {};
      }),
      listChatsOfUser: vi.fn(async () => chats)
    },
    ...rest
  };
}

describe('classifyPersonaScan (§3.8 steps 1–3, client-side UX only)', () => {
  it('own QR → info state, no request', () => {
    const e = env();
    expect(classifyPersonaScan('0xme', e)).toEqual({ kind: 'own' });
    expect(e.api.createMutualHandshake).not.toHaveBeenCalled();
    expect(e.api.listChatsOfUser).not.toHaveBeenCalled();
  });

  it('foreign persona (not in the member list) → error state, no request', () => {
    const e = env();
    expect(classifyPersonaScan('0xstranger', e)).toEqual({ kind: 'foreign' });
    expect(e.api.createMutualHandshake).not.toHaveBeenCalled();
  });

  it('a soft-deleted member is foreign', () => {
    const gone = { ...user('0xghost'), deleted_at: '2026-11-14T11:00:00Z' };
    const e = env({ memberList: [user('0xme'), gone] });
    expect(classifyPersonaScan('0xghost', e)).toEqual({ kind: 'foreign' });
  });

  it('an EMPTY member list means membership is unknown → confirm (not foreign)', () => {
    const e = env({ memberList: [] });
    expect(classifyPersonaScan('0xstranger', e)).toEqual({ kind: 'confirm' });
  });

  it('known persona → confirm card — even when a chat already exists (NO already-mutual precheck)', () => {
    const e = env({ chats: [chat('0xchat9', ['0xme', '0xbob'])] });
    expect(classifyPersonaScan('0xbob', e)).toEqual({ kind: 'confirm' });
    // The v1 skip-the-POSTs behavior is deleted: only the confirm state is
    // derived client-side; the call happens on user confirmation.
    expect(e.api.createMutualHandshake).not.toHaveBeenCalled();
    expect(e.api.listChatsOfUser).not.toHaveBeenCalled();
  });
});

describe('sendMutualHandshake (§3.8 steps 3–5, v2 server-mediated)', () => {
  it('sends ONE createMutualHandshake call with the scanned u + m (not two POSTs)', async () => {
    const e = env({ chats: [chat('0xchat1', ['0xme', '0xbob'])] });
    expect(await sendMutualHandshake('0xbob', e)).toEqual({
      kind: 'success',
      chatAddress: '0xchat1'
    });
    expect(e.api.createMutualHandshake).toHaveBeenCalledTimes(1);
    expect(e.api.createMutualHandshake).toHaveBeenCalledWith({
      user_address: '0xbob',
      mutual_code: 'one-time-code'
    });
    // The v1 two-POST routine is gone — no plain handshake call at all.
    expect(e.api.createHandshake).not.toHaveBeenCalled();
    // Success resolves the chat from a refreshed gated listChatsOfUser.
    expect(e.api.listChatsOfUser).toHaveBeenCalledWith('0xme');
  });

  it('already-mutual pair: the call still happens (the code burns server-side) and success resolves the existing chat', async () => {
    const e = env({ chats: [chat('0xchat9', ['0xme', '0xbob'])] });
    expect(await sendMutualHandshake('0xbob', e)).toEqual({
      kind: 'success',
      chatAddress: '0xchat9'
    });
    expect(e.api.createMutualHandshake).toHaveBeenCalledTimes(1);
  });

  it.each([
    {
      status: 410,
      body: 'mutual code already used',
      expected: { kind: 'error-stale' },
      what: 'the stale-code state (no retry is offered for the dead code)'
    },
    {
      status: 403,
      body: 'income must exceed outcome',
      expected: { kind: 'error-income', message: 'income must exceed outcome' },
      what: 'the §2.9 income-rule state with the server text (the code was NOT consumed)'
    },
    {
      status: 401,
      body: 'no token',
      expected: { kind: 'error-auth' },
      what: 'the auth state (the §2.8 global gate owns the redirect)'
    },
    {
      status: 404,
      body: 'user not found',
      expected: { kind: 'error-api', message: 'user not found' },
      what: 'the api state with the server text (unknown user)'
    }
  ])('a $status on the mutual call → $what', async ({ status, body, expected }) => {
    const e = env({ mutualError: new ApiError(status, '/api/handshake/mutual', body) });
    expect(await sendMutualHandshake('0xbob', e)).toEqual(expected);
  });

  it('a NetworkError → retry state; retry re-sends u + m safely (a failed attempt never burns the code)', async () => {
    const e = env();
    vi.mocked(e.api.createMutualHandshake).mockRejectedValueOnce(
      new NetworkError('/api/handshake/mutual', new Error('offline'))
    );
    expect(await sendMutualHandshake('0xbob', e)).toEqual({ kind: 'error-network' });
    expect(e.api.listChatsOfUser).not.toHaveBeenCalled();
    // Retry on recovery re-sends the same u + m and reaches success.
    expect(await sendMutualHandshake('0xbob', e)).toEqual({
      kind: 'success',
      chatAddress: null
    });
    expect(vi.mocked(e.api.createMutualHandshake).mock.calls.length).toBe(2);
    expect(vi.mocked(e.api.createMutualHandshake).mock.calls[1]?.[0]).toEqual({
      user_address: '0xbob',
      mutual_code: 'one-time-code'
    });
  });

  it('an unexpected error maps to the api-retry state', async () => {
    const e = env({ mutualError: new TypeError('bad state') });
    expect(await sendMutualHandshake('0xbob', e)).toEqual({
      kind: 'error-api',
      message: 'bad state'
    });
  });

  it('a chat-refresh failure after a successful call → success (eventual consistency, /chats fallback)', async () => {
    const e = env();
    vi.mocked(e.api.listChatsOfUser).mockRejectedValue(new NetworkError('/api', new Error('x')));
    expect(await sendMutualHandshake('0xbob', e)).toEqual({
      kind: 'success',
      chatAddress: null
    });
    expect(vi.mocked(e.api.createMutualHandshake).mock.calls.length).toBe(1);
  });
});

describe('sendSingleDirectionHandshake (§3.8: `?u=` without `m`)', () => {
  it('sends ONE idempotent POST /api/handshake (from = me, status 1) — no mutual code involved', async () => {
    const e = env({ mutualCode: null });
    expect(await sendSingleDirectionHandshake('0xbob', e)).toEqual({ kind: 'sent' });
    expect(e.api.createHandshake).toHaveBeenCalledTimes(1);
    expect(e.api.createHandshake).toHaveBeenCalledWith({
      from_address: '0xme',
      to_address: '0xbob',
      status: 1
    });
    expect(e.api.createMutualHandshake).not.toHaveBeenCalled();
  });

  it('an existing chat resolves to the mutual success state (the pair is already talking)', async () => {
    const e = env({ mutualCode: null, chats: [chat('0xchat2', ['0xme', '0xbob'])] });
    expect(await sendSingleDirectionHandshake('0xbob', e)).toEqual({
      kind: 'success',
      chatAddress: '0xchat2'
    });
  });

  it('a 403 → the §2.9 income-rule state', async () => {
    const e = env({
      mutualCode: null,
      singleError: new ApiError(403, '/api/handshake', 'income must exceed outcome')
    });
    expect(await sendSingleDirectionHandshake('0xbob', e)).toEqual({
      kind: 'error-income',
      message: 'income must exceed outcome'
    });
  });

  it('a NetworkError → retry state (idempotent per pair)', async () => {
    const e = env({ mutualCode: null });
    vi.mocked(e.api.createHandshake).mockRejectedValueOnce(
      new NetworkError('/api/handshake', new Error('offline'))
    );
    expect(await sendSingleDirectionHandshake('0xbob', e)).toEqual({ kind: 'error-network' });
    expect(await sendSingleDirectionHandshake('0xbob', e)).toEqual({ kind: 'sent' });
  });
});

describe('resolveChatAddress', () => {
  it('locates the newest chat with the counterpart', async () => {
    const e = env({
      chats: [
        chat('0xchat1', ['0xme', '0xbob']),
        chat('0xchat0', ['0xme', '0xother'])
      ]
    });
    expect(await resolveChatAddress('0xbob', e)).toBe('0xchat1');
  });
});
