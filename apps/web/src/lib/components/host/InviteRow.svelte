<script lang="ts">
  /**
   * InviteRow (DESIGN rev. 3 §3.7 item 5): one active invite code — Handjet
   * 24px digits, muted expiry «истекает через {time}», and the row actions:
   * code copy chip, a QR toggle (the small stateless-helper PNG for THIS
   * code), an invite-link copy, and «Отозвать» (outline-destructive, NO
   * confirm — revocation is reversible by minting again). Actions carry
   * per-code aria-labels («Отозвать код {code}», §3.7 a11y).
   */
  import { locale, translate } from '#lib/i18n/locale';
  import { inviteQrUrl } from '#lib/api/helper';
  import CopyButton from '#lib/components/CopyButton.svelte';
  import { expiresIn, inviteLink } from './hostLogic';
  import type { Invite } from '@bleak/api-client';

  interface Props {
    invite: Invite;
    /** Client-computed invite-link base ({INVITE_URL_BASE}, §10.9). */
    baseUrl: string;
    /** Seconds clock (driven by the page so rows update on polls). */
    now: number;
    onrevoke: (code: string) => void;
  }

  let { invite, baseUrl, now, onrevoke }: Props = $props();

  let qrOpen = $state(false);

  const revokeLabel = $derived(translate($locale, 'host.invites.revoke'));
  const revokeAria = $derived(
    translate($locale, 'host.invites.revoke_aria', { code: invite.code })
  );
  const qrToggleAria = $derived(
    translate($locale, 'host.invites.qr_toggle', { code: invite.code })
  );
  const expiry = $derived(
    translate($locale, 'host.invites.expires_in', { time: expiresIn(invite.expires_at, now) })
  );
  const link = $derived(inviteLink(invite.code, baseUrl));
</script>

<li class="invite-row">
  <span class="code">{invite.code}</span>
  <span class="expiry">{expiry}</span>
  <div class="actions">
    <CopyButton value={invite.code} />
    <button
      type="button"
      class="icon-action"
      aria-expanded={qrOpen}
      aria-label={qrToggleAria}
      onclick={() => (qrOpen = !qrOpen)}
    >
      QR
    </button>
    <CopyButton value={link} label={translate($locale, 'host.invite_link')} />
    <button type="button" class="revoke" aria-label={revokeAria} onclick={() => onrevoke(invite.code)}>
      {revokeLabel}
    </button>
  </div>
  {#if qrOpen}
    <img class="row-qr" src={inviteQrUrl(invite.code)} alt={qrToggleAria} width="128" height="128" />
  {/if}
</li>

<style>
  .invite-row {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    padding: var(--space-3);
    background: var(--color-surface);
    border-radius: var(--radius-md);
  }
  .code {
    font-family: var(--font-pixel);
    font-size: 24px;
    letter-spacing: 0.2em;
    color: var(--color-text);
  }
  .expiry {
    font-size: 14px;
    color: var(--color-text-muted);
  }
  .actions {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: var(--space-2);
  }
  .icon-action,
  .revoke {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 40px;
    padding: 0 var(--space-4);
    border: 1px solid var(--color-text-disabled-strong);
    background: transparent;
    color: var(--color-text);
    border-radius: var(--radius-pill);
    font-size: 14px;
    font-weight: 600;
    transition:
      border-color 120ms ease-out,
      color 120ms ease-out;
  }
  .revoke {
    color: var(--color-text-muted);
  }
  .row-qr {
    align-self: flex-start;
    background: var(--color-qr-frame);
    padding: var(--space-2);
    border-radius: var(--radius-md);
  }
</style>
