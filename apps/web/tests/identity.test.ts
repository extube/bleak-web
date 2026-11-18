/** identity store tests (TZ2-04, ARCHITECTURE §10.4): the identity carries
 * the persona token under `bleak.identity` only; a persisted v1 identity
 * without a token is dropped at init (legacy personas predate credentials and
 * are unrecoverable — owner decision, §6.1); clearIdentity clears the one-time
 * mutual code with it. */
import { beforeEach, describe, expect, it } from 'vitest';
import { get } from 'svelte/store';
import {
  clearIdentity,
  identity,
  initIdentity,
  saveIdentity
} from '../src/lib/stores/identity';

beforeEach(() => {
  localStorage.clear();
  identity.set(null);
});

describe('identity — persistence round-trip', () => {
  it('saves and restores a v2 identity with its token', () => {
    saveIdentity({ roomAddress: '0xroom', userAddress: '0xme', token: 'persona-token' });
    expect(get(identity)).toEqual({
      roomAddress: '0xroom',
      userAddress: '0xme',
      token: 'persona-token'
    });
    expect(JSON.parse(localStorage.getItem('bleak.identity') ?? '{}')).toEqual({
      roomAddress: '0xroom',
      userAddress: '0xme',
      token: 'persona-token'
    });

    identity.set(null);
    initIdentity();
    expect(get(identity)).toEqual({
      roomAddress: '0xroom',
      userAddress: '0xme',
      token: 'persona-token'
    });
  });

  it('clear removes the store value and the storage key', () => {
    saveIdentity({ roomAddress: '0xroom', userAddress: '0xme', token: 'persona-token' });
    clearIdentity();
    expect(get(identity)).toBeNull();
    expect(localStorage.getItem('bleak.identity')).toBeNull();
  });

  it('no blob or corrupted JSON restores null', () => {
    initIdentity();
    expect(get(identity)).toBeNull();

    localStorage.setItem('bleak.identity', '{oops');
    initIdentity();
    expect(get(identity)).toBeNull();
  });
});

describe('identity — return-flow restore (Concept §10.1.1, DESIGN §4.11.1)', () => {
  it('saveIdentity restores the identity from a bleak.tokenVault entry (return-to-event: identity restore, no re-creation)', () => {
    // The vault entry shape stored at join time (bleak.tokenVault).
    const vaultEntry = {
      roomAddress: '0xoldroom',
      userAddress: '0xold',
      token: 'stored-vault-token',
      name: 'Старая персона',
      savedAt: '2026-11-14T10:00:00Z'
    };
    // The return flow feeds the entry's credential fields straight into
    // saveIdentity — the extra vault metadata (name/savedAt) is dropped.
    saveIdentity({
      roomAddress: vaultEntry.roomAddress,
      userAddress: vaultEntry.userAddress,
      token: vaultEntry.token
    });
    expect(get(identity)).toEqual({
      roomAddress: '0xoldroom',
      userAddress: '0xold',
      token: 'stored-vault-token'
    });
    expect(JSON.parse(localStorage.getItem('bleak.identity') ?? '{}')).toEqual({
      roomAddress: '0xoldroom',
      userAddress: '0xold',
      token: 'stored-vault-token'
    });
  });
});

describe('identity — v1 legacy drop at init (§10.4)', () => {
  it('drops a persisted identity without a token and removes the stale blob', () => {
    localStorage.setItem(
      'bleak.identity',
      JSON.stringify({ roomAddress: '0xroom', userAddress: '0xme' })
    );
    initIdentity();
    expect(get(identity)).toBeNull();
    expect(localStorage.getItem('bleak.identity')).toBeNull();
  });

  it('keeps a live in-session identity when re-initialized over a legacy blob', () => {
    // The v1 join flow (until TZ2-07) saves a token-less identity and the
    // guarded routes re-run initIdentity on every mount: the live session
    // must survive until the next reload, where the drop applies.
    localStorage.setItem(
      'bleak.identity',
      JSON.stringify({ roomAddress: '0xroom', userAddress: '0xme' })
    );
    const live = { roomAddress: '0xroom', userAddress: '0xme', token: 'fresh-token' };
    identity.set(live);
    initIdentity();
    expect(get(identity)).toEqual(live);
    expect(localStorage.getItem('bleak.identity')).not.toBeNull();
  });

  it('drops a token-less persisted blob on the next fresh init (v1 legacy)', () => {
    // A v1-era device wrote the persona reference without a token: the blob
    // is read as legacy and dropped — earlier and quieter than waiting for
    // the first credentialed 401 (§10.4; the v2 join flow always writes a
    // token, so this simulates the stale pre-v2 storage directly).
    localStorage.setItem(
      'bleak.identity',
      JSON.stringify({ roomAddress: '0xroom', userAddress: '0xme' })
    );
    initIdentity();
    expect(get(identity)).toBeNull();
    expect(localStorage.getItem('bleak.identity')).toBeNull();
  });
});
