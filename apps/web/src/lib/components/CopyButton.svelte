<script lang="ts">
  /**
   * CopyButton (DESIGN §4.2): clipboard write with the transient
   * «Скопировано» feedback (§3.7 share kit, §3.1 code card).
   */
  import { locale, translate } from '#lib/i18n/locale';

  interface Props {
    /** Value written to the clipboard. */
    value: string;
    /** Visible label when idle (defaults to the i18n "copy"). */
    label?: string;
  }

  let { value, label = '' }: Props = $props();

  let copied = $state(false);
  let timer: ReturnType<typeof setTimeout> | null = null;

  const idleLabel = $derived(label || translate($locale, 'common.copy'));
  const copiedLabel = $derived(translate($locale, 'common.copied'));

  function fallbackCopy(text: string): void {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', 'readonly');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand('copy');
    } catch {
      /* clipboard unavailable — nothing else we can do in-place */
    }
    textarea.remove();
  }

  async function copy(): Promise<void> {
    try {
      if (navigator.clipboard) await navigator.clipboard.writeText(value);
      else fallbackCopy(value);
    } catch {
      fallbackCopy(value);
    }
    copied = true;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => (copied = false), 2000);
  }
</script>

<button type="button" class="copy-button" aria-label={copied ? copiedLabel : idleLabel} onclick={copy}>
  {copied ? copiedLabel : idleLabel}
</button>

<style>
  .copy-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 40px;
    padding: 0 var(--space-4);
    border: 1px solid var(--color-text-disabled-strong);
    background: transparent;
    color: var(--color-text);
    border-radius: var(--radius-pill);
    font-size: 14px;
    font-weight: 600;
    transition:
      border-color 120ms ease-out,
      color 120ms ease-out;
  }
</style>
