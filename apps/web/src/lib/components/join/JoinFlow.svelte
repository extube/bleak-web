<script lang="ts">
  /**
   * JoinFlow (TZ-03) — the Step 1 → 3a/3b state machine for `/` (DESIGN
   * §3.1). The route page passes deep-link values; this component owns the
   * steps, the mount-time API calls (NO Poller on `/`, §2.2), the scanner
   * mount point (context *a*, QrScanner public API only) and every §3.1
   * interaction state.
   */
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { locale, translate } from '#lib/i18n/locale';
  import { saveIdentity } from '#lib/stores/identity';
  import type { Room } from '@bleak/api-client';
  import {
    codeErrorOf,
    createPersona,
    initialJoinState,
    isValidInviteCode,
    listErrorOf,
    listImportPersonas,
    listImportRooms,
    personaErrorOf,
    readImportPersona,
    reduce,
    resolveRoomByCode,
    type JoinState,
    type PersonaDraft,
    type PersonaError
  } from '#lib/join';
  import ErrorBanner from '#lib/components/ErrorBanner.svelte';
  import QrScanner from '#lib/components/QrScanner.svelte';
  import CodeEntry from './CodeEntry.svelte';
  import RoomPreview from './RoomPreview.svelte';
  import PersonaForm from './PersonaForm.svelte';
  import ImportRooms from './ImportRooms.svelte';
  import ImportUsers from './ImportUsers.svelte';

  interface Props {
    /** ?code=NNNNNN deep link (invite QR / link): prefill + auto-submit. */
    deepLinkCode?: string | null;
  }

  let { deepLinkCode = null }: Props = $props();

  let state = $state<JoinState>({
    ...initialJoinState,
    code: deepLinkCode !== null && isValidInviteCode(deepLinkCode) ? deepLinkCode : ''
  });

  let resolving = $state(false);
  let creating = $state(false);
  let codeError = $state<'not_found' | 'malformed' | null>(null);
  let shakeKey = $state(0);
  let banner = $state<{ kind: 'network' | 'api'; text: string | null } | null>(null);
  let gone = $state(false);
  let personaError = $state<{ kind: PersonaError; text: string | null } | null>(null);
  let importRooms = $state<Room[]>([]);
  let importLoading = $state(false);
  let scannerOpen = $state(false);

  let codeEntry: { focusCode(): void } | null = $state(null);

  function flashShake(): void {
    shakeKey += 1;
  }

  function backToStep1(): void {
    gone = false;
    banner = null;
    codeError = null;
    state = reduce(state, { type: 'change-code' });
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
      state = reduce(state, { type: 'resolved', room, members });
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
      state.step === 'code'
    ) {
      autoSubmitted = true;
      void submitCode(deepLinkCode);
    }
  });

  // --- Step 2: room options -------------------------------------------------

  function chooseCreate(): void {
    personaError = null;
    state = reduce(state, { type: 'choose-create' });
  }

  async function chooseImport(): Promise<void> {
    personaError = null;
    state = reduce(state, { type: 'choose-import' });
    importLoading = true;
    try {
      importRooms = await listImportRooms();
    } catch (err) {
      const mapped = listErrorOf(err);
      banner = mapped;
      state = reduce(state, { type: 'back' });
    } finally {
      importLoading = false;
    }
  }

  // --- Step 3b: import (exactly two reads + one create per copy, §8.4) ------

  async function pickImportRoom(room: Room): Promise<void> {
    importLoading = true;
    try {
      const users = await listImportPersonas(room.address);
      state = reduce(state, { type: 'import-room-picked', room, users });
    } catch (err) {
      banner = listErrorOf(err);
    } finally {
      importLoading = false;
    }
  }

  async function pickImportUser(userAddress: string): Promise<void> {
    const room = state.importRoom;
    if (!room) return;
    importLoading = true;
    try {
      // Read 2 of the copy: the persona itself (client-side copy source).
      const user = await readImportPersona(room.address, userAddress);
      state = reduce(state, { type: 'import-user-picked', user });
    } catch (err) {
      banner = listErrorOf(err);
    } finally {
      importLoading = false;
    }
  }

  // --- Step 3a/3b submit: create the persona --------------------------------

  async function submitPersona(draft: PersonaDraft): Promise<void> {
    const room = state.room;
    if (!room || creating) return;
    personaError = null;
    creating = true;
    try {
      const user = await createPersona(room.address, draft);
      saveIdentity({ roomAddress: room.address, userAddress: user.address });
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
    // A detected invite code enters Step 1 exactly as if typed (AC 13):
    // scanner closed by itself, digits filled, auto-resolution.
    state = reduce(state, { type: 'code-input', code });
    void submitCode(code);
  }

  function handleScannerClosed(): void {
    // X / Escape / manual fallback (AC 12): back to Step 1, digits intact,
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
          if (state.step === 'code') void submitCode(state.code);
        }}
      />
    {/if}

    {#if state.step !== 'code'}
      <h1 class="vh">{translate($locale, 'join.title')}</h1>
    {/if}

    <section class="card pixel-corners">
      {#if state.step === 'code'}
        <CodeEntry
          bind:this={codeEntry}
          bind:code={state.code}
          disabled={resolving}
          error={codeError}
          {shakeKey}
          onsubmit={(code) => void submitCode(code)}
          onscan={() => (scannerOpen = true)}
        />
      {:else if state.step === 'room' && state.room}
        <RoomPreview
          room={state.room}
          memberCount={state.members.length}
          oncreate={chooseCreate}
          onimport={() => void chooseImport()}
          onchange={backToStep1}
        />
      {:else if state.step === 'persona'}
        <PersonaForm
          prefill={state.prefill}
          error={personaError}
          pending={creating}
          onsubmit={(draft) => void submitPersona(draft)}
          onback={() => (state = reduce(state, { type: 'back' }))}
        />
      {:else if state.step === 'rooms'}
        <ImportRooms
          rooms={importRooms}
          loading={importLoading}
          onpick={(room) => void pickImportRoom(room)}
          onback={() => (state = reduce(state, { type: 'back' }))}
        />
      {:else if state.step === 'users'}
        <ImportUsers
          users={state.importUsers}
          loading={importLoading}
          onpick={(user) => void pickImportUser(user.address)}
          onback={() => (state = reduce(state, { type: 'back' }))}
        />
      {/if}
    </section>
  {/if}
</div>

{#if !gone}
  <!-- Scanner overlay, context (a) — the placeholder shows a static panel
       until TZ-04 swaps the body in place (same props, same callbacks). -->
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
