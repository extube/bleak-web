<script lang="ts">
  /**
   * CreationWizard (Concept §22.3 item 2, DESIGN §4.16.2; §23.2 amendments
   * 5.1–5.9): the multi-step CHAT-style creation wizard replacing the old
   * single form. The BleakMascot (tz11-01) asks every question in a dialog
   * bubble (WizardBubble: the MessageBubble styling incl. the Deepa hue
   * coding); the pure machine lives in lib/join.ts (reduceWizard).
   *
   * Steps: intro → name (required) → public bio → private bio → contact
   * (TYPE first: phone / email / NICKNAME — §23.2 5.4: the messenger is a
   * nickname field with suggested prefixes tg:@ / signal:@ / inst:@;
   * §14.1.3: stored LOCALLY, nothing sent at creation, skippable) →
   * THEMES (§23.2 5.5/5.7: the interest groups are themes now — 8 theme
   * badges; multi-theme loop: pick a theme → its topics multi-select →
   * back to the badges, until the Ready button) → creating (loading while
   * JoinFlow POSTs the UNCHANGED createPersona body).
   *
   * §23.2 folded UX:
   * - 5.1: send happens on Enter or the send button right of the input
   *   (iOS Messages style); every input carries a current/max counter;
   *   tapping a suggestion never sends.
   * - 5.2: no "Next" buttons — the composer form is fixed at the bottom
   *   (sticky; the visual viewport rises with the keyboard), the chat log
   *   scrolls, the back button sits below the input, centered.
   * - 5.3: every input case carries an example placeholder.
   * - 5.8: the loading step animates the SummarySheet pixel-dots beat
   *   (steps(2), transform/opacity only — reduced motion via base.css).
   * - 5.9: fade transitions between the steps.
   * - §23.1 item 4: the intro copy is plain page text (no bubble
   *   background).
   *
   * Interests decision (§13.1.1): the interview records the selected
   * topic KEYS in the draft; JoinFlow flushes them through one bulk
   * addUserInterests AFTER the persona 2xx, storing the §23.2 5.5 title
   * `'<theme slug>:<topic slug>'` (numeric group/key keep the server
   * contract). Contact rides the draft as `"<kind label>: <value>"`.
   */
  import { locale, translate, type MessageKey } from '#lib/i18n/locale';
  import { get } from 'svelte/store';
  import {
    initialWizardState,
    reduceWizard,
    wizardOrderIndex,
    wizardPersonaDraft,
    type ContactKind,
    type PersonaDraft,
    type PersonaError,
    type WizardState
  } from '#lib/join';
  import {
    INTEREST_CATALOG,
    INTEREST_GROUPS,
    groupTitle,
    interestTitle
  } from '#lib/interests/catalog';
  import { MAX_CONTACT_CARD } from '#lib/stores/contactCard';
  import { MAX_INTERESTS } from '#lib/stores/interests';
  import BleakMascot from '#lib/components/BleakMascot.svelte';
  import WizardBubble from './WizardBubble.svelte';

  interface Props {
    /** Server-side error mapping while the creation POST runs. */
    error?: { kind: PersonaError; text: string | null } | null;
    /** Creation in flight → the loading step keeps the dots beat. */
    pending?: boolean;
    onsubmit?: (draft: PersonaDraft) => void;
    onback?: () => void;
  }

  let { error = null, pending = false, onsubmit, onback }: Props = $props();

  let wizard = $state<WizardState>({ ...initialWizardState });
  let nameError = $state(false);
  let logEl: HTMLElement | null = $state(null);
  // Themes already finished in the §23.2 5.7 loop (their Q/A stay in the
  // chat as mine lines; the machine state only knows the current theme).
  let finishedThemes = $state<{ group: number; keys: number[] }[]>([]);
  // The draft is submitted exactly once per 'creating' entry: every path
  // that lands on the loading step (Ready, skip) funnels through the
  // effect below. Going back out of the loading step re-arms it.
  let submitted = false;

  const t = $derived.by(() => {
    const loc = get(locale);
    return (key: MessageKey, params?: Record<string, string>): string =>
      translate(loc, key, params);
  });

  const KIND_KEYS: Record<ContactKind, MessageKey> = {
    phone: 'join.wizard.contact.phone',
    email: 'join.wizard.contact.email',
    nickname: 'join.wizard.contact.nickname'
  };

  const kindLabel = $derived.by(() => {
    const kind = wizard.contactKind;
    return kind === null ? '' : translate(get(locale), KIND_KEYS[kind]);
  });

  const contactText = $derived.by(() => {
    const value = wizard.contactValue.trim();
    if (wizard.contactKind === null || value === '') return '';
    return `${kindLabel}: ${value}`;
  });

  /** The input caps for the §23.2 5.1 counter (current/max). */
  const INPUT_MAX: Record<string, number> = {
    name: 64,
    public_bio: 255,
    private_bio: 255,
    contact_value: MAX_CONTACT_CARD
  };

  const counter = $derived.by(() => {
    const max = INPUT_MAX[wizard.step];
    if (max === undefined) return null;
    const value =
      wizard.step === 'name'
        ? wizard.name
        : wizard.step === 'public_bio'
          ? wizard.publicBio
          : wizard.step === 'private_bio'
            ? wizard.privateBio
            : wizard.contactValue;
    return t('join.wizard.counter', { n: String(value.length), max: String(max) });
  });

  interface ChatLine {
    who: 'agent' | 'me';
    text: string;
  }

  /**
   * The visible transcript, derived from the machine state (+ the finished
   * themes of the §23.2 5.7 loop): every reached question (including the
   * one being asked) as an agent bubble, each answer as a mine bubble —
   * skip answers log the skip copy.
   */
  const transcript = $derived.by(() => {
    const loc = get(locale);
    const tr = (key: MessageKey, params?: Record<string, string>): string =>
      translate(loc, key, params);
    const current = wizardOrderIndex(wizard.step);
    const past = (step: WizardState['step']): boolean => wizardOrderIndex(step) < current;
    const lines: ChatLine[] = [];
    // name
    if (current >= 1) {
      lines.push({ who: 'agent', text: tr('join.wizard.name.question') });
      if (wizard.name.trim() !== '') lines.push({ who: 'me', text: wizard.name });
      if (current > 1 && wizard.name.trim() !== '') {
        lines.push({ who: 'agent', text: tr('join.wizard.name.answer', { name: wizard.name.trim() }) });
      }
    }
    // public bio
    if (current >= 2) {
      lines.push({ who: 'agent', text: tr('join.wizard.public.question') });
      if (wizard.publicBio.trim() !== '') lines.push({ who: 'me', text: wizard.publicBio });
    }
    // private bio
    if (current >= 3) {
      lines.push({ who: 'agent', text: tr('join.wizard.private.question') });
      if (wizard.privateBio.trim() !== '') lines.push({ who: 'me', text: wizard.privateBio });
    }
    // contact: type first, then the value (§14.1.3 — local-only, skippable)
    if (current >= 4) {
      lines.push({ who: 'agent', text: tr('join.wizard.contact.question') });
      if (past('contact_type') && wizard.contactKind === null) {
        lines.push({ who: 'me', text: tr('join.wizard.contact.skip') });
      } else if (wizard.contactKind !== null) {
        lines.push({ who: 'me', text: kindLabel });
      }
    }
    if (current >= 5 && wizard.contactKind !== null) {
      lines.push({ who: 'agent', text: tr('join.wizard.contact.enter', { kind: kindLabel }) });
      if (contactText !== '') lines.push({ who: 'me', text: contactText });
    }
    // themes (§23.2 5.5/5.7): the badges question stays; every finished
    // theme logs one summary line; the in-progress theme asks its topics.
    if (current >= 6) {
      lines.push({ who: 'agent', text: tr('join.wizard.interests.question') });
      if (past('themes') && wizard.interestGroup === null && finishedThemes.length === 0) {
        lines.push({ who: 'me', text: tr('join.wizard.interests.skip') });
      }
      for (const theme of finishedThemes) {
        const picked = INTEREST_CATALOG.filter((entry) => theme.keys.includes(entry.key));
        lines.push({
          who: 'me',
          text: `${groupTitle(theme.group, loc)}: ${picked.map((e) => interestTitle(e, loc)).join(' · ')}`
        });
      }
      if (wizard.interestGroup !== null) {
        lines.push({
          who: 'agent',
          text: tr('join.wizard.interests.pick_question', {
            group: groupTitle(wizard.interestGroup, loc)
          })
        });
        const picked = INTEREST_CATALOG.filter((entry) =>
          wizard.interestKeys.includes(entry.key) && entry.group === wizard.interestGroup
        );
        if (picked.length > 0) {
          lines.push({
            who: 'me',
            text: picked.map((entry) => interestTitle(entry, loc)).join(' · ')
          });
        }
      }
    }
    return lines;
  });

  // Keep the newest bubbles visible (the log scrolls; the composer stays).
  $effect(() => {
    void transcript.length;
    try {
      logEl?.scrollTo({ top: logEl.scrollHeight });
    } catch {
      /* no scroll available (tests) — visual nicety only */
    }
  });

  const themeTopics = $derived(
    wizard.interestGroup === null
      ? []
      : INTEREST_CATALOG.filter((entry) => entry.group === wizard.interestGroup)
  );
  const atCap = $derived(wizard.interestKeys.length >= MAX_INTERESTS);

  /** §23.2 5.4: suggested messenger prefixes, offered/appendable —
   * tapping replaces any known prefix in front of the typed nickname. */
  const NICK_PREFIXES = ['tg:@', 'signal:@', 'inst:@'] as const;

  function applyNickPrefix(prefix: string): void {
    let rest = wizard.contactValue;
    for (const known of NICK_PREFIXES) {
      if (rest.startsWith(known)) {
        rest = rest.slice(known.length);
        break;
      }
    }
    dispatch({ type: 'contact-value', value: `${prefix}${rest}` });
  }

  function dispatch(...events: Parameters<typeof reduceWizard>[1][]): void {
    for (const event of events) wizard = reduceWizard(wizard, event);
  }

  function start(): void {
    dispatch({ type: 'start' });
  }

  /** §23.2 5.1: send = Enter or the send button (the composer form); the
   * name step keeps its required-validation gate (§3.1 AC 7). */
  function send(): void {
    if (wizard.step === 'name' && wizard.name.trim() === '') {
      nameError = true;
      return;
    }
    dispatch({ type: 'next' });
  }

  function back(): void {
    if (wizard.step === 'intro') {
      onback?.();
      return;
    }
    if (wizard.step === 'creating') submitted = false; // re-arm the auto-submit
    nameError = false;
    dispatch({ type: 'back' });
  }

  function skip(): void {
    dispatch({ type: 'skip' });
  }

  function finishTheme(): void {
    // §23.2 5.7: done with this theme's topics → back to the badges.
    if (wizard.step !== 'topics' || wizard.interestGroup === null) return;
    const group = wizard.interestGroup;
    const keys = INTEREST_CATALOG.filter(
      (entry) => entry.group === group && wizard.interestKeys.includes(entry.key)
    ).map((entry) => entry.key);
    if (keys.length > 0 && !finishedThemes.some((theme) => theme.group === group)) {
      finishedThemes = [...finishedThemes, { group, keys }];
    }
    dispatch({ type: 'theme-done' });
  }

  function ready(): void {
    // §23.2 5.7: the Ready button ends the whole themes phase.
    dispatch({ type: 'ready' });
  }

  function retry(): void {
    // The draft state survives a failed creation — re-run the POST.
    onsubmit?.(wizardPersonaDraft(wizard, contactText === '' ? undefined : contactText));
  }

  // Every path that reaches the loading step submits the draft ONCE (the
  // same createPersona call shape as before the wizard: name/bios/contact
  // only — the interests flush happens after the 2xx in JoinFlow).
  $effect(() => {
    if (wizard.step === 'creating' && !submitted) {
      submitted = true;
      onsubmit?.(wizardPersonaDraft(wizard, contactText === '' ? undefined : contactText));
    }
  });

  const errorMessage = $derived.by(() => {
    if (nameError) return t('join.error.name_required');
    if (!error) return null;
    switch (error.kind) {
      case 'name_taken':
        return t('join.error.name_taken');
      case 'invite':
        // §2.9: creation rejected over the invite code.
        return t('join.error.invite');
      case 'network':
        return t('common.error.network');
      default:
        return error.text ?? t('common.error');
    }
  });

  const isTextStep = $derived(
    wizard.step === 'name' ||
      wizard.step === 'public_bio' ||
      wizard.step === 'private_bio' ||
      wizard.step === 'contact_value'
  );

  const inputId = $derived(
    wizard.step === 'name'
      ? 'wizard-name'
      : wizard.step === 'public_bio'
        ? 'wizard-public'
        : wizard.step === 'private_bio'
          ? 'wizard-private'
          : 'wizard-contact'
  );

  const inputLabel = $derived.by(() => {
    switch (wizard.step) {
      case 'name':
        return t('join.form.name');
      case 'public_bio':
        return t('join.form.public_bio');
      case 'private_bio':
        return t('join.form.private_bio');
      default:
        return kindLabel;
    }
  });

  const inputValue = $derived.by(() => {
    switch (wizard.step) {
      case 'name':
        return wizard.name;
      case 'public_bio':
        return wizard.publicBio;
      case 'private_bio':
        return wizard.privateBio;
      default:
        return wizard.contactValue;
    }
  });

  const inputPlaceholder = $derived.by(() => {
    switch (wizard.step) {
      case 'name':
        return t('join.wizard.placeholder.name');
      case 'public_bio':
        return t('join.wizard.placeholder.public');
      case 'private_bio':
        return t('join.wizard.placeholder.private');
      default:
        return wizard.contactKind === 'nickname'
          ? t('join.wizard.placeholder.contact_nick')
          : t('join.wizard.placeholder.contact_value');
    }
  });

  function inputInput(value: string): void {
    nameError = false;
    switch (wizard.step) {
      case 'name':
        dispatch({ type: 'name', name: value });
        break;
      case 'public_bio':
        dispatch({ type: 'public-bio', value });
        break;
      case 'private_bio':
        dispatch({ type: 'private-bio', value });
        break;
      default:
        dispatch({ type: 'contact-value', value });
    }
  }

  /** The theme badge emoji — the theme's first topic icon (the badges
   * re-use the catalog's own iconography). */
  function groupBadgeEmoji(group: number): string {
    return INTEREST_CATALOG.find((entry) => entry.group === group)?.emoji ?? '';
  }
</script>

<div class="wizard">
  {#if wizard.step === 'creating'}
    <div class="creating-stage">
      <div class="mascot-row">
        <BleakMascot size={96} idle label={t('join.wizard.agent.name')} />
      </div>
      <!-- §23.2 5.8: the modal-sheet loading treatment — five pixel dots
           step the arcade beat above the status text (transform/opacity
           only; reduced motion via the base.css catch-all). -->
      <p class="creating" role="status">
        <span class="loading-dots" aria-hidden="true">
          {#each [1, 2, 3, 4, 5] as dot (dot)}
            <span class="dot d{dot}"></span>
          {/each}
        </span>
        <span class="loading-text">{t('join.wizard.creating')}</span>
      </p>
      {#if !pending && errorMessage}
        <p class="field-error" role="alert" aria-live="polite">{errorMessage}</p>
        <button type="button" class="cta" onclick={retry}>
          {t('common.retry')}
        </button>
      {/if}
      <button type="button" class="link" onclick={back}>{t('common.back')}</button>
    </div>
  {:else if wizard.step === 'intro'}
    <!-- §23.1 item 4: the intro copy is plain page text — no bubble
         background (the same no-plate treatment as the mascot). -->
    <div class="creating-stage">
      <div class="mascot-row">
        <BleakMascot size={112} idle label={t('join.wizard.agent.name')} />
      </div>
      <p class="intro-title">{t('join.wizard.intro.title')}</p>
      <p class="intro-line">{t('join.wizard.intro.line')}</p>
      <button type="button" class="cta" onclick={start}>{t('join.wizard.intro.start')}</button>
      <button type="button" class="link" onclick={back}>{t('common.back')}</button>
    </div>
  {:else}
    <!-- The interview log: the mascot asks in chat bubbles, the answers
         land as mine bubbles; new lines are announced (role=log). -->
    <ul class="log" bind:this={logEl} role="log" aria-live="polite" aria-label={t('join.wizard.log')}>
      {#each transcript as line, i (i)}
        <WizardBubble who={line.who} text={line.text} />
      {/each}
    </ul>

    <!-- §23.2 5.2: the composer is fixed at the bottom of the card; the
         log above scrolls when it overflows. -->
    <div class="composer">
      {#key wizard.step}
        <div class="panel">
          {#if isTextStep}
            <!-- §23.2 5.1: iOS Messages composer — input + send on the
                 right; send on Enter or the button; §23.2 5.3: the
                 example placeholder; the current/max counter below. -->
            <form class="input-row" onsubmit={(e) => { e.preventDefault(); send(); }}>
              <input
                id={inputId}
                type="text"
                maxlength={INPUT_MAX[wizard.step]}
                autocomplete="off"
                placeholder={inputPlaceholder}
                aria-label={inputLabel}
                value={inputValue}
                class:invalid={wizard.step === 'name' && errorMessage !== null}
                oninput={(e) => inputInput(e.currentTarget.value)}
              />
              <button type="submit" class="send" aria-label={t('join.wizard.send')}>↑</button>
            </form>
            <div class="meta-row">
              {#if wizard.step === 'contact_value'}
                <span class="hint">{t('join.form.contact_hint')}</span>
              {/if}
              {#if counter}
                <span class="counter">{counter}</span>
              {/if}
            </div>
            {#if wizard.step === 'contact_value' && wizard.contactKind === 'nickname'}
              <!-- §23.2 5.4: suggested messenger prefixes, appendable
                   (tapping replaces the prefix in front of the nickname). -->
              <div class="prefixes">
                {#each NICK_PREFIXES as prefix (prefix)}
                  <button
                    type="button"
                    class="toggle-chip"
                    class:selected={wizard.contactValue.startsWith(prefix)}
                    onclick={() => applyNickPrefix(prefix)}
                  >
                    {prefix}…
                  </button>
                {/each}
              </div>
            {/if}
            {#if wizard.step === 'name' && errorMessage}
              <p class="field-error" role="alert" aria-live="polite">{errorMessage}</p>
            {/if}
          {:else if wizard.step === 'contact_type'}
            <div class="choices" role="radiogroup" aria-label={t('join.form.contact')}>
              {#each (['phone', 'email', 'nickname'] as const) as kind (kind)}
                <button
                  type="button"
                  class="choice"
                  role="radio"
                  aria-checked={wizard.contactKind === kind}
                  onclick={() => dispatch({ type: 'contact-kind', kind })}
                >
                  {t(KIND_KEYS[kind])}
                </button>
              {/each}
            </div>
            <button type="button" class="link" onclick={skip}>{t('join.wizard.contact.skip')}</button>
          {:else if wizard.step === 'themes'}
            <!-- §23.2 5.5: theme badges (emoji + text); §23.2 5.7: the
                 loop returns here until Ready. -->
            <div class="badges" role="radiogroup" aria-label={t('join.wizard.interests.question')}>
              {#each INTEREST_GROUPS as group (group.group)}
                <button
                  type="button"
                  class="choice badge"
                  role="radio"
                  aria-checked={false}
                  onclick={() => dispatch({ type: 'interest-group', group: group.group })}
                >
                  <span aria-hidden="true">{groupBadgeEmoji(group.group)}</span>
                  {groupTitle(group.group, $locale)}
                </button>
              {/each}
            </div>
            <button type="button" class="cta" onclick={ready}>
              {t('join.wizard.themes.ready')}
            </button>
          {:else if wizard.step === 'topics'}
            <div class="badges" aria-label={groupTitle(wizard.interestGroup ?? 0, $locale)}>
              {#each themeTopics as entry (entry.key)}
                {@const selected = wizard.interestKeys.includes(entry.key)}
                <button
                  type="button"
                  class="toggle-chip"
                  class:selected
                  disabled={!selected && atCap}
                  aria-pressed={selected}
                  onclick={() => dispatch({ type: 'toggle-interest', key: entry.key })}
                >
                  <span aria-hidden="true">{entry.emoji}</span>
                  {interestTitle(entry, $locale)}
                </button>
              {/each}
            </div>
            <button type="button" class="cta" onclick={finishTheme}>
              {t('join.wizard.interests.done')}
            </button>
          {/if}
        </div>
      {/key}
    </div>

    <!-- §23.2 5.2: the back button sits below the input, centered. -->
    <button type="button" class="link back" onclick={back}>{t('common.back')}</button>
  {/if}
</div>

<style>
  .wizard {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    text-align: left;
    min-width: 0;
    /* §23.2 5.2: fill the card (the JoinFlow persona card is a flex
     * column) so the composer pins to its bottom and the log scrolls. */
    flex: 1;
    min-height: 0;
  }
  .creating-stage {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    align-items: center;
    text-align: center;
  }
  .mascot-row {
    display: flex;
    justify-content: center;
  }
  .intro-title {
    margin: 0;
    font-size: 24px;
    overflow-wrap: anywhere;
  }
  .intro-line {
    margin: 0;
    color: var(--color-text-muted);
    font-size: 14px;
    max-width: 40ch;
  }
  .log {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    /* §23.2 5.2: the chat content scrolls when it overflows. */
    flex: 1;
    min-height: 0;
    overflow-y: auto;
  }
  .composer {
    /* §23.2 5.2: fixed at the bottom of the card (sticky pins it while
     * the log scrolls; mobile visual viewports rise with the keyboard). */
    position: sticky;
    bottom: 0;
    background: var(--color-surface);
    padding-top: var(--space-2);
  }
  .panel {
    /* §23.2 5.9: fade transitions between the creation-chat steps
     * (opacity only; the base.css reduced-motion catch-all collapses it). */
    animation: panel-fade 200ms ease-out;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    min-width: 0;
  }
  .input-row {
    display: flex;
    gap: var(--space-2);
    align-items: center;
    min-width: 0;
  }
  .input-row input {
    flex: 1;
    min-width: 0;
    background: var(--color-surface-elevated);
    color: var(--color-text);
    border: 1px solid var(--color-text-disabled-strong);
    border-radius: var(--radius-pill);
    min-height: var(--touch-target);
    padding: 0 var(--space-4);
    font-size: 16px;
    transition: border-color 120ms ease-out;
  }
  .input-row input::placeholder {
    color: var(--color-text-muted);
  }
  .input-row input.invalid {
    border-color: var(--color-accent);
  }
  /* §23.2 5.1: the send button sits right of the input (iOS Messages
   * style) — accent only while interactive (§4.1 accent discipline). */
  .send {
    flex: none;
    width: var(--touch-target);
    height: var(--touch-target);
    border: none;
    border-radius: 50%;
    background: var(--color-accent);
    color: var(--color-accent-ink);
    font-size: 20px;
    line-height: 1;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transition: opacity 120ms ease-out;
  }
  .send:active {
    opacity: 0.8;
  }
  .meta-row {
    display: flex;
    align-items: baseline;
    gap: var(--space-3);
    min-height: 18px;
  }
  .hint {
    color: var(--color-text-muted);
    font-size: 12px;
    flex: 1;
    min-width: 0;
  }
  .counter {
    color: var(--color-text-muted);
    font-size: 12px;
    margin-left: auto;
    flex: none;
  }
  .prefixes {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }
  .choices {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  .badges {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }
  .choice {
    min-height: var(--touch-target);
    border: 1px solid var(--color-text-disabled-strong);
    border-radius: var(--radius-pill);
    background: transparent;
    color: var(--color-text);
    font-size: 14px;
    font-weight: 600;
    transition:
      background-color 120ms ease-out,
      border-color 120ms ease-out;
  }
  /* §23.2 5.5: theme badges — emoji + text chips. */
  .badge {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
  }
  .toggle-chip {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    min-height: 40px;
    padding: 0 var(--space-4);
    border: 1px solid var(--color-text-disabled-strong);
    border-radius: var(--radius-pill);
    background: transparent;
    color: var(--color-text-muted);
    font-size: 14px;
    transition:
      background-color 120ms ease-out,
      color 120ms ease-out,
      border-color 120ms ease-out;
  }
  .toggle-chip.selected {
    border-color: var(--color-accent);
    background: var(--color-accent);
    color: var(--color-accent-ink);
  }
  .toggle-chip:disabled {
    opacity: 0.5;
    cursor: default;
  }
  .creating {
    margin: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-2);
    color: var(--color-text-muted);
    font-size: 14px;
  }
  /* §23.2 5.8: FIVE square pixel dots step through a 1.2s loop (steps(2)
   * — the SummarySheet §4.15.3.3 arcade beat), staggered 120ms. */
  .loading-dots {
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }
  .dot {
    width: 6px;
    height: 6px;
    background: var(--color-accent);
    animation: loading-pulse 1.2s steps(2, jump-none) infinite;
  }
  .dot.d2 {
    animation-delay: 120ms;
  }
  .dot.d3 {
    animation-delay: 240ms;
  }
  .dot.d4 {
    animation-delay: 360ms;
  }
  .dot.d5 {
    animation-delay: 480ms;
  }
  @keyframes loading-pulse {
    0%,
    100% {
      opacity: 0.25;
      transform: translateY(0);
    }
    50% {
      opacity: 1;
      transform: translateY(-3px);
    }
  }
  .field-error {
    margin: 0;
    color: var(--color-accent);
    font-size: 14px;
    text-align: center;
  }
  .link {
    align-self: center;
    background: transparent;
    border: none;
    color: var(--color-text-muted);
    min-height: var(--touch-target);
    font-size: 14px;
    flex: none;
  }
  .back {
    /* §23.2 5.2: below the input, centered. */
    margin-top: var(--space-1);
  }
  @keyframes panel-fade {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }
</style>
