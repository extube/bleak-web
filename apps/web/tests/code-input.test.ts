/** Join-code helpers: silent digit sanitizing + completion check (§3.1). */
import { describe, expect, it } from 'vitest';
import { isCompleteCode, sanitizeDigits } from '../src/lib/code-input';

describe('sanitizeDigits', () => {
  it('strips every non-digit', () => {
    expect(sanitizeDigits('12a3')).toBe('123');
    expect(sanitizeDigits('абв')).toBe('');
    expect(sanitizeDigits('1 2-3')).toBe('123');
  });

  it('caps at six digits', () => {
    expect(sanitizeDigits('1234567890')).toBe('123456');
    expect(sanitizeDigits('123456')).toBe('123456');
    expect(sanitizeDigits('12345').length).toBe(5);
  });

  it('supports a custom cap', () => {
    expect(sanitizeDigits('123456', 4)).toBe('1234');
  });

  it('handles empty input', () => {
    expect(sanitizeDigits('')).toBe('');
  });
});

describe('isCompleteCode', () => {
  it('true only for exactly six digits', () => {
    expect(isCompleteCode('123456')).toBe(true);
    expect(isCompleteCode('12345')).toBe(false);
    expect(isCompleteCode('1234567')).toBe(false);
    expect(isCompleteCode('12345a')).toBe(false);
    expect(isCompleteCode('')).toBe(false);
  });
});
