/**
 * Avatar trait derivation tests (TZ-02): FNV-1a determinism and trait
 * bounds (DESIGN §4.3).
 */
import { describe, expect, it } from 'vitest';
import { deriveTraits, fnv1a, isParseableAddress, TRAIT_COUNTS } from '../src/lib/avatar/traits';

describe('fnv1a', () => {
  it('is deterministic', () => {
    expect(fnv1a('0xroom123')).toBe(fnv1a('0xroom123'));
  });

  it('matches the known FNV-1a 32-bit vectors', () => {
    // Standard test vectors for 32-bit FNV-1a (xor-then-multiply).
    expect(fnv1a('')).toBe(0x811c9dc5);
    expect(fnv1a('a')).toBe(0xe40c292c);
    expect(fnv1a('foobar')).toBe(0xbf9cf968);
  });

  it('returns an unsigned 32-bit integer', () => {
    for (const input of ['', 'x', '0xuser42', 'Тест']) {
      const hash = fnv1a(input);
      expect(hash).toBeGreaterThanOrEqual(0);
      expect(hash).toBeLessThanOrEqual(0xffffffff);
      expect(Number.isInteger(hash)).toBe(true);
    }
  });
});

describe('deriveTraits — determinism and bounds', () => {
  const addresses = Array.from({ length: 64 }, (_, i) => `0xuser${i}`);

  it('same address ⇒ same traits', () => {
    const first = deriveTraits('0xdeadbeef');
    const second = deriveTraits('0xdeadbeef');
    expect(second).toEqual(first);
  });

  it('different addresses may differ (sanity: not a constant)', () => {
    const traits = addresses.map(deriveTraits);
    const distinct = new Set(traits.map((t) => JSON.stringify(t)));
    expect(distinct.size).toBeGreaterThan(1);
  });

  it('every trait stays inside its palette bound', () => {
    for (const address of [...addresses, '', '0x', 'Тестовая персона', 'a'.repeat(100)]) {
      const t = deriveTraits(address);
      expect(t.skin).toBeGreaterThanOrEqual(0);
      expect(t.skin).toBeLessThan(TRAIT_COUNTS.skin);
      expect(t.hairstyle).toBeGreaterThanOrEqual(0);
      expect(t.hairstyle).toBeLessThan(TRAIT_COUNTS.hairstyle);
      expect(t.hairColor).toBeGreaterThanOrEqual(0);
      expect(t.hairColor).toBeLessThan(TRAIT_COUNTS.hairColor);
      expect(t.facialHair).toBeGreaterThanOrEqual(0);
      expect(t.facialHair).toBeLessThan(TRAIT_COUNTS.facialHair);
      expect(t.glasses).toBeGreaterThanOrEqual(0);
      expect(t.glasses).toBeLessThan(TRAIT_COUNTS.glasses);
      expect(t.backdrop).toBeGreaterThanOrEqual(0);
      expect(t.backdrop).toBeLessThan(TRAIT_COUNTS.backdrop);
    }
  });

  it('covers the documented palette sizes', () => {
    expect(TRAIT_COUNTS).toEqual({
      skin: 4,
      hairstyle: 8,
      hairColor: 5,
      facialHair: 4,
      glasses: 3,
      backdrop: 5
    });
  });
});

describe('isParseableAddress — pixel-ghost fallback condition', () => {
  it('accepts non-empty addresses', () => {
    expect(isParseableAddress('0xroom123')).toBe(true);
    expect(isParseableAddress('x')).toBe(true);
  });

  it('rejects empty, blank and missing addresses', () => {
    expect(isParseableAddress('')).toBe(false);
    expect(isParseableAddress('   ')).toBe(false);
    expect(isParseableAddress(null)).toBe(false);
    expect(isParseableAddress(undefined)).toBe(false);
  });
});
