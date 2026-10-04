import js from '@eslint/js';
import tsParser from '@typescript-eslint/parser';
import globals from 'globals';

export default [
  { ignores: ['**/node_modules/**', '**/.next/**', '**/dist/**', '**/.expo/**', '.test-build/**', '**/next-env.d.ts', 'test_supabase*.js', 'test-insert.js'] },
  js.configs.recommended,
  {
    files: ['**/*.{js,cjs,mjs,ts,tsx}'],
    languageOptions: { globals: { ...globals.browser, ...globals.node, ...globals.serviceworker, __DEV__: 'readonly' } },
    rules: { 'no-unused-vars': 'off', 'no-empty': ['error', { allowEmptyCatch: true }] },
  },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: { parser: tsParser, parserOptions: { ecmaFeatures: { jsx: true } } },
    // TypeScript owns undefined-name checks, including JSX and type-only names.
    rules: { 'no-undef': 'off', 'no-redeclare': 'off' },
  },
];
