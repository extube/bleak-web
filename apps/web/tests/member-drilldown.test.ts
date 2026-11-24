/** MemberDrillDown rev. 4 tests (TZ13-03 Part A, DESIGN §3.7.2): the real
 * room-token listing rows (each linking to the read-only /chats/{address}
 * transcript), the per-record aria-labels, «Очистить историю» (confirm) and
 * «Запустить заново» (§3.5 kickoff copy) calling the page callbacks, the
 * KickoffResponse speaker line, the CONFIRM-LF empty listing, the RULE-D
 * locked row (non-interactive, aria-disabled, no click handler) and the
 * legacy pre-rework console hint state. NO handshake counts anywhere
 * (rule B). */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/svelte';
import { tick } from 'svelte';
import type { User } from '@bleak/api-client';
import MemberDrillDown from '../src/lib/components/host/MemberDrillDown.svelte';
import { ru } from '../src/lib/i18n/ru';

vi.mock('$app/paths', () => ({
  resolve: (route: string, params?: { address?: string }) =>
    params?.address ? `/chats/${params.address}` : route
}));

const MEMBER: User = {
  active: true,
  address: '0xa',
  room: '0xroom',
  name: 'Алиса',
  greeting: '',
  public_bio: 'Поттер',
  private_bio: '',
  language: 'ru',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  deleted_at: null
};

const CHATS = [
  { address: '0xchat1', phase: 'networking', scenario: 'ai-future' },
  { address: '0xchat2', phase: 'networking', scenario: 'startups' }
];

afterEach(() => cleanup());

describe('real room-token listing (rev. 4)', () => {
  it('renders dialog rows linking to /chats/{address} with clear + restart actions and per-record aria-labels', async () => {
    const onclear = vi.fn();
    const onkickoff = vi.fn();
    render(MemberDrillDown, {
      props: { member: MEMBER, chats: CHATS, error: null, errorMessage: null, onclear, onkickoff }
    });
    await tick();

    const links = document.querySelectorAll('.dialogs a');
    expect(links.length).toBe(2);
    expect(links[0]?.getAttribute('href')).toBe('/chats/0xchat1');
    expect(links[1]?.getAttribute('href')).toBe('/chats/0xchat2');
    expect(screen.getAllByText('networking').length).toBe(2);
    expect(screen.getByText('ai-future')).toBeTruthy();

    // Per-record aria-labels («Запустить заново диалог {chat}» etc.).
    const restarts = document.querySelectorAll('button[aria-label]');
    const labels = Array.from(restarts).map((b) => b.getAttribute('aria-label'));
    expect(labels).toContain(ru['host.drill.restart_aria'].replace('{chat}', '0xchat1'));
    expect(labels).toContain(ru['host.drill.clear_aria'].replace('{chat}', '0xchat2'));

    // «Очистить историю» → confirm dialog with the clear copy → callback.
    await screen.getByRole('button', { name: ru['host.drill.clear_aria'].replace('{chat}', '0xchat1') }).click();
    await tick();
    expect(screen.getByText(ru['host.drill.clear_confirm'])).toBeTruthy();
    await screen.getAllByRole('button', { name: ru['host.drill.clear'] }).pop()!.click();
    await waitFor(() => expect(onclear).toHaveBeenCalledWith('0xchat1'));

    // «Запустить заново» → §3.5 kickoff confirm copy → callback.
    await screen.getByRole('button', { name: ru['host.drill.restart_aria'].replace('{chat}', '0xchat1') }).click();
    await tick();
    expect(screen.getByText(ru['chat.kickoff.confirm_title'])).toBeTruthy();
    expect(screen.getByText(ru['chat.kickoff.confirm_body'])).toBeTruthy();
    await screen.getByRole('button', { name: ru['chat.kickoff.confirm_run'] }).click();
    await waitFor(() => expect(onkickoff).toHaveBeenCalledWith('0xchat1'));
  });

  it('cancel closes the confirm without calling the callback', async () => {
    const onclear = vi.fn();
    render(MemberDrillDown, {
      props: { member: MEMBER, chats: CHATS, error: null, errorMessage: null, onclear }
    });
    await tick();
    await screen
      .getByRole('button', { name: ru['host.drill.clear_aria'].replace('{chat}', '0xchat1') })
      .click();
    await tick();
    await screen.getByRole('button', { name: ru['common.cancel'] }).click();
    await tick();
    expect(onclear).not.toHaveBeenCalled();
  });

  it('renders the KickoffResponse speaker line after a kickoff', async () => {
    render(MemberDrillDown, {
      props: {
        member: MEMBER,
        chats: CHATS,
        error: null,
        errorMessage: null,
        kickoffSpeaker: 'Борис'
      }
    });
    await tick();
    const note = document.querySelector('.kickoff-note');
    expect(note?.textContent).toBe('Борис');
  });
});

describe('empty listing (CONFIRM-LF) + loading skeleton', () => {
  it('renders the honest empty copy when the real listing came back empty — no invented rows', async () => {
    render(MemberDrillDown, {
      props: { member: MEMBER, chats: [], error: null, errorMessage: null }
    });
    await tick();
    expect(screen.getByText(ru['host.drill.empty'])).toBeTruthy();
    expect(document.querySelector('.dialogs')).toBeNull();
    // No handshake counts anywhere (rule B).
    expect(document.body.textContent).not.toContain('Отправлено хендшейков');
    expect(document.body.textContent).not.toContain('Получено хендшейков');
  });

  it('loading renders skeleton rows (the sheet is never polled)', async () => {
    render(MemberDrillDown, {
      props: { member: MEMBER, chats: null, loading: true, error: null, errorMessage: null }
    });
    await tick();
    expect(document.querySelectorAll('.dialogs .dialog-row').length).toBe(2);
    expect(document.body.textContent).not.toContain(ru['host.drill.empty']);
  });
});

describe('rule-D locked row (TZ §9.4.1-d)', () => {
  it('renders at the sheet bottom: non-interactive, aria-disabled, lock glyph, no click handler', async () => {
    render(MemberDrillDown, {
      props: { member: MEMBER, chats: CHATS, error: null, errorMessage: null }
    });
    await tick();
    const locked = document.querySelector('.locked-row');
    expect(locked).not.toBeNull();
    expect(locked?.getAttribute('aria-disabled')).toBe('true');
    expect(locked?.textContent).toContain(ru['host.drill.delete_member_locked']);
    // Non-interactive: NOT a button/link, carries no click handler.
    expect(locked?.tagName.toLowerCase()).toBe('div');
    expect(locked?.querySelector('button, a[href]')).toBeNull();
    // No deleteRoomUser call exists anywhere in the component markup.
    expect(document.body.textContent).not.toContain('Удалить участника');
  });
});

describe('fetch failure', () => {
  it('shows the inline muted error with retry', async () => {
    const onretry = vi.fn();
    render(MemberDrillDown, {
      props: {
        member: MEMBER,
        chats: null,
        error: 'api',
        errorMessage: 'db locked',
        onretry
      }
    });
    await tick();
    expect(screen.getByText(/Ошибка сервера/)).toBeTruthy();
    expect(screen.getByText(/db locked/)).toBeTruthy();
    await screen.getByRole('button', { name: ru['common.retry'] }).click();
    expect(onretry).toHaveBeenCalled();
  });
});

describe('legacy pre-rework console state (chats null, not loading)', () => {
  it('keeps the honest 6.9a hint state for the old entry console', async () => {
    render(MemberDrillDown, {
      props: { member: MEMBER, chats: null, error: null, errorMessage: null }
    });
    await tick();
    expect(screen.getByText(ru['host.drill.empty'])).toBeTruthy();
    expect(screen.getByText(ru['host.drill.pending_amendment'])).toBeTruthy();
  });
});
