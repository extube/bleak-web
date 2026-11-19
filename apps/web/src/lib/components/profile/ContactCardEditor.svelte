<script lang="ts">
  /**
   * ContactCardEditor (DESIGN §4.13.3 item 1, Concept §13.1.3): the LOCAL
   * contact-card field in /profile/settings — one free-text string
   * (≤255 symbols, e.g. "telegram: @handle") persisted per room|user in
   * `bleak.contactCard` (stores/contactCard.ts). There is NO backend user
   * field — the save is a purely local write; the card content is what the
   * dialog's share slide sends as POST /api/contact content.
   *
   * The 255-symbol cap mirrors the server MaxContactContentLen and the
   * tz5-01 client pre-flight; the input enforces it locally (maxLength +
   * counter).
   */
  import { locale, translate } from '#lib/i18n/locale';
  import { MAX_CONTACT_CARD } from '#lib/stores/contactCard';

  interface Props {
    /** The persona's stored card text (prefill; may be empty). */
    initial?: string;
    onsave?: (text: string) => void;
    oncancel?: () => void;
  }

  let { initial = '', onsave, oncancel }: Props = $props();

  let text = $state(initial);

  const counter = $derived(
    translate($locale, 'profile.greeting.counter', { n: String(text.length) })
  );
</script>

<section class="editor pixel-corners">
  <h2>{translate($locale, 'profile.contact.edit')}</h2>
  <p class="caption">{translate($locale, 'profile.contact.note')}</p>

  <label class="field">
    <span class="field-label">{translate($locale, 'profile.contact.label')}</span>
    <!-- maxlength is the client-side cap; the store clamps again on save -->
    <input maxlength={MAX_CONTACT_CARD} bind:value={text} />
  </label>
  <span class="counter">{counter}</span>

  <div class="actions">
    <button type="button" class="ghost" onclick={() => oncancel?.()}>
      {translate($locale, 'common.cancel')}
    </button>
    <button type="button" class="cta" onclick={() => onsave?.(text)}>
      {translate($locale, 'common.save')}
    </button>
  </div>
</section>

<style>
  .editor {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    background: var(--color-surface);
    border-radius: var(--radius-lg);
    padding: var(--space-5);
    text-align: left;
  }
  .editor h2 {
    font-size: 24px;
  }
  .caption {
    margin: 0;
    font-size: 14px;
    color: var(--color-text-muted);
  }
  .field {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  .field-label {
    font-size: 14px;
    color: var(--color-text-muted);
  }
  input {
    min-height: var(--touch-target);
    padding: 0 var(--space-4);
    background: transparent;
    border: 1px solid var(--color-text-disabled-strong);
    border-radius: var(--radius-md);
    color: var(--color-text);
    font-family: var(--font-body);
    font-size: 14px;
  }
  input:focus {
    outline: none;
    border-color: var(--color-accent);
  }
  .counter {
    font-size: 12px;
    color: var(--color-text-muted);
    align-self: flex-end;
    margin-top: calc(var(--space-2) * -1);
  }
  .actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-3);
    margin-top: var(--space-2);
  }
  .ghost,
  .cta {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    min-height: var(--touch-target);
    padding: 0 var(--space-5);
    border-radius: var(--radius-pill);
    font-weight: 600;
    font-size: 14px;
    transition: opacity 120ms ease-out;
  }
  .ghost {
    background: transparent;
    border: 1px solid var(--color-text-disabled-strong);
    color: var(--color-text);
  }
  .cta {
    background: var(--color-accent);
    color: var(--color-accent-ink);
    border: none;
  }
</style>
