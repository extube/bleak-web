/** mutualHandshake module tests (TZ-04, DESIGN §3.8 steps 1–6): own QR,
 * foreign persona, already-mutual skip, double-POST order + idempotent 200
 * handling, network/api retry states. All with a mocked api. */
import { describe, expect, it, vi } from 'vitest';
import { ApiError, NetworkError, type Chat, type User } from '@bleak/api-client';
import {
  classifyPersonaScan,
  sendMutualHandshakes,
  type PersonaEnv
} from '../src/lib/scanner/mutualHandshake';

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
  overrides: Partial<PersonaEnv> & { chats?: Chat[]; postError?: unknown } = {}
): PersonaEnv {
  const { chats = [], postError, ...rest } = overrides;
  return {
    myAddress: '0xme',
    memberList: [user('0xme', 'Я'), user('0xbob', 'Боб')],
    existingChatCounterparts: new Set<string>(),
    api: {
      createHandshake: vi.fn(async () => {
        if (postError !== undefined) throw postError;
        return {};
      }),
      listChatsOfUser: vi.fn(async () => chats)
    },
    ...rest
  };
}

describe('classifyPersonaScan (§3.8 steps 1–3 + 6)', () => {
  it('own QR → info state, no request', async () => {
    const e = env();
    expect(await classifyPersonaScan('0xme', e)).toEqual({ kind: 'own' });
    expect(e.api.createHandshake).not.toHaveBeenCalled();
    expect(e.api.listChatsOfUser).not.toHaveBeenCalled();
  });

  it('foreign persona (not in the member list) → error state, no request', async () => {
    const e = env();
    expect(await classifyPersonaScan('0xstranger', e)).toEqual({ kind: 'foreign' });
    expect(e.api.createHandshake).not.toHaveBeenCalled();
    expect(e.api.listChatsOfUser).not.toHaveBeenCalled();
  });

  it('a soft-deleted member is foreign', async () => {
    const gone = { ...user('0xghost'), deleted_at: '2026-11-14T11:00:00Z' };
    const e = env({ memberList: [user('0xme'), gone] });
    expect(await classifyPersonaScan('0xghost', e)).toEqual({ kind: 'foreign' });
  });

  it('an EMPTY member list means membership is unknown → confirm (not foreign)', async () => {
    const e = env({ memberList: [] });
    expect(await classifyPersonaScan('0xstranger', e)).toEqual({ kind: 'confirm' });
  });

  it('known persona without a chat → confirm card', async () => {
    const e = env();
    expect(await classifyPersonaScan('0xbob', e)).toEqual({ kind: 'confirm' });
    expect(e.api.createHandshake).not.toHaveBeenCalled();
  });

  it('already mutual → skips the POSTs, resolves the chat from a refresh', async () => {
    const e = env({
      chats: [chat('0xchat9', ['0xme', '0xbob'])],
      existingChatCounterparts: new Set(['0xbob'])
    });
    expect(await classifyPersonaScan('0xbob', e)).toEqual({
      kind: 'success',
      chatAddress: '0xchat9'
    });
    expect(e.api.createHandshake).not.toHaveBeenCalled();
    expect(e.api.listChatsOfUser).toHaveBeenCalledTimes(1);
  });

  it('already mutual with a failed chat refresh → success with the /chats fallback', async () => {
    const e = env({ existingChatCounterparts: new Set(['0xbob']) });
    vi.mocked(e.api.listChatsOfUser).mockRejectedValue(new NetworkError('/api', new Error('x')));
    expect(await classifyPersonaScan('0xbob', e)).toEqual({
      kind: 'success',
      chatAddress: null
    });
    expect(e.api.createHandshake).not.toHaveBeenCalled();
  });
});

describe('sendMutualHandshakes (§3.8 steps 3–5)', () => {
  it('sends BOTH handshakes in order (A→B then B→A, status 1) and resolves the chat', async () => {
    const e = env({ chats: [chat('0xchat1', ['0xme', '0xbob'])] });
    expect(await sendMutualHandshakes('0xbob', e)).toEqual({
      kind: 'success',
      chatAddress: '0xchat1'
    });
    const calls = vi.mocked(e.api.createHandshake).mock.calls;
    expect(calls.length).toBe(2);
    expect(calls[0]?.[0]).toEqual({ from_address: '0xme', to_address: '0xbob', status: 1 });
    expect(calls[1]?.[0]).toEqual({ from_address: '0xbob', to_address: '0xme', status: 1 });
  });

  it('treats idempotent 200 responses as success (no error UI)', async () => {
    const e = env(); // createHandshake resolves → 200/201 alike
    expect(await sendMutualHandshakes('0xbob', e)).toEqual({
      kind: 'success',
      chatAddress: null
    });
  });

  it('a NetworkError on the POSTs → retry state; retry re-sends the pair safely to success', async () => {
    const e = env();
    vi.mocked(e.api.createHandshake).mockRejectedValueOnce(
      new NetworkError('/api/handshake', new Error('offline'))
    );
    expect(await sendMutualHandshakes('0xbob', e)).toEqual({ kind: 'error-network' });
    expect(vi.mocked(e.api.createHandshake).mock.calls.length).toBe(1);
    // Idempotent retry on recovery: re-sends the pair (existing pairs return
    // 200) and reaches success.
    expect(await sendMutualHandshakes('0xbob', e)).toEqual({
      kind: 'success',
      chatAddress: null
    });
    const calls = vi.mocked(e.api.createHandshake).mock.calls;
    expect(calls.length).toBe(3);
    expect(calls[1]?.[0]).toEqual({ from_address: '0xme', to_address: '0xbob', status: 1 });
    expect(calls[2]?.[0]).toEqual({ from_address: '0xbob', to_address: '0xme', status: 1 });
  });

  it('an ApiError on the POSTs → retry state with the server text', async () => {
    const e = env({
      postError: new ApiError(400, '/api/handshake', 'income must exceed outcome')
    });
    expect(await sendMutualHandshakes('0xbob', e)).toEqual({
      kind: 'error-api',
      message: 'bleak-node 400 on /api/handshake: income must exceed outcome'
    });
  });

  it('an unexpected error maps to the api-retry state', async () => {
    const e = env({ postError: new TypeError('bad state') });
    expect(await sendMutualHandshakes('0xbob', e)).toEqual({
      kind: 'error-api',
      message: 'bad state'
    });
  });

  it('a chat-refresh failure after successful POSTs → success (eventual consistency)', async () => {
    const e = env();
    vi.mocked(e.api.listChatsOfUser).mockRejectedValue(new NetworkError('/api', new Error('x')));
    expect(await sendMutualHandshakes('0xbob', e)).toEqual({
      kind: 'success',
      chatAddress: null
    });
    expect(vi.mocked(e.api.createHandshake).mock.calls.length).toBe(2);
  });
});
