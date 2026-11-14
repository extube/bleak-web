<script lang="ts">
  /**
   * DigitInput (DESIGN §3.1 spec): six single-character cells, 56px,
   * numeric inputmode, auto-advance, backspace-retreat, paste-fill,
   * invalid characters rejected silently. The bindable `value` is always a
   * prefix-filled digit string (length ≤ 6); `oncomplete` fires when all
   * six digits are present (deep-link auto-submit).
   */
  import { locale, translate } from '#lib/i18n/locale';
  import { sanitizeDigits } from '#lib/code-input';

  interface Props {
    value?: string;
    disabled?: boolean;
    /** Group aria-label (defaults to the i18n invite-code label). */
    label?: string;
    oncomplete?: (code: string) => void;
  }

  let { value = $bindable(''), disabled = false, label = '', oncomplete }: Props = $props();

  const LENGTH = 6;

  let cells: Array<HTMLInputElement | null> = $state(Array.from({ length: LENGTH }, () => null));

  const chars = $derived.by(() => {
    const out: string[] = [];
    for (let i = 0; i < LENGTH; i += 1) out.push(value[i] ?? '');
    return out;
  });

  // Keep the DOM cells aligned with the value at all times (deep-link
  // prefill, retreat deletions): typed inputs are "dirty", so value
  // attribute updates alone do not move .value.
  $effect.pre(() => {
    syncInputs(chars);
  });

  const groupLabel = $derived(label || translate($locale, 'join.code.label'));

  // Fire completion once all six digits are present (also covers the
  // deep-link prefill: the code submits automatically, §3.1).
  $effect(() => {
    if (value.length === LENGTH) oncomplete?.(value);
  });

  function focusCell(index: number): void {
    cells[Math.max(0, Math.min(LENGTH - 1, index))]?.focus();
  }

  /** Replace the character at `index`, keeping the prefix-filled shape. */
  function assignChar(index: number, char: string): void {
    const next = [...chars];
    next[index] = char;
    value = next.join('');
  }

  function handleInput(index: number, event: Event): void {
    const input = event.currentTarget as HTMLInputElement;
    const typed = sanitizeDigits(input.value);
    if (typed.length === 0) {
      // cell cleared (select + delete / cut)
      assignChar(index, '');
      input.value = '';
      return;
    }
    const next = [...chars];
    let cursor = index;
    for (const ch of typed) {
      if (cursor >= LENGTH) break;
      next[cursor] = ch;
      cursor += 1;
    }
    value = next.join('');
    syncInputs(next);
    focusCell(Math.min(cursor, LENGTH - 1));
  }

  function handleKeydown(index: number, event: KeyboardEvent): void {
    if (event.key === 'Backspace') {
      const cell = cells[index];
      if (chars[index] === '' && index > 0) {
        // backspace-retreat: empty cell moves focus to the previous one
        event.preventDefault();
        assignChar(index - 1, '');
        focusCell(index - 1);
      } else if (cell) {
        event.preventDefault();
        assignChar(index, '');
        cell.value = '';
      }
    } else if (event.key === 'ArrowLeft' && index > 0) {
      event.preventDefault();
      focusCell(index - 1);
    } else if (event.key === 'ArrowRight' && index < LENGTH - 1) {
      event.preventDefault();
      focusCell(index + 1);
    }
  }

  function handlePaste(index: number, event: ClipboardEvent): void {
    const text = sanitizeDigits(event.clipboardData?.getData('text') ?? '');
    if (!text) return;
    event.preventDefault();
    value = text.slice(0, LENGTH);
    syncInputs(chars);
    focusCell(Math.min(value.length, LENGTH - 1));
  }

  /** Keep the DOM inputs aligned with the (possibly rejected) value. */
  function syncInputs(next: readonly string[]): void {
    for (let i = 0; i < LENGTH; i += 1) {
      const cell = cells[i];
      if (cell) cell.value = next[i] ?? '';
    }
  }
</script>

<div class="digit-input" role="group" aria-label={groupLabel}>
  {#each chars as char, index (index)}
    <input
      bind:this={cells[index]}
      type="text"
      inputmode="numeric"
      autocomplete="one-time-code"
      maxlength="1"
      disabled={disabled}
      value={char}
      aria-label={translate($locale, 'join.code.digit', { n: String(index + 1) })}
      oninput={(event) => handleInput(index, event)}
      onkeydown={(event) => handleKeydown(index, event)}
      onpaste={(event) => handlePaste(index, event)}
      onfocus={(event) => (event.currentTarget as HTMLInputElement).select()}
    />
  {/each}
</div>

<style>
  .digit-input {
    display: flex;
    gap: var(--space-2);
    justify-content: center;
  }
  input {
    width: 56px;
    height: 56px;
    text-align: center;
    font-family: var(--font-body);
    font-size: 24px;
    font-weight: 600;
    color: var(--color-text);
    background: var(--color-surface);
    border: 1px solid var(--color-text-disabled-strong);
    border-radius: var(--radius-md);
    transition: border-color 120ms ease-out;
  }
  input:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: 2px;
  }
  input:disabled {
    color: var(--color-text-disabled);
    border-color: var(--color-text-disabled);
  }
</style>
