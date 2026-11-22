/**
 * Mascot-chat animation timeline (DESIGN §4.20.F, Concept §32 owner
 * addition): derives the pixel speech-bubble exchange schedule from the
 * rendered bubble strings and emits the CSS keyframes that run it.
 *
 * This module is the animation's ONLY JS — a one-shot, pure computation
 * (no timers, no rAF, no continuous loop; §4.15.C-6a). The component feeds
 * the current locale's four bubble texts, gets back the per-turn schedule
 * and a `@keyframes` sheet; the CSS `steps(var(--chars))` clip-reveal does
 * the typewriter, `animation-iteration-count: infinite` the loop.
 *
 * Timing (per turn): pop-in 160ms ease-out → typewriter 55ms/char → hold
 * 900ms. A long turn is clamped at 3.4s total (the hold shrinks). After
 * turn 4 every bubble has faded and the strip rests 400ms before the loop
 * restarts. The loop duration is content-derived (RU/EN differ).
 */

/** 55ms per character (the §4.20.F typewriter rate). */
const MS_PER_CHAR = 55;
/** Pop-in entrance (§4.6). */
const POP_MS = 160;
/** Hold after the reveal finishes. */
const HOLD_MS = 900;
/** Long-turn cap (hold shrinks when the typewriter alone eats the budget). */
const TURN_CAP_MS = 3400;
/** Fade-out of the previous bubble when the next turn pops (§4.20.F silent). */
const TURN_FADE_MS = 200;
/** End-of-loop: all bubbles fade out, then the strip rests, then restart. */
const LOOP_FADE_MS = 600;
const LOOP_REST_MS = 400;

export type ChatSpeaker = 'pip' | 'glitch';

export interface ChatBubbleSpec {
  from: ChatSpeaker;
  text: string;
}

export interface ChatTimelineTurn extends ChatBubbleSpec {
  /** Characters in the rendered string (drives `--chars` / steps()). */
  chars: number;
  /** Typewriter reveal duration: 55ms × chars, safety-clamped to the turn. */
  typeMs: number;
  /** Full turn duration: pop + reveal + hold, clamped at 3.4s. */
  turnMs: number;
  /** Turn start offset inside the loop. */
  startMs: number;
}

export interface ChatTimeline {
  turns: ChatTimelineTurn[];
  /** Content-derived total loop duration (fade + rest included). */
  loopMs: number;
  /** The locale-dependent `@keyframes` sheet (lp-pop-N / lp-type-N). */
  keyframesCss: string;
}

/** Turn start → percentage stop inside the loop (4 decimals is plenty). */
function pct(ms: number, loopMs: number): string {
  const value = +((ms / loopMs) * 100).toFixed(4);
  return `${value}%`;
}

export function buildChatTimeline(specs: readonly ChatBubbleSpec[]): ChatTimeline {
  const turns: ChatTimelineTurn[] = [];
  let start = 0;
  for (const spec of specs) {
    const chars = spec.text.length;
    const revealMs = chars * MS_PER_CHAR;
    const turnMs = Math.min(POP_MS + revealMs + HOLD_MS, TURN_CAP_MS);
    // The reveal always fits its turn: clamp only against absurd lengths
    // (leaves at least the pop and a 160ms hold).
    const typeMs = Math.max(Math.min(revealMs, turnMs - POP_MS - 160), MS_PER_CHAR);
    turns.push({ ...spec, chars, typeMs, turnMs, startMs: start });
    start += turnMs;
  }
  const last = turns[turns.length - 1];
  const lastEnd = last ? last.startMs + last.turnMs : 0;
  const loopMs = lastEnd + LOOP_FADE_MS + LOOP_REST_MS;

  const parts: string[] = [];
  turns.forEach((turn, i) => {
    const s = turn.startMs;
    const e = s + turn.turnMs;
    const last = i === turns.length - 1;
    // Box: hidden until the turn, pop-in, hold, fade (the last bubble
    // carries the loop-end fade; earlier ones hand over to the next turn).
    const holdEnd = last ? e : e - TURN_FADE_MS;
    const fadeEnd = last ? loopMs - LOOP_REST_MS : e;
    parts.push(
      `@keyframes lp-pop-${i}{` +
        `0%,${pct(s, loopMs)}{opacity:0;transform:scale(.6)}` +
        `${pct(s + POP_MS, loopMs)}{opacity:1;transform:scale(1);animation-timing-function:ease-out}` +
        `${pct(holdEnd, loopMs)}{opacity:1;transform:scale(1)}` +
        `${pct(fadeEnd, loopMs)}{opacity:0;transform:scale(1)}` +
        `100%{opacity:0;transform:scale(1)}}`
    );
    // Text: clip-reveal typewriter over steps(var(--chars)) — the variable
    // is set inline per bubble from its rendered string length.
    parts.push(
      `@keyframes lp-type-${i}{` +
        `0%,${pct(s + POP_MS, loopMs)}{clip-path:inset(0 100% 0 0);animation-timing-function:steps(var(--chars))}` +
        `${pct(s + POP_MS + turn.typeMs, loopMs)}{clip-path:inset(0 0 0 0)}` +
        `100%{clip-path:inset(0 0 0 0)}}`
    );
  });

  return { turns, loopMs, keyframesCss: parts.join('') };
}
