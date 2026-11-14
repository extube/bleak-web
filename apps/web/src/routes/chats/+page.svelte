<script lang="ts">
  import { t } from '#lib/i18n/locale';
  import PagePlaceholder from '#lib/components/PagePlaceholder.svelte';

  // Feature placeholder: list of chats (mutual handshakes → agent dialogs).
</script>

<PagePlaceholder title={t('chats.title')} subtitle={t('chats.subtitle')} note={t('chats.empty')} />
