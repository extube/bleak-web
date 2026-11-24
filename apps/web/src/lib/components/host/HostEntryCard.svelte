<script module lang="ts">
  /**
   * Address finder (F11, DESIGN §3.7.1): fetch the public room list, probe
   * the candidates with the ENTERED key through the invite-list GET —
   * BOUNDED: concurrency ≤ 4, cap 25 rooms, stop at the first 200. PURE:
   * the finder never writes storage — only the successful log-in
   * validation does. Ports are injected so the bounds tests can count.
   */
  export interface FinderPorts {
    listRooms(): Promise<readonly { address: string }[]>;
    validateKey(address: string, key: string): Promise<unknown>;
  }

  export const FINDER_CONCURRENCY = 4;
  export const FINDER_CAP = 25;

  /**
   * Probe the public room list with `key`. Resolves the matching room (the
   * first invite-list 200), or null when no candidate accepted the key.
   * Per-candidate failures (401/403/404/5xx/network) keep the search going;
   * only a failure of `listRooms` itself propagates (page banner + retry).
   */
  export async function findRoomByKey(
    key: string,
    ports: FinderPorts
  ): Promise<{ address: string } | null> {
    const rooms = await ports.listRooms();
    const candidates = rooms.slice(0, FINDER_CAP);
    let cursor = 0;
    let matched: { address: string } | null = null;
    const workers = Array.from(
      { length: Math.min(FINDER_CONCURRENCY, candidates.length) },
      async () => {
        while (matched === null && cursor < candidates.length) {
          const candidate: { address: string } | undefined = candidates[cursor];
          cursor += 1;
          if (candidate === undefined) break;
          try {
            await ports.validateKey(candidate.address, key);
            if (matched === null) matched = candidate; // first 200 wins
          } catch {
            /* candidate rejected — keep probing */
          }
        }
      }
    );
    await Promise.all(workers);
    return matched;
  }
</script>

<script lang="ts">
  /**
   * HostEntryCard (DESIGN §4.2, rev. 4 §3.7.1; TZ13-02 — extends the retired
   * single-mode TokenGate): one card with a SegmentedControl mode switch
   * («Создать комнату» / «Войти по ключу»). Switching never loses input —
   * both modes' fields live in this component's state and both stay
   * reachable from every state of the page.
   *
   * - Create mode: masked creation token (type=password, autocomplete=off,
   *   MEMORY only — never persisted) + the room form (CreateRoomForm
   *   fields block). The card validates `name` and hands
   *   `{ token, draft }` to the page (which generates the room token and
   *   calls POST /api/room with the creation token in the x-create-token
   *   header).
   * - Log-in mode: room address + masked room key. The page validates the
   *   pair through the pre-credential probe path (§9.4.2); 401/403 come
   *   back as `loginRejected` (value stays masked, nothing stored).
   * - Address finder: the card emits `onfind(key)` with the ENTERED key;
   *   the page runs the bounded probe (module script above) and fills
   *   `address` (bindable) on a match, continuing the normal validation.
   *   While running the card shows «Ищем комнату…» (`finding` prop); the
   *   no-match copy arrives via `findMessage`.
   */
  import { locale, translate } from '#lib/i18n/locale';
  import SegmentedControl from '#lib/components/SegmentedControl.svelte';
  import CreateRoomForm, { type RoomDraft } from './CreateRoomForm.svelte';

  type EntryMode = 'create' | 'login';

  interface Props {
    /** The active entry mode — fully page-controlled: the reset notice and
     * the probe-401 fallback set it (§3.7.1), the switch reports back. */
    mode: EntryMode;
    onmodechange?: (mode: EntryMode) => void;
    // --- create mode -------------------------------------------------------
    creating?: boolean;
    /** Server text (400/409) under the room fields. */
    createError?: string | null;
    /** «Токен отклонён.» + server text under the token field (kept masked). */
    tokenRejected?: string | null;
    oncreate?: (payload: { token: string; draft: RoomDraft }) => void;
    // --- log-in mode -------------------------------------------------------
    /** Room address — bindable: the finder fills it on a match. */
    address?: string;
    loggingIn?: boolean;
    /** «Ключ комнаты отклонён.» + server text under the key field. */
    loginRejected?: string | null;
    onlogin?: (pair: { address: string; key: string }) => void;
    // --- address finder (page-driven; the card triggers + renders states) --
    finding?: boolean;
    /** Inline line above the fields: the no-match copy (honest). */
    findMessage?: string | null;
    onfind?: (key: string) => void;
  }

  let {
    mode,
    onmodechange,
    creating = false,
    createError = null,
    tokenRejected = null,
    oncreate,
    address = $bindable(''),
    loggingIn = false,
    loginRejected = null,
    onlogin,
    finding = false,
    findMessage = null,
    onfind
  }: Props = $props();

  /** The one-time CREATION token — memory only, never persisted (§10.11). */
  let tokenValue = $state('');
  let draft = $state<RoomDraft>({ name: '', description: '', language: 'ru' });
  let nameMissing = $state(false);
  /** Log-in fields — the key stays masked and is never stored on failure. */
  let loginKey = $state('');

  const modeLabel = $derived(translate($locale, 'host.title'));
  const createModeLabel = $derived(translate($locale, 'host.mode.create'));
  const loginModeLabel = $derived(translate($locale, 'host.mode.login'));
  const tokenLabel = $derived(translate($locale, 'host.gate.label'));
  const tokenNote = $derived(translate($locale, 'host.gate.note'));
  const createLabel = $derived(translate($locale, 'host.create'));
  const requiredLabel = $derived(translate($locale, 'join.error.name_required'));
  const addressLabel = $derived(translate($locale, 'host.login.address'));
  const keyLabel = $derived(translate($locale, 'host.login.key'));
  const loginLabel = $derived(translate($locale, 'host.mode.login'));
  const findLabel = $derived(translate($locale, 'host.login.find'));
  const findingLabel = $derived(translate($locale, 'host.login.finding'));

  const roomFieldsError = $derived(nameMissing ? requiredLabel : createError);

  function submitCreate(event: SubmitEvent): void {
    event.preventDefault();
    const token = tokenValue.trim();
    if (token === '' || creating) return;
    if (draft.name.trim() === '') {
      nameMissing = true;
      return;
    }
    nameMissing = false;
    oncreate?.({ token, draft: { ...draft, name: draft.name.trim(), description: draft.description.trim() } });
  }

  function submitLogin(event: SubmitEvent): void {
    event.preventDefault();
    const pair = { address: address.trim(), key: loginKey.trim() };
    if (pair.address === '' || pair.key === '' || loggingIn || finding) return;
    onlogin?.(pair);
  }

  function startFind(): void {
    const key = loginKey.trim();
    if (key === '' || finding || loggingIn) return;
    onfind?.(key);
  }
</script>

<section class="entry card pixel-corners">
  <div class="modes">
    <SegmentedControl
      options={[
        { value: 'create', label: createModeLabel },
        { value: 'login', label: loginModeLabel }
      ]}
      value={mode}
      label={modeLabel}
      onchange={(value) => onmodechange?.(value as EntryMode)}
    />
  </div>

  {#if mode === 'create'}
    <form class="create" onsubmit={submitCreate}>
      <div class="field">
        <label for="host-token">{tokenLabel}</label>
        <input
          id="host-token"
          type="password"
          autocomplete="off"
          bind:value={tokenValue}
          class:invalid={tokenRejected !== null}
        />
      </div>
      {#if tokenRejected}
        <p class="field-error" role="alert" aria-live="polite">{tokenRejected}</p>
      {/if}

      <CreateRoomForm bind:draft error={roomFieldsError} invalidName={nameMissing} />

      <p class="note">{tokenNote}</p>

      <button type="submit" class="cta" disabled={creating}>
        {#if creating}<span class="spinner" aria-hidden="true"></span>{/if}
        {createLabel}
      </button>
    </form>
  {:else}
    <form class="login" onsubmit={submitLogin}>
      {#if finding}
        <p class="finding" role="status" aria-live="polite">{findingLabel}</p>
      {/if}
      {#if findMessage}
        <p class="field-error" role="alert" aria-live="polite">{findMessage}</p>
      {/if}

      <div class="field">
        <label for="host-address">{addressLabel}</label>
        <input id="host-address" type="text" autocomplete="off" bind:value={address} />
      </div>
      <div class="field">
        <label for="host-key">{keyLabel}</label>
        <input
          id="host-key"
          type="password"
          autocomplete="off"
          bind:value={loginKey}
          class:invalid={loginRejected !== null}
        />
      </div>
      {#if loginRejected}
        <p class="field-error" role="alert" aria-live="polite">{loginRejected}</p>
      {/if}

      <button type="button" class="find-link" onclick={startFind} disabled={finding || loggingIn}>
        {findLabel}
      </button>

      <button type="submit" class="cta" disabled={loggingIn || finding}>
        {#if loggingIn}<span class="spinner" aria-hidden="true"></span>{/if}
        {loginLabel}
      </button>
    </form>
  {/if}
</section>

<style>
  .entry {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    max-width: 640px;
    width: 100%;
    align-self: center;
  }
  .modes {
    display: flex;
    justify-content: center;
  }
  /* AC 11: the mode switch meets the ≥ 48px touch-target rule (the shared
   * SegmentedControl defaults to 40px for inline tracks — this page pins it
   * to the touch target without touching the shared component). */
  .modes :global(button) {
    min-height: var(--touch-target);
  }
  .create,
  .login {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
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
    padding: 0 var(--space-4);
    font-size: 16px;
    font-family: var(--font-body);
    transition: border-color 120ms ease-out;
  }
  #host-token,
  #host-key {
    letter-spacing: 0.2em;
  }
  input.invalid {
    border-color: var(--color-accent);
  }
  .field-error,
  .finding {
    margin: 0;
    font-size: 14px;
  }
  .field-error {
    color: var(--color-accent);
  }
  .finding {
    color: var(--color-text-muted);
  }
  .find-link {
    align-self: flex-start;
    background: transparent;
    border: none;
    color: var(--color-text-muted);
    min-height: var(--touch-target);
    font-size: 14px;
    text-decoration: underline;
    cursor: pointer;
  }
  .note {
    margin: 0;
    font-size: 14px;
    color: var(--color-text-muted);
  }
  .cta {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
  }
  .cta:disabled {
    cursor: default;
    filter: saturate(0.4);
  }
  .spinner {
    width: 16px;
    height: 16px;
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
