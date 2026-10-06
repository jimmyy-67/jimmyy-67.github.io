import js from "@eslint/js";
import globals from "globals";

export default [
  {
    ignores: ["node_modules/**"]
  },
  js.configs.recommended,
  {
    // manifest.js se sirve como script clásico (IIFE sobre window/globalThis).
    files: ["*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "script",
      globals: globals.browser
    },
    linterOptions: {
      reportUnusedDisableDirectives: "error"
    },
    rules: {
      "no-undef": "error",
      "no-unused-vars": ["error", { argsIgnorePattern: "^_", caughtErrors: "none" }]
    }
  },
  {
    // js/ contiene los módulos ES del sitio (punto de entrada: js/main.js).
    files: ["js/**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: globals.browser
    },
    linterOptions: {
      reportUnusedDisableDirectives: "error"
    },
    rules: {
      "no-undef": "error",
      "no-unused-vars": ["error", { argsIgnorePattern: "^_", caughtErrors: "none" }]
    }
  },
  {
    files: ["scripts/**/*.mjs", "*.config.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: globals.node
    }
  }
];
