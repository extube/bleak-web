<script lang="ts">
  /**
   * CreationWizard (Concept §22.3 item 2, DESIGN §4.16.2): the multi-step
   * chat-style creation wizard replacing PersonaForm's single form. The
   * persona creation proceeds as a CHAT — the BleakMascot (tz11-01) asks
   * every question in a dialog bubble (WizardBubble: the MessageBubble
   * styling incl. the Deepa hue coding), the user answers in the panel
   * under the transcript, and steps transition with a transform/opacity
   * entrance (the base.css reduced-motion catch-all collapses it).
   *
   * Steps (the pure machine lives in lib/join.ts, reduceWizard): intro →
   * name (required) → public bio → private bio → contact (TYPE first:
   * phone / email / messenger — then the value; §14.1.3: stored LOCALLY
   * via the draft, nothing sent at creation, skippable) → interests
   * (group first, then that group's items, multi-select — the tz5-02
   * catalog; skippable) → creating (loading while JoinFlow POSTs the
   * persona with the UNCHANGED createPersona body).
   *
   * Interests decision (§13.1.1): the interview only records the selected
   * catalog KEYS in the draft; JoinFlow flushes them through one bulk
   * addUserInterests AFTER the persona 2xx (identity saved first — the
   * auto-injected persona credential carries the Bearer). Contact is
   * composed as `"<kind label>: <value>"` and rides the draft only.
   */
  import { locale, translate, type MessageKey } from '#lib/i18n/locale';
  import { get } from 'svelte/store';
  import {
    initialWizardState,
    reduceWizard,
    wizardPersonaDraft,
    wizardOrderIndex,
    type ContactKind,
    type PersonaDraft,
    type PersonaError,
    type WizardState,
    type WizardStep
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
    /** Creation in flight → the loading step keeps its spinner. */
    pending?: boolean;
    onsubmit?: (draft: PersonaDraft) => void;
    onback?: () => void;
  }

  let { error = null, pending = false, onsubmit, onback }: Props = $props();

  let wizard = $state<WizardState>({ ...initialWizardState });
  let nameError = $state(false);
  let logEl: HTMLElement | null = $state(null);
  // The draft is submitted exactly once per 'creating' entry: every path
  // that lands on the loading step (interests done, contact/interests
  // skip) funnels through the effect below — the machine's `finish` only
  // moves the step. Going back out of the loading step re-arms it.
  let submitted = false;

  const t = $derived.by(() => {
    const loc = get(locale);
    return (key: MessageKey, params?: Record<string, string>): string =>
      translate(loc, key, params);
  });

  const KIND_KEYS: Record<ContactKind, MessageKey> = {
    phone: 'join.wizard.contact.phone',
    email: 'join.wizard.contact.email',
    messenger: 'join.wizard.contact.messenger'
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

  interface ChatLine {
    who: 'agent' | 'me';
    text: string;
  }

  /**
   * The visible transcript, derived purely from the machine state: every
   * reached question (including the one being asked) as an agent bubble,
   * each answer as a mine bubble — skip answers log the skip copy.
   */
  const transcript = $derived.by(() => {
    const loc = get(locale);
    const tr = (key: MessageKey, params?: Record<string, string>): string =>
      translate(loc, key, params);
    const current = wizardOrderIndex(wizard.step);
    const past = (step: WizardStep): boolean => wizardOrderIndex(step) < current;
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
    // interests: group first, then that group's items (multi-select)
    if (current >= 6) {
      lines.push({ who: 'agent', text: tr('join.wizard.interests.question') });
      if (past('interests_group') && wizard.interestGroup === null) {
        lines.push({ who: 'me', text: tr('join.wizard.interests.skip') });
      } else if (wizard.interestGroup !== null) {
        lines.push({
          who: 'me',
          text: groupTitle(wizard.interestGroup, loc)
        });
      }
    }
    if (current >= 7 && wizard.interestGroup !== null) {
      lines.push({
        who: 'agent',
        text: tr('join.wizard.interests.pick_question', {
          group: groupTitle(wizard.interestGroup, loc)
        })
      });
      const picked = INTEREST_CATALOG.filter((entry) => wizard.interestKeys.includes(entry.key));
      if (picked.length > 0) {
        lines.push({
          who: 'me',
          text: picked.map((entry) => interestTitle(entry, loc)).join(' · ')
        });
      }
    }
    return lines;
  });

  // Keep the newest bubbles visible (the log scrolls; the panel stays).
  $effect(() => {
    void transcript.length;
    try {
      logEl?.scrollTo({ top: logEl.scrollHeight });
    } catch {
      /* no scroll available (tests) — visual nicety only */
    }
  });

  const groupEntries = $derived(
    wizard.interestGroup === null
      ? []
      : INTEREST_CATALOG.filter((entry) => entry.group === wizard.interestGroup)
  );
  const atCap = $derived(wizard.interestKeys.length >= MAX_INTERESTS);

  function dispatch(...events: Parameters<typeof reduceWizard>[1][]): void {
    for (const event of events) wizard = reduceWizard(wizard, event);
  }

  function start(): void {
    dispatch({ type: 'start' });
  }

  function setName(value: string): void {
    nameError = false;
    dispatch({ type: 'name', name: value });
  }

  function next(): void {
    if (wizard.step === 'name' && wizard.name.trim() === '') {
      // Existing validation: the name is required (§3.1 AC 7).
      nameError = true;
      return;
    }
    dispatch({ type: 'next' });
  }

  function skip(): void {
    dispatch({ type: 'skip' });
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

  function back(): void {
    if (wizard.step === 'intro') {
      onback?.();
      return;
    }
    if (wizard.step === 'creating') submitted = false; // re-arm the auto-submit
    nameError = false;
    dispatch({ type: 'back' });
  }

  function retry(): void {
    // The draft state survives a failed creation — re-run the POST.
    onsubmit?.(wizardPersonaDraft(wizard, contactText === '' ? undefined : contactText));
  }

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
</script>

<div class="wizard">
  {#if wizard.step === 'creating'}
    <div class="mascot-row">
      <BleakMascot size={96} idle label={t('join.wizard.agent.name')} />
    </div>
    <!-- The loading step: the copy shows while the persona POST runs
         (pending) and after a rejection (the error mapping + retry). -->
    <p class="creating" role="status">
      {#if pending}<span class="spinner" aria-hidden="true"></span>{/if}
      {t('join.wizard.creating')}
    </p>
    {#if !pending && errorMessage}
      <p class="field-error" role="alert" aria-live="polite">{errorMessage}</p>
      <button type="button" class="cta" onclick={retry}>
        {t('common.retry')}
      </button>
    {/if}
    <button type="button" class="link" onclick={back}>{t('common.back')}</button>
  {:else}
    {#if wizard.step === 'intro'}
      <div class="mascot-row">
        <BleakMascot size={112} idle label={t('join.wizard.agent.name')} />
      </div>
    {:else}
      <!-- The interview log: the mascot asks in chat bubbles, the answers
           land as mine bubbles; new lines are announced (role=log). -->
      <ul class="log" bind:this={logEl} role="log" aria-live="polite" aria-label={t('join.wizard.log')}>
        {#each transcript as line, i (i)}
          <WizardBubble who={line.who} text={line.text} />
        {/each}
      </ul>
    {/if}

    <div class="panel">
      {#if wizard.step === 'intro'}
        <p class="intro-title">{t('join.wizard.intro.title')}</p>
        <p class="intro-line">{t('join.wizard.intro.line')}</p>
        <button type="button" class="cta" onclick={start}>{t('join.wizard.intro.start')}</button>
        <button type="button" class="link" onclick={back}>{t('common.back')}</button>
      {:else if wizard.step === 'name'}
        <form class="step" onsubmit={(e) => { e.preventDefault(); next(); }}>
          <div class="field">
            <label for="wizard-name">{t('join.form.name')}</label>
            <input
              id="wizard-name"
              type="text"
              maxlength={64}
              autocomplete="off"
              value={wizard.name}
              class:invalid={errorMessage !== null}
              oninput={(e) => setName(e.currentTarget.value)}
            />
          </div>
          {#if errorMessage}
            <p class="field-error" role="alert" aria-live="polite">{errorMessage}</p>
          {/if}
          <button type="submit" class="cta">{t('join.wizard.next')}</button>
        </form>
      {:else if wizard.step === 'public_bio'}
        <form class="step" onsubmit={(e) => { e.preventDefault(); next(); }}>
          <div class="field">
            <label for="wizard-public">{t('join.form.public_bio')}</label>
            <input
              id="wizard-public"
              type="text"
              maxlength={255}
              value={wizard.publicBio}
              oninput={(e) => dispatch({ type: 'public-bio', value: e.currentTarget.value })}
            />
          </div>
          <button type="submit" class="cta">{t('join.wizard.next')}</button>
        </form>
      {:else if wizard.step === 'private_bio'}
        <form class="step" onsubmit={(e) => { e.preventDefault(); next(); }}>
          <div class="field">
            <label for="wizard-private">{t('join.form.private_bio')}</label>
            <input
              id="wizard-private"
              type="text"
              maxlength={255}
              value={wizard.privateBio}
              oninput={(e) => dispatch({ type: 'private-bio', value: e.currentTarget.value })}
            />
          </div>
          <button type="submit" class="cta">{t('join.wizard.next')}</button>
        </form>
      {:else if wizard.step === 'contact_type'}
        <div class="step" role="radiogroup" aria-label={t('join.form.contact')}>
          {#each (['phone', 'email', 'messenger'] as const) as kind (kind)}
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
          <button type="button" class="link" onclick={skip}>{t('join.wizard.contact.skip')}</button>
        </div>
      {:else if wizard.step === 'contact_value'}
        <form class="step" onsubmit={(e) => { e.preventDefault(); next(); }}>
          <div class="field">
            <label for="wizard-contact">{kindLabel}</label>
            <input
              id="wizard-contact"
              type="text"
              maxlength={MAX_CONTACT_CARD}
              value={wizard.contactValue}
              oninput={(e) => dispatch({ type: 'contact-value', value: e.currentTarget.value })}
            />
            <span class="hint">{t('join.form.contact_hint')}</span>
          </div>
          <button type="submit" class="cta">{t('join.wizard.next')}</button>
        </form>
      {:else if wizard.step === 'interests_group'}
        <div class="step">
          <div class="chips" role="radiogroup" aria-label={t('join.wizard.interests.question')}>
            {#each INTEREST_GROUPS as group (group.group)}
              <button
                type="button"
                class="choice"
                role="radio"
                aria-checked={false}
                onclick={() => dispatch({ type: 'interest-group', group: group.group })}
              >
                {groupTitle(group.group, $locale)}
              </button>
            {/each}
          </div>
          <button type="button" class="link" onclick={skip}>{t('join.wizard.interests.skip')}</button>
        </div>
      {:else if wizard.step === 'interests_pick'}
        <div class="step">
          <div class="chips" aria-label={groupTitle(wizard.interestGroup ?? 0, $locale)}>
            {#each groupEntries as entry (entry.key)}
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
          <button type="button" class="cta" onclick={() => dispatch({ type: 'finish' })}>
            {t('join.wizard.interests.done')}
          </button>
        </div>
      {/if}
    </div>

    {#if wizard.step !== 'intro' && wizard.step !== 'interests_pick'}
      <button type="button" class="link" onclick={back}>{t('common.back')}</button>
    {/if}
  {/if}
</div>

<style>
  .wizard {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    text-align: left;
    min-width: 0;
  }
  .mascot-row {
    display: flex;
    justify-content: center;
  }
  .log {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    max-height: 40vh;
    overflow-y: auto;
  }
  .panel {
    /* Smooth step transitions: transform/opacity only (DESIGN §4.6); the
     * base.css reduced-motion catch-all collapses the entrance to instant. */
    animation: panel-in 240ms ease-out;
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }
  .step {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    min-width: 0;
  }
  .field {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }
  label {
    color: var(--color-text-muted);
    font-size: 14px;
  }
  input {
    background: var(--color-surface);
    color: var(--color-text);
    border: 1px solid var(--color-text-disabled-strong);
    border-radius: var(--radius-md);
    min-height: var(--touch-target);
    padding: 0 var(--space-4);
    font-size: 16px;
    transition: border-color 120ms ease-out;
  }
  input.invalid {
    border-color: var(--color-accent);
  }
  .hint {
    color: var(--color-text-muted);
    font-size: 12px;
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
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }
  .chips .choice {
    min-height: 40px;
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
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    color: var(--color-text-muted);
    font-size: 14px;
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
  }
  .spinner {
    width: 16px;
    height: 16px;
    border: 2px solid var(--color-accent-ink);
    border-right-color: transparent;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
  @keyframes panel-in {
    from {
      opacity: 0;
      transform: translateY(12px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
</style>
