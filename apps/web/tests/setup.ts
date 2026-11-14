// Vitest setup: automatic testing-library cleanup between tests (the
// environment has no globals, so the hook is registered here once).
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/svelte';

afterEach(() => {
  cleanup();
});
