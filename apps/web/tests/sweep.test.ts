/**
 * TZ-10 sweep automation — cross-cutting rules pinned as CI-enforceable tests.
 *
 * Sources: docs/TZ.md §2 TZ-10 (item 2), docs/ARCHITECTURE.md §1/§5/§8,
 * docs/DESIGN.md §2.2/§2.4/§3.5 AC 13/§3.6 AC 13, Concept §1c ruling 4.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

const WEB_ROOT = process.cwd().endsWith(`${sep}apps${sep}web`)
  ? process.cwd()
  : join(process.cwd(), 'apps', 'web'); // apps/web/ (cwd-safe under happy-dom)
const SRC_ROOT = join(WEB_ROOT, 'src');

/** Collect every source file under a root (no node_modules, no build). */
function collectFiles(root: string, exts: string[]): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      const st = statSync(full);
      if (st.isDirectory()) walk(full);
      else if (exts.some((e) => entry.endsWith(e))) out.push(full);
    }
  };
  walk(root);
  return out;
}

const SVELTE_FILES = collectFiles(SRC_ROOT, ['.svelte']);
const TS_FILES = collectFiles(SRC_ROOT, ['.ts']);
const ALL_SOURCE = [...SVELTE_FILES, ...TS_FILES];

const rel = (file: string): string => relative(WEB_ROOT, file).split(sep).join('/');
const ROUTE_FILES = ALL_SOURCE.filter((f) => f.includes(`${sep}routes${sep}`));

describe('sweep: polling etiquette (DESIGN §2.2, ARCHITECTURE §5)', () => {
  it('new Poller appears ONLY in route files — never in lib/components or lib modules', () => {
    const offenders = ALL_SOURCE
      .filter((f) => /new\s+Poller\b/.test(readFileSync(f, 'utf8')))
      .filter((f) => !ROUTE_FILES.includes(f))
      .map(rel);
    expect(offenders, `new Poller outside route files: ${offenders.join(', ')}`).toEqual([]);
    // The rule is not vacuous: the six polling pages really do instantiate it.
    const pollingRoutes = ROUTE_FILES
      .filter((f) => /new\s+Poller\b/.test(readFileSync(f, 'utf8')))
      .map(rel)
      .sort();
    expect(pollingRoutes).toEqual([
      'src/routes/chats/+page.svelte',
      'src/routes/chats/[address]/+page.svelte',
      'src/routes/contacts/+page.svelte',
      'src/routes/host/+page.svelte',
      'src/routes/people/+page.svelte',
      'src/routes/profile/+page.svelte',
      'src/routes/room/+page.svelte'
    ]);
  });

  it('the `/` join page uses NO poller (§2.2 cadence table — mount-time fetches only)', () => {
    const file = 'src/routes/+page.svelte';
    const source = readFileSync(join(WEB_ROOT, file), 'utf8');
    expect(source, `${file} must not poll`).not.toMatch(/new\s+Poller\b/);
  });

  it('poll cadences match the §2.2 table (4s room/people/chats/contacts/profile, 2s transcript, 5s host)', () => {
    const expected: Record<string, string> = {
      'src/routes/room/+page.svelte': '4000',
      'src/routes/people/+page.svelte': '4000',
      'src/routes/chats/+page.svelte': '4000',
      'src/routes/chats/[address]/+page.svelte': '2000',
      // §4.14.2 row: /contacts polls the recipient-only listContactsSharedWith
      // (+ the roster for name resolution) at 4 s.
      'src/routes/contacts/+page.svelte': '4000',
      'src/routes/host/+page.svelte': '5000',
      // rev. 3 §2.2 row: /profile polls the token-gated getRoomUser at 4 s
      // for the badge live-QR liveness flag (TZ2-07 Part A).
      'src/routes/profile/+page.svelte': '4000'
    };
    for (const [file, ms] of Object.entries(expected)) {
      const source = readFileSync(join(WEB_ROOT, file), 'utf8');
      expect(source, `${file} interval`).toMatch(new RegExp(`intervalMs:\\s*${ms}`));
    }
  });
});

describe('sweep: no-composer invariant (Concept §1c ruling 4 — permanent)', () => {
  const COMPOSER_PATTERN = /<input\b|<textarea\b|type="text"|sendMessage\(/;

  it('the transcript route and its components contain no composer markup', () => {
    const files = ALL_SOURCE.filter(
      (f) => f.includes(`${sep}routes${sep}chats${sep}`) || f.includes(`${sep}components${sep}chats${sep}`)
    );
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      expect(rel(file)).not.toMatch(COMPOSER_PATTERN);
      expect(source, `${rel(file)} contains composer markup`).not.toMatch(COMPOSER_PATTERN);
    }
  });

  it('POST /api/message is never wired into any UI source (comments excluded)', () => {
    // Comments naming the rule are allowed; actual call sites are not.
    const offenders = ALL_SOURCE
      .map((f) => ({ f, src: readFileSync(f, 'utf8') }))
      .filter(({ src }) => {
        const withoutComments = src
          .split('\n')
          .filter((line) => !line.trim().startsWith('*') && !line.trim().startsWith('//') && !line.trim().startsWith('<!--'))
          .join('\n');
        return /sendUserChatMessage|sendMessage|['"`]\/api\/message/.test(withoutComments);
      })
      .map(({ f }) => rel(f));
    expect(offenders).toEqual([]);
  });
});

describe('sweep: interests v3 shape adherence (DESIGN §4.13.1 — the §1 mock retired)', () => {
  it('displayInterests renders EXACTLY the {key, title, emoji} chip shape — no extra keys', async () => {
    const { displayInterests } = await import('#lib/stores/interests');
    const rows = [
      { title: 'Кофе', group: 0, key: 1, user_address: '0xme' },
      { title: 'Музыка', group: 1, key: 6, user_address: '0xme' }
    ];
    const chips = displayInterests(rows, 'en');
    expect(chips).toHaveLength(2);
    for (const chip of chips) {
      expect(Object.keys(chip).sort()).toEqual(['emoji', 'key', 'title']);
      expect(typeof chip.key).toBe('number');
      expect(typeof chip.title).toBe('string');
      expect(typeof chip.emoji).toBe('string');
    }
  });

  it('every catalog entry carries group + key + emoji + titleKey (numeric API pair)', async () => {
    const { INTEREST_CATALOG, INTEREST_GROUPS } = await import('#lib/interests/catalog');
    expect(INTEREST_GROUPS.length).toBeGreaterThanOrEqual(4);
    expect(INTEREST_CATALOG.length).toBeGreaterThanOrEqual(8);
    for (const entry of INTEREST_CATALOG) {
      expect(Object.keys(entry).sort()).toEqual(['emoji', 'group', 'key', 'titleKey']);
      expect(typeof entry.group).toBe('number');
      expect(typeof entry.key).toBe('number');
      expect(entry.emoji.length).toBeGreaterThan(0);
      expect(entry.titleKey.startsWith('interests.')).toBe(true);
    }
  });
});

describe('sweep: QR module placement (DESIGN §3.8 AC 14, §3.6 AC 13)', () => {
  it('jsqr is only ever DYNAMICALLY imported (no static from-jsqr import anywhere)', () => {
    const offenders = ALL_SOURCE.filter((f) => /from\s+['"]jsqr['"]/.test(readFileSync(f, 'utf8'))).map(rel);
    expect(offenders, 'static jsqr import found').toEqual([]);
    // And the dynamic import exists exactly once, in the scanner decoder.
    const dynamic = ALL_SOURCE.filter((f) => /import\(\s*['"]jsqr['"]\s*\)/.test(readFileSync(f, 'utf8'))).map(rel);
    expect(dynamic).toEqual(['src/lib/scanner/decode.ts']);
  });

  it('uqr is imported only inside the /profile component tree', () => {
    const offenders = ALL_SOURCE.filter((f) => /from\s+['"]uqr['"]/.test(readFileSync(f, 'utf8')))
      .filter((f) => !f.includes(`${sep}components${sep}profile${sep}`))
      .map(rel);
    expect(offenders, 'uqr imported outside /profile tree').toEqual([]);
  });
});

describe('sweep: token discipline (DESIGN §2.4 — no hardcoded hex in components)', () => {
  /* §4.15.C-1 exception (2026-11-20 owner ruling, arcade sheet): the sheet's
   * palette is OWNER-LOCKED and sheet-scoped — its raw hexes live ONLY in
   * SummarySheet's `.arcade-sheet` scope block. That one block supersedes the
   * blanket ban (the design pins the values verbatim, e.g. #8A12FF); every
   * other file, and every line outside the scope block, still obeys §2.4. */
  const SHEET_SCOPE_FILE = 'src/lib/components/SummarySheet.svelte';
  const withoutScopeBlock = (file: string, src: string): string =>
    rel(file) === SHEET_SCOPE_FILE ? src.replace(/\.arcade-sheet\s*\{[\s\S]*?\}/, '') : src;

  it('no .svelte file contains a raw color literal (sole exception: the owner-locked .arcade-sheet scope block, §4.15.C-1)', () => {
    const offenders = SVELTE_FILES
      .filter(
        (f) =>
          /#[0-9a-fA-F]{3,8}\b/.test(withoutScopeBlock(f, readFileSync(f, 'utf8')))
      )
      .map(rel);
    expect(offenders, `hardcoded hex in: ${offenders.join(', ')}`).toEqual([]);
  });

  it('the exception is not vacuous: the .arcade-sheet block carries the LOCKED hexes verbatim', () => {
    const src = readFileSync(join(WEB_ROOT, SHEET_SCOPE_FILE), 'utf8');
    const scopeBlock = src.match(/\.arcade-sheet\s*\{[\s\S]*?\}/)?.[0] ?? '';
    expect(scopeBlock).toContain('--sheet-bg: #8a12ff');
    expect(scopeBlock).toContain('--sheet-charcoal: #18181b');
    expect(scopeBlock).toContain('--sheet-yellow: #facc15');
    expect(scopeBlock).toContain('--sheet-white: #ffffff');
    expect(scopeBlock).toContain('--sheet-orange: #ff8a00');
  });

  it('the only light-surface exception (--color-qr-frame) is declared in tokens.css', () => {
    const tokens = readFileSync(join(WEB_ROOT, 'src/lib/styles/tokens.css'), 'utf8');
    expect(tokens).toMatch(/--color-qr-frame:\s*#F0F0F0/i);
  });
});
