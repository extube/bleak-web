<script lang="ts">
  /**
   * Step 3b (2/2) — persona picker of the chosen old room (DESIGN §3.1):
   * pixel avatar by address, name, public bio; picking one reads the persona
   * (getRoomUser) and prefills the form with the copy notice.
   */
  import { locale, translate } from '#lib/i18n/locale';
  import type { User } from '@bleak/api-client';
  import PixelAvatar from '#lib/components/PixelAvatar.svelte';

  interface Props {
    users: User[];
    loading?: boolean;
    onpick?: (user: User) => void;
    onback?: () => void;
  }

  let { users, loading = false, onpick, onback }: Props = $props();
</script>

<div class="step">
  <h2>{translate($locale, 'join.import.pick_persona')}</h2>
  {#if loading}
    <p class="muted" role="status">{translate($locale, 'common.loading')}</p>
  {:else if users.length === 0}
    <p class="muted">{translate($locale, 'people.empty')}</p>
  {:else}
    <ul class="rows">
      {#each users as user (user.address)}
        <li>
          <button type="button" class="row" onclick={() => onpick?.(user)}>
            <PixelAvatar address={user.address} size={44} />
            <span class="texts">
              <span class="name">{user.name}</span>
              {#if user.public_bio}
                <span class="muted">{user.public_bio}</span>
              {/if}
            </span>
          </button>
        </li>
      {/each}
    </ul>
  {/if}
  <button type="button" class="link" onclick={() => onback?.()}>
    {translate($locale, 'common.back')}
  </button>
</div>

<style>
  .step {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    text-align: left;
  }
  h2 {
    font-size: 28px;
  }
  .rows {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  .row {
    width: 100%;
    display: flex;
    align-items: center;
    gap: var(--space-3);
    background: var(--color-surface-elevated);
    border: none;
    border-radius: var(--radius-md);
    min-height: var(--touch-target);
    padding: var(--space-2) var(--space-4);
    color: var(--color-text);
    text-align: left;
    transition: background-color 120ms ease-out;
  }
  .texts {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  .name {
    font-weight: 600;
  }
  .muted {
    color: var(--color-text-muted);
    font-size: 14px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .link {
    align-self: flex-start;
    background: transparent;
    border: none;
    color: var(--color-text-muted);
    min-height: var(--touch-target);
    font-size: 14px;
  }
</style>
