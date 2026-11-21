/** CreationWizard component tests (Concept §22.3 item 2, DESIGN §4.16.2 +
 * the §23.2 design-review amendments 5.1–5.9 + the §24 second batch,
 * DESIGN §4.16.1): the chat-style creation wizard — the mascot intro
 * (plain-text intro copy, no bubble background, pixel-font greeting,
 * calm contextual copy), the interview ORDER (name → public bio →
 * private bio → contact type → value → themes ⇄ topics loop), the
 * iOS-Messages composer (send on Enter or the right-side button, the
 * revert-arrow ⇄ send swap while empty/typing, the quick-clear "x",
 * current/max counter centered below the row, example placeholders, no
 * Next buttons), the nickname field with suggested prefixes ABOVE the
 * input (tg:/signal:/inst:), the multi-theme loop returning to the
 * badges until Ready, NO live echo of the typed text, the full kept
 * history, the SummarySheet pixel-dots loading beat and the slower
 * 400ms fade step transitions.
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

/**
 * §24 item 2: while the input is EMPTY the swap slot shows the revert
 * arrow (labelled like back); typing swaps it to the send button.
 */
function revertArrow(): HTMLElement {
  return screen.getByRole('button', { name: ru['common.back'] });
}

/** §23.2 5.1: the iOS-Messages send button (right of the input). */
function sendButton(): HTMLElement {
  return screen.getByRole('button', { name: ru['join.wizard.send'] });
}

/** §24 item 2: Enter always submits the composer form (the arrow sits in
 * the swap slot while the input is empty — the send button is absent). */
function submitComposer(): void {
  const form = document.querySelector<HTMLFormElement>('.input-row')!;
  fireEvent.submit(form);
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
  await tick();
  await tick(); // the send button only exists once the typed value is in state
  await sendButton().click();
  await screen.findByText(ru['join.wizard.public.question']);
}

/** Type into the active composer input and send (Enter via the form when
 * the value is empty — the swap slot shows the arrow then; the button
 * when typing started). */
async function typeAndSend(value: string, viaEnter = false): Promise<void> {
  const input = document.querySelector<HTMLInputElement>('.input-row input')!;
  fireEvent.input(input, { target: { value } });
  await tick();
  await tick(); // the send button only exists once the typed value is in state
  if (viaEnter || value === '') {
    submitComposer();
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
    // §24 item 2: the input is empty — the swap slot holds the revert
    // arrow; the send happens via Enter (the composer form submit).
    submitComposer();
    await tick();
    await tick();
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
    await typeAndSend('Я бэкенд-разработчик', false); // typing → the button submits too
    await screen.findByText(ru['join.wizard.private.question']);
  });

  it('§24 item 2: the revert arrow sits in the swap slot while the input is empty and swaps to send on typing', async () => {
    await startWizard();
    // Empty input: the arrow is there, the send button is not.
    expect(revertArrow()).toBeTruthy();
    expect(screen.queryByRole('button', { name: ru['join.wizard.send'] })).toBeNull();
    // Typing starts → the send button appears in the arrow's place.
    const input = document.querySelector<HTMLInputElement>('.input-row input')!;
    fireEvent.input(input, { target: { value: 'Аня' } });
    await tick();
    await tick();
    expect(sendButton()).toBeTruthy();
    expect(screen.queryByRole('button', { name: ru['common.back'] })).toBeNull();
    // Clearing the input swaps the send button back to the arrow.
    fireEvent.input(input, { target: { value: '' } });
    await tick();
    await tick();
    expect(revertArrow()).toBeTruthy();
    expect(screen.queryByRole('button', { name: ru['join.wizard.send'] })).toBeNull();
  });

  it('§24 item 2: the revert arrow navigates BACK (the bottom back button is gone)', async () => {
    await startWizard();
    await answerName('Я');
    // The empty public-bio input shows the arrow; clicking it goes back.
    await revertArrow().click();
    await screen.findByText(ru['join.wizard.name.question']);
  });

  it('§24 item 8: the "x" inside the pill clears the input quickly', async () => {
    await startWizard();
    const input = document.querySelector<HTMLInputElement>('.input-row input')!;
    fireEvent.input(input, { target: { value: 'Аня' } });
    await tick();
    await tick();
    const clear = screen.getByRole('button', { name: ru['join.wizard.clear'] });
    await clear.click();
    await tick();
    await tick();
    expect(input.value).toBe('');
    // The composer keeps focus and the swap slot returns to the arrow.
    expect(document.activeElement).toBe(input);
    expect(revertArrow()).toBeTruthy();
    // Clearing is never a send.
    expect(screen.getByText(ru['join.wizard.name.question'])).toBeTruthy();
  });

  it('§24 item 11: after a send the next input is auto-focused again', async () => {
    await startWizard();
    await answerName('Аня');
    await tick();
    const input = document.querySelector<HTMLInputElement>('.input-row input')!;
    expect(document.activeElement).toBe(input);
  });

  it('§23.2 5.2 + §24 items 2/4/9/13 layout contract: sticky composer, scrolling log, no bottom back, counter below, prefixes above, right back on non-standard forms (source pins)', () => {
    const css = source('src/lib/components/join/CreationWizard.svelte');
    // No "Next" CTA exists anywhere in the wizard source.
    expect(css).not.toContain('join.wizard.next');
    // The composer pins to the card bottom; the log is the scroll area.
    expect(css).toMatch(/\.composer\s*\{[^}]*position:\s*sticky/);
    expect(css).toMatch(/\.composer\s*\{[^}]*bottom:\s*0/);
    expect(css).toMatch(/\.log\s*\{[^}]*flex:\s*1/);
    expect(css).toMatch(/\.log\s*\{[^}]*overflow-y:\s*auto/);
    // §24 item 2: the bottom back button is GONE (no .back class, no
    // back button after the composer block).
    expect(css).not.toMatch(/\.back\s*\{/);
    expect(css).toMatch(/\.back-right\s*\{[^}]*align-self:\s*flex-end/);
    expect(css).not.toContain('class="link back"');
    // §24 item 4: the counter is centered below the input row.
    expect(css).toMatch(/\.meta-row\s*\{[^}]*justify-content:\s*center/);
    expect(css).not.toMatch(/\.counter\s*\{[^}]*margin-left/);
    // §24 item 9: strongly fixed input height; suggestions ABOVE the
    // input row (the prefixes block is rendered before the form).
    expect(css).toMatch(/\.input-row input\s*\{[^}]*height:\s*var\(--touch-target\)/);
    const prefixes = css.indexOf('class="prefixes"');
    const form = css.indexOf('class="input-row"');
    expect(prefixes).toBeGreaterThan(-1);
    expect(form).toBeGreaterThan(prefixes);
    // §24 item 8: the clear "x" sits inside the pill on the right.
    expect(css).toMatch(/\.clear\s*\{[^}]*position:\s*absolute/);
    expect(css).toMatch(/\.clear\s*\{[^}]*right:\s*var\(--space-2\)/);
    // §24 item 2: the arrow ⇄ send swap share one slot geometry.
    expect(css).toMatch(/\.swap\s*\{[^}]*width:\s*var\(--touch-target\)/);
    expect(css).toMatch(/\.swap\.send\s*\{[^}]*background:\s*var\(--color-accent\)/);
    expect(css).toMatch(/\.swap\.revert\s*\{[^}]*background:\s*transparent/);
    // The card flex-column treatment is scoped to the persona step.
    const flowCss = source('src/lib/components/join/JoinFlow.svelte');
    expect(flowCss).toMatch(/class:composer-card=\{flow\.step === 'persona'\}/);
    expect(flowCss).toMatch(/\.card\.composer-card\s*\{[^}]*display:\s*flex/);
  });

  it('§24 item 7b superseded by Concept §25 / DESIGN §4.17: the persona card is the explicit 750–850px desktop column in JoinFlow', () => {
    const flowCss = source('src/lib/components/join/JoinFlow.svelte');
    expect(flowCss).toMatch(/class:persona-step=\{flow\.step === 'persona'\}/);
    const desktop = flowCss.slice(flowCss.indexOf('@media (min-width: 720px)'));
    const match = desktop.match(/\.join\.persona-step\s*\{[^}]*max-width:\s*(\d+)px/);
    expect(match).toBeTruthy();
    // The explicit owner target: roughly 750–850px (800px chosen).
    const width = Number(match?.[1]);
    expect(width).toBeGreaterThanOrEqual(750);
    expect(width).toBeLessThanOrEqual(850);
    // The narrow 640px room-chat approximation is gone.
    expect(desktop).not.toMatch(/max-width:\s*640px/);
  });

  it('§24 item 7: the intro greeting renders in the pixel font (not the body font)', () => {
    const css = source('src/lib/components/join/CreationWizard.svelte');
    expect(css).toMatch(/\.intro-title\s*\{[^}]*font-family:\s*var\(--font-pixel\)/);
  });

  it('§24 item 10: the device-storage footer note is gone from the chat (both dictionaries)', () => {
    expect(ru['join.form.contact_hint' as keyof typeof ru]).toBeUndefined();
    expect(source('src/lib/components/join/CreationWizard.svelte')).not.toContain(
      'contact_hint'
    );
    const ruSrc = source('src/lib/i18n/ru.ts');
    const enSrc = source('src/lib/i18n/en.ts');
    expect(ruSrc).not.toContain('Хранится только на этом устройстве');
    expect(enSrc).not.toContain('Stored on this device only');
  });

  it('§23.2 5.9 (owner amendment, DESIGN §4.15.6.4) + §24 item 5: EVERY wizard step boundary uses the ONE fade treatment — slower now (400ms)', () => {
    const css = source('src/lib/components/join/CreationWizard.svelte');
    // One treatment everywhere: the opacity-only fade-in, on the composer
    // panel (chat-step swaps), the chat stage (intro ⇄ chat, creating ⇄
    // chat branch swaps) and the intro/creating stage (form → intro,
    // chat → creating). §24 item 5: the fade takes MORE time (400ms).
    expect(css).toMatch(/\.panel\s*\{[^}]*animation:\s*fade-in\s+400ms\s+ease-out/);
    expect(css).toMatch(/\.stage\s*\{[^}]*animation:\s*fade-in\s+400ms\s+ease-out/);
    expect(css).toMatch(/\.creating-stage\s*\{[^}]*animation:\s*fade-in\s+400ms\s+ease-out/);
    expect(css).not.toMatch(/fade-in\s+200ms/);
    expect(css).toMatch(/@keyframes fade-in\s*\{[\s\S]*?opacity:\s*0[\s\S]*?opacity:\s*1/);
    // Opacity only — no slide/translate in the step transition (the bubble
    // entrance keeps its small rise, MessageBubble lineage).
    expect(css).not.toMatch(/panel-in/);
    expect(css).not.toMatch(/stage-fade|panel-fade/);
    // The chat stage is one fading unit wrapping log + composer.
    expect(css).toMatch(/<div class="stage">/);
    // Reduced motion: the fade is a CSS animation, collapsed to instant by
    // the base.css catch-all (state changes remain visible).
    const base = source('src/lib/styles/base.css');
    expect(base).toMatch(/@media \(prefers-reduced-motion: reduce\)/);
    expect(base).toMatch(/animation-duration:\s*0\.01ms\s*!important/);
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
    // §24 item 10: the §14.1.3 device-storage hint is REMOVED from the
    // chat — the value step shows only the centered counter below.
    expect(screen.queryByText(/Хранится только на этом устройстве/)).toBeNull();
    expect(screen.queryByText(/Stored on this device only/)).toBeNull();
    expect(
      screen.getByText(ru['join.wizard.counter'].replace('{n}', '0').replace('{max}', '255'))
    ).toBeTruthy();
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
    // §24 item 1: NO live echo — the picks do not appear as a chat line
    // while they are being toggled; the summary lands after Done.
    expect(myLines(document.body)).not.toContain(`${ru['interests.k7']} · ${ru['interests.k8']}`);
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

describe('CreationWizard — §24 second batch (Concept §24, DESIGN §4.16.1)', () => {
  it('item 1: typing never echoes into the chat — the answer lands only after the send', async () => {
    await startWizard();
    const input = document.querySelector<HTMLInputElement>('.input-row input')!;
    fireEvent.input(input, { target: { value: 'Аня' } });
    await tick();
    await tick();
    // No live echo bubble of the typed text.
    expect(myLines(document.body)).toEqual([]);
    await sendButton().click();
    await screen.findByText(ru['join.wizard.public.question']);
    // The SENT answer is now a mine bubble.
    expect(myLines(document.body)).toEqual(['Аня']);
  });

  it('item 3: the whole history stays when going back (questions + sent answers)', async () => {
    const container = await startWizard();
    await answerName('Я');
    await typeAndSend('Писатель'); // public bio
    await screen.findByText(ru['join.wizard.private.question']);
    // Back once (the private input is empty → the arrow is there).
    await revertArrow().click();
    await screen.findByText(ru['join.wizard.public.question']);
    // History intact: the public Q/A and the name answer are still in the log.
    expect(agentLines(container)).toContain(ru['join.wizard.public.question']);
    expect(myLines(container)).toContain('Писатель');
    expect(agentLines(container)).toContain(raw('join.wizard.name.answer', { name: 'Я' }));
    // Clear the filled input (item 8) to reveal the arrow again, then back.
    await screen.getByRole('button', { name: ru['join.wizard.clear'] }).click();
    await revertArrow().click();
    await screen.findByText(ru['join.wizard.name.question']);
    // The interview keeps ONE answer line per question (a Q/A transcript,
    // not a stream): the re-sent name replaces the answer line in place.
    expect(myLines(container)).toEqual(['Я', 'Писатель']);
    // Forward again — the interview resumes with the history intact.
    await answerName('Я');
    await screen.findByText(ru['join.wizard.public.question']);
    expect(myLines(container)).toEqual(['Я', 'Писатель']);
  });

  it('item 13: non-standard sub-steps keep the RIGHT back button; text steps have none (the revert arrow replaces it)', async () => {
    await startWizard();
    // Text step: no .back-right — the swap slot holds the arrow instead.
    expect(document.querySelectorAll('.back-right')).toHaveLength(0);
    expect(revertArrow()).toBeTruthy();
    await answerName('Я');
    await typeAndSend(''); // public
    await screen.findByText(ru['join.wizard.private.question']);
    await typeAndSend(''); // private
    await screen.findByText(ru['join.wizard.contact.question']);
    // contact TYPE (non-standard): the right back button is there.
    expect(document.querySelectorAll('.back-right')).toHaveLength(1);
    await screen.getByRole('button', { name: ru['join.wizard.contact.skip'] }).click();
    await screen.findByText(ru['join.wizard.interests.question']);
    // themes (non-standard): the right back button is there too.
    expect(document.querySelectorAll('.back-right')).toHaveLength(1);
    await openSportTopics();
    // topics (non-standard): still there.
    expect(document.querySelectorAll('.back-right')).toHaveLength(1);
  });

  it('item 12 (tz11-06 bug round, task 107; re-pinned for bug round 2, task 109): smooth auto-scroll re-pins the newest message above the composer on every line AND step swap, with a bounded settled-layout re-assert; the log is the real scroll container (source pin)', () => {
    const src = source('src/lib/components/join/CreationWizard.svelte');
    const effect = src.slice(src.indexOf('§24 item 12'));
    expect(effect).toMatch(/void transcript\.length/);
    expect(effect).toMatch(/void wizard\.step/);
    // SMOOTH scroll to the bottom (instant under prefers-reduced-motion) —
    // one bottom-pin per content change...
    expect(effect).toMatch(
      /el\.scrollTo\(\{\s*top: el\.scrollHeight,\s*behavior: reducedMotion \? 'auto' : 'smooth'\s*\}\)/
    );
    // ...plus a bounded settled-layout re-assert: one more pin two rAFs
    // later (the keyed composer swap remounts the panel and late font
    // metrics reflow the bubbles AFTER the first pin), cancelled on the
    // effect's re-run/unmount and skipped under reduced motion.
    expect(effect).toMatch(/requestAnimationFrame\(\(\) => \{/);
    expect(effect).toMatch(/if \(el\.isConnected\) pinToBottom\(el\)/);
    expect(effect).toMatch(/return \(\) => \{\s*try \{\s*cancelAnimationFrame\(frame\)/);
    expect(effect).toMatch(/if \(reducedMotion\) return;/);
    // §4.17 item 3 + bug-report bottom padding: the composer keeps its
    // full fixed height (flex: none) and the log carries BOTTOM PADDING.
    expect(src).toMatch(/\.composer\s*\{[^}]*flex:\s*none/);
    expect(src).toMatch(/\.log\s*\{[^}]*padding:\s*0 0 var\(--space-2\)/);
    // The bounded height chain lives in JoinFlow — INCLUDING the
    // page-level .join wrapper ABOVE the component (routes/+page.svelte
    // renders JoinFlow inside its own wrapper; tz11-08 root cause: with
    // the wrapper unbounded the shell grew with the transcript, the PAGE
    // scrolled and the log's flex:1 + overflow-y never engaged).
    const flowCss = source('src/lib/components/join/JoinFlow.svelte');
    expect(flowCss).toMatch(/\.join\.persona-step\s*\{[^}]*min-height:\s*0/);
    expect(flowCss).toMatch(/\.card\.composer-card\s*\{[^}]*flex:\s*1/);
    expect(flowCss).toMatch(/\.card\.composer-card\s*\{[^}]*min-height:\s*0/);
    expect(flowCss).toMatch(
      /:global\(\.app-shell > \.join:has\(> \.persona-step\)\)\s*\{[^}]*min-height:\s*0[^}]*\}/
    );
  });

  it('item 6 + 7: the calm intro copy is in place and the greeting keeps its plain no-plate treatment', async () => {
    const { container } = render(CreationWizard, { props: {} });
    // Calm + contextual: the agent's role and the simple-dialog framing.
    expect(screen.getByText(ru['join.wizard.intro.line'])).toBeTruthy();
    expect(container.querySelector('.intro-title')?.closest('.bubble')).toBeNull();
    expect(screen.getByRole('button', { name: ru['join.wizard.intro.start'] })).toBeTruthy();
  });
});

describe('CreationWizard — item 12 auto-scroll (tz11-06 bug round, task 107; owner report docs/bugs/wizard-autoscroll-1.log)', () => {
  /**
   * happy-dom runs no layout engine, so the scroll contracts are verified
   * behaviorally by spying on the log element's scrollTo (the effect's
   * real call) — the geometry itself (the log being the actual scroll
   * container, the composer below it) is pinned structurally here and in
   * join-flow.test.ts.
   */
  function logElement(container: HTMLElement): HTMLElement {
    const log = container.querySelector('ul.log') as HTMLElement;
    expect(log).toBeTruthy();
    return log;
  }

  it('auto-scrolls to the log bottom SMOOTHLY when the chat opens', async () => {
    const spy = vi.spyOn(HTMLElement.prototype, 'scrollTo').mockImplementation(() => {});
    try {
      render(CreationWizard, { props: {} });
      await screen.getByRole('button', { name: ru['join.wizard.intro.start'] }).click();
      await screen.findByText(ru['join.wizard.name.question']);
      const log = logElement(document.body as HTMLElement);
      // The scroll ran against THE LOG (the scroll container), to its
      // (growing) bottom, with the smooth behavior.
      expect(spy.mock.contexts.at(-1)).toBe(log);
      expect(spy.mock.calls.at(-1)).toEqual([
        { top: log.scrollHeight, behavior: 'smooth' }
      ]);
    } finally {
      spy.mockRestore();
    }
  });

  it('re-pins the newest message on every sent line (smooth scroll to the bottom)', async () => {
    const container = await startWizard();
    const log = logElement(container);
    const spy = vi.spyOn(log, 'scrollTo').mockImplementation(() => {});
    try {
      await typeAndSend('Аня'); // the answer lands as a mine bubble
      await screen.findByText(ru['join.wizard.public.question']);
      await typeAndSend('Писатель'); // the public-bio answer
      await screen.findByText(ru['join.wizard.private.question']);
      // Every send flushed a scroll run — each one re-pinned the log to
      // its (growing) bottom, smoothly.
      expect(spy.mock.calls.length).toBeGreaterThanOrEqual(2);
      expect(spy.mock.calls.at(-1)).toEqual([
        { top: log.scrollHeight, behavior: 'smooth' }
      ]);
    } finally {
      spy.mockRestore();
    }
  });

  it('structure: the composer sits BELOW the log as a flex sibling — the newest message can never be cut off behind the input bar', async () => {
    const container = await startWizard();
    const stage = container.querySelector('div.stage') as HTMLElement;
    const log = container.querySelector('ul.log') as HTMLElement;
    const composer = container.querySelector('.composer') as HTMLElement;
    expect(stage).toBeTruthy();
    // The composer is NOT inside the scrolled area — no sticky overlay of
    // log content is possible (the old partial-cutoff bug).
    expect(log.contains(composer)).toBe(false);
    // In flow: the log first (it expands), the composer last (pinned at
    // the bottom edge, Concept §25 item 3).
    expect(stage.firstElementChild).toBe(log);
    expect(stage.lastElementChild).toBe(composer);
  });
});

describe('CreationWizard — item 12 REAL-GEOMETRY cascade contract (tz11-08, task 109)', () => {
  /**
   * The bug-round-2 lesson (owner report docs/bugs/wizard-autoscroll-2.log):
   * the task-107 contract passed while the real app misbehaved — happy-dom
   * runs no layout engine AND (verified empirically) the test environment
   * injects NO component CSS (0 <style> tags), so the spy assertions never
   * saw geometry or cascade. This is the strongest layout-capable contract
   * available WITHOUT new deps (no headless browser exists in the
   * toolchain; none is authorized): the wizard's REAL <style> block is read
   * from source at test time, injected into the document, and the COMPUTED
   * cascade of the rendered chat stage is asserted (happy-dom resolves the
   * stylesheet cascade). Real box metrics stay impossible here (the
   * documented real-browser manual smoke lives in docs/verification-v311.md).
   */
  function styleBlock(relativePath: string): string {
    const match = source(relativePath).match(/<style[^>]*>([\s\S]*)<\/style>/);
    expect(match, `<style> block not found in ${relativePath}`).toBeTruthy();
    return match?.[1] ?? '';
  }

  function isZeroMin(min: string): boolean {
    return min === '0' || min === '0px';
  }

  it('the computed chat-stage cascade: the log is the SINGLE scroll container, bounded flex columns above it, the composer pinned below', async () => {
    // The wizard's source has no :global selectors — inject as-is.
    const style = document.createElement('style');
    style.setAttribute('data-cascade-contract', 'creation-wizard');
    style.textContent = styleBlock('src/lib/components/join/CreationWizard.svelte');
    document.head.appendChild(style);
    try {
      await startWizard();
      const log = document.querySelector('ul.log') as HTMLElement;
      const composer = document.querySelector('.composer') as HTMLElement;
      expect(log).toBeTruthy();
      // The log IS a scroll container in the computed cascade...
      const logCs = getComputedStyle(log);
      expect(logCs.overflowY).toBe('auto');
      expect(logCs.display).toBe('flex');
      expect(logCs.flexDirection).toBe('column');
      expect(isZeroMin(logCs.minHeight)).toBe(true);
      // ...and the ONLY one in the rendered subtree.
      const scrollers = [
        ...document.querySelectorAll<HTMLElement>('.wizard, .wizard *')
      ].filter((el) => getComputedStyle(el).overflowY === 'auto');
      expect(scrollers).toEqual([log]);
      // Every flex-item link above the log inside the wizard is a bounded
      // flex column (one automatic-minimum link = the task-107/109 bug class).
      const stage = log.parentElement as HTMLElement;
      const wizard = stage.parentElement as HTMLElement;
      for (const el of [stage, wizard]) {
        const cs = getComputedStyle(el);
        expect(cs.display).toBe('flex');
        expect(cs.flexDirection).toBe('column');
        expect(isZeroMin(cs.minHeight)).toBe(true);
      }
      // The composer: pinned below the log (flex: none — no growth; the
      // sticky pin is a fallback, it is NOT inside the scrollport).
      expect(composer.parentElement).toBe(stage);
      expect(getComputedStyle(composer).flexGrow).toBe('0');
      expect(getComputedStyle(composer).position).toBe('sticky');
    } finally {
      style.remove();
    }
  });

  it('the settled-layout re-assert fires two rAFs after a send (deterministic, stubbed frames)', async () => {
    /** One slot per scheduled frame; cancel nulls the slot. */
    const frames: (FrameRequestCallback | undefined)[] = [];
    const raf = vi.fn((cb: FrameRequestCallback) => {
      frames.push(cb);
      return frames.length;
    });
    const caf = vi.fn((id: number) => {
      frames[id - 1] = undefined;
    });
    vi.stubGlobal('requestAnimationFrame', raf);
    vi.stubGlobal('cancelAnimationFrame', caf);
    function flushFrames(): void {
      const batch = frames.splice(0);
      for (const cb of batch) cb?.(16);
    }
    let spy: ReturnType<typeof vi.spyOn> | null = null;
    try {
      const container = await startWizard();
      const log = container.querySelector('ul.log') as HTMLElement;
      spy = vi.spyOn(log, 'scrollTo').mockImplementation(() => {});
      // One send: the synchronous pin ran in the effect (the mount effect
      // scheduled a frame that the send's effect re-run cancelled).
      await typeAndSend('Аня');
      await screen.findByText(ru['join.wizard.public.question']);
      const syncCalls = spy.mock.calls.length;
      expect(syncCalls).toBeGreaterThanOrEqual(1);
      // Two stubbed frames later: the re-assert pins again — same element,
      // same smooth bottom target (the "layout settles after the effect"
      // case: composer swap remount, late font metrics).
      flushFrames(); // frame 1 (schedules frame 2)
      flushFrames(); // frame 2 → pinToBottom
      expect(spy.mock.calls.length).toBeGreaterThan(syncCalls);
      expect(spy.mock.calls.at(-1)).toEqual([
        { top: log.scrollHeight, behavior: 'smooth' }
      ]);
      // The re-assert is bounded: cancelling happens on the next effect
      // re-run (a pending frame never survives a content change).
      expect(raf).toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
      spy?.mockRestore();
    }
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
    await tick();
    await tick(); // the send button only exists once the typed value is in state
    await sendButton().click();
    await screen.findByText(ru['join.wizard.public.question']);
    submitComposer(); // public (empty — the swap slot holds the arrow)
    await screen.findByText(ru['join.wizard.private.question']);
    submitComposer(); // private (empty)
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
    await tick();
    await tick(); // the send button only exists once the typed value is in state
    await sendButton().click();
    await screen.findByText(ru['join.wizard.public.question']);
    submitComposer(); // public (empty)
    await screen.findByText(ru['join.wizard.private.question']);
    submitComposer(); // private (empty)
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
