/**
 * Pure helpers for the `/host/[room_address]` panel (DESIGN rev. 4 §3.7.2,
 * TZ13-03): the entry-guard predicate, the statistics-tick cadence rule
 * (§2.2 rev. 4 row: every third 5 s Poller tick ⇒ 15 s statistics), the
 * caller-side stats diff (identical ticks never re-render, §3.7.5 AC 12)
 * and the M1 bucket math (12 five-minute buckets over the past hour).
 *
 * Negative spaces kept honest (§9.4.1-c/d): no handshake read and no
 * member-deletion call exist anywhere in host code — there is deliberately
 * nothing here to call.
 */
import type { HostStats } from './stats/hostStats';

/**
 * Panel guard (§3.7.2): the stored `bleak.hostRoom` must exist AND its
 * `roomAddress` must equal the URL's `[room_address]` param; a missing or
 * mismatched entry redirects to `/host` (the caller navigates).
 */
export function guardRoomAddress(
  stored: { roomAddress: string } | null,
  param: string | undefined
): boolean {
  return stored !== null && param !== undefined && stored.roomAddress === param;
}

/** Statistics cadence (§2.2): every third 5 s tick of the page Poller. */
export function isStatsTick(tick: number): boolean {
  return tick % 3 === 0;
}

/**
 * Caller-side stats diff (§3.7.5 AC 12): a poll tick that computed
 * identical stats does not replace the current object — the caller keeps
 * the previous reference so Svelte never re-renders the panel.
 */
export function statsEqual(a: HostStats | null, b: HostStats | null): boolean {
  if (a === b) return true;
  if (a === null || b === null) return false;
  if (a.members !== b.members || a.chats !== b.chats) return false;
  if (a.active !== b.active || a.finished !== b.finished) return false;
  if (a.total !== b.total || a.partial !== b.partial) return false;
  if (a.buckets.length !== b.buckets.length) return false;
  for (let i = 0; i < a.buckets.length; i += 1) {
    if (a.buckets[i] !== b.buckets[i]) return false;
  }
  return true;
}

/** M1 bucketing (§54.3): index 0 = 60…55 min ago … 11 = now. */
export function bucketIndex(createdAt: string, now: number): number {
  const at = Date.parse(createdAt);
  if (!Number.isFinite(at)) return -1;
  if (at > now) return 11; // clock skew into the future lands in «сейчас»
  const ageMinutes = (now - at) / 60_000;
  const step = Math.floor(ageMinutes / 5);
  if (step >= 12) return -1; // older than the past hour — not charted
  return 11 - step;
}

/** Fold message `created_at` stamps into the 12 buckets (M1). */
export function bucketize(createdAts: readonly string[], now: number): number[] {
  const buckets = new Array<number>(12).fill(0);
  for (const createdAt of createdAts) {
    const index = bucketIndex(createdAt, now);
    if (index >= 0) buckets[index] = (buckets[index] ?? 0) + 1;
  }
  return buckets;
}

export function bucketTotal(buckets: readonly number[]): number {
  return buckets.reduce((sum, n) => sum + n, 0);
}

/** Index of the tallest bucket (first max wins for determinism). */
export function peakBucketIndex(buckets: readonly number[]): number {
  let peak = 0;
  for (let i = 1; i < buckets.length; i += 1) {
    if ((buckets[i] ?? 0) > (buckets[peak] ?? 0)) peak = i;
  }
  return peak;
}

/** The 5 labeled bucket positions (every 3rd bucket + now), §3.7.5. */
const LABEL_POSITIONS: readonly [0, 3, 6, 9, 11] = [0, 3, 6, 9, 11];

/**
 * The relative axis label naming the peak bucket in the summary
 * aria-label — mapped to the NEAREST of the five labeled positions.
 */
export function peakBucketLabel(
  buckets: readonly number[],
  labels: readonly [string, string, string, string, string]
): string {
  const peak = peakBucketIndex(buckets);
  let best = 0;
  let bestDist = Math.abs(peak - LABEL_POSITIONS[0]);
  for (let slot = 1; slot < LABEL_POSITIONS.length; slot += 1) {
    const dist = Math.abs(peak - (LABEL_POSITIONS[slot] ?? 0));
    if (dist < bestDist) {
      best = slot;
      bestDist = dist;
    }
  }
  return labels[best] ?? labels[0] ?? '';
}
