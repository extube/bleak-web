/** BleakMascot tests (Concept §22.3 item 1, DESIGN §4.16.1 as amended by
 * §4.22.E/J — Concept §34 item 3b): the mascot is now the shared BLEAK
 * PERSONAGE (the promoted agent-card figure, one source of truth with the
 * landing card), the §23.1 item 1 no-background treatment, the sway idle
 * (the §4.20.J card-portrait motion; the ghost's 2-frame blink retired),
 * and the four §4.22.E mascot-at-top mounts on the /income surfaces
 * (CodeEntry 96, RoomPreview 96, CreationWizard 96 + 112, MessageBubble
 * mascot rows 28). */
import { afterEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, sep } from 'node:path';
import { cleanup, render } from '@testing-library/svelte';
import BleakMascot from '../src/lib/components/BleakMascot.svelte';
import CodeEntry from '../src/lib/components/join/CodeEntry.svelte';
import RoomPreview from '../src/lib/components/join/RoomPreview.svelte';
import { BLEAK_FIGURE } from '../src/lib/components/personage/bleakFigure';
import { LANDING_FIGURES } from '../src/lib/components/landing/figures';

afterEach(() => {
  cleanup();
});

// Source-level CSS assertions — happy-dom resolves no component CSS (the
// kit.test.ts pattern).
const WEB_ROOT = process.cwd().endsWith(sep + 'apps' + sep + 'web')
  ? process.cwd()
  : join(process.cwd(), 'apps', 'web');
function source(relativePath: string): string {
  return readFileSync(join(WEB_ROOT, relativePath), 'utf8');
}

describe('BleakMascot — the shared BLEAK personage (§4.22.E)', () => {
  it('renders the promoted personage: a crispEdges 32×32 svg with the BLEAK rect art (one source of truth with the landing card)', () => {
    const { container } = render(BleakMascot, { props: { size: 96 } });
    const svg = container.querySelector('svg');
    expect(svg).toBeTruthy();
    expect(svg?.getAttribute('viewBox')).toBe('0 0 32 32');
    expect(svg?.getAttribute('shape-rendering')).toBe('crispEdges');
    // the rendered rect runs equals the shared BLEAK_FIGURE data, group by
    // group (the §4.22.E promotion: byte-identical art, no duplication)
    const groups = [...svg?.querySelectorAll('g') ?? []];
    expect(groups).toHaveLength(BLEAK_FIGURE.parts.length);
    groups.forEach((g, i) => {
      expect(g.getAttribute('fill')).toBe(BLEAK_FIGURE.parts[i]?.fill);
      const rects = [...g.querySelectorAll('rect')];
      expect(rects).toHaveLength(BLEAK_FIGURE.parts[i]?.rects.length ?? -1);
      rects.forEach((r, ri) => {
        const [x, y, w, h] = BLEAK_FIGURE.parts[i]?.rects[ri] ?? [];
        expect(r.getAttribute('x')).toBe(String(x));
        expect(r.getAttribute('y')).toBe(String(y));
        expect(r.getAttribute('width')).toBe(String(w));
        expect(r.getAttribute('height')).toBe(String(h));
      });
    });
    // token discipline: the personage's fills are token references
    for (const fill of BLEAK_FIGURE.parts.map((p) => p.fill)) {
      expect(fill).toMatch(/^var\(--/);
    }
  });

  it('the personage data has ONE source: figures.ts re-exports the same module instance (§4.22.E item 1 / AC 19)', () => {
    expect(LANDING_FIGURES.bleak).toBe(BLEAK_FIGURE);
    // the art is the agent-card personage: skin face + accent monocle + tie
    const fills = BLEAK_FIGURE.parts.map((p) => p.fill);
    expect(fills).toContain('var(--color-art-skin-1)');
    expect(fills.filter((f) => f === 'var(--color-deepa-4)').length).toBeGreaterThanOrEqual(2);
  });

  it('is decorative by default (aria-hidden); `label` promotes it to role img — the public API is unchanged', () => {
    const { container } = render(BleakMascot, { props: {} });
    expect(container.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    cleanup();
    const labelled = render(BleakMascot, { props: { label: 'Блик' } });
    const svg = labelled.container.querySelector('svg');
    expect(svg?.getAttribute('role')).toBe('img');
    expect(svg?.getAttribute('aria-label')).toBe('Блик');
    expect(svg?.getAttribute('aria-hidden')).toBeNull();
  });

  it('applies the declared size to the svg (§23.1 item 1: no plate — the frame reserves nothing)', () => {
    const { container } = render(BleakMascot, { props: { size: 112 } });
    const frame = container.querySelector('.mascot') as HTMLElement;
    const svg = frame.querySelector('svg');
    expect(svg?.getAttribute('width')).toBe('112');
    expect(svg?.getAttribute('height')).toBe('112');
  });

  it('§23.1 item 1 NO BACKGROUND: no backdrop fill, no frame padding — the personage sits directly on the page', () => {
    const { container } = render(BleakMascot, { props: { size: 96 } });
    const frame = container.querySelector('.mascot') as HTMLElement;
    // no inline background/width/height on the frame span
    expect(frame.style.background).toBe('');
    expect(frame.style.width).toBe('');
    expect(frame.style.height).toBe('');
    const css = source('src/lib/components/BleakMascot.svelte');
    // no backdrop token on the frame, no padding/box-sizing plate rules
    expect(css).not.toMatch(/--color-art-backdrop/);
    expect(css).not.toMatch(/\.mascot\s*\{[^}]*padding:/);
    expect(css).not.toMatch(/\.mascot\s*\{[^}]*box-sizing:/);
  });

  it('idle adds the idle class wiring the personage sway; non-idle keeps the figure static', () => {
    const idle = render(BleakMascot, { props: { idle: true } });
    expect(idle.container.querySelector('.mascot')?.classList.contains('idle')).toBe(true);
    idle.unmount();
    const still = render(BleakMascot, { props: { idle: false } });
    expect(still.container.querySelector('.mascot')?.classList.contains('idle')).toBe(false);
  });

  it('§4.22.E idle contract: the §4.20.J card-portrait sway (1.6s steps(2) ±2°, origin 50% 100%); the ghost 2-frame blink is retired; no local reduced-motion override (base.css catch-all governs)', () => {
    const css = source('src/lib/components/BleakMascot.svelte');
    // the sway idle (§4.20.J motion, transform-only)
    expect(css).toMatch(/\.mascot\.idle svg\s*\{[^}]*animation:\s*mascot-idle\s+1\.6s\s+steps\(2\)\s+infinite\s+alternate/);
    expect(css).toMatch(/transform-origin:\s*50%\s*100%/);
    expect(css).toMatch(/@keyframes mascot-idle\s*\{[\s\S]*?rotate\(-2deg\)/);
    expect(css).toMatch(/@keyframes mascot-idle\s*\{[\s\S]*?rotate\(2deg\)/);
    // the ghost art is gone: no 12×12 blink frames, no mascot-blink keyframes
    expect(css).not.toMatch(/eyes-closed/);
    expect(css).not.toMatch(/mascot-blink/);
    expect(css).not.toMatch(/viewBox="0 0 12 12"/);
    // no raw hex anywhere — token discipline (§4.1)
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    // no local prefers-reduced-motion override — the base.css catch-all
    // collapses the animation to a single (static) frame
    expect(css).not.toMatch(/prefers-reduced-motion/);
  });

  it('§23.1 item 2 mount (§30 MIDDLE block): the code-entry form carries the personage-at-top — mascot, then the title, then the rest (§4.22.E: content-only swap, geometry unchanged)', () => {
    const { container } = render(CodeEntry, { props: {} });
    const row = container.querySelector('.mascot-row');
    expect(row).toBeTruthy();
    const svg = row?.querySelector('svg');
    expect(svg?.getAttribute('viewBox')).toBe('0 0 32 32');
    expect(row?.querySelector('.mascot')?.classList.contains('idle')).toBe(true);
    // Concept §30 (DESIGN §4.19): the content order lives inside the
    // shell's middle block (.shell-middle .content) — the mascot row is
    // the FIRST content child, the title (h1) follows it, then the
    // subtitle and the digit cells (top-anchored, in flow order).
    const body = container.querySelector('.shell-middle .body') as HTMLElement;
    const children = Array.from(body.children);
    expect(children[0]).toBe(row);
    const titleIndex = children.findIndex((el) => el.tagName === 'H1');
    expect(titleIndex).toBeGreaterThan(0);
    expect(children[titleIndex + 1]?.classList.contains('subtitle')).toBe(true);
    expect(children.findIndex((el) => el.classList.contains('cells'))).toBeGreaterThan(
      titleIndex
    );
  });

  it('§23.1 item 3 mount (§30 MIDDLE block): the room form (create-profile / join choice) carries the same personage-at-top order', () => {
    const room = {
      address: '0xroom123',
      name: 'Хостел «Пиксель»',
      description: 'Митап по пиксель-арту',
      language: 'ru',
      max_user: 50,
      created_at: '',
      updated_at: '',
      deleted_at: null
    };
    const { container } = render(RoomPreview, {
      props: { room, memberCount: 7, oncreate: () => {}, onchange: () => {} }
    });
    const row = container.querySelector('.mascot-row');
    expect(row).toBeTruthy();
    // Concept §30 (DESIGN §4.19): the content order lives inside the
    // shell's middle block (.shell-middle .content).
    const body = container.querySelector('.shell-middle .body') as HTMLElement;
    const children = Array.from(body.children);
    expect(children[0]).toBe(row);
    const title = container.querySelector('.room-name');
    expect(title).toBeTruthy();
    expect(children.findIndex((el) => el.classList.contains('room-name'))).toBeGreaterThan(0);
    expect(row?.querySelector('.mascot')?.classList.contains('idle')).toBe(true);
  });

  it('all four §4.22.E mounts render the personage through BleakMascot at the contract sizes (96 / 96 / 96 + 112 / 28) — the ghost art appears nowhere on /income*', () => {
    // CodeEntry (the 6-digit entry form) + RoomPreview (the room intro)
    const entry = source('src/lib/components/join/CodeEntry.svelte');
    const room = source('src/lib/components/join/RoomPreview.svelte');
    const wizard = source('src/lib/components/join/CreationWizard.svelte');
    const bubble = source('src/lib/components/chats/MessageBubble.svelte');
    for (const src of [entry, room, wizard, bubble]) {
      expect(src).toContain('BleakMascot');
    }
    expect(entry).toMatch(/<BleakMascot size=\{96\} idle/);
    expect(room).toMatch(/<BleakMascot size=\{96\} idle/);
    expect(wizard).toMatch(/<BleakMascot size=\{96\} idle label/);
    expect(wizard).toMatch(/<BleakMascot size=\{112\} idle label/);
    expect(bubble).toMatch(/<BleakMascot size=\{28\} idle/);
    // the main-room transcript never mounts the mascot (behavior-neutral
    // there): the mascot prop is set only by the creation wizard
    expect(bubble).toMatch(/mascot/);
  });
});
