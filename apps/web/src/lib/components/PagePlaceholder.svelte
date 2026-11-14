<script lang="ts">
  /** Scaffold placeholder for feature pages — replaced by design/worker phase. */
  let { title, subtitle, note }: { title: string; subtitle?: string; note?: string } = $props();
</script>

<main class="page">
  <header>
    <h1>{title}</h1>
    {#if subtitle}
      <p class="subtitle">{subtitle}</p>
    {/if}
  </header>
  {#if note}
    <p class="note">{note}</p>
  {/if}
</main>

<style>
  .page {
    flex: 1;
    padding: var(--space-6) var(--space-5) calc(var(--bottom-tabbar-height) + var(--space-6));
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }
  h1 {
    font-size: 40px;
  }
  .subtitle {
    color: var(--color-text-muted);
    margin: 0;
  }
  .note {
    color: var(--color-text-disabled-strong);
    margin: 0;
  }
</style>
