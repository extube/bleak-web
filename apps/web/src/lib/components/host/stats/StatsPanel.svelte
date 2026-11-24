<script lang="ts">
  /**
   * StatsPanel (DESIGN rev. 4 §3.7.5): the statistics composition on
   * `/host/[room_address]` (region 2, right after the members). Section
   * header «Статистика»; the M2/M3/M4 tile row as a `<dl>` (caption =
   * term, numeral = value; M4 is the split tile «{active} активных ·
   * {finished} завершено») + the M1 `BucketChart` card with the total
   * caption «Сообщений за час: {n}».
   *
   * States: first pass → skeletons; later ticks swap data in place; empty
   * room → the members-empty copy and NO tiles/chart (the engine skipped
   * the fan-out); partial → subset metrics + the undercount warning with
   * retry; full error → `ErrorBanner` with the last-known tiles dimmed.
   *
   * GATED BLOCK (rule B, TZ §9.4.1-c): handshake metrics 5–7 are
   * OMITTED until the flag-6.9a / `tz2-07a` amendment lands — only the
   * honest hint line renders under the section. No locked rows, no
   * zeros, no proxy metric. When the gate lifts, M5 joins the tile row
   * and M6/M7 render as two list cards under the chart WITHOUT design
   * rework (their placement is already reserved by the composition).
   */
  import type { HostStats } from './hostStats';
  import { locale, translate } from '#lib/i18n/locale';
  import ErrorBanner from '#lib/components/ErrorBanner.svelte';
  import SkeletonBlock from '#lib/components/SkeletonBlock.svelte';
  import BucketChart from './BucketChart.svelte';

  interface Props {
    /** The latest engine pass (null until the first one lands). */
    stats: HostStats | null;
    /** True until the first pass completes (skeletons). */
    loading?: boolean;
    /** Full pass / base-read failure (the page owns the banner). */
    error?: null | { kind: 'network' | 'api'; message: string | null };
    onretry?: () => void;
  }

  let { stats, loading = false, error = null, onretry }: Props = $props();

  const title = $derived(translate($locale, 'host.stats.title'));
  const membersLabel = $derived(translate($locale, 'host.stats.members'));
  const chatsLabel = $derived(translate($locale, 'host.stats.chats'));
  const split = $derived(
    stats
      ? translate($locale, 'host.stats.active', {
          active: String(stats.active),
          finished: String(stats.finished)
        })
      : ''
  );
  const caption = $derived(
    stats ? translate($locale, 'host.stats.messages_hour', { n: String(stats.total) }) : ''
  );
  const emptyRoom = $derived(translate($locale, 'host.empty_live'));
  const partialWarning = $derived(translate($locale, 'host.stats.partial'));
  const gatedHint = $derived(translate($locale, 'host.stats.gated.hint'));
</script>

<section class="stats" aria-label={title}>
  <h2>{title}</h2>

  {#if error}
    <ErrorBanner kind={error.kind} message={error.message} onretry={() => onretry?.()} />
  {/if}

  {#if loading && stats === null}
    <!-- First pass: skeletons for the tile row + the chart card; later
         ticks swap data in place (no skeleton flicker, §3.7.5 states). -->
    <div class="skeleton-row" aria-hidden="true">
      {#each [0, 1, 2] as tile (tile)}
        <SkeletonBlock width="100%" height="88px" />
      {/each}
    </div>
    <SkeletonBlock width="100%" height="160px" />
  {:else if stats}
    {#if stats.members === 0}
      <!-- Empty room: the members-empty copy; no tiles, no chart (the
           engine skipped the fan-out entirely). -->
      <p class="empty-room">{emptyRoom}</p>
    {:else}
      <!-- The tile row is a <dl>: caption = term, numeral = value;
           M4 is the split tile. -->
      <dl class="tiles" class:dimmed={error !== null}>
        <div class="tile pixel-corners">
          <dt>{membersLabel}</dt>
          <dd class="numeral">{stats.members}</dd>
        </div>
        <div class="tile pixel-corners">
          <dt>{chatsLabel}</dt>
          <dd class="numeral">{stats.chats}</dd>
        </div>
        <div class="tile pixel-corners">
          <dt>{chatsLabel}</dt>
          <dd class="numeral split">{split}</dd>
        </div>
      </dl>

      <div class="chart-card pixel-corners" class:dimmed={error !== null}>
        <p class="caption">{caption}</p>
        <BucketChart buckets={stats.buckets} />
      </div>
    {/if}

    {#if stats.partial}
      <!-- Partial data: subset metrics + the undercount warning + retry. -->
      <p class="partial" aria-live="polite">{partialWarning}</p>
      <button type="button" class="retry" onclick={() => onretry?.()}>
        {translate($locale, 'common.retry')}
      </button>
    {/if}
  {/if}

  <!-- Rule-B honest hint: the ONLY handshake reference on the panel. -->
  <p class="gated-hint">{gatedHint}</p>
</section>

<style>
  .stats {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }
  h2 {
    font-family: var(--font-pixel);
    font-size: 28px;
    letter-spacing: 0.04em;
    margin: 0;
  }
  .skeleton-row {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: var(--space-3);
  }
  .tiles {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: var(--space-3);
    margin: 0;
    transition: opacity 200ms ease-out;
  }
  .tile {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--space-1);
    background: var(--color-surface-elevated);
    border-radius: var(--radius-md);
    padding: var(--space-4);
    min-height: 88px;
  }
  dt {
    font-size: 14px;
    color: var(--color-text-muted);
  }
  dd {
    margin: 0;
  }
  .numeral {
    font-family: var(--font-pixel);
    font-size: 32px;
    line-height: 1;
    color: var(--color-text);
    text-align: center;
  }
  .numeral.split {
    font-size: 20px;
    line-height: 1.2;
  }
  .chart-card {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    background: var(--color-surface-elevated);
    border-radius: var(--radius-md);
    padding: var(--space-4);
    transition: opacity 200ms ease-out;
  }
  .caption {
    margin: 0;
    font-size: 14px;
    color: var(--color-text-muted);
  }
  .dimmed {
    opacity: 0.5;
  }
  .empty-room {
    margin: 0;
    font-size: 14px;
    color: var(--color-text-muted);
  }
  .partial {
    margin: 0;
    font-size: 14px;
    color: var(--color-text-muted);
  }
  .retry {
    align-self: flex-start;
    min-height: var(--touch-target);
    padding: 0 var(--space-5);
    border: 1px solid var(--color-text-disabled-strong);
    border-radius: var(--radius-pill);
    background: transparent;
    color: var(--color-text);
    font-weight: 600;
    font-size: 14px;
  }
  .gated-hint {
    margin: 0;
    font-size: 14px;
    color: var(--color-text-muted);
  }
  @media (max-width: 560px) {
    /* The tile row wraps 2×2 on narrow phones (§3.7.5 responsive). */
    .tiles,
    .skeleton-row {
      grid-template-columns: repeat(2, 1fr);
    }
  }
</style>
