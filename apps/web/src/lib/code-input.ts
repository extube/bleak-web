/** Join-code input helpers shared by the DigitInput cells and the join flow. */

const CODE_LENGTH = 6;

/**
 * Strip every non-digit (invalid characters are rejected silently, §3.1)
 * and cap at the 6-digit invite-code length.
 */
export function sanitizeDigits(input: string, max: number = CODE_LENGTH): string {
  return input.replace(/\D+/g, '').slice(0, max);
}

/** True when the string is exactly `max` digits (CTA enable condition). */
export function isCompleteCode(value: string, max: number = CODE_LENGTH): boolean {
  return value.length === max && /^\d+$/.test(value);
}
