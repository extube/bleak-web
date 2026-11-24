/** BucketChart tests (TZ13-03 Part B, DESIGN rev. 4 §3.7.5): hand-rolled
 * SVG structure (viewBox 0 0 320 120, 12 bar slots, 2px disabled stubs,
 * 1px muted baseline, the 5 relative axis labels, the peak accent dot,
 * NO per-bar value labels), the summary aria-label, the empty-hour copy
 * and the §4.1 token-only rule (NO raw color literals anywhere in the
 * rendered SVG markup). */
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/svelte';
import BucketChart from '../src/lib/components/host/stats/BucketChart.svelte';
import { ru } from '../src/lib/i18n/ru';

afterEach(() => cleanup());

function mount(buckets: number[]): HTMLElement {
  const { container } = render(BucketChart, { props: { buckets } });
  return container;
}

describe('chart structure', () => {
  it('renders the SVG with the pinned viewBox and role=img + summary aria-label', () => {
    const container = mount(new Array<number>(12).fill(0));
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute('viewBox')).toBe('0 0 320 120');
    expect(svg?.getAttribute('width')).toBe('100%');
    expect(svg?.getAttribute('role')).toBe('img');
    // «Сообщений за последний час: {n}; пик в {bucket}.»
    expect(svg?.getAttribute('aria-label')).toBe(
      ru['host.stats.aria']
        .replace('{n}', '0')
        .replace('{bucket}', ru['host.stats.axis.60'])
    );
  });

  it('renders 12 bar slots with bars for non-zero buckets and 2px stubs for zeros', () => {
    const buckets = [0, 0, 3, 0, 0, 1, 0, 0, 0, 0, 0, 2];
    const container = mount(buckets);
    const bars = container.querySelectorAll('rect.bar');
    expect(bars.length).toBe(12);
    const stubs = container.querySelectorAll('rect.bar.stub');
    expect(stubs.length).toBe(9); // the zero buckets
    stubs.forEach((stub) => {
      expect(stub.getAttribute('height')).toBe('2');
    });
    // The tallest bar (3) is full-height in the 96px area above y=104.
    const tallest = container.querySelectorAll('rect.bar:not(.stub)')[0];
    expect(tallest?.getAttribute('height')).toBe('96');
    expect(tallest?.getAttribute('y')).toBe('8');
    // Baseline at y = 104.
    const baseline = container.querySelector('line.baseline');
    expect(baseline?.getAttribute('y1')).toBe('104');
    expect(baseline?.getAttribute('y2')).toBe('104');
  });

  it('renders the newest bucket at full accent when non-zero (no full-accent flag on zero)', () => {
    const container = mount([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4]);
    const bars = container.querySelectorAll('rect.bar');
    expect(bars[11]?.classList.contains('newest')).toBe(true);

    const zeroNewest = mount([5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(zeroNewest.querySelectorAll('rect.bar')[11]?.classList.contains('newest')).toBe(false);
  });

  it('marks exactly the 5 relative axis labels (every 3rd bucket + now); no per-bar value labels', () => {
    const container = mount([1, 2, 3, 0, 0, 0, 0, 0, 0, 0, 0, 9]);
    const texts = container.querySelectorAll('svg text');
    expect(texts.length).toBe(5);
    const labels = Array.from(texts).map((t) => t.textContent);
    expect(labels).toEqual([
      ru['host.stats.axis.60'],
      ru['host.stats.axis.45'],
      ru['host.stats.axis.30'],
      ru['host.stats.axis.15'],
      ru['host.stats.axis.now']
    ]);
  });

  it('carries the peak accent dot above the tallest bar', () => {
    const container = mount([0, 0, 0, 0, 7, 0, 0, 0, 0, 0, 0, 1]);
    const dot = container.querySelector('circle.peak-dot');
    expect(dot).not.toBeNull();
    // Slot 4 center: 8 + 4*26 + 9 = 121.
    expect(dot?.getAttribute('cx')).toBe('121');
    // The tallest bar's height = 96 → its top y = 8; the dot sits above it.
    expect(dot?.getAttribute('cy')).toBe('3');
  });

  it('the summary names the peak bucket (nearest labeled position)', () => {
    const container = mount([0, 0, 0, 0, 0, 0, 7, 0, 0, 0, 0, 0]);
    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('aria-label')).toBe(
      ru['host.stats.aria']
        .replace('{n}', '7')
        .replace('{bucket}', ru['host.stats.axis.30'])
    );
  });
});

describe('empty hour', () => {
  it('renders baseline + stubs + the muted «За последний час сообщений не было.» line', () => {
    const container = mount(new Array<number>(12).fill(0));
    expect(container.querySelectorAll('rect.bar.stub').length).toBe(12);
    expect(container.querySelector('line.baseline')).not.toBeNull();
    expect(container.textContent).toContain(ru['host.stats.empty_hour']);
  });
});

describe('token-only SVG (§4.1)', () => {
  it('contains NO raw color literals — hex, rgb() or named fills', () => {
    const container = mount([3, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 5]);
    const html = container.innerHTML;
    expect(html).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(html).not.toContain('rgb(');
    expect(html).not.toContain('rgba(');
    // Fills/strokes live in the component's CSS (classes), never inline.
    expect(html).not.toMatch(/fill="/);
    expect(html).not.toMatch(/stroke="/);
  });
});
