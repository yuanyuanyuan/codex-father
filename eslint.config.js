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
      '**/mcp/codex-mcp-server/**',
      '**/refer-research/**',
      '**/specs/**',
      'vitest.config.ts',
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
      'eqeqeq': ['error', 'always'],
      'no-unused-expressions': 'error',
      'no-unreachable': 'error',
      'curly': ['error', 'all'],
    },
  },
  {
    // TypeScript specific configuration
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: './tsconfig.json',
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
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_'
        },
      ],
      '@typescript-eslint/explicit-function-return-type': 'warn',
      '@typescript-eslint/no-explicit-any': 'warn',
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
  }
];