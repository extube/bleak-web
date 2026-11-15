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

  it('drops a token-less identity saved by the v1 flow on the next fresh init', () => {
    // Shim-period saveIdentity without a token (v1 join flow): the blob is
    // written as-is, but never survives a reload.
    saveIdentity({ roomAddress: '0xroom', userAddress: '0xme' });
    expect(get(identity)).not.toBeNull();
    identity.set(null); // simulate reload: fresh module state, store empty
    initIdentity();
    expect(get(identity)).toBeNull();
    expect(localStorage.getItem('bleak.identity')).toBeNull();
  });
});
