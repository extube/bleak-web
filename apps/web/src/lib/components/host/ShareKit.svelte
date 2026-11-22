<script lang="ts">
  /**
   * Share kit (DESIGN §3.7 item 4): big 6-digit Handjet code with a copy
   * chip, helper QR PNG in the pixel-cornered light frame
   * (`--color-qr-frame` — the declared functional light exception), the
   * copyable invite link, "join as attendee" (deep link `/income?code=` —
   * tz12-02 re-homing) and "create another room". Presentational — the
   * page computes qrSrc.
   */
  import { resolve } from '$app/paths';
  import { locale, translate } from '#lib/i18n/locale';
  import CopyButton from '#lib/components/CopyButton.svelte';
  import CopyField from '#lib/components/CopyField.svelte';
  import { spelledDigits } from './hostLogic';

  interface Props {
    code: string;
    inviteUrl: string;
    /** Helper QR PNG URL (`inviteQrUrl(code)` — computed by the page). */
    qrSrc: string;
    oncreateAnother?: () => void;
  }

  let { code, inviteUrl, qrSrc, oncreateAnother }: Props = $props();

  const codeLabel = $derived(translate($locale, 'host.code.label'));
  const codeAria = $derived(translate($locale, 'host.code.aria', { code: spelledDigits(code) }));
  const qrAlt = $derived(translate($locale, 'host.qr.alt'));
  const inviteLinkLabel = $derived(translate($locale, 'host.invite_link'));
  const joinLabel = $derived(translate($locale, 'host.join_attendee'));
  const anotherLabel = $derived(translate($locale, 'host.create_another'));
</script>

<div class="share card pixel-corners">
  <p class="code-label">{codeLabel}</p>
  <div class="code-row">
    <span class="code" role="img" aria-label={codeAria}>{code}</span>
    <CopyButton value={code} />
  </div>

  <div class="qr-frame pixel-corners">
    <img src={qrSrc} alt={qrAlt} width="256" height="256" />
  </div>

  <CopyField label={inviteLinkLabel} value={inviteUrl} truncate />

  <!-- AC 5 deep link: the join screen with the ?code= query. resolve() covers
       the route only — the query is appended intentionally, so this one
       href is exempted from svelte/no-navigation-without-resolve. -->
  <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
  <a class="cta" href={`${resolve('/income')}?code=${code}`}>{joinLabel}</a>
  <button type="button" class="link" onclick={() => oncreateAnother?.()}>{anotherLabel}</button>
</div>

<style>
  .share {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    align-items: stretch;
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
  .qr-frame img {
    display: block;
    width: 256px;
    height: 256px;
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
  }
  @media (min-width: 900px) {
    .qr-frame img {
      width: 320px;
      height: 320px;
    }
  }
</style>
