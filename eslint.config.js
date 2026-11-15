import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['**/dist/', '**/coverage/'] },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: ['packages/*/vitest.config.mts'],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Express error handlers need all four parameters; unused ones start with `_`.
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
      // openid-client marks allowInsecureRequests deprecated only so it stands out: servers need it to
      // reach the IdP over plain HTTP inside a private network, e.g. Docker.
      '@typescript-eslint/no-deprecated': [
        'error',
        { allow: [{ from: 'package', package: 'openid-client', name: 'allowInsecureRequests' }] },
      ],
    },
  },
  // Only the Keycloak adapter knows Keycloak (MVP-2, ADR 0004 in arun-mfe-platform). Its endpoints
  // and claim names are refused everywhere else; tests may use them to build tokens.
  {
    files: ['**/*.ts'],
    ignores: ['packages/server/src/auth/keycloak/**', '**/*.test.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'Literal[value=/resource_access|realm_access|\\/admin\\/realms|kc-admin-api/]',
          message: 'Keycloak-specific: only packages/server/src/auth/keycloak/ may use it.',
        },
        {
          selector:
            'TemplateElement[value.raw=/resource_access|realm_access|\\/admin\\/realms|kc-admin-api/]',
          message: 'Keycloak-specific: only packages/server/src/auth/keycloak/ may use it.',
        },
      ],
    },
  },
  {
    files: ['**/*.{js,mjs}'],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: { globals: globals.node },
  },
);
