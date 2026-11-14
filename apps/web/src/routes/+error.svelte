<script lang="ts">
  import { page } from '$app/state';
</script>

<main class="error">
  <h1>{page.status}</h1>
  <p>{page.error?.message ?? 'Unexpected error'}</p>
</main>

<style>
  .error {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--space-3);
    padding: var(--space-6);
  }
</style>
