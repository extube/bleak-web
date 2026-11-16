<script lang="ts">
  /**
   * NoticeCard (DESIGN §2.8): the global 401 gate notice on `/`. Rendered
   * above the Step-1 code card when the `bleak.authNotice` sessionStorage
   * flag is consumed on mount. Binding copy (Concept §6.1); announced
   * `aria-live="polite"`; NO retry and NO reload affordance — the only way
   * forward is the join flow itself (the credential is dead).
   */
  import { locale, translate } from '#lib/i18n/locale';
  import PixelIcon from '#lib/components/icons/PixelIcon.svelte';
</script>

<section class="notice pixel-corners" role="alert" aria-live="polite">
  <PixelIcon name="lock" size={16} />
  <p>{translate($locale, 'auth.401.notice')}</p>
</section>

<style>
  .notice {
    display: flex;
    align-items: flex-start;
    gap: var(--space-3);
    width: 100%;
    padding: var(--space-4);
    background: var(--color-surface);
    color: var(--color-text);
    text-align: left;
  }
  .notice :global(svg) {
    color: var(--color-accent);
    flex-shrink: 0;
    margin-top: 2px;
  }
  p {
    margin: 0;
    font-size: 14px;
    line-height: 1.5;
  }
</style>
