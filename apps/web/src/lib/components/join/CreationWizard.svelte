<script lang="ts">
  /**
   * CreationWizard (Concept §22.3 item 2, DESIGN §4.16.2; §23.2 amendments
   * 5.1–5.9; §4.18 owner order — Concept §26): the multi-step CHAT-style
   * creation wizard. The chat itself is NOT simulated here: the interview
   * log IS the real main-room chat machinery — the shared ChatTranscript
   * (lib/components/chats, extracted from /chats/[address]) renders the
   * message list and owns the proven scrolling/autoscroll behavior
   * (smooth §24-item-12 pin, tasks 107/109); the bubbles are the shared
   * MessageBubble (the mascot's Deepa hue coding + avatar row). The
   * wizard is the DRIVER: its pure machine (lib/join.ts reduceWizard)
   * produces the events and this component FEEDS the mascot's questions,
   * the sent answers (incl. the theme/interest picks), the placeholders
   * and the step flow into the shared chat. The §24/§25 composer
   * contracts (revert arrow ⇄ send swap, clear x, counter, suggestions
   * above the input, fixed-height composer, fade transitions) live in
   * the wizard's composer below the chat — untouched.
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
   *   scrolls.
   * - 5.3: every input case carries an example placeholder.
   * - 5.8: the loading step animates the SummarySheet pixel-dots beat
   *   (steps(2), transform/opacity only — reduced motion via base.css).
   * - 5.9: fade transitions — the owner amendment (Concept §23.2.5.9,
   *   DESIGN §4.15.6.4) extends them to EVERY step boundary of the whole
   *   creation path; one opacity-only treatment everywhere. §24 item 5:
   *   the step fades run slower — 400ms.
   * - §23.1 item 4: the intro copy is plain page text (no bubble
   *   background).
   *
   * §24 second-batch amendments (Concept §24, DESIGN §4.16.1):
   * - 1: NO echo — the chat never repeats the typed text while it is
   *   being written; answers land as mine bubbles only after they are
   *   SENT (snapshots taken when a step is left forward).
   * - 2: the bottom back button is gone; a REVERT ARROW sits in the
   *   input form while the input is empty and swaps to the send button
   *   the moment typing starts (arrow ⇄ send, same slot).
   * - 3: ALL history stays — every asked question and every sent answer
   *   (incl. the theme/interest picks as mine lines) remains in the log,
   *   even after going back.
   * - 4: the counter is centered BELOW the input row.
   * - 5: the step fades run slower (400ms).
   * - 6/7: the intro is calm + contextual; "Hi! I'm Bleak" renders in
   *   the pixel font.
   * - 8: an "x" on the right inside the input pill clears it quickly.
   * - 9: the composer height is strongly fixed; suggestions (messenger
   *   prefixes) sit ABOVE the input, never below.
   * - 10: the device-storage footer note is removed.
   * - 11: after a send the next input is auto-focused.
   * - 12: auto-scroll keeps the newest message pinned right above the
   *   composer — via the SHARED transcript's smooth pin (tz11-09).
   * - 13: non-standard sub-steps (contact type, themes, topics) keep a
   *   RIGHT-aligned back button.
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
    type WizardEvent,
    type WizardState
  } from '#lib/join';
  import { bubbleAriaLabel } from '#lib/chats/view';
  import ChatTranscript, { type ChatLine } from '#lib/components/chats/ChatTranscript.svelte';
  import {
    INTEREST_CATALOG,
    INTEREST_GROUPS,
    groupTitle,
    interestTitle
  } from '#lib/interests/catalog';
  import { MAX_CONTACT_CARD } from '#lib/stores/contactCard';
  import { MAX_INTERESTS } from '#lib/stores/interests';
  import BleakMascot from '#lib/components/BleakMascot.svelte';

  /**
   * The wizard interviewer's stable identity: the Deepa hue coding needs a
   * deterministic seed — the mascot always renders with the same hue,
   * everywhere the wizard runs (codeHue's fnv1a % 5 is stable per string).
   * The seed feeds the SHARED MessageBubble hue coding (no replica).
   */
  const WIZARD_MASCOT_ID = 'bleak-mascot';

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
  // §24 item 3: how far the interview has EVER gotten (monotonic — back
  // navigation never rewinds it, so the whole asked/sent history stays
  // in the log while earlier steps are revisited).
  let reached = $state(0);
  // §24 item 1: sent answers are SNAPSHOTTED the moment a step is left
  // forward — the live input value never becomes a chat line (no echo).
  let sentName = $state('');
  let sentPublic = $state('');
  let sentPrivate = $state('');
  /** `undefined` = the contact question was never answered; `null` = skipped. */
  let sentKind = $state<ContactKind | null | undefined>(undefined);
  let sentContactText = $state('');
  /** The themes phase was left via the explicit skip (no picks logged). */
  let themesSkipped = $state(false);
  /** §24 item 3: every theme the user opened stays in the history — the
   * pick question is asked once per opened theme; `answered` flips when
   * the theme is finished (its summary lands as the user's message). */
  let pickRounds = $state<{ group: number; answered: boolean }[]>([]);
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
    return kind === null ? '' : kindLabelOf(kind);
  });

  function kindLabelOf(kind: ContactKind): string {
    return translate(get(locale), KIND_KEYS[kind]);
  }

  /** The composed local-only contact text (`"<kind label>: <value>"`). */
  function contactTextOf(state: WizardState): string {
    const value = state.contactValue.trim();
    if (state.contactKind === null || value === '') return '';
    return `${kindLabelOf(state.contactKind)}: ${value}`;
  }

  const contactText = $derived(contactTextOf(wizard));

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

  /**
   * The visible transcript — the wizard DRIVES the shared chat (§4.18):
   * derived from the machine state + the §24 history trackers, mapped
   * onto the shared ChatLine model. Every question EVER reached (item 3
   * — nothing is un-asked by going back) is an agent line (the mascot's
   * Deepa hue + avatar via the shared MessageBubble), each SENT answer
   * is a mine line (item 1 — snapshots, never the live input value),
   * skip copy for skipped questions and the finished-theme summaries as
   * the user's picks (item 3).
   */
  const transcript = $derived.by(() => {
    const loc = get(locale);
    const tr = (key: MessageKey, params?: Record<string, string>): string =>
      translate(loc, key, params);
    const speaker = translate(loc, 'join.wizard.agent.name');
    /** The interviewer's line: the mascot hue + avatar, no meta. */
    const agent = (text: string): ChatLine => ({
      who: 'agent',
      text,
      hueSeed: WIZARD_MASCOT_ID,
      mascot: true,
      label: bubbleAriaLabel(speaker, text)
    });
    /** The user's sent answer (right-aligned muted; no speaker name yet
     *  — the row announces its content, no redundant aria-label). */
    const mine = (text: string): ChatLine => ({ who: 'me', text });
    /** The step was asked at least once (the question stays in the log). */
    const asked = (idx: number): boolean => reached >= idx;
    /** The step was completed at least once (the answer is sent). */
    const done = (idx: number): boolean => reached > idx;
    const lines: ChatLine[] = [];
    // name
    if (asked(1)) {
      lines.push(agent(tr('join.wizard.name.question')));
      if (done(1) && sentName !== '') {
        lines.push(mine(sentName));
        lines.push(agent(tr('join.wizard.name.answer', { name: sentName })));
      }
    }
    // public bio
    if (asked(2)) {
      lines.push(agent(tr('join.wizard.public.question')));
      if (done(2) && sentPublic !== '') lines.push(mine(sentPublic));
    }
    // private bio
    if (asked(3)) {
      lines.push(agent(tr('join.wizard.private.question')));
      if (done(3) && sentPrivate !== '') lines.push(mine(sentPrivate));
    }
    // contact: type first, then the value (§14.1.3 — local-only, skippable)
    if (asked(4)) {
      lines.push(agent(tr('join.wizard.contact.question')));
      if (done(4) && sentKind !== undefined) {
        lines.push(
          mine(sentKind === null ? tr('join.wizard.contact.skip') : kindLabelOf(sentKind))
        );
      }
    }
    if (asked(5) && sentKind !== null && sentKind !== undefined) {
      lines.push(agent(tr('join.wizard.contact.enter', { kind: kindLabelOf(sentKind) })));
      if (done(5)) {
        // A value was sent, or the value step was left via skip.
        lines.push(
          mine(sentContactText !== '' ? sentContactText : tr('join.wizard.contact.skip'))
        );
      }
    }
    // themes (§23.2 5.5/5.7): the badges question stays; each theme the
    // user opened asks its pick question in order (item 3 — the mascot's
    // questions stay in the history), a finished theme logs one summary
    // line (the picks as the user's messages, item 3); an explicit skip
    // without any picks logs the skip copy.
    if (asked(6)) {
      lines.push(agent(tr('join.wizard.interests.question')));
      for (const round of pickRounds) {
        lines.push(
          agent(tr('join.wizard.interests.pick_question', { group: groupTitle(round.group, loc) }))
        );
        if (round.answered) {
          const theme = finishedThemes.find((t) => t.group === round.group);
          if (theme) {
            const picked = INTEREST_CATALOG.filter((entry) => theme.keys.includes(entry.key));
            lines.push(
              mine(
                `${groupTitle(theme.group, loc)}: ${picked.map((e) => interestTitle(e, loc)).join(' · ')}`
              )
            );
          }
        }
      }
      if (themesSkipped && finishedThemes.length === 0) {
        lines.push(mine(tr('join.wizard.interests.skip')));
      }
    }
    return lines;
  });

  // §24 item 12: the auto-scroll is the SHARED transcript's proven pin
  // (tz11-09, DESIGN §4.18) — the wizard passes its `.log` scroller to
  // ChatTranscript with `smooth` (tasks 107/109: the smooth bottom pin +
  // the bounded settled-layout re-assert, instant under reduced motion)
  // and `pinKey` (every composer step swap). The bounded §25 height
  // chain (JoinFlow persona-step → card → this stage → .log) stays as
  // the container infrastructure the real chat mounts into.

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
    for (const event of events) {
      const before = wizard.step;
      wizard = reduceWizard(wizard, event);
      snapshotForward(before, event);
    }
  }

  /**
   * §24 items 1+3: moving FORWARD past a step snapshots its answer (the
   * mine bubbles never track the live input — no echo) and advances the
   * monotonic history cursor; back/lateral moves leave both untouched.
   */
  function snapshotForward(before: WizardState['step'], event: WizardEvent): void {
    const from = wizardOrderIndex(before);
    const to = wizardOrderIndex(wizard.step);
    if (to > reached) reached = to;
    if (to <= from) return;
    switch (before) {
      case 'name':
        sentName = wizard.name.trim();
        break;
      case 'public_bio':
        sentPublic = wizard.publicBio.trim();
        break;
      case 'private_bio':
        sentPrivate = wizard.privateBio.trim();
        break;
      case 'contact_type':
        // 'contact-kind' carries the chosen kind; 'skip' lands null.
        sentKind = wizard.contactKind;
        break;
      case 'contact_value':
        sentContactText = contactTextOf(wizard);
        break;
      case 'themes':
        // §24 item 3: an opened theme asks its pick question (kept in
        // the history as the mascot's line); an explicit skip out of
        // the badges (or the topics) logs the skip copy.
        if (event.type === 'interest-group') {
          pickRounds = [...pickRounds, { group: event.group, answered: false }];
        }
        if (event.type === 'skip') themesSkipped = true;
        break;
      case 'topics':
        if (event.type === 'skip') themesSkipped = true;
        break;
      default:
        break;
    }
  }

  function start(): void {
    dispatch({ type: 'start' });
  }

  /** §23.2 5.1 + §24 item 11: send = Enter or the send button (the
   * composer form); the name step keeps its required-validation gate
   * (§3.1 AC 7). The next input is auto-focused by the step effect
   * below (after the keyed remount). */
  function send(): void {
    if (wizard.step === 'name' && wizard.name.trim() === '') {
      nameError = true;
      return;
    }
    nameError = false;
    dispatch({ type: 'next' });
  }

  /** §24 item 11: the active composer input is auto-focused — after a
   * send (any step swap into a text step) the fresh input takes focus
   * (no-op where there is no text input, silent where focus doesn't run). */
  $effect(() => {
    if (!isTextStep) return;
    void wizard.step;
    try {
      const el = document.getElementById(inputId);
      if (el instanceof HTMLElement) el.focus();
    } catch {
      /* no document focus in tests/SSR — visual nicety only */
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
    // §24 item 3: the open pick round gets its answer (the summary mine
    // line) — the newest unanswered round for this group.
    for (let i = pickRounds.length - 1; i >= 0; i -= 1) {
      if (pickRounds[i]?.group === group && !pickRounds[i]?.answered) {
        pickRounds = pickRounds.map((round, idx) =>
          idx === i ? { ...round, answered: true } : round
        );
        break;
      }
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

  /** §24 item 8: the "x" empties the input block quickly (and returns
   * the swap slot to the revert arrow). */
  function clearInput(): void {
    nameError = false;
    switch (wizard.step) {
      case 'name':
        dispatch({ type: 'name', name: '' });
        break;
      case 'public_bio':
        dispatch({ type: 'public-bio', value: '' });
        break;
      case 'private_bio':
        dispatch({ type: 'private-bio', value: '' });
        break;
      default:
        dispatch({ type: 'contact-value', value: '' });
    }
    try {
      const el = document.getElementById(inputId);
      if (el instanceof HTMLElement) el.focus();
    } catch {
      /* no document focus in tests/SSR — visual nicety only */
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
    <!-- §23.2 5.9 (owner amendment, DESIGN §4.15.6.4): the chat stage is
         ONE fading unit — it mounts fresh at every branch boundary
         (intro ⇄ chat, creating ⇄ chat) and replays the fade there. -->
    <div class="stage">
      <!-- The interview log: the SHARED main-room chat (§4.18, tz11-09) —
           ChatTranscript renders the message list and owns the proven
           smooth autoscroll; the wrapper is the bounded scroller the
           component pins (role=log announces new lines). -->
      <div
        class="log"
        bind:this={logEl}
        role="log"
        aria-live="polite"
        aria-label={t('join.wizard.log')}
      >
        <ChatTranscript
          lines={transcript}
          scroller={logEl}
          smooth
          pinKey={wizard.step}
        />
      </div>

      <!-- §23.2 5.2: the composer is fixed at the bottom of the card; the
           log above scrolls when it overflows. -->
      <div class="composer">
      {#key wizard.step}
        <div class="panel">
          {#if isTextStep}
            <!-- §24 items 1/2/4/8/9: the messenger-prefix suggestions sit
                 ABOVE the input (item 9); the revert arrow ⇄ send swap
                 share one slot right of the input (item 2 — arrow while
                 empty, send the moment typing starts); an "x" on the
                 right inside the pill clears quickly (item 8); the
                 counter is centered below the row (item 4). -->
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
            <form class="input-row" onsubmit={(e) => { e.preventDefault(); send(); }}>
              <div class="field">
                <input
                  id={inputId}
                  type="text"
                  maxlength={INPUT_MAX[wizard.step]}
                  autocomplete="off"
                  placeholder={inputPlaceholder}
                  aria-label={inputLabel}
                  value={inputValue}
                  class:invalid={wizard.step === 'name' && errorMessage !== null}
                  class:with-clear={inputValue !== ''}
                  oninput={(e) => inputInput(e.currentTarget.value)}
                />
                {#if inputValue !== ''}
                  <!-- §24 item 8: the quick-clear "x" on the right. -->
                  <button
                    type="button"
                    class="clear"
                    aria-label={t('join.wizard.clear')}
                    onclick={clearInput}
                  >×</button>
                {/if}
              </div>
              {#if inputValue === ''}
                <!-- §24 item 2: the revert arrow while the input is empty. -->
                <button type="button" class="swap revert" aria-label={t('common.back')} onclick={back}>←</button>
              {:else}
                <!-- §23.2 5.1: the send button appears in the arrow's slot
                     the moment typing starts. -->
                <button type="submit" class="swap send" aria-label={t('join.wizard.send')}>↑</button>
              {/if}
            </form>
            <div class="meta-row">
              {#if counter}
                <span class="counter">{counter}</span>
              {/if}
            </div>
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
            <!-- §24 item 13: the right back button on non-standard forms. -->
            <button type="button" class="link back-right" onclick={back}>{t('common.back')}</button>
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
            <!-- §24 item 13: the right back button on non-standard forms. -->
            <button type="button" class="link back-right" onclick={back}>{t('common.back')}</button>
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
            <!-- §24 item 13: the right back button on non-standard forms. -->
            <button type="button" class="link back-right" onclick={back}>{t('common.back')}</button>
          {/if}
        </div>
      {/key}
    </div>
    </div>
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
    /* §23.2 5.9 (owner amendment, DESIGN §4.15.6.4): the intro and the
     * loading stage mount fresh at their boundaries (form → intro,
     * chat → creating, and every way back) — the ONE fade treatment
     * (§24 item 5: 400ms, opacity-only; base.css reduced-motion
     * catch-all). */
    animation: fade-in 400ms ease-out;
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
    /* §24 item 7: the "Hi! I'm Bleak" greeting renders in the pixel font
     * (the h1/h2/h3 base.css treatment — Handjet, not the body font). */
    font-family: var(--font-pixel);
    font-size: 26px;
    letter-spacing: 0.04em;
    overflow-wrap: anywhere;
  }
  .intro-line {
    margin: 0;
    color: var(--color-text-muted);
    font-size: 14px;
    max-width: 40ch;
  }
  /* The interview log: the bounded scroller the SHARED ChatTranscript
   * pins (§4.18, tz11-09). The list styling + the bubble rendering live
   * in the shared component; the wrapper keeps the task-107/109
   * container contract (the log is the ONE scroll container, flex: 1 +
   * min-height: 0, bottom padding so the newest bubble never touches
   * the composer edge) and hands the transcript its tighter rhythm via
   * the --transcript-gap custom property. */
  .log {
    /* §23.2 5.2: the chat content scrolls when it overflows; the tighter
     * creation-chat rhythm rides to the shared list via --transcript-gap. */
    --transcript-gap: var(--space-2);
    margin: 0;
    /* tz11-06 (task 107): bottom padding — the newest bubble never touches
     * the composer edge (the fixed input + suggestion badges sit below
     * the log in normal flow; this is the breathing room above them). */
    padding: 0 0 var(--space-2);
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    overflow-y: auto;
  }
  /* §23.2 5.9 (owner amendment, DESIGN §4.15.6.4): the chat stage is ONE
   * fading unit — it mounts fresh at every branch boundary (intro ⇄ chat,
   * creating ⇄ chat) and replays the same fade treatment. The flex column
   * carries the old .wizard layout (log scrolls, composer pins to the
   * bottom) unchanged. */
  .stage {
    animation: fade-in 400ms ease-out;
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    flex: 1;
    min-height: 0;
    min-width: 0;
  }
  .composer {
    /* §23.2 5.2: fixed at the bottom of the card (sticky pins it while
     * the log scrolls; mobile visual viewports rise with the keyboard).
     * tz11-06 (task 107): flex: none — the composer keeps its full fixed
     * height at the card's bottom edge and the message area above it
     * (the log, flex: 1) expands to fill all remaining vertical space
     * (Concept §25 item 3); the sticky pin is a no-op fallback, the
     * composer is not inside the log's scrollport. */
    position: sticky;
    bottom: 0;
    flex: none;
    background: var(--color-surface);
    padding-top: var(--space-2);
  }
  .panel {
    /* §23.2 5.9: fade transitions between the creation-chat steps
     * (§24 item 5: 400ms, opacity only; the base.css reduced-motion
     * catch-all collapses it). */
    animation: fade-in 400ms ease-out;
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
  /* §24 item 8: the input pill + the clear "x" inside it (the pill box
   * never changes size — the x is absolutely positioned over the right
   * padding, so the composer height is strongly fixed, item 9). */
  .field {
    position: relative;
    display: flex;
    flex: 1;
    min-width: 0;
  }
  .input-row input {
    flex: 1;
    min-width: 0;
    /* §24 item 9: strongly fixed height — the input never grows/shrinks
     * with its content or the buttons around it. */
    height: var(--touch-target);
    background: var(--color-surface-elevated);
    color: var(--color-text);
    border: 1px solid var(--color-text-disabled-strong);
    border-radius: var(--radius-pill);
    padding: 0 var(--space-4);
    font-size: 16px;
    transition: border-color 120ms ease-out;
  }
  /* Room for the clear "x" when it is shown (item 8). */
  .input-row input.with-clear {
    padding-right: calc(var(--space-4) + var(--space-6));
  }
  .input-row input::placeholder {
    color: var(--color-text-muted);
  }
  .input-row input.invalid {
    border-color: var(--color-accent);
  }
  .clear {
    position: absolute;
    right: var(--space-2);
    top: 50%;
    transform: translateY(-50%);
    width: var(--space-6);
    height: var(--space-6);
    padding: 0;
    border: none;
    border-radius: 50%;
    background: transparent;
    color: var(--color-text-muted);
    font-size: 18px;
    line-height: 1;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
  .clear:active {
    opacity: 0.7;
  }
  /* §24 item 2: the arrow ⇄ send swap — ONE slot right of the input.
   * The revert arrow (empty input) and the send button (typing started)
   * share the same geometry, so the swap never shifts the composer. */
  .swap {
    flex: none;
    width: var(--touch-target);
    height: var(--touch-target);
    border-radius: 50%;
    font-size: 20px;
    line-height: 1;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transition: opacity 120ms ease-out;
  }
  .swap:active {
    opacity: 0.8;
  }
  /* §23.2 5.1: the send button — accent only while interactive (§4.1
   * accent discipline). */
  .swap.send {
    border: none;
    background: var(--color-accent);
    color: var(--color-accent-ink);
  }
  .swap.revert {
    background: transparent;
    border: 1px solid var(--color-text-disabled-strong);
    color: var(--color-text-muted);
  }
  .meta-row {
    /* §24 item 4: the counter is centered below the input row. */
    display: flex;
    justify-content: center;
    align-items: baseline;
    min-height: 18px;
  }
  .counter {
    color: var(--color-text-muted);
    font-size: 12px;
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
  /* §24 item 13: the right-aligned back button on non-standard forms
   * (contact type, themes, topics). */
  .back-right {
    align-self: flex-end;
  }
  /* §23.2 5.9 (owner amendment, DESIGN §4.15.6.4): the ONE fade treatment
   * for EVERY wizard step boundary — the opacity-only fade the sheets use
   * (§24 item 5: 400ms); transform untouched. */
  @keyframes fade-in {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }
</style>
