<script lang="ts">
  /**
   * Share kit (DESIGN rev. 4 §3.7.2 region 3): the big 6-digit Handjet
   * code (digits spelled in the aria-label) with a copy chip, the
   * CLIENT-SIDE `InviteQr` SVG (TZ13-01 — the shared uqr renderer wrapping
   * `{INVITE_URL_BASE}?code={code}`; NO helper PNG call anywhere), the
   * «Присоединиться как участник» CTA → `/?code={code}` (the §3.1
   * deep-link flow takes over) and the «Все коды приглашения» link row →
   * the invite route (§3.7.3). 256px phone / 320px desktop QR in the
   * pixel-cornered light frame (`--color-qr-frame` — the declared
   * functional light exception). Presentational.
   */
  import { locale, translate } from '#lib/i18n/locale';
  import { resolve } from '$app/paths';
  import CopyButton from '#lib/components/CopyButton.svelte';
  import InviteQr from '#lib/components/qr/InviteQr.svelte';
  import { spelledDigits } from './hostLogic';

  interface Props {
    /** The room's current invite code (from bleak.hostRoom). */
    code: string;
    /**
     * The room address — builds the «Все коды приглашения» link. The
     * LEGACY pre-rework entry console does not pass it: there the link
     * row is hidden (the old console carries its own invite manager).
     */
    roomAddress?: string;
    /**
     * Legacy entry-console props (the pre-rework /host console passes
     * them): the helper-PNG URL, the precomputed link and the
     * «Создать другую комнату» callback are IGNORED here — the rev. 4
     * panel share region renders the client-side `InviteQr` only and
     * its back control covers «Создать другую комнату». Kept so the
     * not-yet-reworked console keeps compiling; they disappear with
     * TZ13-02's console rework.
     */
    inviteUrl?: string;
    qrSrc?: string;
    oncreateAnother?: () => void;
  }

  let { code, roomAddress, inviteUrl }: Props = $props();

  const shareTitle = $derived(translate($locale, 'host.panel.share'));
  const codeLabel = $derived(translate($locale, 'host.code.label'));
  const codeAria = $derived(translate($locale, 'host.qr.code_aria', { digits: spelledDigits(code) }));
  const qrAlt = $derived(translate($locale, 'host.qr.aria', { code }));
  const joinLabel = $derived(translate($locale, 'host.join_as'));
  const invitesLinkLabel = $derived(translate($locale, 'host.panel.invites_link'));

  /**
   * Join CTA: the panel (rev. 4) links `/?code={code}` — the §3.1
   * deep-link flow (the landing forwards the query to the join entry).
   * The LEGACY pre-rework entry console passes `inviteUrl`; it keeps the
   * delivered tz12-02 re-homing (`/income?code=`) until TZ13-02's
   * console rework removes the old call site.
   */
  const joinHref = $derived(
    inviteUrl !== undefined ? `${resolve('/income')}?code=${code}` : `/?code=${code}`
  );
</script>

<div class="share card pixel-corners">
  <h2>{shareTitle}</h2>

  <p class="code-label">{codeLabel}</p>
  <div class="code-row">
    <span class="code" role="img" aria-label={codeAria}>{code}</span>
    <CopyButton value={code} />
  </div>

  <div class="qr-frame pixel-corners">
    <!-- client-side SVG QR — zero network requests (rev. 4). The
         svelte/no-at-html-tags concern lives inside InviteQr. -->
    <InviteQr {code} size={256} ariaLabel={qrAlt} />
  </div>

  <!-- AC 9 deep link: the join entry with the ?code= query — the §3.1
       flow takes over. resolve() covers the route only; the query is
       appended intentionally, so this href is exempted from
       svelte/no-navigation-without-resolve. -->
  <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
  <a class="cta" href={joinHref}>{joinLabel}</a>

  <!-- «Все коды приглашения» → the invite route (§3.7.3, TZ13-04); the
       legacy entry console (no roomAddress) hides the row. The route id
       is not yet typed in this branch's generated manifest (TZ13-04 owns
       the route), so the href is built directly and exempted from the
       resolve rule. -->
  {#if roomAddress}
    <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
    <a class="link" href={`/host/${roomAddress}/invite`}>{invitesLinkLabel}</a>
  {/if}
</div>

<style>
  .share {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    align-items: stretch;
  }
  h2 {
    font-family: var(--font-pixel);
    font-size: 28px;
    letter-spacing: 0.04em;
    margin: 0;
  }
  .code-label {
    margin: 0;
    font-size: 14px;
    color: var(--color-text-muted);
  }
  .code-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
  }
  .code {
    font-family: var(--font-pixel);
    font-size: 40px;
    letter-spacing: 0.3em;
    line-height: 1.1;
    color: var(--color-text);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .qr-frame {
    align-self: center;
    background: var(--color-qr-frame);
    padding: var(--space-3);
    border-radius: var(--radius-md);
  }
  .cta {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    text-decoration: none;
  }
  .link {
    background: transparent;
    border: none;
    color: var(--color-text-muted);
    min-height: var(--touch-target);
    font-size: 14px;
    text-align: center;
    text-decoration: none;
  }
  @media (min-width: 900px) {
    /* 256px phone / 320px desktop (§3.7.2) — the frame is sized by the
         shared InviteQr's inline style, so the desktop step overrides it. */
    .qr-frame :global(.frame) {
      width: 320px !important;
      height: 320px !important;
    }
  }
</style>
