<script lang="ts">
  /**
   * QrCodeBadge (DESIGN rev. 3 §3.6): client-side persona QR — `uqr` (~3 kB,
   * zero-dep, MIT, synchronous) renders an SVG encoding the v2 binding
   * payload `{INVITE_URL_BASE}?u={userAddress}&m={mutualCode}` with a
   * 4-module quiet zone. Dark modules use the `--color-surface` token value
   * on the light `--color-qr-frame` backdrop — the one declared functional
   * light exception (§4.1); both colors are token references that resolve
   * once the inline SVG joins the DOM (no hardcoded hex, §2.4).
   * The `uqr` import is STATIC but lives ONLY in the shared lib/qr module
   * (`svgQr.ts`, TZ13-01 extraction) — that module is the single `uqr`
   * import site, lazy/code-split as a shared chunk of the profile + host
   * routes (§3.6 AC 13 as amended, TZ §9.4.4); no QR module loads on any
   * page that does not render one; the QR is not interactive and issues no
   * network request.
   *
   * Rotation micro-animation (§3.6, visible by design — Concept §6.3): when
   * the payload changes after a burn+refresh cycle the old module layer
   * fades/scales out (140 ms) and the new one steps in (180 ms ease-out) —
   * two-phase, 320 ms total, transform/opacity ONLY (§4.6). Under
   * `prefers-reduced-motion: reduce` the swap is instant (the caller still
   * shows the «QR обновлён» note). The initial render (first payload) does
   * not animate.
   */
  import { svgQr } from '#lib/qr/svgQr';

  interface Props {
    payload: string;
    /** Rendered edge length in px (design: ~200px). */
    size?: number;
    /** Accessible name (the payload itself is visual only). */
    alt: string;
    /** Fired after a payload swap completes (page shows the refresh note). */
    onrotated?: () => void;
  }

  let { payload, size = 200, alt, onrotated }: Props = $props();

  // Quiet zone 4 modules (§3.6); ecc M for scannability on glossy badges —
  // the shared module's §3.6 defaults (token colors included).
  const svg = $derived(svgQr(payload));

  let displayed = $state('');
  /** 'out' = fade-out phase; 'in' = fade-in phase; null = settled. */
  let phase = $state<'out' | 'in' | null>(null);
  let timers: ReturnType<typeof setTimeout>[] = [];

  function reducedMotion(): boolean {
    try {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch {
      return false;
    }
  }

  function clearTimers(): void {
    for (const timer of timers) clearTimeout(timer);
    timers = [];
  }

  $effect(() => {
    const next = payload;
    if (next === displayed) return;
    if (displayed === '' || reducedMotion()) {
      // First payload ever, or reduced motion: instant swap (§3.6).
      displayed = next;
      phase = null;
      return;
    }
    // Two-phase rotation (transform/opacity only).
    phase = 'out';
    clearTimers();
    timers.push(
      setTimeout(() => {
        displayed = next;
        phase = 'in';
        timers.push(
          setTimeout(() => {
            phase = null;
            onrotated?.();
          }, 180)
        );
      }, 140)
    );
    return () => clearTimers();
  });
</script>

<figure class="qr-badge">
  <div
    class="frame pixel-corners {phase === 'out' ? 'rotate-out' : ''} {phase === 'in' ? 'rotate-in' : ''}"
    role="img"
    aria-label={alt}
    style:width="{size}px"
    style:height="{size}px"
  >
    <!-- eslint-disable-next-line svelte/no-at-html-tags -- uqr SVG output of the payload we built -->
    {@html svg}
  </div>
</figure>

<style>
  .qr-badge {
    display: flex;
    justify-content: center;
    margin: 0;
  }
  .frame {
    background: var(--color-qr-frame);
    padding: var(--space-2);
    transform-origin: center;
  }
  .frame.rotate-out {
    animation: qr-out 140ms ease-in forwards;
  }
  .frame.rotate-in {
    animation: qr-in 180ms ease-out;
  }
  .frame :global(svg) {
    display: block;
    width: 100%;
    height: 100%;
  }
  @keyframes qr-out {
    from {
      opacity: 1;
      transform: scale(1);
    }
    to {
      opacity: 0;
      transform: scale(0.96);
    }
  }
  @keyframes qr-in {
    from {
      opacity: 0;
      transform: scale(0.96);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }
</style>
