<script lang="ts">
  import { t } from '#lib/i18n/locale';
  import PagePlaceholder from '#lib/components/PagePlaceholder.svelte';

  // Feature placeholder: persona card (badge) — greeting, interests (mock),
  // personal QR, stats. Mock interests model shape: see ARCHITECTURE.md.
</script>

<PagePlaceholder
  title={t('profile.title')}
  subtitle={t('profile.subtitle')}
  note="Greeting editing, bios, mock interests and locale switch land here."
/>
