/** ConfirmDialog render tests (TZ-02): focus trap, Escape, callbacks. */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import { tick } from 'svelte';
import ConfirmDialog from '../src/lib/components/ConfirmDialog.svelte';

afterEach(() => {
  cleanup();
});

const PROPS = {
  title: 'Начать разговор заново?',
  body: 'История диалога будет очищена, и агенты начнут сначала.',
  confirmLabel: 'Запустить',
  cancelLabel: 'Отмена'
};

function dialog(): HTMLElement {
  return screen.getByRole('dialog', { name: PROPS.title });
}

describe('ConfirmDialog', () => {
  it('renders nothing while closed', () => {
    render(ConfirmDialog, { props: { ...PROPS, open: false } });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('renders as a modal dialog with title and body when open', () => {
    render(ConfirmDialog, { props: { ...PROPS, open: true } });
    const el = dialog();
    expect(el.getAttribute('aria-modal')).toBe('true');
    expect(screen.getByText(PROPS.body)).toBeTruthy();
  });

  it('moves focus into the dialog on open (first action)', async () => {
    render(ConfirmDialog, { props: { ...PROPS, open: true } });
    // the cancel button is the first focusable inside the dialog
    await waitFor(() => {
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Отмена' }));
    });
  });

  it('confirm fires the callback and closes', async () => {
    const onconfirm = vi.fn();
    render(ConfirmDialog, { props: { ...PROPS, open: true, onconfirm } });
    await screen.getByRole('button', { name: 'Запустить' }).click();
    expect(onconfirm).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('cancel fires the callback and closes', async () => {
    const oncancel = vi.fn();
    render(ConfirmDialog, { props: { ...PROPS, open: true, oncancel } });
    await screen.getByRole('button', { name: 'Отмена' }).click();
    expect(oncancel).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('Escape closes and cancels', async () => {
    const oncancel = vi.fn();
    render(ConfirmDialog, { props: { ...PROPS, open: true, oncancel } });
    fireEvent.keyDown(dialog(), { key: 'Escape' });
    await tick();
    expect(oncancel).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('traps Tab focus inside the dialog', async () => {
    render(ConfirmDialog, { props: { ...PROPS, open: true } });
    const cancel = screen.getByRole('button', { name: 'Отмена' });
    const confirm = screen.getByRole('button', { name: 'Запустить' });
    await waitFor(() => {
      expect(document.activeElement).toBe(cancel);
    });
    // focus starts on cancel; Shift+Tab wraps to the last focusable
    fireEvent.keyDown(dialog(), { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(confirm);
    // Tab from the last focusable wraps back to the first
    fireEvent.keyDown(dialog(), { key: 'Tab' });
    expect(document.activeElement).toBe(cancel);
  });
});
