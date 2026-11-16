<script lang="ts">
  /**
   * JoinFlow (TZ-03 + TZ2-06 Part B) — the Step 1 → 3a/3b state machine for
   * `/` (DESIGN §3.1 rev. 3). The route page passes deep-link values; this
   * component owns the steps, the mount-time API calls (NO Poller on `/`,
   * §2.2), the scanner mount point (context *a*, QrScanner public API only)
   * and every §3.1 interaction state.
   *
   * v2 (Concept §6.2 / ARCHITECTURE §10.6): persona creation generates the
   * client-side token and sends `invite_code` + the raw token in the body
   * (no auth header); identity + the device token vault are written ONLY
   * after a 2xx; import is vault-driven (`bleak.tokenVault` — never
   * `GET /api/room`); the §2.9 invite-code rejection is a first-class
   * inline state.
   */
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { locale, translate } from '#lib/i18n/locale';
  import { saveIdentity } from '#lib/stores/identity';
  import { appendVaultEntry, listVaultEntries, type VaultEntry } from '#lib/stores/tokenVault';
  import type { Room } from '@bleak/api-client';
  import {
    codeErrorOf,
    createPersona,
    initialJoinState,
    isValidInviteCode,
    personaErrorOf,
    readVaultPersona,
    reduce,
    resolveRoomByCode,
    vaultErrorOf,
    type JoinState,
    type PersonaDraft,
    type PersonaError
  } from '#lib/join';
  import ErrorBanner from '#lib/components/ErrorBanner.svelte';
  import QrScanner from '#lib/components/QrScanner.svelte';
  import CodeEntry from './CodeEntry.svelte';
  import RoomPreview from './RoomPreview.svelte';
  import PersonaForm from './PersonaForm.svelte';
  import VaultList from './VaultList.svelte';

  interface Props {
    /** ?code=NNNNNN deep link (invite QR / link): prefill + auto-submit. */
    deepLinkCode?: string | null;
  }

  let { deepLinkCode = null }: Props = $props();

  // Deep-link prefill (?code=NNNNNN): captured once — the auto-submit runs
  // exactly once (the effect below guards it).
  const initialCode: string =
    deepLinkCode !== null && isValidInviteCode(deepLinkCode) ? deepLinkCode : '';

  let flow: JoinState = $state({ ...initialJoinState, code: initialCode });

  let resolving = $state(false);
  let creating = $state(false);
  let codeError = $state<'not_found' | 'malformed' | null>(null);
  let shakeKey = $state(0);
  let banner = $state<{ kind: 'network' | 'api'; text: string | null } | null>(null);
  let gone = $state(false);
  let personaError = $state<{ kind: PersonaError; text: string | null } | null>(null);
  let vaultEntries = $state<VaultEntry[]>([]);
  let vaultLoading = $state(false);
  let vaultDead = $state<{ address: string; text: string | null } | null>(null);
  let scannerOpen = $state(false);

  let codeEntry: { focusCode(): void } | null = $state(null);

  function flashShake(): void {
    shakeKey += 1;
  }

  function backToStep1(): void {
    gone = false;
    banner = null;
    codeError = null;
    flow = reduce(flow, { type: 'change-code' });
  }

  // --- Step 1: code resolution --------------------------------------------

  async function submitCode(code: string): Promise<void> {
    if (resolving || gone) return;
    if (!isValidInviteCode(code)) {
      codeError = 'malformed';
      flashShake();
      return;
    }
    codeError = null;
    banner = null;
    resolving = true;
    try {
      const { room, members } = await resolveRoomByCode(code);
      flow = reduce(flow, { type: 'resolved', room, members });
    } catch (err) {
      handleError(err);
    } finally {
      resolving = false;
    }
  }

  /** §3.1 error mapping for resolution: inline 400/404, banner network/api,
   * gone-card on a deleted room. Digits survive every failure (AC 4/5). */
  function handleError(err: unknown): void {
    const mapped = codeErrorOf(err);
    if (mapped.kind === 'gone') {
      gone = true;
      return;
    }
    if (mapped.kind === 'network' || mapped.kind === 'api') {
      banner = { kind: mapped.kind, text: mapped.text };
      return;
    }
    codeError = mapped.kind;
    flashShake();
  }

  // ?code=NNNNNN deep link: prefill + auto-submit exactly once (AC 3).
  let autoSubmitted = false;
  $effect(() => {
    if (autoSubmitted) return;
    if (
      deepLinkCode !== null &&
      isValidInviteCode(deepLinkCode) &&
      !resolving &&
      flow.step === 'code'
    ) {
      autoSubmitted = true;
      void submitCode(deepLinkCode);
    }
  });

  // --- Step 2: room options -------------------------------------------------

  function chooseCreate(): void {
    personaError = null;
    flow = reduce(flow, { type: 'choose-create' });
  }

  function chooseImport(): void {
    personaError = null;
    vaultDead = null;
    // The vault is read from localStorage fresh every visit (entries are
    // appended by creation and never removed — append-only).
    vaultEntries = listVaultEntries();
    flow = reduce(flow, { type: 'choose-import' });
  }

  // --- Step 3b: vault import (one credentialed read per selection, §10.6) ---

  async function pickVaultEntry(entry: VaultEntry): Promise<void> {
    if (vaultLoading) return;
    vaultLoading = true;
    vaultDead = null;
    try {
      // The old persona is read WITH ITS STORED TOKEN (full fields incl.
      // private_bio; a stale token's 401 goes through the global §2.8 gate).
      const user = await readVaultPersona(entry);
      flow = reduce(flow, { type: 'vault-picked', user });
    } catch (err) {
      const mapped = vaultErrorOf(err);
      if (mapped.kind === 'auth') {
        // Global gate (§2.8): identity cleared + notice card on `/` — the
        // vault entry itself is untouched (append-only). Nothing to render.
        return;
      }
      if (mapped.kind === 'network') {
        banner = { kind: 'network', text: null };
        return;
      }
      // Dead persona: honest error on the row; the entry stays listed.
      vaultDead = { address: entry.userAddress, text: mapped.text };
    } finally {
      vaultLoading = false;
    }
  }

  // --- Step 3a/3b submit: create the persona --------------------------------

  async function submitPersona(draft: PersonaDraft): Promise<void> {
    const room = flow.room;
    if (!room || creating) return;
    personaError = null;
    creating = true;
    try {
      // generateTokenSecret() → POST createRoomUser (invite_code + raw
      // token in the body, NO auth header).
      const { user, token } = await createPersona(room.address, flow.code, draft);
      // Identity + vault entry written ONLY after the 2xx (§10.6).
      saveIdentity({ roomAddress: room.address, userAddress: user.address, token });
      appendVaultEntry({
        roomAddress: room.address,
        userAddress: user.address,
        token,
        name: user.name,
        savedAt: new Date().toISOString()
      });
      void goto(resolve('/room'));
    } catch (err) {
      const mapped = personaErrorOf(err);
      if (mapped.kind === 'gone') {
        gone = true;
      } else {
        personaError = mapped;
      }
    } finally {
      creating = false;
    }
  }

  // --- Scanner mount (context *a*, QrScanner public API only) ---------------

  function handleInviteCode(code: string): void {
    // A detected invite code enters Step 1 exactly as if typed (§3.1 AC 18):
    // scanner closed by itself, digits filled, auto-resolution.
    flow = reduce(flow, { type: 'code-input', code });
    void submitCode(code);
  }

  function handleScannerClosed(): void {
    // X / Escape / manual fallback (AC 18): back to Step 1, digits intact,
    // focus returns to the cells.
    scannerOpen = false;
    codeEntry?.focusCode();
  }
</script>

<div class="join">
  <span class="logo pixel-corners">{translate($locale, 'app.title')}</span>

  {#if gone}
    <section class="card pixel-corners gone-card">
      <h2>{translate($locale, 'join.error.gone')}</h2>
      <button type="button" class="cta" onclick={backToStep1}>
        {translate($locale, 'join.change_code')}
      </button>
    </section>
  {:else}
    {#if banner}
      <ErrorBanner
        kind={banner.kind}
        message={banner.text}
        onretry={() => {
          if (flow.step === 'code') void submitCode(flow.code);
        }}
      />
    {/if}

    {#if flow.step !== 'code'}
      <h1 class="vh">{translate($locale, 'join.title')}</h1>
    {/if}

    <section class="card pixel-corners">
      {#if flow.step === 'code'}
        <CodeEntry
          bind:this={codeEntry}
          bind:code={flow.code}
          disabled={resolving}
          error={codeError}
          {shakeKey}
          onsubmit={(code) => void submitCode(code)}
          onscan={() => (scannerOpen = true)}
        />
      {:else if flow.step === 'room' && flow.room}
        <RoomPreview
          room={flow.room}
          memberCount={flow.members.length}
          oncreate={chooseCreate}
          onimport={chooseImport}
          onchange={backToStep1}
        />
      {:else if flow.step === 'persona'}
        <PersonaForm
          prefill={flow.prefill}
          error={personaError}
          pending={creating}
          onsubmit={(draft) => void submitPersona(draft)}
          onback={() => (flow = reduce(flow, { type: 'back' }))}
        />
      {:else if flow.step === 'vault'}
        <VaultList
          entries={vaultEntries}
          loading={vaultLoading}
          dead={vaultDead}
          onpick={(entry) => void pickVaultEntry(entry)}
          onback={() => (flow = reduce(flow, { type: 'back' }))}
          oncreate={chooseCreate}
        />
      {/if}
    </section>
  {/if}
</div>

{#if !gone}
  <!-- Scanner overlay, context (a) — the invite-QR flow; the persona
       deep-link routine is NOT the scanner (DeepLinkHandshake on the route). -->
  <QrScanner
    bind:open={scannerOpen}
    context="invite"
    onInviteCode={handleInviteCode}
    onClosed={handleScannerClosed}
  />
{/if}

<style>
  .join {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-5);
    padding: var(--space-7) var(--space-5) var(--space-6);
    width: 100%;
    max-width: 480px;
    margin: 0 auto;
  }
  .logo {
    font-family: var(--font-pixel);
    font-size: 40px;
    line-height: 1;
    background: var(--color-surface);
    padding: var(--space-3) var(--space-5);
  }
  .card {
    width: 100%;
    padding: var(--space-5);
  }
  .gone-card {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    text-align: center;
  }
  .gone-card h2 {
    font-size: 28px;
  }
  .vh {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
  }
  @media (min-width: 720px) {
    .join {
      justify-content: center;
      max-width: 480px;
    }
  }
</style>
