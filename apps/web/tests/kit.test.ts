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
import { ICON_RECTS } from '../src/lib/components/icons/registry';
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

describe('ShareContactSlide v2 (DESIGN §4.15.A — glass pill, marquee candy trail, 85% snap)', () => {
  const base = {
    label: ru['chat.contact_share.label'],
    sharedLabel: ru['chat.contact_share.shared'],
    disabledHint: ru['chat.contact_share.locked']
  };

  // Source-level CSS assertions (§4.14.1/§4.15.A) read the component file —
  // happy-dom resolves no component CSS (same pattern as chats-page).
  const WEB_ROOT = process.cwd().endsWith(sep + 'apps' + sep + 'web')
    ? process.cwd()
    : join(process.cwd(), 'apps', 'web');
  function source(relativePath: string): string {
    return readFileSync(join(WEB_ROOT, relativePath), 'utf8');
  }

  // Behavioral drag tests stub the real §4.15.A geometry (happy-dom does
  // no layout): 288px track / 68px thumb → maxDx 220, snapPoint 0.85×220.
  const TRACK_W = 288;
  const THUMB_W = 68;
  function stubGeometry(): void {
    const track = document.querySelector('.slide .track') as HTMLElement;
    const thumb = document.querySelector('.slide .thumb') as HTMLElement;
    Object.defineProperty(track, 'clientWidth', {
      configurable: true,
      value: TRACK_W
    });
    Object.defineProperty(thumb, 'clientWidth', {
      configurable: true,
      value: THUMB_W
    });
  }

  function pointer(
    el: Element,
    type: 'pointerdown' | 'pointermove' | 'pointerup',
    clientX: number
  ): void {
    el.dispatchEvent(
      new PointerEvent(type, {
        bubbles: true,
        cancelable: true,
        button: 0,
        pointerId: 1,
        clientX
      })
    );
  }

  it('armed: renders the hint and completes via the thumb activation — the accessible click/Enter path is EXEMPT from the 85% rule (§4.15.A)', async () => {
    const oncomplete = vi.fn();
    render(ShareContactSlide, { props: { ...base, oncomplete } });
    stubGeometry();
    const thumb = screen.getByRole('button', { name: base.label }) as HTMLButtonElement;
    expect(thumb.disabled).toBe(false);
    // dx = 0 (far below the 187px snap point) — activation completes anyway
    await thumb.click();
    await tick();
    expect(oncomplete).toHaveBeenCalledTimes(1);
    // the completion animates the thumb to the end (§4.15.A)
    expect(thumb.style.transform).toBe('translateX(220px)');
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

  it('shared: the done glyph + the shared copy — the thumb locks right, the terminal non-interactive state', () => {
    const oncomplete = vi.fn();
    render(ShareContactSlide, { props: { ...base, shared: true, oncomplete } });
    expect(screen.getByText(base.sharedLabel)).toBeTruthy();
    const slide = document.querySelector('.slide');
    expect(slide?.classList.contains('shared')).toBe(true);
    const thumb = screen.getByRole('button', { name: base.sharedLabel }) as HTMLButtonElement;
    expect(thumb.disabled).toBe(true);
    expect(thumb.querySelector('svg')).toBeTruthy();
  });

  it('§4.15.A armed: the candy trail renders as an aria-hidden clip layer bound to the drag (width = 4px + dx)', async () => {
    const oncomplete = vi.fn();
    render(ShareContactSlide, { props: { ...base, oncomplete } });
    stubGeometry();
    const candy = document.querySelector('.slide .candy') as HTMLElement;
    expect(candy).toBeTruthy();
    expect(candy.getAttribute('aria-hidden')).toBe('true');
    expect(candy.style.width).toBe('4px'); // at rest: just the 4px padding
    expect(document.querySelector('.slide .confetti')).toBeNull();
    // drag to dx = 110 → the trail reaches the thumb's near edge (114px)
    const thumb = screen.getByRole('button', { name: base.label });
    pointer(thumb, 'pointerdown', 0);
    await tick();
    pointer(thumb, 'pointermove', 110);
    await tick();
    expect(candy.style.width).toBe('114px');
    // release below the snap point → spring back to the 4px rest
    pointer(thumb, 'pointerup', 110);
    await tick();
    expect(candy.style.width).toBe('4px');
    expect(oncomplete).not.toHaveBeenCalled();
  });

  it('§4.15.A: the trail renders ONLY in the armed state (disabled/pending/shared stay plain)', () => {
    render(ShareContactSlide, { props: { ...base, disabled: true } });
    expect(document.querySelector('.slide .candy')).toBeNull();
    cleanup();
    render(ShareContactSlide, { props: { ...base, pending: true } });
    expect(document.querySelector('.slide .candy')).toBeNull();
    cleanup();
    render(ShareContactSlide, { props: { ...base, shared: true } });
    expect(document.querySelector('.slide .candy')).toBeNull();
  });

  it('§4.15.A release rule: below 85% springs back, at/past 85% completes once', async () => {
    const oncomplete = vi.fn();
    render(ShareContactSlide, { props: { ...base, oncomplete } });
    stubGeometry();
    const thumb = screen.getByRole('button', { name: base.label });
    // 110px of the 220px drag range (50% — below the 187px snap point)
    pointer(thumb, 'pointerdown', 100);
    pointer(thumb, 'pointermove', 210);
    pointer(thumb, 'pointerup', 210);
    await tick();
    expect(oncomplete).not.toHaveBeenCalled();
    expect((thumb as HTMLElement).style.transform).toBe('translateX(0px)');
    // 200px of 220px (90.9% — past the snap point) → complete, exactly once
    pointer(thumb, 'pointerdown', 100);
    pointer(thumb, 'pointermove', 300);
    pointer(thumb, 'pointerup', 300);
    await tick();
    expect(oncomplete).toHaveBeenCalledTimes(1);
    expect((thumb as HTMLElement).style.transform).toBe('translateX(220px)');
  });

  it('§4.15.A: dragging all the way to the end mid-gesture completes at once', async () => {
    const oncomplete = vi.fn();
    render(ShareContactSlide, { props: { ...base, oncomplete } });
    stubGeometry();
    const thumb = screen.getByRole('button', { name: base.label });
    pointer(thumb, 'pointerdown', 0);
    pointer(thumb, 'pointermove', 220); // dx = maxDx → immediate completion
    await tick();
    expect(oncomplete).toHaveBeenCalledTimes(1);
    expect((thumb as HTMLElement).style.transform).toBe('translateX(220px)');
    pointer(thumb, 'pointerup', 220);
    await tick();
    expect(oncomplete).toHaveBeenCalledTimes(1); // the release adds nothing
  });

  it('§4.15.A: the hint fades out with drag progress (inline opacity = 1 − dx/maxDx)', async () => {
    render(ShareContactSlide, { props: base });
    stubGeometry();
    const hint = document.querySelector('.slide .hint') as HTMLElement;
    const thumb = document.querySelector('.slide .thumb') as HTMLElement;
    expect(hint.style.opacity).toBe('1');
    pointer(thumb, 'pointerdown', 0);
    pointer(thumb, 'pointermove', 110); // halfway → opacity 0.5
    await tick();
    expect(hint.style.opacity).toBe('0.5');
    pointer(thumb, 'pointerup', 110); // spring back → fully visible again
    await tick();
    expect(hint.style.opacity).toBe('1');
  });

  it('§4.15.A variant API: base scope by default, the sheet scope class ships', () => {
    render(ShareContactSlide, { props: base });
    let slide = document.querySelector('.slide');
    expect(slide?.classList.contains('variant-base')).toBe(true);
    expect(slide?.classList.contains('variant-sheet')).toBe(false);
    cleanup();
    render(ShareContactSlide, { props: { ...base, variant: 'sheet' } });
    slide = document.querySelector('.slide');
    expect(slide?.classList.contains('variant-sheet')).toBe(true);
    expect(slide?.classList.contains('variant-base')).toBe(false);
  });

  it('§4.15.A markup contract: the thumb glyph follows the variant — base phone, sheet arrow-right', () => {
    render(ShareContactSlide, { props: base });
    expect(
      document.querySelector('.slide .thumb')?.querySelector('svg')
    ).toBeTruthy();
    cleanup();
    render(ShareContactSlide, { props: { ...base, variant: 'sheet' } });
    expect(
      document.querySelector('.slide .thumb')?.querySelector('svg')
    ).toBeTruthy();
    const css = source('src/lib/components/ShareContactSlide.svelte');
    expect(css).toMatch(/\{:else if variant === 'sheet'\}\s*<PixelIcon name="arrow-right"/);
    expect(css).toMatch(/\{:else\}\s*<PixelIcon name="phone"/);
  });

  it('§4.15.A the phone glyph is registered with in-grid 16×16 rect data', () => {
    const rects = ICON_RECTS.phone;
    expect(rects.length).toBeGreaterThan(0);
    for (const [x, y, w, h] of rects) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(x + w).toBeLessThanOrEqual(16);
      expect(y + h).toBeLessThanOrEqual(16);
    }
  });

  it('§4.14.1 confetti: an already-shared mount never replays (keyed to gesture → shared)', () => {
    render(ShareContactSlide, { props: { ...base, shared: true } });
    expect(document.querySelector('.slide .confetti')).toBeNull();
  });

  it('§4.15.A CSS contract: the glass pill — 76px track at min(100%, 288px), blur backdrop, token color-mix surfaces', () => {
    const css = source('src/lib/components/ShareContactSlide.svelte');
    // geometry: the ~3.8:1 pill (288 / 76) at full radius
    expect(css).toMatch(/--slide-height:\s*76px/);
    expect(css).toMatch(/width:\s*min\(100%,\s*288px\)/);
    expect(css).toMatch(/border-radius:\s*var\(--radius-pill\)/);
    // glassmorphism: the -webkit- prefixed twin ships with the standard
    expect(css).toMatch(/backdrop-filter:\s*blur\(12px\)/);
    expect(css).toMatch(/-webkit-backdrop-filter:\s*blur\(12px\)/);
    // translucent token surfaces — color-mix over existing tokens only
    expect(css).toMatch(
      /--slide-track-bg:\s*color-mix\(in srgb, var\(--color-bg\) 45%, transparent\)/
    );
    expect(css).toMatch(
      /--slide-track-border:\s*color-mix\(in srgb, var\(--color-text\) 18%, transparent\)/
    );
    // no raw hex anywhere — token discipline (§4.1)
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });

  it('§4.15.A CSS contract: the thumb is a trackHeight − 8px white circle with the green phone ink', () => {
    const css = source('src/lib/components/ShareContactSlide.svelte');
    expect(css).toMatch(/--slide-thumb:\s*var\(--color-text\)/);
    expect(css).toMatch(/--slide-thumb-ink:\s*var\(--color-check-green\)/);
    // the invariant: thumb = trackHeight − 8px (the 4px internal padding)
    expect(css).toMatch(
      /\.thumb\s*\{[\s\S]*?width:\s*calc\(var\(--slide-height\) - 8px\)/
    );
    expect(css).toMatch(
      /\.thumb\s*\{[\s\S]*?height:\s*calc\(var\(--slide-height\) - 8px\)/
    );
  });

  it('§4.15.A CSS contract: candy trail — 12px token stripes, the seamless 33.941px marquee loop, transform-only', () => {
    const css = source('src/lib/components/ShareContactSlide.svelte');
    // WIDER + brighter than the §4.14.1 band: full-opacity 12px stripes,
    // red-white candy via the internal tokens (never raw hex)
    expect(css).toMatch(
      /repeating-linear-gradient\(\s*45deg,\s*var\(--slide-stripe-a\)\s+0\s+12px,\s*var\(--slide-stripe-b\)\s+12px\s+24px\s*\)/
    );
    // the clip layer is bound to the drag: width = the 4px padding + dx
    expect(css).toMatch(/\.candy\s*\{[^}]*overflow:\s*hidden/);
    expect(css).toMatch(/style:width="\{4 \+ dx\}px"/);
    // seamless loop: the 24px stripe period ÷ sin45° ≈ 33.941px horizontal
    // shift, 1.1s linear infinite, transform-only (§4.6)
    expect(css).toMatch(/@keyframes candy-move\s*\{[^}]*translateX\(0\)/);
    expect(css).toMatch(
      /@keyframes candy-move\s*\{[\s\S]*?translateX\(-33\.941px\)/
    );
    expect(css).toMatch(/animation:\s*candy-move\s+1\.1s\s+linear\s+infinite/);
    expect(css).not.toMatch(/background-position:/);
    // no standalone filter animation (the glass blur is backdrop-filter)
    expect(css).not.toMatch(/(?<!-)filter:/);
  });

  it('§4.15.A CSS contract: the hint fades inline with drag progress and carries the 2.4s transform-only shimmer', () => {
    const css = source('src/lib/components/ShareContactSlide.svelte');
    // the fade is the inline opacity = 1 − progress binding
    expect(css).toMatch(/style:opacity=\{`\$\{armed \? 1 - progress : 1\}`\}/);
    // the sheen sweeps the hint text only while armed, transform-only
    expect(css).toMatch(/\.armed \.hint::after/);
    expect(css).toMatch(/animation:\s*hint-sheen\s+2\.4s\s+linear\s+infinite/);
    expect(css).toMatch(/@keyframes hint-sheen\s*\{[^}]*translateX/);
    expect(css).not.toMatch(/prefers-reduced-motion/);
  });

  it('§4.15.A CSS contract: the 85% snap / spring-back transitions', () => {
    const css = source('src/lib/components/ShareContactSlide.svelte');
    // default release = the 160ms ease-out completion snap
    expect(css).toMatch(/transition:\s*transform\s+160ms\s+ease-out/);
    // below the snap point: the 240ms light-overshoot spring on the thumb
    expect(css).toMatch(
      /transition:\s*transform\s+240ms\s+cubic-bezier\(0\.34, 1\.56, 0\.64, 1\)/
    );
    // the trail mirrors the same release pair
    expect(css).toMatch(/transition:\s*width\s+160ms\s+ease-out/);
    expect(css).toMatch(
      /transition:\s*width\s+240ms\s+cubic-bezier\(0\.34, 1\.56, 0\.64, 1\)/
    );
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
    // no standalone filter animation — the glass backdrop-filter is the
    // only `filter` in the file (negative lookbehind over `backdrop-`)
    expect(css).not.toMatch(/(?<!-)filter:/);
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
