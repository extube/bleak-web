/**
 * Avatar trait derivation tests (TZ-02): FNV-1a determinism and trait
 * bounds (DESIGN §4.3); PixelAvatar backdrop padding (§4.8.2).
 */
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/svelte';
import {
  CODE_HUES,
  codeHue,
  deriveTraits,
  fnv1a,
  isParseableAddress,
  TRAIT_COUNTS
} from '../src/lib/avatar/traits';
import PixelAvatar from '../src/lib/components/PixelAvatar.svelte';

describe('fnv1a', () => {
  it('is deterministic', () => {
    expect(fnv1a('0xroom123')).toBe(fnv1a('0xroom123'));
  });

  it('matches the known FNV-1a 32-bit vectors', () => {
    // Standard test vectors for 32-bit FNV-1a (xor-then-multiply).
    expect(fnv1a('')).toBe(0x811c9dc5);
    expect(fnv1a('a')).toBe(0xe40c292c);
    expect(fnv1a('foobar')).toBe(0xbf9cf968);
  });

  it('returns an unsigned 32-bit integer', () => {
    for (const input of ['', 'x', '0xuser42', 'Тест']) {
      const hash = fnv1a(input);
      expect(hash).toBeGreaterThanOrEqual(0);
      expect(hash).toBeLessThanOrEqual(0xffffffff);
      expect(Number.isInteger(hash)).toBe(true);
    }
  });
});

describe('deriveTraits — determinism and bounds', () => {
  const addresses = Array.from({ length: 64 }, (_, i) => `0xuser${i}`);

  it('same address ⇒ same traits', () => {
    const first = deriveTraits('0xdeadbeef');
    const second = deriveTraits('0xdeadbeef');
    expect(second).toEqual(first);
  });

  it('different addresses may differ (sanity: not a constant)', () => {
    const traits = addresses.map(deriveTraits);
    const distinct = new Set(traits.map((t) => JSON.stringify(t)));
    expect(distinct.size).toBeGreaterThan(1);
  });

  it('every trait stays inside its palette bound', () => {
    for (const address of [...addresses, '', '0x', 'Тестовая персона', 'a'.repeat(100)]) {
      const t = deriveTraits(address);
      expect(t.skin).toBeGreaterThanOrEqual(0);
      expect(t.skin).toBeLessThan(TRAIT_COUNTS.skin);
      expect(t.hairstyle).toBeGreaterThanOrEqual(0);
      expect(t.hairstyle).toBeLessThan(TRAIT_COUNTS.hairstyle);
      expect(t.hairColor).toBeGreaterThanOrEqual(0);
      expect(t.hairColor).toBeLessThan(TRAIT_COUNTS.hairColor);
      expect(t.facialHair).toBeGreaterThanOrEqual(0);
      expect(t.facialHair).toBeLessThan(TRAIT_COUNTS.facialHair);
      expect(t.glasses).toBeGreaterThanOrEqual(0);
      expect(t.glasses).toBeLessThan(TRAIT_COUNTS.glasses);
      expect(t.backdrop).toBeGreaterThanOrEqual(0);
      expect(t.backdrop).toBeLessThan(TRAIT_COUNTS.backdrop);
    }
  });

  it('covers the documented palette sizes', () => {
    expect(TRAIT_COUNTS).toEqual({
      skin: 4,
      hairstyle: 8,
      hairColor: 5,
      facialHair: 4,
      glasses: 3,
      backdrop: 5
    });
  });
});

describe('codeHue — chat color assignment (Concept §7.1.2, DESIGN §4.8.1)', () => {
  it('is the exact fnv1a(address) % 4 rule over the documented hue order', () => {
    for (const address of ['0xme', '0xa', '0xdeadbeef', '0xroom123', 'Тестовая персона', '']) {
      expect(codeHue(address)).toBe(CODE_HUES[fnv1a(address) % 4]);
    }
    expect(CODE_HUES).toEqual(['yellow', 'orange', 'blue', 'violet']);
  });

  it('is deterministic: same address ⇒ same hue', () => {
    expect(codeHue('0xalice')).toBe(codeHue('0xalice'));
    expect(codeHue('0xbob')).toBe(codeHue('0xbob'));
  });

  it('always returns one of the four hues, and all four are reachable', () => {
    const addresses = Array.from({ length: 256 }, (_, i) => `0xuser${i}`);
    const seen = new Set<string>();
    for (const address of addresses) {
      expect(CODE_HUES).toContain(codeHue(address));
      seen.add(codeHue(address));
    }
    expect(seen.size).toBe(4);
  });

  it('the two sides of a chat get their own hues (mine is NOT fixed yellow)', () => {
    // Distinct addresses may share a hue (4 buckets), but the mine side is
    // hashed from MY address — not hardwired.
    const hues = new Set(
      ['0xme', '0xa', '0xb', '0xc', '0xd', '0xe'].map((address) => codeHue(address))
    );
    expect(hues.size).toBeGreaterThan(1);
  });
});

describe('isParseableAddress — pixel-ghost fallback condition', () => {
  it('accepts non-empty addresses', () => {
    expect(isParseableAddress('0xroom123')).toBe(true);
    expect(isParseableAddress('x')).toBe(true);
  });

  it('rejects empty, blank and missing addresses', () => {
    expect(isParseableAddress('')).toBe(false);
    expect(isParseableAddress('   ')).toBe(false);
    expect(isParseableAddress(null)).toBe(false);
    expect(isParseableAddress(undefined)).toBe(false);
  });
});

describe('PixelAvatar — backdrop padding (Concept §7.1.3, DESIGN §4.8.2)', () => {
  afterEach(() => {
    cleanup();
  });

  const SIZES = [16, 32, 44, 56, 64];

  function frameOf(container: HTMLElement): HTMLElement {
    const frame = container.firstElementChild;
    if (!(frame instanceof HTMLElement)) throw new Error('PixelAvatar frame not rendered');
    return frame;
  }

  function svgOf(container: HTMLElement): Element {
    const svg = container.querySelector('svg');
    if (!svg) throw new Error('PixelAvatar svg not rendered');
    return svg;
  }

  it('pads the art by 1px per side at every rendered size, keeping the outer box the declared size', () => {
    for (const size of SIZES) {
      const { container } = render(PixelAvatar, { props: { address: '0xdeadbeef', size } });
      const frame = frameOf(container);
      // The outer box never changes — consumers need no layout adjustments.
      expect(frame.style.width).toBe(`${size}px`);
      expect(frame.style.height).toBe(`${size}px`);
      // The art content shrinks by the padding (1px per side), not the box.
      const svg = svgOf(container);
      expect(svg.getAttribute('width')).toBe(String(size - 2));
      expect(svg.getAttribute('height')).toBe(String(size - 2));
    }
  });

  it('the padding color is the SAME token that fills the art backdrop (per-address backdrop family)', () => {
    for (const address of ['0xdeadbeef', '0xuser7', '0xroom123']) {
      const expected = `var(--color-art-backdrop-${deriveTraits(address).backdrop + 1})`;
      const { container } = render(PixelAvatar, { props: { address, size: 44 } });
      const frame = frameOf(container);
      expect(frame.getAttribute('style'), address).toContain(expected);
      const backdropGroup = container.querySelector('g[fill]');
      expect(backdropGroup?.getAttribute('fill'), address).toBe(expected);
    }
  });

  it('own persona pads in the accent; the ghost fallback pads in the elevated surface', () => {
    const { container: own } = render(PixelAvatar, { props: { address: '0xme', size: 64, own: true } });
    expect(frameOf(own).getAttribute('style')).toContain('var(--color-accent)');
    expect(own.querySelector('g[fill]')?.getAttribute('fill')).toBe('var(--color-accent)');

    const { container: ghost } = render(PixelAvatar, { props: { address: null, size: 44 } });
    expect(frameOf(ghost).getAttribute('style')).toContain('var(--color-surface-elevated)');
    expect(ghost.querySelector('g[fill]')?.getAttribute('fill')).toBe('var(--color-surface-elevated)');
  });

  it('the ghost fallback keeps its padded outer box unchanged too', () => {
    const { container } = render(PixelAvatar, { props: { address: null, size: 56 } });
    const frame = frameOf(container);
    expect(frame.style.width).toBe('56px');
    const svg = svgOf(container);
    expect(svg.getAttribute('width')).toBe('54');
    expect(svg.getAttribute('height')).toBe('54');
  });
});
