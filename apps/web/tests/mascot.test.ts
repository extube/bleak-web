/** BleakMascot tests (Concept §22.3 item 1, DESIGN §4.16.1): render +
 * idle-animation contract for the chunky pixel-art mascot, and its mount
 * on the enter-invite-code form. @testing-library/svelte over happy-dom. */
import { afterEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, sep } from 'node:path';
import { cleanup, render } from '@testing-library/svelte';
import BleakMascot from '../src/lib/components/BleakMascot.svelte';
import CodeEntry from '../src/lib/components/join/CodeEntry.svelte';

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

  it('applies the declared size to the frame and the svg (border-box + 1px padding)', () => {
    const { container } = render(BleakMascot, { props: { size: 112 } });
    const frame = container.querySelector('.mascot') as HTMLElement;
    expect(frame.style.width).toBe('112px');
    expect(frame.style.height).toBe('112px');
    const svg = frame.querySelector('svg');
    expect(svg?.getAttribute('width')).toBe('110');
    expect(svg?.getAttribute('height')).toBe('110');
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

  it('§4.16.1 mount: the code-entry form hosts the idle mascot above the digit cells', () => {
    const { container } = render(CodeEntry, { props: {} });
    const row = container.querySelector('.mascot-row');
    expect(row).toBeTruthy();
    const svg = row?.querySelector('svg');
    expect(svg?.getAttribute('viewBox')).toBe('0 0 12 12');
    expect(row?.querySelector('.mascot')?.classList.contains('idle')).toBe(true);
    // placement: between the subtitle and the digit cells
    const step = container.querySelector('.step') as HTMLElement;
    const children = Array.from(step.children);
    expect(children.indexOf(row as HTMLElement)).toBe(
      children.findIndex((el) => el.classList.contains('subtitle')) + 1
    );
    expect(children.findIndex((el) => el.classList.contains('cells'))).toBeGreaterThan(
      children.indexOf(row as HTMLElement)
    );
  });
});
