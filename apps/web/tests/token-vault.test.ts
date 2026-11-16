/** tokenVault store tests (TZ2-04, ARCHITECTURE §10.4): append-only vault of
 * personas created on this device, keyed `bleak.tokenVault`; the only
 * in-place mutation is token rotation; no remove API exists. */
import { beforeEach, describe, expect, it } from 'vitest';
import { get } from 'svelte/store';
import * as vault from '../src/lib/stores/tokenVault';
import type { VaultEntry } from '../src/lib/stores/tokenVault';

const { appendVaultEntry, initTokenVault, listVaultEntries, tokenVault, updateVaultEntryToken } =
  vault;

function entry(overrides: Partial<VaultEntry> = {}): VaultEntry {
  return {
    roomAddress: '0xroom-old',
    userAddress: '0xme',
    token: 'persona-token',
    savedAt: '2026-11-15T10:00:00.000Z',
    ...overrides
  };
}

beforeEach(() => {
  localStorage.clear();
  tokenVault.set([]);
});

describe('tokenVault — persistence round-trip', () => {
  it('appends an entry and lists it back', () => {
    appendVaultEntry(entry());
    expect(listVaultEntries()).toEqual([entry()]);
    expect(JSON.parse(localStorage.getItem('bleak.tokenVault') ?? '[]')).toEqual([entry()]);
  });

  it('appends without removing: two entries coexist', () => {
    appendVaultEntry(entry({ roomAddress: '0xroom-old' }));
    appendVaultEntry(entry({ roomAddress: '0xroom-new', token: 'token-2' }));
    const listed = listVaultEntries();
    expect(listed).toHaveLength(2);
    expect(listed[0]).toEqual(entry({ roomAddress: '0xroom-old' }));
    expect(listed[1]).toEqual(entry({ roomAddress: '0xroom-new', token: 'token-2' }));
  });

  it('an optional name is persisted', () => {
    appendVaultEntry(entry({ name: 'Поттер' }));
    expect(listVaultEntries()[0]).toEqual(entry({ name: 'Поттер' }));
  });

  it('init hydrates the store from storage', () => {
    localStorage.setItem('bleak.tokenVault', JSON.stringify([entry()]));
    tokenVault.set([]);
    initTokenVault();
    expect(get(tokenVault)).toEqual([entry()]);
  });

  it('tolerates corrupted or non-array storage', () => {
    localStorage.setItem('bleak.tokenVault', '{oops');
    expect(listVaultEntries()).toEqual([]);

    localStorage.setItem('bleak.tokenVault', '{"roomAddress":"0xroom"}');
    expect(listVaultEntries()).toEqual([]);
  });

  it('filters structurally invalid entries out of storage', () => {
    localStorage.setItem(
      'bleak.tokenVault',
      JSON.stringify([entry(), { roomAddress: '0xroom', userAddress: '0xme' }])
    );
    expect(listVaultEntries()).toEqual([entry()]);
  });
});

describe('tokenVault — token rotation (in place, append-only)', () => {
  it('rewrites only the matching entry token, preserving every other field', () => {
    const a = entry({ roomAddress: '0xroom-a', userAddress: '0xme', token: 'old-a' });
    const b = entry({
      roomAddress: '0xroom-b',
      userAddress: '0xthem',
      token: 'old-b',
      name: 'Борис',
      savedAt: '2026-11-15T11:00:00.000Z'
    });
    appendVaultEntry(a);
    appendVaultEntry(b);

    updateVaultEntryToken('0xroom-b', '0xthem', 'new-b');

    const listed = listVaultEntries();
    expect(listed).toHaveLength(2);
    expect(listed[0]).toEqual(a); // untouched
    expect(listed[1]).toEqual({ ...b, token: 'new-b' }); // only the token changed
    expect(JSON.parse(localStorage.getItem('bleak.tokenVault') ?? '[]')).toEqual([
      a,
      { ...b, token: 'new-b' }
    ]);
  });

  it('is a no-op — nothing written — when no entry matches', () => {
    appendVaultEntry(entry());
    const before = localStorage.getItem('bleak.tokenVault');
    updateVaultEntryToken('0xroom-other', '0xme', 'new-token');
    expect(localStorage.getItem('bleak.tokenVault')).toBe(before);
    expect(listVaultEntries()).toEqual([entry()]);
  });
});

describe('tokenVault — append-only invariant', () => {
  it('exports no mutator that can delete or clear entries', () => {
    const runtimeExports = Object.keys(vault);
    const mutators = runtimeExports.filter((name) =>
      /remove|delete|clear|drop|purge/i.test(name)
    );
    expect(mutators).toEqual([]);
  });

  it('rotation never changes the number of entries', () => {
    appendVaultEntry(entry({ roomAddress: '0xroom-a' }));
    appendVaultEntry(entry({ roomAddress: '0xroom-b', token: 'b' }));
    updateVaultEntryToken('0xroom-a', '0xme', 'rotated');
    expect(listVaultEntries()).toHaveLength(2);
  });
});
