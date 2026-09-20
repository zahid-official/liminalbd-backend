import pino from "pino";
import { vi } from "vitest";

/**
 * Global test setup.
 *
 * This file runs before every test suite via setupFiles in vitest.config.ts.
 * It mocks infrastructure concerns that must not run during unit tests.
 */

// Silence the Pino logger — creates an authentic Pino instance with level 'silent'
// to prevent stdout/stderr pollution while satisfying pino-http's internal contracts.
const silentLogger = pino({ level: "silent" });

vi.mock("../src/app/config/logger.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/app/config/logger.js")>();
  return {
    ...actual,
    logger: silentLogger,
  };
});
