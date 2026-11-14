import { describe, expect, it } from 'vitest';
import { generateCode, isValidCode } from '../src/codes.js';

describe('6-digit invite codes', () => {
  it('generates zero-padded 6-digit codes', () => {
    for (let i = 0; i < 200; i++) {
      const code = generateCode();
      expect(code).toMatch(/^\d{6}$/);
      expect(code.length).toBe(6);
    }
  });

  it('produces codes across the whole range (not biased to high numbers)', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 5000; i++) seen.add(generateCode());
    const low = [...seen].filter((c) => Number(c) < 500_000);
    expect(low.length).toBeGreaterThan(1000);
  });

  it('validates strictly', () => {
    expect(isValidCode('000000')).toBe(true);
    expect(isValidCode('999999')).toBe(true);
    expect(isValidCode('12345')).toBe(false);
    expect(isValidCode('1234567')).toBe(false);
    expect(isValidCode('12345a')).toBe(false);
    expect(isValidCode('')).toBe(false);
    expect(isValidCode('0x1234')).toBe(false);
  });
});
