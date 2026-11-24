<script lang="ts">
  /**
   * ContactCardEditor — the contact-card FIELD GROUP of /profile/edit
   * (DESIGN §4.29.C.3; the local field per §4.13.3 item 1, Concept
   * §13.1.3). Previously the inline-swap editor of /profile/settings with
   * its own Save/Cancel CTAs — those are retired (the route owns the ONE
   * Save Changes, §4.29.C.4); the label (`profile.contact.edit` — reused,
   * same string/role), the ≤255 input and the helper copy carry verbatim
   * as ONE single-line key-value row.
   *
   * A purely LOCAL field: the persona's card text (≤255 symbols) is stored
   * per room|user in `bleak.contactCard` (stores/contactCard.ts) — no
   * backend user field, no API call on save; the card content is what the
   * dialog's share slide composes into POST /api/contact content.
   *
   * The 255-symbol cap mirrors the server MaxContactContentLen and the
   * tz5-01 client pre-flight; the input enforces it locally (maxLength;
   * the store clamps again on save).
   */
  import { locale, translate } from '#lib/i18n/locale';
  import { MAX_CONTACT_CARD } from '#lib/stores/contactCard';

  interface Props {
    /** The card text (bindable — the page persists it on its save). */
    text?: string;
  }

  let { text = $bindable('') }: Props = $props();
</script>

<div class="group card pixel-corners">
  <!-- Key-value row (C.3): the reused label left, the value input right. -->
  <div class="kv-row">
    <label class="kv-label" for="contact-card-text">{translate($locale, 'profile.contact.edit')}</label>
    <!-- maxlength is the client-side cap; the store clamps again on save -->
    <input id="contact-card-text" maxlength={MAX_CONTACT_CARD} bind:value={text} />
  </div>
  <p class="caption">{translate($locale, 'profile.contact.note')}</p>
</div>

<style>
  .card {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    background: var(--color-surface);
    border-radius: var(--radius-lg);
    padding: var(--space-4) var(--space-5);
  }
  .kv-row {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }
  .kv-label {
    color: var(--color-text-muted);
    font-size: 14px;
    /* Concept §50 shared kv-row spec: the SAME shared label width as the
     * name row (PersonaEditor) — the value inputs align across the two
     * groups at one common left edge, one line, no ragged offsets. */
    flex: 0 0 var(--kv-label-width, 148px);
    min-width: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  input {
    flex: 1;
    min-width: 0;
    min-height: var(--touch-target);
    padding: 0;
    background: transparent;
    border: none;
    border-radius: 0;
    color: var(--color-text);
    font-family: var(--font-body);
    font-size: 15px;
    text-align: right;
    transition: color 120ms ease-out;
  }
  input:focus {
    outline: none;
    color: var(--color-accent);
  }
  .caption {
    margin: 0;
    font-size: 14px;
    color: var(--color-text-muted);
  }
</style>
