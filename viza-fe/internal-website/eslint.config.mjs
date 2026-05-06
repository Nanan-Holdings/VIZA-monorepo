import globals from "globals";
import pluginJs from "@eslint/js";
import tseslint from "typescript-eslint";
import pluginReact from "eslint-plugin-react";
import pluginReactHooks from "eslint-plugin-react-hooks";

/** @type {import('eslint').Linter.Config[]} */
export default [
  {
    ignores: [
      "**/node_modules/**",
      "**/.next/**",
      "**/dist/**",
      "**/build/**",
      "**/__tests__/**",
      "**/*.test.ts",
      "**/*.test.tsx",
      "**/vitest.config.ts",
      "**/vitest.setup.ts",
      "**/legacy-*.js",
      "types/database.ts",
    ],
  },
  { files: ["**/*.{js,mjs,cjs,ts,tsx}"] },
  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
  },
  pluginJs.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: {
      react: pluginReact,
      "react-hooks": pluginReactHooks,
    },
    rules: {
      "react/react-in-jsx-scope": "off",
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-require-imports": "warn",
      "no-case-declarations": "warn",
      "prefer-const": "warn",
    },
    settings: {
      react: {
        version: "detect",
      },
    },
  },
  // SECRETS-005: forbid the service-role admin client (and the withAdmin
  // helper that wraps it) from any path that ships to the browser. Only
  // server actions (app/actions/**), route handlers (app/api/**, app/auth/**),
  // server pages (app/admin/**), and library helpers in lib/** may import it.
  {
    files: [
      "app/client/**/*.{ts,tsx}",
      "components/**/*.{ts,tsx}",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@/lib/supabase/admin",
              message:
                "Service-role client must not be imported from client code. Use a server action / route handler that goes through `withAdmin()`.",
            },
            {
              name: "@/lib/auth/with-admin",
              message:
                "withAdmin() must not be imported from client code. Call it from a server action or route handler.",
            },
          ],
          patterns: [
            {
              group: [
                "@/lib/supabase/admin",
                "@/lib/auth/with-admin",
                "**/lib/supabase/admin",
                "**/lib/auth/with-admin",
              ],
              message:
                "Service-role / withAdmin imports are forbidden under app/client/** and components/**.",
            },
          ],
        },
      ],
    },
  },
];
