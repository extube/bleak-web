/** MemberDrillDown v2 component tests (TZ2-07 Part B, DESIGN rev. 3 §3.7):
 * the 6.9a-blocked empty state (empty copy + muted flag hint, never
 * invented listings), and — for DISCOVERED dialogs (the post-6.9a shape,
 * exercised at the component level) — dialog rows linking to the read-only
 * /chats/{address} transcript with «Очистить историю» (confirm) and
 * «Запустить заново» (§3.5 kickoff copy) calling the page callbacks. NO
 * handshake counts anywhere (AC 11). */
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

afterEach(() => cleanup());

describe('6.9a-blocked discovery (v2 ship state)', () => {
  it('renders the empty drill-down copy + the muted flag hint; no rows, no counts', async () => {
    render(MemberDrillDown, {
      props: { member: MEMBER, chats: null, error: null, errorMessage: null }
    });
    await tick();
    expect(screen.getByText(ru['host.drill.empty'])).toBeTruthy();
    expect(screen.getByText(ru['host.drill.pending_amendment'])).toBeTruthy();
    expect(document.body.textContent).not.toContain('Отправлено хендшейков');
    expect(document.body.textContent).not.toContain('Получено хендшейков');
    expect(document.querySelector('.dialogs')).toBeNull();
  });
});

describe('discovered dialogs (post-6.9a shape, component level)', () => {
  it('renders dialog rows linking to /chats/{address} with clear + restart actions', async () => {
    const onclear = vi.fn();
    const onkickoff = vi.fn();
    render(MemberDrillDown, {
      props: {
        member: MEMBER,
        chats: [{ address: '0xchat1', phase: 'networking', scenario: 'ai-future' }],
        error: null,
        errorMessage: null,
        onclear,
        onkickoff
      }
    });
    await tick();

    const link = document.querySelector('.dialogs a') as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('/chats/0xchat1');
    expect(screen.getByText('networking')).toBeTruthy();
    expect(screen.getByText('ai-future')).toBeTruthy();

    // «Очистить историю» → confirm dialog with the clear copy → callback.
    await screen.getByRole('button', { name: ru['host.drill.clear'] }).click();
    await tick();
    expect(screen.getByText(ru['host.drill.clear_confirm'])).toBeTruthy();
    await screen.getAllByRole('button', { name: ru['host.drill.clear'] }).pop()!.click();
    await waitFor(() => expect(onclear).toHaveBeenCalledWith('0xchat1'));

    // «Запустить заново» → §3.5 kickoff confirm copy → callback.
    await screen.getByRole('button', { name: ru['host.drill.kickoff'] }).click();
    await tick();
    expect(screen.getByText(ru['chat.kickoff.confirm_title'])).toBeTruthy();
    expect(screen.getByText(ru['chat.kickoff.confirm_body'])).toBeTruthy();
    await screen.getByRole('button', { name: ru['chat.kickoff.confirm_run'] }).click();
    await waitFor(() => expect(onkickoff).toHaveBeenCalledWith('0xchat1'));
  });

  it('cancel closes the confirm without calling the callback', async () => {
    const onclear = vi.fn();
    render(MemberDrillDown, {
      props: {
        member: MEMBER,
        chats: [{ address: '0xchat1', phase: 'networking', scenario: 'ai-future' }],
        error: null,
        errorMessage: null,
        onclear
      }
    });
    await tick();
    await screen.getByRole('button', { name: ru['host.drill.clear'] }).click();
    await tick();
    await screen.getByRole('button', { name: ru['common.cancel'] }).click();
    await tick();
    expect(onclear).not.toHaveBeenCalled();
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
