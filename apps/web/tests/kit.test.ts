/** Kit render tests (TZ-02): Chip, SegmentedControl, ErrorBanner, StatTile,
 * ContactStub, CopyButton — @testing-library/svelte over happy-dom. */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/svelte';
import { tick } from 'svelte';
import ChipFixture from './fixtures/ChipFixture.svelte';
import SegmentedControl from '../src/lib/components/SegmentedControl.svelte';
import ErrorBanner from '../src/lib/components/ErrorBanner.svelte';
import StatTile from '../src/lib/components/StatTile.svelte';
import ContactStub from '../src/lib/components/ContactStub.svelte';
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

describe('ContactStub', () => {
  it('renders the coming-later copy, disabled and non-interactive', () => {
    render(ContactStub, { props: {} });
    const stub = screen.getByText(ru['chat.contact_stub']).closest('.contact-stub');
    expect(stub).toBeTruthy();
    expect(stub?.getAttribute('aria-disabled')).toBe('true');
    // no interactive element inside — never enabled by any flow (§2.1)
    expect(stub?.querySelector('button, a[href], input')).toBeNull();
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
