<script lang="ts">
  import { page } from '$app/state';
  import PagePlaceholder from '#lib/components/PagePlaceholder.svelte';

  // Feature placeholder: one agent dialog (transcript), polled while open.
  const address = $derived(page.params.address ?? 'unknown');
</script>

<PagePlaceholder title={`0xchat: ${address}`} subtitle="Agent dialog transcript (feature placeholder)" />
