/**
 * Landing video PING-PONG seek-stepping (DESIGN §4.27.E, Concept §39.4) —
 * the pure, testable seam of the background video's yo-yo playback.
 *
 * The §4.23.A background video used to rely on the native `loop` attribute;
 * §4.27.E replaces plain looping with a continuous yo-yo: forward → (end)
 * → reverse stepping → (start) → forward → … The reverse pass is driven by
 * rAF seek-stepping on a PAUSED element (negative `playbackRate` is
 * browser-unreliable — none is used; the wall-clock delta runs at 1× in
 * both directions, so the reverse pass takes the same time as the forward
 * one, seconds-per-pass = the clip's duration).
 *
 * This module holds the END-HANDLING state transition as a pure, total
 * function: clamp at both ends and flip the direction there — no dwell.
 * Hand-rolled, zero dependencies (the `sectionArt.ts` local-module
 * precedent). The rAF stepper that consumes it lives in
 * LandingVideoHero.svelte.
 */

/** The stepper's direction: +1 forward, −1 reverse. Starts at 1. */
export type PlayDirection = 1 | -1;

/**
 * One step of the ping-pong: advance `t` by `delta × dir` and clamp+flip
 * at the ends — at `t ≥ duration` the time clamps to `duration` and the
 * direction flips to −1; at `t ≤ 0` it clamps to 0 and flips to +1.
 * Mid-range candidates pass through unchanged (same direction). The input
 * is never mutated; the result is a new `{ time, dir }` pair.
 */
export function stepTime(
  t: number,
  dir: PlayDirection,
  delta: number,
  duration: number
): { time: number; dir: PlayDirection } {
  let time = t + dir * delta;
  let nextDir: PlayDirection = dir;
  if (time >= duration) {
    time = duration;
    nextDir = -1;
  } else if (time <= 0) {
    time = 0;
    nextDir = 1;
  }
  return { time, dir: nextDir };
}
