
<script module lang="ts">
  /* Animated purple pixels (§4.23.A layer 3, kept verbatim from §4.21.B):
   * [x%, y%, size px, shade 0..2, delay s] — 12 dots in the three violet
   * alpha shades, steps(2) twinkle 1.6s, staggered 0–1.2s delays. The
   * percent positions are breakpoint-independent; they now map to the FULL
   * VIEWPORT (the fixed background layer, §4.23.A) — no table change. */
  const DOTS: readonly (readonly [number, number, number, 0 | 1 | 2, number])[] = [
    [5, 12, 4, 1, 0],
    [93, 16, 6, 2, 0.3],
    [8, 55, 4, 0, 0.6],
    [90, 60, 5, 1, 0.9],
    [4, 90, 5, 0, 0.2],
    [12, 95, 4, 2, 0.5],
    [88, 90, 6, 1, 0.8],
    [95, 94, 4, 0, 1.1],
    [20, 92, 5, 1, 0.4],
    [30, 96, 4, 0, 0.7],
    [70, 91, 5, 2, 1.0],
    [80, 97, 4, 1, 1.2]
  ];
  const SHADE_ALPHA = [18, 35, 60] as const;

  function dotFill(shade: 0 | 1 | 2): string {
    return `color-mix(in srgb, var(--color-deepa-4) ${SHADE_ALPHA[shade]}%, transparent)`;
  }
</script>

<script lang="ts">
  /**
   * LandingVideoHero (DESIGN §4.23.A, Concept §35 — REPURPOSED in place from
   * the §4.22.B center video block): the FIXED FULL-VIEWPORT video background
   * the whole landing scrolls over. The component owns the video element,
   * the decisive §34 attribute set, the purple-dot mesh, the dissolve
   * vignette and the error fallback — rebuilt as the fixed background layer;
   * the reminder (§4.22.C) and the play control (§4.22.B) are retired
   * (§4.23.C/§4.23.E.5 — the video is aria-hidden ambient scenery, not a
   * content surface), and the root is a prop-less decorative `<div>`.
   *
   * Renders as the FIRST child of `.landing-page`, before `.landing`.
   *
   * Fixed layer stack (bottom→top), all `position: fixed; inset: 0;`:
   * ① z 0 — the `<video>`: width/height 100%, object-fit cover,
   *   object-position 50% 50% — with `cover` the clip fills ANY viewport
   *   aspect ratio (it crops, never letterboxes). Attributes EXACTLY
   *   (decisive set, §4.27.E — the `loop` attribute is REMOVED, the
   *   ping-pong seek-stepper replaces plain looping): muted playsinline
   *   preload="metadata" disablepictureinpicture aria-hidden — NO autoplay
   *   attribute, NO native controls. Playback starts from the ONE-SHOT
   *   mount effect, still GATED on prefers-reduced-motion (no call under
   *   reduce → the video stays paused at its first frame); muted +
   *   playsinline keep the programmatic start policy-compliant. A rejected
   *   .play() is swallowed (the tint + vignette + dots state shows; there
   *   is no control to reveal — §4.23.I flag 1).
   * ② z 1 — the dissolve vignette (re-specced for the fixed full-screen
   *   layer, §4.23.A layer 2): the fixed `::after` — every viewport edge
   *   dissolves into exactly `--color-landing-bg` (no hard edge where the
   *   video meets the black page background at any viewport ratio; with
   *   cover there is no letterbox edge to hide — the vignette's job is the
   *   smooth dissolve mood + edge darkening under the floating glass
   *   panels). The same element carries the global legibility tint: a base
   *   30% wash of the page token over the video.
   * ③ z 2 — the animated purple pixels: the §4.21.B dot mesh KEPT VERBATIM
   *   (12 dots, three --color-deepa-4 alpha shades 18/35/60%, steps(2)
   *   twinkle 1.6s, staggered 0–1.2s delays), ambient over the full
   *   viewport, BELOW the content column.
   *
   * Failure degradation (§4.23.G): on the video `error` event the element
   * is hidden — the layer degrades to the static near-black treatment (the
   * --color-landing-bg page token + the vignette wash + the dots). No
   * broken-media glyph, never a blank screen, no layout shift (a fixed
   * layer cannot shift layout). No poster, no retry UI (ambient scenery; a
   * reload remounts).
   *
   * Color discipline (§4.1): existing tokens only; no new values, no canvas,
   * no animation library. API endpoints used: none.
   */
  import videoUrl from '#lib/assets/landing/background-video.mp4';
  /* §4.27.E ping-pong: the pure end-handling seam (clamp + flip at both
   * ends) — hand-rolled, zero dependencies (the sectionArt.ts precedent). */
  import { stepTime, type PlayDirection } from './videoPingPong';

  let videoEl = $state<HTMLVideoElement | null>(null);
  let failed = $state(false);

  /* ONE-SHOT mount effect: playback starts on mount, GATED on
   * prefers-reduced-motion (§4.23.A — no call under reduce → the video
   * stays paused at its first frame; the tint + vignette + dots ARE the
   * static state). A rejected .play() (autoplay blocked) is swallowed —
   * there is no control to reveal (§4.23.I flag 1).
   *
   * §4.27.E PING-PONG: when the gated one-shot .play() RESOLVES, the
   * component immediately calls video.pause() and takes over — the whole
   * yo-yo (forward included) is driven by ONE rAF seek-stepper on the
   * PAUSED element (no native-play vs stepping races; the muted +
   * playsinline .play() call is what satisfies the autoplay policy, and
   * pausing right after does not unsatisfy it). Each tick advances the
   * candidate time by the wall-clock delta × direction (1× speed — the
   * reverse pass takes the SAME wall time as the forward one); the pure
   * stepTime seam clamps and flips at the ends; currentTime is written
   * every tick. The stepper idles until `duration` is finite and > 0
   * (loadedmetadata; preload="metadata" provides it — until then the
   * element is paused at frame 0, the established pre-state); the video
   * `error` event tears it down (the §4.23.G fallback shows unchanged).
   * The rAF + listeners are cancelled/removed on unmount (no leak across
   * HMR/tests). Reduced motion: no play, no stepper (§4.23.G verbatim). */
  $effect(() => {
    const video = videoEl;
    if (!video) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let raf = 0;
    let direction: PlayDirection = 1;
    let last = 0;
    let active = false;
    let disposed = false;

    const stopStepper = (): void => {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      active = false;
    };

    const stepTick = (now: number): void => {
      /* wall-clock delta, seconds (frame-rate independent) */
      const delta = last === 0 ? 0 : (now - last) / 1000;
      last = now;
      const stepped = stepTime(video.currentTime, direction, delta, video.duration);
      direction = stepped.dir;
      video.currentTime = stepped.time;
      raf = requestAnimationFrame(stepTick);
    };

    const startStepper = (): void => {
      if (
        active ||
        disposed ||
        typeof requestAnimationFrame !== 'function' ||
        !Number.isFinite(video.duration) ||
        video.duration <= 0
      ) {
        return;
      }
      active = true;
      last = 0;
      raf = requestAnimationFrame(stepTick);
    };

    const onMetadata = (): void => startStepper();
    const onError = (): void => {
      stopStepper();
      video.removeEventListener('loadedmetadata', onMetadata);
      video.removeEventListener('error', onError);
    };

    video.addEventListener('loadedmetadata', onMetadata);
    video.addEventListener('error', onError);

    try {
      Promise.resolve(video.play())
        .then(() => {
          if (disposed) return;
          /* the autoplay-policy entry — pause and take over with the
           * stepper (uniform path: everything is seek-stepped) */
          video.pause();
          /* preload="metadata" may already have provided the duration */
          startStepper();
        })
        .catch(() => {
          /* autoplay blocked — the ambient tint + dots state shows; no
           * stepper runs (§4.23.I flag 1) */
        });
    } catch {
      /* defensive: never break the mount over playback */
    }

    return () => {
      disposed = true;
      stopStepper();
      video.removeEventListener('loadedmetadata', onMetadata);
      video.removeEventListener('error', onError);
    };
  });
</script>

<!-- §4.23.A: the fixed background layer — a decorative, prop-less,
     aria-hidden div; the FIRST child of .landing-page (before .landing).
     pointer-events: none — the layer must never intercept the content's
     interaction above it. -->
<div class="video-layer" aria-hidden="true">
  <!-- layer 1 (z 0): the owner's video, fixed + cover-cropped — the §4.22.B
       decisive attribute set pins the element verbatim; the aria-hidden
       ambient clip carries no captions track by design. -->
  <video
    bind:this={videoEl}
    class="video"
    class:video-failed={failed}
    src={videoUrl}
    muted
    playsinline
    preload="metadata"
    disablepictureinpicture
    aria-hidden="true"
    onerror={() => {
      failed = true;
    }}
  ></video>

  <!-- layer 3 (z 2): the animated purple pixels (the kept §4.21.B mesh) -->
  <span class="dots">
    {#each DOTS as dot, i (i)}
      <span
        class="dot"
        style="left: {dot[0]}%; top: {dot[1]}%; width: {dot[2]}px; height: {dot[2]}px;
          background: {dotFill(dot[3])}; --d: {dot[4]}s"
      ></span>
    {/each}
  </span>
</div>

<style>
  /* The fixed background layer wrapper (§4.23.A): decorative, prop-less,
   * non-interactive; the fixed children paint under the content column. */
  .video-layer {
    pointer-events: none;
  }

  /* Layer 1 (z 0): the video — fixed full-viewport, cover-cropped
   * (independent of scrolling; the page content scrolls over it). */
  .video {
    position: fixed;
    inset: 0;
    z-index: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: 50% 50%;
  }
  /* Failure degradation: the element is hidden — the page token shows
   * through + the vignette + dots keep running (the static near-black
   * treatment); no broken-media glyph, no blank screen, no layout shift. */
  .video-failed {
    display: none;
  }

  /* Layer 2 (z 1): the dissolve vignette + the global legibility tint
   * (§4.23.A layer 2, re-specced for the fixed full-screen layer) — THE
   * smooth transition: every viewport edge dissolves into exactly
   * --color-landing-bg (the page background), no hard edge at any viewport
   * ratio; the base wash is the uniform 30% darkening over the video for
   * mood + a first legibility pass. */
  .video-layer::after {
    content: '';
    position: fixed;
    inset: 0;
    z-index: 1;
    pointer-events: none;
    background-color: color-mix(in srgb, var(--color-landing-bg) 30%, transparent);
    background-image: radial-gradient(
      ellipse 120% 105% at 50% 50%,
      transparent 0 55%,
      color-mix(in srgb, var(--color-landing-bg) 55%, transparent) 78%,
      var(--color-landing-bg) 100%
    );
  }

  /* Layer 3 (z 2): the pixel dots — steps(2) twinkle, staggered delays;
   * ambient over the FULL viewport, below the content column (visible in
   * the gaps between sections — the scroll-over "sky"). */
  .dots {
    position: fixed;
    inset: 0;
    z-index: 2;
    pointer-events: none;
  }
  .dot {
    position: absolute;
    animation: dot-twinkle 1.6s steps(2) infinite;
    animation-delay: var(--d, 0s);
  }
  @keyframes dot-twinkle {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.2;
    }
  }

  /* Reduced motion (§4.6 + base.css catch-all): the twinkle collapses —
   * the dots stay statically visible at their base opacity; the video
   * never starts (the mount effect skips .play() — §4.23.G). */
  @media (prefers-reduced-motion: reduce) {
    .dot {
      animation: none;
    }
  }
</style>
