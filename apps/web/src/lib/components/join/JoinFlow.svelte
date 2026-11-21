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
   * after a 2xx; the §2.9 invite-code rejection is a first-class inline
   * state.
   *
   * v2.4 (Concept §10.1.1, DESIGN §4.11.1 — amends §6.2 import semantics):
   * the vault screen is RETURN TO EVENT — reachable from Step 1 when the
   * device vault is non-empty (the path back after "join another event").
   * Picking a saved persona validates its stored token (one credentialed
   * read) and enters THAT room: identity restore via saveIdentity → the
   * same post-join `/room` path a normal join takes. No re-creation, no
   * persona POST. A dead/stale entry (404/401/403) shows the dead-note on
   * the row and does not enter (a 401 also trips the global §2.8 gate).
   *
   * v3.9 (Concept §22.3 item 2, DESIGN §4.16.2): the single-form persona
   * step is replaced by the chat-style CreationWizard; the interview's
   * selected interests are flushed through ONE bulk addUserInterests call
   * AFTER the persona 2xx (identity saved first — the auto-injected
   * persona credential carries the Bearer; §13.1.1). A flush failure does
   * not undo the creation: the flow still enters the room, no mirror row
   * is written, and interests stay editable later in /profile.
   *
   * §23.2 5.9 (owner amendment, Concept §23.2.5.9 / DESIGN §4.15.6.4): the
   * fade treatment covers EVERY step boundary of the creation path — the
   * join card's content fades in on every flow-step swap (form → wizard
   * intro included) and fades out into /room after the creation 2xx.
   */
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { locale, translate } from '#lib/i18n/locale';
  import { saveIdentity } from '#lib/stores/identity';
  import { saveContactCard } from '#lib/stores/contactCard';
  import { saveInterests } from '#lib/stores/interests';
  // §23.2 5.5: the stored title is the THEMES composition
  // `'<theme slug>:<topic slug>'` (e.g. `sport:hockey`) — the numeric
  // (group, key) pair keeps the server contract.
  import { interestApiTitle, INTEREST_CATALOG } from '#lib/interests/catalog';
  import { api } from '#lib/api/client';
  import { appendVaultEntry, listVaultEntries, type VaultEntry } from '#lib/stores/tokenVault';
  import {
    codeErrorOf,
    createPersona,
    initialJoinState,
    isValidInviteCode,
    personaErrorOf,
    reduce,
    resolveRoomByCode,
    vaultErrorOf,
    verifyVaultEntry,
    type JoinState,
    type PersonaDraft,
    type PersonaError
  } from '#lib/join';
  import ErrorBanner from '#lib/components/ErrorBanner.svelte';
  import QrScanner from '#lib/components/QrScanner.svelte';
  import CodeEntry from './CodeEntry.svelte';
  import RoomPreview from './RoomPreview.svelte';
  import CreationWizard from './CreationWizard.svelte';
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
  // §23.2 5.9 (owner amendment, DESIGN §4.15.6.4): the boundary OUT of the
  // loading step — the card fades out (the same opacity treatment) before
  // the route hand-off into /room. The /room page mount itself is outside
  // this card's scope; the fade-out IS the join-side treatment.
  let enteringRoom = $state(false);
  // §24 item 5: the step fades run slower (the 400ms opacity treatment —
  // the goto waits out the fade so the boundary stays one motion).
  const FADE_MS = 400;
  const reducedMotion =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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

  // --- The return screen (Step 1 entry point, Concept §10.1.1) --------------

  /** The Step-1 "return to event" entry: shown only when the device vault
   * holds at least one saved persona (the path BACK after "join another
   * event"). Read once at mount — the vault is append-only and every write
   * is followed by navigation away from `/`. */
  const canReturn: boolean = listVaultEntries().length > 0;

  function chooseReturn(): void {
    vaultDead = null;
    // The vault is read from localStorage fresh every visit (entries are
    // appended by creation and never removed — append-only).
    vaultEntries = listVaultEntries();
    flow = reduce(flow, { type: 'choose-return' });
  }

  // --- Return flow: one credentialed validation read per selection ----------

  async function pickVaultEntry(entry: VaultEntry): Promise<void> {
    if (vaultLoading) return;
    vaultLoading = true;
    vaultDead = null;
    try {
      // The stored token is validated with the documented explicit-token
      // read (§10.6); a stale token's 401 goes through the global §2.8 gate.
      await verifyVaultEntry(entry);
      // Identity restore — NO re-creation (Concept §10.1.1): the vault
      // entry IS the credential; the same post-join path a normal join
      // takes. The vault entry itself is untouched (already stored).
      saveIdentity({
        roomAddress: entry.roomAddress,
        userAddress: entry.userAddress,
        token: entry.token
      });
      void goto(resolve('/room'));
    } catch (err) {
      const mapped = vaultErrorOf(err);
      if (mapped.kind === 'network') {
        banner = { kind: 'network', text: null };
        return;
      }
      // Dead/stale entry (404/401/403): the existing dead-note treatment on
      // the row — the entry stays listed (append-only) and we do NOT enter.
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
      // token in the body, NO auth header; the wizard draft adds NOTHING
      // to the wire — same request shape as before the wizard).
      const { user, token } = await createPersona(room.address, flow.code, draft);
      // Identity + vault entry written ONLY after the 2xx (§10.6).
      saveIdentity({ roomAddress: room.address, userAddress: user.address, token });
      // §4.14.3 (Concept §14.1.3): the contact field is client-LOCAL —
      // persisted to the contactCard store (room|user scope) only after
      // the 2xx; a failed creation persists nothing. The store clamps to
      // the 255 cap again; never sent to the backend.
      saveContactCard(room.address, user.address, draft.contact ?? '');
      appendVaultEntry({
        roomAddress: room.address,
        userAddress: user.address,
        token,
        name: user.name,
        savedAt: new Date().toISOString()
      });
      // §13.1.1 + §23.2 5.5: the interview's topics are flushed AFTER the
      // 2xx — one bulk addUserInterests (the just-saved identity carries
      // the auto-injected Bearer) with the THEMES title composition; the
      // 201 FULL list mirrors into the local store. A flush failure does
      // not undo the creation: the flow still enters the room, no mirror
      // row is written (interests are creation-only per §23.2 5.6 — the
      // badge renders whatever was mirrored).
      const keys = draft.interests ?? [];
      if (keys.length > 0) {
        const rows = keys.flatMap((key) => {
          const entry = INTEREST_CATALOG.find((e) => e.key === key);
          return entry
            ? [{ title: interestApiTitle(entry), group: entry.group, key: entry.key }]
            : [];
        });
        if (rows.length > 0) {
          try {
            const list = await api.addUserInterests(room.address, user.address, rows);
            saveInterests(room.address, user.address, list);
          } catch {
            /* interests are optional — the creation stands */
          }
        }
      }
      // §23.2 5.9: the loading → /room boundary — the card fades out with
      // the SAME 400ms opacity treatment (§24 item 5), then the route
      // hands off into
      // /room. Under prefers-reduced-motion the base.css catch-all
      // collapses the fade, so the navigation is immediate.
      enteringRoom = true;
      if (!reducedMotion) await new Promise((r) => setTimeout(r, FADE_MS));
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

<div class="join" class:persona-step={flow.step === 'persona'}>
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

    <!-- §23.2 5.2: the wizard's persona card is a flex column — the
         composer pins to its bottom and the chat log scrolls. -->
    <section
      class="card pixel-corners"
      class:composer-card={flow.step === 'persona'}
      class:leaving={enteringRoom}
    >
      <!-- §23.2 5.9 (owner amendment, DESIGN §4.15.6.4): the card content
           mounts fresh on every join-step swap (code ⇄ preview ⇄ wizard ⇄
           vault) and replays the fade there. -->
      {#key flow.step}
        <div class="stage">
        {#if flow.step === 'code'}
          <CodeEntry
            bind:this={codeEntry}
            bind:code={flow.code}
            disabled={resolving}
            error={codeError}
            {shakeKey}
            onsubmit={(code) => void submitCode(code)}
            onscan={() => (scannerOpen = true)}
            onreturn={canReturn ? chooseReturn : undefined}
          />
        {:else if flow.step === 'room' && flow.room}
          <RoomPreview
            room={flow.room}
            memberCount={flow.members.length}
            oncreate={chooseCreate}
            onchange={backToStep1}
          />
        {:else if flow.step === 'persona'}
          <CreationWizard
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
          />
        {/if}
        </div>
      {/key}
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
  .card {
    width: 100%;
    padding: var(--space-5);
  }
  /* tz11-06 bug round (task 107, DESIGN §4.16.1 item 12): the persona chat
   * bounds its height to the viewport. `.join` is a flex item of the
   * min-height:100dvh app-shell — without min-height: 0 its automatic
   * minimum size grows with the chat's content, so the PAGE scrolled (the
   * log's flex:1 never engaged, logEl.scrollTo was a no-op) and the sticky
   * composer overlayed the newest bubble. Scoped to the persona step only:
   * the other join steps keep their content-driven block layout. */
  .join.persona-step {
    min-height: 0;
  }
  /* tz11-08 (task 109, bug round 2 — the task-107 RECURRENCE): task 107
   * bounded this component's own flex links (above), but the real rendered
   * app has ONE more flex item above this component: routes/+page.svelte
   * renders JoinFlow inside its own <div class="join"> wrapper (flex: 1,
   * max-width: 480px, vertical paddings — no min-height). That wrapper's
   * automatic minimum size still grew with the transcript, so the
   * min-height: 100dvh app-shell resolved taller than the viewport, the
   * PAGE was the scroll container, the log's flex: 1 + overflow-y never
   * engaged and logEl.scrollTo stayed a visual no-op (scrollHeight ==
   * clientHeight) — the owner saw the bug again. The wrapper is outside
   * this component's DOM and :has() is the only parent-reach a child
   * stylesheet has; the persona-step gate keeps the OTHER join steps'
   * content-driven wrapper geometry untouched (code/vault/resume). This
   * also frees the Concept §25 conduit: the wrapper's 480px cap + desktop
   * vertical paddings were clipping the 750–850px full-height column. */
  :global(.app-shell > .join:has(> .persona-step)) {
    min-height: 0;
    max-width: none;
    padding: 0;
  }
  /* §23.2 5.9 (owner amendment, DESIGN §4.15.6.4): the card content
   * mounts fresh on every join-step swap (code ⇄ preview ⇄ wizard ⇄
   * vault) and replays the ONE fade treatment — 400ms opacity-only
   * (§24 item 5), the sheets' established fade (base.css reduced-motion
   * catch-all). */
  .stage {
    animation: fade-in 400ms ease-out;
    min-width: 0;
  }
  /* §23.2 5.9: the boundary OUT of the loading step — the card fades out
   * with the same 400ms opacity treatment before the route hand-off into
   * /room (JoinFlow delays the goto by the fade duration; reduced motion
   * navigates immediately — see submitPersona). */
  .card.leaving {
    animation: fade-out 400ms ease-out forwards;
  }
  @keyframes fade-in {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }
  @keyframes fade-out {
    from {
      opacity: 1;
    }
    to {
      opacity: 0;
    }
  }
  /* §23.2 5.2: the wizard's card is a flex column — the CreationWizard
   * fills it (flex: 1), the chat log scrolls and the composer sticks to
   * the bottom. Only the persona step gets the treatment (the other join
   * steps keep their content-driven block layout). tz11-06 (task 107):
   * flex: 1 + min-height: 0 — the card FILLS the viewport height the
   * bounded .join gives it instead of growing with the transcript, so the
   * log (not the page) scrolls and the composer sits BELOW it in normal
   * flow (never overlaying the newest bubble). */
  .card.composer-card {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
  }
  /* §23.2 5.2: the §23.2 5.9 stage wrapper carries the flex column into
   * the wizard — the chat log scrolls and the composer pins to the card
   * bottom exactly as before the wrapper existed. */
  .card.composer-card .stage {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
  }
  .gone-card {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    text-align: center;
  }
  .gone-card h2 {
    font-size: 28px;
    /* Room names are user data — a long unbroken word must not overflow. */
    overflow-wrap: anywhere;
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
    /* §24 item 7b superseded by Concept §25 / DESIGN §4.17 (2026-11-21):
     * the creation chat on desktop is an EXPLICIT 750–850px centered
     * column (not the room-chat approximation) and spans the FULL screen
     * height — the box reaches the window's top and bottom edges (no
     * vertical gutter, no centering; the flex: 1 card fills the bounded
     * height and the composer anchors at the bottom edge). Phone (<720px)
     * keeps the §12 full-screen treatment; size/proportions only — every
     * visual style is untouched. */
    .join.persona-step {
      max-width: 800px;
      padding: 0;
    }
  }
  /* v2.6 (Concept §12, DESIGN §4.12.1 item 5): phone (<720px) full-screen
   * forms — the card becomes the page: full width/height, no rounded
   * floating chrome (the pixel-corner clip is dropped too). One treatment
   * covers every surface rendered in this card — enter-code, import
   * profile and return-to-event (§10.1.1 vault screen); the card's own
   * --space-5 padding is the content gutter. Desktop (min-width: 720px)
   * is unchanged — these overrides live only inside the 719px query. */
  @media (max-width: 719px) {
    .join {
      max-width: none;
      padding: 0;
    }
    .card {
      border-radius: 0;
      clip-path: none;
      flex: 1;
    }
  }
</style>
