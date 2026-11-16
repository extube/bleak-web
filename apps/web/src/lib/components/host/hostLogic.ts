/**
 * Pure helpers for the v2 /host console (TZ2-07 Part B, DESIGN rev. 3 §3.7).
 * Unit-tested in tests/host-console.test.ts.
 *
 * v2: the console ships COUNTS-LESS (AC 11 — no handshake sent/received
 * counts anywhere; flag 6.9a has no viable endpoint). The invite link is
 * computed client-side from the code (ARCHITECTURE §10.9).
 */

/** Screen-reader spelling of the 6-digit code («Код: 1 2 3 4 5 6», §3.7). */
export function spelledDigits(code: string): string {
  return code.split('').join(' ');
}

/** `{base}/?code={code}` — the client-computed invite link (§10.9). */
export function inviteLink(code: string, base: string): string {
  return `${base.replace(/\/+$/, '')}/?code=${encodeURIComponent(code)}`;
}

/** The three expiry presets, in ms from now (24 h pre-selected default). */
export type ExpiryPreset = '1h' | '24h' | '7d';

export function presetExpiry(preset: ExpiryPreset, now: number): string {
  const hours = preset === '1h' ? 1 : preset === '24h' ? 24 : 24 * 7;
  return new Date(now + hours * 3_600_000).toISOString();
}

/** A minted code may be custom-expired: «Своё время…» → the datetime-local ISO. */
export function customExpiry(localValue: string, now: number): string | null {
  const at = Date.parse(localValue);
  if (!Number.isFinite(at)) return null;
  // A custom expiry in the past is meaningless — reject it (the UI keeps the
  // input invalid; min = now is enforced in the chooser).
  if (at <= now) return null;
  return new Date(at).toISOString();
}

/** Active codes only: expired entries never render (§3.7 AC 8). */
export interface InviteView {
  code: string;
  created_at: string;
  expires_at: string;
}

export function activeInvites<T extends InviteView>(invites: readonly T[], now: number): T[] {
  return invites
    .filter((invite) => Date.parse(invite.expires_at) > now)
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
}

/** «истекает через {time}» — minute/hour/day buckets (§3.7 invite rows). */
export function expiresIn(expiresAt: string, now: number): string {
  const diff = Date.parse(expiresAt) - now;
  if (!Number.isFinite(diff) || diff <= 0) return '0';
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 60) return String(minutes);
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return String(hours);
  return String(Math.floor(hours / 24));
}
