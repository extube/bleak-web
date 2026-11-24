<script lang="ts">
  /**
   * BucketChart (DESIGN rev. 4 §3.7.5): the hand-rolled SVG M1 chart —
   * 12 five-minute buckets over the past hour, NO chart dependency, NO
   * animation (static SVG). Geometry: viewBox="0 0 320 120", width 100%;
   * 12 bar slots of 26px (bar 18px, gap 8px), baseline at y = 104. Bars
   * tint `color-mix(in srgb, var(--color-accent) 70%, transparent)`; the
   * NEWEST non-zero bucket renders at full `--color-accent`; zero buckets
   * render 2px stubs in `--color-text-disabled`; a 1px muted baseline.
   * Relative axis labels only — 5 of them (every 3rd bucket + now), muted
   * Inter 14px. The peak bucket carries a small accent dot; NO per-bar
   * value labels. §4.1 tokens only (no raw color literals anywhere).
   * `role="img"` with the summary aria-label («Сообщений за последний
   * час: {n}; пик в {bucket}.»); the empty hour renders baseline + stubs
   * + the muted «За последний час сообщений не было.» line.
   */
  import { locale, translate } from '#lib/i18n/locale';
  import { bucketTotal, peakBucketIndex, peakBucketLabel } from '../hostPanel';

  interface Props {
    /** M1 — exactly 12 five-minute bucket counts (oldest → now). */
    buckets: number[];
  }

  let { buckets }: Props = $props();

  const SLOT = 26;
  const BAR = 18;
  const BASELINE_Y = 104;
  /** Bar area above the baseline (the chart's top margin is 8). */
  const MAX_BAR = 96;
  /** The five labeled slots (every 3rd bucket + now), §3.7.5. */
  const LABEL_SLOTS = [0, 3, 6, 9, 11] as const;

  const total = $derived(bucketTotal(buckets));
  const scale = $derived(Math.max(1, ...buckets));
  const peak = $derived(peakBucketIndex(buckets));

  function barX(index: number): number {
    return 8 + index * SLOT;
  }

  function slotCenter(index: number): number {
    return barX(index) + BAR / 2;
  }

  const bars = $derived(
    buckets.map((value, index) => {
      const height = value === 0 ? 2 : Math.max(2, Math.round((value / scale) * MAX_BAR));
      return { value, index, x: barX(index), y: BASELINE_Y - height, height };
    })
  );
  const peakBar = $derived(bars[peak] ?? null);

  const axisLabels = $derived(
    [
      translate($locale, 'host.stats.axis.60'),
      translate($locale, 'host.stats.axis.45'),
      translate($locale, 'host.stats.axis.30'),
      translate($locale, 'host.stats.axis.15'),
      translate($locale, 'host.stats.axis.now')
    ] as const
  );
  const axisMeta = $derived(
    axisLabels.map((label, slot) => ({
      label,
      slot: LABEL_SLOTS[slot] ?? 0,
      x:
        slot === 0
          ? 4 // «−60 мин» start-anchored — its center would clip the viewBox
          : slot === LABEL_SLOTS.length - 1
            ? 316 // «сейчас» end-anchored at the right edge
            : slotCenter(LABEL_SLOTS[slot] ?? 0),
      anchor: slot === 0 ? 'start' : slot === LABEL_SLOTS.length - 1 ? 'end' : 'middle'
    }))
  );
  const summary = $derived(
    translate($locale, 'host.stats.aria', {
      n: String(total),
      bucket: peakBucketLabel(buckets, axisLabels)
    })
  );
  const emptyHour = $derived(translate($locale, 'host.stats.empty_hour'));
</script>

<figure class="bucket-chart">
  <svg viewBox="0 0 320 120" width="100%" role="img" aria-label={summary}>
    {#each bars as bar (bar.index)}
      <rect
        class="bar"
        class:newest={bar.index === 11 && bar.value > 0}
        class:stub={bar.value === 0}
        x={bar.x}
        y={bar.y}
        width="18"
        height={bar.height}
      />
    {/each}
    {#if total > 0 && peakBar}
      <!-- peak marker: a small accent dot above the tallest bar -->
      <circle class="peak-dot" cx={slotCenter(peak)} cy={peakBar.y - 5} r="3" />
    {/if}
    <line class="baseline" x1="6" x2="314" y1={BASELINE_Y} y2={BASELINE_Y} />
    {#each axisMeta as meta (meta.slot)}
      <text x={meta.x} y="118" text-anchor={meta.anchor}>{meta.label}</text>
    {/each}
  </svg>
  {#if total === 0}
    <p class="empty-hour" aria-live="polite">{emptyHour}</p>
  {/if}
</figure>

<style>
  .bucket-chart {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-2);
    margin: 0;
    width: 100%;
  }
  svg {
    display: block;
  }
  .bar {
    fill: color-mix(in srgb, var(--color-accent) 70%, transparent);
  }
  .bar.newest {
    fill: var(--color-accent);
  }
  .bar.stub {
    fill: var(--color-text-disabled);
  }
  .baseline {
    stroke: var(--color-text-muted);
    stroke-width: 1;
  }
  .peak-dot {
    fill: var(--color-accent);
  }
  text {
    fill: var(--color-text-muted);
    font-family: var(--font-body);
    font-size: 14px;
  }
  .empty-hour {
    margin: 0;
    font-size: 14px;
    color: var(--color-text-muted);
  }
</style>
