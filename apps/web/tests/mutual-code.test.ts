/** mutualCode store tests (TZ2-04, ARCHITECTURE §10.4): the raw one-time
 * badge-QR code lives under `bleak.mutualCode` next to the identity (the
 * server keeps only its hash) and is validated against identity.userAddress
 * on load — mismatched/stale → treated as "no code"; cleared with the
 * identity. */
import { beforeEach, describe, expect, it } from 'vitest';
import { get } from 'svelte/store';
import {
  clearIdentity,
  identity,
  initIdentity,
  saveIdentity
} from '../src/lib/stores/identity';
import {
  clearMutualCode,
  initMutualCode,
  mutualCode,
  saveMutualCode
} from '../src/lib/stores/mutualCode';

beforeEach(() => {
  localStorage.clear();
  identity.set(null);
  mutualCode.set(null);
});

describe('mutualCode — persistence round-trip', () => {
  it('saves the code under bleak.mutualCode only', () => {
    saveMutualCode('0xme', 'one-time-code');
    expect(get(mutualCode)).toEqual({ userAddress: '0xme', code: 'one-time-code' });
    expect(JSON.parse(localStorage.getItem('bleak.mutualCode') ?? '{}')).toEqual({
      userAddress: '0xme',
      code: 'one-time-code'
    });
  });

  it('clear removes the store value and the storage key', () => {
    saveMutualCode('0xme', 'one-time-code');
    clearMutualCode();
    expect(get(mutualCode)).toBeNull();
    expect(localStorage.getItem('bleak.mutualCode')).toBeNull();
  });

  it('corrupted JSON is treated as no code', () => {
    localStorage.setItem('bleak.mutualCode', '{oops');
    initMutualCode();
    expect(get(mutualCode)).toBeNull();
  });
});

describe('mutualCode — validation on load (against identity.userAddress)', () => {
  it('restores a code owned by the current persona', () => {
    saveIdentity({ roomAddress: '0xroom', userAddress: '0xme', token: 't' });
    localStorage.setItem(
      'bleak.mutualCode',
      JSON.stringify({ userAddress: '0xme', code: 'one-time-code' })
    );
    initMutualCode();
    expect(get(mutualCode)).toEqual({ userAddress: '0xme', code: 'one-time-code' });
  });

  it('drops and removes a code owned by another persona (stale)', () => {
    saveIdentity({ roomAddress: '0xroom', userAddress: '0xsomeone-else', token: 't' });
    localStorage.setItem(
      'bleak.mutualCode',
      JSON.stringify({ userAddress: '0xme', code: 'one-time-code' })
    );
    initMutualCode();
    expect(get(mutualCode)).toBeNull();
    expect(localStorage.getItem('bleak.mutualCode')).toBeNull();
  });

  it('surfaces no code when no identity exists, keeping the blob for a later init', () => {
    localStorage.setItem(
      'bleak.mutualCode',
      JSON.stringify({ userAddress: '0xme', code: 'one-time-code' })
    );
    initMutualCode();
    expect(get(mutualCode)).toBeNull();
    // Not destroyed on missing information — re-validated once identity exists.
    expect(localStorage.getItem('bleak.mutualCode')).not.toBeNull();

    identity.set({ roomAddress: '0xroom', userAddress: '0xme', token: 't' });
    initMutualCode();
    expect(get(mutualCode)).toEqual({ userAddress: '0xme', code: 'one-time-code' });
  });
});

describe('mutualCode — cleared with the identity', () => {
  it('clearIdentity clears the one-time code too', () => {
    saveIdentity({ roomAddress: '0xroom', userAddress: '0xme', token: 't' });
    saveMutualCode('0xme', 'one-time-code');
    clearIdentity();
    expect(get(identity)).toBeNull();
    expect(get(mutualCode)).toBeNull();
    expect(localStorage.getItem('bleak.mutualCode')).toBeNull();
    expect(localStorage.getItem('bleak.identity')).toBeNull();
  });

  it('saving a new identity does not clear the code (persona kept → code kept)', () => {
    // Token rotation keeps the persona, so the code (bound to the user record,
    // not the token) must survive an identity save.
    saveIdentity({ roomAddress: '0xroom', userAddress: '0xme', token: 'old' });
    saveMutualCode('0xme', 'one-time-code');
    saveIdentity({ roomAddress: '0xroom', userAddress: '0xme', token: 'new' });
    expect(get(mutualCode)).toEqual({ userAddress: '0xme', code: 'one-time-code' });
    expect(localStorage.getItem('bleak.mutualCode')).not.toBeNull();
  });

  it('a fresh init after reload restores identity + code in order', () => {
    saveIdentity({ roomAddress: '0xroom', userAddress: '0xme', token: 't' });
    saveMutualCode('0xme', 'one-time-code');
    identity.set(null);
    mutualCode.set(null);
    initIdentity();
    initMutualCode();
    expect(get(identity)?.userAddress).toBe('0xme');
    expect(get(mutualCode)).toEqual({ userAddress: '0xme', code: 'one-time-code' });
  });
});
