

<script module lang="ts">
  /* Animated purple pixels (§4.22.B layer 3, kept verbatim from §4.21.B):
   * [x%, y%, size px, shade 0..2, delay s] — 12 dots in the three violet
   * alpha shades, steps(2) twinkle 1.6s, staggered 0–1.2s delays. The
   * percent positions are breakpoint-independent; the §4.21.B protected
   * rects retired with the still image — the mesh re-anchors over the video
   * block as-is. */
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
   * LandingVideoHero (DESIGN §4.22.B, Concept §34): the hero common block
   * built around the OWNER'S VIDEO — `background-video.mp4` (16:9, near-black
   * background) replaces the retired still image and the drawn hero pair
   * (§4.22.G supersession). One block, full common-block width,
   * `aspect-ratio: 16 / 9` (the block height derives from the video — the
   * fixed 500/680px art-block heights of §4.21.B are superseded).
   *
   * Layers bottom→top:
   * ① the `<video>` — width/height 100%, object-fit cover (with the block
   *   ratio pinned to the video's 16:9, cover degrades to exact-fit; defensive
   *   if the true ratio drifts slightly it crops minimally instead of
   *   letterboxing). Attributes EXACTLY (decisive set, §4.22.B): muted loop
   *   playsinline preload="metadata" disablepictureinpicture aria-hidden —
   *   NO autoplay attribute and NO native controls. Playback starts from a
   *   ONE-SHOT mount effect GATED on prefers-reduced-motion (muted + loop +
   *   playsinline make the programmatic start policy-compliant; under
   *   reduced motion the video stays paused and the play control offers the
   *   opt-in). No inspection tooling exists for the clip in this environment
   *   — every frame-dependent choice is defensive (structural fallbacks, no
   *   frame geometry).
   * ② the edge-fade vignette (§4.22.F) — every edge dissolves into exactly
   *   `--color-landing-bg`, no hard rectangle edge at any breakpoint.
   * ③ the animated purple pixels — the §4.21.B dot mesh KEPT VERBATIM (12
   *   dots, three --color-deepa-4 alpha shades 18/35/60%, steps(2) twinkle
   *   1.6s, staggered 0–1.2s delays), re-anchored over the video block
   *   (percent positions are breakpoint-independent; the §4.21.B protected
   *   rects are retired with the still image).
   * ④ the reminder box (§4.22.C) — bottom-fixed inside the block; the block
   *   exposes `--reminder-w`/`--reminder-h` (the desktop cap is the §4.22.C
   *   center-band `min(calc(47% - 48px), 348px)`; phone cap unchanged).
   * ⑤ the play control — a 48px-target ghost button, bottom-right (16px
   *   insets), translucent scrim chip with an inline pixel play/pause glyph;
   *   visible only when playback is not running (paused, failed, or
   *   reduced-motion), hidden while playing.
   *
   * Failure degradation (§4.22.B): on the video `error` event the element is
   * hidden — the block degrades to the black background (--color-landing-bg,
   * seamless with the page) + the vignette + the animated dots + the
   * reminder. No broken-media glyph, never a blank box, no layout shift (the
   * aspect-ratio box is fixed before the media arrives). No poster (the tint
   * IS the pre/fallback state).
   *
   * Color discipline (§4.1): existing tokens only; no new values, no canvas,
   * no animation library. API endpoints used: none.
   */
  import videoUrl from '#lib/assets/landing/background-video.mp4';
  import LandingReminder from './LandingReminder.svelte';

  interface Props {
    /** The video block's accessible name (§4.22.H landing.video.aria). */
    aria: string;
    /** Play-control accessible name while stopped (§4.22.H). */
    playLabel: string;
    /** Play-control accessible name while playing (§4.22.H). */
    pauseLabel: string;
    /** The three cycling reminder lines (already translated). */
    lines: readonly string[];
    /** Static full reminder line for screen readers. */
    srLine: string;
  }

  let { aria, playLabel, pauseLabel, lines, srLine }: Props = $props();

  let videoEl = $state<HTMLVideoElement | null>(null);
  let playing = $state(false);
  let failed = $state(false);

  /* ONE-SHOT mount effect: playback starts on mount, GATED on
   * prefers-reduced-motion (§4.22.B — autoplay-off under reduced motion;
   * the user opts in through the play control). A rejected .play()
   * (autoplay blocked) simply leaves the control visible. */
  $effect(() => {
    const video = videoEl;
    if (!video) return;
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      try {
        Promise.resolve(video.play()).catch(() => {
          /* autoplay blocked — the play control stays visible */
        });
      } catch {
        /* defensive: never break the mount over playback */
      }
    }
  });

  function toggle(): void {
    const video = videoEl;
    if (!video || failed) return;
    if (video.paused) {
      video.play().catch(() => {
        /* blocked — the control stays */
      });
    } else {
      video.pause();
    }
  }
</script>

<section class="video-block" aria-label={aria}>
  <!-- layer 1: the owner's video (decorative moving scenery) — the §4.22.B
       decisive attribute set pins the element verbatim; the aria-hidden
       ambient clip carries no captions track by design. -->
  <video
    bind:this={videoEl}
    class="video"
    class:video-failed={failed}
    src={videoUrl}
    muted
    loop
    playsinline
    preload="metadata"
    disablepictureinpicture
    aria-hidden="true"
    onplay={() => (playing = true)}
    onpause={() => (playing = false)}
    onended={() => (playing = false)}
    onerror={() => {
      failed = true;
      playing = false;
    }}
  ></video>

  <!-- layer 3: the animated purple pixels (the kept §4.21.B mesh) -->
  <span class="dots" aria-hidden="true">
    {#each DOTS as dot, i (i)}
      <span
        class="dot"
        style="left: {dot[0]}%; top: {dot[1]}%; width: {dot[2]}px; height: {dot[2]}px;
          background: {dotFill(dot[3])}; --d: {dot[4]}s"
      ></span>
    {/each}
  </span>

  <!-- layer 4: the agent reminder box, fixed at the block's bottom -->
  <LandingReminder {lines} {srLine} />

  <!-- layer 5: the play control — visible only when not playing -->
  <button
    type="button"
    class="play"
    class:play-hidden={playing}
    aria-label={playing ? pauseLabel : playLabel}
    onclick={toggle}
  >
    {#if playing}
      <!-- pause glyph: two bars -->
      <svg viewBox="0 0 10 10" width="20" height="20" shape-rendering="crispEdges" aria-hidden="true">
        <g fill="currentColor">
          <rect x="1" y="0" width="3" height="10" />
          <rect x="6" y="0" width="3" height="10" />
        </g>
      </svg>
    {:else}
      <!-- play glyph: a chunky pixel triangle -->
      <svg viewBox="0 0 10 10" width="20" height="20" shape-rendering="crispEdges" aria-hidden="true">
        <g fill="currentColor">
          <rect x="1" y="0" width="2" height="10" />
          <rect x="3" y="1" width="2" height="8" />
          <rect x="5" y="2" width="2" height="6" />
          <rect x="7" y="3" width="2" height="4" />
        </g>
      </svg>
    {/if}
  </button>
</section>

<style>
  /* The video block (§4.22.B): full common-block width, 16:9 — the height
   * derives from the width (no fixed 500/680px height remains). The base
   * tint is the landing page token — invisible against the page until the
   * video paints, and the failure state IS this tint. */
  .video-block {
    --reminder-w: min(100% - 32px, 256px);
    --reminder-h: calc(var(--reminder-w) / 3.5);
    position: relative;
    width: 100%;
    aspect-ratio: 16 / 9;
    overflow: hidden;
    background: var(--color-landing-bg);
  }
  @media (min-width: 720px) {
    .video-block {
      /* §4.22.C desktop cap: the 47% clear center band (100% − 27% − 26%)
       * minus two 24px gutters, the 348px absolute cap kept. */
      --reminder-w: min(calc(47% - 48px), 348px);
    }
  }

  /* Layer 1: the video, cover-cropped (exact-fit at the pinned 16:9). */
  .video {
    position: absolute;
    inset: 0;
    z-index: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: 50% 50%;
  }
  /* Failure degradation: the element is hidden — tint + dots + reminder
   * keep running, no broken-media glyph, no layout shift. */
  .video-failed {
    display: none;
  }

  /* Layer 2: the edge-fade vignette — THE smooth transition (§4.22.F):
   * every edge dissolves into exactly --color-landing-bg (the page
   * background), no hard edge at any breakpoint. */
  .video-block::after {
    content: '';
    position: absolute;
    inset: 0;
    z-index: 1;
    pointer-events: none;
    background: radial-gradient(
      ellipse 80% 78% at 50% 46%,
      transparent 0 52%,
      color-mix(in srgb, var(--color-landing-bg) 45%, transparent) 72%,
      var(--color-landing-bg) 100%
    );
  }

  /* Layer 3: the pixel dots — steps(2) twinkle, staggered delays. */
  .dots {
    position: absolute;
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

  /* Layer 4 (the reminder) rides above the vignette with its own z-index. */
  .video-block :global(.reminder) {
    z-index: 3;
  }

  /* Layer 5: the play control — 48px target, bottom-right (16px insets),
   * translucent scrim chip + inline pixel glyph (currentColor). */
  .play {
    position: absolute;
    right: 16px;
    bottom: 16px;
    z-index: 4;
    width: 48px;
    height: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    border-radius: var(--radius-md);
    background: color-mix(in srgb, var(--color-landing-bg) 60%, transparent);
    color: var(--color-text-muted);
    cursor: pointer;
    transition: color 120ms ease-out;
  }
  .play:hover {
    color: var(--color-text);
  }
  .play:focus-visible {
    outline: 2px solid var(--color-deepa-4);
    outline-offset: 2px;
  }
  .play svg {
    display: block;
  }
  /* Hidden while playing (visible only when paused, failed, or
   * reduced-motion). */
  .play-hidden {
    display: none;
  }
  /* Phone: the verbatim 256px reminder spans nearly the whole 16:9 block,
   * so the 16px-bottom control would enter its band at 320px — the control
   * rises ABOVE the reminder's top edge (its right inset stays 16px; the
   * §4.22.C/AC-7 never-overlap rule wins at 320/390). */
  @media (max-width: 719.98px) {
    .play {
      bottom: calc(16px + var(--reminder-h));
    }
  }

  /* Reduced motion (§4.6 + base.css catch-all): the twinkle collapses —
   * the dots stay statically visible at their base opacity. */
  @media (prefers-reduced-motion: reduce) {
    .dot {
      animation: none;
    }
  }
</style>
