/**
 * The shared scroll-reveal system (DESIGN §4.30.A — Concept §42 item 1,
 * tz12-13, 2026-11-23): every landing block below the fold reveals as it
 * enters the viewport; the §37 open-state pair (lead + BLEAK, marked with
 * `data-reveal-load`) animates ON LOAD instead of on scroll.
 *
 * Contract:
 * - The hidden state exists ONLY under `[data-reveal='armed']` (the base.css
 *   rules) — a state THIS utility applies at mount, so it exists only when
 *   (a) JS ran and (b) animation is possible. No-JS, a crash or a missing
 *   IntersectionObserver ⇒ no arming ⇒ every block fully visible.
 * - Reduced motion ⇒ NO arming and NO observer — every block (including the
 *   hero pair) is visible immediately (the §4.27.D reduced-motion check).
 * - ONE shared IntersectionObserver (threshold 0.15,
 *   rootMargin '0px 0px -48px 0px') watches every scroll unit; the FIRST
 *   intersection reveals and unobserves — one-shot, scrolling away and back
 *   never replays (the §4.27.D compat-circle precedent).
 * - Sibling groups stagger: the three `.step-block`s at 0/60/120ms, the four
 *   `.usecase-pill`s at 0/60/120/180ms (60ms per sibling, capped at 180) via
 *   the inline `--reveal-delay` custom property; single units get no delay.
 * - After the reveal completes (transitionend, with a 720ms fallback timer
 *   for transition-less DOMs) BOTH the `is-revealed` class and the
 *   `data-reveal` attribute are REMOVED — the block ends in its natural
 *   state, so the hover CSS (`.step-block:hover`'s translateY(-4px)) can
 *   never fight a leftover attribute-selector transform.
 * - The teardown disconnects the observer and cancels the pending
 *   cleanups/rAF (the `$effect` cleanup in +page.svelte — no leak across
 *   HMR/tests).
 * - The §4.27.D compat ring is INDEPENDENT: it keeps its own one-shot
 *   count-up observer (threshold 0.4) — no shared state with this system.
 */

const STAGGER_STEP_MS = 60;
const STAGGER_CAP_MS = 180;
const CLEANUP_FALLBACK_MS = 720;

/** The reduced-motion guard (the explicit matchMedia check — the §4.27.D
 * precedent; the base.css catch-all only intercepts CSS). */
function reducedMotion(): boolean {
  return (
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

export function setupReveals(root: ParentNode): () => void {
  // Reduced motion = NO animation: nothing is armed, nothing is observed —
  // every block is fully visible from the first paint (§4.30.I).
  if (reducedMotion()) return () => {};
  // Old browsers / test DOM without IntersectionObserver: the mount
  // fallback — nothing is armed, everything visible (§4.30.A.2).
  if (typeof IntersectionObserver !== 'function') return () => {};

  const teardowns: Array<() => void> = [];

  /* The one-shot cleanup: after the reveal completes BOTH the class and
   * the attribute are stripped (transitionend, with a 720ms fallback
   * timer for transition-less DOMs — §4.30.A.4). */
  function scheduleCleanup(unit: HTMLElement): void {
    let done = false;
    const finish = (): void => {
      if (done) return;
      done = true;
      unit.classList.remove('is-revealed');
      unit.removeAttribute('data-reveal');
      unit.style.removeProperty('--reveal-delay');
      unit.removeEventListener('transitionend', finish);
    };
    unit.addEventListener('transitionend', finish);
    const timer = window.setTimeout(finish, CLEANUP_FALLBACK_MS);
    teardowns.push(() => {
      window.clearTimeout(timer);
      unit.removeEventListener('transitionend', finish);
    });
  }

  /* The one-shot ledger: a late duplicate entry never replays the reveal. */
  const revealed = new WeakSet<HTMLElement>();

  function reveal(unit: HTMLElement): void {
    if (revealed.has(unit)) return;
    revealed.add(unit);
    unit.classList.add('is-revealed');
    scheduleCleanup(unit);
  }

  /* The group stagger: per-index --reveal-delay inside the step row and
   * the use-case row (60ms per sibling, capped at 180 — §4.30.A.5). */
  const groups = Array.from(root.querySelectorAll<HTMLElement>('.steps, .usecase-row'));
  for (const group of groups) {
    const members = Array.from(group.children).filter(
      (el): el is HTMLElement => el instanceof HTMLElement && el.hasAttribute('data-reveal')
    );
    members.forEach((unit, index) => {
      if (index > 0) {
        unit.style.setProperty(
          '--reveal-delay',
          `${Math.min(index * STAGGER_STEP_MS, STAGGER_CAP_MS)}ms`
        );
      }
    });
  }

  /* Arm every scroll unit — the ONLY moment anything hides — and watch
   * them with ONE shared one-shot IntersectionObserver (§4.30.A.3). */
  const units = Array.from(root.querySelectorAll<HTMLElement>('[data-reveal]'));
  for (const unit of units) unit.setAttribute('data-reveal', 'armed');

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const unit = entry.target as HTMLElement;
        if (revealed.has(unit)) continue; // one-shot: never replay
        observer.unobserve(unit); // one-shot: scrolling away and back never replays
        reveal(unit);
      }
    },
    { threshold: 0.15, rootMargin: '0px 0px -48px 0px' }
  );
  for (const unit of units) observer.observe(unit);
  teardowns.push(() => observer.disconnect());

  /* The §37 open-state pair — the lead + the BLEAK card — animates ON
   * LOAD, not on scroll (§4.30.B): armed at mount, .is-revealed one
   * animation frame later (the initial styles must commit first), then
   * the same cleanup. Under reduced motion or without JS/IO the hero
   * pair is simply visible from the first paint. */
  const heroes = Array.from(root.querySelectorAll<HTMLElement>('[data-reveal-load]'));
  for (const hero of heroes) {
    hero.setAttribute('data-reveal', 'armed');
    const raf = requestAnimationFrame(() => reveal(hero));
    teardowns.push(() => cancelAnimationFrame(raf));
  }

  return () => {
    for (const teardown of teardowns) teardown();
  };
}
