/** Credential storage-key inventory (TZ2-04, ARCHITECTURE §10.4/§10.11):
 * the four v2 credential stores write ONLY their own `bleak.*` keys —
 * credentials live nowhere else in localStorage. The deprecated v1 host-token
 * shim (`bleak.hostToken`, removed together with the v1 host console by
 * TZ2-11) is asserted explicitly as the documented single exception. */
import { beforeEach, describe, expect, it } from 'vitest';
import { clearIdentity, saveIdentity } from '../src/lib/stores/identity';
import { clearMutualCode, saveMutualCode } from '../src/lib/stores/mutualCode';
import { saveHostRoom, saveHostToken } from '../src/lib/stores/hostSession';
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

  it('the host room session writes only bleak.hostRoom', () => {
    saveHostRoom({
      code: '123456',
      roomAddress: '0xr',
      roomToken: 't',
      roomName: '',
      inviteUrl: ''
    });
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

  it('documented exception: the deprecated v1 host-token shim writes bleak.hostToken (removed by TZ2-11)', () => {
    saveHostToken('legacy-host-token');
    expect(storageKeys()).toEqual(['bleak.hostToken']);
  });
});
