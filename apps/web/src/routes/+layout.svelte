<script lang="ts">
  import '@fontsource-variable/handjet';
  import '@fontsource-variable/inter';
  import '#lib/styles/base.css';
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  import { initLocale } from '#lib/i18n/locale';
  import { initIdentity } from '#lib/stores/identity';
  import TabBar from '#lib/components/TabBar.svelte';

  let { children } = $props();

  onMount(() => {
    initLocale();
    initIdentity();
  });

  // Join screen is pre-room: no tab bar there.
  const isJoin = $derived(page.url.pathname === '/');
</script>

<svelte:head>
  <title>bleak-web</title>
</svelte:head>

<div class="app-shell">
  {@render children()}
  {#if !isJoin}
    <TabBar />
  {/if}
</div>

<style>
  .app-shell {
    min-height: 100dvh;
    display: flex;
    flex-direction: column;
  }
</style>
