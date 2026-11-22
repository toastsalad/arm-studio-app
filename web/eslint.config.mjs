import js from '@eslint/js';
import globals from 'globals';

export default [
    {
        ignores: ['build-web/**', 'node_modules/**'],
    },
    {
        files: ['src/**/*.{js,jsx}'],
        ...js.configs.recommended,
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            globals: globals.browser,
            parserOptions: {ecmaFeatures: {jsx: true}},
        },
        rules: {
            // Pass 1 is deliberately just these two: they are the ones that
            // catch a refactor that half-deleted something.
            'no-unused-vars': ['warn', {argsIgnorePattern: '^_', varsIgnorePattern: '^_'}],
            'no-undef': 'error',
        },
    },
    {
        files: ['test/**/*.js'],
        ...js.configs.recommended,
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            globals: {...globals.browser, ...globals.node},
        },
        rules: {
            'no-unused-vars': ['warn', {argsIgnorePattern: '^_', varsIgnorePattern: '^_'}],
            'no-undef': 'error',
        },
    },
];
