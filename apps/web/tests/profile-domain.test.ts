/** Profile pure modules (TZ-08, DESIGN §3.6): greeting question-mark
 * validation, persona-QR payload building, and the uqr code-split rule
 * (AC 13 — the encoder is statically imported by the /profile route
 * chunk ONLY; source-scan equivalent of the build-output grep). */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { containsQuestionMark } from '../src/lib/components/profile/greeting';
import { inviteUrlBase, personaQrPayload } from '../src/lib/components/profile/qr';

describe('containsQuestionMark (DESIGN §3.6)', () => {
  it('blocks ASCII ?', () => {
    expect(containsQuestionMark('Кто ты?')).toBe(true);
    expect(containsQuestionMark('???')).toBe(true);
  });

  it('blocks the full-width ？', () => {
    expect(containsQuestionMark('谁是谁？')).toBe(true);
    expect(containsQuestionMark('text ？ text')).toBe(true);
  });

  it('passes question-free greetings', () => {
    expect(containsQuestionMark('')).toBe(false);
    expect(containsQuestionMark('Привет! Я трамвайщик из Питера.')).toBe(false);
    expect(containsQuestionMark('Hello — statements only, no questions.')).toBe(false);
  });

  it('does not confuse other punctuation', () => {
    expect(containsQuestionMark('Хм… интересно ;')).toBe(false);
  });
});

describe('personaQrPayload (DESIGN §3.6/§3.8 binding format)', () => {
  it('encodes {base}/?u={address} with the address escaped', () => {
    expect(personaQrPayload('0xuser1', 'http://localhost:5173/')).toBe(
      'http://localhost:5173/?u=0xuser1'
    );
    expect(personaQrPayload('0xuser1', 'http://localhost:5173')).toBe(
      'http://localhost:5173/?u=0xuser1'
    );
    expect(personaQrPayload('0x u ser', 'https://bleak.example')).toBe(
      'https://bleak.example/?u=0x%20u%20ser'
    );
  });

  it('keeps a path-bearing base intact', () => {
    expect(personaQrPayload('0xuser1', 'https://host.example/app/')).toBe(
      'https://host.example/app/?u=0xuser1'
    );
  });

  it('falls back to the SPA origin in the browser (dev = the helper default base)', () => {
    // happy-dom window origin — the same-origin deployment target the
    // dev proxy serves (INVITE_URL_BASE http://localhost:5173/ in dev).
    expect(personaQrPayload('0xuser1')).toBe(`${window.location.origin}/?u=0xuser1`);
    expect(inviteUrlBase()).toBe(window.location.origin);
  });
});

// --- uqr code-split rule (AC 13) -------------------------------------------
// Source-scan equivalent of the build-output grep: the static `uqr` import
// may appear only under src/routes/profile/ or src/lib/components/profile/.
// (TZ-08 technical criterion: "verify via build output grep in a test or
// build script note" — this test pins the rule at the source level; the
// build-grep result is additionally recorded in the hand-over report.)

const SRC_ROOT = join(process.cwd(), 'src');

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (/\.(ts|svelte)$/.test(name)) out.push(full);
  }
  return out;
}

describe('uqr code-split (AC 13)', () => {
  it("no file outside the /profile route tree statically imports 'uqr'", () => {
    const offenders: string[] = [];
    for (const file of walk(SRC_ROOT)) {
      const rel = relative(SRC_ROOT, file).replaceAll('\\', '/');
      const content = readFileSync(file, 'utf8');
      if (/from\s+['"]uqr['"]/.test(content)) {
        const inProfile =
          rel.startsWith('routes/profile/') || rel.startsWith('lib/components/profile/');
        if (!inProfile) offenders.push(rel);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('the profile badge really does import uqr (the rule is not vacuous)', () => {
    const badge = readFileSync(
      join(SRC_ROOT, 'lib/components/profile/QrCodeBadge.svelte'),
      'utf8'
    );
    expect(badge).toMatch(/from\s+['"]uqr['"]/);
  });
});
