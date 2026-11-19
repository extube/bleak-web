<script lang="ts">
  import '@fontsource-variable/handjet';
  import '@fontsource-variable/inter';
  import '#lib/styles/base.css';
  import { onMount } from 'svelte';
  import { get } from 'svelte/store';
  import { page } from '$app/state';
  import { initLocale, locale, translate } from '#lib/i18n/locale';
  import { initIdentity, identity } from '#lib/stores/identity';
  import { evaluateContactsUnseen } from '#lib/stores/contactsSeen';
  import { api } from '#lib/api/client';
  import TabBar from '#lib/components/TabBar.svelte';

  let { children } = $props();

  onMount(() => {
    initLocale();
    initIdentity();
    // §4.14.2: ONE mount-time contacts read feeds the TabBar badge dot
    // (best-effort — a failure just leaves the dot off; /contacts marks
    // seen on visit). No dedicated badge polling: the other pages have no
    // contacts list of their own to piggyback the evaluation on (§2.2).
    const id = get(identity);
    if (id) {
      void api
        .listContactsSharedWith(id.userAddress)
        .then((contacts) => evaluateContactsUnseen(id.roomAddress, id.userAddress, contacts))
        .catch(() => {
          /* badge is best-effort */
        });
    }
  });

  // Join screen is pre-room: no tab bar there.
  const isJoin = $derived(page.url.pathname === '/');
</script>

<svelte:head>
  <!-- Concept §7.1.1: no bare app-name title; route-neutral join-flow identity. -->
  <title>{translate($locale, 'join.title')}</title>
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
