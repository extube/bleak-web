<script lang="ts">
  import { t } from '#lib/i18n/locale';
  import PagePlaceholder from '#lib/components/PagePlaceholder.svelte';

  // Feature placeholder: host view — host-token gated room creation,
  // QR + 6-digit code display, live room observation.
</script>

<PagePlaceholder
  title={t('host.title')}
  subtitle={t('host.subtitle')}
  note="Room creation via the helper (host token), QR/code sharing, live monitor."
/>
