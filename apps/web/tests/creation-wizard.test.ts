/** CreationWizard component tests (Concept §22.3 item 2, DESIGN §4.16.2):
 * the chat-style creation wizard — the mascot intro, the interview ORDER
 * (name → public bio → private bio → contact type → contact value →
 * interests group → items), the transcript bubbles (agent questions carry
 * the mascot's Deepa hue; answers are mine bubbles), skip/back navigation,
 * the name-required gate (§3.1 AC 7), the interests multi-select + draft
 * composition, and the creating step with the server-error retry.
 * @testing-library/svelte over happy-dom. */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, sep } from 'node:path';
import { cleanup, render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import CreationWizard from '../src/lib/components/join/CreationWizard.svelte';
import { ru } from '../src/lib/i18n/ru';
import type { PersonaDraft, PersonaError } from '../src/lib/join';

// Source-level CSS assertions — happy-dom resolves no component CSS (the
// kit.test.ts pattern).
const WEB_ROOT = process.cwd().endsWith(sep + 'apps' + sep + 'web')
  ? process.cwd()
  : join(process.cwd(), 'apps', 'web');
function source(relativePath: string): string {
  return readFileSync(join(WEB_ROOT, relativePath), 'utf8');
}

/** Interpolate a raw dictionary string the way translate() does ({param}). */
function raw(key: keyof typeof ru, params?: Record<string, string>): string {
  let text = ru[key];
  for (const [name, value] of Object.entries(params ?? {})) {
    text = text.replaceAll(`{${name}}`, value);
  }
  return text;
}

function nextButton(): HTMLElement {
  return screen.getByRole('button', { name: ru['join.wizard.next'] });
}

/** Agent (interviewer) bubble texts in transcript order. */
function agentLines(container: HTMLElement): string[] {
  return [...container.querySelectorAll('li.agent .content')].map(
    (el) => (el as HTMLElement).textContent ?? ''
  );
}

/** Mine (answer) bubble texts in transcript order. */
function myLines(container: HTMLElement): string[] {
  return [...container.querySelectorAll('li.me .content')].map(
    (el) => (el as HTMLElement).textContent ?? ''
  );
}

async function startWizard(onsubmit?: (draft: PersonaDraft) => void): Promise<HTMLElement> {
  const { container } = render(CreationWizard, { props: onsubmit ? { onsubmit } : {} });
  await screen.getByRole('button', { name: ru['join.wizard.intro.start'] }).click();
  await screen.findByText(ru['join.wizard.name.question']);
  return container;
}

async function answerName(name: string): Promise<void> {
  const nameInput = screen.getByLabelText(ru['join.form.name']) as HTMLInputElement;
  fireEvent.input(nameInput, { target: { value: name } });
  await nextButton().click();
  await screen.findByText(ru['join.wizard.public.question']);
}

/** Drive to the interests-pick question with the group chosen (Спорт),
 * the contact question skipped (§14.1.3: optional). */
async function driveToInterestsPick(): Promise<HTMLElement> {
  const container = await startWizard();
  await answerName('Я');
  await nextButton().click(); // empty public bio allowed
  await screen.findByText(ru['join.wizard.private.question']);
  await nextButton().click(); // empty private bio allowed
  await screen.findByText(ru['join.wizard.contact.question']);
  await screen.getByRole('button', { name: ru['join.wizard.contact.skip'] }).click();
  await screen.findByText(ru['join.wizard.interests.question']);
  // The group first: Спорт (group 2).
  await screen.getByRole('radio', { name: ru['interests.group.2'] }).click();
  await screen.findByText(raw('join.wizard.interests.pick_question', { group: ru['interests.group.2'] }));
  return container;
}

afterEach(() => {
  cleanup();
});

describe('CreationWizard — intro + name gate', () => {
  it('the intro theme step: the mascot is present, the intro line and the start affordance', async () => {
    render(CreationWizard, { props: {} });
    expect(document.querySelector('svg')).toBeTruthy();
    expect(screen.getByText(ru['join.wizard.intro.title'])).toBeTruthy();
    expect(screen.getByText(ru['join.wizard.intro.line'])).toBeTruthy();
    expect(screen.getByRole('button', { name: ru['join.wizard.intro.start'] })).toBeTruthy();
  });

  it('back from the intro calls onback (the JoinFlow room-preview step); starting shows the name question', async () => {
    const onback = vi.fn();
    render(CreationWizard, { props: { onback } });
    await screen.getByRole('button', { name: ru['common.back'] }).click();
    expect(onback).toHaveBeenCalledTimes(1);
    await screen.getByRole('button', { name: ru['join.wizard.intro.start'] }).click();
    await screen.findByText(ru['join.wizard.name.question']);
    expect(onback).toHaveBeenCalledTimes(1); // back inside the interview is local
  });

  it('the empty-name submit is blocked client-side with the field error (§3.1 AC 7)', async () => {
    const onsubmit = vi.fn();
    await startWizard(onsubmit);
    await nextButton().click();
    expect(screen.getByText(ru['join.error.name_required'])).toBeTruthy();
    expect(onsubmit).not.toHaveBeenCalled();
    // Still at the name step: the question is the last agent bubble.
    expect(agentLines(document.body).at(-1)).toBe(ru['join.wizard.name.question']);
  });
});

describe('CreationWizard — the auto-chat interview', () => {
  it("asks every question in the specified order (name → public → private → contact → interests)", async () => {
    const container = await driveToInterestsPick();
    expect(agentLines(container)).toEqual([
      ru['join.wizard.name.question'],
      raw('join.wizard.name.answer', { name: 'Я' }),
      ru['join.wizard.public.question'],
      ru['join.wizard.private.question'],
      ru['join.wizard.contact.question'],
      ru['join.wizard.interests.question'],
      raw('join.wizard.interests.pick_question', { group: ru['interests.group.2'] })
    ]);
  });

  it('answers land as mine bubbles; a skipped contact logs the skip copy', async () => {
    const container = await driveToInterestsPick();
    expect(myLines(container)).toEqual([
      'Я',
      ru['join.wizard.contact.skip'],
      ru['interests.group.2']
    ]);
  });

  it('the mascot bubbles carry the Deepa hue coding (the MessageBubble pattern, deterministic per mascot id)', () => {
    const css = source('src/lib/components/join/WizardBubble.svelte');
    // theirs = the interviewer: full-opacity hue + the hue's ink token —
    // the exact MessageBubble class pairing; mine stays muted.
    expect(css).toMatch(/\.bubble\.mine\s*\{[^}]*background:\s*var\(--color-surface-elevated\)/);
    expect(css).toMatch(/\.bubble\.theirs\s*\{[^}]*background:\s*var\(--color-surface\)/);
    expect(css).toMatch(/\.bubble\.deepa-1\s*\{[^}]*background:\s*var\(--color-deepa-1\)/);
    expect(css).toMatch(/\.bubble\.deepa-1\s*\{[^}]*color:\s*var\(--color-deepa-ink-1\)/);
    expect(css).toMatch(/\.bubble\.deepa-5\s*\{[^}]*background:\s*var\(--color-deepa-5\)/);
    expect(css).toMatch(/\.bubble\.deepa-5\s*\{[^}]*color:\s*var\(--color-deepa-ink-5\)/);
    // The hue seed is the stable mascot id (deterministic hue everywhere).
    expect(css).toContain("WIZARD_MASCOT_ID = 'bleak-mascot'");
    expect(css).toContain('codeHue(WIZARD_MASCOT_ID)');
    // The interviewer's avatar is the BleakMascot itself.
    expect(css).toContain('BleakMascot');
  });

  it('the wizard steps transition with transform/opacity only; reduced motion is governed by the base.css catch-all', () => {
    const css = source('src/lib/components/join/CreationWizard.svelte');
    expect(css).toMatch(
      /@keyframes panel-in\s*\{[\s\S]*?transform:\s*translateY\(12px\)[\s\S]*?opacity/
    );
    const bubbleCss = source('src/lib/components/join/WizardBubble.svelte');
    expect(bubbleCss).toMatch(/@keyframes bubble-in\s*\{[\s\S]*?transform:\s*translateY\(6px\)/);
    // No local reduced-motion override: base.css catch-all governs (the
    // §4.16.1 BleakMascot precedent).
    expect(css).not.toMatch(/prefers-reduced-motion/);
    expect(bubbleCss).not.toMatch(/prefers-reduced-motion/);
  });

  it('back navigation revisits the previous question with the answer preserved', async () => {
    await startWizard();
    await answerName('Я');
    await screen.getByRole('button', { name: ru['common.back'] }).click();
    await screen.findByText(ru['join.wizard.name.question']);
    expect((screen.getByLabelText(ru['join.form.name']) as HTMLInputElement).value).toBe('Я');
  });
});

describe('CreationWizard — contact (type first, then the value; §14.1.3 local-only)', () => {
  async function driveToContactValue(kind: 'phone' | 'email' | 'messenger'): Promise<void> {
    await startWizard();
    await answerName('Я');
    await nextButton().click(); // public
    await screen.findByText(ru['join.wizard.private.question']);
    await nextButton().click(); // private
    await screen.findByText(ru['join.wizard.contact.question']);
    await screen.getByRole('radio', { name: ru[`join.wizard.contact.${kind}`] }).click();
    await screen.findByText(raw('join.wizard.contact.enter', { kind: ru[`join.wizard.contact.${kind}`] }));
  }

  it('choosing the type advances to the value question, interpolated with the kind', async () => {
    await driveToContactValue('phone');
    expect(agentLines(document.body).at(-1)).toBe(
      raw('join.wizard.contact.enter', { kind: ru['join.wizard.contact.phone'] })
    );
    expect(screen.getByLabelText(ru['join.wizard.contact.phone'])).toBeTruthy();
    // The §14.1.3 hint rides the value input.
    expect(screen.getByText(ru['join.form.contact_hint'])).toBeTruthy();
  });

  it('the composed draft carries the contact as "<kind>: <value>" TEXT only', async () => {
    const onsubmit = vi.fn();
    await startWizard(onsubmit);
    await answerName('Я');
    await nextButton().click(); // public
    await screen.findByText(ru['join.wizard.private.question']);
    await nextButton().click(); // private
    await screen.findByText(ru['join.wizard.contact.question']);
    await screen.getByRole('radio', { name: ru['join.wizard.contact.email'] }).click();
    const value = screen.getByLabelText(ru['join.wizard.contact.email']) as HTMLInputElement;
    fireEvent.input(value, { target: { value: 'me@example.com' } });
    await nextButton().click();
    await screen.findByText(ru['join.wizard.interests.question']);
    // Finish without interests: skip lands on creating and submits once.
    await screen.getByRole('button', { name: ru['join.wizard.interests.skip'] }).click();
    await screen.findByText(ru['join.wizard.creating']);
    await waitFor(() => expect(onsubmit).toHaveBeenCalledTimes(1));
    const draft = onsubmit.mock.calls[0]?.[0] as PersonaDraft;
    expect(draft.name).toBe('Я');
    expect(draft.publicBio).toBe('');
    expect(draft.privateBio).toBe('');
    expect(draft.contact).toBe('Почта: me@example.com');
    expect(draft.interests).toBeUndefined();
  });
});

describe('CreationWizard — interests (group first, then items, multi-select)', () => {
  it("the group pick advances to that group's items; toggles are multi-select and re-toggleable", async () => {
    await driveToInterestsPick();
    const run = screen.getByRole('button', { name: ru['interests.k12'] });
    const bike = screen.getByRole('button', { name: ru['interests.k13'] });
    await run.click();
    expect(run.getAttribute('aria-pressed')).toBe('true');
    await bike.click();
    expect(bike.getAttribute('aria-pressed')).toBe('true');
    expect(run.getAttribute('aria-pressed')).toBe('true'); // multi-select
    // The answer bubble lists the picked titles.
    await screen.findByText(`${ru['interests.k12']} · ${ru['interests.k13']}`);
    await bike.click();
    expect(bike.getAttribute('aria-pressed')).toBe('false'); // re-toggle off
    // The answer bubble now lists only Бег (the chip shares the text).
    expect(myLines(document.body).at(-1)).toBe(ru['interests.k12']);
  });

  it("finishing submits ONCE with the selected catalog KEYS (the interests flush is JoinFlow's post-2xx job)", async () => {
    const onsubmit = vi.fn();
    await startWizard(onsubmit);
    await answerName('Я');
    await nextButton().click(); // public
    await screen.findByText(ru['join.wizard.private.question']);
    await nextButton().click(); // private
    await screen.findByText(ru['join.wizard.contact.question']);
    await screen.getByRole('button', { name: ru['join.wizard.contact.skip'] }).click();
    await screen.findByText(ru['join.wizard.interests.question']);
    await screen.getByRole('radio', { name: ru['interests.group.2'] }).click();
    await screen.findByText(raw('join.wizard.interests.pick_question', { group: ru['interests.group.2'] }));
    await screen.getByRole('button', { name: ru['interests.k12'] }).click();
    await screen.getByRole('button', { name: ru['interests.k13'] }).click();
    await screen.getByRole('button', { name: ru['join.wizard.interests.done'] }).click();
    await screen.findByText(ru['join.wizard.creating']);
    await waitFor(() => expect(onsubmit).toHaveBeenCalledTimes(1));
    const draft = onsubmit.mock.calls[0]?.[0] as PersonaDraft;
    expect(draft.interests).toEqual([12, 13]);
    expect(draft.contact).toBeUndefined();
  });

  it('at the 50-row cap the unselected chips disable (the §4.13.1 client pre-flight cap, mirrored from InterestsEditor)', () => {
    const css = source('src/lib/components/join/CreationWizard.svelte');
    expect(css).toMatch(/disabled=\{!selected && atCap\}/);
    expect(css).toContain('MAX_INTERESTS');
  });
});

describe('CreationWizard — the creating step', () => {
  it('shows the loading copy; a server error surfaces the mapping with a retry (the draft state survives)', async () => {
    const onsubmit = vi.fn();
    const error: { kind: PersonaError; text: string | null } = { kind: 'name_taken', text: null };
    render(CreationWizard, { props: { onsubmit, pending: false, error } });
    await screen.getByRole('button', { name: ru['join.wizard.intro.start'] }).click();
    await screen.findByText(ru['join.wizard.name.question']);
    const nameInput = screen.getByLabelText(ru['join.form.name']) as HTMLInputElement;
    fireEvent.input(nameInput, { target: { value: 'Дубль' } });
    await nextButton().click();
    await screen.findByText(ru['join.wizard.public.question']);
    await nextButton().click();
    await screen.findByText(ru['join.wizard.private.question']);
    await nextButton().click();
    await screen.findByText(ru['join.wizard.contact.question']);
    await screen.getByRole('button', { name: ru['join.wizard.contact.skip'] }).click();
    await screen.findByText(ru['join.wizard.interests.question']);
    await screen.getByRole('button', { name: ru['join.wizard.interests.skip'] }).click();
    // The loading step: the copy + the 409 mapping + the retry CTA.
    await screen.findByText(ru['join.wizard.creating']);
    await screen.findByText(ru['join.error.name_taken']);
    expect(onsubmit).toHaveBeenCalledTimes(1);
    await screen.getByRole('button', { name: ru['common.retry'] }).click();
    expect(onsubmit).toHaveBeenCalledTimes(2);
    const second = onsubmit.mock.calls[1]?.[0] as PersonaDraft;
    expect(second.name).toBe('Дубль');
  });

  it('pending keeps the spinner in the loading copy', async () => {
    const onsubmit = vi.fn();
    render(CreationWizard, { props: { onsubmit, pending: true } });
    await screen.getByRole('button', { name: ru['join.wizard.intro.start'] }).click();
    await screen.findByText(ru['join.wizard.name.question']);
    const nameInput = screen.getByLabelText(ru['join.form.name']) as HTMLInputElement;
    fireEvent.input(nameInput, { target: { value: 'Я' } });
    await nextButton().click();
    await screen.findByText(ru['join.wizard.public.question']);
    await nextButton().click();
    await screen.findByText(ru['join.wizard.private.question']);
    await nextButton().click();
    await screen.findByText(ru['join.wizard.contact.question']);
    await screen.getByRole('button', { name: ru['join.wizard.contact.skip'] }).click();
    await screen.findByText(ru['join.wizard.interests.question']);
    await screen.getByRole('button', { name: ru['join.wizard.interests.skip'] }).click();
    const status = await screen.findByText(ru['join.wizard.creating']);
    expect(status.querySelector('.spinner')).toBeTruthy();
    // The auto-submit fired on entering the loading step…
    await waitFor(() => expect(onsubmit).toHaveBeenCalledTimes(1));
    // …and there is no retry affordance while the POST is in flight.
    expect(screen.queryByRole('button', { name: ru['common.retry'] })).toBeNull();
  });
});
