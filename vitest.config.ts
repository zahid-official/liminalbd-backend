import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Run in Node.js environment (no DOM)
    environment: "node",

    // Require explicit imports from 'vitest' — matches project's import conventions
    globals: false,

    // Automatically clear mock history between tests to prevent state leakage
    clearMocks: true,

    // Test file location
    include: ["tests/**/*.test.ts"],

    // Global setup: mock logger, set test env vars
    setupFiles: ["tests/setup.ts"],

    // TypeScript config for tests (extends main tsconfig with tests/ included)
    typecheck: {
      tsconfig: "./tsconfig.test.json",
    },

    // Coverage configuration
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: [
        "src/generated/**",   // Prisma Client — auto-generated
        "src/server.ts",      // Bootstrap entry point — not unit-testable
        "src/**/*.d.ts",      // Type declaration files
      ],
      reporter: ["text", "lcov", "html"],
      reportsDirectory: "coverage",
    },
  },
});
