/**
 * AA contrast check for the chat color coding (v2.3 amendment —
 * Concept §9.1.5, DESIGN §4.10.5: the owner-provided Deepa palette
 * replaces the §7.1.2 four-hue set for chat roles; full-opacity
 * backgrounds, no more 18% tints).
 *
 * The tokens.css file is parsed directly so the check follows the palette
 * source of truth: each `--color-deepa-<n>` must match the documented
 * owner palette and keep its paired ink token (`--color-deepa-ink-<n>`,
 * a var() over --color-surface / --color-text) at ≥4.5:1 on the hue.
 * The muted own-bubble pairing (--color-surface-elevated +
 * --color-text, tz4-06 / Concept §8.1.7) stays. Avatar-art tokens are
 * decorative (no text on them) and are pinned to their Deepa-derived
 * form plus the darker-than-art backdrop pairing (Concept §9.1.6).
 */
import { readFileSync } from 'node:fs';
import { join, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

const WEB_ROOT = process.cwd().endsWith(`${sep}apps${sep}web`)
  ? process.cwd()
  : join(process.cwd(), 'apps', 'web'); // apps/web/ (cwd-safe under happy-dom)
const CSS = readFileSync(join(WEB_ROOT, 'src/lib/styles/tokens.css'), 'utf8');

/** DESIGN §4.10.5 — the documented Deepa hue values (owner palette). */
const DEEPA_HUE_HEX: Record<string, string> = {
  '1': '#00b57f',
  '2': '#e8e000',
  '3': '#ff5000',
  '4': '#9b0cff',
  '5': '#0decff'
};

/** DESIGN §4.10.5 — dark ink on green/yellow/orange/cyan, light ink on violet. */
const INK_SOURCE: Record<string, string> = {
  '1': 'color-surface',
  '2': 'color-surface',
  '3': 'color-surface',
  '4': 'color-text',
  '5': 'color-surface'
};

function tokenHex(name: string): string {
  const match = CSS.match(new RegExp(`--${name}:\\s*#([0-9a-fA-F]{6})\\b`));
  if (!match?.[1]) throw new Error(`token --${name} (hex) not found in tokens.css`);
  return `#${match[1].toLowerCase()}`;
}

/** Parse a `--color-deepa-ink-<n>` declaration: `var(--color-…)` reference. */
function inkSource(n: string): string {
  const match = CSS.match(
    new RegExp(`--color-deepa-ink-${n}:\\s*var\\(--(color-[a-z-]+)\\)`)
  );
  if (!match?.[1]) {
    throw new Error(`--color-deepa-ink-${n} is not a var() over a color token`);
  }
  return match[1];
}

/** Parse any token declaration value (hex or var()/color-mix expression). */
function tokenValue(name: string): string {
  const match = CSS.match(new RegExp(`--${name}:\\s*([^;]+);`));
  if (!match?.[1]) throw new Error(`token --${name} not found in tokens.css`);
  return match[1].trim();
}

function parse(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16)
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
  const l1 = luminance(parse(fg));
  const l2 = luminance(parse(bg));
  const [hi, lo] = l1 >= l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

describe('tokens: §4.10.5 Deepa hues', () => {
  it('the five Deepa hues match the documented owner palette values', () => {
    for (const [n, hex] of Object.entries(DEEPA_HUE_HEX)) {
      expect(tokenHex(`color-deepa-${n}`), n).toBe(hex);
    }
  });

  it('the surface stays charcoal and the text stays near-white (ink sources)', () => {
    expect(tokenHex('color-surface')).toBe('#101213');
    expect(tokenHex('color-text')).toBe('#f0f0f0');
  });
});

describe('AA contrast: ink on every Deepa hue (§4.10.5, ≥4.5:1)', () => {
  it.each(Object.keys(DEEPA_HUE_HEX))('deepa-%s pairs its ink token (dark ink except violet)', (n) => {
    // The ink token resolves over the documented source token (dark
    // surface ink on hues 1/2/3/5, light text ink on violet).
    expect(inkSource(n), `deepa-ink-${n} source`).toBe(INK_SOURCE[n]);
  });

  it.each(Object.keys(DEEPA_HUE_HEX))('deepa-%s background with its ink text measures ≥4.5:1', (n) => {
    const hue = tokenHex(`color-deepa-${n}`);
    const ink = tokenHex(inkSource(n));
    const ratio = contrast(ink, hue);
    // Measured (WCAG helpers above): deepa-1 ≈7.09, deepa-2 ≈13.50,
    // deepa-3 ≈5.73, deepa-4 ≈4.74 (light ink), deepa-5 ≈13.03.
    expect(ratio, `deepa-${n}: ${ink} on ${hue} = ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
  });

  it('the light-ink exception is only violet — every dark-ink hue clears 4.5 with the surface ink', () => {
    // Guards the pairing table against a silent swap (e.g. light ink on
    // orange would fail AA the other way).
    for (const n of ['1', '2', '3', '5']) {
      const hue = tokenHex(`color-deepa-${n}`);
      const lightRatio = contrast(tokenHex('color-text'), hue);
      expect(lightRatio, `deepa-${n} vs light ink`).toBeLessThan(4.5);
    }
  });
});

describe('AA contrast: the muted own-bubble pair (§4.9.7 — mine bubbles are NOT hue-coded)', () => {
  it('--color-surface-elevated stays the neutral muted surface (--color-text on it ≈12.35:1)', () => {
    // Own bubbles stay on the pre-tz3-02 muted neutral (Concept §8.1.7,
    // unchanged by §4.10.5): background --color-surface-elevated, text
    // stays --color-text.
    const elevated = tokenHex('color-surface-elevated');
    expect(elevated).toBe('#292c2d');
    const ratio = contrast('#f0f0f0', elevated);
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });
});

describe('avatar-art tokens: Deepa-derived (Concept §9.1.6, DESIGN §4.10.6)', () => {
  it('skins (4), hairs (5) and backdrops (5) are declared as Deepa derivatives — no raw hex', () => {
    // Skins: color-mix of a Deepa hue over --color-text (light warm register).
    for (let i = 1; i <= 4; i += 1) {
      expect(tokenValue(`color-art-skin-${i}`)).toMatch(
        /color-mix\(in srgb, var\(--color-deepa-[1-5]\) \d+%, var\(--color-text\)\)/
      );
    }
    // Hairs: the five Deepa hues directly.
    for (let i = 1; i <= 5; i += 1) {
      expect(tokenValue(`color-art-hair-${i}`)).toMatch(/^var\(--color-deepa-[1-5]\)$/);
    }
    // Backdrops: DARK derivatives — color-mix of the hue over --color-surface.
    for (let i = 1; i <= 5; i += 1) {
      expect(tokenValue(`color-art-backdrop-${i}`)).toMatch(
        /color-mix\(in srgb, var\(--color-deepa-[1-5]\) \d+%, var\(--color-surface\)\)/
      );
    }
  });

  it('each backdrop is darker than every skin and hair token (darker-than-art pairing)', () => {
    // Resolve the color-mix/var values numerically (sRGB "in srgb"
    // interpolation = per-channel linear mix) and compare WCAG luminance.
    const hueHex: Record<string, string> = {
      'color-deepa-1': tokenHex('color-deepa-1'),
      'color-deepa-2': tokenHex('color-deepa-2'),
      'color-deepa-3': tokenHex('color-deepa-3'),
      'color-deepa-4': tokenHex('color-deepa-4'),
      'color-deepa-5': tokenHex('color-deepa-5')
    };
    hueHex['color-surface'] = tokenHex('color-surface');
    hueHex['color-text'] = tokenHex('color-text');

    function sourceHex(name: string): string {
      const hex = hueHex[name];
      if (!hex) throw new Error(`no hex source for ${name}`);
      return hex;
    }

    function resolve(value: string): [number, number, number] {
      const direct = value.match(/^var\(--(color-[a-z0-9-]+)\)$/);
      const directName = direct?.[1];
      if (directName) return parse(sourceHex(directName));
      const mix = value.match(
        /^color-mix\(in srgb, var\(--(color-[a-z0-9-]+)\) (\d+)%, var\(--(color-[a-z0-9-]+)\)\)$/
      );
      const fromName = mix?.[1];
      const pct = mix?.[2];
      const toName = mix?.[3];
      if (!fromName || !pct || !toName) throw new Error(`unresolved token value: ${value}`);
      const from = parse(sourceHex(fromName));
      const to = parse(sourceHex(toName));
      const t = Number(pct) / 100;
      return [
        Math.round(from[0] * t + to[0] * (1 - t)),
        Math.round(from[1] * t + to[1] * (1 - t)),
        Math.round(from[2] * t + to[2] * (1 - t))
      ];
    }

    const artLuminance = (name: string): number => luminance(resolve(tokenValue(name)));
    const skinAndHairMin = Math.min(
      ...[1, 2, 3, 4].map((i) => artLuminance(`color-art-skin-${i}`)),
      ...[1, 2, 3, 4, 5].map((i) => artLuminance(`color-art-hair-${i}`))
    );
    for (let i = 1; i <= 5; i += 1) {
      const backdrop = artLuminance(`color-art-backdrop-${i}`);
      expect(backdrop, `backdrop-${i} darker than min(skin, hair)`).toBeLessThan(skinAndHairMin);
    }
  });
});
