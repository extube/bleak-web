<script lang="ts">
  /**
   * InviteQr (DESIGN rev. 4 §4.2, §3.7.4 item 1): the host tree's client-side
   * invite QR — the shared §3.6 `uqr` renderer (lib/qr/svgQr.ts, extracted
   * by TZ13-01) wrapping the absolute invite deep link
   * `{INVITE_URL_BASE}?code={code}`. NO network call anywhere on this path —
   * no helper PNG (rev. 4 decision; the helper endpoint stays for external
   * parity only). Dark modules on the light `--color-qr-frame` backdrop, the
   * one declared functional light exception (§4.1); pixel-cornered frame.
   * The component is non-interactive display only.
   */
  import { inviteQrPayload, svgQr } from '#lib/qr/svgQr';

  interface Props {
    /** The 6-digit invite code the QR encodes. */
    code: string;
    /** Rendered edge length in px (design: 280px on the QR page, §3.7.4). */
    size?: number;
    /** Accessible name — includes the code («QR-код приглашения {code}»). */
    ariaLabel: string;
    /**
     * Invite-link base override (tests); defaults to the shared
     * {INVITE_URL_BASE} resolution (bake → SPA origin → dev fallback).
     */
    baseUrl?: string;
  }

  let { code, size = 280, ariaLabel, baseUrl }: Props = $props();

  const payload = $derived(inviteQrPayload(code, baseUrl));
  const svg = $derived(svgQr(payload));
</script>

<figure class="invite-qr">
  <div
    class="frame pixel-corners"
    role="img"
    aria-label={ariaLabel}
    style:width="{size}px"
    style:height="{size}px"
  >
    <!-- eslint-disable-next-line svelte/no-at-html-tags -- uqr SVG output of the payload we built -->
    {@html svg}
  </div>
</figure>

<style>
  .invite-qr {
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
