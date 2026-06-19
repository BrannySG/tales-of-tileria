import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

export default tseslint.config(
  { ignores: ['**/dist/**', '**/node_modules/**', '**/.wrangler/**', 'AvailableAssets/**', 'Mockups/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  {
    // Cloudflare Worker + Durable Object runtime (see apps/server). TypeScript
    // (via @cloudflare/workers-types) already verifies these globals, so the
    // core no-undef rule is redundant and unaware of the Workers runtime.
    files: ['apps/server/**/*.ts'],
    languageOptions: {
      globals: { ...globals.serviceworker, ...globals.node },
    },
    rules: {
      'no-undef': 'off',
    },
  },
  {
    files: ['apps/client/**/*.{ts,tsx}'],
    languageOptions: {
      globals: { ...globals.browser },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
);
