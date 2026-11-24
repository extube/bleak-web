<script lang="ts">
  /**
   * InviteRow (DESIGN rev. 4 §3.7.3 item 1, reworked for the invite route
   * by TZ13-04): one ACTIVE invite code — Handjet 24px digits, muted expiry
   * «истекает через {time}», and the row actions: code copy chip, a QR link
   * to the per-code QR page (§3.7.4), an invite-link copy, and «Отозвать»
   * (outline-destructive, NO confirm — revocation is reversible by minting
   * again). Every action carries its per-code `aria-label`. The invite link
   * itself is never rendered as text — it exists only as the copy payload.
   */
  import { locale, translate } from '#lib/i18n/locale';
  import { resolve } from '$app/paths';
  import CopyButton from '#lib/components/CopyButton.svelte';
  import { expiresIn, inviteLink } from './hostLogic';
  import type { Invite } from '@bleak/api-client';

  interface Props {
    invite: Invite;
    /** URL param — builds the per-code QR route link (§3.7.3). */
    roomAddress: string;
    /** Client-computed invite-link base ({INVITE_URL_BASE}, §10.9). */
    baseUrl: string;
    /** Seconds clock (driven by the page so rows update on polls). */
    now: number;
    onrevoke: (code: string) => void;
  }

  let { invite, roomAddress, baseUrl, now, onrevoke }: Props = $props();

  const copyCodeAria = $derived(
    translate($locale, 'host.invites.copy_code', { code: invite.code })
  );
  const qrAria = $derived(translate($locale, 'host.invites.qr_aria', { code: invite.code }));
  const copyLinkAria = $derived(
    translate($locale, 'host.invites.copy_link', { code: invite.code })
  );
  const revokeLabel = $derived(translate($locale, 'host.invites.revoke'));
  const revokeAria = $derived(
    translate($locale, 'host.invites.revoke_aria', { code: invite.code })
  );
  const expiry = $derived(
    translate($locale, 'host.invites.expires_in', { time: expiresIn(invite.expires_at, now) })
  );
  /** Copy payload only — never rendered as text (§3.7.4 hard ruling). */
  const link = $derived(inviteLink(invite.code, baseUrl));
</script>

<li class="invite-row">
  <div class="line">
    <span class="code">{invite.code}</span>
    <span class="expiry">{expiry}</span>
  </div>
  <div class="actions">
    <CopyButton value={invite.code} label={copyCodeAria} />
    <a
      class="qr-link"
      href={resolve('/host/[room_address]/invite/[code]/qr', {
        room_address: roomAddress,
        code: invite.code
      })}
      aria-label={qrAria}
    >QR</a>
    <CopyButton value={link} label={copyLinkAria} />
    <button
      type="button"
      class="revoke"
      aria-label={revokeAria}
      onclick={() => onrevoke(invite.code)}
    >
      {revokeLabel}
    </button>
  </div>
</li>

<style>
  .invite-row {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    padding: var(--space-3);
    min-height: var(--touch-target);
    background: var(--color-surface);
    border-radius: var(--radius-md);
  }
  .line {
    display: flex;
    align-items: baseline;
    gap: var(--space-3);
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
  .qr-link {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: var(--touch-target);
    padding: 0 var(--space-4);
    border: 1px solid var(--color-text-disabled-strong);
    background: transparent;
    color: var(--color-text);
    border-radius: var(--radius-pill);
    font-size: 14px;
    font-weight: 600;
    text-decoration: none;
    transition:
      border-color 120ms ease-out,
      color 120ms ease-out;
  }
  .revoke {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: var(--touch-target);
    padding: 0 var(--space-4);
    /* outline-destructive (Concept §7.1.6, DESIGN §4.9.3): transparent
       background, --color-danger border, --color-danger-text font. */
    border: 1px solid var(--color-danger);
    background: transparent;
    color: var(--color-danger-text);
    border-radius: var(--radius-pill);
    font-size: 14px;
    font-weight: 600;
    transition:
      border-color 120ms ease-out,
      color 120ms ease-out;
  }
</style>
