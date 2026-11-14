<script lang="ts">
  /** Test fixture: Chip with slotted label content. */
  import Chip from '#lib/components/Chip.svelte';
  import type { ChipVariant } from '#lib/components/Chip.svelte';

  let { variant = 'outline-muted', label = '' }: { variant?: ChipVariant; label?: string } = $props();
</script>

<Chip {variant}>{label}</Chip>
