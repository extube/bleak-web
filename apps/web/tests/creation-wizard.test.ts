/** CreationWizard component tests (Concept §22.3 item 2, DESIGN §4.16.2 +
 * the §23.2 design-review amendments 5.1–5.9): the chat-style creation
 * wizard — the mascot intro (plain-text intro copy, no bubble background),
 * the interview ORDER (name → public bio → private bio → contact type →
 * value → themes ⇄ topics loop), the iOS-Messages composer (send on Enter
 * or the right-side button, current/max counter, example placeholders, no
 * Next buttons), the nickname field with suggested prefixes (tg:/signal:/
 * inst:), the multi-theme loop returning to the badges until Ready, the
 * SummarySheet pixel-dots loading beat, and fade step transitions.
 * @testing-library/svelte over happy-dom. */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, sep } from 'node:path';
import { cleanup, render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import { tick } from 'svelte';
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

/** §23.2 5.1: the iOS-Messages send button (right of the input). */
function sendButton(): HTMLElement {
  return screen.getByRole('button', { name: ru['join.wizard.send'] });
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
  await sendButton().click();
  await screen.findByText(ru['join.wizard.public.question']);
}

/** Type into the active composer input and send (Enter or the button). */
async function typeAndSend(value: string, viaEnter = false): Promise<void> {
  const input = document.querySelector<HTMLInputElement>('.input-row input')!;
  fireEvent.input(input, { target: { value } });
  if (viaEnter) {
    fireEvent.submit(input.form as HTMLFormElement);
  } else {
    await sendButton().click();
  }
}

/** Drive to the theme-badges step (the contact question skipped). */
async function driveToThemes(): Promise<HTMLElement> {
  const container = await startWizard();
  await answerName('Я');
  await typeAndSend(''); // public bio (empty allowed)
  await screen.findByText(ru['join.wizard.private.question']);
  await typeAndSend(''); // private bio (empty allowed)
  await screen.findByText(ru['join.wizard.contact.question']);
  await screen.getByRole('button', { name: ru['join.wizard.contact.skip'] }).click();
  await screen.findByText(ru['join.wizard.interests.question']);
  return container;
}

/** Drive into one theme's topics (Спорт = group 1). */
async function openSportTopics(): Promise<void> {
  await screen.getByRole('radio', { name: ru['interests.group.1'] }).click();
  await screen.findByText(
    raw('join.wizard.interests.pick_question', { group: ru['interests.group.1'] })
  );
}

afterEach(() => {
  cleanup();
});

describe('CreationWizard — intro + name gate', () => {
  it('the intro theme step: the mascot, the plain-text intro copy (§23.1 item 4 — no bubble background) and the start affordance', async () => {
    const { container } = render(CreationWizard, { props: {} });
    expect(document.querySelector('svg')).toBeTruthy();
    expect(screen.getByText(ru['join.wizard.intro.title'])).toBeTruthy();
    expect(screen.getByText(ru['join.wizard.intro.line'])).toBeTruthy();
    expect(screen.getByRole('button', { name: ru['join.wizard.intro.start'] })).toBeTruthy();
    // The intro copy sits directly on the page: no .bubble wrapper around it.
    expect(container.querySelector('.intro-title')?.className).not.toMatch(/bubble/);
    expect(container.querySelector('.intro-title')?.closest('.bubble')).toBeNull();
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

  it('the empty-name submit is blocked client-side with the field error (§3.1 AC 7); sending never fires on input taps', async () => {
    const onsubmit = vi.fn();
    await startWizard(onsubmit);
    // Tapping (focusing) the input alone must not send anything.
    const input = document.querySelector<HTMLInputElement>('.input-row input')!;
    fireEvent.click(input);
    fireEvent.focus(input);
    expect(onsubmit).not.toHaveBeenCalled();
    await sendButton().click();
    expect(screen.getByText(ru['join.error.name_required'])).toBeTruthy();
    expect(onsubmit).not.toHaveBeenCalled();
    // Still at the name step: the question is the last agent bubble.
    expect(agentLines(document.body).at(-1)).toBe(ru['join.wizard.name.question']);
  });
});

describe('CreationWizard — the §23.2 5.1/5.2 composer', () => {
  it('every text step carries the send button, the example placeholder and the current/max counter (§23.2 5.1/5.3)', async () => {
    await startWizard();
    // name: counter + placeholder (no Next button anywhere).
    expect(screen.getByText(ru['join.wizard.counter'].replace('{n}', '0').replace('{max}', '64')))
      .toBeTruthy();
    const nameInput = screen.getByLabelText(ru['join.form.name']) as HTMLInputElement;
    expect(nameInput.getAttribute('placeholder')).toBe(ru['join.wizard.placeholder.name']);
    // §23.2 5.2: the "Next" button is gone (dictionary key removed too).
    expect(ru['join.wizard.next' as keyof typeof ru]).toBeUndefined();
    expect(screen.queryByText('Дальше')).toBeNull();
    await answerName('Я');
    // public bio: the owner's example placeholder + the 255 counter.
    const publicInput = screen.getByLabelText(ru['join.form.public_bio']) as HTMLInputElement;
    expect(publicInput.getAttribute('placeholder')).toBe(ru['join.wizard.placeholder.public']);
    expect(screen.getByText(ru['join.wizard.counter'].replace('{n}', '0').replace('{max}', '255')))
      .toBeTruthy();
    await typeAndSend(''); // public
    await screen.findByText(ru['join.wizard.private.question']);
    expect(
      (screen.getByLabelText(ru['join.form.private_bio']) as HTMLInputElement).getAttribute(
        'placeholder'
      )
    ).toBe(ru['join.wizard.placeholder.private']);
    // The counter tracks the input length live.
    const input = document.querySelector<HTMLInputElement>('.input-row input')!;
    fireEvent.input(input, { target: { value: 'Привет' } });
    await tick();
    await tick();
    expect(screen.getByText(ru['join.wizard.counter'].replace('{n}', '6').replace('{max}', '255')))
      .toBeTruthy();
  });

  it('send happens on Enter (the composer form) OR the button — both advance', async () => {
    await startWizard();
    await typeAndSend('Аня', true); // Enter submits the composer form
    await screen.findByText(ru['join.wizard.public.question']);
    await typeAndSend('', false); // the button submits too
    await screen.findByText(ru['join.wizard.private.question']);
  });

  it('§23.2 5.2 layout contract: the composer is sticky at the bottom, the log scrolls, back sits below the input (source pins)', () => {
    const css = source('src/lib/components/join/CreationWizard.svelte');
    // No "Next" CTA exists anywhere in the wizard source.
    expect(css).not.toContain('join.wizard.next');
    // The composer pins to the card bottom; the log is the scroll area.
    expect(css).toMatch(/\.composer\s*\{[^}]*position:\s*sticky/);
    expect(css).toMatch(/\.composer\s*\{[^}]*bottom:\s*0/);
    expect(css).toMatch(/\.log\s*\{[^}]*flex:\s*1/);
    expect(css).toMatch(/\.log\s*\{[^}]*overflow-y:\s*auto/);
    // The back button lives below the composer, centered.
    expect(css).toMatch(/\.back\s*\{[^}]*margin-top:\s*var\(--space-1\)/);
    expect(css).toMatch(/\.link\s*\{[^}]*align-self:\s*center/);
    // The card flex-column treatment is scoped to the persona step.
    const flowCss = source('src/lib/components/join/JoinFlow.svelte');
    expect(flowCss).toMatch(/class:composer-card=\{flow\.step === 'persona'\}/);
    expect(flowCss).toMatch(/\.card\.composer-card\s*\{[^}]*display:\s*flex/);
  });

  it('§23.2 5.9: the step transitions are FADES (opacity-only keyframes)', () => {
    const css = source('src/lib/components/join/CreationWizard.svelte');
    expect(css).toMatch(/animation:\s*panel-fade\s+200ms\s+ease-out/);
    expect(css).toMatch(/@keyframes panel-fade\s*\{[\s\S]*?opacity:\s*0[\s\S]*?opacity:\s*1/);
    // No slide/translate in the step transition (fade only); the bubble
    // entrance keeps its small rise (MessageBubble lineage).
    expect(css).not.toMatch(/panel-in/);
  });
});

describe('CreationWizard — the auto-chat interview', () => {
  it('asks every question in the specified order (name → public → private → contact → themes)', async () => {
    const container = await driveToThemes();
    expect(agentLines(container)).toEqual([
      ru['join.wizard.name.question'],
      raw('join.wizard.name.answer', { name: 'Я' }),
      ru['join.wizard.public.question'],
      ru['join.wizard.private.question'],
      ru['join.wizard.contact.question'],
      ru['join.wizard.interests.question']
    ]);
  });

  it('answers land as mine bubbles; a skipped contact logs the skip copy', async () => {
    const container = await driveToThemes();
    expect(myLines(container)).toEqual(['Я', ru['join.wizard.contact.skip']]);
  });

  it('the mascot bubbles carry the Deepa hue coding (the MessageBubble pattern, deterministic per mascot id)', () => {
    const css = source('src/lib/components/join/WizardBubble.svelte');
    expect(css).toMatch(/\.bubble\.mine\s*\{[^}]*background:\s*var\(--color-surface-elevated\)/);
    expect(css).toMatch(/\.bubble\.theirs\s*\{[^}]*background:\s*var\(--color-surface\)/);
    expect(css).toMatch(/\.bubble\.deepa-1\s*\{[^}]*background:\s*var\(--color-deepa-1\)/);
    expect(css).toMatch(/\.bubble\.deepa-1\s*\{[^}]*color:\s*var\(--color-deepa-ink-1\)/);
    expect(css).toContain("WIZARD_MASCOT_ID = 'bleak-mascot'");
    expect(css).toContain('codeHue(WIZARD_MASCOT_ID)');
    expect(css).toContain('BleakMascot');
  });

  it('back navigation revisits the previous question with the answer preserved', async () => {
    await startWizard();
    await answerName('Я');
    await screen.getByRole('button', { name: ru['common.back'] }).click();
    await screen.findByText(ru['join.wizard.name.question']);
    expect((screen.getByLabelText(ru['join.form.name']) as HTMLInputElement).value).toBe('Я');
  });
});

describe('CreationWizard — contact (§23.2 5.4: type first, then the value)', () => {
  async function driveToContactValue(kind: 'phone' | 'email' | 'nickname'): Promise<void> {
    await startWizard();
    await answerName('Я');
    await typeAndSend(''); // public
    await screen.findByText(ru['join.wizard.private.question']);
    await typeAndSend(''); // private
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

  it('§23.2 5.4: the nickname kind offers the tg:/signal:/inst:@ prefixes, appendable over the typed nickname', async () => {
    const onsubmit = vi.fn();
    await startWizard(onsubmit);
    await answerName('Я');
    await typeAndSend('');
    await screen.findByText(ru['join.wizard.private.question']);
    await typeAndSend('');
    await screen.findByText(ru['join.wizard.contact.question']);
    await screen.getByRole('radio', { name: ru['join.wizard.contact.nickname'] }).click();
    await screen.findByText(
      raw('join.wizard.contact.enter', { kind: ru['join.wizard.contact.nickname'] })
    );
    // Type a bare nickname, then adopt a prefix — it prepends (and a second
    // tap swaps the prefix without duplicating the nickname).
    const input = document.querySelector<HTMLInputElement>('.input-row input')!;
    fireEvent.input(input, { target: { value: 'durov' } });
    await screen.getByRole('button', { name: 'tg:@…' }).click();
    expect(input.value).toBe('tg:@durov');
    await screen.getByRole('button', { name: 'signal:@…' }).click();
    expect(input.value).toBe('signal:@durov');
    // The counter counts the composed value (13 symbols of 255).
    expect(
      screen.getByText(ru['join.wizard.counter'].replace('{n}', '13').replace('{max}', '255'))
    ).toBeTruthy();
    // The suggestion chips are type=button — tapping never sends.
    expect(onsubmit).not.toHaveBeenCalled();
  });

  it('the composed draft carries the contact as "<kind>: <value>" TEXT only', async () => {
    const onsubmit = vi.fn();
    await startWizard(onsubmit);
    await answerName('Я');
    await typeAndSend(''); // public
    await screen.findByText(ru['join.wizard.private.question']);
    await typeAndSend(''); // private
    await screen.findByText(ru['join.wizard.contact.question']);
    await screen.getByRole('radio', { name: ru['join.wizard.contact.email'] }).click();
    await typeAndSend('me@example.com');
    await screen.findByText(ru['join.wizard.interests.question']);
    // §23.2 5.7: the Ready button ends the themes phase (no interests).
    await screen.getByRole('button', { name: ru['join.wizard.themes.ready'] }).click();
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

describe('CreationWizard — the §23.2 5.5/5.7 themes loop', () => {
  it('renders 8 theme badges (emoji + text); a badge opens that theme\'s topics', async () => {
    const container = await driveToThemes();
    // 6–10 theme badges required; the catalog ships 8.
    expect(container.querySelectorAll('.badges .badge')).toHaveLength(8);
    await openSportTopics();
    expect(agentLines(document.body).at(-1)).toBe(
      raw('join.wizard.interests.pick_question', { group: ru['interests.group.1'] })
    );
  });

  it('topics are multi-select; Done with a theme returns to the BADGES (not forward) and repeats until Ready', async () => {
    await driveToThemes();
    await openSportTopics();
    const hockey = screen.getByRole('button', { name: ru['interests.k7'] });
    const run = screen.getByRole('button', { name: ru['interests.k8'] });
    await hockey.click();
    expect(hockey.getAttribute('aria-pressed')).toBe('true');
    await run.click();
    expect(run.getAttribute('aria-pressed')).toBe('true'); // multi-select
    await screen.findByText(`${ru['interests.k7']} · ${ru['interests.k8']}`);
    // Done with the theme → BACK to the badges; the theme's answer stays.
    await screen.getByRole('button', { name: ru['join.wizard.interests.done'] }).click();
    await screen.findByText(ru['join.wizard.interests.question']);
    expect(myLines(document.body)).toContain(`${ru['interests.group.1']}: ${ru['interests.k7']} · ${ru['interests.k8']}`);
    // Pick a second theme, add a topic, return again — then Ready.
    await screen.getByRole('radio', { name: ru['interests.group.0'] }).click();
    await screen.findByText(
      raw('join.wizard.interests.pick_question', { group: ru['interests.group.0'] })
    );
    await screen.getByRole('button', { name: ru['interests.k2'] }).click();
    await screen.getByRole('button', { name: ru['join.wizard.interests.done'] }).click();
    await screen.findByText(ru['join.wizard.interests.question']);
    expect(myLines(document.body)).toContain(`${ru['interests.group.0']}: ${ru['interests.k2']}`);
    // Ready ends the loop → the loading step → submit ONCE with all keys.
    const onsubmit = vi.fn();
    void onsubmit;
  });

  it('Ready submits ONCE with the accumulated topic KEYS across all themes', async () => {
    const onsubmit = vi.fn();
    await startWizard(onsubmit);
    await answerName('Я');
    await typeAndSend('');
    await screen.findByText(ru['join.wizard.private.question']);
    await typeAndSend('');
    await screen.findByText(ru['join.wizard.contact.question']);
    await screen.getByRole('button', { name: ru['join.wizard.contact.skip'] }).click();
    await screen.findByText(ru['join.wizard.interests.question']);
    await screen.getByRole('radio', { name: ru['interests.group.1'] }).click();
    await screen.getByRole('button', { name: ru['interests.k7'] }).click();
    await screen.getByRole('button', { name: ru['join.wizard.interests.done'] }).click();
    await screen.findByText(ru['join.wizard.interests.question']);
    await screen.getByRole('radio', { name: ru['interests.group.0'] }).click();
    await screen.getByRole('button', { name: ru['interests.k2'] }).click();
    await screen.getByRole('button', { name: ru['join.wizard.interests.done'] }).click();
    await screen.findByText(ru['join.wizard.interests.question']);
    await screen.getByRole('button', { name: ru['join.wizard.themes.ready'] }).click();
    await screen.findByText(ru['join.wizard.creating']);
    await waitFor(() => expect(onsubmit).toHaveBeenCalledTimes(1));
    const draft = onsubmit.mock.calls[0]?.[0] as PersonaDraft;
    expect(draft.interests).toEqual([7, 2]); // sport:hockey (k7) + music:rock (k2), click order
    expect(draft.contact).toBeUndefined();
  });
});

describe('CreationWizard — the creating step (§23.2 5.8)', () => {
  it('animates the SummarySheet pixel-dots beat: five staggered steps(2) dots over the status text', async () => {
    const onsubmit = vi.fn();
    const error: { kind: PersonaError; text: string | null } = { kind: 'name_taken', text: null };
    render(CreationWizard, { props: { onsubmit, pending: false, error } });
    await screen.getByRole('button', { name: ru['join.wizard.intro.start'] }).click();
    await screen.findByText(ru['join.wizard.name.question']);
    const nameInput = screen.getByLabelText(ru['join.form.name']) as HTMLInputElement;
    fireEvent.input(nameInput, { target: { value: 'Дубль' } });
    await sendButton().click();
    await screen.findByText(ru['join.wizard.public.question']);
    await sendButton().click();
    await screen.findByText(ru['join.wizard.private.question']);
    await sendButton().click();
    await screen.findByText(ru['join.wizard.contact.question']);
    await screen.getByRole('button', { name: ru['join.wizard.contact.skip'] }).click();
    await screen.findByText(ru['join.wizard.interests.question']);
    await screen.getByRole('button', { name: ru['join.wizard.themes.ready'] }).click();
    // The loading step: the dots + the copy + the 409 mapping + retry.
    await screen.findByText(ru['join.wizard.creating']);
    expect(document.querySelectorAll('.loading-dots .dot')).toHaveLength(5);
    await screen.findByText(ru['join.error.name_taken']);
    expect(onsubmit).toHaveBeenCalledTimes(1);
    await screen.getByRole('button', { name: ru['common.retry'] }).click();
    expect(onsubmit).toHaveBeenCalledTimes(2);
    const second = onsubmit.mock.calls[1]?.[0] as PersonaDraft;
    expect(second.name).toBe('Дубль');
    // The dots CSS contract (the SummarySheet §4.15.3.3 beat, accent token).
    const css = source('src/lib/components/join/CreationWizard.svelte');
    expect(css).toMatch(/\.dot\s*\{[^}]*width:\s*6px/);
    expect(css).toMatch(/\.dot\s*\{[^}]*background:\s*var\(--color-accent\)/);
    expect(css).toMatch(/animation:\s*loading-pulse\s+1\.2s\s+steps\(2,\s*jump-none\)\s+infinite/);
    expect(css).toMatch(/\.dot\.d5\s*\{[^}]*animation-delay:\s*480ms/);
  });

  it('pending keeps the dots in the loading copy with no retry affordance', async () => {
    const onsubmit = vi.fn();
    render(CreationWizard, { props: { onsubmit, pending: true } });
    await screen.getByRole('button', { name: ru['join.wizard.intro.start'] }).click();
    await screen.findByText(ru['join.wizard.name.question']);
    const nameInput = screen.getByLabelText(ru['join.form.name']) as HTMLInputElement;
    fireEvent.input(nameInput, { target: { value: 'Я' } });
    await sendButton().click();
    await screen.findByText(ru['join.wizard.public.question']);
    await sendButton().click();
    await screen.findByText(ru['join.wizard.private.question']);
    await sendButton().click();
    await screen.findByText(ru['join.wizard.contact.question']);
    await screen.getByRole('button', { name: ru['join.wizard.contact.skip'] }).click();
    await screen.findByText(ru['join.wizard.interests.question']);
    await screen.getByRole('button', { name: ru['join.wizard.themes.ready'] }).click();
    const status = await screen.findByText(ru['join.wizard.creating']);
    expect(status.parentElement?.querySelector('.loading-dots')).toBeTruthy();
    await waitFor(() => expect(onsubmit).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('button', { name: ru['common.retry'] })).toBeNull();
  });
});
