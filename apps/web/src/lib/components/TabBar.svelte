<script lang="ts">
  /**
   * TabBar (DESIGN §1.2): fixed bottom bar, pixel glyphs, active tab in the
   * accent with a 2px accent dot under the label, badge dot on Chats while
   * a chat is newer than the stored `bleak.chatsSeen` timestamp
   * (lib/stores/chatsSeen.ts — the dot state is fed by pages that poll
   * chat lists). Targets ≥ 48px, aria-current on the active tab.
   */
  import { page } from '$app/state';
  import { resolve } from '$app/paths';
  import { locale, translate } from '#lib/i18n/locale';
  import PixelIcon from '#lib/components/icons/PixelIcon.svelte';
  import { chatsUnseen } from '#lib/stores/chatsSeen';
  import { TAB_ICONS, type IconName } from '#lib/components/icons/registry';

  type TabRoute = '/room' | '/people' | '/chats' | '/profile' | '/host';

  const tabs = $derived([
    { route: '/room', label: translate($locale, 'nav.room'), icon: TAB_ICONS['/room'], active: page.url.pathname.startsWith('/room') },
    { route: '/people', label: translate($locale, 'nav.people'), icon: TAB_ICONS['/people'], active: page.url.pathname.startsWith('/people') },
    { route: '/chats', label: translate($locale, 'nav.chats'), icon: TAB_ICONS['/chats'], active: page.url.pathname.startsWith('/chats') },
    { route: '/profile', label: translate($locale, 'nav.profile'), icon: TAB_ICONS['/profile'], active: page.url.pathname.startsWith('/profile') },
    { route: '/host', label: translate($locale, 'nav.host'), icon: TAB_ICONS['/host'], active: page.url.pathname.startsWith('/host') }
  ] satisfies Array<{ route: TabRoute; label: string; icon: IconName; active: boolean }>);

  const navLabel = $derived(translate($locale, 'nav.aria'));
  const showBadge = $derived($chatsUnseen);
</script>

<nav class="tabbar pixel-corners" aria-label={navLabel}>
  {#each tabs as tab (tab.route)}
    <a
      href={resolve(tab.route)}
      class:active={tab.active}
      aria-current={tab.active ? 'page' : undefined}
    >
      <span class="icon" aria-hidden="true">
        <PixelIcon name={tab.icon} size={16} />
        {#if tab.route === '/chats' && showBadge}
          <span class="badge-dot"></span>
        {/if}
      </span>
      <span class="label">{tab.label}</span>
      {#if tab.active}
        <span class="active-dot" aria-hidden="true"></span>
      {/if}
    </a>
  {/each}
</nav>

<style>
  .tabbar {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    height: var(--bottom-tabbar-height);
    display: flex;
    background: var(--color-surface);
    z-index: 10;
  }
  .tabbar a {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 3px;
    color: var(--color-text-muted);
    min-height: var(--touch-target);
    font-size: 12px;
    letter-spacing: 0.02em;
    transition: color 120ms ease-out;
  }
  .tabbar a.active {
    color: var(--color-accent);
  }
  .icon {
    position: relative;
    display: inline-flex;
  }
  .badge-dot {
    position: absolute;
    top: -2px;
    right: -6px;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--color-accent);
  }
  .active-dot {
    width: 2px;
    height: 2px;
    border-radius: 50%;
    background: var(--color-accent);
  }
</style>
