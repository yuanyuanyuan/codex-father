// @ts-check
import eslint from '@eslint/js';
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import prettier from 'eslint-plugin-prettier';

export default [
  {
    // Global ignores
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.git/**',
      '**/.codex-father/**',
      '**/refer-research/**',
      '**/specs/**',
      '**/test-results/**',
      'tmp/**',
      '**/_archive/**',
      '**/_archived/**',
      '**/archive/**',
      'docs/**',
      'vitest.config.ts',
      '**/.tsbuildinfo*',
      '**/tsconfig.*.tsbuildinfo',
      '**/coverage/**',
      '**/.nyc_output/**',
    ],
  },
  {
    // Base configuration for all files
    ...eslint.configs.recommended,
    rules: {
      // Console logs allowed in CLI tools
      'no-console': 'off',
      // Prefer const/let over var
      'no-var': 'error',
      'prefer-const': 'error',
      // Code quality
      eqeqeq: ['error', 'always'],
      'no-unused-expressions': 'off',
      'no-unused-vars': 'off',
      'no-unreachable': 'error',
      curly: ['error', 'all'],
    },
  },
  {
    // TypeScript specific configuration
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: './tsconfig.eslint.json',
        tsconfigRootDir: process.cwd(),
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      prettier,
    },
    rules: {
      // Prettier integration
      'prettier/prettier': 'error',

      // TypeScript specific rules
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/explicit-function-return-type': 'warn',
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
  {
    // Legacy application code in src/ contains dynamic structures; relax strict typing rules there
    files: ['src/**'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
    },
  },
  {
    // Test files configuration
    files: ['**/*.test.ts', '**/*.spec.ts', '**/tests/**/*.ts'],
    rules: {
      // More lenient rules for tests
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      // Allow var in global declarations
      'no-var': 'off',
    },
  },
];
