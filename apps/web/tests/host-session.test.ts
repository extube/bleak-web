/** hostSession store tests (TZ2-04 v2 + TZ2-07 Part B, ARCHITECTURE §10.4):
 * the room reference (address + client-generated room token + invite code)
 * persists under the single key `bleak.hostRoom` and nowhere else; the room
 * token is REQUIRED; room-token rotation rewrites the entry in place; init
 * restores; clear removes; the v1 `hostToken` writable / `bleak.hostToken`
 * key and the v1 `roomName`/`inviteUrl` display fields are REMOVED (the v2
 * creation token is never persisted). */
import { beforeEach, describe, expect, it } from 'vitest';
import { get } from 'svelte/store';
import {
  clearHostRoom,
  hostRoom,
  initHostSession,
  saveHostRoom,
  updateHostRoomToken,
  type HostRoomRef
} from '../src/lib/stores/hostSession';

beforeEach(() => {
  localStorage.clear();
  hostRoom.set(null);
});

function storageKeys(): string[] {
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (key !== null) keys.push(key);
  }
  return keys;
}

describe('hostSession — v2 room reference', () => {
  it('saves and restores the room reference with the required room token', () => {
    const ref: HostRoomRef = {
      code: '123456',
      roomAddress: '0xroom',
      roomToken: 'room-token-secret'
    };
    saveHostRoom(ref);
    expect(get(hostRoom)).toEqual(ref);
    expect(JSON.parse(localStorage.getItem('bleak.hostRoom') ?? '{}')).toEqual({
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
    saveHostRoom({ code: '123456', roomAddress: '0xroom', roomToken: 'room-token-secret' });
    hostRoom.set(null);
    initHostSession();
    expect(get(hostRoom)).toEqual({
      code: '123456',
      roomAddress: '0xroom',
      roomToken: 'room-token-secret'
    });
  });

  it('a persisted v1-era reference WITHOUT a room token is unusable: no session, blob dropped', () => {
    localStorage.setItem(
      'bleak.hostRoom',
      JSON.stringify({ code: '123456', roomAddress: '0xroom', roomName: '', inviteUrl: '' })
    );
    initHostSession();
    expect(get(hostRoom)).toBeNull();
    expect(localStorage.getItem('bleak.hostRoom')).toBeNull();
  });

  it('room-token rotation rewrites the entry in place, preserving the other fields', () => {
    saveHostRoom({ code: '123456', roomAddress: '0xroom', roomToken: 'old-token' });
    updateHostRoomToken('new-token');
    expect(get(hostRoom)).toEqual({
      code: '123456',
      roomAddress: '0xroom',
      roomToken: 'new-token'
    });
    expect(JSON.parse(localStorage.getItem('bleak.hostRoom') ?? '{}')).toEqual({
      code: '123456',
      roomAddress: '0xroom',
      roomToken: 'new-token'
    });
  });

  it('room-token rotation is a no-op when no room session is stored', () => {
    updateHostRoomToken('new-token');
    expect(get(hostRoom)).toBeNull();
    expect(localStorage.getItem('bleak.hostRoom')).toBeNull();
  });

  it('clear removes the key; corrupted JSON restores null', () => {
    saveHostRoom({ code: '1', roomAddress: '0xr', roomToken: 't' });
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
      expect(() => saveHostRoom({ code: '1', roomAddress: '0xr', roomToken: 't' })).not.toThrow();
      expect(get(hostRoom)).toEqual({ code: '1', roomAddress: '0xr', roomToken: 't' });
    } finally {
      Object.getPrototypeOf(localStorage).setItem = original;
    }
  });
});

describe('hostSession — creation token is never persisted (v2, §3.7 AC 1)', () => {
  it('no hostToken writable or saveHostToken/forgetHostToken exports exist', async () => {
    const mod = await import('../src/lib/stores/hostSession');
    expect('hostToken' in mod).toBe(false);
    expect('saveHostToken' in mod).toBe(false);
    expect('forgetHostToken' in mod).toBe(false);
  });

  it('the deprecated bleak.hostToken key is never written by the store module', () => {
    saveHostRoom({ code: '1', roomAddress: '0xr', roomToken: 't' });
    clearHostRoom();
    initHostSession();
    expect(localStorage.getItem('bleak.hostToken')).toBeNull();
    expect(storageKeys()).toEqual([]);
  });
});
