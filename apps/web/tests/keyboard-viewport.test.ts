/** Keyboard viewport fix tests (Concept §44.4 owner addition, 2026-11-23;
 * DESIGN §4.31.1 + the §4.31.2 iOS correction, 2026-11-23 bug round): the
 * mobile keyboard viewport fix for /income/[income_code]/create (esp.
 * Safari/iOS) — the page is NOT pushed upward off-screen when the
 * on-screen keyboard opens; the creation wrapper binds to DYNAMIC
 * viewport units (the `100vh` fallback + `100dvh` pair) and consumes the
 * visualViewport-driven `--app-height` px, a CREATION-SCOPED
 * `window.visualViewport` resize listener (wired in JoinFlow's mount
 * effect — SSR-safe, listener removed on destroy) keeps the variable
 * current, the DOCUMENT scroll is locked (body AND documentElement — the
 * body-only lock does not stop iOS keyboard panning) while the creation
 * chat is mounted, the window is pinned during the pan (a viewport
 * scroll listener → window.scrollTo(0, 0)), the `.app-shell` gates carry
 * `min-height: 0` (the layout's 100dvh min-height would pin the shell
 * un-shrunk — iOS does not resize the layout viewport), and at the
 * keyboard-shrunk height BOTH fixed areas — the messages area and the
 * input — remain inside the container (the §24–§29 two-fixed-areas
 * contract, now bound to the dynamic visualViewport height). /chats is
 * behavior-neutral (negative-tested). @testing-library/svelte over
 * happy-dom. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, sep } from 'node:path';
import { cleanup, render, screen } from '@testing-library/svelte';
import { tick } from 'svelte';
import { type Room } from '@bleak/api-client';

vi.mock('$app/navigation', () => ({ goto: vi.fn() }));
vi.mock('$app/paths', () => ({
  resolve: (route: string, params?: { income_code?: string }) =>
    params?.income_code ? route.replace('[income_code]', params.income_code) : route
}));

vi.mock('#lib/api/invite-resolve', () => {
  class InviteResolveError extends Error {
    readonly kind: 'malformed' | 'not_found';
    constructor(kind: 'malformed' | 'not_found') {
      super(kind);
      this.name = 'InviteResolveError';
      this.kind = kind;
    }
  }
  return { InviteResolveError, resolveInviteCode: vi.fn() };
});

vi.mock('#lib/crypto/secrets', () => ({ generateTokenSecret: vi.fn(() => 'generated-raw-token') }));

vi.mock('#lib/api/client', () => ({
  api: {
    getRoom: vi.fn(),
    listRoomUsers: vi.fn(),
    getRoomUser: vi.fn(),
    createRoomUser: vi.fn(),
    addUserInterests: vi.fn()
  }
}));

import JoinFlow from '../src/lib/components/join/JoinFlow.svelte';
import { ru } from '../src/lib/i18n/ru';

const room: Room = {
  address: '0xroom123',
  name: 'Хостел «Пиксель»',
  description: 'Митап по пиксель-арту',
  language: 'ru',
  max_user: 50,
  created_at: '',
  updated_at: '',
  deleted_at: null
};

/** The create-route seed (the flow opens directly IN the persona step). */
const SEEDED = { incomeCodeParam: room.address, deepLinkCode: '123456' };

const WEB_ROOT = process.cwd().endsWith(sep + 'apps' + sep + 'web')
  ? process.cwd()
  : join(process.cwd(), 'apps', 'web');
function source(relativePath: string): string {
  return readFileSync(join(WEB_ROOT, relativePath), 'utf8');
}

/** Recursively list the repo's src files (relative, forward slashes). */
function srcFiles(): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(svelte|ts)$/.test(entry.name)) out.push(full);
    }
  };
  walk(join(WEB_ROOT, 'src'));
  return out;
}

/** The `height:` declarations inside a CSS rule's text, in order. */
function heightDeclarations(rule: string): string[] {
  return [...rule.matchAll(/(?<![-\w])height:\s*([^;]+);/g)].map(
    (m) => m[1]?.trim() ?? ''
  );
}

/** Strip JS line + block comments (comment mentions are not code). */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/[^\n]*$/gm, '');
}

describe('Keyboard viewport (Concept §44.4, DESIGN §4.31.1) — the dynamic viewport declarations', () => {
  it('dvh + 100vh-fallback declarations on the wrapper: every §24–§30 height gate carries `height: 100vh` then `height: 100dvh` then the `var(--app-height, 100dvh)` consumption (fallback-then-dvh, then the dynamic px)', () => {
    const css = source('src/lib/components/join/JoinFlow.svelte');
    const gates = [
      // The main block (the persona gate, Concept §27–§29).
      /:global\(\.app-shell > \.join:has\(> \.persona-step\)\)\s*\{[^}]*\}/,
      // The root page wrapper lock (the app-shell, persona-gated).
      /:global\(\.app-shell:has\(> \.join > \.persona-step\)\)\s*\{[^}]*\}/,
      // The §30 form-shell gate (the enter/room-intro/intro forms).
      /:global\(\.app-shell > \.join:has\(> \.form-step\)\)\s*\{[^}]*\}/,
      /:global\(\.app-shell:has\(> \.join > \.form-step\)\)\s*\{[^}]*\}/
    ];
    expect(gates.length).toBe(4);
    for (const pattern of gates) {
      const rule = css.match(pattern)?.[0];
      expect(rule, String(pattern)).toBeTruthy();
      const heights = heightDeclarations(rule ?? '');
      expect(heights.length, String(pattern)).toBeGreaterThanOrEqual(3);
      // BOTH fixed declarations asserted, in the fallback-then-dvh order…
      expect(heights[0], String(pattern)).toBe('100vh');
      expect(heights[1], String(pattern)).toBe('100dvh');
      // …and the dynamic visualViewport px lands AFTER them (the
      // later-supported declaration wins; unset var → the dvh fallback).
      expect(heights[2], String(pattern)).toBe('var(--app-height, 100dvh)');
    }
  });

  it('SSR-safe: no window access at module init — the visualViewport wiring lives INSIDE the mount effect behind the undefined guards', () => {
    // Comments stripped: comment MENTIONS of the mechanism are not code.
    const src = stripComments(source('src/lib/components/join/JoinFlow.svelte'));
    // The guard line (no window/document access when both are absent).
    expect(src).toMatch(
      /if \(typeof window === 'undefined' \|\| typeof document === 'undefined'\) return;/
    );
    // The wiring is inside an $effect body: the guard's effect opens
    // BEFORE any visualViewport touch, and the teardown returns the
    // listener removal (no module-init access anywhere).
    const guardAt = src.indexOf("typeof window === 'undefined'");
    const viewportAt = src.indexOf('visualViewport');
    expect(guardAt).toBeGreaterThan(-1);
    expect(viewportAt).toBeGreaterThan(guardAt);
    // The effect that carries the wiring is the persona-scoped one.
    const effectAt = src.indexOf("$effect(() => {\n    if (flow.step !== 'persona') return;");
    expect(effectAt).toBeGreaterThan(-1);
    expect(viewportAt).toBeGreaterThan(effectAt);
    // The listeners are REMOVED on teardown (no leaks — both types).
    expect(src).toMatch(/removeEventListener\('resize', applyAppHeight\)/);
    expect(src).toMatch(/removeEventListener\('scroll', pinWindow\)/);
    // The documentElement overflow is LOCKED and restored (iOS panning).
    expect(src).toMatch(/root\.style\.overflow = 'hidden'/);
    expect(src).toMatch(/root\.style\.overflow = prevRootOverflow/);
  });

  it('min-height: 0 on BOTH .app-shell gates (§44.4.2 iOS correction): the layout pins .app-shell { min-height: 100dvh } and height = max(min-height, height) — iOS does not resize the layout viewport on keyboard, so the gates must lift the pin or the keyboard-shrunk --app-height never applies', () => {
    const css = source('src/lib/components/join/JoinFlow.svelte');
    const shellGates = [
      /:global\(\.app-shell:has\(> \.join > \.persona-step\)\)\s*\{[^}]*\}/,
      /:global\(\.app-shell:has\(> \.join > \.form-step\)\)\s*\{[^}]*\}/
    ];
    for (const pattern of shellGates) {
      const rule = css.match(pattern)?.[0];
      expect(rule, String(pattern)).toBeTruthy();
      // min-height: 0 precedes the height trio — the pin is lifted.
      expect(rule, String(pattern)).toMatch(/min-height:\s*0\s*;/);
      const minHeights = [
        ...(rule ?? '').matchAll(/(?<![-\w])min-height:\s*([^;]+);/g)
      ].map((m) => m[1]?.trim() ?? '');
      expect(minHeights[0], String(pattern)).toBe('0');
    }
  });

  it('scope: --app-height and the visualViewport mechanism appear ONLY in the creation wrapper (JoinFlow) — no other surface, /chats included', () => {
    const files = srcFiles();
    const withVar = files.filter((f) =>
      stripComments(readFileSync(f, 'utf8')).includes('--app-height')
    );
    expect(withVar).toEqual([join(WEB_ROOT, 'src/lib/components/join/JoinFlow.svelte')]);
    const withViewport = files.filter((f) =>
      stripComments(readFileSync(f, 'utf8')).includes('visualViewport')
    );
    expect(withViewport).toEqual([join(WEB_ROOT, 'src/lib/components/join/JoinFlow.svelte')]);
    // /chats negatives: no --app-height gating and no body scroll-lock
    // anywhere in the chats route or its components.
    for (const f of files.filter((f) => f.includes(`${sep}chats${sep}`))) {
      const text = readFileSync(f, 'utf8');
      expect(text, f).not.toContain('--app-height');
      expect(text, f).not.toContain('body.style.overflow');
    }
  });
});

describe('Keyboard viewport — the creation-scoped visualViewport listener (behavior)', () => {
  /** Own-property visualViewport stub (restored to the exact prior state).
   * Listeners are tracked PER TYPE (resize + scroll — the §44.4.2 iOS
   * correction adds a scroll-pin listener on the same object). */
  let restoreViewport: (() => void) | null = null;
  function installViewport(initialHeight: number): {
    resizeListeners: Array<() => void>;
    scrollListeners: Array<() => void>;
    setHeight(h: number): void;
  } {
    const resizeListeners: Array<() => void> = [];
    const scrollListeners: Array<() => void> = [];
    const vv = {
      height: initialHeight,
      addEventListener: vi.fn((type: string, cb: () => void) => {
        expect(['resize', 'scroll']).toContain(type);
        (type === 'resize' ? resizeListeners : scrollListeners).push(cb);
      }),
      removeEventListener: vi.fn((type: string, cb: () => void) => {
        expect(['resize', 'scroll']).toContain(type);
        const list = type === 'resize' ? resizeListeners : scrollListeners;
        const at = list.indexOf(cb);
        if (at !== -1) list.splice(at, 1);
      })
    };
    const owner = window as unknown as Record<string, unknown>;
    const prior = Object.getOwnPropertyDescriptor(owner, 'visualViewport');
    Object.defineProperty(owner, 'visualViewport', {
      value: vv,
      configurable: true,
      writable: true
    });
    restoreViewport = () => {
      if (prior) Object.defineProperty(owner, 'visualViewport', prior);
      else delete owner.visualViewport;
      restoreViewport = null;
    };
    return {
      resizeListeners,
      scrollListeners,
      setHeight(h: number): void {
        vv.height = h;
      }
    };
  }

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
    document.documentElement.style.removeProperty('--app-height');
    document.documentElement.style.removeProperty('overflow');
    document.body.style.removeProperty('overflow');
    restoreViewport?.();
  });

  it('the mocked visualViewport height change updates --app-height — the px value lands in the CSS variable (initial + every resize)', async () => {
    const mock = installViewport(800);
    render(JoinFlow, { props: SEEDED });
    await screen.findByText(ru['join.wizard.intro.title']);
    // Initial application: the mount effect wrote the visible px.
    expect(document.documentElement.style.getPropertyValue('--app-height')).toBe('800px');
    // Keyboard opens: the resize listener fires → the var shrinks.
    mock.setHeight(400);
    for (const cb of [...mock.resizeListeners]) cb();
    await tick();
    expect(document.documentElement.style.getPropertyValue('--app-height')).toBe('400px');
    // Keyboard closes: back to the full visible height.
    mock.setHeight(800);
    for (const cb of [...mock.resizeListeners]) cb();
    await tick();
    expect(document.documentElement.style.getPropertyValue('--app-height')).toBe('800px');
  });

  it('document scroll locked while in the creation flow: BOTH the body and the documentElement overflow are hidden (body-only does not stop iOS keyboard panning)', async () => {
    installViewport(800);
    render(JoinFlow, { props: SEEDED });
    await screen.findByText(ru['join.wizard.intro.title']);
    expect(document.body.style.overflow).toBe('hidden');
    // §44.4.2 iOS correction: the documentElement is locked too.
    expect(document.documentElement.style.overflow).toBe('hidden');
  });

  it('the window is pinned during the keyboard pan: a viewport SCROLL listener calls window.scrollTo(0, 0) (the iOS layout viewport does not resize — the pan is pinned instead)', async () => {
    const mock = installViewport(800);
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    try {
      render(JoinFlow, { props: SEEDED });
      await screen.findByText(ru['join.wizard.intro.title']);
      // Exactly one scroll listener (paired with the one resize listener —
      // no duplicates on re-runs of the effect).
      expect(mock.scrollListeners).toHaveLength(1);
      expect(mock.resizeListeners).toHaveLength(1);
      // Firing the scroll event pins the window to the top.
      expect(scrollTo).not.toHaveBeenCalled();
      for (const cb of [...mock.scrollListeners]) cb();
      expect(scrollTo).toHaveBeenCalledWith(0, 0);
    } finally {
      scrollTo.mockRestore();
    }
  });

  it('cleanup on unmount: BOTH listeners are removed (resize + scroll — no leaks), --app-height cleared and the prior document/body overflow restored', async () => {
    const mock = installViewport(800);
    render(JoinFlow, { props: SEEDED });
    await screen.findByText(ru['join.wizard.intro.title']);
    expect(document.body.style.overflow).toBe('hidden');
    expect(document.documentElement.style.overflow).toBe('hidden');
    expect(document.documentElement.style.getPropertyValue('--app-height')).toBe('800px');
    cleanup();
    await tick();
    expect(mock.resizeListeners).toHaveLength(0);
    expect(mock.scrollListeners).toHaveLength(0);
    expect(document.documentElement.style.getPropertyValue('--app-height')).toBe('');
    expect(document.body.style.overflow).toBe('');
    // §44.4.2 iOS correction: the documentElement lock is restored too.
    expect(document.documentElement.style.overflow).toBe('');
  });

  it('a missing visualViewport (or SSR-less call path) is graceful: no throw, no variable, the locks still apply', async () => {
    // No stub installed at all — window.visualViewport stays whatever the
    // environment provides (undefined in happy-dom without one).
    const owner = window as unknown as Record<string, unknown>;
    const prior = Object.getOwnPropertyDescriptor(owner, 'visualViewport');
    delete owner.visualViewport;
    try {
      render(JoinFlow, { props: SEEDED });
      await screen.findByText(ru['join.wizard.intro.title']);
      expect(document.documentElement.style.getPropertyValue('--app-height')).toBe('');
      expect(document.body.style.overflow).toBe('hidden');
      expect(document.documentElement.style.overflow).toBe('hidden');
      cleanup();
      await tick();
      expect(document.body.style.overflow).toBe('');
      expect(document.documentElement.style.overflow).toBe('');
    } finally {
      if (prior) Object.defineProperty(owner, 'visualViewport', prior);
    }
  });

  it('the dynamic behavior is creation-scoped: the NON-persona join steps (the /income entry surfaces) register no listener, set no variable and lock nothing', async () => {
    const mock = installViewport(800);
    render(JoinFlow, { props: {} }); // the code step (unseeded /income mount)
    await screen.findByText(ru['join.enter']);
    expect(mock.resizeListeners).toHaveLength(0);
    expect(mock.scrollListeners).toHaveLength(0);
    expect(document.documentElement.style.getPropertyValue('--app-height')).toBe('');
    expect(document.body.style.overflow).toBe('');
    expect(document.documentElement.style.overflow).toBe('');
    cleanup();
    await tick();
  });
});

describe('Keyboard viewport — geometry at the keyboard-shrunk height (§4.31.1)', () => {
  /**
   * The REAL-GEOMETRY cascade pattern (the documented happy-dom caveat:
   * no layout engine, no auto-injected component CSS — the components'
   * REAL <style> blocks are read from source and injected; the computed
   * cascade of the REAL rendered chain round-tripped through the HTML
   * parser — the documented :has() quirk workaround — is asserted).
   * happy-dom resolves `var(--app-height, …)` on height, so the
   * keyboard-shrunk bound itself is checkable here; the real-browser
   * manual smoke stays the documented device check.
   */
  function styleBlock(relativePath: string): string {
    const match = source(relativePath).match(/<style[^>]*>([\s\S]*)<\/style>/);
    expect(match, `<style> block not found in ${relativePath}`).toBeTruthy();
    return match?.[1] ?? '';
  }
  /** Svelte's :global(X) → X (raw injection needs unscoped selectors). */
  function unscope(css: string): string {
    let out = '';
    let i = 0;
    for (;;) {
      const at = css.indexOf(':global(', i);
      if (at === -1) return out + css.slice(i);
      out += css.slice(i, at);
      let depth = 1;
      let j = at + ':global('.length;
      while (j < css.length && depth > 0) {
        if (css[j] === '(') depth += 1;
        else if (css[j] === ')') depth -= 1;
        j += 1;
      }
      out += css.slice(at + ':global('.length, j - 1);
      i = j;
    }
  }

  const injected: HTMLStyleElement[] = [];
  const parsedFixtures: HTMLElement[] = [];

  function injectCascadeFixtureCss(): void {
    for (const file of [
      'src/routes/+layout.svelte',
      'src/routes/income/+page.svelte',
      'src/lib/components/join/JoinFlow.svelte',
      'src/lib/components/join/CreationWizard.svelte'
    ]) {
      const style = document.createElement('style');
      style.setAttribute('data-cascade-contract-4311', file);
      style.textContent = unscope(styleBlock(file));
      document.head.appendChild(style);
      injected.push(style);
    }
  }

  afterEach(() => {
    for (const style of injected) style.remove();
    injected.length = 0;
    for (const fixture of parsedFixtures) fixture.remove();
    parsedFixtures.length = 0;
    document.documentElement.style.removeProperty('--app-height');
  });

  it('at the keyboard-shrunk height BOTH the messages area and the input remain inside the container: the wrapper AND the shell shrink to the --app-height px, the messenger is the flex:1 scroll-port and the input the flex:none region — both in flow inside the shrunk bound', async () => {
    injectCascadeFixtureCss();
    // The real rendered ancestor chain on /income/[income_code]/create
    // (routes/+layout.svelte → the create route page → JoinFlow).
    const shell = document.createElement('div');
    shell.className = 'app-shell';
    const wrapper = document.createElement('div');
    wrapper.className = 'join';
    shell.appendChild(wrapper);
    document.body.appendChild(shell);
    render(JoinFlow, { props: SEEDED, target: wrapper });
    await screen.findByText(ru['join.wizard.intro.title']);
    // Drive into the interview: the log + composer two-region chat.
    await screen.getByRole('button', { name: ru['join.wizard.intro.start'] }).click();
    await screen.findByText(ru['join.wizard.name.question']);
    const html = shell.outerHTML;
    cleanup();
    shell.remove();
    await tick();

    // Keyboard open (the owner's bug): the visible viewport shrinks to
    // 400px. The listener (tested above) writes --app-height; here the
    // variable is preset to the same value the listener writes.
    document.documentElement.style.setProperty('--app-height', '400px');

    const fixture = document.createElement('div');
    fixture.innerHTML = html;
    document.body.appendChild(fixture);
    parsedFixtures.push(fixture);
    const pShell = fixture.children[0] as HTMLElement;
    const pWrap = pShell.children[0] as HTMLElement;
    const pLog = pShell.querySelector('div.log') as HTMLElement;
    const pComposer = pShell.querySelector('.composer') as HTMLElement;
    expect(pWrap.matches('.app-shell > .join:has(> .persona-step)')).toBe(true);

    // The wrapper (the main block) AND the root page wrapper shrink to
    // the remaining VISIBLE viewport — 400px, not the 768px dvh default.
    expect(getComputedStyle(pWrap).height).toBe('400px');
    expect(getComputedStyle(pShell).height).toBe('400px');

    // BOTH fixed areas remain inside the shrunk container, in flow:
    // the messenger first (the flex:1 scroll-port absorbing the
    // remainder), the input block last (flex:none — keeps its content
    // height, pinned at the container's bottom edge).
    const pStage = pLog.parentElement as HTMLElement;
    expect([...pStage.children]).toEqual([pLog, pComposer]);
    expect(pLog.contains(pComposer)).toBe(false);
    expect(getComputedStyle(pLog).flexGrow).toBe('1');
    expect(['0', '0px']).toContain(getComputedStyle(pLog).minHeight);
    expect(getComputedStyle(pLog).overflowY).toBe('auto');
    expect(getComputedStyle(pComposer).flexGrow).toBe('0');
    expect(getComputedStyle(pComposer).flexShrink).toBe('0');

    // Dynamic: the var drives the height — a deeper keyboard shrinks the
    // bound further, closing the keyboard restores the dvh fallback.
    document.documentElement.style.setProperty('--app-height', '300px');
    expect(getComputedStyle(pWrap).height).toBe('300px');
    expect(getComputedStyle(pShell).height).toBe('300px');
    document.documentElement.style.removeProperty('--app-height');
    expect(getComputedStyle(pWrap).height).not.toBe('400px');
    expect(getComputedStyle(pShell).height).not.toBe('400px');
  });
});
