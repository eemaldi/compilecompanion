import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import security from 'eslint-plugin-security';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/.next/**',
      '**/.turbo/**',
      '**/node_modules/**',
      '**/next-env.d.ts',
      '**/generated/**',
      '.pgdata/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  security.configs.recommended,
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-extraneous-class': ['error', { allowWithDecorator: true }],
      '@typescript-eslint/ban-ts-comment': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },
  {
    // Domain purity (ARCH-DOM-001, ADR-011): no ambient environment, clock or randomness in domain code.
    files: ['packages/shared-kernel/src/**/*.ts', 'packages/modules/*/src/domain/**/*.ts'],
    rules: {
      'no-restricted-globals': ['error', 'process', 'fetch', 'window', 'document'],
      'no-restricted-properties': [
        'error',
        { object: 'Date', property: 'now', message: 'Use the Clock port.' },
        { object: 'Math', property: 'random', message: 'Use the RandomSource port (ADR-011).' },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: "NewExpression[callee.name='Date'][arguments.length=0]",
          message: 'Use the Clock port.',
        },
      ],
    },
  },
  {
    // Config / script files: plain JS, no type information.
    files: ['**/*.{js,mjs,cjs}'],
    ...tseslint.configs.disableTypeChecked,
  },
  {
    files: ['**/*.cjs'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: { module: 'writable', require: 'readonly', __dirname: 'readonly' },
    },
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
  {
    files: ['**/*.mjs', 'tooling/scripts/*.mjs'],
    languageOptions: {
      globals: {
        process: 'readonly',
        console: 'readonly',
        URL: 'readonly',
        fetch: 'readonly',
        setTimeout: 'readonly',
      },
    },
  },
  {
    // Not shipped to production and fed only trusted paths (tests, build/tooling scripts, configs):
    // path- and key-based heuristics are noise here. All other security rules stay enabled.
    files: ['**/*.test.{ts,tsx}', '**/scripts/**', 'tooling/**', '**/*.config.{js,mjs,cjs,ts,mts}'],
    rules: {
      'security/detect-non-literal-fs-filename': 'off',
      'security/detect-object-injection': 'off',
    },
  },
);
