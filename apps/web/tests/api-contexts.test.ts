/**
 * Web API layer tests (TZ2-05 Part A, ARCHITECTURE §10.2/§10.3):
 *
 * 1. the injection maps mirror the §10.2 attachment policy table;
 * 2. behavioral proof: each credentialed call carries the right Bearer,
 *    public reads carry none, the explicit override wins (vault import),
 *    getRoomUser injects only for the attendee's own address;
 * 3. the global 401 gate (identity + mutual code cleared, `bleak.authNotice`
 *    set, navigation to `/` queued, error rethrown) and the host gate
 *    (401/403 → `bleak.hostRoom` cleared + `bleak.hostReset` set, attendee
 *    identity never touched, no navigation);
 * 4. the apiRaw usage restriction (grep test: only the web api module may
 *    reference it — the TZ2-06 Part D transcript fallback joins the
 *    allowlist when it lands).
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$app/navigation', () => ({ goto: vi.fn() }));
vi.mock('$app/paths', () => ({ resolve: (route: string) => route }));

import { goto } from '$app/navigation';
import { ApiError, NetworkError } from '@bleak/api-client';
import {
  api,
  apiRaw,
  AUTH_NOTICE_KEY,
  hostApi,
  HOST_RESET_KEY,
  PERSONA_TOKEN_METHODS,
  ROOM_TOKEN_METHODS
} from '../src/lib/api/client';
import { identity, saveIdentity } from '../src/lib/stores/identity';
import { hostRoom, saveHostRoom } from '../src/lib/stores/hostSession';
import { mutualCode, saveMutualCode } from '../src/lib/stores/mutualCode';

// ---------------------------------------------------------------------------
// fetch harness (the client's fetch is late-bound → stubGlobal works)
// ---------------------------------------------------------------------------

interface Call {
  url: string;
  init?: RequestInit;
  headers: Record<string, string>;
  body?: unknown;
}

type Responder = (url: string, init?: RequestInit) => Response;

function stubFetch(respond: Responder): Call[] {
  const calls: Call[] = [];
  const impl = vi.fn(async (input: string | URL, init?: RequestInit) => {
    const url = String(input);
    const headers = { ...(init?.headers as Record<string, string> | undefined) };
    let body: unknown;
    try {
      body = init?.body ? JSON.parse(String(init.body)) : undefined;
    } catch {
      body = init?.body;
    }
    calls.push({ url, init, headers, body });
    return respond(url, init);
  });
  vi.stubGlobal('fetch', impl as unknown as typeof fetch);
  return calls;
}

const ok = (body: unknown): Response =>
  new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
const empty = (status: number): Response => new Response('', { status });

function authOf(call: Call | undefined): string | undefined {
  return call?.headers['Authorization'];
}

const ME = { roomAddress: '0xroom', userAddress: '0xme', token: 'p-tok' };
const HOST = { code: '123456', roomAddress: '0xroom', roomToken: 'r-tok' };

beforeEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  localStorage.clear();
  sessionStorage.clear();
  // reset the in-memory stores too (localStorage clearing does not do it)
  identity.set(null);
  hostRoom.set(null);
  mutualCode.set(null);
});

// ---------------------------------------------------------------------------
// 1. injection maps mirror the §10.2 policy table
// ---------------------------------------------------------------------------

describe('injection maps (ARCHITECTURE §10.2 policy table, web-layer form)', () => {
  it('PERSONA_TOKEN_METHODS carries exactly the attendee-context credential set', () => {
    expect([...PERSONA_TOKEN_METHODS].sort()).toEqual(
      [
        // mutations
        'updateRoomUser',
        'deleteRoomUser',
        'getUserGreeting',
        'putUserGreeting',
        'regenerateGreeting',
        // handshake sends + mutual call + rotations + code registration
        'createHandshake',
        'createMutualHandshake',
        'rotateUserToken',
        'registerMutualCode',
        // gated reads
        'getRoomUser', // context-dependent: own address only
        'listHandshakesOfUser',
        'listChatsOfUser',
        // attendee-context chat reads/actions (§10.3)
        'getChat',
        'listChatMessages',
        'kickoffChat',
        'clearChatHistory',
        // v3 interests (DESIGN §4.13.1): the persona's own rows
        'addUserInterests',
        'deleteUserInterests',
        // v3 contact share (DESIGN §4.13.3): the FROM persona's share +
        // the recipient-only read (called with the attendee's own token)
        'shareContact',
        'listContactsSharedWith',
        // v3 match score (DESIGN §4.13.4): the caller grades AS itself —
        // the persona passes ITSELF as first_user_address
        'matchV2'
      ].sort()
    );
  });

  it('ROOM_TOKEN_METHODS carries exactly the host-context credential set', () => {
    expect([...ROOM_TOKEN_METHODS].sort()).toEqual(
      [
        'updateRoom',
        'deleteRoom',
        'listInvites',
        'mintInvite',
        'revokeInvite',
        'rotateRoomToken',
        'listChatsOfRoomUser',
        'listRoomUserChatMessages',
        // host-context chat reads/actions (§10.3)
        'getChat',
        'listChatMessages',
        'kickoffChat',
        'clearChatHistory'
      ].sort()
    );
  });

  it('listHandshakesOfUser is NOT a room-token method (flag 6.9a — counts dropped)', () => {
    expect(ROOM_TOKEN_METHODS).not.toContain('listHandshakesOfUser');
  });
});

// ---------------------------------------------------------------------------
// 2. behavioral attachment proof
// ---------------------------------------------------------------------------

describe('credential attachment (behavioral)', () => {
  it('persona mutations and gated reads carry identity.token', async () => {
    saveIdentity(ME);
    const calls = stubFetch(() => ok({ address: '0xme' }));

    await api.createHandshake({ from_address: '0xme', to_address: '0xb', status: 1 });
    await api.updateRoomUser('0xroom', '0xme', { public_bio: 'hi' });
    await api.listHandshakesOfUser('0xme');
    await api.listChatsOfUser('0xme');
    await api.getUserGreeting('0xroom', '0xme');
    // v3 interests (DESIGN §4.13.1): the persona's own rows carry the token.
    await api.addUserInterests('0xroom', '0xme', [{ title: 'Coffee', group: 0, key: 1 }]);
    await api.deleteUserInterests('0xroom', '0xme', [1]);
    // v3 contact share (DESIGN §4.13.3): the share (from = me) + the
    // recipient-only read of my own inbox both carry the persona token.
    await api.shareContact('0xb', 'telegram: @me', '0xme');
    await api.listContactsSharedWith('0xme');
    // v3 match score (DESIGN §4.13.4): the pair graded AS the attendee
    // (itself as first_user_address) carries the persona token.
    await api.matchV2('0xroom', '0xme', '0xb');

    for (const call of calls) {
      expect(authOf(call), `${call.url}`).toBe('Bearer p-tok');
    }
  });

  it('attendee-context chat reads/actions carry the persona token', async () => {
    saveIdentity(ME);
    const calls = stubFetch(() => ok({}));
    await api.getChat('0xc1');
    await api.listChatMessages('0xc1');
    await api.kickoffChat('0xc1');
    await api.clearChatHistory('0xc1');
    for (const call of calls) {
      expect(authOf(call), `${call.url}`).toBe('Bearer p-tok');
    }
  });

  it('getRoomUser is context-dependent: own address gated, others public', async () => {
    saveIdentity(ME);
    const calls = stubFetch(() => ok({ address: '0xme' }));
    await api.getRoomUser('0xroom', '0xme');
    await api.getRoomUser('0xroom', '0xother');
    expect(authOf(calls[0])).toBe('Bearer p-tok');
    expect(authOf(calls[1])).toBeUndefined();
  });

  it('the explicit-token override wins — the documented vault-import read', async () => {
    saveIdentity(ME);
    const calls = stubFetch(() => ok({ address: '0xold' }));
    await api.getRoomUser('0xoldroom', '0xold', { token: 'vault-tok' });
    expect(authOf(calls[0])).toBe('Bearer vault-tok');
  });

  it('override also wins on own-address reads and on other credentialed calls', async () => {
    saveIdentity(ME);
    const calls = stubFetch(() => ok({ address: '0xme' }));
    await api.getRoomUser('0xroom', '0xme', { token: 'explicit' });
    await api.createHandshake({ from_address: '0xme', to_address: '0xb', status: 1 }, { token: 'explicit' });
    expect(authOf(calls[0])).toBe('Bearer explicit');
    expect(authOf(calls[1])).toBe('Bearer explicit');
  });

  it('public reads and the join create carry NO token at all', async () => {
    saveIdentity(ME);
    const calls = stubFetch(() => ok({}));
    await api.listRooms();
    await api.getRoom('0xroom');
    await api.listRoomUsers('0xroom');
    await api.createRoomUser('0xroom', { name: 'Я', invite_code: '123456', token: 'generated-raw' });
    for (const call of calls) {
      expect(authOf(call), `${call.url}`).toBeUndefined();
    }
  });

  it('with no credential held nothing is injected (v1 behavior preserved)', async () => {
    const calls = stubFetch(() => ok({}));
    await api.listChatsOfUser('0xme');
    await hostApi.updateRoom('0xroom', { name: 'x' });
    expect(authOf(calls[0])).toBeUndefined();
    expect(authOf(calls[1])).toBeUndefined();
  });

  it('host room-token calls carry bleak.hostRoom.roomToken', async () => {
    saveHostRoom(HOST);
    const calls = stubFetch(() => ok({}));
    await hostApi.listInvites('0xroom');
    await hostApi.mintInvite('0xroom', {});
    await hostApi.revokeInvite('0xroom', '654321');
    await hostApi.updateRoom('0xroom', { name: 'x' });
    await hostApi.deleteRoom('0xroom');
    await hostApi.listChatsOfRoomUser('0xroom', '0xmember');
    for (const call of calls) {
      expect(authOf(call), `${call.url}`).toBe('Bearer r-tok');
    }
  });

  it('context-dependent chat reads split by context: api → persona, hostApi → room', async () => {
    saveIdentity(ME);
    saveHostRoom(HOST);
    const calls = stubFetch(() => ok({}));
    await api.getChat('0xc1');
    await hostApi.getChat('0xc1');
    expect(authOf(calls[0])).toBe('Bearer p-tok');
    expect(authOf(calls[1])).toBe('Bearer r-tok');
  });

  it('room creation authenticates with the creation token header — no Bearer, room token in the body', async () => {
    const calls = stubFetch(() => ok({ address: '0xnewroom' }));
    await hostApi.createRoom(
      { name: 'Event', language: 'ru', token: 'room-token-raw' },
      'create-token-1'
    );
    expect(calls[0]?.headers['x-create-token']).toBe('create-token-1');
    expect(authOf(calls[0])).toBeUndefined();
    expect(calls[0]?.body).toEqual({ name: 'Event', language: 'ru', token: 'room-token-raw' });
  });

  it('createRoomWithInvite: create (creation header) then mint (Bearer = the body room token)', async () => {
    const calls = stubFetch((url) => {
      if (url.endsWith('/api/room')) {
        return new Response(JSON.stringify({ address: '0xnewroom', name: 'Event' }), { status: 201 });
      }
      return ok({ code: '654321', created_at: '2026-11-15T10:00:00Z', expires_at: '2026-11-16T10:00:00Z' });
    });
    const result = await hostApi.createRoomWithInvite(
      { name: 'Event', language: 'ru', token: 'room-token-raw' },
      'create-token-1'
    );
    expect(result).toEqual({ room: { address: '0xnewroom', name: 'Event' }, code: '654321' });
    expect(calls[0]?.headers['x-create-token']).toBe('create-token-1');
    expect(authOf(calls[0])).toBeUndefined();
    expect(calls[1]?.url).toContain('/api/room/0xnewroom/invite');
    expect(authOf(calls[1])).toBe('Bearer room-token-raw');
  });

  it('rotations: Bearer = the CURRENT credential, body = the new raw secret', async () => {
    saveIdentity(ME);
    saveHostRoom(HOST);
    const calls = stubFetch(() => empty(204));
    await api.rotateUserToken('0xroom', '0xme', 'new-persona-raw');
    await hostApi.rotateRoomToken('0xroom', 'new-room-raw');
    expect(authOf(calls[0])).toBe('Bearer p-tok');
    expect(calls[0]?.body).toEqual({ token: 'new-persona-raw' });
    expect(authOf(calls[1])).toBe('Bearer r-tok');
    expect(calls[1]?.body).toEqual({ token: 'new-room-raw' });
  });

  it('registerMutualCode sends the HASH only — never the raw code', async () => {
    saveIdentity(ME);
    const calls = stubFetch(() => empty(204));
    await api.registerMutualCode('0xroom', '0xme', 'a'.repeat(64));
    expect(authOf(calls[0])).toBe('Bearer p-tok');
    expect(calls[0]?.body).toEqual({ mutual_code_hash: 'a'.repeat(64) });
    expect(JSON.stringify(calls[0]?.body)).not.toContain('raw');
  });

  it('apiRaw is the ungated underlying client: no injection, no gate', async () => {
    saveIdentity(ME);
    const calls = stubFetch(() => ok({}));
    await apiRaw.getChat('0xc1');
    expect(authOf(calls[0])).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 3. gates
// ---------------------------------------------------------------------------

describe('global 401 gate (attendee)', () => {
  it('401 clears identity + mutualCode, sets bleak.authNotice, queues goto(/) and rethrows', async () => {
    saveIdentity(ME);
    saveMutualCode('0xme', 'one-time-code');
    stubFetch(() => empty(401));

    let caught: unknown = null;
    try {
      await api.listChatsOfUser('0xme');
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(ApiError);
    expect((caught as ApiError).status).toBe(401);
    // identity + one-time mutual code cleared (store + storage)
    expect(localStorage.getItem('bleak.identity')).toBeNull();
    expect(localStorage.getItem('bleak.mutualCode')).toBeNull();
    // the notice flag is set and navigation to `/` is queued
    expect(sessionStorage.getItem(AUTH_NOTICE_KEY)).toBe('1');
    expect(goto).toHaveBeenCalledTimes(1);
    expect(goto).toHaveBeenCalledWith('/');
  });

  it('403 does NOT fire the attendee gate (identity kept, no notice)', async () => {
    saveIdentity(ME);
    stubFetch(() => new Response('rule rejected', { status: 403 }));
    await expect(api.createHandshake({ from_address: '0xme', to_address: '0xb', status: 1 })).rejects.toBeInstanceOf(
      ApiError
    );
    expect(JSON.parse(localStorage.getItem('bleak.identity') ?? 'null')).toEqual(ME);
    expect(sessionStorage.getItem(AUTH_NOTICE_KEY)).toBeNull();
    expect(goto).not.toHaveBeenCalled();
  });

  it('NetworkError and other statuses never hit the gate', async () => {
    saveIdentity(ME);
    stubFetch(() => {
      throw new TypeError('offline');
    });
    await expect(api.listChatsOfUser('0xme')).rejects.toBeInstanceOf(NetworkError);
    expect(JSON.parse(localStorage.getItem('bleak.identity') ?? 'null')).toEqual(ME);
    expect(goto).not.toHaveBeenCalled();
  });
});

describe('host gate (room context)', () => {
  it.each([401, 403])(
    '%i on a room-token call clears bleak.hostRoom + sets bleak.hostReset; attendee identity untouched; rethrown',
    async (status) => {
      saveHostRoom(HOST);
      saveIdentity(ME);
      stubFetch(() => empty(status));

      let caught: unknown = null;
      try {
        await hostApi.updateRoom('0xroom', { name: 'x' });
      } catch (err) {
        caught = err;
      }
      expect(caught).toBeInstanceOf(ApiError);
      expect((caught as ApiError).status).toBe(status);
      expect(localStorage.getItem('bleak.hostRoom')).toBeNull();
      expect(sessionStorage.getItem(HOST_RESET_KEY)).toBe('1');
      // The attendee identity is NEVER touched by the host gate.
      expect(JSON.parse(localStorage.getItem('bleak.identity') ?? 'null')).toEqual(ME);
      // No navigation in the host gate (the console renders the reset notice).
      expect(goto).not.toHaveBeenCalled();
    }
  );

  it('other statuses keep the room session', async () => {
    saveHostRoom(HOST);
    stubFetch(() => empty(404));
    await expect(hostApi.deleteRoom('0xroom')).rejects.toBeInstanceOf(ApiError);
    expect(JSON.parse(localStorage.getItem('bleak.hostRoom') ?? 'null')).toMatchObject({
      roomToken: 'r-tok'
    });
    expect(sessionStorage.getItem(HOST_RESET_KEY)).toBeNull();
  });

  it('room creation is NOT gated: a 403 there sets no hostReset (creation-token rejection, §3.7)', async () => {
    saveIdentity(ME);
    stubFetch(() => empty(403));
    await expect(hostApi.createRoom({ name: 'x', token: 'r' }, 'ctok')).rejects.toBeInstanceOf(ApiError);
    expect(sessionStorage.getItem(HOST_RESET_KEY)).toBeNull();
    expect(goto).not.toHaveBeenCalled();
    // identity untouched
    expect(JSON.parse(localStorage.getItem('bleak.identity') ?? 'null')).toEqual(ME);
  });
});

// ---------------------------------------------------------------------------
// 4. apiRaw usage restriction (grep test)
// ---------------------------------------------------------------------------

const WEB_ROOT = process.cwd().endsWith(`${sep}apps${sep}web`)
  ? process.cwd()
  : join(process.cwd(), 'apps', 'web');
const SRC_ROOT = join(WEB_ROOT, 'src');

function collectFiles(root: string): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (entry.endsWith('.ts') || entry.endsWith('.svelte')) out.push(full);
    }
  };
  walk(root);
  return out;
}

describe('apiRaw restriction (ARCHITECTURE §10.3 escape hatch)', () => {
  it('only the web api module and the transcript host-view fallback may reference apiRaw in src', () => {
    const allowed = [
      join(SRC_ROOT, 'lib', 'api', 'client.ts'),
      // TZ2-06 Part D: the transcript's participant→host viewer fallback is
      // the documented second importer (the only path allowed to catch a
      // 401 before the §2.8 global gate fires).
      join(SRC_ROOT, 'routes', 'chats', '[address]', '+page.svelte')
    ];
    const offenders = collectFiles(SRC_ROOT)
      .filter((f) => !allowed.includes(f))
      .filter((f) => /\bapiRaw\b/.test(readFileSync(f, 'utf8')))
      .map((f) => relative(WEB_ROOT, f).split(sep).join('/'));
    expect(offenders).toEqual([]);
  });
});
