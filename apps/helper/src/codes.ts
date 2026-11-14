/**
 * 6-digit invite codes.
 *
 * The invite code is NOT the room address (owner decision in Concept.md §1):
 * QR payloads and attendee input carry the code; the helper maps it back to
 * the bleak-node room address. Codes are cryptographically random, zero-padded
 * to 6 digits, and validated by a strict format check before any DB lookup.
 */
import { randomInt } from 'node:crypto';

export const CODE_PATTERN = /^\d{6}$/;

export function generateCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

export function isValidCode(code: string): boolean {
  return CODE_PATTERN.test(code);
}
