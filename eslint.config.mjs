import js from "@eslint/js";
import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";

export default defineConfig([
  {
    files: ["**/*.{js,ts}"],
    extends: [
      js.configs.recommended,
      tseslint.configs.strict,
      tseslint.configs.stylistic,
    ],
    rules: {
      "no-console": process.env.NODE_ENV === "production" ? "error" : "warn",
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],
    },
  },
  {
    // Relaxed rules for test files
    files: ["tests/**/*.ts"],
    rules: {
      // Test mock factories legitimately use 'any' for partial Express type stubs
      "@typescript-eslint/no-explicit-any": "off",
      // Test files never run in production so no-console warnings are noise
      "no-console": "off",
    },
  },
]);
