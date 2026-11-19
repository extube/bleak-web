/** Kit render tests (TZ-02): Chip, SegmentedControl, ErrorBanner, StatTile,
 * ShareContactSlide, CopyButton — @testing-library/svelte over happy-dom. */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/svelte';
import { tick } from 'svelte';
import { readFileSync } from 'node:fs';
import { join, sep } from 'node:path';
import ChipFixture from './fixtures/ChipFixture.svelte';
import SegmentedControl from '../src/lib/components/SegmentedControl.svelte';
import ErrorBanner from '../src/lib/components/ErrorBanner.svelte';
import StatTile from '../src/lib/components/StatTile.svelte';
import ShareContactSlide from '../src/lib/components/ShareContactSlide.svelte';
import CopyButton from '../src/lib/components/CopyButton.svelte';
import EmptyState from '../src/lib/components/EmptyState.svelte';
import SkeletonBlock from '../src/lib/components/SkeletonBlock.svelte';
import { ru } from '../src/lib/i18n/ru';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('Chip', () => {
  it('renders the label and the variant class', () => {
    render(ChipFixture, { props: { variant: 'fill-accent', label: 'Общаемся' } });
    const chip = screen.getByText('Общаемся').closest('.chip');
    expect(chip).not.toBeNull();
    expect(chip?.classList.contains('fill-accent')).toBe(true);
  });

  it('defaults to the outline-muted variant', () => {
    render(ChipFixture, { props: { label: 'Отправлено' } });
    expect(screen.getByText('Отправлено').closest('.chip')?.classList.contains('outline-muted')).toBe(
      true
    );
  });

  it('never uses the pixel-corner clip (pills stay smooth, §4.5)', () => {
    render(ChipFixture, { props: { variant: 'outline-accent', label: 'x' } });
    expect(screen.getByText('x').closest('.chip')?.classList.contains('pixel-corners')).toBe(false);
  });
});

describe('SegmentedControl', () => {
  const options = [
    { value: 'ru', label: 'RU' },
    { value: 'en', label: 'EN' }
  ];

  it('renders a labelled radiogroup with all options', () => {
    render(SegmentedControl, {
      props: { options, value: 'ru', label: 'Язык интерфейса' }
    });
    const group = screen.getByRole('radiogroup', { name: 'Язык интерфейса' });
    expect(group).not.toBeNull();
    expect(screen.getAllByRole('radio')).toHaveLength(2);
    expect(screen.getByRole('radio', { name: 'RU' }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('radio', { name: 'EN' }).getAttribute('aria-checked')).toBe('false');
  });

  it('fires onchange with the selected value', async () => {
    const onchange = vi.fn();
    render(SegmentedControl, { props: { options, value: 'ru', label: 'L', onchange } });
    const en = screen.getByRole('radio', { name: 'EN' });
    await en.click();
    expect(onchange).toHaveBeenCalledWith('en');
  });
});

describe('ErrorBanner', () => {
  it('network kind shows the §2.1 NetworkError copy', () => {
    render(ErrorBanner, { props: { kind: 'network' } });
    expect(screen.getByText(ru['common.error.network'])).toBeTruthy();
  });

  it('api kind shows the server body under the server-error title', () => {
    render(ErrorBanner, { props: { kind: 'api', message: 'room not found' } });
    expect(screen.getByText(ru['common.error.api'])).toBeTruthy();
    expect(screen.getByText('room not found')).toBeTruthy();
  });

  it('renders a Retry button when a retry handler is given', async () => {
    const onretry = vi.fn();
    render(ErrorBanner, { props: { kind: 'network', onretry } });
    const retry = screen.getByRole('button', { name: ru['common.retry'] });
    await retry.click();
    expect(onretry).toHaveBeenCalledTimes(1);
  });

  it('is announced as an alert', () => {
    render(ErrorBanner, { props: { kind: 'network' } });
    expect(screen.getByRole('alert')).toBeTruthy();
  });
});

describe('StatTile', () => {
  it('exposes the full value pair as the accessible name', () => {
    render(StatTile, { props: { value: 7, label: 'Хендшейков' } });
    const tile = screen.getByRole('img', { name: 'Хендшейков: 7' });
    expect(tile).toBeTruthy();
    expect(screen.getByText('7')).toBeTruthy();
    expect(screen.getByText('Хендшейков')).toBeTruthy();
  });
});

describe('ShareContactSlide (DESIGN §4.13.3 — the reusable slide control)', () => {
  const base = {
    label: ru['chat.contact_share.label'],
    sharedLabel: ru['chat.contact_share.shared'],
    disabledHint: ru['chat.contact_share.locked']
  };

  // Source-level CSS assertions (§4.14.1) read the component file —
  // happy-dom resolves no component CSS (same pattern as chats-page).
  const WEB_ROOT = process.cwd().endsWith(sep + 'apps' + sep + 'web')
    ? process.cwd()
    : join(process.cwd(), 'apps', 'web');
  function source(relativePath: string): string {
    return readFileSync(join(WEB_ROOT, relativePath), 'utf8');
  }

  it('armed: renders the hint and completes via the thumb activation (the accessible gesture path)', async () => {
    const oncomplete = vi.fn();
    render(ShareContactSlide, { props: { ...base, oncomplete } });
    const thumb = screen.getByRole('button', { name: base.label }) as HTMLButtonElement;
    expect(thumb.disabled).toBe(false);
    await thumb.click();
    expect(oncomplete).toHaveBeenCalledTimes(1);
  });

  it('disabled: the thumb is inert and the hint replaces the label', async () => {
    const oncomplete = vi.fn();
    render(ShareContactSlide, { props: { ...base, disabled: true, oncomplete } });
    const slide = document.querySelector('.slide');
    expect(slide?.getAttribute('aria-disabled')).toBe('true');
    const thumb = screen.getByRole('button', { name: base.disabledHint }) as HTMLButtonElement;
    expect(thumb.disabled).toBe(true);
    await thumb.click();
    expect(oncomplete).not.toHaveBeenCalled();
  });

  it('pending: the thumb cannot be re-gripped while the request is in flight', async () => {
    const oncomplete = vi.fn();
    render(ShareContactSlide, { props: { ...base, pending: true, oncomplete } });
    const thumb = screen.getByRole('button', { name: base.label }) as HTMLButtonElement;
    expect(thumb.disabled).toBe(true);
  });

  it('shared: the done glyph + the shared copy — the terminal non-interactive state', () => {
    const oncomplete = vi.fn();
    render(ShareContactSlide, { props: { ...base, shared: true, oncomplete } });
    expect(screen.getByText(base.sharedLabel)).toBeTruthy();
    const thumb = screen.getByRole('button', { name: base.sharedLabel }) as HTMLButtonElement;
    expect(thumb.disabled).toBe(true);
    expect(thumb.querySelector('svg')).toBeTruthy();
  });

  it('§4.14.1 armed: the candy-cane stripe layer renders as aria-hidden decoration', () => {
    render(ShareContactSlide, { props: base });
    const candy = document.querySelector('.slide .candy');
    expect(candy).toBeTruthy();
    expect(candy?.getAttribute('aria-hidden')).toBe('true');
    expect(document.querySelector('.slide .confetti')).toBeNull();
  });

  it('§4.14.1: the stripes render ONLY in the armed state (disabled/pending/shared stay plain)', () => {
    render(ShareContactSlide, { props: { ...base, disabled: true } });
    expect(document.querySelector('.slide .candy')).toBeNull();
    cleanup();
    render(ShareContactSlide, { props: { ...base, pending: true } });
    expect(document.querySelector('.slide .candy')).toBeNull();
    cleanup();
    render(ShareContactSlide, { props: { ...base, shared: true } });
    expect(document.querySelector('.slide .candy')).toBeNull();
  });

  it('§4.14.1 confetti: an already-shared mount never replays (keyed to gesture → shared)', () => {
    render(ShareContactSlide, { props: { ...base, shared: true } });
    expect(document.querySelector('.slide .confetti')).toBeNull();
  });

  it('§4.14.1 CSS contract: stripes are a token-colored repeating gradient, transform-only loop', () => {
    const css = source('src/lib/components/ShareContactSlide.svelte');
    // red-white candy stripes — the danger-text red + text white tokens,
    // never raw hex (token discipline)
    expect(css).toMatch(
      /repeating-linear-gradient\(\s*45deg,\s*var\(--color-danger-text\)\s+0\s+10px,\s*var\(--color-text\)\s+10px\s+20px\s*\)/
    );
    // the loop animates transform only (§4.6); background-position and
    // filter are never animated
    expect(css).toMatch(/@keyframes candy-move\s*\{[^}]*translateX/);
    expect(css).not.toMatch(/background-position:/);
    expect(css).not.toMatch(/filter:/);
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });

  it('§4.14.1 CSS contract: confetti falls from the top in the Deepa family, transform/opacity only', () => {
    const css = source('src/lib/components/ShareContactSlide.svelte');
    // varied colors — all five Deepa tokens are flake fills
    for (let n = 1; n <= 5; n += 1) {
      expect(css).toMatch(
        new RegExp(`\\.flake\\.deepa-${n}\\s*\\{[^}]*var\\(--color-deepa-${n}\\)`)
      );
    }
    // the fall is translate/rotate/opacity only (§4.6); the container is
    // pointer-transparent decoration anchored to the container's top
    expect(css).toMatch(/@keyframes confetti-fall\s*\{[\s\S]*translate\(var\(--flake-x\)/);
    expect(css).toMatch(/\.confetti\s*\{[^}]*pointer-events:\s*none/);
    expect(css).not.toMatch(/filter:/);
    // reduced-motion: no local override — the base.css catch-all governs
    expect(css).not.toMatch(/prefers-reduced-motion/);
  });
});

describe('CopyButton', () => {
  it('shows the copy label, then the transient copied feedback', async () => {
    vi.useFakeTimers();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true
    });
    render(CopyButton, { props: { value: '123456' } });
    const button = screen.getByRole('button', { name: ru['common.copy'] });
    await button.click();
    await tick();
    expect(writeText).toHaveBeenCalledWith('123456');
    expect(screen.getByRole('button', { name: ru['common.copied'] })).toBeTruthy();
    await vi.advanceTimersByTimeAsync(2100);
    await tick();
    expect(screen.getByRole('button', { name: ru['common.copy'] })).toBeTruthy();
    vi.useRealTimers();
  });
});

describe('EmptyState', () => {
  it('renders message and an optional CTA', () => {
    render(EmptyState, { props: { message: ru['people.empty'] } });
    expect(screen.getByText(ru['people.empty'])).toBeTruthy();
    expect(screen.queryByRole('link')).toBeNull();
  });
});

describe('SkeletonBlock', () => {
  it('renders an aria-hidden skeleton with the pixel-corner clip', () => {
    const { container } = render(SkeletonBlock, { props: {} });
    const block = container.querySelector('.skeleton');
    expect(block).toBeTruthy();
    expect(block?.getAttribute('aria-hidden')).toBe('true');
    expect(block?.classList.contains('pixel-corners')).toBe(true);
  });
});
