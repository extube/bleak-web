<script lang="ts">
  /**
   * Locale switch (RU|EN) — the same control on the join card footer and the
   * profile settings (DESIGN §3.1 / §3.6). Persisted by setLocale (§2.3).
   */
  import { locale, setLocale } from '#lib/i18n/locale';
  import { translate } from '#lib/i18n/index';
  import SegmentedControl from '#lib/components/SegmentedControl.svelte';

  const options = [
    { value: 'ru', label: 'RU' },
    { value: 'en', label: 'EN' }
  ];
</script>

<SegmentedControl
  {options}
  value={$locale}
  label={translate($locale, 'common.locale')}
  onchange={(next) => setLocale(next === 'en' ? 'en' : 'ru')}
/>
