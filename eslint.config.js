// Enforces docs/ENGINEERING_RULES.md sections 2 and 3 (size limits, banned constructs, engine purity).
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

const sizeLimits = {
  'max-lines': ['error', { max: 500, skipBlankLines: true, skipComments: true }],
  'max-lines-per-function': ['error', { max: 80, skipBlankLines: true, skipComments: true }],
  complexity: ['error', 15],
  'max-params': ['error', 4],
  'max-depth': ['error', 4],
};

const bannedSyntax = [
  {
    selector: 'TSEnumDeclaration',
    message: 'Use an `as const` object and a union type (rules 3).',
  },
  { selector: 'ExportDefaultDeclaration', message: 'Use named exports (rules 3).' },
];

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/coverage/**',
      '**/node_modules/**',
      'docs/**',
      'openapi/**',
      'packages/engine/fixtures/**',
      'apps/api/prisma/migrations/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      ...sizeLimits,
      'no-restricted-syntax': ['error', ...bannedSyntax],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/ban-ts-comment': [
        'error',
        { 'ts-expect-error': 'allow-with-description', 'ts-ignore': true },
      ],
      '@typescript-eslint/explicit-module-boundary-types': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/switch-exhaustiveness-check': 'error',
    },
  },
  {
    // NestJS classes are wired by decorators and injected constructors.
    files: ['apps/api/src/**/*.ts'],
    rules: {
      '@typescript-eslint/no-extraneous-class': ['error', { allowWithDecorator: true }],
      '@typescript-eslint/parameter-properties': 'off',
    },
  },
  {
    // The engine is pure and runs in Node and browsers (rules 2.2).
    files: ['packages/engine/src/**/*.ts'],
    rules: {
      'no-restricted-globals': [
        'error',
        'Date',
        'process',
        'console',
        'setTimeout',
        'setInterval',
        'fetch',
        'window',
        'document',
        'require',
      ],
      'no-restricted-imports': ['error', { patterns: ['node:*', '*/../../*'] }],
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: 'Pass randomness in (rules 2.2).' },
      ],
    },
  },
  {
    files: ['**/*.spec.ts', '**/*.test.ts', '**/test/**/*.ts'],
    rules: { 'max-lines-per-function': 'off' },
  },
  {
    files: ['**/*.config.ts', '**/*.config.js', 'eslint.config.js'],
    rules: { 'no-restricted-syntax': 'off' },
  },
  {
    files: ['**/*.js', '**/*.mjs'],
    ...tseslint.configs.disableTypeChecked,
  },
  {
    files: ['scripts/**/*.mjs'],
    languageOptions: {
      globals: { console: 'readonly', process: 'readonly', URL: 'readonly' },
    },
  },
);
