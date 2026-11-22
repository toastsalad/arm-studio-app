import js from '@eslint/js';
import globals from 'globals';

export default [
    {
        ignores: ['build-server/**', 'node_modules/**'],
    },
    {
        files: ['src/**/*.js', 'src/**/*.mjs', 'test/**/*.mjs'],
        ...js.configs.recommended,
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            globals: globals.node,
        },
        rules: {
            // Pass 1 is deliberately just these two: they are the ones that
            // catch a refactor that half-deleted something.
            'no-unused-vars': ['warn', {argsIgnorePattern: '^_', varsIgnorePattern: '^_'}],
            'no-undef': 'error',
        },
    },
];
