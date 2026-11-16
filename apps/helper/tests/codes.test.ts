/** 6-digit invite-code validation (v2: validator only — minting moved to
 * bleak-node, ARCHITECTURE §10.10). */
import { describe, expect, it } from 'vitest';
import { isValidCode } from '../src/codes.js';

describe('6-digit invite codes (validator)', () => {
  it('validates strictly', () => {
    expect(isValidCode('000000')).toBe(true);
    expect(isValidCode('999999')).toBe(true);
    expect(isValidCode('123456')).toBe(true);
    expect(isValidCode('12345')).toBe(false);
    expect(isValidCode('1234567')).toBe(false);
    expect(isValidCode('12345a')).toBe(false);
    expect(isValidCode('')).toBe(false);
    expect(isValidCode('0x1234')).toBe(false);
  });
});
