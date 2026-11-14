<script lang="ts">
  /**
   * SkeletonBlock (DESIGN §2.1): pre-first-data placeholder mimicking card
   * shapes; opacity pulse only (transform/opacity discipline, §4.6) and
   * disabled under prefers-reduced-motion (base.css global rule).
   */
  interface Props {
    width?: string;
    height?: string;
    /** Round avatar-style skeleton. */
    round?: boolean;
  }

  let { width = '100%', height = '56px', round = false }: Props = $props();
</script>

<div
  class="skeleton pixel-corners"
  class:round
  style:width
  style:height
  aria-hidden="true"
></div>

<style>
  .skeleton {
    background: var(--color-surface-elevated);
    border-radius: var(--radius-md);
    opacity: 0.8;
    animation: pulse 1.2s ease-in-out infinite;
  }
  .skeleton.round {
    border-radius: 50%;
    clip-path: none;
  }
  @keyframes pulse {
    0%,
    100% {
      opacity: 0.4;
    }
    50% {
      opacity: 0.8;
    }
  }
</style>
