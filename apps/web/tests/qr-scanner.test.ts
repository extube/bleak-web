/** QrScanner placeholder contract test (TZ-02): final public API wiring —
 * TZ-04 replaces the body in place against the same props/callbacks. */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/svelte';
import QrScanner from '../src/lib/components/QrScanner.svelte';
import type { User } from '@bleak/api-client';
import { ru } from '../src/lib/i18n/ru';

afterEach(() => {
  cleanup();
});

const members: User[] = [
  {
    address: '0xalice',
    room: '0xroom',
    name: 'Алиса',
    greeting: '',
    public_bio: '',
    private_bio: '',
    language: 'ru',
    created_at: '',
    updated_at: '',
    deleted_at: null
  }
];

describe('QrScanner placeholder (public API contract)', () => {
  it('accepts the full contract props and renders the panel when open', () => {
    const onInviteCode = vi.fn();
    const onPersonaScanned = vi.fn();
    render(QrScanner, {
      props: { open: true, context: 'persona', members, onInviteCode, onPersonaScanned }
    });
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByText(ru['scan.title'])).toBeTruthy();
    expect(screen.getByText(ru['scan.placeholder'])).toBeTruthy();
  });

  it('renders nothing while closed', () => {
    render(QrScanner, { props: { open: false, context: 'invite' } });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('the close button fires onClosed', async () => {
    const onClosed = vi.fn();
    render(QrScanner, { props: { open: true, context: 'invite', onClosed } });
    await screen.getByRole('button', { name: ru['scan.close'] }).click();
    expect(onClosed).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('Escape fires onClosed (camera lifecycle will bind here in TZ-04)', () => {
    const onClosed = vi.fn();
    render(QrScanner, { props: { open: true, context: 'invite', onClosed } });
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onClosed).toHaveBeenCalledTimes(1);
  });
});
