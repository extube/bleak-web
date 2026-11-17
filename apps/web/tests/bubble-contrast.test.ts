/**
 * AA contrast check for the §4.8.1 chat-bubble color coding (new AA
 * requirement — growth reason: Concept §7.1.2 adds four functional bubble
 * tints; owner acceptance demands AA-readable text on every tint).
 *
 * The tokens.css file is parsed directly so the check follows the palette
 * source of truth: each `--color-bubble-<hue>` must stay the documented
 * `color-mix(in srgb, <hue> 18%, var(--color-surface))` and keep
 * `--color-text` (#f0f0f0) at ≥4.5:1 on the mixed background. Avatar-art
 * tokens are decorative (no text on them) and are only pinned to exist.
 */
import { readFileSync } from 'node:fs';
import { join, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

const WEB_ROOT = process.cwd().endsWith(`${sep}apps${sep}web`)
  ? process.cwd()
  : join(process.cwd(), 'apps', 'web'); // apps/web/ (cwd-safe under happy-dom)
const CSS = readFileSync(join(WEB_ROOT, 'src/lib/styles/tokens.css'), 'utf8');

/** DESIGN §4.8.1 — the documented hue values (owner-approved palette). */
const CODE_HUE_HEX: Record<string, string> = {
  yellow: '#fedc5c',
  orange: '#ffa24a',
  blue: '#63a8ff',
  violet: '#b58cff'
};

function tokenHex(name: string): string {
  const match = CSS.match(new RegExp(`--${name}:\\s*#([0-9a-fA-F]{6})\\b`));
  if (!match?.[1]) throw new Error(`token --${name} (hex) not found in tokens.css`);
  return `#${match[1].toLowerCase()}`;
}

/** Parse a `--color-bubble-<hue>` declaration: percent over --color-surface. */
function bubbleMix(hue: string): { hueHex: string; percent: number; surfaceHex: string } {
  const match = CSS.match(
    new RegExp(
      `--color-bubble-${hue}:\\s*color-mix\\(in srgb, var\\(--color-code-${hue}\\)\\s*([\\d.]+)%,\\s*var\\(--color-surface\\)\\)`
    )
  );
  if (!match?.[1]) {
    throw new Error(`--color-bubble-${hue} is not the documented color-mix over the surface`);
  }
  return { hueHex: tokenHex(`color-code-${hue}`), percent: Number(match[1]), surfaceHex: tokenHex('color-surface') };
}

/** gamma-space sRGB interpolation — exactly what `color-mix(in srgb, …)` does */
function mix(a: string, b: string, percent: number): [number, number, number] {
  const t = percent / 100;
  const parse = (hex: string): [number, number, number] => [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16)
  ];
  const ca = parse(a);
  const cb = parse(b);
  return ca.map((channel, i) => Math.round(t * channel + (1 - t) * (cb[i] ?? 0))) as [
    number,
    number,
    number
  ];
}

/** WCAG 2.1 relative luminance */
function luminance([r, g, b]: [number, number, number]): number {
  const lin = (value: number): number => {
    const s = value / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrast(fg: string, bg: string): number {
  const l1 = luminance(mix(fg, fg, 100));
  const l2 = luminance(mix(bg, bg, 100));
  const [hi, lo] = l1 >= l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

describe('tokens: §4.8.1 code hues + bubble tints', () => {
  it('the four code hues match the documented palette values', () => {
    for (const [hue, hex] of Object.entries(CODE_HUE_HEX)) {
      expect(tokenHex(`color-code-${hue}`), hue).toBe(hex);
    }
  });

  it('every bubble tint is the documented 18% color-mix over --color-surface', () => {
    for (const hue of Object.keys(CODE_HUE_HEX)) {
      expect(bubbleMix(hue).percent, hue).toBe(18);
      expect(bubbleMix(hue).surfaceHex, hue).toBe(tokenHex('color-surface'));
    }
  });

  it('bubble text stays --color-text (#f0f0f0) and the surface stays charcoal', () => {
    expect(tokenHex('color-text')).toBe('#f0f0f0');
    expect(tokenHex('color-surface')).toBe('#101213');
  });
});

describe('AA contrast: --color-text on every bubble tint (§4.8.1, ≥4.5:1)', () => {
  it.each(Object.keys(CODE_HUE_HEX))('%s tint', (hue) => {
    const { hueHex, percent, surfaceHex } = bubbleMix(hue);
    const tint = mix(hueHex, surfaceHex, percent);
    const ratio = contrast('#f0f0f0', `#${tint.map((c) => c.toString(16).padStart(2, '0')).join('')}`);
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });
});

describe('avatar-art tokens exist (decorative — no AA requirement, §4.8.1)', () => {
  it('skins (4), hairs (5) and backdrops (5) are declared in tokens.css', () => {
    for (let i = 1; i <= 4; i += 1) expect(tokenHex(`color-art-skin-${i}`)).toMatch(/^#[0-9a-f]{6}$/);
    for (let i = 1; i <= 5; i += 1) expect(tokenHex(`color-art-hair-${i}`)).toMatch(/^#[0-9a-f]{6}$/);
    for (let i = 1; i <= 5; i += 1) expect(tokenHex(`color-art-backdrop-${i}`)).toMatch(/^#[0-9a-f]{6}$/);
  });
});
