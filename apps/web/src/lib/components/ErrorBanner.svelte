<script lang="ts">
  /**
   * ErrorBanner (DESIGN §2.1): pinned to the top of the page content area.
   * NetworkError keeps the poller alive (auto-dismisses on recovery);
   * ApiError shows the server's plain-text body and recovers manually.
   * Copy comes from the i18n dictionaries (§4.7).
   */
  import { locale, translate } from '#lib/i18n/locale';
  import PixelIcon from './icons/PixelIcon.svelte';

  interface Props {
    /** network: venue Wi-Fi died (poller keeps retrying); api: server error. */
    kind?: 'network' | 'api';
    /** Server text for ApiError bodies. */
    message?: string | null;
    /** Present → the Retry button renders and forces an immediate refresh. */
    onretry?: () => void;
  }

  let { kind = 'network', message = null, onretry }: Props = $props();

  const title = $derived(
    kind === 'api' ? translate($locale, 'common.error.api') : translate($locale, 'common.error.network')
  );
  const retryLabel = $derived(translate($locale, 'common.retry'));
</script>

<div class="error-banner pixel-corners" role="alert">
  <PixelIcon name="close" size={16} />
  <div class="texts">
    <p class="title">{title}</p>
    {#if kind === 'api' && message}
      <p class="detail">{message}</p>
    {/if}
  </div>
  {#if onretry}
    <button type="button" onclick={onretry}>{retryLabel}</button>
  {/if}
</div>

<style>
  .error-banner {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-3) var(--space-4);
    background: var(--color-surface);
    border-radius: var(--radius-md);
    margin-bottom: var(--space-4);
  }
  .texts {
    flex: 1;
    min-width: 0;
  }
  .title {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
    color: var(--color-text);
  }
  .detail {
    margin: 2px 0 0;
    font-size: 14px;
    color: var(--color-text-muted);
    overflow-wrap: anywhere;
  }
  button {
    background: transparent;
    border: 1px solid var(--color-text-disabled-strong);
    color: var(--color-text);
    border-radius: var(--radius-pill);
    min-height: var(--touch-target);
    padding: 0 var(--space-4);
    font-size: 14px;
    font-weight: 600;
    transition: color 120ms ease-out;
  }
</style>
