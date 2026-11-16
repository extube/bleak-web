/** Profile pure modules (TZ-08, DESIGN §3.6): greeting question-mark
 * validation, persona-QR payload building, and the uqr code-split rule
 * (AC 13 — the encoder is statically imported by the /profile route
 * chunk ONLY; source-scan equivalent of the build-output grep). */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
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

describe('personaQrPayload (DESIGN rev. 3 §3.6/§3.8 binding format — u + one-time m)', () => {
  it('encodes {base}/?u={address}&m={code} with both params escaped', () => {
    expect(personaQrPayload('0xuser1', 'code123', 'http://localhost:5173/')).toBe(
      'http://localhost:5173/?u=0xuser1&m=code123'
    );
    expect(personaQrPayload('0xuser1', 'code123', 'http://localhost:5173')).toBe(
      'http://localhost:5173/?u=0xuser1&m=code123'
    );
    expect(personaQrPayload('0x u ser', '4/ty+Z8', 'https://bleak.example')).toBe(
      'https://bleak.example/?u=0x%20u%20ser&m=4%2Fty%2BZ8'
    );
  });

  it('keeps a path-bearing base intact', () => {
    expect(personaQrPayload('0xuser1', 'c', 'https://host.example/app/')).toBe(
      'https://host.example/app/?u=0xuser1&m=c'
    );
  });

  it('falls back to the SPA origin in the browser (dev = the helper default base)', () => {
    // happy-dom window origin — the same-origin deployment target the
    // dev proxy serves (INVITE_URL_BASE http://localhost:5173/ in dev).
    expect(personaQrPayload('0xuser1', 'c')).toBe(`${window.location.origin}/?u=0xuser1&m=c`);
    expect(inviteUrlBase()).toBe(window.location.origin);
  });
});

// --- live badge-QR decision (TZ2-07 Part A, DESIGN §3.6 AC 14) ---------------

import { decideBadgeAction, registerFreshMutualCode } from '../src/lib/components/profile/liveQr';

describe('decideBadgeAction (live QR decision table)', () => {
  it('no stored code → register (first load / stale store)', () => {
    expect(decideBadgeAction(null, true)).toBe('register');
    expect(decideBadgeAction(null, undefined)).toBe('register');
    expect(decideBadgeAction('', false)).toBe('register');
  });

  it('a stored code with live=false (a scan burned it) → rotate', () => {
    expect(decideBadgeAction('code', false)).toBe('rotate');
  });

  it('a stored code with a live/unknown flag → keep', () => {
    expect(decideBadgeAction('code', true)).toBe('keep');
    expect(decideBadgeAction('code', undefined)).toBe('keep');
  });
});

describe('registerFreshMutualCode (hash-only registration, §7.4)', () => {
  it('the register call receives the SHA-256 HASH — the raw code appears in NO argument', async () => {
    const register = vi.fn(async () => undefined);
    const code = await registerFreshMutualCode('0xroom', '0xme', {}, {
      register,
      generate: () => 'RAWMUTUAL',
      // A CONSTANT hash (independent of its input): even the digest output
      // carries no trace of the raw code.
      hash: async () => 'sha256hex-fixed'
    });
    expect(code).toBe('RAWMUTUAL'); // returned for the badge QR + store only
    expect(register).toHaveBeenCalledWith('0xroom', '0xme', 'sha256hex-fixed');
    for (const call of register.mock.calls) {
      expect(JSON.stringify(call)).not.toContain('RAWMUTUAL');
    }
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
