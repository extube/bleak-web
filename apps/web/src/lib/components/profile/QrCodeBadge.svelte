<script lang="ts">
  /**
   * QrCodeBadge (DESIGN §3.6): client-side persona QR — `uqr` (~3 kB,
   * zero-dep, MIT, synchronous) renders an SVG encoding
   * `{INVITE_URL_BASE}?u={userAddress}` with a 4-module quiet zone.
   * Dark modules use the `--color-surface` token value on the light
   * `--color-qr-frame` backdrop — the one declared functional light
   * exception (§4.1); both colors are token references that resolve once
   * the inline SVG joins the DOM (no hardcoded hex, §2.4).
   * The `uqr` import is STATIC but lives ONLY in this `/profile` route
   * chunk (§3.6 AC 13 — no QR module loads on any other page); the QR is
   * not interactive and issues no network request.
   */
  import { renderSVG } from 'uqr';

  interface Props {
    payload: string;
    /** Rendered edge length in px (design: ~200px). */
    size?: number;
    /** Accessible name (the payload itself is visual only). */
    alt: string;
  }

  let { payload, size = 200, alt }: Props = $props();

  // Quiet zone 4 modules (§3.6); ecc M for scannability on glossy badges.
  const svg = $derived(
    renderSVG(payload, {
      border: 4,
      ecc: 'M',
      pixelSize: 8,
      whiteColor: 'var(--color-qr-frame)',
      blackColor: 'var(--color-surface)'
    })
  );
</script>

<figure class="qr-badge">
  <div
    class="frame pixel-corners"
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
  }
  .frame :global(svg) {
    display: block;
    width: 100%;
    height: 100%;
  }
</style>
