/** BleakMascot tests (Concept §22.3 item 1, DESIGN §4.16.1 + §23 amendments):
 * render + idle-animation contract, the §23.1 item 1 no-background
 * treatment, and the mascot-at-top mounts (§23.1 items 2–3) on the
 * enter-invite-code form and the room form (create-profile / join choice). */
import { afterEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, sep } from 'node:path';
import { cleanup, render } from '@testing-library/svelte';
import BleakMascot from '../src/lib/components/BleakMascot.svelte';
import CodeEntry from '../src/lib/components/join/CodeEntry.svelte';
import RoomPreview from '../src/lib/components/join/RoomPreview.svelte';

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

describe('BleakMascot', () => {
  it('renders a crispEdges 12×12 svg with rect pixel art', () => {
    const { container } = render(BleakMascot, { props: { size: 96 } });
    const svg = container.querySelector('svg');
    expect(svg).toBeTruthy();
    expect(svg?.getAttribute('viewBox')).toBe('0 0 12 12');
    expect(svg?.getAttribute('shape-rendering')).toBe('crispEdges');
    expect(svg?.querySelectorAll('rect').length).toBeGreaterThan(0);
    for (const rect of svg?.querySelectorAll('rect') ?? []) {
      const x = Number(rect.getAttribute('x'));
      const y = Number(rect.getAttribute('y'));
      const w = Number(rect.getAttribute('width'));
      const h = Number(rect.getAttribute('height'));
      expect(x).toBeGreaterThanOrEqual(0);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(x + w).toBeLessThanOrEqual(12);
      expect(y + h).toBeLessThanOrEqual(12);
    }
  });

  it('is decorative by default (aria-hidden); `label` promotes it to role img', () => {
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

  it('§23.1 item 1 NO BACKGROUND: no backdrop fill, no frame padding — the figure sits directly on the page', () => {
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
    // the ghost body keeps its muted fill (the outline carries itself)
    expect(css).toMatch(/<g fill="var\(--color-text-muted\)">/);
  });

  it('idle adds the idle class wiring the 2-frame blink; non-idle keeps the closed frame hidden', () => {
    const idle = render(BleakMascot, { props: { idle: true } });
    expect(idle.container.querySelector('.mascot')?.classList.contains('idle')).toBe(true);
    idle.unmount();
    const still = render(BleakMascot, { props: { idle: false } });
    expect(still.container.querySelector('.mascot')?.classList.contains('idle')).toBe(false);
  });

  it('§4.16.1 CSS contract: 2-frame steps(1) blink, token fills only, no local reduced-motion override (base.css catch-all governs)', () => {
    const css = source('src/lib/components/BleakMascot.svelte');
    // the closed-eye frame is off by default and toggled only under `idle`
    expect(css).toMatch(/\.eyes-closed\s*\{[^}]*opacity:\s*0/);
    expect(css).toMatch(/\.idle \.eyes-closed\s*\{[^}]*animation:\s*mascot-blink\s+4\.2s\s+steps\(1\)\s+infinite/);
    // two hard keyframe states — open (0) / closed (1)
    expect(css).toMatch(/@keyframes mascot-blink\s*\{[\s\S]*?opacity:\s*0/);
    expect(css).toMatch(/@keyframes mascot-blink\s*\{[\s\S]*?opacity:\s*1/);
    // no raw hex anywhere — token discipline (§4.1)
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    // no local prefers-reduced-motion override — the base.css catch-all
    // collapses the animation to a single (open-eye) frame
    expect(css).not.toMatch(/prefers-reduced-motion/);
  });

  it('§23.1 item 2 mount (now the §30 MIDDLE block): the code-entry form carries mascot-at-top — mascot, then the title, then the rest', () => {
    const { container } = render(CodeEntry, { props: {} });
    const row = container.querySelector('.mascot-row');
    expect(row).toBeTruthy();
    const svg = row?.querySelector('svg');
    expect(svg?.getAttribute('viewBox')).toBe('0 0 12 12');
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

  it('§23.1 item 3 mount (now the §30 MIDDLE block): the room form (create-profile / join choice) carries the same mascot-at-top order', () => {
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
});
