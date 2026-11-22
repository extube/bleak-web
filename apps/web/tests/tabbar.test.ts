/** TabBar render tests (TZ-02): pixel glyphs, aria, badge dots (§1.2, §4.14.2). */
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/svelte';
import TabBar from '../src/lib/components/TabBar.svelte';
import { chatsUnseen } from '../src/lib/stores/chatsSeen';
import { contactsUnseen } from '../src/lib/stores/contactsSeen';
import { ru } from '../src/lib/i18n/ru';

afterEach(() => {
  cleanup();
  chatsUnseen.set(false);
  contactsUnseen.set(false);
});

describe('TabBar', () => {
  it('renders the five tabs with the localized aria-label', () => {
    render(TabBar, { props: {} });
    const nav = screen.getByRole('navigation', { name: ru['nav.aria'] });
    expect(nav).toBeTruthy();
    for (
      const key of ['nav.room', 'nav.people', 'nav.contacts', 'nav.chats', 'nav.profile'] as const
    ) {
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

  it('shows the badge dot on Contacts only when a contact is newer than seen (§4.14.2)', async () => {
    render(TabBar, { props: {} });
    const nav = screen.getByRole('navigation', { name: ru['nav.aria'] });
    const contactsTab = nav.querySelector('a[href="/contacts"]');
    expect(contactsTab).toBeTruthy();
    expect(contactsTab?.querySelector('.badge-dot')).toBeNull();
    contactsUnseen.set(true);
    await new Promise((resolveTick) => setTimeout(resolveTick, 10));
    expect(contactsTab?.querySelector('.badge-dot')).not.toBeNull();
  });

  it('the dots are independent: a Chats dot never lights the Contacts tab (§4.14.2)', async () => {
    render(TabBar, { props: {} });
    const nav = screen.getByRole('navigation', { name: ru['nav.aria'] });
    chatsUnseen.set(true);
    await new Promise((resolveTick) => setTimeout(resolveTick, 10));
    expect(nav.querySelector('a[href="/chats"] .badge-dot')).not.toBeNull();
    expect(nav.querySelector('a[href="/contacts"] .badge-dot')).toBeNull();
  });

  it('a lit dot carries the unseen clause in the accessible name (§4.14.2 dot aria)', async () => {
    render(TabBar, { props: {} });
    const nav = screen.getByRole('navigation', { name: ru['nav.aria'] });
    const contactsTab = nav.querySelector('a[href="/contacts"]');
    expect(contactsTab?.textContent).not.toContain(ru['nav.contacts.dot_aria']);
    contactsUnseen.set(true);
    await new Promise((resolveTick) => setTimeout(resolveTick, 10));
    expect(contactsTab?.textContent).toContain(ru['nav.contacts.dot_aria']);
    // the Chats dot mirrors the same pattern
    chatsUnseen.set(true);
    await new Promise((resolveTick) => setTimeout(resolveTick, 10));
    expect(nav.querySelector('a[href="/chats"]')?.textContent).toContain(ru['nav.chats.dot_aria']);
  });

  it('resolves tab hrefs to literal routes (5 tabs, Contacts between People and Chats)', () => {
    render(TabBar, { props: {} });
    const hrefs = screen.getAllByRole('link').map((a) => a.getAttribute('href'));
    expect(hrefs).toEqual(['/room', '/people', '/contacts', '/chats', '/profile']);
  });
});
