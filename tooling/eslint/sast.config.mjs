// Static security analysis gate (spec §18.10): security rules only, all as errors, no type info needed.
import tseslint from 'typescript-eslint';
import security from 'eslint-plugin-security';

const rules = Object.fromEntries(
  Object.keys(security.configs.recommended.rules).map((name) => [name, 'error']),
);

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
  {
    files: ['**/*.{ts,tsx,js,mjs,cjs}'],
    languageOptions: { parser: tseslint.parser },
    plugins: { security },
    rules: {
      ...rules,
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
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
