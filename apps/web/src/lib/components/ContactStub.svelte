<script lang="ts">
  /**
   * ContactStub (DESIGN §2.1 / ruling 4): the single disabled coming-later
   * element in v1 — the contact-exchange extension point on the chat
   * transcript. Never interactive, never enabled by any flow.
   */
  import { locale, translate } from '#lib/i18n/locale';
  import PixelIcon from './icons/PixelIcon.svelte';

  const stubLabel = $derived(translate($locale, 'chat.contact_stub'));
</script>

<div class="contact-stub" aria-disabled="true">
  <PixelIcon name="lock" size={16} />
  <span>{stubLabel}</span>
</div>

<style>
  .contact-stub {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    min-height: var(--touch-target);
    padding: 0 var(--space-4);
    background: var(--color-surface);
    border-radius: var(--radius-md);
    color: var(--color-text-disabled);
    font-size: 14px;
  }
</style>
