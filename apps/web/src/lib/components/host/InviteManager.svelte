<script lang="ts">
  /**
   * InviteManager (DESIGN rev. 3 §3.7 item 5): the invite-management block —
   * sub-header + hint, the active-code list (revoked and expired codes never
   * render), and the mint control: CTA «Выпустить код» opens an inline
   * expiry chooser — preset pills 1 ч / 24 ч (pre-selected default) / 7 дней
   * plus «Своё время…» revealing a compact `datetime-local` input
   * (min = now). Minting calls back with the ISO expiry (omitted → the
   * server-side 24 h default). Failures render inline with retry; the share
   * kit is unaffected.
   */
  import { locale, translate } from '#lib/i18n/locale';
  import type { Invite } from '@bleak/api-client';
  import InviteRow from './InviteRow.svelte';
  import ErrorBanner from '#lib/components/ErrorBanner.svelte';
  import SkeletonBlock from '#lib/components/SkeletonBlock.svelte';
  import { activeInvites, customExpiry, presetExpiry, type ExpiryPreset } from './hostLogic';

  interface Props {
    /** Active codes from the room-token `listInvites` (null = loading). */
    invites: Invite[] | null;
    error: 'network' | 'api' | null;
    errorMessage: string | null;
    mintPending: boolean;
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
    error,
    errorMessage,
    mintPending,
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
  const hint = $derived(translate($locale, 'host.invites.hint'));
  const mintLabel = $derived(translate($locale, 'host.invites.mint'));
  const preset1h = $derived(translate($locale, 'host.invites.preset.1h'));
  const preset24h = $derived(translate($locale, 'host.invites.preset.24h'));
  const preset7d = $derived(translate($locale, 'host.invites.preset.7d'));
  const presetCustom = $derived(translate($locale, 'host.invites.preset.custom'));
  const customLabel = $derived(translate($locale, 'host.invites.custom_label'));
  const revoked = $derived(translate($locale, 'host.invites.revoked'));
  const loading = $derived(translate($locale, 'common.loading'));

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
  <div class="head">
    <h2>{title}</h2>
    <p class="hint">{hint}</p>
  </div>

  {#if error}
    <ErrorBanner kind={error} message={errorMessage} onretry={onretry} />
  {:else if invites === null}
    <div class="skeletons" aria-hidden="true">
      <SkeletonBlock width="100%" height="64px" />
      <SkeletonBlock width="100%" height="64px" />
    </div>
    <p class="loading" role="status">{loading}</p>
  {:else}
    {#if revokedNote}
      <p class="revoked-note" aria-live="polite">{revoked}</p>
    {/if}
    {#if activeInvites(invites, now).length === 0}
      <p class="empty">{hint}</p>
    {:else}
      <ul class="rows">
        {#each activeInvites(invites, now) as invite (invite.code)}
          <InviteRow {invite} {baseUrl} {now} onrevoke={onrevoke} />
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

    {#if chooserOpen}
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
  {/if}
</section>

<style>
  .invites {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }
  .head h2 {
    font-size: 24px;
    margin: 0;
  }
  .hint {
    margin: var(--space-1) 0 0;
    font-size: 14px;
    color: var(--color-text-muted);
  }
  .rows {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  .empty {
    margin: 0;
    font-size: 14px;
    color: var(--color-text-muted);
  }
  .revoked-note {
    margin: 0;
    font-size: 14px;
    color: var(--color-accent);
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
    min-height: 40px;
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
</style>
