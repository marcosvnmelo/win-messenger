// @ts-check

import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import eslintPluginPrettier from 'eslint-plugin-prettier/recommended';

export default tseslint.config({
    ignores: ['node_modules/**', 'dist/**'],
    extends: [
        eslint.configs.recommended,
        ...tseslint.configs.recommended,
        eslintPluginPrettier,
    ],
    rules: {
        '@typescript-eslint/no-explicit-any': 'off',
    },
});
