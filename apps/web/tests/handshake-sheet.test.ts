/** HandshakeSheet render tests (TZ-02): per-state actions + inline error. */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/svelte';
import HandshakeSheet from '../src/lib/components/HandshakeSheet.svelte';
import type { Relationship } from '../src/lib/room/relationships';
import { ru } from '../src/lib/i18n/ru';
import type { User } from '@bleak/api-client';

afterEach(() => {
  cleanup();
});

const alice: User = {
  address: '0xalice',
  room: '0xroom',
  name: 'Алиса',
  greeting: 'Привет!',
  public_bio: 'Гончая студия',
  private_bio: '',
  language: 'ru',
  created_at: '2026-11-14T10:00:00Z',
  updated_at: '2026-11-14T10:00:00Z',
  deleted_at: null
};

function rel(partial: Partial<Relationship>): Relationship {
  return {
    user: alice.address,
    state: 'none',
    chatAddress: null,
    outgoingAt: null,
    incomingAt: null,
    chatAt: null,
    ...partial
  };
}

describe('HandshakeSheet', () => {
  it('renders nothing while closed', () => {
    render(HandshakeSheet, { props: { open: false, user: alice } });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('no handshake: shows the send CTA', async () => {
    const onsend = vi.fn();
    render(HandshakeSheet, {
      props: { open: true, user: alice, relationship: rel({ state: 'none' }), onsend }
    });
    const send = screen.getByRole('button', { name: ru['hs.send'] });
    await send.click();
    expect(onsend).toHaveBeenCalledTimes(1);
  });

  it('outgoing pending: disabled waiting state', () => {
    render(HandshakeSheet, {
      props: { open: true, user: alice, relationship: rel({ state: 'outgoing', outgoingAt: 'x' }) }
    });
    const waiting = screen.getByRole('button', { name: ru['hs.waiting'] });
    expect(waiting.hasAttribute('disabled')).toBe(true);
  });

  it('incoming pending: added-you pill + handshake-back CTA', async () => {
    const onsend = vi.fn();
    render(HandshakeSheet, {
      props: { open: true, user: alice, relationship: rel({ state: 'incoming', incomingAt: 'x' }), onsend }
    });
    expect(screen.getByText(ru['hs.added_you'])).toBeTruthy();
    await screen.getByRole('button', { name: ru['hs.back'] }).click();
    expect(onsend).toHaveBeenCalledTimes(1);
  });

  it('mutual: open-dialog link to the counterpart chat', () => {
    render(HandshakeSheet, {
      props: {
        open: true,
        user: alice,
        relationship: rel({ state: 'chat', chatAddress: '0xchat9' })
      }
    });
    const link = screen.getByRole('link', { name: ru['hs.open_dialog'] });
    expect(link.getAttribute('href')).toBe('/chats/0xchat9');
  });

  it('network error renders inline recovery copy', () => {
    render(HandshakeSheet, {
      props: { open: true, user: alice, relationship: rel({ state: 'none' }), error: 'network' }
    });
    expect(screen.getByText(ru['hs.error.network'])).toBeTruthy();
  });

  it('api error renders the server text', () => {
    render(HandshakeSheet, {
      props: {
        open: true,
        user: alice,
        relationship: rel({ state: 'none' }),
        error: 'api',
        errorMessage: 'income must exceed outcome'
      }
    });
    expect(screen.getByText(/income must exceed outcome/)).toBeTruthy();
  });

  it('income-rule error (§2.9, 403): renders hs.income_limit inline + muted server text, announced polite', () => {
    render(HandshakeSheet, {
      props: {
        open: true,
        user: alice,
        relationship: rel({ state: 'none' }),
        error: 'income',
        errorMessage: 'income must exceed outcome'
      }
    });
    expect(screen.getByText(ru['hs.income_limit'])).toBeTruthy();
    expect(screen.getByText(/income must exceed outcome/)).toBeTruthy();
    const alert = screen.getByRole('alert');
    expect(alert.getAttribute('aria-live')).toBe('polite');
    // The send CTA stays active — no optimistic "sent" flip (§3.2 AC 15).
    expect(screen.getByRole('button', { name: ru['hs.send'] })).toBeTruthy();
    expect(screen.queryByRole('button', { name: ru['hs.sent'] })).toBeNull();
  });

  it('shows name and public_bio', () => {
    render(HandshakeSheet, {
      props: { open: true, user: alice, relationship: rel({ state: 'none' }) }
    });
    expect(screen.getByText('Алиса')).toBeTruthy();
    expect(screen.getByText('Гончая студия')).toBeTruthy();
  });
});
