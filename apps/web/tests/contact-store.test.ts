/** Contact card + shared-pair stores (DESIGN §4.13.3, Concept §13.1.3):
 * the LOCAL contact-card field (≤255 symbols, per room|user under
 * `bleak.contactCard` — no backend user field), corrupt-storage tolerance,
 * and the shared-pair marks (`bleak.contactShared`, scope room|user(me) →
 * counterpart → ISO time) that land the share slide in the shared state
 * after a 201 or the once-per-pair 409 (server truth — the mark is a
 * per-device convenience). */
import { afterEach, describe, expect, it } from 'vitest';
import {
  MAX_CONTACT_CARD,
  clearContactCard,
  clearSharedPairs,
  isPairShared,
  loadContactCard,
  loadSharedPairs,
  markPairShared,
  saveContactCard
} from '../src/lib/stores/contactCard';

const ROOM = '0xroom';
const ME = '0xme';
const OTHER = '0xother';

afterEach(() => {
  localStorage.clear();
});

describe('contact card persistence (per room + user)', () => {
  it('saves and restores the card text, trimmed, per room|user scope', () => {
    expect(saveContactCard(ROOM, ME, '  telegram: @me  ')).toBe('telegram: @me');
    expect(loadContactCard(ROOM, ME)).toBe('telegram: @me');
    expect(JSON.parse(localStorage.getItem('bleak.contactCard') ?? '{}')).toMatchObject({
      '0xroom|0xme': 'telegram: @me'
    });
  });

  it('scopes the card per room+user — other personas are untouched', () => {
    saveContactCard(ROOM, ME, 'telegram: @me');
    saveContactCard(ROOM, OTHER, 'phone: +7…');
    expect(loadContactCard(ROOM, ME)).toBe('telegram: @me');
    expect(loadContactCard(ROOM, OTHER)).toBe('phone: +7…');
    expect(loadContactCard('0xother-room', ME)).toBe('');
  });

  it('clamps to the 255-symbol cap (the tz5-01 pre-flight never trips)', () => {
    const saved = saveContactCard(ROOM, ME, 'x'.repeat(300));
    expect(saved).toHaveLength(MAX_CONTACT_CARD);
    expect(loadContactCard(ROOM, ME)).toHaveLength(MAX_CONTACT_CARD);
  });

  it('saving an empty (or whitespace-only) text clears the scope', () => {
    saveContactCard(ROOM, ME, 'telegram: @me');
    expect(saveContactCard(ROOM, ME, '   ')).toBe('');
    expect(loadContactCard(ROOM, ME)).toBe('');
    expect(localStorage.getItem('bleak.contactCard')).toBe('{}');
  });

  it('clearContactCard empties only the matching scope', () => {
    saveContactCard(ROOM, ME, 'telegram: @me');
    saveContactCard(ROOM, OTHER, 'phone: +7…');
    clearContactCard(ROOM, ME);
    expect(loadContactCard(ROOM, ME)).toBe('');
    expect(loadContactCard(ROOM, OTHER)).toBe('phone: +7…');
  });

  it('tolerates corrupt JSON and non-object values', () => {
    localStorage.setItem('bleak.contactCard', '{oops');
    expect(loadContactCard(ROOM, ME)).toBe('');
    localStorage.setItem('bleak.contactCard', '["array"]');
    expect(loadContactCard(ROOM, ME)).toBe('');
    localStorage.setItem('bleak.contactCard', 'null');
    expect(loadContactCard(ROOM, ME)).toBe('');
  });
});

describe('shared-pair marks (per room + user, after 201 / 409)', () => {
  it('isPairShared is false before any mark; markPairShared records the pair', () => {
    expect(isPairShared(ROOM, ME, '0xa')).toBe(false);
    markPairShared(ROOM, ME, '0xa');
    expect(isPairShared(ROOM, ME, '0xa')).toBe(true);
    expect(loadSharedPairs(ROOM, ME)).toEqual(new Set(['0xa']));
    expect(JSON.parse(localStorage.getItem('bleak.contactShared') ?? '{}')).toMatchObject({
      '0xroom|0xme': { '0xa': expect.any(String) }
    });
  });

  it('scopes marks per room+user(me) and per counterpart', () => {
    markPairShared(ROOM, ME, '0xa');
    markPairShared(ROOM, OTHER, '0xb');
    expect(isPairShared(ROOM, ME, '0xa')).toBe(true);
    expect(isPairShared(ROOM, ME, '0xb')).toBe(false);
    expect(isPairShared(ROOM, OTHER, '0xa')).toBe(false);
    expect(isPairShared(ROOM, OTHER, '0xb')).toBe(true);
    expect(isPairShared('0xother-room', ME, '0xa')).toBe(false);
  });

  it('marking twice does not overwrite the original ISO time', () => {
    markPairShared(ROOM, ME, '0xa');
    const first = JSON.parse(localStorage.getItem('bleak.contactShared') ?? '{}')[
      '0xroom|0xme'
    ]['0xa'];
    markPairShared(ROOM, ME, '0xa');
    const second = JSON.parse(localStorage.getItem('bleak.contactShared') ?? '{}')[
      '0xroom|0xme'
    ]['0xa'];
    expect(second).toBe(first);
  });

  it('clearSharedPairs empties only the matching scope', () => {
    markPairShared(ROOM, ME, '0xa');
    markPairShared(ROOM, OTHER, '0xb');
    clearSharedPairs(ROOM, ME);
    expect(loadSharedPairs(ROOM, ME).size).toBe(0);
    expect(loadSharedPairs(ROOM, OTHER).size).toBe(1);
  });

  it('tolerates corrupt storage', () => {
    localStorage.setItem('bleak.contactShared', '{oops');
    expect(loadSharedPairs(ROOM, ME).size).toBe(0);
    expect(isPairShared(ROOM, ME, '0xa')).toBe(false);
  });
});
