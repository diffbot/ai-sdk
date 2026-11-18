import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    /* .doc-examples and tests/.generated hold doc snippets copied verbatim by
       scripts/typecheck-doc-examples.mjs and tests/readme-examples.test.ts;
       tsc and vitest are what judge them, not eslint. */
    ignores: [
      "dist/**",
      "node_modules/**",
      "coverage/**",
      "**/.wrangler/**",
      ".doc-examples/**",
      "tests/.generated/**",
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    /* Node scripts (scripts/*.mjs). The TS configs above switch `no-undef` off
       because tsc owns that check; plain JS still needs the globals named. */
    files: ["**/*.mjs"],
    languageOptions: {
      globals: { console: "readonly", process: "readonly" },
    },
  },
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],
    },
  },
);
