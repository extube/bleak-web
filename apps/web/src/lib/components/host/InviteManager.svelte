<script lang="ts">
  /**
   * InviteManager (DESIGN rev. 4 §3.7.3 / §4.2, reworked for the invite
   * route by TZ13-04): the invite-page body — the active-code `<ul>` (one
   * `InviteRow` per server code, newest first), the mint control (CTA
   * «Выпустить код» → inline expiry chooser: presets 1 ч / 24 ч
   * pre-selected default / 7 дней + «Своё время…» datetime-local, min =
   * now), the rule-C history disclosure (ledger entries MISSING from the
   * server list — expired/revoked text badges, non-interactive rows, the
   * ledger caveat under the header; the section is omitted when empty),
   * and the §3.7.3 states: skeletons on first arrival, EmptyState + mint
   * CTA when nothing is active and nothing is known, inline errors with
   * retry (the ledger section still renders — it is local), mint/revoke
   * failures inline near the control. The legacy console call site keeps
   * compiling: `history`/`actionError` default to no-section/no-line.
   */
  import { locale, translate } from '#lib/i18n/locale';
  import type { Invite } from '@bleak/api-client';
  import InviteRow from './InviteRow.svelte';
  import ErrorBanner from '#lib/components/ErrorBanner.svelte';
  import EmptyState from '#lib/components/EmptyState.svelte';
  import SkeletonBlock from '#lib/components/SkeletonBlock.svelte';
  import { activeInvites, customExpiry, presetExpiry, type ExpiryPreset } from './hostLogic';
  import type { LedgerHistoryEntry } from '#lib/stores/hostInviteLedger';

  interface Props {
    /** Active codes from the room-token `listInvites` (null = loading). */
    invites: Invite[] | null;
    /** Rule-C history: ledger entries missing from the server list. */
    history?: LedgerHistoryEntry[];
    /** Room-address URL param — builds the per-code QR links (§3.7.3). */
    roomAddress?: string;
    error: 'network' | 'api' | null;
    errorMessage: string | null;
    mintPending: boolean;
    /** Inline mint/revoke failure near the control (invite route). */
    actionError?: string | null;
    /** Transient «Код отозван.» note (page-owned timer). */
    revokedNote: boolean;
    /** Client-computed invite-link base ({INVITE_URL_BASE}, §10.9). */
    baseUrl: string;
    /** Seconds clock shared by the rows (driven by the page). */
    now: number;
    onmint: (expiresAt?: string) => void;
    onrevoke: (code: string) => void;
    onretry: () => void;
  }

  let {
    invites,
    history = [],
    roomAddress = '',
    error,
    errorMessage,
    mintPending,
    actionError = null,
    revokedNote,
    baseUrl,
    now,
    onmint,
    onrevoke,
    onretry
  }: Props = $props();

  let chooserOpen = $state(false);
  let preset = $state<ExpiryPreset | 'custom'>('24h');
  let customValue = $state('');
  let customInvalid = $state(false);

  const title = $derived(translate($locale, 'host.invites.title'));
  const mintLabel = $derived(translate($locale, 'host.invites.mint'));
  const preset1h = $derived(translate($locale, 'host.invites.preset.1h'));
  const preset24h = $derived(translate($locale, 'host.invites.preset.24h'));
  const preset7d = $derived(translate($locale, 'host.invites.preset.7d'));
  const presetCustom = $derived(translate($locale, 'host.invites.preset.custom'));
  const customLabel = $derived(translate($locale, 'host.invites.custom_label'));
  const revoked = $derived(translate($locale, 'host.invites.revoked'));
  const emptyLabel = $derived(translate($locale, 'host.invites.empty'));
  const historyTitle = $derived(translate($locale, 'host.invites.expired_title'));
  const caveatLabel = $derived(translate($locale, 'host.invites.ledger_caveat'));
  const loading = $derived(translate($locale, 'common.loading'));

  /** Deterministic muted badge date (the ISO day part). */
  function dayOf(iso: string): string {
    return iso.slice(0, 10);
  }

  const active = $derived((invites !== null ? activeInvites(invites, now) : []) as Invite[]);
  const isEmpty = $derived(invites !== null && active.length === 0 && history.length === 0);

  /** datetime-local `min` — the current time in local minute precision. */
  const minLocal = $derived.by(() => {
    const d = new Date(now - (now % 60_000));
    const pad = (n: number): string => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  });

  function toggleChooser(): void {
    chooserOpen = !chooserOpen;
    if (chooserOpen) {
      preset = '24h';
      customValue = '';
      customInvalid = false;
    }
  }

  function mint(): void {
    if (mintPending) return;
    if (preset === 'custom') {
      const iso = customExpiry(customValue, now);
      if (iso === null) {
        customInvalid = true;
        return;
      }
      customInvalid = false;
      onmint(iso);
    } else {
      onmint(presetExpiry(preset, now));
    }
  }

  function selectPreset(next: ExpiryPreset | 'custom'): void {
    preset = next;
    customInvalid = false;
  }

  function ariaPressed(value: ExpiryPreset | 'custom'): boolean | undefined {
    return preset === value ? true : undefined;
  }
</script>

<section class="invites" aria-label={title}>
  {#if error}
    <ErrorBanner kind={error} message={errorMessage} onretry={onretry} />
  {/if}

  {#if revokedNote}
    <p class="revoked-note" aria-live="polite">{revoked}</p>
  {/if}

  {#if invites === null}
    <div class="skeletons" aria-hidden="true">
      <SkeletonBlock width="100%" height="64px" />
      <SkeletonBlock width="100%" height="64px" />
    </div>
    <p class="loading" role="status">{loading}</p>
  {:else if isEmpty}
    <!-- No active codes AND no ledger entries (§3.7.3 states): the
         EmptyState mint CTA opens the chooser (no second mint control). -->
    <EmptyState message={emptyLabel} icon="radar-dot" ctaLabel={mintLabel} oncta={toggleChooser} />
  {:else}
    {#if active.length > 0}
      <ul class="rows">
        {#each active as invite (invite.code)}
          <InviteRow {invite} {baseUrl} {now} roomAddress={roomAddress} onrevoke={onrevoke} />
        {/each}
      </ul>
    {/if}
    <button
      type="button"
      class="mint-toggle"
      aria-expanded={chooserOpen}
      onclick={toggleChooser}
    >
      {mintLabel}
    </button>
  {/if}

  {#if actionError}
    <!-- Mint/revoke failure: inline near the control (§3.7.3 states). -->
    <p class="action-error" role="alert" aria-live="polite">{actionError}</p>
  {/if}

  {#if invites !== null && chooserOpen}
      <div class="chooser">
        <div class="pills" role="group" aria-label={mintLabel}>
          <button type="button" class="pill" aria-pressed={ariaPressed('1h')} onclick={() => selectPreset('1h')}>{preset1h}</button>
          <button type="button" class="pill" aria-pressed={ariaPressed('24h')} onclick={() => selectPreset('24h')}>{preset24h}</button>
          <button type="button" class="pill" aria-pressed={ariaPressed('7d')} onclick={() => selectPreset('7d')}>{preset7d}</button>
          <button type="button" class="pill" aria-pressed={ariaPressed('custom')} onclick={() => selectPreset('custom')}>{presetCustom}</button>
        </div>
        {#if preset === 'custom'}
          <div class="field">
            <label for="invite-expires">{customLabel}</label>
            <input
              id="invite-expires"
              type="datetime-local"
              min={minLocal}
              bind:value={customValue}
              class:invalid={customInvalid}
            />
            {#if customInvalid}
              <p class="field-error" role="alert" aria-live="polite">
                {translate($locale, 'host.invites.preset.custom')}
              </p>
            {/if}
          </div>
        {/if}
        <button type="button" class="cta mint-confirm" disabled={mintPending} onclick={mint}>
          {#if mintPending}<span class="spinner" aria-hidden="true"></span>{/if}
          {mintLabel}
        </button>
      </div>
    {/if}

  {#if history.length > 0}
    <!-- Rule-C history: ledger entries missing from the server list —
         collapsed disclosure, non-interactive rows, ledger caveat. -->
    <details class="history">
      <summary>{historyTitle}</summary>
      <p class="caveat">{caveatLabel}</p>
      <ul class="history-rows">
        {#each history as entry (entry.code)}
          <li class="history-row">
            <span class="code">{entry.code}</span>
            <span class="badge">
              {entry.classification === 'expired'
                ? translate($locale, 'host.invites.expired_at', { date: dayOf(entry.expires_at) })
                : translate($locale, 'host.invites.revoked_at', {
                    date: dayOf(entry.revoked_at ?? entry.created_at)
                  })}
            </span>
          </li>
        {/each}
      </ul>
    </details>
  {/if}
</section>

<style>
  .invites {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }
  .rows {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  .revoked-note {
    margin: 0;
    font-size: 14px;
    color: var(--color-accent);
  }
  .action-error {
    margin: 0;
    font-size: 14px;
    color: var(--color-text-muted);
  }
  .loading {
    margin: 0;
    font-size: 14px;
    color: var(--color-text-muted);
  }
  .skeletons {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  .mint-toggle {
    align-self: flex-start;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: var(--touch-target);
    padding: 0 var(--space-5);
    background: var(--color-accent);
    color: var(--color-accent-ink);
    border: none;
    border-radius: var(--radius-pill);
    font-weight: 600;
    font-size: 14px;
    transition: opacity 120ms ease-out;
  }
  .chooser {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    padding: var(--space-3);
    background: var(--color-surface-elevated);
    border-radius: var(--radius-md);
  }
  .pills {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }
  .pill {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: var(--touch-target);
    padding: 0 var(--space-4);
    border: 1px solid var(--color-text-disabled-strong);
    background: transparent;
    color: var(--color-text-muted);
    border-radius: var(--radius-pill);
    font-size: 14px;
    transition:
      background 120ms ease-out,
      color 120ms ease-out;
  }
  .pill[aria-pressed='true'] {
    background: var(--color-accent);
    border-color: var(--color-accent);
    color: var(--color-accent-ink);
  }
  .field {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }
  label {
    color: var(--color-text-muted);
    font-size: 14px;
  }
  input {
    background: var(--color-surface);
    color: var(--color-text);
    border: 1px solid var(--color-text-disabled-strong);
    border-radius: var(--radius-md);
    min-height: var(--touch-target);
    padding: 0 var(--space-3);
    font-size: 14px;
    font-family: var(--font-body);
  }
  input.invalid {
    border-color: var(--color-accent);
  }
  .field-error {
    margin: 0;
    color: var(--color-accent);
    font-size: 14px;
  }
  .cta {
    align-self: flex-start;
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    background: var(--color-accent);
    color: var(--color-accent-ink);
    border: none;
    border-radius: var(--radius-pill);
    min-height: var(--touch-target);
    padding: 0 var(--space-5);
    font-weight: 600;
    font-size: 14px;
    transition: opacity 120ms ease-out;
  }
  .cta:disabled {
    opacity: 0.6;
  }
  .spinner {
    width: 14px;
    height: 14px;
    border: 2px solid var(--color-accent-ink);
    border-right-color: transparent;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
  /* Rule-C history disclosure (§3.7.3 item 3): collapsed by default,
     muted caveat directly under the header, non-interactive rows. */
  .history {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    padding: var(--space-3);
    background: var(--color-surface);
    border-radius: var(--radius-md);
  }
  .history summary {
    cursor: pointer;
    font-size: 14px;
    font-weight: 600;
    color: var(--color-text-muted);
    min-height: var(--touch-target);
    display: flex;
    align-items: center;
  }
  .caveat {
    margin: 0;
    font-size: 14px;
    color: var(--color-text-muted);
  }
  .history-rows {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  .history-row {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    min-height: var(--touch-target);
    padding: var(--space-2) var(--space-3);
    background: var(--color-surface-elevated);
    border-radius: var(--radius-md);
  }
  .history-row .code {
    font-family: var(--font-pixel);
    font-size: 24px;
    letter-spacing: 0.2em;
    color: var(--color-text-muted);
  }
  /* Expired/revoked badges are muted TEXT — never color-only (§3.7.3 a11y). */
  .badge {
    font-size: 14px;
    color: var(--color-text-muted);
  }
</style>
