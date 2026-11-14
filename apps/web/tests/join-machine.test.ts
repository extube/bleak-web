/** Join step machine + services (TZ-03): code validation, §3.1 error
 * mapping, deep-link parsing, step transitions, and the API orchestration
 * against mocked clients (vi.mock('#lib/api/client') / helper). */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, NetworkError, type Room, type User } from '@bleak/api-client';

vi.mock('#lib/api/helper', () => {
  class HelperError extends Error {
    readonly status: number;
    constructor(status: number, message: string) {
      super(message);
      this.name = 'HelperError';
      this.status = status;
    }
  }
  return { HelperError, resolveInvite: vi.fn() };
});

vi.mock('#lib/api/client', () => ({
  api: {
    getRoom: vi.fn(),
    listRooms: vi.fn(),
    listRoomUsers: vi.fn(),
    getRoomUser: vi.fn(),
    createRoomUser: vi.fn()
  }
}));

import { HelperError, resolveInvite } from '#lib/api/helper';
import { api } from '#lib/api/client';
import {
  codeErrorOf,
  createPersona,
  initialJoinState,
  isValidInviteCode,
  listImportPersonas,
  listImportRooms,
  parseJoinDeepLink,
  personaErrorOf,
  readImportPersona,
  reduce,
  resolveRoomByCode,
  type PersonaDraft
} from '#lib/join';

const mockedResolve = vi.mocked(resolveInvite);
const mockedApi = vi.mocked(api);

const room: Room = {
  address: '0xroom123',
  name: 'Хостел «Пиксель»',
  description: 'Митап',
  language: 'ru',
  max_user: 50,
  created_at: '',
  updated_at: '',
  deleted_at: null
};

function user(address: string, name: string): User {
  return {
    address,
    room: room.address,
    name,
    greeting: '',
    public_bio: '',
    private_bio: '',
    language: 'ru',
    created_at: '',
    updated_at: '',
    deleted_at: null
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('invite-code validation', () => {
  it('accepts exactly six digits', () => {
    expect(isValidInviteCode('123456')).toBe(true);
    expect(isValidInviteCode('000000')).toBe(true);
  });

  it('rejects anything else', () => {
    expect(isValidInviteCode('12345')).toBe(false);
    expect(isValidInviteCode('1234567')).toBe(false);
    expect(isValidInviteCode('12345a')).toBe(false);
    expect(isValidInviteCode('')).toBe(false);
  });
});

describe('codeErrorOf (§3.1 interaction states)', () => {
  it('maps helper 400 to the malformed inline error', () => {
    expect(codeErrorOf(new HelperError(400, 'bad code')).kind).toBe('malformed');
  });

  it('maps helper 404 to the unknown-code inline error', () => {
    expect(codeErrorOf(new HelperError(404, 'unknown code')).kind).toBe('not_found');
  });

  it('maps network failure to the banner kind', () => {
    expect(codeErrorOf(new NetworkError('/rooms/123456', new Error('offline'))).kind).toBe(
      'network'
    );
  });

  it('maps a deleted room (bleak-node 404) to the gone card state', () => {
    expect(codeErrorOf(new ApiError(404, '/api/room/0xroom123', 'room not found')).kind).toBe(
      'gone'
    );
  });

  it('maps other bleak-node errors to the api banner with server text', () => {
    const err = new ApiError(500, '/api/room', 'boom');
    const mapped = codeErrorOf(err);
    expect(mapped.kind).toBe('api');
    expect(mapped.text).toBe('boom');
  });
});

describe('personaErrorOf', () => {
  it('maps 409 to the name-taken copy', () => {
    expect(personaErrorOf(new ApiError(409, '/api/room/r/user', 'name taken')).kind).toBe(
      'name_taken'
    );
  });

  it('maps 404 to the gone card state', () => {
    expect(personaErrorOf(new ApiError(404, '/api/room/r/user', 'room not found')).kind).toBe(
      'gone'
    );
  });

  it('maps 400 to a field-level server-text error', () => {
    const mapped = personaErrorOf(new ApiError(400, '/api/room/r/user', 'name is empty'));
    expect(mapped.kind).toBe('api');
    expect(mapped.text).toBe('name is empty');
  });

  it('maps network failure to the banner copy', () => {
    expect(personaErrorOf(new NetworkError('/api/room/r/user', null)).kind).toBe('network');
  });
});

describe('deep-link parsing', () => {
  it('parses a valid ?code= as the invite deep link', () => {
    expect(parseJoinDeepLink(new URLSearchParams('code=123456'))).toEqual({
      kind: 'code',
      code: '123456'
    });
  });

  it('parses ?u= as the persona deep link', () => {
    expect(parseJoinDeepLink(new URLSearchParams('u=0xalice'))).toEqual({
      kind: 'user',
      userAddress: '0xalice'
    });
  });

  it('ignores invalid or absent params', () => {
    expect(parseJoinDeepLink(new URLSearchParams('code=12ab56'))).toBeNull();
    expect(parseJoinDeepLink(new URLSearchParams('u='))).toBeNull();
    expect(parseJoinDeepLink(new URLSearchParams(''))).toBeNull();
  });
});

describe('step machine transitions', () => {
  it('enters the room preview when the code resolves', () => {
    const next = reduce(initialJoinState, { type: 'resolved', room, members: [user('0xa', 'A')] });
    expect(next.step).toBe('room');
    expect(next.room).toBe(room);
    expect(next.members).toHaveLength(1);
  });

  it('choose-create opens the persona form with no prefill', () => {
    const atRoom = reduce(initialJoinState, { type: 'resolved', room, members: [] });
    const next = reduce(atRoom, { type: 'choose-create' });
    expect(next.step).toBe('persona');
    expect(next.prefill).toBeNull();
  });

  it('choose-import resets the import context and opens the room picker', () => {
    const atRoom = reduce(initialJoinState, { type: 'resolved', room, members: [] });
    const next = reduce(atRoom, { type: 'choose-import' });
    expect(next.step).toBe('rooms');
    expect(next.importRoom).toBeNull();
    expect(next.importUsers).toEqual([]);
    expect(next.prefill).toBeNull();
  });

  it('picking a room shows its personas; picking a persona prefills the form', () => {
    const old = room;
    const atRooms = reduce(initialJoinState, { type: 'choose-import' });
    const atUsers = reduce(atRooms, {
      type: 'import-room-picked',
      room: old,
      users: [user('0xold', 'Старая персона')]
    });
    expect(atUsers.step).toBe('users');
    expect(atUsers.importRoom).toBe(old);
    const next = reduce(atUsers, { type: 'import-user-picked', user: user('0xold', 'Старая') });
    expect(next.step).toBe('persona');
    expect(next.prefill).toEqual({ name: 'Старая', publicBio: '', privateBio: '' });
  });

  it('back navigation walks the import path down to the room preview', () => {
    const atRoom = reduce(initialJoinState, { type: 'resolved', room, members: [] });
    expect(reduce(atRoom, { type: 'back' }).step).toBe('code');
    const atRooms = reduce(atRoom, { type: 'choose-import' });
    expect(reduce(atRooms, { type: 'back' }).step).toBe('room');
    const atUsers = reduce(atRooms, { type: 'import-room-picked', room, users: [] });
    expect(reduce(atUsers, { type: 'back' }).step).toBe('rooms');
    const atPersona = reduce(atUsers, { type: 'import-user-picked', user: user('0x', 'X') });
    expect(reduce(atPersona, { type: 'back' }).step).toBe('users');
  });

  it('change-code resets to a clean code entry', () => {
    const atRoom = reduce(initialJoinState, { type: 'resolved', room, members: [] });
    const next = reduce(atRoom, { type: 'change-code' });
    expect(next).toEqual(initialJoinState);
  });
});

describe('services against the mocked clients', () => {
  it('resolveRoomByCode: helper mapping → room → members', async () => {
    mockedResolve.mockResolvedValue({ code: '123456', room_address: room.address });
    mockedApi.getRoom.mockResolvedValue(room);
    mockedApi.listRoomUsers.mockResolvedValue([user('0xa', 'Алиса')]);

    const result = await resolveRoomByCode('123456');

    expect(mockedResolve).toHaveBeenCalledWith('123456');
    expect(mockedApi.getRoom).toHaveBeenCalledWith(room.address);
    expect(mockedApi.listRoomUsers).toHaveBeenCalledWith(room.address);
    expect(result.room.name).toBe('Хостел «Пиксель»');
    expect(result.members).toHaveLength(1);
  });

  it('createPersona sends the trimmed fields, omitting empty bios', async () => {
    mockedApi.createRoomUser.mockResolvedValue(user('0xme', 'Я'));
    const draft: PersonaDraft = { name: '  Я  ', publicBio: '', privateBio: 'секрет' };

    await createPersona(room.address, draft);

    expect(mockedApi.createRoomUser).toHaveBeenCalledWith(room.address, {
      name: 'Я',
      private_bio: 'секрет'
    });
  });

  it('the import copy performs exactly two reads + one create', async () => {
    const oldUser = user('0xold', 'Старая персона');
    mockedApi.listRooms.mockResolvedValue([room]);
    mockedApi.listRoomUsers.mockResolvedValue([oldUser]);
    mockedApi.getRoomUser.mockResolvedValue(oldUser);
    mockedApi.createRoomUser.mockResolvedValue(user('0xnew', 'Старая персона'));

    const rooms = await listImportRooms();
    const personas = await listImportPersonas(rooms[0]!.address);
    const source = await readImportPersona(rooms[0]!.address, personas[0]!.address);
    const created = await createPersona(rooms[0]!.address, {
      name: source.name,
      publicBio: source.public_bio,
      privateBio: source.private_bio
    });

    expect(mockedApi.listRoomUsers).toHaveBeenCalledTimes(1);
    expect(mockedApi.getRoomUser).toHaveBeenCalledTimes(1);
    expect(mockedApi.createRoomUser).toHaveBeenCalledTimes(1);
    // No address reuse: a NEW user is created in the target room (§8.4).
    expect(created.address).toBe('0xnew');
    expect(mockedApi.createRoomUser).toHaveBeenCalledWith(room.address, {
      name: 'Старая персона'
    });
  });
});
