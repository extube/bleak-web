/** SummarySheet component tests (CONCEPT §13.1.5, DESIGN §4.13.5 — new
 * surface, named growth reason): the donut arc math (pure lib/chats/summary),
 * the checklist closed/open states, the > 80 fireworks threshold, the
 * embedded ShareContactSlide (tz5-04 reuse) and the Deepa hue background
 * pairing. The hosting-page trigger behaviors live in transcript-page tests;
 * the sharing/gesture logic is covered by the ShareContactSlide control's
 * own suite. */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/svelte';
import SummarySheet from '../src/lib/components/SummarySheet.svelte';
import {
  DONUT_RADIUS,
  donutCircumference,
  donutScoreDash,
  isCelebration,
  summaryCelebrates
} from '../src/lib/chats/summary';
import { codeHue } from '../src/lib/avatar/traits';
import type { Summary, User } from '@bleak/api-client';
import { ru } from '../src/lib/i18n/ru';
import { en } from '../src/lib/i18n/en';

afterEach(() => {
  cleanup();
});

const ALICE: User = {
  address: '0xalice',
  room: '0xroom',
  name: 'Алиса',
  greeting: '',
  public_bio: 'Гончая студия',
  private_bio: '',
  language: 'ru',
  created_at: '2026-11-14T10:00:00Z',
  updated_at: '2026-11-14T10:00:00Z',
  deleted_at: null
};

function summaryFixture(score: number): Summary {
  return {
    chat: '0xchat1',
    checkpoints: [
      { key: 'introductions', label: 'Both introduced themselves', closed: true },
      { key: 'goals', label: 'Goals were exchanged', closed: true },
      { key: 'details', label: 'Project details were discussed', closed: false },
      { key: 'next_step', label: 'A next step was agreed', closed: false },
      { key: 'contact', label: 'Contact details were exchanged', closed: false }
    ],
    created_at: '2026-11-19T10:00:00Z',
    description: 'You discussed ceramics and agreed to exchange contacts.',
    room: '0xroom',
    score,
    user_a: '0xme',
    user_b: ALICE.address
  };
}

function renderSheet(props: Record<string, unknown> = {}): void {
  render(SummarySheet, {
    props: {
      open: true,
      user: ALICE,
      summary: summaryFixture(66),
      slideLabel: ru['chat.contact_share.label'],
      slideSharedLabel: ru['chat.contact_share.shared'],
      slideDisabledHint: ru['chat.contact_share.no_card'],
      ...props
    }
  });
}

describe('donut arc math (lib/chats/summary — pure)', () => {
  it('the circumference is 2πr over the shared DONUT_RADIUS', () => {
    expect(donutCircumference()).toBeCloseTo(2 * Math.PI * DONUT_RADIUS, 10);
    expect(donutCircumference(10)).toBeCloseTo(2 * Math.PI * 10, 10);
  });

  it('the dasharray draws the score fraction of C, gap = the rest', () => {
    const c = donutCircumference();
    expect(donutScoreDash(0)).toBe(`0 ${c}`);
    expect(donutScoreDash(50)).toBe(`${c / 2} ${c}`);
    expect(donutScoreDash(100)).toBe(`${c} ${c}`);
    expect(donutScoreDash(66).split(' ')[0]).toBeCloseTo(c * 0.66, 10);
  });

  it('clamps out-of-range scores (total math — Summary scores are (0,100))', () => {
    const c = donutCircumference();
    expect(donutScoreDash(-5)).toBe(`0 ${c}`);
    expect(donutScoreDash(140)).toBe(`${c} ${c}`);
  });
});

describe('celebration threshold (strictly above 80)', () => {
  it('80 is NOT a celebration, 80.01 and 100 are', () => {
    expect(isCelebration(80)).toBe(false);
    expect(isCelebration(80.01)).toBe(true);
    expect(isCelebration(100)).toBe(true);
    expect(isCelebration(50)).toBe(false);
  });

  it('summaryCelebrates is null-safe (loading / failed states)', () => {
    expect(summaryCelebrates(null)).toBe(false);
    expect(summaryCelebrates(summaryFixture(95))).toBe(true);
    expect(summaryCelebrates(summaryFixture(20))).toBe(false);
  });
});

describe('SummarySheet rendering', () => {
  it('closed → nothing renders', () => {
    renderSheet({ open: false });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('the dialog shows the interlocutor name, the i18n headings and the donut score', () => {
    renderSheet();
    const dialog = screen.getByRole('dialog');
    expect(dialog.getAttribute('aria-label')).toBe(ru['chat.summary.title']);
    expect(screen.getByText('Алиса')).toBeTruthy();
    expect(screen.getByText(ru['chat.summary.title'])).toBeTruthy();
    expect(screen.getByText(ru['chat.summary.checklist'])).toBeTruthy();
    expect(dialog.querySelector('.donut .score')?.textContent).toBe('66');
    expect(dialog.querySelector('.donut .arc')?.getAttribute('style')).toContain(
      donutScoreDash(66)
    );
  });

  it('checkpoints render closed (check glyph) / open (muted, no glyph), labels verbatim', () => {
    renderSheet();
    const items = document.querySelectorAll('.checkpoint');
    expect(items).toHaveLength(5);
    expect(screen.getByText('Both introduced themselves')).toBeTruthy();
    expect(items[0]?.classList.contains('closed')).toBe(true);
    expect(items[0]?.querySelector('svg')).toBeTruthy();
    expect(items[2]?.classList.contains('closed')).toBe(false);
    expect(items[2]?.querySelector('svg')).toBeNull();
    expect(items[2]?.textContent).toContain('Project details were discussed');
  });

  it('the Summary description renders as a muted paragraph', () => {
    renderSheet();
    expect(document.querySelector('.description')?.textContent).toContain('ceramics');
  });

  it('loading state: a quiet status row, no donut and no checklist', () => {
    renderSheet({ summary: null, loading: true });
    expect(document.querySelector('[role="dialog"] .loading')).toBeTruthy();
    expect(document.querySelector('.donut')).toBeNull();
    expect(screen.queryByText(ru['chat.summary.checklist'])).toBeNull();
  });

  it('failure state: inline error + retry affordance, announced politely', () => {
    renderSheet({ summary: null, error: 'network' });
    expect(screen.getByText(ru['common.error.network'])).toBeTruthy();
    expect(screen.getByRole('alert')).toBeTruthy();

    cleanup();
    const onretry = vi.fn();
    renderSheet({ summary: null, error: 'api', errorMessage: 'boom', onretry });
    screen.getByRole('button', { name: ru['common.retry'] }).click();
    expect(onretry).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/boom/)).toBeTruthy();
  });

  it('score > 80 → the celebrate class + sparks; <= 80 → none', () => {
    renderSheet({ summary: summaryFixture(90) });
    const celebrated = document.querySelector('[role="dialog"]');
    expect(celebrated?.classList.contains('celebrate')).toBe(true);
    expect(celebrated?.querySelectorAll('.spark').length).toBeGreaterThan(0);

    cleanup();
    renderSheet({ summary: summaryFixture(80) });
    const calm = document.querySelector('[role="dialog"]');
    expect(calm?.classList.contains('celebrate')).toBe(false);
    expect(calm?.querySelector('.fireworks')).toBeNull();
  });

  it('the sheet background pairs the interlocutor Deepa hue with its ink token class', () => {
    renderSheet({ summary: summaryFixture(50) });
    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog?.classList.contains(codeHue(ALICE.address))).toBe(true);
    expect(dialog?.className).toMatch(/deepa-[1-5]/);
  });

  it('the tz5-04 ShareContactSlide is embedded inside the dialog (same props)', () => {
    renderSheet({ slideDisabled: true });
    const dialog = screen.getByRole('dialog');
    const slide = dialog.querySelector('.slide');
    expect(slide).toBeTruthy();
    expect(slide?.getAttribute('aria-disabled')).toBe('true');
    expect(slide?.textContent).toContain(ru['chat.contact_share.no_card']);
  });

  it('the X close button dismisses the sheet and reports onclose', async () => {
    const onclose = vi.fn();
    renderSheet({ onclose });
    await screen.getByRole('button', { name: ru['common.close'] }).click();
    expect(onclose).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('the onshare passthrough fires from the embedded slide thumb', async () => {
    const onshare = vi.fn();
    renderSheet({ onshare });
    const thumb = document.querySelector('[role="dialog"] .thumb') as HTMLButtonElement;
    await thumb.click();
    expect(onshare).toHaveBeenCalledTimes(1);
  });

  it('EN interface: every sheet copy renders EN from the i18n table, never RU (DESIGN §4.14.5 bug round)', async () => {
    // The reported bug: hardcoded Russian («итоги встречи», «сетевой чек
    // лист») while the owner is in the EN interface. The regression guard:
    // switch the locale store to EN and assert the sheet copy verbatim.
    const { setLocale } = await import('../src/lib/i18n/locale');
    setLocale('en');
    renderSheet({
      slideLabel: en['chat.contact_share.label'],
      slideSharedLabel: en['chat.contact_share.shared'],
      slideDisabledHint: en['chat.contact_share.no_card']
    });
    const dialog = screen.getByRole('dialog');
    expect(dialog.getAttribute('aria-label')).toBe(en['chat.summary.title']);
    expect(screen.getByText('Meeting summary')).toBeTruthy();
    expect(screen.getByText('Networking checklist')).toBeTruthy();
    expect(document.querySelector('.checklist')?.getAttribute('aria-label')).toBe(
      en['chat.summary.checklist']
    );
    expect(dialog.querySelector('.donut')?.getAttribute('aria-label')).toBe(
      'Match: 66 out of 100'
    );
    // no RU sheet copy leaks into the EN interface
    expect(screen.queryByText(ru['chat.summary.title'])).toBeNull();
    expect(screen.queryByText(ru['chat.summary.checklist'])).toBeNull();
    // checkpoint labels stay server-verbatim (English data — not UI copy)
    expect(screen.getByText('Both introduced themselves')).toBeTruthy();
    // restore the default locale for the rest of the suite
    setLocale('ru');
  });
});
