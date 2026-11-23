<script lang="ts">
  /**
   * PersonaEditor — the persona FIELD GROUP of /profile/edit (DESIGN
   * §4.29.C.3, v3.23 profile redesign). Previously the inline-swap editor
   * of /profile/settings with its own Save/Cancel CTAs — those are retired
   * (the route owns the ONE full-width Save Changes, §4.29.C.4/I-rec 3);
   * the fields, labels, maxlengths, validators and helper copy carry
   * verbatim: Name (single-line key-value row, maxlength 64, required),
   * Public bio and Private bio (label-above borderless input blocks —
   * I-rec 10), the muted-red «only your agent sees this» caption above the
   * private field (Concept §9.1.1 / DESIGN §4.10.3, carried).
   *
   * Values are BINDABLE (the page owns the save state + the ONE save
   * sequence: `PUT updateRoomUser` sending ALL THREE fields —
   * omitted-field semantics, §3.6). Server errors surface inline.
   */
  import { locale, translate } from '#lib/i18n/locale';

  interface Props {
    name?: string;
    publicBio?: string;
    privateBio?: string;
    /** Client-side name validation from the page (empty → name_required). */
    nameError?: string | null;
    /** Server error mapping from the route ({kind, text}). */
    error?: { kind: 'network' | 'api'; text: string | null } | null;
  }

  let {
    name = $bindable(''),
    publicBio = $bindable(''),
    privateBio = $bindable(''),
    nameError = null,
    error = null
  }: Props = $props();

  const errorMessage = $derived.by(() => {
    if (nameError) return nameError;
    if (!error) return null;
    if (error.kind === 'network') return translate($locale, 'common.error.network');
    return error.text ?? translate($locale, 'common.error');
  });
</script>

<div class="group card pixel-corners">
  <!-- Key-value row (C.3): the muted label left, the right-aligned
       borderless input right. -->
  <div class="kv-row">
    <label class="kv-label" for="profile-edit-name">{translate($locale, 'profile.edit.row.name')}</label>
    <input
      id="profile-edit-name"
      type="text"
      maxlength={64}
      autocomplete="off"
      bind:value={name}
      class:invalid={nameError !== null}
    />
  </div>
  <!-- Multi-line fields use label-ABOVE borderless input blocks (I-rec 10). -->
  <div class="block-row">
    <label class="row-label" for="profile-edit-public">{translate($locale, 'profile.edit.row.public_bio')}</label>
    <input id="profile-edit-public" type="text" maxlength={255} bind:value={publicBio} />
  </div>
  <div class="block-row">
    <label class="row-label" for="profile-edit-private">{translate($locale, 'profile.edit.row.private_bio')}</label>
    <!-- Concept §9.1.1 / DESIGN §4.10.3: the «only your agent sees this»
         heading reverts to the body face (Inter) in a muted red, still
         distinct from the field below it (uppercase, weight). -->
    <p class="private-bio-heading">{translate($locale, 'profile.private_bio.caption')}</p>
    <input id="profile-edit-private" type="text" maxlength={255} bind:value={privateBio} />
  </div>

  {#if errorMessage}
    <p class="field-error" role="alert" aria-live="polite">{errorMessage}</p>
  {/if}
</div>

<style>
  .card {
    display: flex;
    flex-direction: column;
    background: var(--color-surface);
    border-radius: var(--radius-lg);
    padding: var(--space-4) var(--space-5);
  }
  .kv-row {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    /* Single-line key-value row (§4.29.C.3 row anatomy; Concept §50): the
     * label takes ONE shared width (`--kv-label-width`, owned by the
     * /profile/edit page) so every kv row of the form aligns its value
     * input at the same left edge. */
  }
  .kv-label {
    color: var(--color-text-muted);
    font-size: 14px;
    flex: 0 0 var(--kv-label-width, 148px);
    min-width: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .block-row {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }
  /* The 1px divider between rows within the group (C.3 row anatomy). */
  .kv-row + .block-row,
  .block-row + .block-row {
    border-top: 1px solid var(--color-surface-elevated);
    padding-top: var(--space-3);
    margin-top: var(--space-3);
  }
  .row-label {
    color: var(--color-text-muted);
    font-size: 14px;
  }
  input {
    min-height: var(--touch-target);
    background: transparent;
    border: none;
    border-radius: 0;
    color: var(--color-text);
    font-family: var(--font-body);
    font-size: 15px;
    transition: color 120ms ease-out;
  }
  .kv-row input {
    flex: 1;
    min-width: 0;
    text-align: right;
  }
  input:focus {
    outline: none;
    color: var(--color-accent);
  }
  input.invalid {
    color: var(--color-accent);
  }
  /* Concept §10.1.3 / DESIGN §4.11.3: body face (Inter) with a muted red
   * (danger color mixed toward transparency, never solid); no uppercase,
   * and smaller than the content below — size contrast is the hierarchy. */
  .private-bio-heading {
    margin: 0;
    font-family: var(--font-body);
    font-size: 11px;
    font-weight: 600;
    text-transform: none;
    color: color-mix(in srgb, var(--color-danger-text) 70%, transparent);
  }
  .field-error {
    margin: 0;
    color: var(--color-accent);
    font-size: 14px;
  }
</style>
