/** Credential storage-key inventory (TZ2-04 + TZ2-07 Part B, ARCHITECTURE
 * §10.4/§10.11): the four v2 credential stores write ONLY their own `bleak.*`
 * keys — credentials live nowhere else in localStorage. The v1 host-token
 * shim (`bleak.hostToken`) was removed with the v2 host console (TZ2-07). */
import { beforeEach, describe, expect, it } from 'vitest';
import { clearIdentity, saveIdentity } from '../src/lib/stores/identity';
import { clearMutualCode, saveMutualCode } from '../src/lib/stores/mutualCode';
import { clearHostRoom, saveHostRoom } from '../src/lib/stores/hostSession';
import { appendVaultEntry } from '../src/lib/stores/tokenVault';

function storageKeys(): string[] {
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (key !== null) keys.push(key);
  }
  return keys.sort();
}

beforeEach(() => {
  localStorage.clear();
});

describe('credential storage-key inventory', () => {
  it('the identity store writes only bleak.identity', () => {
    saveIdentity({ roomAddress: '0xr', userAddress: '0xu', token: 't' });
    expect(storageKeys()).toEqual(['bleak.identity']);
  });

  it('the host room session writes only bleak.hostRoom (roomToken required, no v1 display fields)', () => {
    saveHostRoom({ code: '123456', roomAddress: '0xr', roomToken: 't' });
    expect(storageKeys()).toEqual(['bleak.hostRoom']);
  });

  it('the token vault writes only bleak.tokenVault', () => {
    appendVaultEntry({
      roomAddress: '0xr',
      userAddress: '0xu',
      token: 't',
      savedAt: '2026-11-15T10:00:00.000Z'
    });
    expect(storageKeys()).toEqual(['bleak.tokenVault']);
  });

  it('the mutual code store writes only bleak.mutualCode', () => {
    saveMutualCode('0xu', 'code');
    expect(storageKeys()).toEqual(['bleak.mutualCode']);
  });

  it('clearing writes no keys at all (only removals)', () => {
    saveIdentity({ roomAddress: '0xr', userAddress: '0xu', token: 't' });
    saveMutualCode('0xu', 'code');
    clearMutualCode();
    clearIdentity();
    expect(storageKeys()).toEqual([]);
  });

  it('the v1 host-token shim key bleak.hostToken is gone (removed by TZ2-07 Part B)', () => {
    saveHostRoom({ code: '1', roomAddress: '0xr', roomToken: 't' });
    clearHostRoom();
    expect(storageKeys()).toEqual([]);
    expect(localStorage.getItem('bleak.hostToken')).toBeNull();
  });
});
