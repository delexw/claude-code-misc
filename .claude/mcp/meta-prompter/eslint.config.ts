import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import type { TSESLint } from '@typescript-eslint/utils';

const config: TSESLint.FlatConfig.ConfigArray = tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: './tsconfig.json'
      },
    },
    rules: {
      // TypeScript specific
      '@typescript-eslint/no-unused-vars': 'error',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      
      // General code quality
      'no-console': 'off', // Allow console for MCP server logging
      'prefer-const': 'error',
      'no-var': 'error',
      
      // Import/export
      'no-duplicate-imports': 'error',
      
      // Formatting (basic)
      'indent': ['error', 2],
      'quotes': ['error', 'single'],
      'semi': ['error', 'always'],
      'comma-dangle': ['error', 'always-multiline'],
    },
  },
  {
    ignores: ['dist/**', 'node_modules/**', '*.js'],
  }
);

export default config;