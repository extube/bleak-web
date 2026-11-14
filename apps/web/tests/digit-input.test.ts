/** DigitInput render tests (TZ-02): cells, validation, advance/retreat,
 * paste-fill (§3.1 spec). */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/svelte';
import { tick } from 'svelte';
import DigitInput from '../src/lib/components/DigitInput.svelte';

afterEach(() => {
  cleanup();
});

function cells(): HTMLInputElement[] {
  return screen.getAllByRole('textbox') as HTMLInputElement[];
}

function type(index: number, value: string): void {
  const input = cells()[index] as HTMLInputElement;
  input.value = value;
  fireEvent.input(input, { target: { value } });
}

describe('DigitInput', () => {
  it('renders six labelled cells inside one labelled group', () => {
    render(DigitInput, { props: {} });
    const group = screen.getByRole('group', { name: 'Код приглашения' });
    expect(group).toBeTruthy();
    expect(cells()).toHaveLength(6);
    expect(screen.getByRole('textbox', { name: 'цифра 1' })).toBeTruthy();
    expect(screen.getByRole('textbox', { name: 'цифра 6' })).toBeTruthy();
  });

  it('typing digits fills the value in order and enables completion', async () => {
    const oncomplete = vi.fn();
    render(DigitInput, { props: { oncomplete } });
    const inputs = cells();
    ['1', '2', '3', '4', '5', '6'].forEach((digit, i) => type(i, digit));
    await tick();
    expect(inputs.map((c) => c.value).join('')).toBe('123456');
    expect(oncomplete).toHaveBeenCalledWith('123456');
  });

  it('rejects invalid characters silently', () => {
    const oncomplete = vi.fn();
    render(DigitInput, { props: { oncomplete } });
    type(0, 'a');
    expect(cells()[0]?.value).toBe('');
    type(1, 'x9');
    // 'x9' → sanitized to '9'
    expect(cells()[1]?.value).toBe('9');
    expect(oncomplete).not.toHaveBeenCalled();
  });

  it('advances focus to the next cell after typing (auto-advance)', () => {
    render(DigitInput, { props: {} });
    type(0, '5');
    expect(document.activeElement).toBe(cells()[1]);
  });

  it('backspace on an empty cell retreats to the previous cell', async () => {
    render(DigitInput, { props: {} });
    const inputs = cells();
    type(0, '1');
    type(1, '2');
    // backspace on a filled cell clears it in place
    fireEvent.keyDown(inputs[1] as HTMLInputElement, { key: 'Backspace' });
    expect(cells()[1]?.value).toBe('');
    // backspace again (now-empty cell) retreats to the previous cell
    fireEvent.keyDown(inputs[1] as HTMLInputElement, { key: 'Backspace' });
    await tick();
    expect(document.activeElement).toBe(inputs[0]);
    expect(cells()[0]?.value).toBe('');
  });

  it('paste of a 6-digit string fills the sanitized digits across cells', () => {
    const oncomplete = vi.fn();
    render(DigitInput, { props: { oncomplete } });
    const first = cells()[0] as HTMLInputElement;
    // '42ab65' → sanitized '4265' (4 digits, junk rejected silently)
    fireEvent.paste(first, { clipboardData: { getData: () => '42ab65' } });
    expect(cells()[0]?.value).toBe('4');
    expect(cells()[1]?.value).toBe('2');
    expect(cells()[2]?.value).toBe('6');
    expect(cells()[3]?.value).toBe('5');
    expect(oncomplete).not.toHaveBeenCalled();
  });

  it('paste of a full 6-digit string completes and fires oncomplete', async () => {
    const oncomplete = vi.fn();
    render(DigitInput, { props: { oncomplete } });
    const first = cells()[0] as HTMLInputElement;
    fireEvent.paste(first, { clipboardData: { getData: () => '654321' } });
    await tick();
    expect(cells().map((c) => c.value).join('')).toBe('654321');
    expect(oncomplete).toHaveBeenCalledWith('654321');
  });

  it('fires oncomplete exactly with the completed code', async () => {
    const oncomplete = vi.fn();
    render(DigitInput, { props: { oncomplete } });
    ['9', '0', '1', '2', '3', '4'].forEach((d, i) => type(i, d));
    await tick();
    expect(oncomplete).toHaveBeenCalledWith('901234');
  });
});
