/** /profile/edit tests (DESIGN §4.29.C — v3.23 profile redesign): the NEW
 * editing route. Covered: mount prefill (getRoomUser + the canonical
 * getUserGreeting with the getRoomUser value as the loading fallback; NO
 * poller), the field groups (name required + maxlength, bios, greeting
 * ≤255 + counter + Regenerate that fills WITHOUT saving, local contact
 * card), the ONE full-width Save Changes (§4.29.C.4): the submit sequence
 * updateRoomUser → putUserGreeting → the local contactCard save, the
 * FIRST FAILURE ABORTS with the inline error at the failing group and
 * already-applied steps standing (a retry re-saves idempotently), the
 * greeting question-mark rule blocking the whole save (aria-disabled +
 * inline reason), double-submit prevention, the «Сохранено» flash with
 * the page STAYING on /profile/edit, back discarding without a confirm,
 * the sub-page chrome (no tab bar, centered h1, no avatar camera badge),
 * and NO interests editor (§23.2 5.6, I-rec 12). */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, sep } from 'node:path';
import { cleanup, render, screen, waitFor } from '@testing-library/svelte';
import { tick } from 'svelte';
import { ApiError, type User } from '@bleak/api-client';
import { identity } from '../src/lib/stores/identity';

vi.mock('$app/navigation', () => ({ goto: vi.fn() }));
vi.mock('$app/paths', () => ({
  resolve: (route: string) => route.replace('[address]', '0xchat')
}));

vi.mock('#lib/api/client', () => ({
  api: {
    getRoomUser: vi.fn(),
    updateRoomUser: vi.fn(),
    getUserGreeting: vi.fn(),
    putUserGreeting: vi.fn(),
    regenerateGreeting: vi.fn()
  }
}));

// Deterministic back rule: force the fallback branch so goto(/profile) is
// assertable.
vi.mock('#lib/chats/view', () => ({
  backTarget: () => 'list'
}));

import { api } from '#lib/api/client';
import Page from '../src/routes/profile/edit/+page.svelte';
import { ru } from '../src/lib/i18n/ru';

const WEB_ROOT = process.cwd().endsWith(`${sep}apps${sep}web`)
  ? process.cwd()
  : join(process.cwd(), 'apps', 'web');

const ME = '0xme';
const ROOM = '0xroom';
const TOKEN = 'persona-token';
const mockedApi = vi.mocked(api, true);

function userFixture(overrides: Partial<User> = {}): User {
  return {
    active: true,
    address: ME,
    room: ROOM,
    name: 'Трамвайщик',
    greeting: 'Привет! Я про трамваи.',
    public_bio: 'Поттер из Питера',
    private_bio: 'Люблю глина и стеклодувное дело',
    language: 'ru',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    deleted_at: null,
    ...overrides
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  sessionStorage.clear();
  vi.useRealTimers();
  localStorage.setItem(
    'bleak.identity',
    JSON.stringify({ roomAddress: ROOM, userAddress: ME, token: TOKEN })
  );
  identity.set({ roomAddress: ROOM, userAddress: ME, token: TOKEN });
  mockedApi.getRoomUser.mockResolvedValue(userFixture());
  mockedApi.getUserGreeting.mockResolvedValue({ address: ME, greeting: 'Привет! Я про трамваи.' });
});

afterEach(() => {
  cleanup();
  identity.set(null);
  localStorage.clear();
  vi.useRealTimers();
});

async function renderPage(): Promise<void> {
  render(Page, { props: {} });
  await waitFor(() => expect(mockedApi.getRoomUser).toHaveBeenCalled());
  await tick();
  await tick();
}

function inputEvent(el: HTMLInputElement | HTMLTextAreaElement): Event {
  el.dispatchEvent(new Event('input', { bubbles: true }));
  return new Event('input', { bubbles: true });
}

describe('mount prefill (§4.29.C.7; AC 21)', () => {
  it('prefills from getRoomUser; the greeting re-fetches the canonical value with the record value as the loading fallback', async () => {
    mockedApi.getUserGreeting.mockResolvedValue({ address: ME, greeting: 'Каноническое приветствие' });
    localStorage.setItem('bleak.contactCard', JSON.stringify({ '0xroom|0xme': 'telegram: @me' }));
    await renderPage();

    const nameInput = screen.getByLabelText(ru['profile.edit.row.name']) as HTMLInputElement;
    expect(nameInput.value).toBe('Трамвайщик');
    expect(nameInput.maxLength).toBe(64);
    const publicInput = screen.getByLabelText(ru['profile.edit.row.public_bio']) as HTMLInputElement;
    expect(publicInput.value).toBe('Поттер из Питера');
    const privateInput = screen.getByLabelText(ru['profile.edit.row.private_bio']) as HTMLInputElement;
    expect(privateInput.value).toBe('Люблю глина и стеклодувное дело');
    const textarea = screen.getByLabelText(ru['profile.greeting.label']) as HTMLTextAreaElement;
    expect(textarea.value).toBe('Каноническое приветствие');
    expect(textarea.maxLength).toBe(255);
    const contactInput = screen.getByLabelText(ru['profile.contact.edit']) as HTMLInputElement;
    expect(contactInput.value).toBe('telegram: @me');
    expect(contactInput.maxLength).toBe(255);
    // The counter + rule helper carry.
    expect(screen.getByText(ru['profile.greeting.rule'])).toBeTruthy();
    expect(screen.getByText(`${'Каноническое приветствие'.length}/255`)).toBeTruthy();
  });

  it('NO poller runs on this page — getRoomUser is called ONCE (mount prefill only)', async () => {
    vi.useFakeTimers();
    try {
      render(Page, { props: {} });
      await vi.advanceTimersByTimeAsync(30);
      await tick();
      expect(mockedApi.getRoomUser).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(10_000);
      await tick();
      // Still one — the §6.3 live-QR poll stays bound to /profile only.
      expect(mockedApi.getRoomUser).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('a load error shows ErrorBanner + retry', async () => {
    mockedApi.getRoomUser.mockRejectedValue(
      new ApiError(500, '/api/room/0xroom/user/0xme', 'db locked')
    );
    render(Page, { props: {} });
    await tick();
    await tick();
    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
    expect(screen.queryByRole('button', { name: ru['profile.edit.save'] })).toBeNull();
    mockedApi.getRoomUser.mockResolvedValue(userFixture());
    await screen.getByRole('button', { name: ru['common.retry'] }).click();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: ru['profile.edit.save'] })).toBeTruthy()
    );
  });
});

describe('field groups (§4.29.C.3; AC 19)', () => {
  it('renders all groups: name (required), both bios with the muted-red caption, greeting (counter + rule + Regenerate), contact card with its helper', async () => {
    await renderPage();
    // The muted-red caption sits at the private bio field.
    expect(screen.getByText(ru['profile.private_bio.caption'])).toBeTruthy();
    // The greeting rule helper + Regenerate button.
    expect(screen.getByRole('button', { name: ru['profile.greeting.regenerate'] })).toBeTruthy();
    // The contact helper note.
    expect(screen.getByText(ru['profile.contact.note'])).toBeTruthy();
    // NO interests editor anywhere (§23.2 5.6; I-rec 12).
    expect(screen.queryByText(ru['profile.interests.title'])).toBeNull();
    expect(screen.queryByRole('button', { name: 'Интересы' })).toBeNull();
  });

  it('Regenerate fills the textarea WITHOUT saving', async () => {
    mockedApi.regenerateGreeting.mockResolvedValue({ address: ME, greeting: 'Сгенерировано из био' });
    await renderPage();
    await screen.getByRole('button', { name: ru['profile.greeting.regenerate'] }).click();
    await waitFor(() =>
      expect(screen.getByLabelText(ru['profile.greeting.label'])).toHaveProperty('value', 'Сгенерировано из био')
    );
    expect(mockedApi.putUserGreeting).not.toHaveBeenCalled();
    expect(mockedApi.updateRoomUser).not.toHaveBeenCalled();
  });
});

describe('the ONE Save Changes (§4.29.C.4; AC 20)', () => {
  it('saves the full sequence in order: updateRoomUser (all three fields) → putUserGreeting → the LOCAL contact save', async () => {
    mockedApi.updateRoomUser.mockResolvedValue(
      userFixture({ name: 'Стеклодув', public_bio: 'Новое био', private_bio: 'Секрет' })
    );
    mockedApi.putUserGreeting.mockResolvedValue({ address: ME, greeting: 'Новый оффлайн-режим' });
    localStorage.setItem('bleak.contactCard', JSON.stringify({ '0xroom|0xme': 'telegram: @me' }));
    await renderPage();

    const nameInput = screen.getByLabelText(ru['profile.edit.row.name']) as HTMLInputElement;
    nameInput.value = 'Стеклодув';
    inputEvent(nameInput);
    const publicInput = screen.getByLabelText(ru['profile.edit.row.public_bio']) as HTMLInputElement;
    publicInput.value = 'Новое био';
    inputEvent(publicInput);
    const textarea = screen.getByLabelText(ru['profile.greeting.label']) as HTMLTextAreaElement;
    textarea.value = 'Новый оффлайн-режим';
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    const contactInput = screen.getByLabelText(ru['profile.contact.edit']) as HTMLInputElement;
    contactInput.value = 'signal: @me';
    inputEvent(contactInput);

    await screen.getByRole('button', { name: ru['profile.edit.save'] }).click();
    await waitFor(() =>
      expect(mockedApi.updateRoomUser).toHaveBeenCalledWith(ROOM, ME, {
        name: 'Стеклодув',
        public_bio: 'Новое био',
        private_bio: 'Люблю глина и стеклодувное дело'
      })
    );
    await waitFor(() =>
      expect(mockedApi.putUserGreeting).toHaveBeenCalledWith(ROOM, ME, 'Новый оффлайн-режим')
    );
    // The local contact card persisted — and NO API call carried it.
    await waitFor(() =>
      expect(JSON.parse(localStorage.getItem('bleak.contactCard') ?? '{}')).toMatchObject({
        '0xroom|0xme': 'signal: @me'
      })
    );
    // Success: the «Сохранено» flash — the page STAYS on /profile/edit.
    await waitFor(() =>
      expect(screen.getByText(ru['profile.saved'], { exact: false })).toBeTruthy()
    );
    expect(screen.getByRole('button', { name: ru['profile.edit.save'] })).toBeTruthy();
  });

  it('the greeting question mark blocks the WHOLE save: Save is aria-disabled with the inline reason; nothing is sent', async () => {
    await renderPage();
    const textarea = screen.getByLabelText(ru['profile.greeting.label']) as HTMLTextAreaElement;
    textarea.value = 'Кто здесь?';
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    await tick();
    const save = screen.getByRole('button', { name: ru['profile.edit.save'] }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    expect(save.getAttribute('aria-disabled')).toBe('true');
    expect(screen.getByText(ru['profile.greeting.no_questions'])).toBeTruthy();
    await save.click();
    expect(mockedApi.updateRoomUser).not.toHaveBeenCalled();
    expect(mockedApi.putUserGreeting).not.toHaveBeenCalled();

    // The full-width ？ is blocked by the same rule.
    textarea.value = '你好？';
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    await tick();
    expect((screen.getByRole('button', { name: ru['profile.edit.save'] }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('an empty name blocks the save client-side with the carried inline reason', async () => {
    await renderPage();
    const nameInput = screen.getByLabelText(ru['profile.edit.row.name']) as HTMLInputElement;
    nameInput.value = '   ';
    inputEvent(nameInput);
    await screen.getByRole('button', { name: ru['profile.edit.save'] }).click();
    await tick();
    expect(screen.getByText(ru['join.error.name_required'])).toBeTruthy();
    expect(mockedApi.updateRoomUser).not.toHaveBeenCalled();
    expect(mockedApi.putUserGreeting).not.toHaveBeenCalled();
  });

  it('a persona-save failure ABORTS the sequence: the inline error at the persona group, greeting/contact untouched; a retry re-saves idempotently', async () => {
    mockedApi.updateRoomUser
      .mockRejectedValueOnce(new ApiError(500, '/api/room/0xroom/user/0xme', 'db locked'))
      .mockResolvedValueOnce(userFixture({ name: 'Стеклодув' }));
    mockedApi.putUserGreeting.mockResolvedValue({ address: ME, greeting: 'Новый оффлайн-режим' });
    await renderPage();

    const nameInput = screen.getByLabelText(ru['profile.edit.row.name']) as HTMLInputElement;
    nameInput.value = 'Стеклодув';
    inputEvent(nameInput);
    const textarea = screen.getByLabelText(ru['profile.greeting.label']) as HTMLTextAreaElement;
    textarea.value = 'Новый оффлайн-режим';
    textarea.dispatchEvent(new Event('input', { bubbles: true }));

    await screen.getByRole('button', { name: ru['profile.edit.save'] }).click();
    await waitFor(() =>
      expect(screen.getByText(/db locked/)).toBeTruthy()
    );
    // The first failure aborted: no greeting PUT, no flash.
    expect(mockedApi.putUserGreeting).not.toHaveBeenCalled();
    expect(screen.queryByText(ru['profile.saved'], { exact: false })).toBeNull();

    // A retry re-saves idempotently: both PUTs send FULL values.
    await screen.getByRole('button', { name: ru['profile.edit.save'] }).click();
    await waitFor(() =>
      expect(mockedApi.updateRoomUser).toHaveBeenLastCalledWith(ROOM, ME, {
        name: 'Стеклодув',
        public_bio: 'Поттер из Питера',
        private_bio: 'Люблю глина и стеклодувное дело'
      })
    );
    await waitFor(() =>
      expect(mockedApi.putUserGreeting).toHaveBeenCalledWith(ROOM, ME, 'Новый оффлайн-режим')
    );
    await waitFor(() =>
      expect(screen.getByText(ru['profile.saved'], { exact: false })).toBeTruthy()
    );
  });

  it('a greeting-save failure aborts AFTER the persona step stands (server 400 → the no-questions copy); a retry applies the rest', async () => {
    mockedApi.updateRoomUser.mockResolvedValue(userFixture({ name: 'Стеклодув' }));
    mockedApi.putUserGreeting
      .mockRejectedValueOnce(new ApiError(400, '/greeting', 'no questions'))
      .mockResolvedValueOnce({ address: ME, greeting: 'Новый оффлайн-режим' });
    await renderPage();

    const nameInput = screen.getByLabelText(ru['profile.edit.row.name']) as HTMLInputElement;
    nameInput.value = 'Стеклодув';
    inputEvent(nameInput);
    const textarea = screen.getByLabelText(ru['profile.greeting.label']) as HTMLTextAreaElement;
    textarea.value = 'Новый оффлайн-режим';
    textarea.dispatchEvent(new Event('input', { bubbles: true }));

    await screen.getByRole('button', { name: ru['profile.edit.save'] }).click();
    await waitFor(() => expect(mockedApi.updateRoomUser).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(screen.getByText(ru['profile.greeting.no_questions'])).toBeTruthy()
    );
    // The persona step STOOD; the contact card was not saved yet.
    expect(JSON.parse(localStorage.getItem('bleak.contactCard') ?? '{}')['0xroom|0xme']).toBeUndefined();

    // A retry completes the sequence.
    await screen.getByRole('button', { name: ru['profile.edit.save'] }).click();
    await waitFor(() =>
      expect(mockedApi.putUserGreeting).toHaveBeenLastCalledWith(ROOM, ME, 'Новый оффлайн-режим')
    );
    await waitFor(() =>
      expect(screen.getByText(ru['profile.saved'], { exact: false })).toBeTruthy()
    );
  });

  it('a network failure at the persona step surfaces common.error.network inline', async () => {
    const { NetworkError } = await import('@bleak/api-client');
    mockedApi.updateRoomUser.mockRejectedValueOnce(
      new NetworkError('socket closed', '/api/room/0xroom/user/0xme')
    );
    await renderPage();
    await screen.getByRole('button', { name: ru['profile.edit.save'] }).click();
    await waitFor(() => expect(screen.getByText(ru['common.error.network'])).toBeTruthy());
  });

  it('double-submit is prevented — a pending save fires the sequence exactly once', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    mockedApi.updateRoomUser.mockReturnValueOnce(
      gate.then(() => userFixture()) as unknown as Promise<User>
    );
    mockedApi.putUserGreeting.mockResolvedValue({ address: ME, greeting: 'Привет! Я про трамваи.' });
    await renderPage();
    const save = screen.getByRole('button', { name: ru['profile.edit.save'] }) as HTMLButtonElement;
    await save.click();
    await save.click();
    release();
    await waitFor(() =>
      expect(screen.getByText(ru['profile.saved'], { exact: false })).toBeTruthy()
    );
    expect(mockedApi.updateRoomUser).toHaveBeenCalledTimes(1);
    expect(mockedApi.putUserGreeting).toHaveBeenCalledTimes(1);
  });
});

/** Strip JS/Svelte comment blocks so source-level assertions target CODE,
 * not the spec quotes in the header comments. */
function codeOf(path: string): string {
  return readFileSync(join(WEB_ROOT, path), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/<!--[\s\S]*?-->/g, '');
}

describe('chrome + navigation (§4.29.C.1/C.6/C.8; AC 18, 22)', () => {
  it('is a sub-page: no tab bar, back navigation falling back to /profile, the CENTERED h1', async () => {
    await renderPage();
    expect(document.head.innerHTML).toContain('nav.tabbar');
    expect(screen.getByRole('heading', { level: 1, name: ru['profile.edit.title'] })).toBeTruthy();
    await screen.getByRole('button', { name: ru['common.back'] }).click();
    const { goto } = await import('$app/navigation');
    await waitFor(() => expect(goto).toHaveBeenCalledWith('/profile'));
  });

  it('the centered 96px display-only avatar has NO camera badge (source-level)', async () => {
    await renderPage();
    const source = codeOf('src/routes/profile/edit/+page.svelte');
    expect(source).toContain('PixelAvatar address={user.address} size={96} own');
    expect(source).not.toMatch(/camera|upload/i);
    const bar = source.match(/\.top-bar\s*\{[\s\S]*?\}/)?.[0] ?? '';
    expect(bar).toContain('grid-template-columns: var(--touch-target) 1fr var(--touch-target)');
  });

  it('NO interests editor exists on /profile/edit (§23.2 5.6; I-rec 12 — source-level)', () => {
    const source = codeOf('src/routes/profile/edit/+page.svelte');
    expect(source).not.toContain('interests');
    const editor = codeOf('src/lib/components/profile/PersonaEditor.svelte');
    expect(editor).not.toContain('interests');
  });

  it('the ONE Save button is the only save affordance — the editors carry no Save/Cancel CTAs (source-level)', () => {
    const page = readFileSync(
      join(WEB_ROOT, 'src/routes/profile/edit/+page.svelte'),
      'utf8'
    );
    // Exactly one submit button, labeled profile.edit.save.
    expect(page.split('type="submit"').length - 1).toBe(1);
    expect(page).toContain("translate($locale, 'profile.edit.save')");
    for (const name of ['PersonaEditor', 'GreetingEditor', 'ContactCardEditor']) {
      const source = readFileSync(
        join(WEB_ROOT, `src/lib/components/profile/${name}.svelte`),
        'utf8'
      );
      expect(source).not.toContain("translate($locale, 'common.save')");
      expect(source).not.toContain("translate($locale, 'common.cancel')");
    }
  });

  it('no poller and no live-QR module on this route (source-level — §2.2 cadence table, uqr code-split)', () => {
    const source = readFileSync(
      join(WEB_ROOT, 'src/routes/profile/edit/+page.svelte'),
      'utf8'
    );
    expect(source).not.toMatch(/new\s+Poller\b/);
    expect(source).not.toMatch(/uqr|QrCodeBadge/);
  });
});
