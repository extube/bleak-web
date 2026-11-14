/** hostSession store tests (TZ-09): the host token and the last created
 * room persist under the single keys `bleak.hostToken` / `bleak.hostRoom`
 * and nowhere else; forget/clear remove them; init restores both. */
import { beforeEach, describe, expect, it } from 'vitest';
import { get } from 'svelte/store';
import {
  clearHostRoom,
  forgetHostToken,
  hostRoom,
  hostToken,
  initHostSession,
  saveHostRoom,
  saveHostToken
} from '../src/lib/stores/hostSession';

beforeEach(() => {
  localStorage.clear();
});

function storageKeys(): string[] {
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (key !== null) keys.push(key);
  }
  return keys;
}

describe('hostSession — token persistence (masked input, single key)', () => {
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

describe('hostSession — last created room (share-kit restore)', () => {
  it('saves and restores the room reference', () => {
    saveHostRoom({
      code: '123456',
      roomAddress: '0xroom',
      roomName: 'Митап',
      inviteUrl: 'http://localhost:5173/?code=123456'
    });
    expect(get(hostRoom)).not.toBeNull();
    expect(JSON.parse(localStorage.getItem('bleak.hostRoom') ?? '{}')).toMatchObject({
      code: '123456',
      roomAddress: '0xroom'
    });

    initHostSession();
    expect(get(hostRoom)).toEqual({
      code: '123456',
      roomAddress: '0xroom',
      roomName: 'Митап',
      inviteUrl: 'http://localhost:5173/?code=123456'
    });
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
});
