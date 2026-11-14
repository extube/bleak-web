<script lang="ts">
  import { page } from '$app/state';
  import { resolve } from '$app/paths';
  import { t } from '#lib/i18n/locale';

  type TabRoute = '/room' | '/people' | '/chats' | '/profile' | '/host';

  const tabs = $derived([
    { route: '/room', label: t('nav.room'), icon: '◉', active: page.url.pathname.startsWith('/room') },
    { route: '/people', label: t('nav.people'), icon: '☺', active: page.url.pathname.startsWith('/people') },
    { route: '/chats', label: t('nav.chats'), icon: '▤', active: page.url.pathname.startsWith('/chats') },
    { route: '/profile', label: t('nav.profile'), icon: '☾', active: page.url.pathname.startsWith('/profile') },
    { route: '/host', label: t('nav.host'), icon: '★', active: page.url.pathname.startsWith('/host') }
  ] satisfies Array<{ route: TabRoute; label: string; icon: string; active: boolean }>);
</script>

<nav class="tabbar pixel-corners" aria-label="main">
  {#each tabs as tab (tab.route)}
    <a href={resolve(tab.route)} class:active={tab.active} aria-current={tab.active ? 'page' : undefined}>
      <span class="icon" aria-hidden="true">{tab.icon}</span>
      <span class="label">{tab.label}</span>
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
    gap: 2px;
    color: var(--color-text-muted);
    min-height: var(--touch-target);
    font-size: 12px;
  }
  .tabbar a.active {
    color: var(--color-accent);
  }
  .icon {
    font-size: 18px;
  }
</style>
