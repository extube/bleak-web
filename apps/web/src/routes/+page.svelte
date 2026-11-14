<script lang="ts">
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { t } from '#lib/i18n/locale';
  import { isValidInviteCode } from '#lib/join';

  let code = $state('');
  let error = $state('');

  // ?code=… prefills from a scanned QR / invite link (helper encodes the code).
  const urlCode = page.url.searchParams.get('code');
  if (urlCode && isValidInviteCode(urlCode)) {
    code = urlCode;
  }

  function submit(event: SubmitEvent) {
    event.preventDefault();
    if (!isValidInviteCode(code)) {
      error = t('join.error.unknown');
      return;
    }
    error = '';
    // Persona creation / import is a later feature; park the validated code so
    // the room flow can pick it up (sessionStorage = per-visit, no accounts).
    try {
      sessionStorage.setItem('bleak.pendingCode', code);
    } catch {
      /* ignore */
    }
    void goto(resolve('/room'), { replace: false });
  }
</script>

<main class="join">
  <h1 class="logo pixel-corners">{t('app.title')}</h1>
  <h2>{t('join.title')}</h2>
  <p class="subtitle">{t('join.subtitle')}</p>

  <form onsubmit={submit}>
    <label for="invite-code">{t('join.code.label')}</label>
    <input
      id="invite-code"
      name="code"
      inputmode="numeric"
      autocomplete="one-time-code"
      maxlength="6"
      placeholder={t('join.code.placeholder')}
      bind:value={code}
      required
    />
    {#if error}
      <p class="error" role="alert">{error}</p>
    {/if}
    <button type="submit" class="cta">{t('join.enter')}</button>
  </form>
</main>

<style>
  .join {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: var(--space-4);
    padding: var(--space-6);
    max-width: 420px;
    margin: 0 auto;
    width: 100%;
  }
  .logo {
    font-size: 56px;
    background: var(--color-surface);
    padding: var(--space-4) var(--space-5);
    align-self: center;
  }
  .subtitle {
    color: var(--color-text-muted);
    margin: 0;
  }
  label {
    color: var(--color-text-muted);
    font-size: 14px;
  }
  input {
    background: var(--color-surface);
    color: var(--color-text);
    border: none;
    border-radius: var(--radius-md);
    padding: var(--space-4);
    font-size: 32px;
    font-family: var(--font-pixel);
    text-align: center;
    letter-spacing: 0.3em;
    min-height: var(--touch-target);
  }
  .error {
    color: var(--color-accent);
    margin: 0;
  }
</style>
