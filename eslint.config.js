import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import ts from 'typescript-eslint';

export default defineConfig([
    js.configs.recommended,
    ts.configs.recommended,
    { ignores: ['**/dist'] },
    {
        files: ['**/src/**/*.ts', '**/e2e/**/*.ts'],
        rules: {
            '@typescript-eslint/no-explicit-any': 'off',
            '@typescript-eslint/consistent-type-imports': 'error',
            '@typescript-eslint/consistent-type-definitions': 'error',
        },
    },
]);
