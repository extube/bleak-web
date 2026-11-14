/** Join-flow helpers shared by the join screen and the room resolver. */

const CODE_PATTERN = /^\d{6}$/;

/** The 6-digit invite code is not the room address (Concept §1). */
export function isValidInviteCode(code: string): boolean {
  return CODE_PATTERN.test(code);
}
