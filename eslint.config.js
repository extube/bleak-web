import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/coverage/**',
      '**/.svelte-kit/**',
      '.opencode/**',
      'docs/**',
      'scripts/**',
      '*.md'
    ]
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...svelte.configs['flat/recommended'],
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
      'no-console': 'off'
    }
  },
  {
    files: ['**/*.svelte'],
    languageOptions: {
      parserOptions: {
        parser: tseslint.parser,
        extraFileExtensions: ['.svelte']
      },
      globals: { ...globals.browser }
    }
  },
  {
    files: ['apps/web/**/*.{ts,svelte,js}'],
    languageOptions: {
      globals: { ...globals.browser }
    }
  },
  {
    files: ['apps/helper/**/*.{ts,js}', 'packages/**/*.{ts,js}'],
    languageOptions: {
      globals: { ...globals.node }
    }
  },
  {
    files: ['**/*.test.ts', '**/*.spec.ts'],
    languageOptions: {
      globals: { ...globals.node }
    }
  },
  {
    // PixelAvatar composes its own trusted, static SVG part fragments
    // (apps/web/src/lib/assets/avatars/*.svg?raw) — never user input — so
    // the generic no-at-html-tags warning is disabled for this file only.
    files: ['apps/web/src/lib/components/PixelAvatar.svelte'],
    rules: {
      'svelte/no-at-html-tags': 'off'
    }
  }
);
