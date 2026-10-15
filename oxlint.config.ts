import { react } from '@ms0503/oxc-config/lint';
import { convertGlobals } from '@ms0503/oxc-config/utils';
import globals from 'globals';
import { defineConfig } from 'oxlint';

export default defineConfig({
    extends: [react],
    ignorePatterns: [],
    options: { typeAware: true, typeCheck: true },
    overrides: [
        {
            files: ['src/**/*.ts', 'src/**/*.tsx'],
            globals: convertGlobals({
                ...globals.browser,
                ...globals.builtin,
                ...globals.es2026
            })
        },
        {
            files: ['oxfmt.config.ts', 'oxlint.config.ts', 'vite.config.ts'],
            globals: convertGlobals({
                ...globals.builtin,
                ...globals.es2026,
                ...globals.node
            }),
            rules: {
                'import/extensions': [
                    'error',
                    'always',
                    { ignorePackages: true }
                ],
                'import/no-relative-parent-imports': 'off'
            }
        }
    ],
    rules: {
        'eslint/no-alert': 'off',
        'import/extensions': [
            'error',
            'never',
            { ignorePackages: true, json: 'always' }
        ],
        // incompatible with hono/jsx (expected `htmlFor` but hono/jsx uses `for`)
        'jsx-a11y/label-has-associated-control': 'off'
    }
});
