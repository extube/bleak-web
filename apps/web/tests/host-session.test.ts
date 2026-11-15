/** hostSession store tests (TZ-09 v1 + TZ2-04 v2, ARCHITECTURE §10.4):
 * the room reference (address + client-generated room token + invite code)
 * persists under the single key `bleak.hostRoom` and nowhere else; room-token
 * rotation rewrites the entry in place; init restores; clear removes.
 * The v1 `hostToken` writable + `bleak.hostToken` key are kept ONLY as a
 * deprecated transition shim (removed together with the v1 host console by
 * TZ2-11) — the v2 creation token is never persisted. */
import { beforeEach, describe, expect, it } from 'vitest';
import { get } from 'svelte/store';
import {
  clearHostRoom,
  forgetHostToken,
  hostRoom,
  hostToken,
  initHostSession,
  saveHostRoom,
  saveHostToken,
  updateHostRoomToken,
  type HostRoomRef
} from '../src/lib/stores/hostSession';

beforeEach(() => {
  localStorage.clear();
  hostRoom.set(null);
  hostToken.set('');
});

function storageKeys(): string[] {
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (key !== null) keys.push(key);
  }
  return keys;
}

describe('hostSession — room reference (v2 shape)', () => {
  it('saves and restores the room reference with the room token', () => {
    const ref: HostRoomRef = {
      code: '123456',
      roomAddress: '0xroom',
      roomToken: 'room-token-secret',
      roomName: '',
      inviteUrl: ''
    };
    saveHostRoom(ref);
    expect(get(hostRoom)).toEqual(ref);
    expect(JSON.parse(localStorage.getItem('bleak.hostRoom') ?? '{}')).toMatchObject({
      code: '123456',
      roomAddress: '0xroom',
      roomToken: 'room-token-secret'
    });
    // The room token must not leak into any other key.
    for (const key of storageKeys()) {
      if (key === 'bleak.hostRoom') continue;
      expect(localStorage.getItem(key)).not.toContain('room-token-secret');
    }
  });

  it('init restores a persisted room reference (round-trip)', () => {
    saveHostRoom({
      code: '123456',
      roomAddress: '0xroom',
      roomToken: 'room-token-secret',
      roomName: 'Митап',
      inviteUrl: 'http://localhost:5173/?code=123456'
    });
    hostRoom.set(null);
    initHostSession();
    expect(get(hostRoom)).toEqual({
      code: '123456',
      roomAddress: '0xroom',
      roomToken: 'room-token-secret',
      roomName: 'Митап',
      inviteUrl: 'http://localhost:5173/?code=123456'
    });
  });

  it('a persisted v1 reference without a room token restores with roomToken undefined', () => {
    localStorage.setItem(
      'bleak.hostRoom',
      JSON.stringify({ code: '123456', roomAddress: '0xroom', roomName: '', inviteUrl: '' })
    );
    initHostSession();
    expect(get(hostRoom)).toEqual({
      code: '123456',
      roomAddress: '0xroom',
      roomName: '',
      inviteUrl: ''
    });
  });

  it('room-token rotation rewrites the entry in place, preserving the other fields', () => {
    saveHostRoom({
      code: '123456',
      roomAddress: '0xroom',
      roomToken: 'old-token',
      roomName: '',
      inviteUrl: ''
    });
    updateHostRoomToken('new-token');
    expect(get(hostRoom)).toEqual({
      code: '123456',
      roomAddress: '0xroom',
      roomToken: 'new-token',
      roomName: '',
      inviteUrl: ''
    });
    expect(JSON.parse(localStorage.getItem('bleak.hostRoom') ?? '{}')).toMatchObject({
      roomToken: 'new-token'
    });
  });

  it('room-token rotation is a no-op when no room session is stored', () => {
    updateHostRoomToken('new-token');
    expect(get(hostRoom)).toBeNull();
    expect(localStorage.getItem('bleak.hostRoom')).toBeNull();
  });

  it('clear removes the key; corrupted JSON restores null', () => {
    saveHostRoom({ code: '1', roomAddress: '0xr', roomName: '', inviteUrl: '' });
    clearHostRoom();
    expect(localStorage.getItem('bleak.hostRoom')).toBeNull();
    expect(get(hostRoom)).toBeNull();

    localStorage.setItem('bleak.hostRoom', '{not-json');
    initHostSession();
    expect(get(hostRoom)).toBeNull();
  });

  it('tolerates unavailable storage', () => {
    const original = Object.getPrototypeOf(localStorage).setItem;
    Object.getPrototypeOf(localStorage).setItem = () => {
      throw new Error('quota');
    };
    try {
      expect(() =>
        saveHostRoom({ code: '1', roomAddress: '0xr', roomName: '', inviteUrl: '' })
      ).not.toThrow();
      expect(get(hostRoom)).toEqual({ code: '1', roomAddress: '0xr', roomName: '', inviteUrl: '' });
    } finally {
      Object.getPrototypeOf(localStorage).setItem = original;
    }
  });
});

describe('hostSession — deprecated v1 host-token shim (removed by TZ2-11)', () => {
  it('saves the token only under bleak.hostToken', () => {
    saveHostToken('sekret-token');
    expect(localStorage.getItem('bleak.hostToken')).toBe('sekret-token');
    expect(get(hostToken)).toBe('sekret-token');
    // Masking criterion: the token value must not leak into any other key.
    for (const key of storageKeys()) {
      if (key === 'bleak.hostToken') continue;
      expect(localStorage.getItem(key)).not.toContain('sekret-token');
    }
  });

  it('forget removes the key and resets the store', () => {
    saveHostToken('sekret-token');
    forgetHostToken();
    expect(localStorage.getItem('bleak.hostToken')).toBeNull();
    expect(get(hostToken)).toBe('');
  });

  it('init restores a persisted token', () => {
    localStorage.setItem('bleak.hostToken', 'stored-token');
    initHostSession();
    expect(get(hostToken)).toBe('stored-token');
  });

  it('tolerates unavailable storage', () => {
    const original = Object.getPrototypeOf(localStorage).setItem;
    Object.getPrototypeOf(localStorage).setItem = () => {
      throw new Error('quota');
    };
    try {
      expect(() => saveHostToken('x')).not.toThrow();
      expect(get(hostToken)).toBe('x');
    } finally {
      Object.getPrototypeOf(localStorage).setItem = original;
    }
  });
});
