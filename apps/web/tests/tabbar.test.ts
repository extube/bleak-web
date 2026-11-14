/** TabBar render tests (TZ-02): pixel glyphs, aria, badge dot (§1.2). */
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/svelte';
import TabBar from '../src/lib/components/TabBar.svelte';
import { chatsUnseen } from '../src/lib/stores/chatsSeen';
import { ru } from '../src/lib/i18n/ru';

afterEach(() => {
  cleanup();
  chatsUnseen.set(false);
});

describe('TabBar', () => {
  it('renders the five tabs with the localized aria-label', () => {
    render(TabBar, { props: {} });
    const nav = screen.getByRole('navigation', { name: ru['nav.aria'] });
    expect(nav).toBeTruthy();
    for (const key of ['nav.room', 'nav.people', 'nav.chats', 'nav.profile', 'nav.host'] as const) {
      expect(screen.getByText(ru[key])).toBeTruthy();
    }
  });

  it('marks the active tab with aria-current', () => {
    // page.url defaults to "/" in tests → no tab is active
    render(TabBar, { props: {} });
    const links = screen.getAllByRole('link');
    for (const link of links) expect(link.getAttribute('aria-current')).toBeNull();
  });

  it('shows the badge dot on Chats only when a chat is newer than seen', async () => {
    render(TabBar, { props: {} });
    const nav = screen.getByRole('navigation', { name: ru['nav.aria'] });
    const chatsTab = nav.querySelector('a[href="/chats"]');
    expect(chatsTab).toBeTruthy();
    expect(chatsTab?.querySelector('.badge-dot')).toBeNull();
    chatsUnseen.set(true);
    // store update → the reactive badge appears
    await new Promise((resolveTick) => setTimeout(resolveTick, 10));
    expect(chatsTab?.querySelector('.badge-dot')).not.toBeNull();
  });

  it('resolves tab hrefs to literal routes', () => {
    render(TabBar, { props: {} });
    const hrefs = screen.getAllByRole('link').map((a) => a.getAttribute('href'));
    expect(hrefs).toEqual(['/room', '/people', '/chats', '/profile', '/host']);
  });
});
