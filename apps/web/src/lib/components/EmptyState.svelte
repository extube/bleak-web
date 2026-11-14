<script lang="ts">
  /**
   * EmptyState (DESIGN §2.1): a pixel-art glyph, one sentence, and — where
   * an action exists — one CTA. Copy per page comes in via props; the
   * glyph uses the shared pixel-icon language.
   */
  import PixelIcon from './icons/PixelIcon.svelte';
  import { resolve } from '$app/paths';
  import type { IconName } from './icons/registry';

  /** Literal in-app routes allowed as CTA targets (resolve()-typed). */
  type EmptyStateRoute = '/people' | '/chats' | '/room' | '/profile' | '/host';

  interface Props {
    message: string;
    icon?: IconName;
    ctaLabel?: string;
    /** In-app navigation target resolved as a literal route. */
    href?: EmptyStateRoute;
    oncta?: () => void;
  }

  let { message, icon = 'radar-dot', ctaLabel, href, oncta }: Props = $props();
</script>

<div class="empty-state">
  <PixelIcon name={icon} size={16} />
  <p class="message">{message}</p>
  {#if ctaLabel && href}
    <a class="cta" href={resolve(href)}>{ctaLabel}</a>
  {:else if ctaLabel && oncta}
    <button type="button" class="cta" onclick={oncta}>{ctaLabel}</button>
  {/if}
</div>

<style>
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-4);
    text-align: center;
    padding: var(--space-7) var(--space-5);
    color: var(--color-text-muted);
  }
  .message {
    margin: 0;
    max-width: 32ch;
    font-size: 14px;
    letter-spacing: 0.02em;
  }
  .cta {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: var(--touch-target);
    padding: 0 var(--space-5);
    border: none;
    border-radius: var(--radius-pill);
    background: var(--color-accent);
    color: var(--color-accent-ink);
    font-weight: 600;
    font-size: 14px;
    transition: opacity 120ms ease-out;
  }
</style>
